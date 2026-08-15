# DogChef - Plano de implementacao do redesign

**Objetivo:** entregar a vitrine aprovada pela cliente preservando integralmente os fluxos comerciais existentes.

**Arquitetura:** manter `Storefront` como orquestrador dos estados e handlers. Extrair apenas derivacoes puras do catalogo para `src/lib/storefront-presentation.ts`, cobertas por testes. Aplicar a nova composicao sem alterar contratos de API e concentrar os estilos novos em uma camada final, escopada por `.dogchef-store`.

## Etapa 1 - Travar as regras de apresentacao

1. Criar testes para a selecao do Showcase e os cards de categoria.
2. Executar os testes e confirmar a falha esperada antes da implementacao.
3. Implementar os helpers puros e substituir as derivacoes inline equivalentes.

## Etapa 2 - Reestruturar a vitrine

1. Substituir o cabecalho compacto por barra utilitaria, navegacao responsiva e resumo do carrinho.
2. Reorganizar o hero existente como apresentacao cinematografica, mantendo produtos e controles reais.
3. Adicionar a faixa de beneficios reais.
4. Posicionar categorias antes dos destaques e manter sua filtragem.
5. Transformar os destaques administrados em uma faixa editorial escura.
6. Preservar o cardapio completo e seus modais.
7. Adicionar bloco institucional e rodape com informacoes verdadeiras.

## Etapa 3 - Interacao e acessibilidade

1. Pausar o carrossel do hero durante interacao e quando a pagina nao estiver visivel.
2. Manter controles de teclado, rotulos acessiveis e foco visivel.
3. Respeitar `prefers-reduced-motion`.
4. Garantir que animacoes usem apenas opacidade e transformacao.

## Etapa 4 - Estilo responsivo

1. Adicionar tokens e estilos finais escopados, sem afetar admin, conta ou rastreio.
2. Validar hero, cabecalho, categorias, destaques, menu e rodape em mobile, tablet e desktop.
3. Corrigir overflow, recortes, sobreposicoes e contraste.

## Etapa 5 - Verificacao e publicacao

1. Executar testes, typecheck, lint e build.
2. Testar localmente home, filtros, produto, carrinho, quantidades, total e links.
3. Registrar a alteracao no Segundo Cerebro.
4. Fazer commit e push em `main`.
5. Aguardar a Vercel publicar e repetir o smoke test no dominio de producao.
