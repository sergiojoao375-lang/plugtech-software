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

export interface ATS { mode: "Manual" | "Auto"; genKVA: number; }
export interface UPS { kVA: number; autonomyMin: number; bypass: boolean; }

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

/** Icc em regime de gerador (≈ 3×In) e de UPS (≈ 2×In), em A. */
export function generatorIcc(kVA: number, v = 400) { const In = (kVA * 1000) / (Math.sqrt(3) * v); return { In, icc: 3 * In }; }
export function upsIcc(kVA: number, v = 400) { const In = (kVA * 1000) / (Math.sqrt(3) * v); return { In, icc: 2 * In }; }

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
    const g = generatorIcc(e.ats.genKVA);
    const em = buses.filter(b => b.kind === "Socorro" || b.kind === "UPS");
    const load = em.length ? em.reduce((s, b) => s + busIb(b, rows), 0) : panelIb;
    if (load > g.In) out.push({ level: "critical", msg: `Gerador ${e.ats.genKVA} kVA (In ${g.In.toFixed(0)} A) insuficiente para ${load.toFixed(0)} A em socorro` });
    for (const { c, r } of rows) {
      const b = busOf(c.id);
      if (em.length && !(b && (b.kind === "Socorro" || b.kind === "UPS"))) continue;
      if (r.in * (MAG[r.curve] ?? 10) > g.icc) out.push({ level: "warn", circuitId: c.id, msg: `${c.name}: em gerador (Icc ≈ ${g.icc.toFixed(0)} A) o disparo magnético ${r.in}A ${r.curve} não é garantido — usar curva B ou calibre menor` });
    }
  }
  if (e.ups) {
    const u = upsIcc(e.ups.kVA);
    const ub = buses.filter(b => b.kind === "UPS");
    const load = ub.reduce((s, b) => s + busIb(b, rows), 0);
    if (!ub.length) out.push({ level: "warn", msg: "UPS definida mas sem barramento UPS — crie um e atribua as cargas críticas" });
    if (load > u.In) out.push({ level: "critical", msg: `UPS ${e.ups.kVA} kVA (In ${u.In.toFixed(0)} A) insuficiente para ${load.toFixed(0)} A` });
    for (const b of ub) for (const { c, r } of rows.filter(x => b.circuitIds.includes(x.c.id))) {
      if (r.in * (MAG[r.curve] ?? 10) > u.icc) out.push({ level: "warn", circuitId: c.id, msg: `${c.name}: em bateria a UPS limita a ≈ ${u.icc.toFixed(0)} A — usar curva B` });
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
