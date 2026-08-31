import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Panel, ProjectInfo } from "./storage";
import { computeCircuit, feederDeltaU, phaseImbalance, pickMainDevice, panelIccKA, type FeederContext } from "./engine";

const FOOTER = "SérgioTech • sergiojoa931@gmail.com • WhatsApp +244 931 728 474 • TECNOLOGIA QUE LIGA SOLUÇÕES";
const TOP_MARGIN = 24; // espaço reservado ao cabeçalho em todas as páginas

// ---- Identidade visual das tabelas (estilo do relatório web) ----
const BRAND_GREEN: [number, number, number] = [13, 94, 66];
const BRAND_STRIPE: [number, number, number] = [241, 247, 244];
const BRAND_TEXT: [number, number, number] = [38, 48, 45];
const BRAND_LINE: [number, number, number] = [223, 232, 228];
const BRAND_BLUE: [number, number, number] = [21, 74, 122];

/** Base comum a todas as tabelas: cabeçalho verde, linhas alternadas, sem grelha pesada. */
/** Substitui glifos ausentes nas fontes standard do PDF (Helvetica/WinAnsi). */
const GLYPH_MAP: Array<[RegExp, string]> = [
  [/√3/g, "raiz(3)"],
  [/√/g, "raiz"],
  [/≤/g, "<="],
  [/≥/g, ">="],
  [/≈/g, "~"],
  [/ΔU/g, "Queda U"],
  [/Δ/g, "D"],
  [/φ/g, "phi"],
  [/Ω/g, "ohm"],
  [/→/g, "->"],
  [/[\u2018\u2019]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
];

function sanitizeText(v: any): any {
  if (typeof v === "string") {
    let out = v;
    for (const [re, rep] of GLYPH_MAP) out = out.replace(re, rep);
    return out;
  }
  if (Array.isArray(v)) return v.map(sanitizeText);
  return v;
}

/** Aplica a sanitização a todo o texto escrito no documento (inclui autoTable). */
function patchText(doc: jsPDF) {
  const orig = (doc as any).text.bind(doc);
  (doc as any).text = (text: any, ...rest: any[]) => orig(sanitizeText(text), ...rest);
  return doc;
}

function tableBase(fontSize = 7.5) {
  return {
    theme: "striped" as const,
    styles: {
      fontSize,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2.4 },
      overflow: "linebreak" as const,
      textColor: BRAND_TEXT,
      lineColor: BRAND_LINE,
      lineWidth: 0.1,
      valign: "middle" as const,
    },
    headStyles: {
      fillColor: BRAND_GREEN,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
      fontSize: fontSize + 0.3,
      cellPadding: { top: 2.6, right: 2, bottom: 2.6, left: 2.4 },
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: BRAND_STRIPE },
    bodyStyles: { lineWidth: { top: 0, right: 0, bottom: 0.1, left: 0 } as any },
  };
}


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
    doc.setFont("helvetica", "normal");
    doc.text(FOOTER, w / 2, h - 5, { align: "center" });
    doc.text(`Página ${i} / ${pageCount}`, w - 10, h - 5, { align: "right" });
  }
}

function header(doc: jsPDF, title: string, logo?: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(20, 30, 45);
  doc.rect(0, 0, w, 18, "F");
  if (logo) {
    try { doc.addImage(logo, "PNG", 10, 3, 12, 12); } catch { /* logo inválido */ }
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
  doc.setFontSize(8.5);
  const maxTitleW = w - 26 - 10 - 4;
  const titleLine = (doc.splitTextToSize(title, maxTitleW) as string[])[0];
  doc.text(titleLine, w - 10, 11, { align: "right" });
  doc.setTextColor(0);
  doc.setFillColor(30, 100, 60);

  doc.rect(0, 18, w, 1.2, "F");
  doc.setTextColor(0);
}

function sectionTitle(doc: jsPDF, text: string, y: number) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  let size = 9.5;
  doc.setFontSize(size);
  while (size > 7 && doc.getTextWidth(text) > w - 28) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  doc.setFillColor(235, 242, 238);
  doc.rect(MARGIN - 2, y - 5, w - (MARGIN - 2) * 2, 7.5, "F");
  doc.setTextColor(20, 60, 45);
  doc.text(text, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(0);
  return y + 9;
}


function ensureSpace(doc: jsPDF, y: number, needed: number, title: string, logo?: string): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 14) {
    doc.addPage("a4", "landscape");
    header(doc, title, logo);
    return TOP_MARGIN;
  }
  return y;
}

const MARGIN = 12;

function usableWidth(doc: jsPDF) {
  return Math.floor((doc.internal.pageSize.getWidth() - MARGIN * 2) * 10) / 10 - 0.2;
}

function paragraph(doc: jsPDF, text: string, y: number, size = 8.5): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(35, 40, 38);
  const lh = size * 0.52;
  const lines = doc.splitTextToSize(text, usableWidth(doc)) as string[];
  doc.text(lines, MARGIN, y, { align: "left", lineHeightFactor: 1.25 });
  doc.setTextColor(0);
  return y + lines.length * lh + 2.5;
}

