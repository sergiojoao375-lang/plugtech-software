// Equipamento do quadro: fontes/inversor, UPS, barramentos, DST, bobina MX e módulos de comando/AVAC
import { useState } from "react";
import type { Circuit, CalcResult } from "@/lib/calc/engine";
import {
  CONTROL_INFO, MX_TRIGGERS, checkEquipment, generatorIcc, mxReasons, newControl, recommendSpd, sizeBusbar, busIb, terminals, upsIcc,
  type Bus, type BusKind, type ControlKind, type ControlModule, type MxTrigger, type PanelEquip, type SpdType,
} from "@/lib/calc/equipment";

type Row = { c: Circuit; r: CalcResult };
const sel = "rounded border border-border bg-[color:var(--surface-2)] px-1 py-1 text-xs";
const card = "rounded-lg border border-border bg-card p-3";
const qbtn = "rounded-md border border-border px-2 py-1 text-xs hover:bg-[color:var(--surface-2)]";
const h = "mb-2 text-sm font-bold";

function CircuitPicker({ rows, ids, onToggle, taken }: { rows: Row[]; ids: string[]; onToggle: (id: string) => void; taken?: (id: string) => string | undefined }) {
  return (
    <div className="mt-2 grid max-h-48 grid-cols-1 gap-1 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ c, r }, i) => (
        <label key={c.id} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${ids.includes(c.id) ? "bg-[color:var(--brand-green)]/15" : "hover:bg-[color:var(--surface-2)]"}`}>
          <input type="checkbox" checked={ids.includes(c.id)} onChange={() => onToggle(c.id)} />
          <span className="flex-1 truncate">C{i + 1} {c.name}</span>
          <span className="text-muted-foreground">{r.in}A</span>
          {taken?.(c.id) && <span className="text-[10px] text-muted-foreground">({taken(c.id)})</span>}
        </label>
      ))}
      {!rows.length && <span className="text-xs text-muted-foreground">Sem circuitos no quadro.</span>}
    </div>
  );
}

export function EquipmentManager({ equip, rows, onChange, isQGE, panelIb, iccKA }: { equip: PanelEquip; rows: Row[]; onChange: (e: PanelEquip) => void; isQGE: boolean; panelIb: number; iccKA: number }) {
  const e = equip;
  const set = (p: Partial<PanelEquip>) => onChange({ ...e, ...p });
  const [open, setOpen] = useState<string | null>(null);
  const issues = checkEquipment(rows, e, isQGE, panelIb, iccKA);
  const reasons = mxReasons(rows, e);
  const buses = e.buses ?? [];
  const controls = e.controls ?? [];
  const bb = sizeBusbar(panelIb, iccKA);

  const toggleTrig = (t: MxTrigger) => {
    const cur = e.mxTriggers ?? [];
    const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t];
    set({ mxTriggers: next, mxFitted: next.length ? true : e.mxFitted });
  };
  const addBus = (kind: BusKind) => set({ buses: [...buses, { id: crypto.randomUUID(), name: kind === "Normal" ? "Barramento Normal" : kind === "Socorro" ? "Barramento Socorro (GE)" : kind === "UPS" ? "Barramento UPS" : "Pente de ligação", kind, circuitIds: [] }] });
  const patchBus = (id: string, p: Partial<Bus>) => set({ buses: buses.map(b => b.id === id ? { ...b, ...p } : b) });
  const toggleBus = (id: string, cid: string) => set({ buses: buses.map(b => b.id === id ? { ...b, circuitIds: b.circuitIds.includes(cid) ? b.circuitIds.filter(x => x !== cid) : [...b.circuitIds, cid] } : { ...b, circuitIds: b.circuitIds.filter(x => x !== cid) }) });
  const addCtl = (k: ControlKind) => { const m = newControl(k, controls); set({ controls: [...controls, m] }); setOpen(m.id); };
  const patchCtl = (id: string, p: Partial<ControlModule>) => set({ controls: controls.map(m => m.id === id ? { ...m, ...p } : m) });
  const toggleCtl = (id: string, cid: string) => set({ controls: controls.map(m => m.id === id ? { ...m, circuitIds: m.circuitIds.includes(cid) ? m.circuitIds.filter(x => x !== cid) : [...m.circuitIds, cid] } : m) });

  return (
    <div className="space-y-4 p-4">
      {/* Verificação */}
      <div className={`${card} ${issues.some(i => i.level === "critical") ? "border-destructive/60" : "border-[color:var(--brand-green)]/60"}`}>
        <div className={h}>{issues.some(i => i.level === "critical") ? "✗ Equipamento com falhas" : "✓ Equipamento verificado"}</div>
        <ul className="space-y-0.5 text-xs">
          {issues.map((i, k) => <li key={k} className={i.level === "critical" ? "text-destructive" : i.level === "warn" ? "text-warning" : "text-muted-foreground"}>{i.level === "critical" ? "✗" : i.level === "warn" ? "⚠" : "ℹ"} {i.msg}</li>)}
          {!issues.length && <li className="text-muted-foreground">Sem observações.</li>}
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Fontes e inversor */}
        <div className={card}>
          <div className={h}>⚡ Fontes e inversor (Rede / Gerador)</div>
          {!e.ats ? <button className={qbtn} onClick={() => set({ ats: { mode: "Auto", genKVA: 100 } })}>+ Adicionar inversor Rede/Gerador</button> : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select className={sel} value={e.ats.mode} onChange={ev => set({ ats: { ...e.ats!, mode: ev.target.value as "Manual" | "Auto" } })}>
                <option value="Auto">Automático (ATS, encravamento elétrico + mecânico)</option><option value="Manual">Manual I-0-II</option>
              </select>
              Gerador <input type="number" className={`${sel} w-20`} value={e.ats.genKVA} onChange={ev => set({ ats: { ...e.ats!, genKVA: +ev.target.value || 0 } })} /> kVA
              <span className="font-mono text-muted-foreground">In {generatorIcc(e.ats.genKVA).In.toFixed(0)} A · Icc ≈ {generatorIcc(e.ats.genKVA).icc.toFixed(0)} A</span>
              <button className="text-destructive" onClick={() => set({ ats: null })}>🗑</button>
            </div>
          )}
          <div className={`${h} mt-4`}>🔋 UPS (alimentação ininterrupta)</div>
          {!e.ups ? <button className={qbtn} onClick={() => set({ ups: { kVA: 10, autonomyMin: 15, bypass: true }, buses: buses.some(b => b.kind === "UPS") ? buses : [...buses, { id: crypto.randomUUID(), name: "Barramento UPS", kind: "UPS", circuitIds: [] }] })}>+ Adicionar UPS</button> : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input type="number" className={`${sel} w-16`} value={e.ups.kVA} onChange={ev => set({ ups: { ...e.ups!, kVA: +ev.target.value || 0 } })} /> kVA
              <input type="number" className={`${sel} w-14`} value={e.ups.autonomyMin} onChange={ev => set({ ups: { ...e.ups!, autonomyMin: +ev.target.value || 0 } })} /> min
              <label className="flex items-center gap-1"><input type="checkbox" checked={e.ups.bypass} onChange={ev => set({ ups: { ...e.ups!, bypass: ev.target.checked } })} /> Bypass</label>
              <span className="font-mono text-muted-foreground">In {upsIcc(e.ups.kVA).In.toFixed(0)} A</span>
              <button className="text-destructive" onClick={() => set({ ups: null })}>🗑</button>
              <span className="w-full text-muted-foreground">A jusante da UPS use diferenciais Tipo F ou B e disjuntores curva B.</span>
            </div>
          )}
        </div>

        {/* DST + MX */}
        <div className={card}>
          <div className={h}>🛡 Descarregador de sobretensões (DST)</div>
          <label className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={!!e.lightningRod} onChange={ev => set({ lightningRod: ev.target.checked })} /> Edifício com para-raios (SPDA) / linha aérea exposta</label>
          {!e.spd ? <button className={qbtn} onClick={() => set({ spd: { type: recommendSpd(e, isQGE), poles: 4, iKA: e.lightningRod ? 12.5 : 40, backupA: e.lightningRod ? 63 : 32 } })}>+ Adicionar DST (recomendado: {recommendSpd(e, isQGE)})</button> : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select className={sel} value={e.spd.type} onChange={ev => set({ spd: { ...e.spd!, type: ev.target.value as SpdType } })}>
                <option value="T1">Tipo 1 (10/350 µs)</option><option value="T1+2">Tipo 1+2</option><option value="T2">Tipo 2 (8/20 µs)</option><option value="T3">Tipo 3 (fina)</option>
              </select>
              <select className={sel} value={e.spd.poles} onChange={ev => set({ spd: { ...e.spd!, poles: +ev.target.value as 2 | 4 } })}><option value={2}>1P+N</option><option value={4}>3P+N</option></select>
              {e.spd.type.startsWith("T1") ? "Iimp" : "Imax"} <input type="number" className={`${sel} w-14`} value={e.spd.iKA} onChange={ev => set({ spd: { ...e.spd!, iKA: +ev.target.value || 0 } })} /> kA
              Proteção <select className={sel} value={e.spd.backupA} onChange={ev => set({ spd: { ...e.spd!, backupA: +ev.target.value } })}>{[20, 25, 32, 40, 50, 63, 80, 125].map(v => <option key={v} value={v}>{v} A</option>)}</select>
              <button className="text-destructive" onClick={() => set({ spd: null })}>🗑</button>
            </div>
          )}
          <div className={`${h} mt-4`}>🚨 Corte de segurança — bobina MX</div>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(MX_TRIGGERS) as MxTrigger[]).map(t => (
              <button key={t} onClick={() => toggleTrig(t)} className={`${qbtn} ${e.mxTriggers?.includes(t) ? "bg-[color:var(--brand-green)]/20 font-semibold" : ""}`}>{MX_TRIGGERS[t]}</button>
            ))}
          </div>
          {reasons.length > 0 && <ul className="mt-2 text-xs text-warning">{reasons.map((r, i) => <li key={i}>• {r}</li>)}</ul>}
          <label className="mt-2 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={!!e.mxFitted} onChange={ev => set({ mxFitted: ev.target.checked })} /> Interruptor geral equipado com bobina MX (bornes C1/C2)</label>
          {reasons.length > 0 && !e.mxFitted && <button className={`${qbtn} mt-1`} onClick={() => set({ mxFitted: true })}>Equipar bobina MX</button>}
        </div>
      </div>

      {/* Barramentos */}
      <div className={card}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">▬ Barramentos</span>
          <span className="text-xs text-muted-foreground">Geral: Cu {bb.bar} mm ({bb.iz} A) para {panelIb.toFixed(0)} A · Ipk {bb.ipkKA} kA</span>
          <div className="ml-auto flex gap-1">{(["Normal", "Socorro", "UPS", "Pente"] as BusKind[]).map(k => <button key={k} className={qbtn} onClick={() => addBus(k)}>+ {k}</button>)}</div>
        </div>
        {buses.map(b => {
          const ib = busIb(b, rows); const s = sizeBusbar(ib, iccKA);
          return (
            <div key={b.id} className="mb-2 rounded border border-border p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input className={`${sel} w-48 font-bold`} value={b.name} onChange={ev => patchBus(b.id, { name: ev.target.value })} />
                <span className="rounded bg-[color:var(--surface-2)] px-2 py-0.5">{b.kind}</span>
                <span className="font-mono">ΣIb {ib.toFixed(1)} A → Cu {s.bar} ({s.iz} A)</span>
                <button className="ml-auto text-destructive" onClick={() => set({ buses: buses.filter(x => x.id !== b.id) })}>🗑</button>
              </div>
              <CircuitPicker rows={rows} ids={b.circuitIds} onToggle={cid => toggleBus(b.id, cid)} taken={cid => buses.find(o => o.id !== b.id && o.circuitIds.includes(cid))?.name} />
            </div>
          );
        })}
      </div>

      {/* Comando e AVAC */}
      <div className={card}>
        <div className={h}>🎛 Comando e automação</div>
        {(["Comando", "AVAC"] as const).map(g => (
          <div key={g} className="mb-2 flex flex-wrap items-center gap-1">
            <span className="w-20 text-xs font-semibold text-muted-foreground">{g === "AVAC" ? "AVAC" : "Iluminação"}</span>
            {(Object.keys(CONTROL_INFO) as ControlKind[]).filter(k => CONTROL_INFO[k].group === g).map(k => <button key={k} className={qbtn} onClick={() => addCtl(k)}>+ {CONTROL_INFO[k].name}</button>)}
          </div>
        ))}
        {controls.map(m => {
          const info = CONTROL_INFO[m.kind];
          return (
            <div key={m.id} className="mb-2 rounded border border-border p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input className={`${sel} w-16 font-bold`} value={m.label} onChange={ev => patchCtl(m.id, { label: ev.target.value })} />
                <span className="font-semibold">{info.name}</span>
                Entradas <input type="number" min={0} className={`${sel} w-12`} value={m.inputs} onChange={ev => patchCtl(m.id, { inputs: Math.max(0, +ev.target.value) })} />
                Saídas <input type="number" min={0} className={`${sel} w-12`} value={m.outputs} onChange={ev => patchCtl(m.id, { outputs: Math.max(0, +ev.target.value) })} />
                {m.kind === "VSD" || m.kind === "DDC" ? "Analógicas" : "Auxiliares"} <input type="number" min={0} className={`${sel} w-12`} value={m.aux} onChange={ev => patchCtl(m.id, { aux: Math.max(0, +ev.target.value) })} />
                <select className={sel} value={m.coilV} onChange={ev => patchCtl(m.id, { coilV: +ev.target.value as 230 | 24 })}><option value={230}>230 V</option><option value={24}>24 V</option></select>
                <span className="text-muted-foreground">{m.circuitIds.length} circ.</span>
                <button className={qbtn} onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? "Fechar" : "Circuitos / bornes"}</button>
                <button className="text-destructive" onClick={() => set({ controls: controls.filter(x => x.id !== m.id) })}>🗑</button>
              </div>
              {open === m.id && (
                <>
                  <div className="mt-1 text-[11px] text-muted-foreground">{info.hint}</div>
                  <CircuitPicker rows={rows} ids={m.circuitIds} onToggle={cid => toggleCtl(m.id, cid)} />
                  <div className="mt-2 flex flex-wrap gap-1">{terminals(m).map((t, i) => <span key={i} className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px]">X1:{m.label}.{t}</span>)}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
