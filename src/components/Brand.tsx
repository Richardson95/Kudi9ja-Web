import { Link } from 'react-router-dom';
import { cn } from '../lib/cn';

export function BrandMark({ size = 32, halo, spin, className }: { size?: number; halo?: boolean; spin?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      {halo && <span className="absolute inset-[-40%] animate-glow rounded-full bg-gold/25 blur-2xl" />}
      <img
        src="/brand/mark_gold.png"
        alt=""
        width={size}
        height={size}
        className={cn('relative h-full w-full object-contain', spin && 'animate-spin-slow')}
        draggable={false}
      />
    </span>
  );
}

export function BrandLogo({ height = 30, to, className }: { height?: number; to?: string; className?: string }) {
  const img = (
    <img
      src="/brand/logo_gold.png"
      alt="Kudi9ja — easy money"
      style={{ height }}
      className={cn('w-auto select-none object-contain', className)}
      draggable={false}
    />
  );
  return to ? (
    <Link to={to} className="inline-flex" aria-label="Kudi9ja home">
      {img}
    </Link>
  ) : (
    img
  );
}
