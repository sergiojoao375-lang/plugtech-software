import { useEffect, useMemo, useRef, useState } from "react";
import { LogoST } from "./Logo";
import {
  type Circuit, type Material, type Phase, type InstallScenario, type CircuitType,
  computeCircuit, feederDeltaU, phaseImbalance, balancePhases, pickMainDevice, panelIccKA,
  FEEDER_SECTIONS, type FeederContext,
} from "@/lib/calc/engine";
import { loadState, saveState, emptyProject, saveProjectFile, loadProjectFile, type AppState, type Panel, type ProjectInfo } from "@/lib/calc/storage";
import { exportCSV, exportPDF, exportCascadePDF } from "@/lib/calc/export";
import { ConduitCalculator } from "./ConduitCalculator";
import { statusColors, classify, type Status } from "./status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const CIRCUIT_TYPES: CircuitType[] = ["Iluminacao", "Tomadas", "AC", "Termoacumulador", "PlacaCozinha", "UAC"];
const SCENARIOS: { v: InstallScenario; label: string }[] = [
  { v: "Enterrado", label: "Enterrado no Solo (D)" },
  { v: "Embutido",  label: "Embutido em Parede (A)" },
  { v: "Calha",     label: "Calha/Caminho Perfurado (E)" },
  { v: "ArLivre",   label: "Ao Ar Livre (E/F)" },
];
const CABLE_TYPES = ["H07V-K", "H07V-R", "XV", "XZ1", "FVV"];
const CABLE_TYPES_CU = CABLE_TYPES;
const CABLE_TYPES_AL = ["LSV / LV", "LSVAV / LXAV"];

interface Draft {
  id?: string;
  name: string;
  power: string;
  powerUnit: "W" | "kW";
  length: string;
  cosphi: string;
  type: CircuitType;
  cable: string;
  material: Material;
  scenario: InstallScenario;
  phase: Phase;
}
const emptyDraft = (): Draft => ({
  name: "", power: "", powerUnit: "W", length: "", cosphi: "0.95",
  type: "Tomadas", cable: "", material: "Cu", scenario: "Embutido", phase: "Mono",
});

export default function CalcStudio() {
  //localStorage.clear();
  const [state, setState] = useState<AppState>({ panels: [], activePanelId: null, project: emptyProject() });
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [selectedCircuitId, setSelectedCircuitId] = useState<string | null>(null);
  const [showPanelMgr, setShowPanelMgr] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [showObra, setShowObra] = useState(false);
  const [showConduit, setShowConduit] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();

  useEffect(() => { setState(loadState()); }, []);
  useEffect(() => { if (state.panels.length) saveState(state); }, [state]);

  // Tenta carregar logo.png
  useEffect(() => {
    fetch("/logo.png").then(r => r.ok ? r.blob() : null).then(b => {
      if (!b) return;
      const fr = new FileReader();
      fr.onload = () => setLogoDataUrl(fr.result as string);
      fr.readAsDataURL(b);
    }).catch(() => {});
  }, []);

  const panel = state.panels.find(p => p.id === state.activePanelId) ?? state.panels[0];

  function updatePanel(patch: Partial<Panel>) {
    if (!panel) return;
    setState(s => ({ ...s, panels: s.panels.map(p => p.id === panel.id ? { ...p, ...patch } : p) }));
  }

  function setCircuits(circuits: Circuit[]) { updatePanel({ circuits }); }

  function addOrUpdateCircuit() {
    if (!panel) return;
    const power = parseFloat(draft.power.replace(",", ".")) || 0;
    const length = parseFloat(draft.length.replace(",", ".")) || 0;
    const cosphi = parseFloat(draft.cosphi.replace(",", ".")) || 0.95;
    if (!draft.name || !power || !length) return;
    const c: Circuit = {
      id: draft.id ?? crypto.randomUUID(),
      name: draft.name,
      power: draft.powerUnit === "kW" ? power * 1000 : power,
      length, cosphi, type: draft.type, cable: draft.cable, material: draft.material,
      scenario: draft.scenario, phase: draft.phase,
    };
    if (draft.id) {
      setCircuits(panel.circuits.map(x => x.id === draft.id ? { ...x, ...c } : x));
    } else {
      setCircuits([...panel.circuits, c]);
    }
    setDraft(emptyDraft());
    setSelectedCircuitId(null);
  }

  function editCircuit(c: Circuit) {
    setDraft({
      id: c.id, name: c.name,
      power: String(c.power >= 1000 ? c.power / 1000 : c.power),
      powerUnit: c.power >= 1000 ? "kW" : "W",
      length: String(c.length), cosphi: String(c.cosphi),
      type: c.type, cable: c.cable, material: c.material ?? "Cu", scenario: c.scenario, phase: c.phase,
    });
    setSelectedCircuitId(c.id);
  }

  function deleteCircuit(id: string) {
    if (!panel) return;
    setCircuits(panel.circuits.filter(c => c.id !== id));
    if (selectedCircuitId === id) { setSelectedCircuitId(null); setDraft(emptyDraft()); }
  }

  function createNewPanel() {
    const id = crypto.randomUUID();
    const idx = state.panels.length + 1;
    const np: Panel = {
      id, name: `Q.E${idx}`, origin: panel?.name ?? "PT/QGE",
      feederMaterial: "Cu", feederSection: 10, feederLength: 15,
      iccOriginKA: panel?.iccOriginKA ?? 6, voltageMono: 230, voltageTri: 400,
      phase: "Tri", cosphi: 0.95, circuits: [],
    };
    setState(s => ({ ...s, panels: [...s.panels, np], activePanelId: id }));
  }

  function deletePanel() {
    if (!panel || state.panels.length <= 1) return;
    if (!confirm(`Eliminar o quadro ${panel.name}?`)) return;
    const rem = state.panels.filter(p => p.id !== panel.id);
    setState(s => ({ ...s, panels: rem, activePanelId: rem[0]?.id ?? null }));
  }

  //--minha--function doBalance() {
  //--minha--  if (!panel) return;
  //--minha--  setCircuits(balancePhases(panel.circuits));
  //}
  function doBalance() {
  if (!panel) return;
  
  // 1. Executa o algoritmo de equilíbrio do motor de cálculo
  const balancedCircuits = balancePhases(panel.circuits);
  
  // 2. Atualiza o estado global mapeando os painéis e injetando os circuitos equilibrados no painel ativo
  setState(s => ({
    ...s,
    panels: s.panels.map(p => 
      p.id === panel.id ? { ...p, circuits: balancedCircuits } : p
    )
  }));
}


  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateProject(patch: Partial<ProjectInfo>) {
    setState(s => ({ ...s, project: { ...s.project, ...patch } }));
  }

  function handleOpenFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    loadProjectFile(f)
      .then(s => { setState(s); setSelectedCircuitId(null); setDraft(emptyDraft()); })
      .catch(() => alert("Não foi possível abrir o ficheiro de projeto."));
    e.target.value = "";
  }

  // --- Cálculos derivados ---
  const ctx: FeederContext | null = useMemo(() => {
    if (!panel) return null;
    const totalIb = panel.circuits.reduce((acc, c) => {
      const s = c.power / Math.max(0.1, c.cosphi || 1);
      return acc + (c.phase === "Tri" ? s / (Math.sqrt(3) * panel.voltageTri) : s / panel.voltageMono);
    }, 0);
    const fdU = feederDeltaU({
      totalCurrentA: totalIb, cosphi: panel.cosphi, length: panel.feederLength,
      section: panel.feederSection, material: panel.feederMaterial, phase: panel.phase,
      voltageMono: panel.voltageMono, voltageTri: panel.voltageTri,
    });
    return {
      iccOriginKA: panel.iccOriginKA, feederMaterial: panel.feederMaterial,
      feederSection: panel.feederSection, feederLength: panel.feederLength,
      feederDeltaU: fdU, voltageMono: panel.voltageMono, voltageTri: panel.voltageTri,
      isQGE: panel.panelKind === "QGE",
    };
  }, [panel]);

  const computed = useMemo(() => {
    if (!panel || !ctx) return [];
    return panel.circuits.map(c => ({ c, r: computeCircuit(c, ctx) }));
  }, [panel, ctx]);

  //--minha--const totals = useMemo(() => {
  //--minha--  if (!panel) return { p: 0, ib: 0, cutNeed: 0, modules: 0, cut: "—", mainRating: 0 };
  //--minha--  const p = panel.circuits.reduce((a, x) => a + x.power, 0);
  //--minha--  const ib = panel.phase === "Tri"
  //--minha--    ? p / (Math.sqrt(3) * panel.voltageTri * panel.cosphi)
  //--minha--    : p / (panel.voltageMono * panel.cosphi);
  // CÓDIGO CORRIGIDO PARA A FASE MAIS CARREGADA:
