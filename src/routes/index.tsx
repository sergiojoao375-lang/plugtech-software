import { createFileRoute } from "@tanstack/react-router";
import CalcStudio from "@/components/calcstudio/CalcStudio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PLUGTECH CalcStudio Pro — SérgioTech" },
      { name: "description", content: "Software profissional de cálculo de instalações elétricas BT segundo RTIEBT. Dimensionamento, ΔU, Icc, equilíbrio de fases e exportação PDF/CSV." },
      { property: "og:title", content: "PLUGTECH CalcStudio Pro — SérgioTech" },
      { property: "og:description", content: "Cálculo profissional de quadros elétricos BT (RTIEBT). Tecnologia que liga soluções." },
    ],
  }),
  component: () => <CalcStudio />,
});
