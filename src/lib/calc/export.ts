import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Panel, ProjectInfo } from "./storage";
import { computeCircuit, feederDeltaU, phaseImbalance, pickMainDevice, panelIccKA, type FeederContext } from "./engine";

const FOOTER = "SérgioTech • sergiojoa931@gmail.com • WhatsApp +244 931 728 474 • TECNOLOGIA QUE LIGA SOLUÇÕES";

function projectLine(p?: ProjectInfo): string | null {
  if (!p) return null;
  const parts: string[] = [];
  if (p.obra) parts.push(`Obra: ${p.obra}`);
  if (p.engenheiro) parts.push(`Eng.º Responsável: ${p.engenheiro}`);
  if (p.carteira) parts.push(`Carteira: ${p.carteira}`);
  return parts.length ? parts.join("  |  ") : null;
}


function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text(FOOTER, w / 2, h - 5, { align: "center" });
    doc.text(`Página ${i} / ${pageCount}`, w - 10, h - 5, { align: "right" });
  }
}

function header(doc: jsPDF, title: string, logo?: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(20, 30, 45);
  doc.rect(0, 0, w, 18, "F");
  if (logo) {
    try { doc.addImage(logo, "PNG", 10, 3, 12, 12); } catch {}
  }
  doc.setTextColor(140, 230, 160);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("PLUGTECH CalcStudio Pro", 26, 9);
  doc.setTextColor(220);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("SérgioTech", 26, 14);
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.text(title, w - 10, 11, { align: "right" });
  doc.setTextColor(0);
}

