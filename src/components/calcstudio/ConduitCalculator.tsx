import { useMemo, useState } from "react";
import {
  computeConduit, STD_CONDUITS, CABLE_KINDS, sectionsFor, odFor,
  type ConduitCable, type CableKind,
} from "@/lib/calc/conduit";

interface Row {
  id: string;
  kind: CableKind;
  section: number;
  count: string;
}

export function ConduitCalculator({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([
    { id: crypto.randomUUID(), kind: "H07V-K", section: 2.5, count: "3" },
  ]);

  const cables: ConduitCable[] = useMemo(
    () => rows.map(r => ({ kind: r.kind, section: r.section, count: parseInt(r.count) || 0 })),
    [rows],
  );
  const result = useMemo(() => computeConduit(cables), [cables]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows(rs => rs.map(r => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      if (patch.kind) {
        const secs = sectionsFor(patch.kind);
        if (!secs.includes(next.section)) next.section = secs[0];
      }
      return next;
    }));
  }
  function addRow() {
    setRows(rs => [...rs, { id: crypto.randomUUID(), kind: "H07V-K", section: 2.5, count: "1" }]);
  }
  function removeRow(id: string) {
    setRows(rs => rs.filter(r => r.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[color:var(--brand-blue)]/40 bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Aba Oculta</div>
            <h2 className="text-lg font-bold text-[color:var(--brand-blue)]">Cálculo da Secção de Tubagem Eléctrica</h2>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-[color:var(--surface-2)]">Fechar ✕</button>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          Método por taxa de enchimento (≤53% 1 condutor, ≤31% 2 condutores, ≤40% 3 ou mais).
          Introduza os condutores que passam dentro do mesmo tubo.
        </p>

        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-end gap-2">
              <label className="w-44 text-[10px] uppercase tracking-wider text-muted-foreground">
                Tipo de cabo
                <select
                  value={r.kind}
                  onChange={e => updateRow(r.id, { kind: e.target.value as CableKind })}
                  className="mt-1 w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm text-foreground"
                >
                  {CABLE_KINDS.map(k => <option key={k.v} value={k.v}>{k.label}</option>)}
                </select>
              </label>
              <label className="flex-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Secção do condutor
                <select
                  value={r.section}
                  onChange={e => updateRow(r.id, { section: Number(e.target.value) })}
                  className="mt-1 w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm text-foreground"
                >
                  {sectionsFor(r.kind).map(s => <option key={s} value={s}>{s} mm² (Ø ext. {odFor(r.kind, s)} mm)</option>)}
                </select>
              </label>
              <label className="w-24 text-[10px] uppercase tracking-wider text-muted-foreground">
                Nº condutores
                <input
                  type="number" min="1"
                  value={r.count}
                  onChange={e => updateRow(r.id, { count: e.target.value })}
                  className="mt-1 w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <button onClick={() => removeRow(r.id)} className="rounded border border-destructive/40 px-2 py-1.5 text-destructive hover:bg-destructive/10">×</button>
            </div>
          ))}
        </div>


        <button onClick={addRow} className="mt-3 rounded-md border border-[color:var(--brand-green)]/50 px-3 py-1.5 text-sm text-[color:var(--brand-green)] hover:bg-[color:var(--brand-green)]/10">
          + Adicionar condutor
        </button>

        <div className="mt-5 rounded-md border border-border bg-[color:var(--surface-1)] p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <KV k="Total de condutores" v={String(result.totalConductors)} />
            <KV k="Taxa de enchimento adm." v={`${(result.fillRatio * 100).toFixed(0)} %`} />
            <KV k="Área dos condutores" v={`${result.cableArea.toFixed(1)} mm²`} />
            <KV k="Secção interior mínima" v={`${result.requiredInner.toFixed(1)} mm²`} />
          </div>
          <div className="mt-3 rounded-md border border-[color:var(--brand-blue)]/40 bg-[color:var(--brand-blue)]/10 p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tubo Recomendado</div>
            {result.conduitNominal ? (
              <div className="text-2xl font-bold text-[color:var(--brand-blue)]">
                Ø {result.conduitNominal} mm
                <span className="ml-2 text-sm font-normal text-muted-foreground">(enchimento {result.actualFill.toFixed(0)}%)</span>
              </div>
            ) : (
              <div className="text-sm text-destructive">Sem tubo normalizado adequado — dividir cabos por mais tubos.</div>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.errors.map((e, i) => (
                <div key={i} className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">{e}</div>
              ))}
            </div>
          )}
        </div>

        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Tubos normalizados considerados</summary>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {STD_CONDUITS.map(t => (
              <span key={t.nominal}>Ø{t.nominal} (int. {t.inner}mm)</span>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
