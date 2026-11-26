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
/**
 * Frames a turn or open mouth must be held for, so a flicker is not counted.
 * A blink needs only one frame: it lasts a tenth of a second, and a cheap
 * phone may see only one frame of it.
 */
const HOLD_FRAMES = 2;
/** After this long on one movement with a face in view, the customer may take the photo themselves. */
const MANUAL_AFTER_MS = 20_000;

type Point = { x: number; y: number };
const gap = (a?: Point, b?: Point) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0);
/** Eye height over eye width, both eyes averaged. Falls when the eyes close. */
const eyeOpenness = (lm: Point[]) => {
  const left = gap(lm[159], lm[145]) / (gap(lm[33], lm[133]) || 1);
  const right = gap(lm[386], lm[374]) / (gap(lm[362], lm[263]) || 1);
  return (left + right) / 2;
};

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
  const [canTakeManually, setCanTakeManually] = useState(false);
  const manualRef = useRef<(() => void) | null>(null);

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
    setCanTakeManually(false);
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
    let openBaseline = 0;
    let lastTime = -1;
    let stepStarted = performance.now();
    let faceInView = false;
    const taken: Partial<Record<Pose, string>> = {};

    /** Keeps the photo for the current movement and moves on. Returns false when the check is finished. */
    const advance = (): boolean => {
      const pose = ORDER[step]!;
      const shot = snapshot();
      if (!shot) return true;
      taken[pose] = shot;
      setPhotos({ ...taken });
      held = 0;
      step += 1;
      stepStarted = performance.now();
      setCanTakeManually(false);
      if (step >= ORDER.length) {
        stop();
        manualRef.current = null;
        setPhase('passed');
        return false;
      }
      setIndex(step);
      return true;
    };
    manualRef.current = () => {
      if (faceInView) advance();
    };

    const loop = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || !streamRef.current) return;
      const now = performance.now();
      if (video.readyState >= 2 && now !== lastTime) {
        lastTime = now;
        const result = landmarker.detectForVideo(video, now);
        const faces = result.faceLandmarks.length;
        faceInView = faces === 1;
        if (faces === 0) {
          setHint('We cannot see your face. Face the camera in good light.');
          held = 0;
        } else if (faces > 1) {
          setHint('Only you should be in the picture.');
          held = 0;
        } else {
          setHint(null);
          if (now - stepStarted > MANUAL_AFTER_MS) setCanTakeManually(true);
          const scores: Record<string, number> = {};
          for (const c of result.faceBlendshapes[0]?.categories ?? []) scores[c.categoryName] = c.score;
          const lm = result.faceLandmarks[0] ?? [];
          // Where the nose sits between the two sides of the face: about 0.5 facing forward.
          const left = lm[234]?.x ?? 0;
          const right = lm[454]?.x ?? 1;
          const yaw = ((lm[1]?.x ?? 0.5) - left) / (right - left || 1);
          const blink = ((scores.eyeBlinkLeft ?? 0) + (scores.eyeBlinkRight ?? 0)) / 2;
          const openness = eyeOpenness(lm);
          const jaw = scores.jawOpen ?? 0;
          // Lip gap over face height, for when the jaw score runs low.
          const lips = gap(lm[13], lm[14]) / (gap(lm[10], lm[152]) || 1);

          const pose = ORDER[step]!;
          let done = false;
          if (pose === 'BLINK') {
            // Measured against this person's own open eyes, so small eyes,
            // glasses or a bright window behind them do not stop a real blink.
            openBaseline = Math.max(openBaseline, openness);
            done = openBaseline > 0 && (blink > 0.4 || openness < openBaseline * 0.6);
          } else if (pose === 'TURN') {
            if (yaw > 0.38 && yaw < 0.62) centred = true;
            held = centred && (yaw < 0.32 || yaw > 0.68) ? held + 1 : 0;
            done = held >= HOLD_FRAMES;
          } else {
            held = jaw > 0.35 || lips > 0.06 ? held + 1 : 0;
            done = held >= HOLD_FRAMES;
          }

          if (done && !advance()) return;
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

      {phase === 'running' && canTakeManually && (
        <Button size="lg" block variant="outline" icon={<Camera />} onClick={() => manualRef.current?.()}>
          Take the photo
        </Button>
      )}
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
