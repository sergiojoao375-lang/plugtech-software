// PLUGTECH CalcStudio Pro - Motor de Cálculo (RTIEBT simplificado)
// Resistividades (Ω·mm²/m) — método simplificado para ΔU e Icc
export const RHO = { Cu: 0.0225, Al: 0.036 } as const;
export type Material = "Cu" | "Al";

export type CircuitType =
  | "Iluminacao"
  | "Tomadas"
  | "AC"
  | "Termoacumulador"
  | "PlacaCozinha"
  | "UAC"
  | "QuadroParcial";

export type InstallScenario =
  | "Enterrado"      // método D
  | "Embutido"       // método A
  | "Calha"          // método E
  | "ArLivre";       // método E/F

export type Phase = "Mono" | "Tri";

export interface Circuit {
  id: string;
  name: string;
  power: number;        // W
  length: number;       // m
  cosphi: number;
  type: CircuitType;
  cable: string;        // ex: "H07V-K" — informativo
  material?: Material;  // material do condutor (Cu por defeito; Al em alimentações QGE)
  scenario: InstallScenario;
  phase: Phase;
  phaseAssign?: "L1" | "L2" | "L3"; // apenas mono
  inBreaker?: number;   // calibre escolhido
  curve?: "B" | "C" | "D";
}

export const STD_BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400, 630, 800, 1000, 1250, 1800];
// Calibres alargados para Quadro Geral (QGE) — até 1600 A
export const STD_BREAKERS_QGE = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400, 630, 800, 1000, 1250, 1800];

// Tabela simplificada Iz (A) por secção (mm²) Cu — valores conservadores médios
const IZ_CU: Record<number, Partial<Record<InstallScenario, number>>> = {
  1.5:  { Embutido: 14.5, Enterrado: 22, Calha: 17.5, ArLivre: 19 },
  2.5:  { Embutido: 20,   Enterrado: 29, Calha: 24,   ArLivre: 26 },
  4:    { Embutido: 27,   Enterrado: 37, Calha: 32,   ArLivre: 35 },
  6:    { Embutido: 34,   Enterrado: 46, Calha: 41,   ArLivre: 46 },
  10:   { Embutido: 46,   Enterrado: 61, Calha: 57,   ArLivre: 63 },
  16:   { Embutido: 62,   Enterrado: 79, Calha: 76,   ArLivre: 85 },
  25:   { Embutido: 80,   Enterrado: 101, Calha: 101, ArLivre: 112 },
  35:   { Embutido: 99,   Enterrado: 122, Calha: 125, ArLivre: 138 },
  50:   { Embutido: 118,  Enterrado: 144, Calha: 151, ArLivre: 168 },
  70:   { Embutido: 149,  Enterrado: 178, Calha: 192, ArLivre: 213 },
  95:   { Embutido: 179,  Enterrado: 211, Calha: 232, ArLivre: 258 },
  120:  { Embutido: 234,  Enterrado: 261, Calha: 298, ArLivre: 327 },
  150:  { Embutido: 269,  Enterrado: 298, Calha: 344, ArLivre: 376 },
  185:  { Embutido: 306,  Enterrado: 339, Calha: 392, ArLivre: 428 },
  240:  { Embutido: 360,  Enterrado: 400, Calha: 461, ArLivre: 504 },
  300:  { Embutido: 415,  Enterrado: 458, Calha: 530, ArLivre: 578 },
  400:  { Embutido: 473,  Enterrado: 519, Calha: 624, ArLivre: 681 },
};
const IZ_AL_FACTOR = 0.78;

// Secções para circuitos terminais
export const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];
// Secções para a linha de interligação (feeder) — vai bem além de 95mm²
export const FEEDER_SECTIONS = [10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];

export function izFor(section: number, scenario: InstallScenario, mat: Material = "Cu"): number {
  const v = IZ_CU[section]?.[scenario] ?? 0;
  return mat === "Al" ? Math.round(v * IZ_AL_FACTOR) : v;
}

// Calibres normalizados de aparelho de corte geral (disjuntor/interruptor) em A
export const MAIN_DEVICE_RATINGS = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400, 630, 800, 1000, 1250, 1600, 1800, 2000, 2500, 3200, 3600, 4000, 5000, 6300];

// Poderes de corte normalizados (Icu/Icn) em kA — IEC 60898-1 / IEC 60947-2
export const BREAKING_CAPACITIES = [4.5, 6, 10, 15, 25, 36, 50, 70, 100];

