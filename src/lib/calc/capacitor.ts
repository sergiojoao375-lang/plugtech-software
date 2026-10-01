// Compensação do fator de potência (bateria de condensadores)
export const CAP_STEPS_KVAR = [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600, 800, 1000];

export function capacitorBank(pKW: number, cosNow: number, cosTarget: number) {
  const c1 = Math.min(0.999, Math.max(0.1, cosNow));
  const c2 = Math.min(0.999, Math.max(0.1, cosTarget));
  const tan1 = Math.tan(Math.acos(c1));
  const tan2 = Math.tan(Math.acos(c2));
  const qc = Math.max(0, pKW * (tan1 - tan2));
  const commercial = qc <= 0 ? 0 : (CAP_STEPS_KVAR.find(s => s >= qc) ?? Math.ceil(qc / 50) * 50);
  const sNow = pKW / c1;
  const sAfter = pKW / c2;
  return { qc, commercial, tan1, tan2, sNow, sAfter, reductionPct: sNow > 0 ? (1 - sAfter / sNow) * 100 : 0 };
}
