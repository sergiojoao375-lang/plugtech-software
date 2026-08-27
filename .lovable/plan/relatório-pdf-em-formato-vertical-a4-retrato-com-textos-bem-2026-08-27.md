# Relatório PDF em formato vertical (A4 retrato) com textos bem enquadrados

## Objectivo
Passar todo o relatório de A4 horizontal para A4 vertical e corrigir os textos que saem da folha ou ficam com espaçamento estranho (como no capítulo de Selectividade).

## O que muda

1. **Orientação vertical**
   - Documento principal e o documento de diagramas passam a `portrait`.
   - Todas as páginas novas passam a ser adicionadas em vertical.
   - Capa, cabeçalho, rodapé e caixas de diagrama recalculados a partir da nova largura (210 mm) em vez de valores pensados para 297 mm.

2. **Textos enquadrados**
   - Parágrafos e listas com quebra de linha calculada sobre a largura útil real (margens de 12 mm de cada lado), incluindo os pontos com marcador, que passam a ter recuo correcto na 2.ª linha em diante.
   - Remoção do alinhamento justificado que provoca o espaçamento exagerado entre letras visível na imagem.
   - Altura de linha corrigida (actualmente subdimensionada), evitando linhas sobrepostas.
   - Verificação de espaço antes de cada bloco de texto para não cortar frases no fim da página.

3. **Tabelas adaptadas ao retrato**
   - Tabela de circuitos: larguras de coluna redefinidas para caber em 186 mm, com cabeçalhos abreviados onde necessário (P (W), S (VA), Ib (A), Iz (A), ΔU %, Icc (kA)) e fonte ligeiramente reduzida.
   - Tabelas de selectividade, materiais e diagramas com larguras proporcionais à nova página e quebra de linha nas colunas de texto (Observação técnica).
   - Cabeçalho repetido em cada página mantido.

4. **Diagramas**
   - Diagrama de quadros e blocos de circuitos reorganizados em coluna(s) que cabem na largura vertical, com paginação automática quando ultrapassam a altura.

## Nota técnica
Alterações concentradas em `src/lib/calc/export.ts`: constante única de orientação/margens, helper `paragraph`/`bullet` reescrito, `columnStyles` de cada `autoTable` recalculado e geometria dos diagramas baseada na largura da página.