/** Escolhe o poder de corte normalizado imediatamente acima do Icc presumido no ponto. */
export function pickBreakingCapacity(iccKA: number): number {
  const need = Math.max(0, iccKA);
  for (const k of BREAKING_CAPACITIES) if (k >= need) return k;
  return BREAKING_CAPACITIES[BREAKING_CAPACITIES.length - 1];
}

//export function pickMainDevice(currentA: number): number {
//  for (const r of MAIN_DEVICE_RATINGS) {
//    if (r >= currentA) return r;
//  }
//  return MAIN_DEVICE_RATINGS[MAIN_DEVICE_RATINGS.length - 1];
//}
// --minha--DEPOIS (CORRIGIDO COM MARGEM DE SEGURANÇA):
export function pickMainDevice(currentA: number): number {
  // Adiciona uma margem extra de 10% de folga para evitar disjuntores gerais no limite térmico
  const safeCurrent = currentA * 1.1; 
  
  for (const r of MAIN_DEVICE_RATINGS) {
    if (r >= safeCurrent) return r;
  }
  return MAIN_DEVICE_RATINGS[MAIN_DEVICE_RATINGS.length - 1];
}

export const POWER_FACTOR_LOAD: Record<CircuitType, number> = {
  Iluminacao: 1.0, Tomadas: 1.0, AC: 1.25, Termoacumulador: 1.0, PlacaCozinha: 1.0, UAC: 1.25,
  QuadroParcial: 1.0,
};

export interface CalcResult {
  s: number;       // VA
  ib: number;      // A
  in: number;      // A (calibre)
  curve: "B" | "C" | "D";
  section: number; // mm² (por condutor)
  parallel: number; // nº de condutores em paralelo por fase
  iz: number;      // A (Iz total = Iz_secção × paralelos)
  deltaU: number;  // %
  iccTerm: number; // kA
  icuKA: number;   // poder de corte normalizado exigido (kA)
  modules: number; // módulos DIN
  errors: string[];
  warnings: string[];
}

export function pickBreaker(ib: number, maxIz: number, breakers: number[] = STD_BREAKERS): number {
  for (const b of breakers) {
    if (b >= ib && b <= maxIz) return b;
  }
  return breakers[breakers.length - 1];
}

export function suggestCurve(type: CircuitType): "B" | "C" | "D" {
  if (type === "AC" || type === "UAC") return "D";
  return "C";
}

export interface FeederContext {
  iccOriginKA: number;     // Icc da origem (montante)
  feederMaterial: Material;
  feederSection: number;   // mm²
  feederLength: number;    // m
  feederDeltaU: number;    // % já calculado para o quadro
  voltageMono: number;     // 230
  voltageTri: number;      // 400
  isQGE?: boolean;         // quadro geral: calibres e secções alargados
  supplyType?: "PT" | "Rede"; // origem da alimentação (limites de ΔU)
}

