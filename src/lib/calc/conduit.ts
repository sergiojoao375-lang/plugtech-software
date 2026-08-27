// PLUGTECH CalcStudio Pro - Cálculo da secção/diâmetro de tubagem eléctrica
// Método simplificado por taxa de enchimento (RTIEBT / boas práticas)

export type CableKind = "H07V-K" | "H07V-R" | "XV" | "RZ1-K" | "XZ1" | "FVV";

export const CABLE_KINDS: { v: CableKind; label: string }[] = [
  { v: "H07V-K", label: "H07V-K (fio flexível)" },
  { v: "H07V-R", label: "H07V-R (fio rígido)" },
  { v: "XV",     label: "XV / VV (cabo PVC)" },
  { v: "RZ1-K",  label: "RZ1-K (XLPE, isento halogéneo)" },
  { v: "XZ1",    label: "XZ1 (XLPE, isento halogéneo)" },
  { v: "FVV",    label: "FVV (multipolar PVC)" },
];

// Diâmetro exterior aproximado (mm) por tipo de condutor e secção (mm²).
// Valores médios de catálogo (unipolar, exceto FVV que é multipolar aproximado por veia equivalente).
export const CABLE_OD_BY_TYPE: Record<CableKind, Record<number, number>> = {
  "H07V-K": {
    1.5: 3.0, 2.5: 3.6, 4: 4.0, 6: 4.6, 10: 6.0, 16: 7.0,
    25: 8.8, 35: 9.6, 50: 11.2, 70: 13.0, 95: 14.8, 120: 16.4,
    150: 18.0, 185: 20.0, 240: 22.6, 300: 25.0,
  },
  "H07V-R": {
    1.5: 3.0, 2.5: 3.6, 4: 4.1, 6: 4.7, 10: 6.2, 16: 7.3,
    25: 9.1, 35: 10.0, 50: 11.7, 70: 13.5, 95: 15.4, 120: 17.0,
    150: 18.6, 185: 20.8, 240: 23.4, 300: 25.8,
  },
  "XV": {
    1.5: 6.0, 2.5: 6.6, 4: 7.2, 6: 7.8, 10: 9.4, 16: 10.6,
    25: 13.0, 35: 14.2, 50: 16.0, 70: 18.4, 95: 20.8, 120: 22.8,
    150: 25.0, 185: 27.6, 240: 30.8, 300: 34.0,
  },
  "RZ1-K": {
    1.5: 5.8, 2.5: 6.4, 4: 7.0, 6: 7.6, 10: 9.0, 16: 10.2,
    25: 12.4, 35: 13.6, 50: 15.4, 70: 17.6, 95: 20.0, 120: 22.0,
    150: 24.2, 185: 26.8, 240: 30.0, 300: 33.0,
  },
  "XZ1": {
    1.5: 5.8, 2.5: 6.4, 4: 7.0, 6: 7.6, 10: 9.0, 16: 10.2,
    25: 12.4, 35: 13.6, 50: 15.4, 70: 17.6, 95: 20.0, 120: 22.0,
    150: 24.2, 185: 26.8, 240: 30.0, 300: 33.0,
  },
  "FVV": {
    1.5: 6.2, 2.5: 6.8, 4: 7.6, 6: 8.4, 10: 10.2, 16: 11.6,
    25: 14.2, 35: 15.6, 50: 17.8, 70: 20.4, 95: 23.2, 120: 25.6,
    150: 28.0, 185: 31.0, 240: 34.6, 300: 38.0,
  },
};

// Compat: tabela do fio H07V-K (usada por defeito)
export const CABLE_OD: Record<number, number> = CABLE_OD_BY_TYPE["H07V-K"];

export function odFor(kind: CableKind, section: number): number | undefined {
  return CABLE_OD_BY_TYPE[kind]?.[section];
}

export function sectionsFor(kind: CableKind): number[] {
  return Object.keys(CABLE_OD_BY_TYPE[kind] ?? {}).map(Number).sort((a, b) => a - b);
}

// Tubos normalizados (diâmetro nominal exterior, mm) e diâmetro interior útil aprox.
export const STD_CONDUITS: { nominal: number; inner: number }[] = [
  { nominal: 16, inner: 12.2 },
  { nominal: 20, inner: 15.8 },
  { nominal: 25, inner: 20.4 },
  { nominal: 32, inner: 26.4 },
  { nominal: 40, inner: 33.0 },
  { nominal: 50, inner: 41.4 },
  { nominal: 63, inner: 52.6 },
  { nominal: 75, inner: 63.0 },
  { nominal: 90, inner: 75.8 },
  { nominal: 110, inner: 92.8 },
  { nominal: 125, inner: 105.6 },
  { nominal: 140, inner: 118.0 },
  { nominal: 160, inner: 135.4 },
  { nominal: 180, inner: 152.0 },
  { nominal: 200, inner: 169.0 },
  { nominal: 225, inner: 190.2 },
  { nominal: 250, inner: 211.0 },
  { nominal: 280, inner: 236.6 },
  { nominal: 315, inner: 266.2 },
  { nominal: 355, inner: 300.0 },
  { nominal: 400, inner: 338.0 },
  { nominal: 450, inner: 380.4 },
  { nominal: 500, inner: 422.6 },
  { nominal: 560, inner: 473.4 },
  { nominal: 630, inner: 532.6 },
];

export interface ConduitCable {
  kind: CableKind; // tipo de condutor/cabo
  section: number; // mm²
  count: number;   // nº de condutores dessa secção
}

export interface ConduitResult {
  cableArea: number;     // mm² (soma das áreas exteriores dos condutores)
  fillRatio: number;     // taxa de enchimento admissível usada
  requiredInner: number; // mm² de secção interior mínima do tubo
  conduitNominal: number | null; // diâmetro nominal recomendado (mm)
  conduitInner: number | null;   // diâmetro interior do tubo escolhido (mm)
  actualFill: number;    // % de enchimento real com o tubo escolhido
  totalConductors: number;
  errors: string[];
}

// Taxa de enchimento máxima admissível em função do nº de condutores
export function fillRatioFor(nConductors: number): number {
  if (nConductors <= 1) return 0.53;
  if (nConductors === 2) return 0.31;
  return 0.40; // 3 ou mais
}

export function computeConduit(cables: ConduitCable[]): ConduitResult {
  const errors: string[] = [];
  let totalConductors = 0;
  let cableArea = 0;
  for (const c of cables) {
    if (c.count <= 0) continue;
    const od = odFor(c.kind, c.section);
    if (!od) { errors.push(`${c.kind} ${c.section}mm² sem diâmetro tabelado.`); continue; }
    const area = Math.PI * (od / 2) ** 2;
    cableArea += area * c.count;
    totalConductors += c.count;
  }
  const fillRatio = fillRatioFor(totalConductors);
  const requiredInner = cableArea / fillRatio;

  let chosen: { nominal: number; inner: number } | null = null;
  for (const t of STD_CONDUITS) {
    const innerArea = Math.PI * (t.inner / 2) ** 2;
    if (innerArea >= requiredInner) { chosen = t; break; }
  }
  if (!chosen && totalConductors > 0) {
    errors.push("Nenhum tubo normalizado suficiente — divida por mais que um tubo.");
  }

  const actualFill = chosen
    ? (cableArea / (Math.PI * (chosen.inner / 2) ** 2)) * 100
    : 0;

  return {
    cableArea,
    fillRatio,
    requiredInner,
    conduitNominal: chosen?.nominal ?? null,
    conduitInner: chosen?.inner ?? null,
    actualFill,
    totalConductors,
    errors,
  };
}
