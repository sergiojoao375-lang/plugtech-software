import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CalcStudio from "@/components/calcstudio/CalcStudio";
import "@/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CalcStudio />
  </StrictMode>,
);
