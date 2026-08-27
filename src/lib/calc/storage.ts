import type { Circuit, Material, Phase } from "./engine";

export interface Panel {
  id: string;
  name: string;            // ex: Q.G.B.T.
  origin: string;          // ex: PT/QGE ou id de outro quadro
  feederMaterial: Material;
  feederSection: number;
  feederLength: number;
  iccOriginKA: number;
  voltageMono: number;
  voltageTri: number;
  phase: Phase;            // alimentação do quadro
  cosphi: number;
  panelKind?: "QE" | "QGE"; // tipo de quadro (distribuição vs geral)
  circuits: Circuit[];
}

export interface ProjectInfo {
  obra: string;        // nome da obra
  engenheiro: string;  // engenheiro responsável
  carteira: string;    // nº de carteira / cédula profissional
}

const KEY = "plugtech.calcstudio.v1";

export interface AppState {
  panels: Panel[];
  activePanelId: string | null;
  project: ProjectInfo;
}

export function emptyProject(): ProjectInfo {
  return { obra: "", engenheiro: "", carteira: "" };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return { panels: [], activePanelId: null, project: emptyProject() };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const s = JSON.parse(raw) as AppState;
    if (!s.panels?.length) return seed();
    if (!s.project) s.project = emptyProject();
    return s;
  } catch { return seed(); }
}

export function saveState(s: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function seed(): AppState {
  const id = crypto.randomUUID();
  return {
    panels: [{
      id, name: "Q.G.B.T.", origin: "PT/QGE",
      feederMaterial: "Cu", feederSection: 16, feederLength: 10,
      iccOriginKA: 6, voltageMono: 230, voltageTri: 400,
      phase: "Tri", cosphi: 0.95, panelKind: "QGE", circuits: [],
    }],
    activePanelId: id,
    project: emptyProject(),
  };
}

// ---- Guardar / Abrir projeto como ficheiro .json ----
function slug(s: string): string {
  return (s || "projeto").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "projeto";
}

export function saveProjectFile(state: AppState) {
  if (typeof window === "undefined") return;
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(state.project?.obra)}-plugtech.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function loadProjectFile(file: File): Promise<AppState> {
  const text = await file.text();
  const s = JSON.parse(text) as AppState;
  if (!s.panels?.length) throw new Error("Ficheiro de projeto inválido.");
  if (!s.project) s.project = emptyProject();
  if (!s.activePanelId) s.activePanelId = s.panels[0].id;
  return s;
}
