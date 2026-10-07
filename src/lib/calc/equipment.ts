// Equipamento do quadro: DST, bobina MX, inversor Rede/Gerador, UPS, barramentos e módulos de comando.
// Lógica pura (offline) — usada pela interface, unifilar e auditoria.
import type { Circuit, CalcResult } from "./engine";

type Row = { c: Circuit; r: CalcResult };

export type SpdType = "T1" | "T1+2" | "T2" | "T3";
export interface SPD { type: SpdType; poles: 2 | 4; iKA: number; backupA: number; }

export type MxTrigger = "EMERG" | "SADI" | "COZINHA" | "HVAC";
export const MX_TRIGGERS: Record<MxTrigger, string> = {
  EMERG: "Botão de paragem de emergência (corte geral de segurança)",
  SADI: "Interligação com SADI (incêndio)",
  COZINHA: "Cozinha industrial / hoteleira",
  HVAC: "Climatização e bombas (AVAC) de grande porte",
};

export interface ATS { mode: "Manual" | "Auto"; genKVA: number; phases?: 1 | 3; }
export interface UPS { kVA: number; autonomyMin: number; bypass: boolean; phases?: 1 | 3; pf?: number; }

export type BusKind = "Normal" | "Socorro" | "UPS" | "Pente";
export interface Bus { id: string; name: string; kind: BusKind; circuitIds: string[]; }

export type ControlKind =
  | "Telerruptor" | "Escada" | "Contactor" | "Crepuscular"
  | "Termostato" | "ContactorTermico" | "VSD" | "Pressostato" | "DDC";

export interface ControlModule {
  id: string; kind: ControlKind; label: string; circuitIds: string[];
  inputs: number; outputs: number; aux: number; // nº de entradas / saídas / contactos auxiliares
  coilV: 230 | 24;
}

export const CONTROL_INFO: Record<ControlKind, { name: string; prefix: string; group: "Comando" | "AVAC"; din: number; ins: number; outs: number; aux: number; hint: string }> = {
  Telerruptor: { name: "Telerruptor (relé de impulso)", prefix: "KT", group: "Comando", din: 1, ins: 1, outs: 1, aux: 0, hint: "Entradas = botões de pressão; saídas = contactos de potência" },
  Escada: { name: "Automático de escada (temporizador)", prefix: "KA", group: "Comando", din: 1, ins: 1, outs: 1, aux: 0, hint: "Entradas = botoneiras; ligação a 3 ou 4 fios" },
  Contactor: { name: "Contactor modular", prefix: "KM", group: "Comando", din: 2, ins: 1, outs: 2, aux: 1, hint: "Entrada = ordem A1/A2; saídas = polos de potência" },
  Crepuscular: { name: "Interruptor crepuscular", prefix: "KC", group: "Comando", din: 2, ins: 1, outs: 1, aux: 0, hint: "Entrada = sonda exterior; saída = canal para contactor" },
  Termostato: { name: "Comando termostático", prefix: "BT", group: "AVAC", din: 1, ins: 1, outs: 1, aux: 0, hint: "Entradas = sondas de temperatura; saídas = contactos" },
  ContactorTermico: { name: "Contactor + relé térmico", prefix: "KM", group: "AVAC", din: 3, ins: 1, outs: 3, aux: 2, hint: "Arranque direto; aux = 95-96 / 97-98 do relé térmico" },
  VSD: { name: "Variador de velocidade (VSD)", prefix: "U", group: "AVAC", din: 6, ins: 4, outs: 2, aux: 1, hint: "DI marcha/defeito, AI 0-10 V/4-20 mA; saídas relé" },
  Pressostato: { name: "Pressostato / fluxostato", prefix: "BP", group: "AVAC", din: 0, ins: 1, outs: 1, aux: 0, hint: "Segurança de pressão/caudal em série com o comando" },
  DDC: { name: "Controlador DDC / PLC / BMS", prefix: "A", group: "AVAC", din: 6, ins: 8, outs: 6, aux: 0, hint: "Entradas DI/AI e saídas DO/AO do autómato" },
};

