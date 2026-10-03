// Gestão de diferenciais: criar DR, escolher circuitos protegidos e ver a verificação
import type { Circuit, CalcResult } from "@/lib/calc/engine";
import { checkRCD, RCD_RATINGS, RCD_SENS, type RCD } from "@/lib/calc/rcd";

type Row = { c: Circuit; r: CalcResult };
const sel = "rounded border border-border bg-[color:var(--surface-2)] px-1 py-1 text-xs";

export function RCDManager({ rcds, rows, onChange }: { rcds: RCD[]; rows: Row[]; onChange: (r: RCD[]) => void }) {
  const add = () => {
    const anyTri = rows.some(x => x.c.phase === "Tri");
    onChange([...rcds, { id: crypto.randomUUID(), label: `DR${rcds.length + 1}`, inA: 40, iAnmA: 30, poles: anyTri ? 4 : 2, kind: "A", circuitIds: [] }]);
  };
  const patch = (id: string, p: Partial<RCD>) => onChange(rcds.map(d => d.id === id ? { ...d, ...p } : d));
  const toggle = (id: string, cid: string) => onChange(rcds.map(d => {
    if (d.id === id) return { ...d, circuitIds: d.circuitIds.includes(cid) ? d.circuitIds.filter(x => x !== cid) : [...d.circuitIds, cid] };
    return { ...d, circuitIds: d.circuitIds.filter(x => x !== cid) }; // um circuito só pode estar num DR
  }));
  const free = rows.filter(x => !rcds.some(d => d.circuitIds.includes(x.c.id)));

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={add} className="rounded-md bg-[color:var(--brand-green)] px-3 py-1.5 text-sm font-semibold text-primary-foreground">+ Adicionar diferencial</button>
        <span className="text-xs text-muted-foreground">Escolha o diferencial e marque os circuitos que ele protege. A verificação é automática.</span>
        {free.length > 0 && <span className="text-xs text-warning">{free.length} circuito(s) sem diferencial</span>}
      </div>
      {rcds.length === 0 && <div className="rounded border border-border p-4 text-sm text-muted-foreground">Ainda não há diferenciais neste quadro.</div>}
      {rcds.map(d => {
        const k = checkRCD(d, rows);
        return (
          <div key={d.id} className={`rounded-lg border p-3 ${k.ok ? (k.warnings.length ? "border-warning/60" : "border-[color:var(--brand-green)]/60") : "border-destructive/60"} bg-card`}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input value={d.label} onChange={e => patch(d.id, { label: e.target.value })} className={`${sel} w-28 font-bold`} />
              <select className={sel} value={d.inA} onChange={e => patch(d.id, { inA: +e.target.value })}>{RCD_RATINGS.map(v => <option key={v} value={v}>{v} A</option>)}</select>
              <select className={sel} value={d.iAnmA} onChange={e => patch(d.id, { iAnmA: +e.target.value })}>{RCD_SENS.map(v => <option key={v} value={v}>{v} mA</option>)}</select>
              <select className={sel} value={d.poles} onChange={e => patch(d.id, { poles: +e.target.value as 2 | 4 })}><option value={2}>2P (mono)</option><option value={4}>4P (tri)</option></select>
              <select className={sel} value={d.kind} onChange={e => patch(d.id, { kind: e.target.value as RCD["kind"] })}>{["AC", "A", "F", "B"].map(v => <option key={v} value={v}>Tipo {v}</option>)}</select>
              <span className="ml-auto font-mono">ΣIb {k.ibSum.toFixed(1)} A / {d.inA} A</span>
              <b className={k.ok ? "text-[color:var(--brand-green)]" : "text-destructive"}>{k.ok ? (k.warnings.length ? "✓ Correto (com avisos)" : "✓ Correto") : "✗ Incorreto"}</b>
              {k.suggestion && <button className="rounded border border-border px-2 py-0.5" onClick={() => patch(d.id, { inA: k.suggestion! })}>Aplicar {k.suggestion} A</button>}
              <button className="text-destructive" onClick={() => onChange(rcds.filter(x => x.id !== d.id))}>🗑</button>
            </div>
            {(k.issues.length > 0 || k.warnings.length > 0) && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {k.issues.map((m, i) => <li key={i} className="text-destructive">✗ {m}</li>)}
                {k.warnings.map((m, i) => <li key={i} className="text-warning">⚠ {m}</li>)}
              </ul>
            )}
            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ c, r }, i) => {
                const other = rcds.find(o => o.id !== d.id && o.circuitIds.includes(c.id));
                return (
                  <label key={c.id} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${d.circuitIds.includes(c.id) ? "bg-[color:var(--brand-green)]/15" : "hover:bg-[color:var(--surface-2)]"}`}>
                    <input type="checkbox" checked={d.circuitIds.includes(c.id)} onChange={() => toggle(d.id, c.id)} />
                    <span className="flex-1 truncate">C{i + 1} {c.name}</span>
                    <span className="text-muted-foreground">{r.ib.toFixed(1)} A · {c.phase === "Tri" ? "3F" : c.phaseAssign ?? "L1"}</span>
                    {other && <span className="text-[10px] text-muted-foreground">({other.label})</span>}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
