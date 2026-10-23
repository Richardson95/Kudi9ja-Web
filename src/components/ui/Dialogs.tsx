import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { PIN_LENGTH } from '../../config';
import { naira } from '../../lib/format';
import { Button } from './Button';
import { DetailRows } from './Card';
import { Textarea } from './Field';
import { Modal } from './Modal';
import { NumericKeypad, PasscodeDots } from './PinPad';

/**
 * Promise-based dialogs, so a flow reads top to bottom the way the app's
 * does: `const pin = await dialogs.pin({...}); if (!pin) return;`.
 */

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ReasonOptions {
  title: string;
  message: ReactNode;
  placeholder?: string;
  confirmLabel?: string;
  minLength?: number;
  maxLength?: number;
  danger?: boolean;
  quote?: string;
}

interface PinOptions {
  title: string;
  amountLabel: string;
  amount?: number;
  details?: [string, string][];
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  reason: (o: ReasonOptions) => Promise<string | null>;
  /** The transaction PIN, collected for the action itself — the server checks it on the request that moves the money. */
  pin: (o: PinOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

type Pending =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'reason'; options: ReasonOptions; resolve: (v: string | null) => void }
  | { kind: 'pin'; options: PinOptions; resolve: (v: string | null) => void };

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) => new Promise((resolve) => setPending({ kind: 'confirm', options, resolve })),
      reason: (options) => new Promise((resolve) => setPending({ kind: 'reason', options, resolve })),
      pin: (options) => new Promise((resolve) => setPending({ kind: 'pin', options, resolve })),
    }),
    [],
  );

  const close = () => setPending(null);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {pending?.kind === 'confirm' && (
        <ConfirmDialog
          options={pending.options}
          onDone={(v) => {
            pending.resolve(v);
            close();
          }}
        />
      )}
      {pending?.kind === 'reason' && (
        <ReasonDialog
          options={pending.options}
          onDone={(v) => {
            pending.resolve(v);
            close();
          }}
        />
      )}
      {pending?.kind === 'pin' && (
        <PinDialog
          options={pending.options}
          onDone={(v) => {
            pending.resolve(v);
            close();
          }}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialogs(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
}

function ConfirmDialog({ options, onDone }: { options: ConfirmOptions; onDone: (v: boolean) => void }) {
  return (
    <Modal
      open
      size="sm"
      onClose={() => onDone(false)}
      title={options.title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="subtle" onClick={() => onDone(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={options.danger ? 'danger' : 'gold'} onClick={() => onDone(true)} data-autofocus>
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      }
    >
      <div className="text-sm leading-relaxed text-ink-2">{options.message}</div>
    </Modal>
  );
}

function ReasonDialog({ options, onDone }: { options: ReasonOptions; onDone: (v: string | null) => void }) {
  const [text, setText] = useState('');
  const min = options.minLength ?? 3;
  const enough = text.trim().length >= min;
  return (
    <Modal
      open
      size="sm"
      onClose={() => onDone(null)}
      title={options.title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="subtle" onClick={() => onDone(null)}>
            Cancel
          </Button>
          <Button variant={options.danger ? 'danger' : 'gold'} disabled={!enough} onClick={() => onDone(text.trim())}>
            {options.confirmLabel ?? 'Continue'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-sm leading-relaxed text-ink-2">{options.message}</div>
        {options.quote && (
          <blockquote className="rounded-xl border-l-2 border-gold bg-surface-alt/60 px-4 py-3 text-sm italic text-ink-2">
            “{options.quote}”
          </blockquote>
        )}
        <Textarea
          data-autofocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={options.placeholder}
          maxLength={options.maxLength ?? 500}
          hint={!enough ? `At least ${min} characters.` : undefined}
        />
      </div>
    </Modal>
  );
}

function PinDialog({ options, onDone }: { options: PinOptions; onDone: (v: string | null) => void }) {
  const [pin, setPin] = useState('');
  const value = useRef('');
  const done = useRef(false);

  const digit = (d: string) => {
    if (done.current || value.current.length >= PIN_LENGTH) return;
    value.current += d;
    setPin(value.current);
    if (value.current.length === PIN_LENGTH) {
      done.current = true;
      const entered = value.current;
      window.setTimeout(() => onDone(entered), 160);
    }
  };

  const backspace = useCallback(() => {
    if (done.current) return;
    value.current = value.current.slice(0, -1);
    setPin(value.current);
  }, []);

  return (
    <Modal open size="sm" onClose={() => onDone(null)} title={options.title} description={options.amountLabel}>
      <div className="space-y-5">
        {options.amount !== undefined && (
          <p className="num text-center text-[34px] font-extrabold tracking-[-0.03em] gold-text">{naira(options.amount)}</p>
        )}
        {options.details && options.details.length > 0 && (
          <div className="rounded-2xl border border-stroke bg-canvas/40 p-4">
            <DetailRows rows={options.details.map(([k, v]) => [k, v] as const)} />
          </div>
        )}
        <div className="space-y-4 pt-1">
          <p className="flex items-center justify-center gap-2 text-[13px] font-semibold text-ink-2">
            <Lock className="h-3.5 w-3.5 text-gold" /> Enter your {PIN_LENGTH}-digit transaction PIN
          </p>
          <PasscodeDots length={PIN_LENGTH} filled={pin.length} size={17} />
          <NumericKeypad onDigit={digit} onBackspace={backspace} />
        </div>
        <Button variant="subtle" block onClick={() => onDone(null)}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