export interface PanelEquip {
  spd?: SPD | null;
  lightningRod?: boolean;      // edifício com para-raios (SPDA)
  mxTriggers?: MxTrigger[];
  mxFitted?: boolean;
  ats?: ATS | null;
  ups?: UPS | null;
  buses?: Bus[];
  controls?: ControlModule[];
}

export function newControl(kind: ControlKind, existing: ControlModule[]): ControlModule {
  const i = CONTROL_INFO[kind];
  const n = existing.filter(c => CONTROL_INFO[c.kind].prefix === i.prefix).length + 1;
  return { id: crypto.randomUUID(), kind, label: `${i.prefix}${n}`, circuitIds: [], inputs: i.ins, outputs: i.outs, aux: i.aux, coilV: kind === "DDC" || kind === "VSD" ? 24 : 230 };
}

/** Lista de bornes normalizados de um módulo (para a régua X1). */
export function terminals(m: ControlModule): string[] {
  const t: string[] = [];
  const io = (p: string, n: number, f: (k: number) => string) => { for (let k = 1; k <= n; k++) t.push(`${p}${k}: ${f(k)}`); };
  switch (m.kind) {
    case "Telerruptor": case "Escada":
      t.push(`A1/A2: bobina ${m.coilV} V`); io("BP", m.inputs, k => `botão ${k}`); io("", m.outputs, k => `${2 * k - 1}-${2 * k} potência`); break;
    case "Contactor": case "ContactorTermico":
      t.push(`A1/A2: bobina ${m.coilV} V`); io("", m.outputs, k => `${2 * k - 1}-${2 * k} polo ${k}`);
      io("AUX", m.aux, k => (m.kind === "ContactorTermico" && k === 1 ? "95-96 NF térmico" : m.kind === "ContactorTermico" && k === 2 ? "97-98 NA alarme" : `${10 * k + 3}-${10 * k + 4} NA`)); break;
    case "Crepuscular": t.push("L/N: alimentação"); io("S", m.inputs, k => `sonda ${k}`); io("Q", m.outputs, k => `canal ${k} (NA)`); break;
    case "Termostato": t.push("L/N: alimentação"); io("T", m.inputs, k => `sonda ${k}`); io("C", m.outputs, k => `contacto ${k} C/NA/NF`); break;
    case "VSD": t.push("L1/L2/L3: entrada", "U/V/W: motor", "PE"); io("DI", m.inputs, k => k === 1 ? "marcha" : k === 2 ? "SADI / paragem" : `entrada ${k}`); io("RO", m.outputs, k => k === 1 ? "defeito" : `relé ${k}`); io("AI", m.aux, () => "referência 0-10 V / 4-20 mA"); break;
    case "Pressostato": io("P", m.inputs, k => `contacto ${k} (em série com o comando)`); io("AL", m.outputs, k => `alarme ${k}`); break;
    case "DDC": t.push("24V/0V: alimentação"); io("DI", m.inputs, k => `entrada ${k}`); io("DO", m.outputs, k => `saída ${k}`); io("AI", m.aux, k => `analógica ${k}`); break;
  }
  return t;
}

const KITCHEN = /cozinh|hotel|restaur|fritad|forno|fogão|fogao/i;
const HVAC = /chiller|avac|hvac|bomba|ventila|uta|vrv|caldeira|central t/i;

/** Indica se o interruptor geral necessita de bobina MX e porquê. */
export function mxReasons(rows: Row[], e: PanelEquip): string[] {
  const out: string[] = (e.mxTriggers ?? []).map(t => MX_TRIGGERS[t]);
  const kit = rows.filter(x => KITCHEN.test(x.c.name) || (x.c.type === "PlacaCozinha" && x.c.power >= 10000));
  if (kit.length && !e.mxTriggers?.includes("COZINHA")) out.push(`Cozinha detetada (${kit.map(x => x.c.name).slice(0, 3).join(", ")}) — botão de corte de emergência à saída`);
  const big = rows.filter(x => (HVAC.test(x.c.name) || x.c.type === "UAC") && x.c.power >= 15000);
  if (big.length && !e.mxTriggers?.includes("HVAC")) out.push(`AVAC/bombas ≥ 15 kW (${big.map(x => x.c.name).slice(0, 3).join(", ")}) — corte exterior de emergência`);
  if (e.ats && !e.mxTriggers?.includes("SADI")) out.push("Quadro com gerador — corte de segurança dos bombeiros recomendado");
  return out;
}

