// Módulos profissionais: edição inline, ações em massa, modelos, auditoria, inspetor,
// condensadores, unifilar, frontal DIN e curvas de seletividade.
import { useState } from "react";
import type { Circuit, CalcResult, FeederContext, CircuitType, InstallScenario, Phase, Material } from "@/lib/calc/engine";
import { izFor } from "@/lib/calc/engine";
import type { AuditIssue } from "@/lib/calc/audit";
import { capacitorBank } from "@/lib/calc/capacitor";
import { curvePoints, selectivityLimit, type CurveKind } from "@/lib/calc/curves";
import type { RCD } from "@/lib/calc/rcd";
import type { PanelEquip } from "@/lib/calc/equipment";
import { generatorIcc } from "@/lib/calc/equipment";
import { ElectricalSymbol, CONTROL_SYMBOL, SYMBOL_LEGEND } from "./ElectricalSymbol";

type Row = { c: Circuit; r: CalcResult };
const inputCls = "w-full rounded border border-border bg-[color:var(--surface-2)] px-1 py-0.5 text-xs";
const btn = "rounded-md border border-border px-2 py-1 text-xs hover:bg-[color:var(--surface-2)]";

/* ---------------- Edição direta ---------------- */
export function InlineCell({ value, onSave, numeric, className }: {
  value: string | number; onSave: (v: string) => void; numeric?: boolean; className?: string;
}) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(String(value));
  if (!edit) return (
    <span className={`block cursor-text rounded px-1 hover:outline hover:outline-1 hover:outline-[color:var(--brand-green)]/50 ${className ?? ""}`}
      title="Duplo clique para editar"
      onDoubleClick={e => { e.stopPropagation(); setV(String(value)); setEdit(true); }}>{value}</span>
  );
  const commit = () => { setEdit(false); if (v !== String(value) && (!numeric || !isNaN(parseFloat(v.replace(",", "."))))) onSave(v); };
  return (
    <input autoFocus value={v} className={inputCls}
      onClick={e => e.stopPropagation()}
      onChange={e => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEdit(false); }} />
  );
}

/* ---------------- Ações em massa ---------------- */
export function BatchBar({ count, onPatch, onDuplicate, onDelete, onClear, cableOptions, scenarios, types, labelType }: {
  count: number; onPatch: (p: Partial<Circuit>) => void; onDuplicate: () => void; onDelete: () => void; onClear: () => void;
  cableOptions: string[]; scenarios: { v: InstallScenario; label: string }[]; types: CircuitType[]; labelType: (t: CircuitType) => string;
}) {
  if (count === 0) return null;
  const sel = "rounded border border-border bg-[color:var(--surface-2)] px-1 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--brand-blue)]/40 bg-[color:var(--brand-blue)]/10 px-3 py-2 text-xs">
      <b>{count} selecionado(s)</b>
      <select className={sel} value="" onChange={e => e.target.value && onPatch({ cable: e.target.value })}>
        <option value="">Cabo…</option>{cableOptions.map(c => <option key={c}>{c}</option>)}
      </select>
      <select className={sel} value="" onChange={e => e.target.value && onPatch({ material: e.target.value as Material })}>
        <option value="">Material…</option><option value="Cu">Cobre</option><option value="Al">Alumínio</option>
      </select>
      <select className={sel} value="" onChange={e => e.target.value && onPatch({ scenario: e.target.value as InstallScenario })}>
        <option value="">Instalação…</option>{scenarios.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
      </select>
      <select className={sel} value="" onChange={e => e.target.value && onPatch({ type: e.target.value as CircuitType })}>
        <option value="">Tipo…</option>{types.map(t => <option key={t} value={t}>{labelType(t)}</option>)}
      </select>
      <select className={sel} value="" onChange={e => e.target.value && onPatch({ phase: e.target.value as Phase })}>
        <option value="">Fase…</option><option value="Mono">Mono</option><option value="Tri">Trifásico</option>
      </select>
      <select className={sel} value="" onChange={e => e.target.value && onPatch({ rcd30: e.target.value === "sim" })}>
        <option value="">DR 30 mA…</option><option value="sim">Com DR 30 mA</option><option value="nao">Sem DR 30 mA</option>
      </select>
      <button className={btn} onClick={onDuplicate}>⧉ Duplicar</button>
      <button className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive hover:bg-destructive/10" onClick={onDelete}>🗑 Apagar</button>
      <button className={btn} onClick={onClear}>Limpar seleção</button>
    </div>
  );
}

