<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Professional tools (inline edit, batch, templates, audit, inspector, capacitor, single-line, DIN front, trip curves) live in src/components/calcstudio/ProTools.tsx with pure logic in src/lib/calc/{audit,curves,capacitor,dxf}.ts — keeps CalcStudio.tsx from growing and logic testable/offline.
- Panel equipment (SPD, MX coil, ATS/generator, UPS, busbars, control modules with terminals) is stored in `Panel.equip`; logic in src/lib/calc/equipment.ts, UI in EquipmentManager.tsx — keeps checks reusable by audit and the single-line diagram.
