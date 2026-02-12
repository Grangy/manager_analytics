'use client';

type LoaderProps = {
  label?: string;
  size?: 'full' | 'inline' | 'icon';
};

function SpinnerRing({
  className = 'w-16 h-16',
  innerInset = 'inset-2',
  innerBg = 'bg-slate-950',
}: {
  className?: string;
  innerInset?: string;
  innerBg?: string;
}) {
  return (
    <div className="relative">
      <div
        className={`relative ${className} rounded-full animate-spin`}
        style={{
          background: 'conic-gradient(from 0deg, #6366f1, #22d3ee, #a78bfa, #6366f1)',
        }}
      >
        <div className={`absolute ${innerInset} rounded-full ${innerBg}`} />
      </div>
    </div>
  );
}

export function Loader({ label = 'Загрузка...', size = 'full' }: LoaderProps) {
  const isFull = size === 'full';
  const isIcon = size === 'icon';

  if (isIcon) {
    return (
      <div className="flex items-center justify-center py-12">
        <SpinnerRing className="w-10 h-10" innerInset="inset-1.5" innerBg="bg-slate-900" />
      </div>
    );
  }

  const ringSize = isFull ? 'w-16 h-16' : 'w-12 h-12';
  const innerInset = isFull ? 'inset-2' : 'inset-1.5';

  return (
    <div
      className={
        isFull
          ? 'min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6'
          : 'flex flex-col items-center justify-center gap-3 py-12'
      }
    >
      <div className="relative">
        {isFull && (
          <div className="absolute -inset-6 rounded-full bg-violet-500/15 blur-2xl animate-pulse" />
        )}
        <SpinnerRing className={ringSize} innerInset={innerInset} />
      </div>
      <p className="text-slate-400 text-sm font-medium tracking-wide">{label}</p>
    </div>
  );
}