/* ---------------- Biblioteca de circuitos ---------------- */
export const TEMPLATES: Array<{ label: string; c: Omit<Circuit, "id"> }> = [
  { label: "🔌 VE 7,4 kW", c: { name: "Carregador VE 7,4 kW", power: 7400, length: 20, cosphi: 1, type: "Tomadas", cable: "XV", scenario: "Embutido", phase: "Mono" } },
  { label: "🔌 VE 22 kW", c: { name: "Carregador VE 22 kW", power: 22000, length: 20, cosphi: 1, type: "Tomadas", cable: "XV", scenario: "Embutido", phase: "Tri" } },
  { label: "❄ Bomba de calor", c: { name: "Bomba de Calor / AVAC", power: 9000, length: 25, cosphi: 0.85, type: "UAC", cable: "XV", scenario: "Calha", phase: "Tri" } },
  { label: "⚡ Tomadas 16 A", c: { name: "Tomadas Gerais", power: 3500, length: 20, cosphi: 1, type: "Tomadas", cable: "H07V-K", scenario: "Embutido", phase: "Mono" } },
  { label: "💡 Iluminação LED", c: { name: "Iluminação LED", power: 1500, length: 20, cosphi: 0.95, type: "Iluminacao", cable: "H07V-K", scenario: "Embutido", phase: "Mono" } },
  { label: "⚙ Motor arranque direto", c: { name: "Motor Arranque Direto", power: 7500, length: 30, cosphi: 0.85, type: "UAC", cable: "XV", scenario: "Calha", phase: "Tri", curve: "D" } },
];
export function CircuitTemplates({ onAdd }: { onAdd: (c: Omit<Circuit, "id">) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">Rápido:</span>
      {TEMPLATES.map(t => (
        <button key={t.label} className="rounded-full border border-[color:var(--brand-green)]/40 px-2.5 py-1 text-[color:var(--brand-green)] hover:bg-[color:var(--brand-green)]/10"
          onClick={() => onAdd(t.c)}>{t.label}</button>
      ))}
    </div>
  );
}

