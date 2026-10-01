// Curvas tempo-corrente aproximadas (IEC 60898-1 disjuntores B/C/D, IEC 60269 fusíveis gG)
export type CurveKind = "B" | "C" | "D" | "gG";

const MAG: Record<"B" | "C" | "D", [number, number]> = { B: [3, 5], C: [5, 10], D: [10, 20] };

/** Tempo máximo de disparo (s) para a corrente I (A) num aparelho de calibre In. */
export function tripTime(kind: CurveKind, In: number, I: number): number {
  const m = I / Math.max(1, In);
  if (kind === "gG") {
    if (m <= 1.25) return Infinity;
    return Math.max(0.004, Math.min(10000, 1000 / Math.pow(m, 4)));
  }
  if (m <= 1.13) return Infinity;
  const [, magMax] = MAG[kind];
  if (m >= magMax) return 0.01;
  return Math.min(10000, 400 / (m * m - 1));
}

export function curvePoints(kind: CurveKind, In: number, iMax: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const start = In * (kind === "gG" ? 1.3 : 1.15);
  const end = Math.max(start * 2, iMax);
  const n = 80;
  for (let k = 0; k <= n; k++) {
    const I = start * Math.pow(end / start, k / n);
    const t = tripTime(kind, In, I);
    if (Number.isFinite(t)) pts.push([I, t]);
  }
  return pts;
}

/** Limite de seletividade (A): maior corrente até à qual o montante é mais lento que o jusante. */
export function selectivityLimit(up: { kind: CurveKind; In: number }, down: { kind: CurveKind; In: number }, iccA: number): {
  limitA: number; total: boolean;
} {
  if (up.In <= down.In) return { limitA: down.In, total: false };
  const start = down.In * 1.2;
  const end = Math.max(start * 1.01, iccA);
  let limit = end;
  for (let k = 0; k <= 200; k++) {
    const I = start * Math.pow(end / start, k / 200);
    const tu = tripTime(up.kind, up.In, I);
    const td = tripTime(down.kind, down.In, I);
    if (Number.isFinite(tu) && tu <= td * 1.0001) { limit = I; break; }
  }
  // ambos instantâneos: seletividade energética considerada até ao início da zona magnética do montante
  return { limitA: limit, total: limit >= iccA };
}
