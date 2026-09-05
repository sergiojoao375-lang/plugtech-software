// Importação de quadros/circuitos a partir de ficheiros Excel (.xlsx/.xls) ou CSV
import * as XLSX from "xlsx";
import type { Circuit, CircuitType, InstallScenario, Material, Phase } from "./engine";
import type { Panel } from "./storage";

type Row = Record<string, unknown>;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pick(row: Row, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.includes(norm(k))) {
      const v = row[k];
      if (v === null || v === undefined) return "";
      return String(v).trim();
    }
  }
  return "";
}

function num(v: string, fallback = 0): number {
  if (!v) return fallback;
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function mapType(v: string): CircuitType {
  const n = norm(v);
  if (!n) return "Tomadas";
  if (n.includes("ilum") || n.includes("luz")) return "Iluminacao";
  if (n.includes("tomad")) return "Tomadas";
  if (n.includes("termo")) return "Termoacumulador";
  if (n.includes("placa") || n.includes("fogao") || n.includes("cozinha")) return "PlacaCozinha";
  if (n.includes("quadro") || n === "qp" || n.includes("parcial")) return "QuadroParcial";
  if (n === "uac" || n.includes("unidade")) return "UAC";
  if (n === "ac" || n.includes("clima") || n.includes("arcond")) return "AC";
  return "Tomadas";
}

function mapScenario(v: string): InstallScenario {
  const n = norm(v);
  if (n.includes("enterr") || n === "d") return "Enterrado";
  if (n.includes("calha") || n.includes("esteira") || n === "e") return "Calha";
  if (n.includes("livre") || n.includes("ar") || n === "f") return "ArLivre";
  return "Embutido";
}

function mapPhase(v: string): Phase {
  const n = norm(v);
  if (n.startsWith("tri") || n === "3f" || n === "3") return "Tri";
  return "Mono";
}

function mapMaterial(v: string): Material {
  const n = norm(v);
  return n.startsWith("al") ? "Al" : "Cu";
}

const COL = {
  panel: ["quadro", "painel", "panel", "qe", "board"],
  name: ["circuito", "nomedocircuito", "nome", "designacao", "descricao", "name"],
  power: ["potencia", "potenciaw", "potenciakw", "power", "carga", "p"],
  unit: ["unidade", "unidadepotencia", "unit"],
  length: ["comprimento", "comp", "distancia", "l", "length", "m"],
  cosphi: ["cosphi", "cos", "cosfi", "fatordepotencia", "fp"],
  type: ["tipo", "tipodecircuito", "tipocircuito", "type"],
  cable: ["cabo", "tipodecabo", "cable"],
  material: ["material", "condutor"],
  scenario: ["instalacao", "cenario", "cenariodeinstalacao", "metodo", "scenario"],
  phase: ["fase", "phase", "alimentacao"],
};

export interface ImportResult {
  panels: Panel[];
  circuitCount: number;
}

function basePanel(name: string, index: number): Panel {
  return {
    id: crypto.randomUUID(),
    name: name || `Q.E${index + 1}`,
    origin: "PT/QGE",
    feederMaterial: "Cu",
    feederSection: 10,
    feederLength: 15,
    feederAuto: true,
    iccOriginKA: 6,
    voltageMono: 230,
    voltageTri: 400,
    phase: "Tri",
    cosphi: 0.95,
    circuits: [],
  };
}

export function rowsToPanels(rows: Row[]): ImportResult {
  const map = new Map<string, Panel>();
  let count = 0;

  for (const row of rows) {
    const name = pick(row, COL.name);
    const powerRaw = pick(row, COL.power);
    if (!name && !powerRaw) continue;

    const panelName = pick(row, COL.panel) || "Q.G.B.T.";
    let panel = map.get(panelName);
    if (!panel) {
      panel = basePanel(panelName, map.size);
      map.set(panelName, panel);
    }

    const unit = norm(pick(row, COL.unit));
    let power = num(powerRaw);
    // se a coluna se chama "Potência (kW)" ou a unidade é kW, converter
    const kwHeader = Object.keys(row).some(k => norm(k).includes("kw"));
    if (unit.startsWith("kw") || (unit === "" && kwHeader)) power *= 1000;

    const circuit: Circuit = {
      id: crypto.randomUUID(),
      name: name || `Circuito ${panel.circuits.length + 1}`,
      power,
      length: num(pick(row, COL.length), 10),
      cosphi: num(pick(row, COL.cosphi), 0.95),
      type: mapType(pick(row, COL.type)),
      cable: pick(row, COL.cable) || "H07V-K",
      material: mapMaterial(pick(row, COL.material)),
      scenario: mapScenario(pick(row, COL.scenario)),
      phase: mapPhase(pick(row, COL.phase)),
    };
    panel.circuits.push(circuit);
    count++;
  }

  return { panels: [...map.values()], circuitCount: count };
}

export async function parseSpreadsheet(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", raw: false });
  const rows: Row[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
    for (const r of json) {
      // se não existir coluna "Quadro", usa o nome da folha como quadro
      const hasPanelCol = Object.keys(r).some(k => COL.panel.includes(norm(k)));
      rows.push(hasPanelCol ? r : { Quadro: sheetName, ...r });
    }
  }
  const res = rowsToPanels(rows);
  if (!res.panels.length) throw new Error("Nenhum circuito encontrado no ficheiro.");
  return res;
}

export function downloadImportTemplate() {
  const data = [
    ["Quadro", "Circuito", "Potência (W)", "Comprimento (m)", "cosφ", "Tipo", "Cabo", "Material", "Instalação", "Fase"],
    ["Q.G.B.T.", "Iluminação Piso 0", 1200, 25, 0.95, "Iluminação", "H07V-K", "Cu", "Embutido", "Mono"],
    ["Q.G.B.T.", "Tomadas Piso 0", 3000, 30, 0.95, "Tomadas", "H07V-K", "Cu", "Embutido", "Mono"],
    ["Q.E1", "AC Sala", 5500, 18, 0.9, "AC", "XV", "Cu", "Calha", "Tri"],
    ["Q.E1", "Q.E2 (parcial)", 25000, 40, 0.95, "Quadro Parcial", "XV", "Cu", "Calha", "Tri"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Circuitos");
  XLSX.writeFile(wb, "modelo-importacao-plugtech.xlsx");
}
