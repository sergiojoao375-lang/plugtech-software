// Estados de alerta com cores (OK / Quase a exceder / Crítico)
export type Status = "ok" | "warn" | "critical";

export function statusColors(s: Status): { text: string; bg: string; border: string; chip: string } {
  switch (s) {
    case "ok":
      return {
        text: "text-[color:var(--brand-green)]",
        bg: "bg-[color:var(--brand-green)]/10",
        border: "border-[color:var(--brand-green)]/40",
        chip: "bg-[color:var(--brand-green)]/15 text-[color:var(--brand-green)] border border-[color:var(--brand-green)]/40",
      };
    case "warn":
      return {
        text: "text-warning",
        bg: "bg-warning/15",
        border: "border-warning/50",
        chip: "bg-warning/20 text-warning border border-warning/50",
      };
    case "critical":
      return {
        text: "text-destructive",
        bg: "bg-destructive/20",
        border: "border-destructive/60",
        chip: "bg-destructive/25 text-destructive border border-destructive/60 animate-pulse",
      };
  }
}

// Classifica um valor entre OK, quase a exceder (warn) e crítico
export function classify(value: number, warnAt: number, criticalAt: number): Status {
  if (value >= criticalAt) return "critical";
  if (value >= warnAt) return "warn";
  return "ok";
}
