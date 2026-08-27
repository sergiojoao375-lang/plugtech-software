export function LogoST({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="stg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.22 145)" />
            <stop offset="100%" stopColor="oklch(0.65 0.22 250)" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="14" fill="oklch(0.19 0.025 250)" stroke="url(#stg)" strokeWidth="2.5" />
        <path d="M20 22 L20 42 M20 22 L34 22 M34 22 L34 32 L20 32 M20 42 L34 42 L34 32" fill="none" stroke="oklch(0.85 0.22 145)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M40 22 L52 22 M46 22 L46 42" fill="none" stroke="oklch(0.65 0.22 250)" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
      <div className="leading-tight">
        <div className="font-bold tracking-wide text-foreground">PLUGTECH <span className="text-[color:var(--brand-green)]">CalcStudio Pro</span></div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">SérgioTech • v1.0</div>
      </div>
    </div>
  );
}
