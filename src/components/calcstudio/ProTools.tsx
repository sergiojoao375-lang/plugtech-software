// Módulos profissionais: edição inline, ações em massa, modelos, auditoria, inspetor,
// condensadores, unifilar, frontal DIN e curvas de seletividade.
import { useState } from "react";
import type { Circuit, CalcResult, FeederContext, CircuitType, InstallScenario, Phase, Material } from "@/lib/calc/engine";
import { izFor } from "@/lib/calc/engine";
import type { AuditIssue } from "@/lib/calc/audit";
import { capacitorBank } from "@/lib/calc/capacitor";
import { curvePoints, selectivityLimit, type CurveKind } from "@/lib/calc/curves";
import type { RCD } from "@/lib/calc/rcd";

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
const PH: Record<string, string> = { L1: "#8B4513", L2: "#111111", L3: "#808080" };
export function SingleLineDiagram({ rows: rows0, panelName, mainLabel, onPick, rcds = [] }: { rows: Row[]; panelName: string; mainLabel: string; onPick: (c: Circuit) => void; rcds?: RCD[] }) {
  const idx = new Map(rows0.map((x, i) => [x.c.id, i]));
  // agrupa os circuitos por diferencial (ordem dos DR), depois os sem DR
  const groups: Array<{ d?: RCD; rows: Row[] }> = rcds.map(d => ({ d, rows: rows0.filter(x => d.circuitIds.includes(x.c.id)) })).filter(g => g.rows.length);
  const loose = rows0.filter(x => !rcds.some(d => d.circuitIds.includes(x.c.id)));
  if (loose.length) groups.push({ rows: loose });
  const rows = groups.flatMap(g => g.rows);
  const hasRcd = groups.some(g => g.d);
  const off = hasRcd ? 70 : 0;
  const step = 90, busY = 110, n = Math.max(1, rows.length);
  const W = 80 + n * step, H = 470 + off;
  let pos = 0;
  return (
    <div className="overflow-auto p-4">
      <svg width={W} height={H} className="rounded-lg border border-border bg-card" style={{ minWidth: W }}>
        <text x={16} y={24} className="fill-foreground" fontSize={14} fontWeight={700}>{panelName} — Esquema unifilar</text>
        <line x1={40} y1={34} x2={40} y2={60} stroke="currentColor" className="text-foreground" strokeWidth={2} />
        <line x1={40} y1={60} x2={52} y2={80} stroke="currentColor" className="text-foreground" strokeWidth={2} />
        <line x1={40} y1={80} x2={40} y2={busY} stroke="currentColor" className="text-foreground" strokeWidth={2} />
        <text x={58} y={72} fontSize={11} className="fill-[color:var(--brand-green)]" fontWeight={700}>{mainLabel}</text>
        {(["L1", "L2", "L3"] as const).map((p, k) => (
          <g key={p}><line x1={20} y1={busY + k * 5} x2={W - 20} y2={busY + k * 5} stroke={PH[p]} strokeWidth={3} />
            <text x={W - 18} y={busY + k * 5 + 3} fontSize={8} className="fill-muted-foreground">{p}</text></g>
        ))}
        {groups.map((g, gi) => {
          const start = pos; pos += g.rows.length;
          if (!g.d) return null;
          const x1 = 70 + start * step, x2 = 70 + (pos - 1) * step, xm = (x1 + x2) / 2, y = busY + 10;
          return (
            <g key={gi}>
              <line x1={xm} y1={y} x2={xm} y2={y + 14} stroke="#2563eb" strokeWidth={2} />
              <rect x={xm - 14} y={y + 14} width={28} height={26} fill="none" stroke="#2563eb" strokeWidth={2} />
              <ellipse cx={xm} cy={y + 27} rx={8} ry={5} fill="none" stroke="#2563eb" strokeWidth={1.5} />
              <line x1={xm} y1={y + 40} x2={xm} y2={y + 56} stroke="#2563eb" strokeWidth={2} />
              <line x1={x1} y1={y + 56} x2={x2} y2={y + 56} stroke="#2563eb" strokeWidth={3} />
              <text x={xm + 18} y={y + 24} fontSize={10} fontWeight={700} fill="#2563eb">{g.d.label}</text>
              <text x={xm + 18} y={y + 36} fontSize={9} className="fill-muted-foreground">{g.d.inA}A {g.d.iAnmA}mA {g.d.poles}P {g.d.kind}</text>
            </g>
          );
        })}
        {rows.map(({ c, r }, i) => {
          const inR = rcds.some(d => d.circuitIds.includes(c.id));
          const x = 70 + i * step, y0 = busY + 10 + off;
          const col = c.phase === "Tri" ? "#2E8B57" : PH[c.phaseAssign ?? "L1"];
          const bad = r.errors.length > 0;
          const num = (idx.get(c.id) ?? i) + 1;
          return (
            <g key={c.id} className="cursor-pointer" onClick={() => onPick(c)}>
              <rect x={x - 40} y={y0} width={80} height={H - y0 - 10} fill="transparent" className="hover:fill-[color:var(--brand-blue)]/10" />
              {off > 0 && <line x1={x} y1={inR ? y0 - 14 : busY + 10} x2={x} y2={y0} stroke={col} strokeWidth={2} />}
              <line x1={x} y1={y0} x2={x} y2={y0 + 30} stroke={col} strokeWidth={2} />
              <line x1={x} y1={y0 + 30} x2={x + 10} y2={y0 + 50} stroke={col} strokeWidth={2} />
              <line x1={x - 4} y1={y0 + 26} x2={x + 4} y2={y0 + 34} stroke={col} strokeWidth={2} />
              <line x1={x + 4} y1={y0 + 26} x2={x - 4} y2={y0 + 34} stroke={col} strokeWidth={2} />
              <line x1={x} y1={y0 + 50} x2={x} y2={y0 + 150} stroke={col} strokeWidth={2} />
              <circle cx={x} cy={y0 + 162} r={12} fill="none" stroke={bad ? "#e5484d" : col} strokeWidth={2} />
              <text x={x} y={y0 + 166} fontSize={9} textAnchor="middle" className="fill-foreground">C{num}</text>
              <text x={x + 14} y={y0 + 46} fontSize={10} className={bad ? "fill-destructive" : "fill-foreground"} fontWeight={700}>{r.in}A {r.curve}</text>
              <text x={x + 14} y={y0 + 58} fontSize={9} className="fill-muted-foreground">{r.icuKA} kA</text>
              <text x={x + 4} y={y0 + 95} fontSize={9} className="fill-muted-foreground">{r.parallel > 1 ? `${r.parallel}×` : ""}{r.section}mm²</text>
              <text transform={`translate(${x + 4},${y0 + 184}) rotate(60)`} fontSize={10} className="fill-foreground">{c.name.slice(0, 26)}</text>
              <text transform={`translate(${x - 8},${y0 + 184}) rotate(60)`} fontSize={9} className="fill-muted-foreground">{(c.power / 1000).toFixed(2)} kW · {c.phase === "Tri" ? "3F" : c.phaseAssign ?? "1F"}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 text-xs text-muted-foreground">Clique numa saída para editar o circuito. Cores: L1 castanho, L2 preto, L3 cinzento, trifásico verde.</div>
    </div>
  );
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
