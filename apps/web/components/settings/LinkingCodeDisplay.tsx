'use client';

interface LinkingCodeDisplayProps {
  code: string;
  expiresAt: string;
}

export function LinkingCodeDisplay({ code, expiresAt }: LinkingCodeDisplayProps) {
  const expiryTime = new Date(expiresAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-col items-center gap-2 rounded border border-neutral-700 bg-neutral-950 px-4 py-3">
      <span className="font-mono text-2xl tracking-[0.3em] text-neutral-100">{code}</span>
      <span className="text-xs text-neutral-500">Expires at {expiryTime}</span>
    </div>
  );
}