const totals = useMemo(() => {
  if (!panel || !computed || computed.length === 0) return { p: 0, ib: 0, cutNeed: 0, modules: 0, cut: "—", mainRating: 0 };
  const p = panel.circuits.reduce((a, x) => a + x.power, 0);
  
  // Criamos um acumulador para somar as correntes reais calculadas pelo motor para cada fase
  const phaseCurrents = { L1: 0, L2: 0, L3: 0 };
  
    computed.forEach(({ c, r }) => {
    // PROTEÇÃO: Corrige automaticamente se a fase vier como 'In' ou estiver corrompida no formulário
    const realPhase = (c.type === "PlacaCozinha" || c.power >= 6000) ? "Tri" : c.phase;

    if (realPhase === "Tri") {
      phaseCurrents.L1 += r.ib;
      phaseCurrents.L2 += r.ib;
      phaseCurrents.L3 += r.ib;
    } else {
      const phase = c.phaseAssign || "L1";
      if (phase === "L1") phaseCurrents.L1 += r.ib;
      if (phase === "L2") phaseCurrents.L2 += r.ib;
      if (phase === "L3") phaseCurrents.L3 += r.ib;
    }
  });


  // O Ib do rodapé passa a ser o valor máximo da fase mais carregada
  const ib = Math.max(phaseCurrents.L1, phaseCurrents.L2, phaseCurrents.L3);

    const cutNeed = ib * 1.25;
    const modules = Math.ceil((panel.circuits.reduce((a, c) => a + (c.phase === "Tri" ? 3 : 2), 4)) * 1.2);
    const mainRating = pickMainDevice(cutNeed);
    const device = cutNeed > 100 ? "Fusíveis gG" : "Interruptor";
    const cut = `${device} ${mainRating}A`;
    return { p, ib, cutNeed, modules, cut, mainRating };
  }, [panel]);


  const imb = useMemo(() => panel ? phaseImbalance(panel.circuits) : null, [panel]);

  // Estados de alerta (OK / quase a exceder / crítico)
  // Feeder: limite recomendado 1,5% (crítico), laranja quando ≥ 1,2% (quase a exceder)
  const feederStatus: Status = ctx ? classify(ctx.feederDeltaU, 1.2, 1.5) : "ok";
  const imbStatus: Status = imb
    ? (imb.pct >= 15 ? "critical" : imb.pct >= 10 ? "warn" : "ok")
    : "ok";

  const selected = computed.find(x => x.c.id === selectedCircuitId);


  if (!panel) return <div className="p-8">A carregar…</div>;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* ===== HEADER FIXO ===== */}
      <header className="sticky top-0 z-30 border-b border-border bg-[color:var(--surface-1)]/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2">
          <div onDoubleClick={() => setShowConduit(true)} title="Estúdio PLUGTECH" className="cursor-pointer select-none">
            {logoDataUrl
              ? <img src={logoDataUrl} alt="SérgioTech" className="h-9 w-9 rounded" />
              : <LogoST size={36} />}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">Quadro:</label>
            <select
              value={panel.id}
              onChange={e => setState(s => ({ ...s, activePanelId: e.target.value }))}
              className="rounded-md border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm"
            >
              {state.panels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={createNewPanel} className="rounded-md bg-[color:var(--brand-green)] px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-110">+ Novo Quadro</button>
            <button onClick={deletePanel} className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10">Eliminar</button>
            <button onClick={() => setShowPanelMgr(s => !s)} title="Configuração do quadro" className="rounded-md border border-border px-2 py-1.5 text-sm hover:bg-[color:var(--surface-2)]">⚙</button>
            
            <button onClick={() => setShowConduit(true)} title="Calculadora de secção de tubagem" className="rounded-md border border-[color:var(--brand-green)]/60 px-3 py-1.5 text-sm text-[color:var(--brand-green)] hover:bg-[color:var(--brand-green)]/10">Tubagem</button>
            <button onClick={() => setShowObra(true)} title="Dados da obra e responsável" className="rounded-md border border-[color:var(--brand-blue)]/60 px-3 py-1.5 text-sm text-[color:var(--brand-blue)] hover:bg-[color:var(--brand-blue)]/10">📋 Obra</button>
            <button onClick={() => saveProjectFile(state)} title="Guardar projeto em ficheiro" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-[color:var(--surface-2)]">💾 Guardar</button>
            <button onClick={() => fileInputRef.current?.click()} title="Abrir projeto de ficheiro" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-[color:var(--surface-2)]">📂 Abrir</button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleOpenFile} />
            <button onClick={() => exportCSV(panel)} className="rounded-md border border-[color:var(--brand-blue)]/50 px-3 py-1.5 text-sm hover:bg-[color:var(--brand-blue)]/10">CSV</button>
            <button onClick={() => exportPDF(state.panels, panel.id, { logoDataUrl, project: state.project })} className="rounded-md bg-[color:var(--brand-blue)] px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:brightness-110">PDF</button>
            <button onClick={() => exportCascadePDF(state.panels, { logoDataUrl, project: state.project })} title="Diagrama geral em cascata de todos os quadros" className="rounded-md bg-[color:var(--brand-green)] px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-110">PDF Cascata</button>
            <button onClick={() => setShowAbout(s => !s)} className="rounded-md border border-border px-2 py-1.5 text-sm">Sobre</button>
          </div>
        </div>

        {showPanelMgr && (
          <div className="border-t border-border bg-[color:var(--surface-2)]/60 px-4 py-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr]">
              {/* Topologia vertical: Origem -> Atual */}
              <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground"></div>
                              {/* BLOCO REORGANIZADO EM 2X2 */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs mt-2">
                
                {/* Linha 1 - Coluna 1 (Superior Esquerda) */}
                <label className="flex flex-col">
                  <span className="text-gray-400 font-medium">Origem da Alimentação</span>
                  <select 
                    value={(panel as any).supplyType ?? "Rede"} 
                    onChange={e => updatePanel({ supplyType: e.target.value })}
                    className="mt-1 w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm"
                  >
                    <option value="Rede">Rede Pública</option>
                    <option value="PT">PT Privado</option>
                  </select>
                </label>

                {/* Linha 1 - Coluna 2 (Superior Direita) */}
                <label className="flex flex-col">
                  <span className="text-gray-400 font-medium">Quadro de Origem (Montante)</span>
                  <input
                    type="text"
                    list="origins"
                    value={panel.origin ?? ""}
                    onChange={e => updatePanel({ origin: e.target.value })}
                    className="mt-1 w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm"
                    placeholder="PT/QGE ou outro quadro"
                  />
                  <datalist id="origins">
                    <option value="PT/QGE" />
                    {state.panels.filter(p => p.id !== panel.id).map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                </label>

                {/* Linha 2 - Coluna 1 (Inferior Esquerda) */}
                <label className="flex flex-col">
                  <span className="text-gray-400 font-medium">Icc origem (kA)</span>
                  <select 
                    value={panel.iccOriginKA}
                    onChange={e => updatePanel({ iccOriginKA: parseFloat(e.target.value) })}
                    className="mt-1 w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm"
                  >
                    {[3, 6, 10, 15, 20, 25, 35, 36, 50, 65, 70, 100].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>

                {/* Linha 2 - Coluna 2 (Inferior Direita) */}
                <label className="flex flex-col">
                  <span className="text-gray-400 font-medium">Sistema</span>
                  <select 
                    value={panel.phase}
                    onChange={e => updatePanel({ phase: e.target.value as Phase, voltageMono: 230, voltageTri: 400 })}
                    className="mt-1 w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm"
                  >
                    <option value="Mono">Monofásico (230 V)</option>
                    <option value="Tri">Trifásico (400 V)</option>
                  </select>
                </label>

              </div>


              </div>

              {/* Canalização de interligação */}
              <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[color:var(--brand-green)]/40 bg-[color:var(--surface-1)] p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Linha de Interligação</div>
                <div className="flex items-center gap-1 text-2xl text-[color:var(--brand-green)]">↓</div>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <select value={panel.feederMaterial} onChange={e => updatePanel({ feederMaterial: e.target.value as Material })}
                    className="rounded border border-border bg-[color:var(--surface-2)] px-2 py-1">
                    <option value="Cu">Cobre</option><option value="Al">Alumínio</option>
                  </select>
                  <select value={panel.feederSection} onChange={e => updatePanel({ feederSection: +e.target.value })}
                    className="rounded border border-border bg-[color:var(--surface-2)] px-2 py-1">
                    {FEEDER_SECTIONS.map(s => <option key={s} value={s}>{s} mm²</option>)}
                  </select>
                  <input type="number" step="0.1" value={panel.feederLength} onChange={e => updatePanel({ feederLength: +e.target.value || 0 })}
                    className="col-span-2 rounded border border-border bg-[color:var(--surface-2)] px-2 py-1" placeholder="L (m)" />
                </div>
                {ctx && (
                  <div className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusColors(feederStatus).chip}`}>
                    ΔU feeder: {ctx.feederDeltaU.toFixed(2)}%
                    {" · "}
                    {feederStatus === "ok" ? "OK" : feederStatus === "warn" ? "Quase a exceder" : "CRÍTICO"}
                  </div>
                )}
              </div>

              {/* Quadro atual */}
              <div className="flex flex-col gap-2 rounded-md border border-[color:var(--brand-blue)]/40 bg-card p-3 glow-blue">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Quadro Atual</div>
                <input value={panel.name} onChange={e => updatePanel({ name: e.target.value })}
                  className="rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm font-semibold" />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label>Cos φ global
                    <input type="number" step="0.01" min="0.1" max="1" value={panel.cosphi}
                      onChange={e => updatePanel({ cosphi: +e.target.value || 0.95 })}
                      className="mt-1 w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1" />
                  </label>
                                    <label>Tipo de Quadro
                    <select value={panel.panelKind ?? "QE"} onChange={e => updatePanel({ panelKind: e.target.value as "QE" | "QGE" })}
                      className="mt-1 w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1">
                      <option value="QE">Q.Parcial (Q.E.)</option>
                      <option value="QGE">Quadro Geral (QGE)</option>
                    </select>
                  </label>
                  

                </div>
                <div className="rounded-md border border-[color:var(--brand-green)]/40 bg-[color:var(--surface-2)] px-2 py-1 text-[10px] font-semibold text-[color:var(--brand-green)]">
                  Icc no barramento: {panelIccKA(panel).toFixed(1)} kA
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Formulário horizontal de circuito */}
        <div className="border-t border-border bg-[color:var(--surface-1)] px-3 py-2">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Nome do Circuito" w="180px">
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm" placeholder="Ex: Iluminação Sala"/>
            </Field>
            <Field label="Potência" w="140px">
              <div className="flex">
                <input value={draft.power} onChange={e => setDraft(d => ({ ...d, power: e.target.value }))}
                  className="w-full rounded-l border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm" placeholder="0"/>
                <select value={draft.powerUnit} onChange={e => setDraft(d => ({ ...d, powerUnit: e.target.value as "W"|"kW" }))}
                  className="rounded-r border border-l-0 border-border bg-[color:var(--surface-2)] px-1 text-sm">
                  <option>W</option><option>kW</option>
                </select>
              </div>
            </Field>
            <Field label="L (m)" w="80px">
              <input value={draft.length} onChange={e => setDraft(d => ({ ...d, length: e.target.value }))}
                className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm"/>
            </Field>
            <Field label="Cos φ" w="80px">
              <input value={draft.cosphi} onChange={e => setDraft(d => ({ ...d, cosphi: e.target.value }))}
                className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm"/>
            </Field>
            <Field label="Tipo de Circuito" w="160px">
              <select value={draft.type} onChange={e => {
                const type = e.target.value as CircuitType;
                // UAC/AC (Ar Condicionado): cos φ típico 0.80–0.85 (motores/compressores) e Curva D automática.
                const isAC = type === "UAC" || type === "AC";
                setDraft(d => ({ ...d, type, cosphi: isAC ? "0.85" : d.cosphi }));
              }}
                className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm">
                {CIRCUIT_TYPES.map(t => <option key={t} value={t}>{labelType(t)}</option>)}
              </select>
            </Field>

            {panel.panelKind === "QGE" && (
              <Field label="Material" w="120px">
                <select value={draft.material} onChange={e => {
                  const material = e.target.value as Material;
                  const list = material === "Al" ? CABLE_TYPES_AL : CABLE_TYPES_CU;
                  setDraft(d => ({ ...d, material, cable: list.includes(d.cable) ? d.cable : list[0] }));
                }}
                  className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm">
                  <option value="Cu">Cobre</option>
                  <option value="Al">Alumínio</option>
                </select>
              </Field>
            )}
            <Field label={`Tipo de Cabo (${draft.material === "Al" ? "Alumínio" : "Cobre"})`} w="150px">
              <select value={draft.cable} onChange={e => setDraft(d => ({ ...d, cable: e.target.value }))}
                className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm">
                {(panel.panelKind === "QGE" && draft.material === "Al" ? CABLE_TYPES_AL : CABLE_TYPES_CU).map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Cenário de Instalação" w="220px">
              <select value={draft.scenario} onChange={e => setDraft(d => ({ ...d, scenario: e.target.value as InstallScenario }))}
                className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm">
                {SCENARIOS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Fase" w="100px">
              <select value={draft.phase} onChange={e => setDraft(d => ({ ...d, phase: e.target.value as Phase }))}
                className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm">
                <option value="Mono">Mono</option><option value="Tri">Trifásico</option>
              </select>
            </Field>
            <button onClick={addOrUpdateCircuit}
              className="rounded-md bg-[color:var(--brand-green)] px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 glow-green">
              {draft.id ? "Atualizar Circuito" : "+ Adicionar Circuito"}
            </button>
            {draft.id && (
              <button onClick={() => { setDraft(emptyDraft()); setSelectedCircuitId(null); }}
                className="rounded-md border border-border px-3 py-2 text-sm">Cancelar</button>
            )}
            <button onClick={doBalance}
              className="ml-auto rounded-md border border-[color:var(--brand-blue)]/60 px-3 py-2 text-sm text-[color:var(--brand-blue)] hover:bg-[color:var(--brand-blue)]/10">
              ⚡ Equilíbrio de Fases Automático
            </button>
          </div>
        </div>

      </header>

      <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />

      <ObraDialog open={showObra} onClose={() => setShowObra(false)} project={state.project} onChange={updateProject} />


      {/* ===== TABELA CENTRAL (SCROLL VERTICAL) ===== */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-xs">
            <thead className="sticky top-0 z-10 bg-[color:var(--surface-2)] text-foreground">
              <tr>
                {["#","Circuito","Tipo","Fase","P(W)","S(VA)","Ib(A)","In(A)","Curva","Secção","Iz(A)","ΔU%","Icc(kA)","Mód","Ações"].map(h =>
                  <th key={h} className="border-b border-border px-2 py-2 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {computed.length === 0 && (
                <tr><td colSpan={15} className="p-12 text-center text-muted-foreground">Sem circuitos. Adicione um circuito acima ↑</td></tr>
              )}
              {computed.map(({ c, r }, i) => {
                const hasErr = r.errors.length > 0;
                const hasWarn = r.warnings.length > 0;
                const sel = selectedCircuitId === c.id;
                const totalDU = ctx!.feederDeltaU + r.deltaU;

                // ΔU terminal: crítico > 4% (vermelho), quase a exceder ≥ 3.2% (laranja)
                //--minha--const duStatus: Status = classify(totalDU, 3.2, 4.0);
                // Define os limites dinâmicos de acordo com o Tipo de Circuito (Norma Europeia.)
                //const isLight = c.type === "Iluminacao";
                //const limitCritical = isLight ? 3.0 : 5.0; // 3% para iluminação, 5% para tomadas/outros
                //const limitWarn = limitCritical * 0.85;     // Alerta laranja dispara ao atingir 85% do limite máximo

                //const duStatus: Status = classify(totalDU, limitWarn, limitCritical);
                //const isLight = c.type === "Iluminacao";
                
                // Verifica se o quadro selecionado é um PT Privado (caso panel exista)
                // Se a variável se chamar activePanel, mude para activePanel?.panelKind
                //const isPT = panel?.panelKind === "PT" || panel?.panelType === "PT" || panel?.panelKind === "QGE"; 
                //const isPT = ctx?.isQGE === false || r.deltaU !== undefined && (ctx as any)?.panelKind === "PT";



                //let limitCritical = 5.0;
                //if (isPT) {
                //  limitCritical = isLight ? 6.0 : 8.0;
                //} else {
                //  limitCritical = isLight ? 3.0 : 5.0;
                //}

                //const limitWarn = isLight ? limitCritical * 0.95 : limitCritical * 0.85;
                //const duStatus: Status = classify(totalDU, limitWarn, limitCritical);

                const isLight = c.type === "Iluminacao";
                // CORREÇÃO: Lê diretamente o novo dropdown 'supplyType' criado no topo
                const isPT = (panel as any).supplyType === "PT";

                const limitCritical = isLight ? (isPT ? 6.0 : 3.0) : (isPT ? 8.0 : 5.0);


                //const isLight = c.type === "Iluminacao";
                //const isPT = ctx?.isQGE === false;
                //const limitCritical = isLight ? (isPT ? 6.0 : 3.0) : (isPT ? 8.0 : 5.0);
                const limitWarn = isLight ? limitCritical * 0.95 : limitCritical * 0.85;
                const duStatus: Status = classify(totalDU, limitWarn, limitCritical);



                const duClass = duStatus === "critical" ? "bg-destructive/30 text-destructive font-semibold"
                  : duStatus === "warn" ? "bg-warning/30 text-warning font-semibold" : "";
                // In: vermelho se subdimensionado (In < Ib) ou descoordenado (In > Iz)
                const isQGE = panel.panelKind === "QGE";
                const inUnder = r.in < r.ib || r.in > r.iz || (!isQGE && r.in > 40);

                // Iz: vermelho se cabo em sobrecarga (Ib > Iz)
                const izOver = r.ib > r.iz;
                return (
                                    <tr key={c.id}
                      onClick={() => editCircuit(c)}
                      className={`cursor-pointer border-b border-border/60 hover:bg-[color:var(--surface-2)] ${sel ? "bg-[color:var(--brand-blue)]/10" : ""}`}>
                    <td className="px-2 py-1.5">{i + 1}</td>
                    <td className="px-2 py-1.5 font-medium">{c.name}</td>
                    <td className="px-2 py-1.5">{labelType(c.type)}</td>
                    <td className="px-2 py-1.5">{c.phase}{c.phaseAssign ? `/${c.phaseAssign}` : ""}</td>
                    <td className="px-2 py-1.5">{c.power.toFixed(0)}</td>
                    <td className="px-2 py-1.5">{r.s.toFixed(0)}</td>
                    <td className="px-2 py-1.5">{r.ib.toFixed(2)}</td>
                    <td className={`px-2 py-1.5 ${inUnder ? "bg-destructive/30 text-destructive font-semibold" : ""}`} 
                        title={r.in < r.ib || r.in > r.iz ? "Disjuntor subdimensionado / descoordenado (Ib ≤ In ≤ Iz)" : (!isQGE && r.in > 40 ? "Calibre excede o limite máximo para Quadro Parcial (Máx. 40A)." : undefined)}>
                      {r.in}
                    </td>

                    <td className="px-2 py-1.5">{r.curve}</td>
                    <td className="px-2 py-1.5">{r.parallel > 1 ? `${r.parallel}×` : ""}{r.section} mm²{c.material === "Al" ? " Al" : ""}</td>
                    <td className={`px-2 py-1.5 ${izOver ? "bg-destructive/30 text-destructive font-semibold" : ""}`} title={izOver ? "Cabo em sobrecarga (Ib > Iz)" : undefined}>{r.iz}</td>
                    <td className={`px-2 py-1.5 ${duClass}`} title={`ΔU total ${totalDU.toFixed(2)}% (limite ${c.type === "Iluminacao" ? (isPT ? "6%" : "3%") : (isPT ? "8%" : "5%")})`}>{totalDU.toFixed(2)} %</td>
                    <td className="px-2 py-1.5">{r.iccTerm.toFixed(2)}</td>
                    <td className="px-2 py-1.5">{r.modules}</td>
                    <td className="px-2 py-1.5">
                      <button onClick={e => { e.stopPropagation(); deleteCircuit(c.id); }}
                        className="rounded border border-destructive/40 px-2 text-destructive hover:bg-destructive/10">×</button>
                    </td>
                  </tr>

                );
              })}

            </tbody>
          </table>
        </section>

        {/* Painel de diagnóstico */}
        {selected && (
          <aside className="w-full shrink-0 border-l border-border bg-card p-4 text-sm lg:w-80 lg:overflow-y-auto">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Diagnóstico Assistido</div>
            <h3 className="mb-3 text-base font-bold text-[color:var(--brand-green)]">{selected.c.name}</h3>
            <KV k="S" v={`${selected.r.s.toFixed(0)} VA`} />
            <KV k="Ib" v={`${selected.r.ib.toFixed(2)} A`} />
            <KV k="In sugerido" v={`${selected.r.in} A — Curva ${selected.r.curve}`} />
            <KV k="Secção" v={`${selected.r.parallel > 1 ? `${selected.r.parallel}×` : ""}${selected.r.section} mm² (${selected.c.material === "Al" ? "Al" : "Cu"})`} />
            {selected.r.parallel > 1 && <KV k="Condutores/fase" v={String(selected.r.parallel)} />}
            <KV k="Iz" v={`${selected.r.iz} A`} />
           
            <KV k={`ΔU total (Máx. ${selected.c.type === "Iluminacao" ? "3%" : "5%"})`} v={`${(ctx!.feederDeltaU + selected.r.deltaU).toFixed(2)} %`} />

            <KV k="Icc terminal" v={`${selected.r.iccTerm.toFixed(2)} kA`} />
            <KV k="Módulos DIN" v={String(selected.r.modules)} />
            <div className="mt-3 space-y-2">
              {selected.r.errors.map((e, i) => (
                <div key={i} className="rounded border border-destructive/50 bg-destructive/10 p-2 text-destructive-foreground"><b>Erro:</b> {e}</div>
              ))}
              {selected.r.warnings.map((w, i) => (
                <div key={i} className="rounded border border-warning/50 bg-warning/10 p-2"><b>Aviso:</b> {w}</div>
              ))}
              {imb && imb.pct > 15 && selected.c.phase === "Mono" && (
                <div className="rounded border border-warning/50 bg-warning/10 p-2"><b>Desequilíbrio crítico:</b> {imb.pct.toFixed(1)}% entre fases. Considere reequilibrar.</div>
              )}
              {selected.r.errors.length === 0 && selected.r.warnings.length === 0 && (
                <div className="rounded border border-[color:var(--brand-green)]/40 bg-[color:var(--brand-green)]/10 p-2 text-[color:var(--brand-green)]">✓ Circuito conforme RTIEBT.</div>
              )}
            </div>
          </aside>
        )}
      </main>

      {/* ===== RODAPÉ FIXO: APARELHAGEM + RESUMO ===== */}
      <footer className="sticky bottom-0 z-30 border-t border-border bg-[color:var(--surface-1)]/95 px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="P total" value={`${totals.p.toFixed(0)} W`} />
          <Stat label="Ib total" value={`${(() => {
            const phaseCurrents = { L1: 0, L2: 0, L3: 0 };
            computed.forEach(({ c, r }) => {
              if (c.phase === "Tri") {
                phaseCurrents.L1 += r.ib; phaseCurrents.L2 += r.ib; phaseCurrents.L3 += r.ib;
              } else {
                const phase = c.phaseAssign || "L1";
                if (phase === "L1") phaseCurrents.L1 += r.ib;
                if (phase === "L2") phaseCurrents.L2 += r.ib;
                if (phase === "L3") phaseCurrents.L3 += r.ib;
              }
            });
            return Math.max(phaseCurrents.L1, phaseCurrents.L2, phaseCurrents.L3).toFixed(1);
          })()} A`} />
          <Stat label="I dimens. (×1.25)" value={`${totals.cutNeed.toFixed(1)} A`} />
          <Stat label="Corte Geral" value={totals.cut} accent />
          <Stat label="Módulos DIN (+20%)" value={String(totals.modules)} />
        </div>
        {imb && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">Fases:</span>
            <span>L1 <b>{Math.round(imb.L1)}W</b></span>
            <span>L2 <b>{Math.round(imb.L2)}W</b></span>
            <span>L3 <b>{Math.round(imb.L3)}W</b></span>
            <span className={`rounded px-2 py-0.5 font-semibold ${statusColors(imbStatus).chip}`}>
              Desequilíbrio: {imb.pct.toFixed(1)}% · {imbStatus === "ok" ? "OK" : imbStatus === "warn" ? "Quase a exceder" : "CRÍTICO"}
            </span>
          </div>
        )}
      </footer>

      {showConduit && <ConduitCalculator onClose={() => setShowConduit(false)} />}
    </div>
  );
}

function Field({ label, children, w }: { label: string; children: React.ReactNode; w?: string }) {
  return (
    <div style={{ width: w, minWidth: w }}>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b border-border/40 py-1"><span className="text-muted-foreground">{k}</span><span className="font-semibold">{v}</span></div>;
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border border-border p-2 ${accent ? "bg-[color:var(--brand-green)]/10 border-[color:var(--brand-green)]/40" : "bg-card"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${accent ? "text-[color:var(--brand-green)]" : ""}`}>{value}</div>
    </div>
  );
}
function labelType(t: CircuitType) {
  return ({
    Iluminacao: "Iluminação", Tomadas: "Tomadas", AC: "Ar Condicionado",
    Termoacumulador: "Termoacumulador", PlacaCozinha: "Placa Cozinha", UAC: "UAC",
  } as Record<CircuitType, string>)[t];
}

type AboutBlock =
  | { kind: "text"; text: string }
  | { kind: "formula"; lines: { expr: string; note?: string }[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "note"; text: string };

type AboutTopic = { title: string; ref?: string; blocks: AboutBlock[] };

const ABOUT_TOPICS: AboutTopic[] = [
  {
    title: "1. Potência Aparente (S)",
    blocks: [
      { kind: "text", text: "Mede o impacto total da carga na rede, combinando a potência ativa com a componente reativa (indutiva). É a base para o cálculo da corrente." },
      { kind: "formula", lines: [{ expr: "S = (P · fator) / cos φ", note: "[VA]" }] },
      { kind: "table", head: ["Fator de majoração de arranque", "Valor"], rows: [
        ["Ar Condicionado / UAC", "1,25"],
        ["Restantes circuitos", "1,00"],
      ] },
      { kind: "note", text: "A app aplica um fator de majoração de arranque às cargas de Ar Condicionado e UAC (1,25). Por isso a corrente Ib destes circuitos é superior à que resultaria da potência nominal pura." },
    ],
  },
  {
    title: "2. Corrente de Projeto (Ib) e Dimens. Geral",
    blocks: [
      { kind: "text", text: "Intensidade de corrente que circulará continuamente pelos condutores em serviço normal." },
      { kind: "formula", lines: [
        { expr: "Ib = P / (V · cos φ)", note: "Monofásico 230 V  [A]" },
        { expr: "Ib = P / (√3 · V · cos φ)", note: "Trifásico 400 V  [A]" },
        { expr: "Ib_Total = max(I_L1, I_L2, I_L3)", note: "Fase Mais Carregada [A]" },
      ] },
      { kind: "note", text: "Nota de Engenharia: O Ib Total exibido no rodapé e no PDF baseia-se na fase real mais carregada (incluindo a parcela P/3 das cargas trifásicas). Adicionalmente, o cálculo do Corte Geral aplica um coeficiente normativo de segurança de 1.25 (Majorado a 25%) sobre este valor para proteger os barramentos contra sobrecargas localizadas e regimes transitórios." },
    ],
  },
  {
    title: "3. Coordenação de Proteções (Regra de Ouro)",
    ref: "RTIEBT 433 · IEC 60364",
    blocks: [
      { kind: "formula", lines: [{ expr: "Ib ≤ In ≤ Iz" }] },
      { kind: "text", text: "O disjuntor (In) deve aguentar a carga (Ib), mas deve disparar antes de o cabo aquecer demasiado (Iz). A app escolhe automaticamente o calibre normalizado ≥ Ib e a menor secção que garante Iz ≥ In. Para circuitos derivados de um QGE ou Q.Parcial, o motor respects as bitolas terminais regulamentares (1.5mm² para iluminação e 2.5mm² para tomadas)." },
    ],
  },
  {
    title: "4. Queda de Tensão Acumulada (ΔU%)",
    ref: "Norma Europeia · IEC 60364-5-52",
    blocks: [
      { kind: "formula", lines: [
        { expr: "ΔU = 2 · ρ · L · Ib · cos φ / S", note: "Monofásico" },
        { expr: "ΔU = √3 · ρ · L · Ib · cos φ / S", note: "Trifásico" },
        { expr: "ΔU% = (ΔU / V) · 100", note: "Percentagem" },
      ] },
      { kind: "table", head: ["Origem da Alimentação", "Iluminação", "Outros Usos"], rows: [
        ["Rede Pública (Padrão)", "Máx. 3.0%", "Máx. 5.0%"],
        ["PT Privado", "Máx. 6.0%", "Máx. 8.0%"],
      ] },
      { kind: "text", text: "Os limites críticos de disparo dos alertas visuais são totalmente dinâmicos e associados ao novo seletor de Origem no topo. Importante: O valor exibido na tabela é acumulado, o que significa que o motor soma automaticamente a perda da linha de interligação (Feeder) com a perda do circuito terminal, garantindo segurança real no ponto de consumo." },
    ],
  },
  {
    title: "5. Curto-Circuito (Icc) e Poder de Corte",
    ref: "Mecanismo IEC 60909 & IEC 60898-1",
    blocks: [
      { kind: "text", text: "A corrente de curto-circuito no final de um circuito (Icc_final) é menor do que na origem (Icc_origem) devido à impedância acumulada. A app aplica o método das impedâncias resistivas simplificadas a 70 °C." },
      { kind: "formula", lines: [
        { expr: "Z_total = Z_rede + Z_interligação + Z_circuito" },
        { expr: "Icc_final = U0 / Z_total" },
      ] },
      { kind: "note", text: "Rigor Normativo: O motor de cálculo includes uma validação de segurança estrita baseada na norma IEC 60898-1. Se o Icc na Origem ultrapassar a capacidade padrão de 6.0 kA exigida para aparelhagem terminal de distribuição, o sistema emitirá um erro de bloqueio crítico na barra lateral solicitando aparelhagem de maior capacidade." },
    ],
  },
  {
    title: "6. Equilíbrio Avançado de Fases",
    blocks: [
      { kind: "text", text: "As cargas trifásicas dividem-se igualmente pelas 3 fases (P/3 em cada). As cargas monofásicas são distribuídas por um algoritmo combinatório avançado de pesquisa por permuta." },
      { kind: "text", text: "O algoritmo testa todas as combinações matemáticas possíveis para encontrar o arranjo exato que resulta no menor desequilíbrio percentual real, minimizando correntes no Neutro mesmo com cargas muito díspares e pesadas." },
    ],
  },
  {
    title: "7. CÁLCULO DE TUBAGEM",
    ref: "RTIEBT · boas práticas",
    blocks: [
      { kind: "text", text: "Dimensiona o diâmetro do tubo pela taxa máxima de enchimento admissível, em função do número de condutores." },
      { kind: "table", head: ["Nº de condutores", "Taxa de enchimento"], rows: [
        ["1 condutor", "53%"],
        ["2 condutores", "31%"],
        ["3 ou mais", "40%"],
      ] },
      { kind: "formula", lines: [
        { expr: "A_cabo = π · (Ø / 2)²", note: "área de cada condutor" },
        { expr: "S_int = Σ A_cabos / taxa", note: "secção interior mínima" },
      ] },
    ],
  },
];

function AboutBlockView({ block }: { block: AboutBlock }) {
  if (block.kind === "text") {
    return <p className="text-muted-foreground">{block.text}</p>;
  }
  if (block.kind === "note") {
    return (
      <p className="rounded-md border border-[color:var(--brand-blue)]/30 bg-[color:var(--brand-blue)]/5 px-3 py-2 text-xs italic text-[color:var(--brand-blue)]">
        {block.text}
      </p>
    );
  }
  if (block.kind === "formula") {
    return (
      <div className="rounded-md border border-border bg-[color:var(--surface-2)] p-3 font-mono text-[13px]">
        {block.lines.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground">{l.expr}</span>
            {l.note && <span className="text-xs text-muted-foreground">{l.note}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (block.kind === "table") {
    return (
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-[color:var(--surface-2)] font-semibold text-muted-foreground">
            <tr>
              {block.head.map((h, i) => (
                <th key={i} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {block.rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-[color:var(--surface-2)]/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}


function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sobre a PLUGTECH CalcStudio Pro</DialogTitle>
          <DialogDescription>
            Software de cálculo de instalações elétricas BT segundo o RTIEBT. Resumo do que a app faz e como decide.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {ABOUT_TOPICS.map(t => (
            <div key={t.title} className="rounded-md border border-border bg-card p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-[color:var(--brand-green)]">{t.title}</div>
                {t.ref && (
                  <span className="rounded-full border border-[color:var(--brand-blue)]/40 bg-[color:var(--brand-blue)]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--brand-blue)]">
                    {t.ref}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {t.blocks.map((b, i) => <AboutBlockView key={i} block={b} />)}
              </div>
            </div>
          ))}
          <div className="rounded-md border border-[color:var(--brand-blue)]/40 bg-[color:var(--brand-blue)]/5 p-3">
            <div className="mb-1 font-semibold">Desenvolvedor</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              <span><b>Engº Sérgio João</b></span>
              <span>sergiojoa931@gmail.com</span>
              <span>WhatsApp: +244 931 728 474</span>
              <span className="italic text-[color:var(--brand-green)]">"TECNOLOGIA QUE LIGA SOLUÇÕES"</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ObraDialog({ open, onClose, project, onChange }: {
  open: boolean; onClose: () => void; project: ProjectInfo; onChange: (p: Partial<ProjectInfo>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dados da Obra</DialogTitle>
          <DialogDescription>
            Identificação da obra e do técnico responsável. Aparecem nos relatórios em PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Nome da Obra</span>
            <input value={project.obra} onChange={e => onChange({ obra: e.target.value })}
              className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5"
              placeholder="Ex: Edifício Residencial Atlântico" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Engenheiro Responsável</span>
            <input value={project.engenheiro} onChange={e => onChange({ engenheiro: e.target.value })}
              className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5"
              placeholder="Ex: Eng.º Sérgio João" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Nº de Carteira / Cédula Profissional</span>
            <input value={project.carteira} onChange={e => onChange({ carteira: e.target.value })}
              className="w-full rounded border border-border bg-[color:var(--surface-2)] px-2 py-1.5"
              placeholder="Ex: 12345" />
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
