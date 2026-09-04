export function LogoST({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="plg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        {/* fundo arredondado */}
        <rect x="2" y="2" width="60" height="60" rx="14" fill="oklch(0.19 0.025 250)" />
        {/* monograma PL com tomada estilizada */}
        <g fill="none" stroke="url(#plg)" strokeLinecap="round" strokeLinejoin="round">
          {/* letra P */}
          <path d="M18 18 L18 46" strokeWidth="5.5" />
          <path d="M18 18 L36 18 C44 18 44 31 36 31 L18 31" strokeWidth="5.5" />
          {/* corpo da tomada dentro do P */}
          <rect x="26" y="21" width="10" height="14" rx="3" strokeWidth="3.5" />
          <path d="M29 21 L29 16 M33 21 L33 16" strokeWidth="3" />
          {/* letra L / cabo */}
          <path d="M18 46 L42 46 C48 46 48 40 44 36" strokeWidth="5.5" />
        </g>
      </svg>
      <div className="leading-tight">
        <div className="font-bold tracking-wide text-foreground">PLUGTECH <span className="text-[color:var(--brand-green)]">CalcStudio Pro</span></div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">SérgioTech • v1.0</div>
      </div>
    </div>
  );
}