/** Ponto com marcador e recuo correcto nas linhas seguintes. */
function bullet(doc: jsPDF, text: string, y: number, size = 8.5): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(35, 40, 38);
  const indent = 4.5;
  const lh = size * 0.52;
  const lines = doc.splitTextToSize(text, usableWidth(doc) - indent) as string[];
  doc.text("•", MARGIN, y);
  doc.text(lines, MARGIN + indent, y, { align: "left", lineHeightFactor: 1.25 });
  doc.setTextColor(0);
  return y + lines.length * lh + 2.5;
}

/** Altura estimada de um bloco de texto, para saber se cabe na página. */
function textHeight(doc: jsPDF, text: string, size = 8.5, indent = 0): number {
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, usableWidth(doc) - indent) as string[];
  return lines.length * size * 0.52 + 3;
}


function panelContext(panel: Panel, feederDU: number): FeederContext {
  return {
    iccOriginKA: panel.iccOriginKA,
    feederMaterial: panel.feederMaterial,
    feederSection: panel.feederSection * Math.max(1, panel.feederParallel ?? 1),
    feederLength: panel.feederLength,
    feederDeltaU: feederDU,
    voltageMono: panel.voltageMono,
    voltageTri: panel.voltageTri,
    isQGE: panel.panelKind === "QGE",
    supplyType: panel.supplyType,
  };
}

function panelTotals(panel: Panel) {
  const totalIb = panel.circuits.reduce((acc, c) => {
    const s = c.power / Math.max(0.1, c.cosphi || 1);
    return acc + (c.phase === "Tri" ? s / (Math.sqrt(3) * panel.voltageTri) : s / panel.voltageMono);
  }, 0);
  const fdU = feederDeltaU({
    totalCurrentA: totalIb, cosphi: panel.cosphi, length: panel.feederLength,
    section: panel.feederSection * Math.max(1, panel.feederParallel ?? 1),
    material: panel.feederMaterial, phase: panel.phase,
    voltageMono: panel.voltageMono, voltageTri: panel.voltageTri,
  });
  const ctx = panelContext(panel, fdU);

  const phaseCurrents = { L1: 0, L2: 0, L3: 0 };
  panel.circuits.forEach(c => {
    const r = computeCircuit(c, ctx);
    if (c.phase === "Tri") {
      phaseCurrents.L1 += r.ib; phaseCurrents.L2 += r.ib; phaseCurrents.L3 += r.ib;
    } else {
      const ph = c.phaseAssign || "L1";
      phaseCurrents[ph] += r.ib;
    }
  });
  const ibTot = panel.phase === "Tri"
    ? Math.max(phaseCurrents.L1, phaseCurrents.L2, phaseCurrents.L3)
    : totalIb;
  const totalP = panel.circuits.reduce((a, c) => a + c.power, 0);
  const cutNeed = ibTot * 1.25;
  const mainRating = pickMainDevice(cutNeed);
  return { ctx, fdU, totalP, ibTot, cutNeed, mainRating, phaseCurrents };
}

function childrenOf(panels: Panel[], panel: Panel): Panel[] {
  return panels.filter(p => p.id !== panel.id && p.origin === panel.name);
}