export function recommendSpd(e: PanelEquip, isQGE: boolean): SpdType {
  if (e.lightningRod) return "T1+2";
  return isQGE ? "T2" : "T2";
}

const BARS: Array<[string, number]> = [
  ["12×5", 160], ["15×5", 200], ["20×5", 290], ["25×5", 350], ["30×5", 400], ["40×5", 520], ["50×5", 630],
  ["40×10", 760], ["50×10", 920], ["60×10", 1060], ["80×10", 1380], ["100×10", 1700],
  ["2×80×10", 2300], ["2×100×10", 2900], ["3×100×10", 3800], ["4×100×10", 4800],
];
/** Barramento de cobre (IEC 61439, 35 °C, pintado) e pico de curto-circuito. */
export function sizeBusbar(ib: number, iccKA: number) {
  const pick = BARS.find(b => b[1] >= ib * 1.1) ?? BARS[BARS.length - 1];
  const n = iccKA <= 5 ? 1.5 : iccKA <= 10 ? 1.7 : iccKA <= 20 ? 2 : iccKA <= 50 ? 2.1 : 2.2;
  return { bar: pick[0], iz: pick[1], ipkKA: +(iccKA * n).toFixed(1), ok: pick[1] >= ib };
}

export function busIb(bus: Bus, rows: Row[]) {
  return rows.filter(x => bus.circuitIds.includes(x.c.id)).reduce((s, x) => s + x.r.ib, 0);
}

/** Corrente nominal por fase de uma fonte (A). Mono: S/U0; Tri: S/(√3·U). */
export function sourceIn(kVA: number, phases: 1 | 3 = 3, u0 = 230, u = 400) {
  return phases === 1 ? (kVA * 1000) / u0 : (kVA * 1000) / (Math.sqrt(3) * u);
}
/** Gerador: Icc mantida ≈ 3×In (alternador com excitação PMG/AREP; sem ela pode ser < 1×In). */
export function generatorIcc(kVA: number, phases: 1 | 3 = 3) { const In = sourceIn(kVA, phases); return { In, icc: 3 * In }; }
/** UPS (inversor em bateria): limitação electrónica ≈ 2×In durante ~100 ms (típico 1,5–3×). */
export function upsIcc(kVA: number, phases: 1 | 3 = 3) { const In = sourceIn(kVA, phases); return { In, icc: 2 * In }; }

/** Corrente da fase mais carregada (A): monofásicas somam na fase atribuída, trifásicas em todas. */
export function worstPhaseIb(list: Row[]) {
  const s = { L1: 0, L2: 0, L3: 0 };
  for (const { c, r } of list) {
    if (c.phase === "Tri") { s.L1 += r.ib; s.L2 += r.ib; s.L3 += r.ib; }
    else s[c.phaseAssign ?? "L1"] += r.ib;
  }
  return Math.max(s.L1, s.L2, s.L3);
}
/** Para fonte monofásica todas as cargas somam no mesmo condutor (tri = √3·Ib·400/230 ≈ 3·Ib por fase de 230 V). */
function sourceLoadA(list: Row[], phases: 1 | 3) {
  if (phases === 3) return worstPhaseIb(list);
  return list.reduce((s, { c, r }) => s + (c.phase === "Tri" ? r.ib * 3 : r.ib), 0);
}
/** Potência activa total (kW) das cargas. */
function loadKW(list: Row[]) { return list.reduce((s, { c }) => s + c.power, 0) / 1000; }

/** Corrente de defeito no fim do circuito alimentado por uma fonte limitada (A). */
function faultAtEnd(sourceIcc: number, c: Circuit, r: CalcResult, u0 = 230) {
  const zs = u0 / Math.max(1, sourceIcc);
  const rho = c.material === "Al" ? 0.036 : 0.0225;
  const zl = (2 * rho * c.length) / Math.max(1, r.section * r.parallel); // laço fase-neutro/PE
  return u0 / (zs + zl);
}

