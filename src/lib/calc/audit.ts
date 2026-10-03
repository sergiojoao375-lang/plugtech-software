// Auditor de conformidade RTIEBT / IEC 60364 em tempo real
import type { Circuit, CalcResult, FeederContext } from "./engine";
import { checkRCD, rcdOf, type RCD } from "./rcd";

export type AuditLevel = "critical" | "warn" | "info";
export interface AuditIssue { level: AuditLevel; circuitId?: string; circuitName?: string; rule: string; msg: string; }

const NEED_RCD = new Set(["Tomadas", "Termoacumulador", "PlacaCozinha"]);

export function auditPanel(params: {
  computed: Array<{ c: Circuit; r: CalcResult }>;
  ctx: FeederContext;
  imbalancePct: number;
  isQGE: boolean;
  rcds?: RCD[];
}): { issues: AuditIssue[]; score: number } {
  const { computed, ctx, imbalancePct, isQGE, rcds } = params;
  const issues: AuditIssue[] = [];
  const isPT = ctx.supplyType === "PT";
  const useRcds = !!rcds && rcds.length > 0;

  for (const { c, r } of computed) {
    const base = { circuitId: c.id, circuitName: c.name };
    const total = ctx.feederDeltaU + r.deltaU;
    const lim = c.type === "Iluminacao" ? (isPT ? 6 : 3) : (isPT ? 8 : 5);
    if (total > lim) issues.push({ ...base, level: "critical", rule: "RTIEBT 525", msg: `ΔU acumulada ${total.toFixed(2)}% > ${lim}%` });
    else if (total > lim * 0.85) issues.push({ ...base, level: "warn", rule: "RTIEBT 525", msg: `ΔU acumulada ${total.toFixed(2)}% perto do limite de ${lim}%` });

    if (r.ib > r.iz) issues.push({ ...base, level: "critical", rule: "RTIEBT 433", msg: `Cabo em sobrecarga: Ib ${r.ib.toFixed(1)} A > Iz ${r.iz} A` });
    if (r.in > r.iz) issues.push({ ...base, level: "critical", rule: "RTIEBT 433", msg: `Coordenação falhada: In ${r.in} A > Iz ${r.iz} A` });
    if (r.in < r.ib) issues.push({ ...base, level: "critical", rule: "RTIEBT 433", msg: `Disjuntor subdimensionado: In ${r.in} A < Ib ${r.ib.toFixed(1)} A` });
    if (!isQGE && c.type !== "QuadroParcial" && r.in > 40) issues.push({ ...base, level: "critical", rule: "Quadro parcial", msg: `Calibre ${r.in} A excede 40 A num quadro parcial` });
    if (useRcds) {
      const d = rcdOf(rcds, c.id);
      if (NEED_RCD.has(c.type) && (!d || d.iAnmA > 30)) issues.push({ ...base, level: "critical", rule: "RTIEBT 411/701", msg: d ? `Diferencial ${d.label} de ${d.iAnmA} mA — exige ≤ 30 mA` : "Circuito não atribuído a nenhum diferencial ≤ 30 mA" });
      else if (!d && c.type !== "QuadroParcial") issues.push({ ...base, level: "info", rule: "RTIEBT 411", msg: "Circuito sem diferencial atribuído" });
    } else if (NEED_RCD.has(c.type) && c.rcd30 === false) issues.push({ ...base, level: "critical", rule: "RTIEBT 411/701", msg: "Circuito sem diferencial de alta sensibilidade (≤ 30 mA)" });
    if (r.icuKA > 6) issues.push({ ...base, level: r.icuKA > 25 ? "warn" : "info", rule: "IEC 60898/60947", msg: `Poder de corte exigido ≥ ${r.icuKA} kA (aparelhagem doméstica de 6 kA insuficiente)` });
    if (r.parallel > 1) issues.push({ ...base, level: "info", rule: "RTIEBT 523.6", msg: `${r.parallel} condutores em paralelo por fase — garantir mesma secção, comprimento e material` });
  }
  for (const d of rcds ?? []) {
    const k = checkRCD(d, computed);
    for (const m of k.issues) issues.push({ level: "critical", rule: `DR ${d.label}`, msg: m });
    for (const m of k.warnings) issues.push({ level: "warn", rule: `DR ${d.label}`, msg: m });
  }

  if (imbalancePct >= 15) issues.push({ level: "critical", rule: "Equilíbrio", msg: `Desequilíbrio entre fases ${imbalancePct.toFixed(1)}% (≥ 15%)` });
  else if (imbalancePct >= 10) issues.push({ level: "warn", rule: "Equilíbrio", msg: `Desequilíbrio entre fases ${imbalancePct.toFixed(1)}% (≥ 10%)` });
  if (ctx.feederDeltaU > 1.5) issues.push({ level: "warn", rule: "Alimentação", msg: `ΔU na linha de interligação ${ctx.feederDeltaU.toFixed(2)}% > 1,5%` });

  const crit = issues.filter(i => i.level === "critical").length;
  const warn = issues.filter(i => i.level === "warn").length;
  const score = Math.max(0, 100 - crit * 12 - warn * 4);
  return { issues, score };
}