// ============================ RELATÓRIO PRINCIPAL ============================
export async function exportPDF(panels: Panel[], activeId: string | null, opts?: { logoDataUrl?: string; project?: ProjectInfo }) {
  const doc = patchText(new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }));
  if (!panels.length) return;
  const logo = opts?.logoDataUrl;

  // ---------- Capa ----------
  const w = doc.internal.pageSize.getWidth();
  header(doc, "Memória de Cálculo Eléctrico", logo);
  let y = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 60, 45);
  doc.text(doc.splitTextToSize("MEMÓRIA DE CÁLCULO E DIMENSIONAMENTO", usableWidth(doc)), w / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(60);
  doc.text(doc.splitTextToSize("Instalações Eléctricas de Baixa Tensão — RTIEBT (metodologia simplificada)", usableWidth(doc)), w / 2, y + 8, { align: "center" });
  doc.setTextColor(0);


  y += 22;
  const p = opts?.project;
  autoTable(doc, {
    ...tableBase(10),
    startY: y,
    margin: { left: 22, right: 22 },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [237, 245, 241], textColor: BRAND_GREEN, cellWidth: 91 } },

    body: [
      ["Obra", p?.obra || "—"],
      ["Eng.º Responsável", p?.engenheiro || "—"],
      ["Carteira / Cédula", p?.carteira || "—"],
      ["Nº de quadros", String(panels.length)],
      ["Nº total de circuitos", String(panels.reduce((a, q) => a + q.circuits.length, 0))],
      ["Data de emissão", new Date().toLocaleDateString("pt-PT")],
    ],
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 12;
  y = sectionTitle(doc, "Índice do relatório", y);
  const idx = [
    "1. Informação do projecto e critérios de cálculo",
    "2. Diagrama de quadros (hierarquia de alimentação)",
    "3. Quadros: dados de alimentação, circuitos e resumo",
    "4. Selectividade e coordenação das protecções (por quadro)",
    "5. Diagramas esquemáticos de blocos",
    "6. Lista global de materiais",
    "7. Validação técnica e assinaturas",
  ];
  doc.setFontSize(9.5);
  idx.forEach((t, i) => doc.text(t, 14, y + i * 5.5));

  // ---------- 1. Critérios ----------
  doc.addPage("a4", "landscape");
  header(doc, "1. Critérios de Cálculo", logo);
  y = TOP_MARGIN;
  y = sectionTitle(doc, "1. Informação do projecto e critérios de cálculo", y);
  y = paragraph(doc, `O presente documento apresenta o dimensionamento dos quadros eléctricos ${p?.obra ? `da obra "${p.obra}"` : "do projecto"}, incluindo o cálculo das correntes de serviço, escolha das protecções, secções dos condutores, quedas de tensão, correntes de curto-circuito presumidas e a análise de selectividade e coordenação entre aparelhos de protecção.`, y);
  y += 2;
  y = paragraph(doc, "Critérios adoptados:", y);
  const criterios = [
    "Corrente de serviço: Ib = S / U (mono) ou S / (√3 · U) (tri), com S = P / cos φ.",
    "Condição fundamental de protecção: Ib ≤ In ≤ Iz, sendo Iz a corrente admissível do condutor corrigida pelo método de instalação e pelo número de condutores em paralelo.",
    "Queda de tensão acumulada (linha de interligação + circuito terminal) limitada aos valores regulamentares: 3% em iluminação e 5% em restantes usos (origem em rede pública); limites alargados quando a origem é Posto de Transformação próprio.",
    "Corrente de curto-circuito presumida calculada pelo método das impedâncias simplificado, a partir do Icc na origem e da impedância do cabo de alimentação.",
    "Secção mínima: 1,5 mm² para iluminação e 2,5 mm² para tomadas e restantes circuitos de força.",
    "Aparelho de corte geral dimensionado para 1,25 · Ib da fase mais carregada, com margem adicional de 10% na escolha do calibre normalizado.",
    "Equilíbrio de fases optimizado por algoritmo de repartição de cargas monofásicas pelas três fases.",
  ];
  criterios.forEach(t => { y = ensureSpace(doc, y, textHeight(doc, t, 8.5, 4.5), "1. Critérios de Cálculo", logo); y = bullet(doc, t, y); });

  // ---------- 2. Diagrama de quadros ----------
  doc.addPage("a4", "landscape");
  header(doc, "2. Diagrama de Quadros", logo);
  y = TOP_MARGIN;
  y = sectionTitle(doc, "2. Diagrama de quadros — hierarquia de alimentação", y);
  drawPanelTree(doc, panels, y);

  // ---------- 3 e 4. Por quadro ----------
  const ordered = orderPanels(panels, activeId);
  ordered.forEach((panel, pi) => {
    const t = panelTotals(panel);

    doc.addPage("a4", "landscape");
    header(doc, `Quadro ${panel.name}`, logo);
    y = TOP_MARGIN;
    y = sectionTitle(doc, `3.${pi + 1}. Quadro ${panel.name} — dados de alimentação`, y);

    const feederDesc = `${panel.feederMaterial} ${(panel.feederParallel ?? 1) > 1 ? (panel.feederParallel + "× ") : ""}${panel.feederSection} mm² · L = ${panel.feederLength} m${panel.feederAuto ? " (secção automática)" : ""}`;
    autoTable(doc, {
      ...tableBase(6.6),
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: TOP_MARGIN },
      tableWidth: usableWidth(doc),
      alternateRowStyles: { fillColor: [255, 255, 255] },


      head: [["Origem", "Tipo de quadro", "Sistema", "Icc origem", "Icc barramento", "Linha de interligação", "Queda U (%)", "Circuitos"]],
      body: [[
        panel.origin,
        panel.panelKind === "QGE" ? "Quadro Geral (QGE)" : "Quadro de Distribuição (QE)",
        panel.phase === "Tri" ? `Trifásico ${panel.voltageTri} V` : `Monofásico ${panel.voltageMono} V`,
        `${panel.iccOriginKA} kA`,
        `${panelIccKA({ ...panel, feederSection: panel.feederSection * Math.max(1, panel.feederParallel ?? 1) }).toFixed(1)} kA`,
        feederDesc,
        `${t.fdU.toFixed(2)} %`,
        String(panel.circuits.length),
      ]],
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;

    // Tabela de TODOS os circuitos (com paginação e cabeçalho repetido)
    y = sectionTitle(doc, `Circuitos do quadro ${panel.name} (${panel.circuits.length})`, y);
    const rows = panel.circuits.map((c, i) => {
      const r = computeCircuit(c, t.ctx);
      return [
        String(i + 1), c.name, c.type, c.phase + (c.phaseAssign ? "/" + c.phaseAssign : ""),
        c.power.toFixed(0), c.cosphi.toFixed(2), c.length.toFixed(1),
        r.s.toFixed(0), r.ib.toFixed(2), `${r.in}A ${r.curve}`,
        `${r.parallel > 1 ? r.parallel + "×" : ""}${r.section} mm²${c.material === "Al" ? " Al" : ""}`,
        r.iz.toFixed(0), (t.fdU + r.deltaU).toFixed(2) + "%",
        r.iccTerm.toFixed(2),
      ];
    });
    autoTable(doc, {
      ...tableBase(5.9),
      startY: y,
      head: [["#", "Circuito", "Tipo", "Fase", "P (W)", "Cos φ", "L (m)", "S (VA)", "Ib (A)", "Protecção", "Secção", "Iz (A)", "ΔU %", "Icc kA"]],
      body: rows.length ? rows : [["—", "Sem circuitos", "", "", "", "", "", "", "", "", "", "", "", ""]],
      columnStyles: {
        0: { halign: "center", cellWidth: 10.3, textColor: [120, 130, 128] },
        1: { fontStyle: "bold", cellWidth: 47 },
        2: { cellWidth: 22 },
        3: { cellWidth: 17.6, halign: "center" },
        4: { cellWidth: 17.6, halign: "right" },
        5: { cellWidth: 14.7, halign: "right" },
        6: { cellWidth: 14.7, halign: "right" },
        7: { cellWidth: 17.6, halign: "right" },
        8: { cellWidth: 16.1, halign: "right", textColor: BRAND_BLUE },
        9: { cellWidth: 22, fontStyle: "bold" },
        10: { cellWidth: 22, fontStyle: "bold", textColor: BRAND_GREEN },
        11: { cellWidth: 14.7, halign: "right" },
        12: { cellWidth: 22, halign: "right", textColor: BRAND_BLUE },
        13: { cellWidth: 14.6, halign: "right" },
      },
      margin: { left: MARGIN, right: MARGIN, top: TOP_MARGIN },

      tableWidth: usableWidth(doc),
      rowPageBreak: "avoid",
      showHead: "everyPage",
      didDrawPage: () => header(doc, `Quadro ${panel.name} — circuitos`, logo),
    });

    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;

    // Resumo do quadro
    const cutType = t.cutNeed > 100 ? "Fusíveis (gG)" : "Interruptor de Corte em Carga";
    const modules = panel.circuits.reduce((a, c) => a + (c.phase === "Tri" ? 3 : 2), 4);
    const modulesTotal = Math.ceil(modules * 1.2);
    const imb = phaseImbalance(panel.circuits);
    y = ensureSpace(doc, y, 40, `Quadro ${panel.name} — resumo`, logo);
    y = sectionTitle(doc, "Resumo do quadro", y);
    y = paragraph(doc, `Potência instalada: ${t.totalP.toFixed(0)} W  |  Ib (fase mais carregada): ${t.ibTot.toFixed(1)} A  |  I de dimensionamento (1,25 · Ib): ${t.cutNeed.toFixed(1)} A`, y, 8.5);
    y = paragraph(doc, `Corte geral: ${cutType} — calibre ${t.mainRating} A`, y, 8.5);
    y = paragraph(doc, `Módulos DIN estimados (reserva 20%): ${modulesTotal}`, y, 8.5);
    y = paragraph(doc, `Desequilíbrio de fases: L1 = ${imb.L1.toFixed(0)} W · L2 = ${imb.L2.toFixed(0)} W · L3 = ${imb.L3.toFixed(0)} W  (${imb.pct.toFixed(1)} %)`, y, 8.5);
    y += 4;


    // --------- Selectividade e coordenação deste quadro ---------
    doc.addPage("a4", "landscape");
    header(doc, `Selectividade — ${panel.name}`, logo);
    y = TOP_MARGIN;
    y = sectionTitle(doc, `4.${pi + 1}. Selectividade e coordenação das protecções — Quadro ${panel.name}`, y);
    y = paragraph(doc, "Selectividade (ou discriminação) é a capacidade de, perante um defeito, actuar apenas o aparelho de protecção imediatamente a montante do ponto de defeito, mantendo em serviço o restante da instalação. Coordenação é a compatibilidade entre o aparelho de protecção, o condutor que protege e o poder de corte necessário face à corrente de curto-circuito presumida no ponto de instalação.", y);
    y += 1;
    y = paragraph(doc, "Tipos de selectividade considerados:", y);
    [
      "Selectividade amperimétrica (corrente): garantida quando a razão entre o calibre do aparelho geral do quadro e o calibre do disjuntor terminal é ≥ 2 (total na zona de sobrecarga). Entre 1,6 e 2 a selectividade é apenas parcial; abaixo de 1,6 não é assegurada.",
      "Selectividade cronométrica (tempo): obtida com aparelho geral selectivo/regulável, com temporização de curta duração (curva S ou retardo intencional de 50–100 ms), permitindo ao disjuntor terminal actuar primeiro em curto-circuito.",
      "Selectividade energética (limitação): o disjuntor terminal limita a energia específica passante (I²t) a um valor inferior ao necessário para o disparo magnético do aparelho de montante — indicada pelos fabricantes em tabelas de discriminação.",
      "Selectividade diferencial: o diferencial de montante deve ser do tipo S (selectivo, retardado) com sensibilidade pelo menos o triplo da do diferencial a jusante (ex.: 300 mA tipo S a montante de 30 mA instantâneos).",
    ].forEach(t2 => { y = ensureSpace(doc, y, textHeight(doc, t2, 8.5, 4.5), `Selectividade — ${panel.name}`, logo); y = bullet(doc, t2, y); });
    y += 1;
    y = ensureSpace(doc, y, 20, `Selectividade — ${panel.name}`, logo);
    y = paragraph(doc, `Coordenação neste quadro: o aparelho geral tem calibre ${t.mainRating} A e o barramento apresenta uma corrente de curto-circuito presumida de ${panelIccKA({ ...panel, feederSection: panel.feederSection * Math.max(1, panel.feederParallel ?? 1) }).toFixed(1)} kA, pelo que todos os aparelhos instalados devem ter poder de corte (Icu/Icn) igual ou superior a esse valor, ou ser objecto de protecção de retaguarda (back-up) pelo aparelho geral. Verifica-se ainda, para cada circuito, a condição Ib ≤ In ≤ Iz.`, y);
    y += 2;

    const selRows = panel.circuits.map((c, i) => {
      const r = computeCircuit(c, t.ctx);
      const ratio = r.in > 0 ? t.mainRating / r.in : 0;
      const sel = ratio >= 2 ? "Total" : ratio >= 1.6 ? "Parcial" : "Não assegurada";
      const coord = r.ib <= r.in && r.in <= r.iz ? "Conforme" : "Rever";
      const obs = ratio >= 2
        ? "Discriminação amperimétrica garantida."
        : ratio >= 1.6
          ? "Usar aparelho geral selectivo (curva S) ou disjuntor limitador."
          : "Aumentar calibre do geral ou adoptar selectividade cronométrica/energética.";
      return [String(i + 1), c.name, `${r.in} A ${r.curve}`, `${t.mainRating} A`, ratio.toFixed(2), sel, `${r.ib.toFixed(1)} / ${r.in} / ${r.iz.toFixed(0)}`, coord, obs];
    });
    autoTable(doc, {
      ...tableBase(6.4),
      startY: y,
      head: [["#", "Circuito", "Prot. jusante", "Geral montante", "Razão", "Selectividade", "Ib / In / Iz (A)", "Coordenação", "Observação técnica"]],
      body: selRows.length ? selRows : [["—", "Sem circuitos", "", "", "", "", "", "", ""]],
      tableWidth: usableWidth(doc),
      columnStyles: {
        0: { halign: "center", cellWidth: 10.3, textColor: [120, 130, 128] },
        1: { fontStyle: "bold", cellWidth: 38.2 },
        2: { cellWidth: 29.4 },
        3: { cellWidth: 26.4, halign: "center" },
        4: { cellWidth: 19.1, halign: "right" },
        5: { cellWidth: 29.4 },
        6: { cellWidth: 32.3, halign: "center" },
        7: { cellWidth: 30.8 },
        8: { cellWidth: 57.1 },
      },

      didParseCell: (d: any) => {
        if (d.section !== "body") return;
        const v = String(d.cell.raw ?? "");
        if (d.column.index === 5 || d.column.index === 7) {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.textColor =
            v === "Total" || v === "Conforme" ? [21, 115, 71]
              : v === "Parcial" ? [176, 118, 12]
                : [176, 42, 42];
        }
      },
      margin: { left: MARGIN, right: MARGIN, top: TOP_MARGIN },
      rowPageBreak: "avoid",
      showHead: "everyPage",
      didDrawPage: () => header(doc, `Selectividade — ${panel.name}`, logo),
    });

    // Selectividade com quadros parciais alimentados por este quadro
    const kids = childrenOf(panels, panel);
    if (kids.length) {
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 6;
      y = ensureSpace(doc, y, 30, `Selectividade — ${panel.name}`, logo);
      y = sectionTitle(doc, `Selectividade entre o quadro ${panel.name} e os quadros parciais alimentados`, y);
      const kRows = kids.map(k => {
        const kt = panelTotals(k);
        const ratio = kt.mainRating > 0 ? t.mainRating / kt.mainRating : 0;
        const sel = ratio >= 2 ? "Total" : ratio >= 1.6 ? "Parcial" : "Não assegurada";
        return [k.name, `${kt.mainRating} A`, `${t.mainRating} A`, ratio.toFixed(2), sel,
          `${k.feederMaterial} ${(k.feederParallel ?? 1) > 1 ? k.feederParallel + "× " : ""}${k.feederSection} mm² · ${k.feederLength} m`,
          ratio >= 2 ? "Discriminação assegurada em sobrecarga." : "Recomenda-se aparelho geral selectivo (curva S / temporizado)."];
      });
      autoTable(doc, {
        ...tableBase(6.6),
        startY: y,
        head: [["Quadro parcial", "Geral parcial", "Geral deste quadro", "Razão", "Selectividade", "Alimentação", "Observação"]],
        body: kRows,
        headStyles: { ...tableBase(6.6).headStyles, fillColor: BRAND_BLUE },
        tableWidth: usableWidth(doc),
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 38.2 },
          1: { cellWidth: 29.4, halign: "center" },
          2: { cellWidth: 32.3, halign: "center" },
          3: { cellWidth: 17.6, halign: "right" },
          4: { cellWidth: 32.3 },
          5: { cellWidth: 58.7 },
          6: { cellWidth: 64.5 },
        },

        margin: { left: MARGIN, right: MARGIN, top: TOP_MARGIN },

        showHead: "everyPage",
        didDrawPage: () => header(doc, `Selectividade — ${panel.name}`, logo),
      });
    }

    // Diagrama de blocos do quadro
    doc.addPage("a4", "landscape");
    header(doc, `Diagrama de blocos — ${panel.name}`, logo);
    drawBlockDiagram(doc, panel, kids);
  });

  // ---------- 6. Materiais globais ----------
  doc.addPage("a4", "landscape");
  header(doc, "6. Lista Global de Materiais", logo);
  y = sectionTitle(doc, "6. Lista global de materiais (todos os quadros)", TOP_MARGIN);
  const matCables = new Map<string, number>();
  const matBreakers = new Map<string, number>();
  panels.forEach(panel => {
    const t = panelTotals(panel);
    panel.circuits.forEach(c => {
      const r = computeCircuit(c, t.ctx);
      const mat = c.material === "Al" ? "Al" : "Cu";
      const k = `${mat} ${r.parallel > 1 ? r.parallel + "×" : ""}${r.section}mm²`;
      matCables.set(k, (matCables.get(k) || 0) + c.length * r.parallel);
      const b = `Disjuntor ${r.in}A Curva ${r.curve} (${c.phase})`;
      matBreakers.set(b, (matBreakers.get(b) || 0) + 1);
    });
    const par = Math.max(1, panel.feederParallel ?? 1);
    const fk = `${panel.feederMaterial} ${par > 1 ? par + "×" : ""}${panel.feederSection}mm² (interligação)`;
    matCables.set(fk, (matCables.get(fk) || 0) + panel.feederLength * par);
    const gk = `Aparelho de corte geral ${t.mainRating}A (${panel.name})`;
    matBreakers.set(gk, (matBreakers.get(gk) || 0) + 1);
  });
  autoTable(doc, {
    ...tableBase(9),
    startY: y,
    head: [["Cabo", "Metros"]],
    body: Array.from(matCables.entries()).map(([k, v]) => [k, v.toFixed(1)]),
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: MARGIN, right: MARGIN, top: TOP_MARGIN },
    showHead: "everyPage",
    didDrawPage: () => header(doc, "6. Lista Global de Materiais", logo),
  });
  autoTable(doc, {
    ...tableBase(9),
    // @ts-ignore
    startY: (doc as any).lastAutoTable.finalY + 6,
    head: [["Aparelho", "Quantidade"]],
    body: Array.from(matBreakers.entries()).map(([k, v]) => [k, String(v)]),
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: MARGIN, right: MARGIN, top: TOP_MARGIN },
    showHead: "everyPage",
    didDrawPage: () => header(doc, "6. Lista Global de Materiais", logo),
  });


  // ---------- 7. Assinaturas ----------
  doc.addPage("a4", "landscape");
  header(doc, "7. Validação Técnica", logo);
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 20, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight() - 30, "F");
  let sy = sectionTitle(doc, "7. Validação técnica", TOP_MARGIN);
  sy = paragraph(doc, `Os cálculos apresentados foram executados com o PLUGTECH CalcStudio Pro segundo os critérios descritos no capítulo 1. ${p?.engenheiro ? `Responsabilidade técnica: ${p.engenheiro}${p?.carteira ? ` (Carteira ${p.carteira})` : ""}.` : ""}`, sy, 9);
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  const wpg = doc.internal.pageSize.getWidth();
  const baseY = 150;
  const sigW = 70;
  const leftSigX = MARGIN + 6;
  const rightSigX = wpg - MARGIN - 6 - sigW;
  doc.line(leftSigX, baseY, leftSigX + sigW, baseY);
  doc.line(rightSigX, baseY, rightSigX + sigW, baseY);
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Técnico Responsável", leftSigX + sigW / 2, baseY + 6, { align: "center" });
  doc.text("Cliente", rightSigX + sigW / 2, baseY + 6, { align: "center" });
  doc.text(`Data: ${new Date().toLocaleDateString("pt-PT")}`, leftSigX, baseY + 16);


  addFooter(doc);
  const fileBase = p?.obra ? p.obra.replace(/[^\w\-]+/g, "_") : "Projeto";
  doc.save(`PLUGTECH_Relatorio_${fileBase}.pdf`);
}