export function computeCircuit(c: Circuit, ctx: FeederContext): CalcResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cos = Math.max(0.1, Math.min(1, c.cosphi || 1));
  const s = c.power / cos;
  const ib = c.phase === "Tri" ? s / (Math.sqrt(3) * ctx.voltageTri) : s / ctx.voltageMono;
  
  const mat: Material = c.material ?? "Cu";
  
  // CORREÇÃO DE OURO: Ignora o travamento visual de 10mm² e define o mínimo regulamentar
  const minSec = c.type === "Iluminacao" ? 1.5 : 2.5;
  const sectionList = SECTIONS;
  //--minha--const breakerList = ctx.isQGE ? STD_BREAKERS_QGE : STD_BREAKERS;
  const breakerList = STD_BREAKERS;
  const maxParallel = ctx.isQGE ? 4 : 1;

  const targetBreaker = c.inBreaker ?? (breakerList.find(b => b >= ib) || 16);

  //--minha--const targetBreaker = c.inBreaker ?? (breakerList.find(b => b >= ib) || breakerList[breakerList.length - 1]);

  let chosen = minSec;
  let parallel = 1;
  let iz = izFor(minSec, c.scenario, mat);
  let deltaU = deltaUPercent(c, minSec, mat, ctx);
  let coordinated = false;

  // Força o ciclo a encontrar a menor secção segura de acordo com a RTIEBT
    // Força o ciclo a encontrar a menor secção segura de acordo com a RTIEBT / Norma Europeia
  for (let p = 1; p <= maxParallel; p++) {
    for (const sec of sectionList) {
      if (sec < minSec) continue;
      const izTry = izFor(sec, c.scenario, mat) * p;
      const dU = deltaUPercent(c, sec * p, mat, ctx);
      
      // CORREÇÃO: Define o limite dinâmico cruzando o Tipo de Circuito com a Origem da Alimentação
            // Linhas 171 e 172 atualizadas:
      const isLight = c.type === "Iluminacao";
      const isPT = (ctx as any).supplyType === "PT";
      const limitCritical = isLight ? (isPT ? 6.0 : 3.0) : (isPT ? 8.0 : 5.0);

      
      if (izTry >= targetBreaker && (ctx.feederDeltaU + dU) <= limitCritical) {
        chosen = sec; 
        parallel = p; 
        iz = izTry; 
        deltaU = dU;
        coordinated = true;
        break;
      }
    }
    if (coordinated) break;
  }


  const inBreaker = targetBreaker;
  const curve = c.curve ?? suggestCurve(c.type);

  if (inBreaker < ib) errors.push(`Disjuntor Subdimensionado: In (${inBreaker}A) < Ib (${ib.toFixed(1)}A).`);
  if (inBreaker > iz) errors.push(`Coordenação RTIEBT 433: In (${inBreaker}A) > Iz (${iz}A).`);
  if (ib > iz) errors.push(`Cabo em Sobrecarga: Ib (${ib.toFixed(1)}A) > Iz (${iz}A).`);
  if (parallel > 1) warnings.push(`Necessários ${parallel} condutores em paralelo.`);

  const totalDU = ctx.feederDeltaU + deltaU;
  const isLight = c.type === "Iluminacao";
  const limitCritical = isLight ? 3.0 : 5.0;
  if (totalDU > limitCritical) {
    warnings.push(`Queda de tensão total ${totalDU.toFixed(2)}% excede o limite de ${limitCritical}%.`);
  }


  // CÁLCULO DO ICC TERMINAL CORRIGIDO (MÉTODO DAS IMPEDÂNCIAS IEC 60909)
  const Zup = ctx.iccOriginKA > 0 ? (ctx.voltageTri / (Math.sqrt(3) * ctx.iccOriginKA * 1000)) : 0.001;
  const Zfeeder = (RHO[ctx.feederMaterial] * ctx.feederLength) / Math.max(1, ctx.feederSection);
  
  // Multiplica por 2 a impedância se o circuito for monofásico (Laço Fase-Neutro)
  const loopFactor = c.phase === "Mono" ? 2 : 1;
  const Zline = ((RHO[mat] * c.length) / Math.max(1, chosen * parallel)) * loopFactor;
  
  const Ztot = Zup + Zfeeder + Zline;
  const Ucalc = c.phase === "Tri" ? ctx.voltageTri / Math.sqrt(3) : ctx.voltageMono;
  const iccTerm = Ztot > 0 ? (Ucalc / Ztot) / 1000 : 0;

  const modules = c.phase === "Tri" ? 3 : (c.type === "AC" || c.type === "UAC" ? 2 : 1);

    //--minha-- Validação normativa europeia de 6 kA (Inserido na linha 205)
  const breakerBreakingCapacityKA = 6.0; 
  if (ctx.iccOriginKA > breakerBreakingCapacityKA) {
    errors.push(
      `Poder de corte insuficiente: O Icc na origem (${ctx.iccOriginKA.toFixed(1)} kA) excede a capacidade padrão do disjuntor (${breakerBreakingCapacityKA} kA). Utilize aparelhagem de 10 kA ou superior.`
    );
  }

    // Força circuitos de Placa de Cozinha a usarem no mínimo 4 mm² por razões normativas e térmicas
    // Força circuitos de Placa de Cozinha / Cargas pesadas a começarem com no mínimo 4 mm²
  let finalSection = chosen;
  if ((c.type === "PlacaCozinha" || c.power > 5000) && finalSection < 4.0) {
    finalSection = 4.0;
    iz = 27; 
  }

  // REGRA DE SELETIVIDADE: Trava o Q.Parcial (Q.E.) até 40A e deixa o QGE livre
  if (!ctx.isQGE && inBreaker > 40) {
    errors.push(
      `Calibre incompatível: O disjuntor calculado (${inBreaker}A) excede o limite regulamentar para Quadro Parcial/Distribuição (Máx. 40A). Para potências superiores, dimensione este circuito a partir do Quadro Geral (QGE).`
    );
  }

  return { s, ib, in: inBreaker, curve, section: finalSection, parallel, iz, deltaU, iccTerm, modules, errors, warnings };
}


