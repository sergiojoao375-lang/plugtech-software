// Diferenciais (DR / IDR): verificação RTIEBT 411 / 531 / IEC 61008
import type { Circuit, CalcResult } from "./engine";

export interface RCD {
  id: string;
  label: string;
  inA: number;        // calibre nominal
  iAnmA: number;      // sensibilidade
  poles: 2 | 4;
  kind: "AC" | "A" | "F" | "B";
  circuitIds: string[];
}

export const RCD_RATINGS = [25, 40, 63, 80, 100, 125];
export const RCD_SENS = [10, 30, 100, 300, 500];
const NEED_30 = new Set(["Tomadas", "Termoacumulador", "PlacaCozinha"]);

export interface RCDCheck { rcd: RCD; ibSum: number; inMax: number; ok: boolean; issues: string[]; warnings: string[]; suggestion?: number; }

export function checkRCD(rcd: RCD, rows: Array<{ c: Circuit; r: CalcResult }>): RCDCheck {
  const mine = rows.filter(x => rcd.circuitIds.includes(x.c.id));
  const issues: string[] = [], warnings: string[] = [];
  // Ib por fase (mono vão para a sua fase; tri somam em todas)
  const ph = { L1: 0, L2: 0, L3: 0 };
  for (const { c, r } of mine) {
    if (c.phase === "Tri") { ph.L1 += r.ib; ph.L2 += r.ib; ph.L3 += r.ib; }
    else ph[c.phaseAssign ?? "L1"] += r.ib;
  }
  const ibSum = rcd.poles === 2 ? mine.reduce((a, x) => a + x.r.ib, 0) : Math.max(ph.L1, ph.L2, ph.L3);
  const inMax = mine.reduce((a, x) => Math.max(a, x.r.in), 0);
  let suggestion: number | undefined;
  if (mine.length === 0) warnings.push("Sem circuitos atribuídos.");
  if (ibSum > rcd.inA) {
    suggestion = RCD_RATINGS.find(v => v >= ibSum);
    issues.push(`Sobrecarga: ΣIb ${ibSum.toFixed(1)} A > In ${rcd.inA} A${suggestion ? ` — usar ${suggestion} A` : ""}.`);
  } else if (inMax > rcd.inA) warnings.push(`Disjuntor a jusante de ${inMax} A maior que o DR (${rcd.inA} A) — DR não fica protegido contra sobrecarga por um único circuito.`);
  if (rcd.poles === 2 && mine.some(x => x.c.phase === "Tri")) issues.push("DR bipolar (2P) não pode proteger circuitos trifásicos — usar 4P.");
  if (rcd.poles === 2) {
    const phases = new Set(mine.filter(x => x.c.phase === "Mono").map(x => x.c.phaseAssign ?? "L1"));
    if (phases.size > 1) issues.push(`DR 2P com circuitos em fases diferentes (${[...phases].join(", ")}) — usar 4P ou agrupar na mesma fase.`);
  }
  const need = mine.filter(x => NEED_30.has(x.c.type));
  if (need.length && rcd.iAnmA > 30) issues.push(`${need.length} circuito(s) de tomadas/cozinha/termoacumulador exigem IΔn ≤ 30 mA.`);
  // fuga natural ≈ 0,5 mA por circuito + 1 mA por 10 A; manter < 30 % de IΔn
  const leak = mine.length * 0.5 + ibSum * 0.1;
  if (leak > rcd.iAnmA * 0.3) warnings.push(`Fuga permanente estimada ${leak.toFixed(1)} mA > 30 % de IΔn — risco de disparos intempestivos; dividir por mais DR.`);
  if (rcd.iAnmA <= 30 && mine.length > 6) warnings.push(`${mine.length} circuitos num DR de ${rcd.iAnmA} mA — recomendado ≤ 6.`);
  if (mine.some(x => x.c.type === "UAC" || x.c.type === "AC") && rcd.kind === "AC") warnings.push("Cargas com eletrónica (AVAC/variadores): preferir DR tipo A ou F.");
  return { rcd, ibSum, inMax, ok: issues.length === 0, issues, warnings, suggestion };
}

export function rcdOf(rcds: RCD[] | undefined, circuitId: string) {
  return rcds?.find(r => r.circuitIds.includes(circuitId));
}