function orderPanels(panels: Panel[], activeId: string | null): Panel[] {
  const roots = panels.filter(p => !panels.some(q => q.name === p.origin && q.id !== p.id));
  const out: Panel[] = [];
  const visit = (p: Panel) => {
    if (out.some(o => o.id === p.id)) return;
    out.push(p);
    panels.filter(k => k.origin === p.name && k.id !== p.id).forEach(visit);
  };
  (roots.length ? roots : panels).forEach(visit);
  panels.forEach(p => { if (!out.some(o => o.id === p.id)) out.push(p); });
  if (activeId) {
    const i = out.findIndex(o => o.id === activeId);
    if (i > 0) { /* mantém ordem hierárquica */ }
  }
  return out;
}

// Diagrama em árvore dos quadros (quem alimenta quem)
function drawPanelTree(doc: jsPDF, panels: Panel[], startY: number) {
  const roots = panels.filter(p => !panels.some(q => q.name === p.origin && q.id !== p.id));
  const boxH = 22, gapY = 8, indent = 12;
  const full = usableWidth(doc);
  let y = startY + 2;
  const h = doc.internal.pageSize.getHeight();

  const drawNode = (panel: Panel, depth: number) => {
    if (y + boxH > h - 18) {
      doc.addPage("a4", "landscape");
      header(doc, "2. Diagrama de Quadros (cont.)");
      y = TOP_MARGIN;
    }
    const d = Math.min(depth, 5);
    const x = MARGIN + d * indent;
    const boxW = full - d * indent;
    const t = panelTotals(panel);
    doc.setDrawColor(20, 80, 60);
    doc.setLineWidth(0.4);
    doc.setFillColor(d === 0 ? 225 : 240, d === 0 ? 245 : 246, d === 0 ? 232 : 252);
    doc.rect(x, y, boxW, boxH, "FD");
    doc.setTextColor(15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(panel.name, x + 3, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text(`Origem: ${panel.origin}`, x + 3, y + 11);
    doc.text(`Geral: ${t.mainRating} A · ${panel.phase} · ${panel.circuits.length} circ.`, x + 3, y + 15);
    doc.text(`Alim.: ${panel.feederMaterial} ${(panel.feederParallel ?? 1) > 1 ? panel.feederParallel + "× " : ""}${panel.feederSection} mm² · ${panel.feederLength} m`, x + 3, y + 19);

    if (d > 0) {
      doc.setDrawColor(120);
      doc.line(x - indent / 2, y - gapY, x - indent / 2, y + boxH / 2);
      doc.line(x - indent / 2, y + boxH / 2, x, y + boxH / 2);
    }
    y += boxH + gapY;
    panels.filter(k => k.origin === panel.name && k.id !== panel.id).forEach(k => drawNode(k, depth + 1));
  };

  (roots.length ? roots : panels).forEach(r => drawNode(r, 0));

  if (!panels.some(p => panels.some(q => q.name === p.origin && q.id !== p.id))) {
    paragraph(doc, "Nota: não existem quadros parciais alimentados a partir de outros quadros neste projecto.", y + 4);
  }
}


function drawBlockDiagram(doc: jsPDF, panel: Panel, kids: Panel[] = []) {
  const full = usableWidth(doc);
  const pageH = doc.internal.pageSize.getHeight();
  const t = panelTotals(panel);
  const cx = MARGIN + full / 2;

  doc.setDrawColor(20, 80, 60);
  doc.setLineWidth(0.5);

  // Origem
  const boxW = 90, boxH = 22;
  let y = TOP_MARGIN + 4;
  doc.setFillColor(235, 250, 240);
  doc.rect(cx - boxW / 2, y, boxW, boxH, "FD");
  doc.setTextColor(20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Origem: ${panel.origin}`, cx, y + 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Icc: ${panel.iccOriginKA} kA`, cx, y + 16, { align: "center" });

  // Ligação vertical (cabo)
  y += boxH;
  doc.setDrawColor(20, 80, 60);
  doc.line(cx, y, cx, y + 16);
  doc.setFontSize(7.5);
  doc.text(`Cabo ${panel.feederMaterial} ${(panel.feederParallel ?? 1) > 1 ? panel.feederParallel + "× " : ""}${panel.feederSection} mm² · L = ${panel.feederLength} m`, cx + 4, y + 9);
  y += 16;

  // Quadro
  const qW = 110, qH = 26;
  doc.setFillColor(220, 240, 255);
  doc.rect(cx - qW / 2, y, qW, qH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Quadro: ${panel.name}`, cx, y + 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Geral ${t.mainRating} A · ${panel.circuits.length} circuitos`, cx, y + 16, { align: "center" });
  doc.text(`Icc barramento: ${panelIccKA({ ...panel, feederSection: panel.feederSection * Math.max(1, panel.feederParallel ?? 1) }).toFixed(1)} kA`, cx, y + 22, { align: "center" });
  y += qH + 6;

  // Quadros parciais alimentados
  if (kids.length) {
    const kW = (full - 8) / 3;
    kids.slice(0, 6).forEach((k, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = MARGIN + col * (kW + 4);
      const yk = y + row * 18;
      doc.setFillColor(255, 245, 225);
      doc.setDrawColor(190, 150, 60);
      doc.rect(x, yk, kW, 14, "FD");
      doc.setFontSize(7.5);
      doc.setTextColor(20);
      doc.text(doc.splitTextToSize(`${k.name} (parcial)`, kW - 6)[0], x + 3, yk + 6);
      doc.setFontSize(6.8);
      doc.text(`${k.circuits.length} circ. · ${panelTotals(k).mainRating} A`, x + 3, yk + 11);
    });
    y += Math.ceil(Math.min(kids.length, 6) / 3) * 18 + 4;
  }

  // Circuitos
  const perRow = 5;
  const gap = 4;
  const colW = (full - gap * (perRow - 1)) / perRow;
  const cardH = 24;
  const bctx = panelTotals(panel).ctx;
  panel.circuits.forEach((c, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const cy = y + row * (cardH + gap);
    if (cy + cardH > pageH - 16) return;
    const x = MARGIN + col * (colW + gap);
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(150);
    doc.rect(x, cy, colW, cardH, "FD");
    let ns = 7;
    doc.setFontSize(ns);
    while (ns > 4.6 && doc.getTextWidth(c.name) > colW - 5) { ns -= 0.2; doc.setFontSize(ns); }
    doc.setTextColor(20);
    doc.text(c.name, x + 2.5, cy + 6);
    doc.setFontSize(6.4);
    doc.text(`${c.type} ${c.phase}${c.phaseAssign ? "/" + c.phaseAssign : ""}`, x + 2.5, cy + 11.5);
    doc.text(`${c.power} W · L=${c.length} m`, x + 2.5, cy + 16.5);
    const rc = computeCircuit(c, bctx);
    doc.text(`In=${rc.in} A ${rc.curve} · ${rc.parallel > 1 ? rc.parallel + "×" : ""}${rc.section} mm²`, x + 2.5, cy + 21.5);
  });
  doc.setTextColor(0);
}


// ===== Diagrama geral em cascata de TODOS os quadros =====
export async function exportCascadePDF(panels: Panel[], opts?: { logoDataUrl?: string; project?: ProjectInfo }) {
  const doc = patchText(new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }));
  if (!panels.length) return;

  header(doc, "Diagrama Geral em Cascata", opts?.logoDataUrl);

  const h = doc.internal.pageSize.getHeight();

  const ordered = [...panels].sort((a, b) => {
    const aRoot = !panels.some(p => p.name === a.origin) ? 0 : 1;
    const bRoot = !panels.some(p => p.name === b.origin) ? 0 : 1;
    return aRoot - bRoot;
  });

  let y = TOP_MARGIN;
  const pLineC = projectLine(opts?.project);
  if (pLineC) {
    y = paragraph(doc, pLineC, y, 8.5);
  }
  const boxH = 26;
  const gapY = 10;
  const leftX = MARGIN;
  const boxW = usableWidth(doc);

  ordered.forEach((panel, idx) => {
    if (y + boxH + gapY > h - 16) {
      doc.addPage("a4", "landscape");
      header(doc, "Diagrama Geral em Cascata (cont.)", opts?.logoDataUrl);
      y = TOP_MARGIN;
    }

    doc.setDrawColor(20, 80, 60);
    doc.setLineWidth(0.5);
    doc.setFillColor(idx === 0 ? 235 : 220, idx === 0 ? 250 : 240, idx === 0 ? 240 : 255);
    doc.rect(leftX, y, boxW, boxH, "FD");
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(panel.name, leftX + 4, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Origem: ${panel.origin}`, leftX + 4, y + 12);
    doc.text(`Alim.: ${panel.phase} ${panel.voltageMono}/${panel.voltageTri} V · Icc orig ${panel.iccOriginKA} kA · Icc barr. ${panelIccKA(panel).toFixed(1)} kA`, leftX + 4, y + 16.5);

    const t = panelTotals(panel);
    doc.text(`Corte geral: ${t.cutNeed > 100 ? "Fusíveis gG" : "Interruptor"} ${t.mainRating} A`, leftX + 4, y + 21);
    doc.text(`Interligação: ${panel.feederMaterial} ${panel.feederSection} mm² · L = ${panel.feederLength} m`, leftX + 100, y + 21);
    doc.setTextColor(0);

    const rows = panel.circuits.map((c, i) => {
      const r = computeCircuit(c, t.ctx);
      return [String(i + 1), c.name, c.phase + (c.phaseAssign ? "/" + c.phaseAssign : ""),
        `${c.power} W`, `${r.in}A ${r.curve}`, `${r.parallel > 1 ? r.parallel + "×" : ""}${r.section} mm²${c.material === "Al" ? " Al" : ""}`, `${c.length} m`];
    });
    autoTable(doc, {
      ...tableBase(6.5),
      startY: y + boxH + 2,
      margin: { left: MARGIN, right: MARGIN, top: TOP_MARGIN },
      tableWidth: usableWidth(doc),
      head: [["#", "Circuito", "Fase", "P (W)", "Protecção", "Secção", "L (m)"]],
      body: rows.length ? rows : [["—", "Sem circuitos", "", "", "", "", ""]],
      styles: { ...tableBase(6.5).styles, cellPadding: 1.4 },
      columnStyles: {
        0: { halign: "center", cellWidth: 10.3, textColor: [120, 130, 128] },
        1: { fontStyle: "bold", cellWidth: 79.3 },
        2: { cellWidth: 26.4, halign: "center" },
        3: { cellWidth: 32.3, halign: "right" },
        4: { cellWidth: 41.1 },
        5: { cellWidth: 44 },
        6: { cellWidth: 39.6, halign: "right" },
      },

      showHead: "everyPage",
      didDrawPage: () => header(doc, "Diagrama Geral em Cascata (cont.)", opts?.logoDataUrl),
    });
    // @ts-ignore
    const tableEnd = (doc as any).lastAutoTable.finalY;
    y = tableEnd + gapY;
  });


  addFooter(doc);
  doc.save("PLUGTECH_Diagrama_Cascata.pdf");
}

export function exportCSV(panel: Panel) {
  const sep = ";";
  const ctx: FeederContext = {
    iccOriginKA: panel.iccOriginKA, feederMaterial: panel.feederMaterial,
    feederSection: panel.feederSection * Math.max(1, panel.feederParallel ?? 1),
    feederLength: panel.feederLength,
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