export function deltaUPercent(c: Circuit, section: number, mat: Material, ctx: FeederContext): number {
  const cos = Math.max(0.1, c.cosphi || 1);
  const loadFactor = POWER_FACTOR_LOAD[c.type] ?? 1;
  const s = (c.power * loadFactor) / cos;
  if (c.phase === "Tri") {
    const ib = s / (Math.sqrt(3) * ctx.voltageTri);
    const dU = (Math.sqrt(3) * RHO[mat] * c.length * ib * cos) / section;
    return (dU / ctx.voltageTri) * 100;
  } else {
    const ib = s / ctx.voltageMono;
    const dU = (2 * RHO[mat] * c.length * ib * cos) / section;
    return (dU / ctx.voltageMono) * 100;
  }
}

// Cálculo da queda de tensão do feeder (linha de interligação)
export function feederDeltaU(params: {
  totalCurrentA: number; cosphi: number; length: number; section: number;
  material: Material; phase: Phase; voltageMono: number; voltageTri: number;
}): number {
  const { totalCurrentA, cosphi, length, section, material, phase, voltageMono, voltageTri } = params;
  if (phase === "Tri") {
    const dU = (Math.sqrt(3) * RHO[material] * length * totalCurrentA * cosphi) / Math.max(1, section);
    return (dU / voltageTri) * 100;
  } else {
    const dU = (2 * RHO[material] * length * totalCurrentA * cosphi) / Math.max(1, section);
    return (dU / voltageMono) * 100;
  }
}

// --minha--Equilíbrio de fases automático (greedy: maior carga -> fase com menor soma)
// --minha--As cargas trifásicas dividem-se igualmente pelas 3 fases (P/3 em cada).
//--minha--export function balancePhases(circuits: Circuit[]): Circuit[] {
//--minha--  const monos = circuits.filter(c => c.phase === "Mono").sort((a, b) => b.power - a.power);
// --minha-- const triPerPhase = circuits
// --minha--   .filter(c => c.phase === "Tri")
//--minha--    .reduce((a, c) => a + c.power / 3, 0);
//--minha-- const sums = { L1: triPerPhase, L2: triPerPhase, L3: triPerPhase } as Record<"L1"|"L2"|"L3", number>;
// --minha-- const updated = [...circuits];
//--minha--  for (const c of monos) {
// --minha--   const phase = (Object.keys(sums) as Array<"L1"|"L2"|"L3">).reduce((a, b) => sums[a] <= sums[b] ? a : b);
//--minha--   sums[phase] += c.power;
// --minha--   const i = updated.findIndex(x => x.id === c.id);
// --minha--   updated[i] = { ...updated[i], phaseAssign: phase };
//--minha--  }
//--minha--  return updated;

// Equilíbrio de fases — heurística LPT (Longest Processing Time) + refinamento local.
// Complexidade ~O(n log n), suporta centenas de circuitos sem travar o software.
export function balancePhases(circuits: Circuit[]): Circuit[] {
  const phases: Array<"L1" | "L2" | "L3"> = ["L1", "L2", "L3"];
  const monos = circuits.filter(c => c.phase === "Mono");
  const tris = circuits.filter(c => c.phase === "Tri");
  if (monos.length === 0) return circuits;

  // Parcela fixa que os circuitos trifásicos aplicam em cada fase (P / 3)
  const triPerPhase = tris.reduce((a, c) => a + (c.power / 3), 0);
  const sums: Record<"L1" | "L2" | "L3", number> = {
    L1: triPerPhase, L2: triPerPhase, L3: triPerPhase,
  };

  // 1) Ordena por potência decrescente e coloca cada carga na fase menos carregada
  const order = monos
    .map((c, i) => ({ i, power: c.power }))
    .sort((a, b) => b.power - a.power);
  const assign: Array<"L1" | "L2" | "L3"> = new Array(monos.length).fill("L1");

  for (const { i, power } of order) {
    const p = phases.reduce((a, b) => (sums[a] <= sums[b] ? a : b));
    assign[i] = p;
    sums[p] += power;
  }

  // 2) Refinamento local: tenta mover cargas da fase mais carregada para a menos carregada
  for (let iter = 0; iter < 200; iter++) {
    const maxP = phases.reduce((a, b) => (sums[a] >= sums[b] ? a : b));
    const minP = phases.reduce((a, b) => (sums[a] <= sums[b] ? a : b));
    const gap = sums[maxP] - sums[minP];
    if (gap <= 0.0001) break;

    let bestIdx = -1;
    let bestGap = gap;
    for (let i = 0; i < monos.length; i++) {
      if (assign[i] !== maxP) continue;
      const w = monos[i].power;
      const newGap = Math.abs((sums[maxP] - w) - (sums[minP] + w));
      if (newGap < bestGap) { bestGap = newGap; bestIdx = i; }
    }
    if (bestIdx < 0) break;
    const w = monos[bestIdx].power;
    sums[maxP] -= w; sums[minP] += w;
    assign[bestIdx] = minP;
  }

  const byId = new Map<string, "L1" | "L2" | "L3">();
  monos.forEach((c, i) => byId.set(c.id, assign[i]));

  return circuits.map(c => {
    if (c.phase === "Tri") return c;
    return { ...c, phaseAssign: byId.get(c.id) ?? "L1" };
  });
}