const MAG: Record<string, number> = { B: 5, C: 10, D: 20 };

export interface EquipIssue { level: "critical" | "warn" | "info"; msg: string; circuitId?: string; }
export function checkEquipment(rows: Row[], e: PanelEquip, isQGE: boolean, panelIb: number, iccKA: number): EquipIssue[] {
  const out: EquipIssue[] = [];
  const reasons = mxReasons(rows, e);
  if (reasons.length && !e.mxFitted) out.push({ level: "critical", msg: `Bobina MX necessária no corte geral: ${reasons[0]}` });
  if (e.lightningRod && (!e.spd || (e.spd.type !== "T1" && e.spd.type !== "T1+2"))) out.push({ level: "critical", msg: "Edifício com para-raios: obrigatório DST Tipo 1 ou 1+2 no quadro de entrada" });
  else if (isQGE && !e.spd) out.push({ level: "warn", msg: "Quadro geral sem DST — recomendado Tipo 2 (IEC 60364-4-44)" });
  if (e.spd && e.spd.backupA > 63) out.push({ level: "warn", msg: `Proteção do DST de ${e.spd.backupA} A — confirmar máximo do fabricante (típico ≤ 50-63 A)` });

  const buses = e.buses ?? [];
  const busOf = (id: string) => buses.find(b => b.circuitIds.includes(id));
  if (e.ats) {
    const ph = e.ats.phases ?? 3;
    const g = generatorIcc(e.ats.genKVA, ph);
    const em = buses.filter(b => b.kind === "Socorro" || b.kind === "UPS");
    const fed = em.length ? rows.filter(x => em.some(b => b.circuitIds.includes(x.c.id))) : rows;
    const load = em.length ? sourceLoadA(fed, ph) : (ph === 3 ? Math.max(worstPhaseIb(rows), panelIb > 0 ? 0 : 0) : sourceLoadA(rows, ph));
    const pct = g.In > 0 ? (load / g.In) * 100 : 999;
    if (pct > 100) out.push({ level: "critical", msg: `Gerador ${e.ats.genKVA} kVA (In ${g.In.toFixed(0)} A/fase) insuficiente: fase mais carregada ${load.toFixed(0)} A (${pct.toFixed(0)} %)` });
    else if (pct > 80) out.push({ level: "warn", msg: `Gerador a ${pct.toFixed(0)} % da potência (${load.toFixed(0)} / ${g.In.toFixed(0)} A) — recomendado ≤ 80 % para arranques e reserva` });
    else out.push({ level: "info", msg: `Gerador ${e.ats.genKVA} kVA: In ${g.In.toFixed(0)} A/fase, carga ${load.toFixed(0)} A (${pct.toFixed(0)} %), Icc ≈ ${g.icc.toFixed(0)} A` });
    const motor = fed.filter(x => x.c.type === "AC" || x.c.type === "UAC").reduce((m, x) => Math.max(m, x.r.ib), 0);
    if (motor > 0 && motor * 6 > g.icc) out.push({ level: "warn", msg: `Maior motor (${motor.toFixed(0)} A, arranque ≈ ${(motor * 6).toFixed(0)} A) excede a capacidade do gerador — usar arrancador suave/VSD ou gerador maior` });
    for (const { c, r } of fed) {
      const ia = r.in * (MAG[r.curve] ?? 10);
      const ik = faultAtEnd(g.icc, c, r);
      if (ia > ik) out.push({ level: "warn", circuitId: c.id, msg: `${c.name}: em gerador o defeito no fim do cabo ≈ ${ik.toFixed(0)} A < disparo magnético ${ia.toFixed(0)} A (${r.in}A ${r.curve}) — usar curva B, calibre menor ou maior secção` });
    }
  }
  if (e.ups) {
    const ph = e.ups.phases ?? 3;
    const pf = e.ups.pf ?? 0.9;
    const u = upsIcc(e.ups.kVA, ph);
    const ub = buses.filter(b => b.kind === "UPS");
    const fed = rows.filter(x => ub.some(b => b.circuitIds.includes(x.c.id)));
    const load = sourceLoadA(fed, ph);
    const kw = loadKW(fed);
    const kwMax = e.ups.kVA * pf;
    if (!ub.length) out.push({ level: "warn", msg: "UPS definida mas sem barramento UPS — crie um e atribua as cargas críticas" });
    if (load > u.In) out.push({ level: "critical", msg: `UPS ${e.ups.kVA} kVA (In ${u.In.toFixed(0)} A/fase) insuficiente: ${load.toFixed(0)} A na fase mais carregada` });
    if (kw > kwMax) out.push({ level: "critical", msg: `UPS ${e.ups.kVA} kVA × FP ${pf} = ${kwMax.toFixed(1)} kW < ${kw.toFixed(1)} kW de carga` });
    else if (fed.length && kw > kwMax * 0.8) out.push({ level: "warn", msg: `UPS a ${((kw / kwMax) * 100).toFixed(0)} % da potência activa — recomendado ≤ 80 %` });
    if (fed.length) {
      const wh = (kw * 1000 * e.ups.autonomyMin / 60) / 0.9; // rendimento do inversor ≈ 90 %
      out.push({ level: "info", msg: `Baterias UPS: ${kw.toFixed(1)} kW × ${e.ups.autonomyMin} min ⇒ ≈ ${(wh / 1000).toFixed(1)} kWh úteis (≈ ${Math.ceil(wh / 0.8 / 12 / 0.8)} Ah a 12 V eq., DoD 80 %) — confirmar com fabricante` });
    }
    for (const { c, r } of fed) {
      const ia = r.in * (MAG[r.curve] ?? 10);
      const ik = faultAtEnd(u.icc, c, r);
      if (ia > ik) out.push({ level: "warn", circuitId: c.id, msg: `${c.name}: em bateria a UPS dá ≈ ${ik.toFixed(0)} A no fim do cabo < disparo magnético ${ia.toFixed(0)} A (${r.in}A ${r.curve}) — usar curva B ou calibre menor` });
    }
    if (!e.ups.bypass) out.push({ level: "info", msg: "UPS sem bypass de manutenção" });
  }
  const bb = sizeBusbar(panelIb, iccKA);
  if (bb.ipkKA > 60) out.push({ level: "info", msg: `Pico de curto-circuito ${bb.ipkKA} kA — verificar suportes do barramento` });
  for (const m of e.controls ?? []) {
    if (!m.circuitIds.length) out.push({ level: "info", msg: `${m.label} (${CONTROL_INFO[m.kind].name}) sem circuitos associados` });
    if ((m.kind === "Contactor" || m.kind === "ContactorTermico" || m.kind === "Telerruptor") ) {
      const ib = rows.filter(x => m.circuitIds.includes(x.c.id)).reduce((s, x) => Math.max(s, x.r.in), 0);
      if (ib > 63 && m.kind !== "ContactorTermico") out.push({ level: "warn", msg: `${m.label}: circuito de ${ib} A excede contactor modular (≤ 63 A)` });
    }
    if ((m.kind === "VSD") && rows.some(x => m.circuitIds.includes(x.c.id) && x.c.phase !== "Tri")) out.push({ level: "info", msg: `${m.label}: VSD num circuito monofásico — confirmar modelo 230 V` });
  }
  return out;
}

/** Etiquetas por circuito para o unifilar: módulos de comando e barramento. */
export function circuitTags(e: PanelEquip): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (id: string, s: string) => m.set(id, [...(m.get(id) ?? []), s]);
  for (const c of e.controls ?? []) for (const id of c.circuitIds) add(id, `${c.label} ${CONTROL_INFO[c.kind].name.split(" ")[0]}`);
  return m;
}

export function dinModules(e: PanelEquip): number {
  return (e.spd ? e.spd.poles : 0) + (e.mxFitted ? 1 : 0) + (e.controls ?? []).reduce((s, c) => s + CONTROL_INFO[c.kind].din, 0);
}