export async function exportPDF(panels: Panel[], activeId: string | null, opts?: { logoDataUrl?: string; project?: ProjectInfo }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const panel = panels.find(p => p.id === activeId) ?? panels[0];
  if (!panel) return;

  header(doc, `Quadro: ${panel.name}`, opts?.logoDataUrl);

  const pLine = projectLine(opts?.project);
  let infoY = 24;
  if (pLine) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(pLine, 10, infoY);
    doc.setFont("helvetica", "normal");
    infoY += 5;
  }
  // Info do quadro
  doc.setFontSize(9);
  doc.text(
    `Origem: ${panel.origin} | Sistema: ${panel.phase === "Tri" ? "Trifásico 400 V" : "Monofásico 230 V"} | Icc origem: ${panel.iccOriginKA} kA | Icc barramento: ${panelIccKA(panel).toFixed(1)} kA | Cabo: ${panel.feederMaterial} ${panel.feederSection}mm² x ${panel.feederLength}m`,
    10, infoY
  );
  const tableStartY = infoY + 4;


  // Calcular para tabela
  const totalIb = panel.circuits.reduce((acc, c) => {
    const s = (c.power) / Math.max(0.1, c.cosphi || 1);
    return acc + (c.phase === "Tri" ? s / (Math.sqrt(3) * panel.voltageTri) : s / panel.voltageMono);
  }, 0);
  const fdU = feederDeltaU({
    totalCurrentA: totalIb, cosphi: panel.cosphi, length: panel.feederLength,
    section: panel.feederSection, material: panel.feederMaterial, phase: panel.phase,
    voltageMono: panel.voltageMono, voltageTri: panel.voltageTri,
  });
  const ctx: FeederContext = {
    iccOriginKA: panel.iccOriginKA, feederMaterial: panel.feederMaterial,
    feederSection: panel.feederSection, feederLength: panel.feederLength,
    feederDeltaU: fdU, voltageMono: panel.voltageMono, voltageTri: panel.voltageTri,
    isQGE: panel.panelKind === "QGE",
  };
  const rows = panel.circuits.map((c, i) => {
    const r = computeCircuit(c, ctx);
    return [
      String(i + 1), c.name, c.type, c.phase + (c.phaseAssign ? "/" + c.phaseAssign : ""),
      (c.power).toFixed(0), c.cosphi.toFixed(2), c.length.toFixed(1),
      r.s.toFixed(0), r.ib.toFixed(2), `${r.in}A ${r.curve}`,
      `${r.parallel > 1 ? r.parallel + "×" : ""}${r.section} mm²${c.material === "Al" ? " Al" : ""}`, r.iz.toFixed(0), (fdU + r.deltaU).toFixed(2) + "%",
      r.iccTerm.toFixed(2), c.scenario,
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Circuito", "Tipo", "Fase", "P(W)", "Cos φ", "L(m)", "S(VA)", "Ib(A)", "Proteção", "Secção", "Iz(A)", "ΔU", "Icc(kA)", "Instalação"]],
    body: rows,
    styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [30, 100, 60], textColor: 255, fontSize: 7.5 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    margin: { left: 10, right: 10 },
    tableWidth: "auto",
  });

  // Resumo / corte geral
  //--minha--const totalP = panel.circuits.reduce((a, c) => a + c.power, 0);
  //--minha--const ibTot = panel.phase === "Tri"
  //--minha--  ? totalP / (Math.sqrt(3) * panel.voltageTri * panel.cosphi)
  //--minha--  : totalP / (panel.voltageMono * panel.cosphi);
  // CÓDIGO CORRIGIDO PARA A FASE MAIS CARREGADA NO PDF:
const totalP = panel.circuits.reduce((a, c) => a + c.power, 0);

// Criamos um acumulador para as correntes das fases
const phaseCurrents = { L1: 0, L2: 0, L3: 0 };

panel.circuits.forEach(c => {
  // Calculamos os dados do circuito usando o motor já existente
  const r = computeCircuit(c, {
    iccOriginKA: panel.iccOriginKA,
    feederMaterial: panel.feederMaterial,
    feederSection: panel.feederSection,
    feederLength: panel.feederLength,
    feederDeltaU: 0, // Simplificado para a soma das correntes
    voltageMono: panel.voltageMono,
    voltageTri: panel.voltageTri,
    isQGE: panel.panelKind === "QGE",
  });

  if (c.phase === "Tri") {
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

// O ibTot do PDF passa a ser o valor real da fase mais carregada
const ibTot = Math.max(phaseCurrents.L1, phaseCurrents.L2, phaseCurrents.L3);

  const cutNeed = ibTot * 1.25;
  const mainRating = pickMainDevice(cutNeed);
  const cutType = cutNeed > 100 ? "Fusíveis (gG)" : "Interruptor de Corte em Carga";
  const modules = panel.circuits.reduce((a, c) => a + (c.phase === "Tri" ? 3 : 2), 4);
  const modulesTotal = Math.ceil(modules * 1.2);
  const imb = phaseImbalance(panel.circuits);

  doc.setFontSize(9);
  // @ts-ignore
  const y = (doc as any).lastAutoTable.finalY + 6;
  doc.text(`Potência total: ${totalP.toFixed(0)} W | Ib total: ${ibTot.toFixed(1)} A | I dimens. (1.25·Ib): ${cutNeed.toFixed(1)} A`, 10, y);
  doc.text(`Corte geral sugerido: ${cutType} — Capacidade: ${mainRating} A`, 10, y + 5);
  doc.text(`Módulos DIN (com reserva 20%): ${modulesTotal}`, 10, y + 10);
  doc.text(`Desequilíbrio de fases: L1=${imb.L1}W L2=${imb.L2}W L3=${imb.L3}W (${imb.pct.toFixed(1)}%)`, 10, y + 15);

  // Página: diagrama de blocos
  doc.addPage("a4", "landscape");
  header(doc, "Diagrama Esquemático de Blocos", opts?.logoDataUrl);
  drawBlockDiagram(doc, panel);

  // Página: materiais
  doc.addPage("a4", "landscape");
  header(doc, "Lista Global de Materiais", opts?.logoDataUrl);
  const matCables = new Map<string, number>(); // "Cu 2.5mm²" -> metros
  const matBreakers = new Map<string, number>();
  panel.circuits.forEach(c => {
    const r = computeCircuit(c, ctx);
    const mat = c.material === "Al" ? "Al" : "Cu";
    const k = `${mat} ${r.parallel > 1 ? r.parallel + "×" : ""}${r.section}mm²`;
    matCables.set(k, (matCables.get(k) || 0) + c.length * r.parallel);
    const b = `Disjuntor ${r.in}A Curva ${r.curve} (${c.phase})`;
    matBreakers.set(b, (matBreakers.get(b) || 0) + 1);
  });
  matCables.set(`${panel.feederMaterial} ${panel.feederSection}mm² (interligação)`,
    (matCables.get(`${panel.feederMaterial} ${panel.feederSection}mm² (interligação)`) || 0) + panel.feederLength);

  autoTable(doc, {
    startY: 24,
    head: [["Cabo", "Metros"]],
    body: Array.from(matCables.entries()).map(([k, v]) => [k, v.toFixed(1)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 100, 60] },
    margin: { left: 10, right: 10 },
  });
  autoTable(doc, {
    // @ts-ignore
    startY: (doc as any).lastAutoTable.finalY + 6,
    head: [["Aparelho", "Quantidade"]],
    body: Array.from(matBreakers.entries()).map(([k, v]) => [k, String(v)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 100, 60] },
    margin: { left: 10, right: 10 },
  });

  // Página: assinaturas (fundo branco puro)
  doc.addPage("a4", "landscape");
  header(doc, "Validação Técnica", opts?.logoDataUrl);
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 20, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight() - 30, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  const w = doc.internal.pageSize.getWidth();
  const baseY = 120;
  doc.line(30, baseY, 120, baseY);
  doc.line(w - 120, baseY, w - 30, baseY);
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Técnico Responsável", 75, baseY + 6, { align: "center" });
  doc.text("Cliente", w - 75, baseY + 6, { align: "center" });

  addFooter(doc);
  doc.save(`PLUGTECH_${panel.name}.pdf`);
}

function drawBlockDiagram(doc: jsPDF, panel: Panel) {
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(20, 80, 60);
  doc.setLineWidth(0.5);

  // Caixa Origem
  doc.setFillColor(235, 250, 240);
  doc.rect(30, 40, 80, 30, "FD");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(`Origem: ${panel.origin}`, 70, 52, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Icc: ${panel.iccOriginKA} kA`, 70, 60, { align: "center" });

  // Seta + linha interligação
  doc.line(110, 55, 150, 55);
  doc.setFontSize(8);
  doc.text(`Cabo ${panel.feederMaterial} ${panel.feederSection}mm²`, 130, 50, { align: "center" });
  doc.text(`L = ${panel.feederLength} m`, 130, 60, { align: "center" });

  // Caixa quadro atual
  doc.setFillColor(220, 240, 255);
  doc.rect(150, 40, 90, 30, "FD");
  doc.setFontSize(11);
  doc.text(`Quadro: ${panel.name}`, 195, 52, { align: "center" });
  doc.setFontSize(8);
  doc.text(`${panel.circuits.length} circuitos`, 195, 60, { align: "center" });

  // Circuitos a jusante
  const startY = 90;
  const colW = (w - 40) / Math.max(1, Math.min(6, panel.circuits.length || 1));
  panel.circuits.slice(0, 12).forEach((c, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = 20 + col * colW;
    const y = startY + row * 35;
    doc.setFillColor(250, 250, 250);
    doc.rect(x, y, colW - 5, 28, "FD");
    doc.setFontSize(8);
    doc.text(c.name, x + 3, y + 6);
    doc.setFontSize(7);
    doc.text(`${c.type} ${c.phase}`, x + 3, y + 12);
    doc.text(`${c.power}W L=${c.length}m`, x + 3, y + 18);
    doc.text(`In=${c.inBreaker ?? "auto"}A`, x + 3, y + 24);
  });
}

// ===== Diagrama geral em cascata de TODOS os quadros =====
export async function exportCascadePDF(panels: Panel[], opts?: { logoDataUrl?: string; project?: ProjectInfo }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  if (!panels.length) return;

  header(doc, "Diagrama Geral em Cascata", opts?.logoDataUrl);


  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Ordenar quadros: origens externas (PT/QGE) primeiro, depois por dependência simples
  const ordered = [...panels].sort((a, b) => {
    const aRoot = !panels.some(p => p.name === a.origin) ? 0 : 1;
    const bRoot = !panels.some(p => p.name === b.origin) ? 0 : 1;
    return aRoot - bRoot;
  });

  let y = 26;
  const pLineC = projectLine(opts?.project);
  if (pLineC) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(pLineC, 10, y);
    doc.setFont("helvetica", "normal");
    y += 6;
  }
  const boxH = 30;
  const gapY = 14;
  const leftX = 16;
  const boxW = 110;

  ordered.forEach((panel, idx) => {
    if (y + boxH + gapY > h - 14) {
      addFooter(doc);
      doc.addPage("a4", "landscape");
      header(doc, "Diagrama Geral em Cascata (cont.)", opts?.logoDataUrl);
      y = 26;
    }

    // Caixa do quadro
    doc.setDrawColor(20, 80, 60);
    doc.setLineWidth(0.5);
    doc.setFillColor(idx === 0 ? 235 : 220, idx === 0 ? 250 : 240, idx === 0 ? 240 : 255);
    doc.rect(leftX, y, boxW, boxH, "FD");
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(panel.name, leftX + 4, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Origem: ${panel.origin}`, leftX + 4, y + 14);
    doc.text(`Alim.: ${panel.phase} ${panel.voltageMono}/${panel.voltageTri}V · Icc orig ${panel.iccOriginKA}kA · Icc barr. ${panelIccKA(panel).toFixed(1)}kA`, leftX + 4, y + 19);

    // Corte geral do quadro com capacidade
    const totalP = panel.circuits.reduce((a, c) => a + c.power, 0);
    const ibTot = panel.phase === "Tri"
      ? totalP / (Math.sqrt(3) * panel.voltageTri * (panel.cosphi || 0.95))
      : totalP / (panel.voltageMono * (panel.cosphi || 0.95));
    const mainRating = pickMainDevice(ibTot * 1.25);
    doc.text(`Corte geral: ${ibTot * 1.25 > 100 ? "Fusíveis gG" : "Interruptor"} ${mainRating}A`, leftX + 4, y + 24);
    doc.text(`Interligação: ${panel.feederMaterial} ${panel.feederSection}mm² · L=${panel.feederLength}m`, leftX + 4, y + 28);

    // Conector da linha de interligação
    doc.setDrawColor(120);
    doc.line(leftX + boxW, y + boxH / 2, leftX + boxW + 8, y + boxH / 2);

    // Tabela compacta de circuitos do quadro ao lado
    const ctx: FeederContext = {
      iccOriginKA: panel.iccOriginKA, feederMaterial: panel.feederMaterial,
      feederSection: panel.feederSection, feederLength: panel.feederLength,
      feederDeltaU: 0, voltageMono: panel.voltageMono, voltageTri: panel.voltageTri,
      isQGE: panel.panelKind === "QGE",
    };
    const rows = panel.circuits.map((c, i) => {
      const r = computeCircuit(c, ctx);
      return [String(i + 1), c.name, c.phase + (c.phaseAssign ? "/" + c.phaseAssign : ""),
        `${c.power}W`, `${r.in}A ${r.curve}`, `${r.parallel > 1 ? r.parallel + "×" : ""}${r.section}mm²${c.material === "Al" ? " Al" : ""}`, `${c.length}m`];
    });
    autoTable(doc, {
      startY: y,
      margin: { left: leftX + boxW + 10, right: 10 },
      head: [["#", "Circuito", "Fase", "P", "Proteção", "Secção", "L"]],
      body: rows.length ? rows : [["—", "Sem circuitos", "", "", "", "", ""]],
      styles: { fontSize: 6.5, cellPadding: 0.8, overflow: "linebreak" },
      headStyles: { fillColor: [30, 100, 60], textColor: 255, fontSize: 6.8 },
      theme: "grid",
    });
    // @ts-ignore
    const tableEnd = (doc as any).lastAutoTable.finalY;
    y = Math.max(y + boxH, tableEnd) + gapY;
  });

  addFooter(doc);
  doc.save("PLUGTECH_Diagrama_Cascata.pdf");
}

export function exportCSV(panel: Panel) {
  const sep = ";";
  const ctx: FeederContext = {
    iccOriginKA: panel.iccOriginKA, feederMaterial: panel.feederMaterial,
    feederSection: panel.feederSection, feederLength: panel.feederLength,
    feederDeltaU: 0, voltageMono: panel.voltageMono, voltageTri: panel.voltageTri,
    isQGE: panel.panelKind === "QGE",
  };
  const headers = ["#","Circuito","Tipo","Fase","P(W)","CosPhi","L(m)","S(VA)","Ib(A)","In(A)","Curva","Seccao(mm2)","Condutores/fase","Material","Iz(A)","DeltaU(%)","Icc(kA)","Instalacao"];
  const lines = [headers.join(sep)];
  panel.circuits.forEach((c, i) => {
    const r = computeCircuit(c, ctx);
    lines.push([
      i + 1, c.name, c.type, c.phase + (c.phaseAssign ? "/" + c.phaseAssign : ""),
      c.power, c.cosphi.toFixed(2).replace(".", ","), c.length, r.s.toFixed(0),
      r.ib.toFixed(2).replace(".", ","), r.in, r.curve, r.section, r.parallel, c.material === "Al" ? "Al" : "Cu",
      r.iz.toFixed(0), r.deltaU.toFixed(2).replace(".", ","),
      r.iccTerm.toFixed(2).replace(".", ","), c.scenario,
    ].join(sep));
  });
  lines.push("");
  lines.push(`Quadro${sep}${panel.name}`);
  lines.push(`Origem${sep}${panel.origin}`);
  lines.push(`Sistema${sep}${panel.phase === "Tri" ? "Trifasico 400V" : "Monofasico 230V"}`);
  lines.push(`Icc origem (kA)${sep}${panel.iccOriginKA}`);
  lines.push(`Icc barramento (kA)${sep}${panelIccKA(panel).toFixed(1).replace(".", ",")}`);
  lines.push(`Cabo interligação${sep}${panel.feederMaterial} ${panel.feederSection}mm² x ${panel.feederLength}m`);

  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `PLUGTECH_${panel.name}.csv`; a.click();
  URL.revokeObjectURL(url);
}