/* ---------------- Auditoria ---------------- */
export function AuditPanel({ issues, score, onPick }: { issues: AuditIssue[]; score: number; onPick: (id: string) => void }) {
  const crit = issues.filter(i => i.level === "critical").length;
  const warn = issues.filter(i => i.level === "warn").length;
  const color = crit ? "text-destructive" : warn ? "text-warning" : "text-[color:var(--brand-green)]";
  const lvl = { critical: "border-destructive/50 bg-destructive/10", warn: "border-warning/50 bg-warning/10", info: "border-[color:var(--brand-blue)]/40 bg-[color:var(--brand-blue)]/10" };
  const lbl = { critical: "CRÍTICO", warn: "AVISO", info: "INFO" };
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-card p-4">
        <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Índice de conformidade</div>
          <div className={`text-4xl font-bold ${color}`}>{score}<span className="text-lg">/100</span></div></div>
        <div className="flex gap-4 text-sm">
          <span className="text-destructive">● {crit} críticos</span>
          <span className="text-warning">● {warn} avisos</span>
          <span className="text-[color:var(--brand-blue)]">● {issues.length - crit - warn} informações</span>
        </div>
        <div className="text-xs text-muted-foreground">Verificação RTIEBT / IEC 60364 em tempo real. Clique num item para abrir o circuito.</div>
      </div>
      {issues.length === 0 && <div className="rounded border border-[color:var(--brand-green)]/40 bg-[color:var(--brand-green)]/10 p-3 text-[color:var(--brand-green)]">✓ Quadro totalmente conforme.</div>}
      {issues.map((i, k) => (
        <button key={k} disabled={!i.circuitId} onClick={() => i.circuitId && onPick(i.circuitId)}
          className={`flex w-full items-start gap-3 rounded border p-2 text-left text-xs ${lvl[i.level]} ${i.circuitId ? "hover:brightness-125" : ""}`}>
          <b className="w-16 shrink-0">{lbl[i.level]}</b>
          <span className="w-28 shrink-0 text-muted-foreground">{i.rule}</span>
          <span className="flex-1">{i.circuitName && <b>{i.circuitName}: </b>}{i.msg}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Inspetor (memória de cálculo) ---------------- */
export function CircuitInspector({ row, ctx }: { row: Row; ctx: FeederContext }) {
  const { c, r } = row;
  const tri = c.phase === "Tri";
  const U = tri ? ctx.voltageTri : ctx.voltageMono;
  const rho = (c.material ?? "Cu") === "Al" ? 0.036 : 0.0225;
  const iz0 = izFor(r.section, c.scenario, c.material ?? "Cu");
  const L = (t: string, v: string) => (
    <div className="border-b border-border/40 py-1.5"><div className="font-mono text-[11px] text-muted-foreground">{t}</div><div className="font-mono text-xs font-semibold">{v}</div></div>
  );
  return (
    <div className="mt-4">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Memória de cálculo</div>
      {L("S = P / cosφ", `${c.power.toFixed(0)} / ${c.cosphi} = ${r.s.toFixed(0)} VA`)}
      {L(tri ? "Ib = S / (√3 × U)" : "Ib = S / U", tri ? `${r.s.toFixed(0)} / (1,732 × ${U}) = ${r.ib.toFixed(2)} A` : `${r.s.toFixed(0)} / ${U} = ${r.ib.toFixed(2)} A`)}
      {L("Ib ≤ In ≤ Iz", `${r.ib.toFixed(1)} ≤ ${r.in} ≤ ${r.iz} → ${r.ib <= r.in && r.in <= r.iz ? "✓ cumpre" : "✗ não cumpre"}`)}
      {L("Iz = Iz0(secção, método) × nº paralelos", `${iz0} × ${r.parallel} = ${r.iz} A`)}
      {L(tri ? "ΔU = √3·ρ·L·Ib·cosφ / S" : "ΔU = 2·ρ·L·Ib·cosφ / S", `${tri ? "1,732" : "2"}·${rho}·${c.length}·Ib·${c.cosphi} / ${r.section * r.parallel} → ${r.deltaU.toFixed(2)} % (+ alimentação ${ctx.feederDeltaU.toFixed(2)} %)`)}
      {L("Icc = U0 / (Zmontante + Zalim + Zlinha)", `${r.iccTerm.toFixed(2)} kA`)}
      {L("PdC ≥ Icc presumido", `Normalizado: ${r.icuKA} kA`)}
    </div>
  );
}

/* ---------------- Bateria de condensadores ---------------- */
export function CapacitorBank({ pW, cosNow }: { pW: number; cosNow: number }) {
  const [target, setTarget] = useState(0.95);
  const [cos, setCos] = useState(cosNow);
  const res = capacitorBank(pW / 1000, cos, target);
  return (
    <div className="m-4 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="mb-2 font-bold text-[color:var(--brand-green)]">Bateria de condensadores (compensação de cosφ)</div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        <label>cosφ atual <input type="number" step="0.01" value={cos} onChange={e => setCos(+e.target.value || 0.8)} className="ml-1 w-20 rounded border border-border bg-[color:var(--surface-2)] px-1" /></label>
        <label>cosφ pretendido <select value={target} onChange={e => setTarget(+e.target.value)} className="ml-1 rounded border border-border bg-[color:var(--surface-2)] px-1">
          <option value={0.95}>0,95</option><option value={0.98}>0,98</option><option value={1}>1,00</option></select></label>
      </div>
      <div className="font-mono text-xs text-muted-foreground">Qc = P × (tanφ1 − tanφ2) = {(pW / 1000).toFixed(1)} × ({res.tan1.toFixed(3)} − {res.tan2.toFixed(3)})</div>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div><div className="text-[10px] uppercase text-muted-foreground">Qc necessário</div><b>{res.qc.toFixed(1)} kVAr</b></div>
        <div><div className="text-[10px] uppercase text-muted-foreground">Escalão comercial</div><b className="text-[color:var(--brand-green)]">{res.commercial} kVAr</b></div>
        <div><div className="text-[10px] uppercase text-muted-foreground">S antes → depois</div><b>{res.sNow.toFixed(1)} → {res.sAfter.toFixed(1)} kVA</b></div>
        <div><div className="text-[10px] uppercase text-muted-foreground">Redução de corrente</div><b>{res.reductionPct.toFixed(1)} %</b></div>
      </div>
    </div>
  );
}

/* ---------------- Esquema unifilar ---------------- */
const PH: Record<string, string> = { L1: "var(--phase-l1)", L2: "var(--phase-l2)", L3: "var(--phase-l3)" };
export function SingleLineDiagram({ rows: rows0, panelName, mainLabel, onPick, rcds = [], equip = {} }: { rows: Row[]; panelName: string; mainLabel: string; onPick: (c: Circuit) => void; rcds?: RCD[]; equip?: PanelEquip; tags?: Map<string, string[]> }) {
  const idx = new Map(rows0.map((x, i) => [x.c.id, i]));
  const groups: Array<{ d?: RCD; rows: Row[] }> = rcds.map(d => ({ d, rows: rows0.filter(x => d.circuitIds.includes(x.c.id)) })).filter(g => g.rows.length);
  const loose = rows0.filter(x => !rcds.some(d => d.circuitIds.includes(x.c.id)));
  if (loose.length) groups.push({ rows: loose });
  const rows = groups.flatMap(g => g.rows);
  const modulesOf = (id: string) => (equip.controls ?? []).filter(m => m.circuitIds.includes(id)).flatMap(m => m.kind === "ContactorTermico" ? [{ ...m, symbol: "contactor" as const }, { ...m, label: `${m.label} RT`, symbol: "thermal" as const }] : [{ ...m, symbol: CONTROL_SYMBOL[m.kind] }]);
  const maxModules = Math.max(0, ...rows.map(({ c }) => modulesOf(c.id).length));
  const off = groups.some(g => g.d) ? 100 : 0;
  const step = 160, busY = 125, W = Math.max(720, 80 + rows.length * step);
  const loadY = busY + 10 + off + 150 + maxModules * 60;
  const H = loadY + 195;
  let pos = 0;
  return (
    <div className="overflow-auto p-4">
      <PanelHead equip={equip} mainLabel={mainLabel} />
      <svg width={W} height={H} role="img" aria-label={`Esquema unifilar de ${panelName}`} className="border border-border bg-card text-foreground">
        <text x={16} y={24} className="fill-foreground" fontSize={14} fontWeight={700}>{panelName} — Esquema unifilar</text>
        <path d={`M40 34V43 M40 87V${busY}`} stroke="currentColor" fill="none" strokeWidth={2} />
        <ElectricalSymbol kind="breaker" x={40} y={65} />
        <text x={66} y={70} fontSize={11} className="fill-brand-green" fontWeight={700}>{mainLabel}</text>
        {(["L1", "L2", "L3"] as const).map((p, k) => (
          <g key={p}><line x1={20} y1={busY + k * 5} x2={W - 30} y2={busY + k * 5} stroke={PH[p]} strokeWidth={3} />
            <text x={W - 25} y={busY + k * 5 + 3} fontSize={8} className="fill-muted-foreground">{p}</text></g>
        ))}
        {groups.map((g, gi) => {
          const start = pos; pos += g.rows.length;
          if (!g.d) return null;
          const x1 = 80 + start * step, x2 = 80 + (pos - 1) * step, xm = (x1 + x2) / 2, y = busY + 10;
          return <g key={gi} className="text-brand-blue">
            <path d={`M${xm} ${y}V${y + 10} M${xm} ${y + 54}V${y + 76} M${x1} ${y + 76}H${x2}`} stroke="currentColor" fill="none" strokeWidth={2} />
            <ElectricalSymbol kind="rcd" x={xm} y={y + 32} />
            <text x={xm + 24} y={y + 22} fontSize={10} fontWeight={700} fill="currentColor">{g.d.label}</text>
            <text x={xm + 24} y={y + 38} fontSize={9} className="fill-muted-foreground">{g.d.inA} A · {g.d.iAnmA} mA</text>
            <text x={xm + 24} y={y + 52} fontSize={9} className="fill-muted-foreground">{g.d.poles}P · Tipo {g.d.kind}</text>
          </g>;
        })}
        {rows.map(({ c, r }, i) => {
          const inR = rcds.some(d => d.circuitIds.includes(c.id));
          const bus = (equip.buses ?? []).find(b => b.circuitIds.includes(c.id));
          const x = 80 + i * step, y0 = busY + 10 + off;
          const col = c.phase === "Tri" ? "var(--phase-tri)" : PH[c.phaseAssign ?? "L1"];
          const mods = modulesOf(c.id);
          const num = (idx.get(c.id) ?? i) + 1;
          return <g key={c.id} className="cursor-pointer" onClick={() => onPick(c)} color={col}>
            <title>{`C${num} · ${c.name} · ${c.cable} · ${r.section} mm²`}</title>
            <rect x={x - 42} y={y0} width={step - 4} height={H - y0 - 10} fill="transparent" className="hover:fill-brand-blue/10" />
            <path d={`M${x} ${inR ? busY + 86 : busY + 10}V${y0 + 13} M${x} ${y0 + 57}V${mods.length ? y0 + 108 : loadY - 22}`} stroke="currentColor" fill="none" strokeWidth={2} />
            <ElectricalSymbol kind="breaker" x={x} y={y0 + 35} />
            <text x={x + 24} y={y0 + 34} fontSize={10} className={r.errors.length ? "fill-destructive" : "fill-foreground"} fontWeight={700}>{r.in} A · {r.curve}</text>
            <text x={x + 24} y={y0 + 49} fontSize={9} className="fill-muted-foreground">{r.icuKA} kA</text>
            <text x={x + 24} y={y0 + 70} fontSize={10} className="fill-foreground">{c.cable}</text>
            <text x={x + 24} y={y0 + 85} fontSize={9} className="fill-muted-foreground">{r.parallel > 1 ? `${r.parallel}×` : ""}{r.section} mm² · {c.material ?? "Cu"}</text>
            {mods.map((m, k) => {
              const cy = y0 + 130 + k * 60;
              return <g key={`${m.id}-${k}`}>
                <ElectricalSymbol kind={m.symbol} x={x} y={cy} />
                <path d={`M${x} ${cy + 22}V${k === mods.length - 1 ? loadY - 22 : cy + 38}`} stroke="currentColor" fill="none" strokeWidth={2} />
                <text x={x + 25} y={cy - 4} fontSize={10} className="fill-warning" fontWeight={700}>{m.label}</text>
                <text x={x + 25} y={cy + 10} fontSize={8} className="fill-muted-foreground">{m.kind === "ContactorTermico" ? m.symbol === "thermal" ? "Relé térmico" : "Contactor" : m.kind}</text>
                <text x={x + 25} y={cy + 23} fontSize={8} className="fill-muted-foreground">{m.inputs} E · {m.outputs} S · {m.aux} aux</text>
              </g>;
            })}
            <ElectricalSymbol kind={c.type === "Iluminacao" ? "lamp" : c.type === "Tomadas" ? "socket" : c.type === "AC" || c.type === "UAC" ? "motor" : "terminal"} x={x} y={loadY} />
            <text x={x + 24} y={loadY + 3} fontSize={10} className="fill-foreground" fontWeight={700}>C{num}</text>
            {bus && <text x={x + 24} y={loadY + 18} fontSize={9} className="fill-brand-blue">{bus.kind}</text>}
            <text transform={`translate(${x},${loadY + 40}) rotate(60)`} fontSize={10} className="fill-foreground">{c.name.slice(0, 28)}</text>
            <text transform={`translate(${x - 16},${loadY + 40}) rotate(60)`} fontSize={9} className="fill-muted-foreground">{(c.power / 1000).toFixed(2)} kW · {c.phase === "Tri" ? "3F" : c.phaseAssign ?? "1F"}</text>
          </g>;
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground"><span>L1 castanho</span><span>L2 vermelho</span><span>L3 cinzento</span><span>Trifásico verde</span></div>
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-3 text-xs font-bold">SIMBOLOGIA</h3>
        <div className="grid min-w-[600px] grid-cols-3 gap-x-6 gap-y-2">
          {SYMBOL_LEGEND.map(([kind, label]) => <div key={kind} className="flex items-center gap-2 text-xs text-muted-foreground"><svg width={48} height={52} className="shrink-0 text-foreground" aria-hidden="true"><ElectricalSymbol kind={kind} x={24} y={26} /></svg><span>{label}</span></div>)}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Fontes, inversor, MX, DST, UPS, barramentos ---------------- */
function PanelHead({ equip: e, mainLabel }: { equip: PanelEquip; mainLabel: string }) {
  if (!(e.ats || e.ups || e.spd || e.mxFitted || e.buses?.length)) return null;
  const buses = e.buses ?? [];
  const W = Math.max(800, 420 + buses.length * 180);
  return <svg width={W} height={430} role="img" aria-label="Alimentação e equipamento do quadro" className="mb-3 border border-border bg-card text-foreground">
    <text x={16} y={24} fontSize={12} fontWeight={700} className="fill-foreground">Alimentação e equipamento do quadro</text>
    <path d="M90 50V92" stroke="currentColor" strokeWidth={2} /><text x={105} y={65} fontSize={11} className="fill-foreground">REDE</text>
    {e.ats ? <>
      <ElectricalSymbol kind="generator" x={230} y={70} />
      <text x={252} y={66} fontSize={11} className="fill-warning">GERADOR · {e.ats.genKVA} kVA</text>
      <text x={252} y={81} fontSize={9} className="fill-muted-foreground">Icc ≈ {generatorIcc(e.ats.genKVA).icc.toFixed(0)} A</text>
      <path d="M90 92V108H146 M230 92V108H174" stroke="currentColor" fill="none" strokeWidth={2} />
      <ElectricalSymbol kind="ats" x={160} y={130} />
      <path d="M160 152V168H90V178" stroke="currentColor" fill="none" strokeWidth={2} />
      <text x={190} y={130} fontSize={10} className="fill-foreground">{e.ats.mode === "Auto" ? "ATS automático" : "Inversor I-0-II"}</text>
      <text x={190} y={145} fontSize={9} className="fill-muted-foreground">Encravamento</text>
    </> : <path d="M90 92V178" stroke="currentColor" strokeWidth={2} />}
    <ElectricalSymbol kind="breaker" x={90} y={200} />
    <text x={115} y={190} fontSize={10} className="fill-brand-green">CORTE GERAL</text>
    <text x={115} y={205} fontSize={9} className="fill-muted-foreground">{mainLabel}</text>
    {e.mxFitted && <g className="text-destructive"><path d="M77 200H35V240H68" stroke="currentColor" fill="none" strokeDasharray="4 3" /><ElectricalSymbol kind="coil" x={90} y={240} /><text x={120} y={245} fontSize={10} fill="currentColor">MX · C1/C2</text></g>}
    <path d={`M90 222V290 M30 290H${W - 30}`} stroke="currentColor" strokeWidth={2} fill="none" />
    {e.ups && <g className="text-brand-blue">
      <path d={`M${W - 300} 290V93 M${W - 300} 137V260H${W - 200}V290`} stroke="currentColor" fill="none" strokeWidth={2} />
      <ElectricalSymbol kind="ups" x={W - 300} y={115} />
      <text x={W - 278} y={111} fontSize={11} fill="currentColor">UPS · {e.ups.kVA} kVA</text>
      <text x={W - 278} y={127} fontSize={9} className="fill-muted-foreground">{e.ups.autonomyMin} min</text>
      {e.ups.bypass && <><path d={`M${W - 300} 165H${W - 350}V137 M${W - 350} 93V70H${W - 200}V260`} stroke="currentColor" fill="none" /><ElectricalSymbol kind="switch" x={W - 350} y={115} /><text x={W - 383} y={62} fontSize={9} className="fill-muted-foreground">Bypass</text></>}
    </g>}
    {e.spd && <g className="text-brand-blue">
      <path d={`M${W - 65} 290V308 M${W - 65} 352V358`} stroke="currentColor" fill="none" />
      <ElectricalSymbol kind="spd" x={W - 65} y={330} /><ElectricalSymbol kind="earth" x={W - 65} y={380} />
      <text x={W - 88} y={405} textAnchor="end" fontSize={10} fill="currentColor">DST {e.spd.type} · {e.spd.poles}P · {e.spd.iKA} kA</text>
      <text x={W - 88} y={419} textAnchor="end" fontSize={9} className="fill-muted-foreground">Proteção a montante {e.spd.backupA} A · PE</text>
    </g>}
    {buses.map((b, i) => {
      const x = 100 + i * 180;
      return <g key={b.id} className={b.kind === "UPS" ? "text-destructive" : b.kind === "Socorro" ? "text-warning" : "text-brand-blue"}>
        <path d={`M${x} 290V330 M${x - 55} 330H${x + 55}`} stroke="currentColor" fill="none" strokeWidth={3} />
        <text x={x} y={350} fontSize={9} textAnchor="middle" fill="currentColor" fontWeight={700}>{b.name.slice(0, 26)}</text>
        <text x={x} y={366} fontSize={9} textAnchor="middle" className="fill-muted-foreground">{b.circuitIds.length} circuitos</text>
      </g>;
    })}
  </svg>;
}

/* ---------------- Frontal DIN ---------------- */
export function DinFrontView({ rows, mainPoles }: { rows: Row[]; mainPoles: number }) {
  const PER_ROW = 24, MOD = 18, scale = 2;
  const items = [{ label: "GERAL", mods: mainPoles, main: true }, ...rows.map((x, i) => ({ label: `C${i + 1}`, mods: x.r.modules, main: false, name: x.c.name, in: x.r.in }))];
  const used = items.reduce((a, b) => a + b.mods, 0);
  const total = Math.ceil(used * 1.3);
  const nRows = Math.max(1, Math.ceil(total / PER_ROW));
  const rowsOut: Array<typeof items> = Array.from({ length: nRows }, () => []);
  let r = 0, fill = 0;
  for (const it of items) { if (fill + it.mods > PER_ROW) { r++; fill = 0; } if (!rowsOut[r]) rowsOut[r] = []; rowsOut[r].push(it); fill += it.mods; }
  const W = PER_ROW * MOD * scale + 40;
  return (
    <div className="overflow-auto p-4">
      <div className="mb-2 text-sm"><b>Frontal do quadro</b> — {used} módulos ocupados · {total} com reserva de 30 % · {rowsOut.length} fila(s) de {PER_ROW} módulos</div>
      <div className="inline-block rounded-xl border-4 border-[color:var(--surface-2)] bg-card p-5" style={{ width: W }}>
        {rowsOut.map((row, k) => {
          const occ = row.reduce((a, b) => a + b.mods, 0);
          return (
            <div key={k} className="relative mb-5 flex h-28 items-center rounded bg-[color:var(--surface-2)] px-0">
              <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 bg-muted-foreground/30" />
              {row.map((it, j) => (
                <div key={j} title={"name" in it ? `${it.name} — ${it.in} A` : "Aparelho geral"}
                  className={`relative z-10 flex h-24 flex-col items-center justify-between rounded-sm border py-1 text-[9px] font-bold ${it.main ? "border-[color:var(--brand-blue)] bg-[color:var(--brand-blue)]/30" : "border-border bg-background"}`}
                  style={{ width: it.mods * MOD * scale }}>
                  <span>{it.label}</span><span className="h-6 w-3 rounded-sm bg-foreground/80" /><span>{"in" in it ? `${it.in}A` : ""}</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, PER_ROW - occ) }).map((_, j) => (
                <div key={`r${j}`} className="relative z-10 h-24 rounded-sm border border-dashed border-muted-foreground/40" style={{ width: MOD * scale }} />
              ))}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">Cada módulo = 18 mm. Espaços tracejados = reserva disponível.</div>
    </div>
  );
}

/* ---------------- Curvas tempo-corrente ---------------- */
export function TripCurves({ rows, mainRating, iccKA, selectedId }: { rows: Row[]; mainRating: number; iccKA: number; selectedId: string | null }) {
  const [pick, setPick] = useState<string | null>(selectedId ?? rows[0]?.c.id ?? null);
  const row = rows.find(x => x.c.id === pick) ?? rows[0];
  const upKind: CurveKind = mainRating > 100 ? "gG" : "C";
  const iccA = Math.max(100, iccKA * 1000);
  const W = 720, H = 460, m = 50;
  const xMin = 1, xMax = Math.max(iccA * 2, 10000), yMin = 0.001, yMax = 10000;
  const X = (I: number) => m + (Math.log10(I / xMin) / Math.log10(xMax / xMin)) * (W - 2 * m);
  const Y = (t: number) => H - m - (Math.log10(Math.max(yMin, t) / yMin) / Math.log10(yMax / yMin)) * (H - 2 * m);
  const path = (pts: Array<[number, number]>) => pts.map(([i, t], k) => `${k ? "L" : "M"}${X(i).toFixed(1)},${Y(t).toFixed(1)}`).join(" ");
  const down = row ? { kind: row.r.curve as CurveKind, In: row.r.in } : null;
  const sel = down ? selectivityLimit({ kind: upKind, In: mainRating }, down, iccA) : null;
  const decX = [1, 10, 100, 1000, 10000, 100000].filter(v => v <= xMax);
  const decY = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000];
  return (
    <div className="p-4">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
        <b>Curvas tempo-corrente</b>
        <select value={row?.c.id ?? ""} onChange={e => setPick(e.target.value)} className="rounded border border-border bg-[color:var(--surface-2)] px-2 py-1 text-xs">
          {rows.map((x, i) => <option key={x.c.id} value={x.c.id}>C{i + 1} — {x.c.name} ({x.r.in}A {x.r.curve})</option>)}
        </select>
        {sel && <span className={`rounded px-2 py-0.5 text-xs font-semibold ${sel.total ? "bg-[color:var(--brand-green)]/15 text-[color:var(--brand-green)]" : "bg-warning/20 text-warning"}`}>
          {sel.total ? "Seletividade TOTAL" : `Seletividade PARCIAL até ${(sel.limitA / 1000).toFixed(2)} kA`} (Icc = {iccKA.toFixed(1)} kA)</span>}
      </div>
      <svg width={W} height={H} className="rounded-lg border border-border bg-card">
        {decX.map(v => <g key={v}><line x1={X(v)} y1={m} x2={X(v)} y2={H - m} className="stroke-border" /><text x={X(v)} y={H - m + 14} fontSize={10} textAnchor="middle" className="fill-muted-foreground">{v >= 1000 ? `${v / 1000}k` : v}</text></g>)}
        {decY.map(v => <g key={v}><line x1={m} y1={Y(v)} x2={W - m} y2={Y(v)} className="stroke-border" /><text x={m - 4} y={Y(v) + 3} fontSize={10} textAnchor="end" className="fill-muted-foreground">{v}</text></g>)}
        <text x={W / 2} y={H - 10} fontSize={11} textAnchor="middle" className="fill-foreground">Corrente (A)</text>
        <text x={14} y={H / 2} fontSize={11} transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle" className="fill-foreground">Tempo (s)</text>
        <line x1={X(iccA)} y1={m} x2={X(iccA)} y2={H - m} stroke="#e5484d" strokeDasharray="4 3" />
        <text x={X(iccA) + 4} y={m + 12} fontSize={10} fill="#e5484d">Icc</text>
        <path d={path(curvePoints(upKind, mainRating, xMax))} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
        {down && <path d={path(curvePoints(down.kind, down.In, xMax))} fill="none" stroke="#22c55e" strokeWidth={2.5} />}
        {sel && !sel.total && <line x1={X(sel.limitA)} y1={m} x2={X(sel.limitA)} y2={H - m} stroke="#f59e0b" strokeDasharray="2 2" />}
      </svg>
      <div className="mt-2 flex gap-4 text-xs"><span style={{ color: "#3b82f6" }}>━ Geral {mainRating} A ({upKind === "gG" ? "fusível gG" : "curva C"})</span>
        {down && <span style={{ color: "#22c55e" }}>━ Circuito {down.In} A curva {down.kind}</span>}</div>
    </div>
  );
}
