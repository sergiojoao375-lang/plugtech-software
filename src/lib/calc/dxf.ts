// Exportação DXF (R12, texto ASCII) — esquema unifilar + tabela de cargas por quadro
import type { Circuit, CalcResult } from "./engine";

class Dxf {
  private out: string[] = [];
  line(x1: number, y1: number, x2: number, y2: number, layer = "0", color = 7) {
    this.out.push("0", "LINE", "8", layer, "62", String(color), "10", f(x1), "20", f(y1), "30", "0", "11", f(x2), "21", f(y2), "31", "0");
  }
  text(x: number, y: number, h: number, s: string, layer = "TEXTO", rot = 0) {
    this.out.push("0", "TEXT", "8", layer, "10", f(x), "20", f(y), "30", "0", "40", f(h), "1", ascii(s), "50", f(rot));
  }
  circle(x: number, y: number, r: number, layer = "0") {
    this.out.push("0", "CIRCLE", "8", layer, "10", f(x), "20", f(y), "30", "0", "40", f(r));
  }
  rect(x: number, y: number, w: number, h: number, layer = "0") {
    this.line(x, y, x + w, y, layer); this.line(x + w, y, x + w, y + h, layer);
    this.line(x + w, y + h, x, y + h, layer); this.line(x, y + h, x, y, layer);
  }
  toString() { return ["0", "SECTION", "2", "ENTITIES", ...this.out, "0", "ENDSEC", "0", "EOF"].join("\r\n"); }
}
const f = (n: number) => n.toFixed(3);
const ascii = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/Δ/g, "dU").replace(/φ/g, "phi").replace(/×/g, "x").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/[^\x20-\x7E]/g, "");

export function exportPanelDXF(panel: { name: string; phase: string }, mainLabel: string, rows: Array<{ c: Circuit; r: CalcResult }>) {
  const d = new Dxf();
  const step = 25;
  const n = Math.max(1, rows.length);
  const busW = n * step + 20;
  const busY = 200;
  d.text(0, busY + 60, 6, `QUADRO ${panel.name} - ESQUEMA UNIFILAR`, "TITULO");
  // Entrada + aparelho geral
  d.line(10, busY + 50, 10, busY + 25, "ENTRADA");
  d.line(10, busY + 25, 16, busY + 15, "APARELHOS");
  d.line(10, busY + 15, 10, busY, "ENTRADA");
  d.text(14, busY + 30, 3, mainLabel, "TEXTO");
  // Barramento
  d.line(0, busY, busW, busY, "BARRAMENTO", 1);
  d.line(0, busY - 1.5, busW, busY - 1.5, "BARRAMENTO", 3);
  d.line(0, busY - 3, busW, busY - 3, "BARRAMENTO", 5);
  rows.forEach(({ c, r }, i) => {
    const x = 20 + i * step;
    const y0 = busY - 3;
    d.line(x, y0, x, y0 - 15, "SAIDAS");
    // símbolo de disjuntor IEC: contacto inclinado + cruz
    d.line(x, y0 - 15, x + 5, y0 - 25, "APARELHOS");
    d.line(x - 1.5, y0 - 13.5, x + 1.5, y0 - 16.5, "APARELHOS");
    d.line(x + 1.5, y0 - 13.5, x - 1.5, y0 - 16.5, "APARELHOS");
    d.line(x, y0 - 25, x, y0 - 70, "SAIDAS");
    d.circle(x, y0 - 73, 3, "CARGAS");
    d.text(x + 3, y0 - 22, 2.2, `${r.in}A ${r.curve} ${r.icuKA}kA`);
    d.text(x - 1, y0 - 115, 2.2, `${c.name} | ${r.parallel > 1 ? r.parallel + "x" : ""}${r.section}mm2 ${c.material ?? "Cu"} | ${(c.power / 1000).toFixed(2)}kW`, "TEXTO", 90);
    d.text(x - 1, y0 - 40, 2, `C${i + 1}`, "TEXTO");
  });
  // Tabela de cargas
  const cols = ["#", "Circuito", "P(W)", "Ib(A)", "In(A)", "Curva", "Seccao", "Iz(A)", "dU%", "Icc(kA)", "PdC(kA)"];
  const widths = [10, 60, 22, 20, 18, 16, 30, 18, 18, 20, 20];
  let ty = busY - 140;
  const rowH = 6;
  const totalW = widths.reduce((a, b) => a + b, 0);
  d.text(0, ty + 6, 4, "TABELA DE CARGAS", "TITULO");
  const drawRow = (vals: string[]) => {
    let x = 0;
    d.rect(0, ty - rowH, totalW, rowH, "TABELA");
    vals.forEach((v, k) => { d.text(x + 1, ty - rowH + 1.8, 2.4, v); x += widths[k]; if (k < vals.length - 1) d.line(x, ty, x, ty - rowH, "TABELA"); });
    ty -= rowH;
  };
  drawRow(cols);
  rows.forEach(({ c, r }, i) => drawRow([String(i + 1), c.name.slice(0, 28), c.power.toFixed(0), r.ib.toFixed(1), String(r.in), r.curve,
    `${r.parallel > 1 ? r.parallel + "x" : ""}${r.section}`, String(r.iz), r.deltaU.toFixed(2), r.iccTerm.toFixed(2), String(r.icuKA)]));

  const blob = new Blob([d.toString()], { type: "application/dxf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${ascii(panel.name).replace(/[^a-zA-Z0-9]+/g, "_") || "quadro"}_unifilar.dxf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
