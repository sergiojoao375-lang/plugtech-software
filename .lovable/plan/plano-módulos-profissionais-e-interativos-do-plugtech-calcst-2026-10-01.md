# Plano: Módulos profissionais e interativos do PLUGTECH CalcStudio

Tudo o que foi sugerido é implementado em 4 fases, por esta ordem. Cada fase fica utilizável e é testada antes de passar à seguinte.

## Fase 1 — Produtividade (ganho diário imediato)
- **Edição direta na tabela**: duplo clique em Nome, Potência, Comprimento e cosφ altera o valor e recalcula logo (Enter guarda, Esc cancela).
- **Ações em massa**: uma caixa de seleção por linha e "selecionar todos". Barra de ações para: mudar cabo, material, cenário de instalação, tipo, fase; duplicar; apagar.
- **Biblioteca de circuitos prontos**: botões de um clique — Carregador VE 7,4 kW (mono) e 22 kW (tri), Bomba de calor / AVAC tri, Tomadas gerais 16 A, Iluminação LED 10 A, Motor de arranque direto.

## Fase 2 — Auditoria e memória de cálculo
- **Painel de conformidade (semáforo)** por quadro, em tempo real: ΔU acumulada acima de 3 % / 5 %, tomadas sem diferencial ≤ 30 mA, cabo em sobrecarga, In > Iz, poder de corte insuficiente, desequilíbrio de fases. Clicar num aviso abre o circuito.
- **Inspetor de circuito**: ao selecionar um circuito, painel lateral com as fórmulas e os números substituídos (S, Ib, In, Iz, ΔU, Icc, poder de corte).
- **Bateria de condensadores**: cálculo dos kVAr necessários para elevar o cosφ do quadro para 0,95 ou 0,98, com escalão comercial sugerido.

## Fase 3 — Visualização gráfica
- **Esquema unifilar no ecrã**: barramento L1/L2/L3 com cores normalizadas, aparelho geral, saídas com símbolos IEC, secção e calibre por saída; clicar numa saída abre a edição.
- **Frontal do quadro (calhas DIN)**: módulos de 18 mm, disjuntores 1P/2P/3P/4P a ocupar o espaço real, reserva de 30 % visível, número de filas calculado.
- **Curvas tempo-corrente**: gráfico log-log com as curvas B, C, D e fusível gG do geral e do circuito selecionado, com indicação de seletividade total/parcial até ao Icc do quadro.

## Fase 4 — Integração CAD
- **Exportação DXF** (abre em AutoCAD/BricsCAD): esquema unifilar do quadro e tabela de cargas, um ficheiro por quadro.

## Detalhes técnicos
- Novos componentes separados em `src/components/calcstudio/` (InlineCell, BatchBar, CircuitTemplates, AuditPanel, CircuitInspector, CapacitorBank, SingleLineDiagram, DinFrontView, TripCurves) para não aumentar mais o `CalcStudio.tsx`.
- Lógica nova em `src/lib/calc/` (audit.ts, curves.ts com aproximação normalizada IEC 60898/60269, capacitor.ts, dxf.ts gerando DXF R12 em texto — sem dependências, funciona offline no Electron).
- Diagramas em SVG puro; tudo continua a funcionar offline e a guardar no armazenamento local.
- Vistas organizadas em separadores dentro do quadro: Circuitos | Unifilar | Frontal | Curvas | Auditoria.
