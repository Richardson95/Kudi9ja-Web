import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCw, ScanFace } from 'lucide-react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Bits';
import { signupApi } from '../../../lib/api/endpoints';
import { describeError } from '../../../lib/api/errors';
import { cn } from '../../../lib/cn';
import type { StepProps } from './Signup';
import { StepFrame } from './Steps';

/**
 * Face check: blink, turn your head, open your mouth.
 *
 * The movements are read on this device from the camera (MediaPipe face
 * landmarks, files served from /mediapipe). One photo of each movement is
 * sent to the server and kept on the customer's record for the team to see.
 * Continue stays disabled until all three have been done.
 */

type Pose = 'BLINK' | 'TURN' | 'MOUTH';
const ORDER: Pose[] = ['BLINK', 'TURN', 'MOUTH'];
const PROMPT: Record<Pose, string> = {
  BLINK: 'Blink your eyes',
  TURN: 'Slowly turn your head to one side',
  MOUTH: 'Open your mouth wide',
};
/** Frames a movement must be held for, so a flicker is not counted. */
const HOLD_FRAMES = 3;

type Phase = 'intro' | 'loading' | 'running' | 'passed' | 'error';

export function FaceCheckStep({ draft, next }: StepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const frameRef = useRef<number>(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [photos, setPhotos] = useState<Partial<Record<Pose, string>>>({});
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stop();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    },
    [stop],
  );

  const snapshot = (): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const scale = Math.min(1, 720 / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const start = async () => {
    setError(null);
    setPhotos({});
    setIndex(0);
    setPhase('loading');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser cannot use the camera. Open Kudi9ja in Chrome, Safari or Edge.');
      }
      const stream = await navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
        .catch(() => {
          throw new Error('We could not open your camera. Allow camera access for this site in your browser, then try again.');
        });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      if (!landmarkerRef.current) {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const files = await FilesetResolver.forVisionTasks('/mediapipe');
        const make = (delegate: 'GPU' | 'CPU') =>
          FaceLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate },
            runningMode: 'VIDEO',
            numFaces: 2,
            outputFaceBlendshapes: true,
          });
        landmarkerRef.current = await make('GPU').catch(() => make('CPU'));
      }
      setPhase('running');
      track();
    } catch (e) {
      stop();
      setError(e instanceof Error ? e.message : 'The face check could not start. Try again.');
      setPhase('error');
    }
  };

  const track = () => {
    let step = 0;
    let held = 0;
    let centred = false;
    let eyesOpenSeen = false;
    let lastTime = -1;
    const taken: Partial<Record<Pose, string>> = {};

    const loop = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || !streamRef.current) return;
      const now = performance.now();
      if (video.readyState >= 2 && now !== lastTime) {
        lastTime = now;
        const result = landmarker.detectForVideo(video, now);
        const faces = result.faceLandmarks.length;
        if (faces === 0) {
          setHint('We cannot see your face. Face the camera in good light.');
          held = 0;
        } else if (faces > 1) {
          setHint('Only you should be in the picture.');
          held = 0;
        } else {
          setHint(null);
          const scores: Record<string, number> = {};
          for (const c of result.faceBlendshapes[0]?.categories ?? []) scores[c.categoryName] = c.score;
          const lm = result.faceLandmarks[0] ?? [];
          // Where the nose sits between the two sides of the face: about 0.5 facing forward.
          const left = lm[234]?.x ?? 0;
          const right = lm[454]?.x ?? 1;
          const yaw = ((lm[1]?.x ?? 0.5) - left) / (right - left || 1);
          const blink = Math.min(scores.eyeBlinkLeft ?? 0, scores.eyeBlinkRight ?? 0);
          const jaw = scores.jawOpen ?? 0;

          const pose = ORDER[step]!;
          let doing = false;
          if (pose === 'BLINK') {
            if (blink < 0.3) eyesOpenSeen = true;
            doing = eyesOpenSeen && blink > 0.55;
          } else if (pose === 'TURN') {
            if (yaw > 0.4 && yaw < 0.6) centred = true;
            doing = centred && (yaw < 0.28 || yaw > 0.72);
          } else {
            doing = jaw > 0.5;
          }

          held = doing ? held + 1 : 0;
          if (held >= HOLD_FRAMES) {
            const shot = snapshot();
            if (shot) {
              taken[pose] = shot;
              setPhotos({ ...taken });
            }
            held = 0;
            step += 1;
            if (step >= ORDER.length) {
              stop();
              setPhase('passed');
              return;
            }
            setIndex(step);
          }
        }
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
  };

  const submit = async () => {
    if (!draft.draftId || !photos.BLINK || !photos.TURN || !photos.MOUTH) return;
    setBusy(true);
    setError(null);
    try {
      await signupApi.liveness(draft.draftId, { blink: photos.BLINK, turn: photos.TURN, mouth: photos.MOUTH });
      next();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const passed = phase === 'passed';
  const live = phase === 'loading' || phase === 'running';

  return (
    <StepFrame
      headline="Face check"
      subhead="Look at the camera, then blink, turn your head and open your mouth when asked. It takes a few seconds, and three photos are saved to your account."
      action={
        <Button size="lg" block loading={busy} disabled={!passed} onClick={submit}>
          Continue
        </Button>
      }
    >
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl border border-stroke bg-surface-alt sm:aspect-[4/3] sm:max-w-md">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn('h-full w-full -scale-x-100 object-cover', !live && 'invisible')}
        />
        {!live && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            {passed ? (
              <div className="space-y-2">
                <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
                <p className="text-lg font-extrabold">Face check passed</p>
              </div>
            ) : (
              <ScanFace className="h-20 w-20 text-ink-3" />
            )}
          </div>
        )}
        {live && (
          <>
            <div className="pointer-events-none absolute inset-[12%] rounded-[45%] border-4 border-gold/70" />
            <div className="absolute inset-x-0 bottom-0 bg-canvas/80 p-4 text-center backdrop-blur">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold">
                {phase === 'loading' ? 'Starting camera…' : `Step ${index + 1} of 3`}
              </p>
              {phase === 'running' && <p className="mt-1 text-lg font-extrabold">{PROMPT[ORDER[index]!]}</p>}
              {hint && <p className="mt-1 text-[13px] text-danger">{hint}</p>}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-center gap-3">
        {ORDER.map((p) => (
          <div key={p} className="text-center">
            <div className={cn('h-16 w-16 overflow-hidden rounded-2xl border-2', photos[p] ? 'border-success' : 'border-stroke')}>
              {photos[p] ? <img src={photos[p]} alt="" className="h-full w-full -scale-x-100 object-cover" /> : null}
            </div>
            <p className="mt-1 text-[11px] font-semibold text-ink-2">{p === 'BLINK' ? 'Blink' : p === 'TURN' ? 'Turn' : 'Mouth'}</p>
          </div>
        ))}
      </div>

      {phase === 'intro' && (
        <Button size="lg" block variant="outline" icon={<Camera />} onClick={start}>
          Start face check
        </Button>
      )}
      {(phase === 'error' || passed) && (
        <Button size="md" block variant="ghost" icon={<RefreshCw />} onClick={start}>
          {passed ? 'Do it again' : 'Try again'}
        </Button>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </StepFrame>
  );
}