// Dimensionamento automático da linha de interligação (feeder), com paralelos
export function sizeFeeder(params: {
  totalCurrentA: number;
  cosphi: number;
  length: number;
  material: Material;
  phase: Phase;
  scenario?: InstallScenario;
  voltageMono: number;
  voltageTri: number;
  maxDeltaU?: number;   // % admissível na linha de interligação
  maxParallel?: number;
  minSection?: number;  // secção mínima (ex.: maior secção dos circuitos a jusante)
}): { section: number; parallel: number; iz: number; deltaU: number } {
  const scenario = params.scenario ?? "Calha";
  const maxDU = params.maxDeltaU ?? 1.5;
  const maxPar = Math.max(1, params.maxParallel ?? 4);
  const minSec = params.minSection ?? 0;
  const need = params.totalCurrentA * 1.25; // margem de coordenação com o aparelho geral

  let fallback = { section: FEEDER_SECTIONS[FEEDER_SECTIONS.length - 1], parallel: maxPar, iz: 0, deltaU: 0 };

  for (let p = 1; p <= maxPar; p++) {
    for (const sec of FEEDER_SECTIONS) {
      if (sec < minSec) continue;
      const iz = izFor(sec, scenario, params.material) * p;
      const dU = feederDeltaU({
        totalCurrentA: params.totalCurrentA, cosphi: params.cosphi, length: params.length,
        section: sec * p, material: params.material, phase: params.phase,
        voltageMono: params.voltageMono, voltageTri: params.voltageTri,
      });
      if (p === maxPar && sec === FEEDER_SECTIONS[FEEDER_SECTIONS.length - 1]) {
        fallback = { section: sec, parallel: p, iz, deltaU: dU };
      }
      if (iz >= need && dU <= maxDU) {
        return { section: sec, parallel: p, iz, deltaU: dU };
      }
    }
  }
  return fallback;
}

//}

// Icc presumido no barramento do quadro atual (a jusante da linha de interligação)
export function panelIccKA(panel: {
  iccOriginKA: number; feederMaterial: Material; feederSection: number; feederLength: number;
  voltageMono: number; voltageTri: number; phase: Phase;
}): number {
  const isTri = panel.phase === "Tri";
  // Tensão de fase (V) para o cálculo da impedância de defeito
  const Uphase = isTri ? panel.voltageTri / Math.sqrt(3) : panel.voltageMono;
  // Impedância a montante a partir do Icc de origem
  const Zup = panel.iccOriginKA > 0
    ? Uphase / (panel.iccOriginKA * 1000)
    : 0.001;
  // Impedância do cabo de interligação (ida+volta simplificada via ρ)
  const Zfeeder = (RHO[panel.feederMaterial] * panel.feederLength) / Math.max(1, panel.feederSection);
  const Ztot = Zup + Zfeeder;
  const icc = Ztot > 0 ? (Uphase / Ztot) / 1000 : 0;
  return Math.round(icc * 10) / 10;
}

export function phaseImbalance(circuits: Circuit[]): { L1: number; L2: number; L3: number; pct: number } {
  const s = { L1: 0, L2: 0, L3: 0 };
  // Cargas trifásicas distribuídas igualmente pelas 3 fases
  circuits.filter(c => c.phase === "Tri").forEach(c => {
    const per = c.power / 3;
    s.L1 += per; s.L2 += per; s.L3 += per;
  });
  // Cargas monofásicas na fase atribuída
  circuits.filter(c => c.phase === "Mono").forEach(c => {
    if (c.phaseAssign) s[c.phaseAssign] += c.power;
  });
  const avg = (s.L1 + s.L2 + s.L3) / 3 || 1;
  const max = Math.max(s.L1, s.L2, s.L3);
  const min = Math.min(s.L1, s.L2, s.L3);
  const pct = ((max - min) / avg) * 100;
  return { ...s, pct };
}
