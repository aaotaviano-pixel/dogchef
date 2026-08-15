# DogChef - Redesign da vitrine com referencia da cliente

## Objetivo

Reorganizar a vitrine publica do DogChef para aproximar sua composicao das referencias aprovadas pela cliente, sem copiar o layout literalmente e sem alterar catalogo, precos, pedidos, autenticacao, pagamentos, impressao ou banco de dados.

## Direcao aprovada

A direcao combina os dois pontos mais fortes das referencias:

- corpo da pagina claro, em creme, para preservar leveza e legibilidade;
- hero cinematografico escuro, com produto real em primeiro plano e hierarquia tipografica forte;
- vermelho da marca como comando e destaque, mostarda apenas como acento;
- secoes de categorias e cardapio imediatamente acessiveis, sem transformar a loja em uma pagina apenas institucional;
- faixa escura para os produtos administrados no Showcase, apresentada editorialmente como destaques da casa;
- rodape visualmente completo, com informacoes e canais reais.

## Fonte de verdade

- Logo: `/images/dogchef/dog-do-chef-logo.png`.
- Hero: produtos cadastrados no Showcase; fallback `/images/dogchef/hero-dog-do-chef.webp`.
- Categorias, produtos, precos, disponibilidade, horarios, taxa, Pix e WhatsApp: resposta real de `/api/v1/menu`.
- Destaques: produtos marcados pela administracao, ordenados por `showcaseOrder`. Nao existe alegacao de ranking de vendas.

## Estrutura da pagina

1. Barra utilitaria com horario real, entrega/retirada e Instagram.
2. Cabecalho fixo com marca, navegacao por ancoras, conta e carrinho com total.
3. Hero em carrossel, com imagem do produto, nome, descricao, preco, CTA e controles.
4. Faixa de beneficios baseada somente em capacidades existentes.
5. Categorias visuais com imagens reais do catalogo e rolagem horizontal.
6. Secao escura de destaques selecionados pela administracao.
7. Cardapio completo, filtravel pelas categorias.
8. Bloco institucional curto, sem numeros ou depoimentos inventados.
9. Rodape com marca, horario, Instagram, WhatsApp condicionado a configuracao e links legais.

## Interacoes

- O hero avanca automaticamente em intervalo de 4,8 segundos.
- Interacao manual, hover, foco ou toque pausam temporariamente a rotacao.
- Controles anterior/proximo e indicadores permanecem acessiveis por teclado.
- O carrossel de categorias continua arrastavel no mobile e animado no desktop.
- Elementos entram suavemente ao rolar; `prefers-reduced-motion` desativa animacoes.
- Nenhuma animacao altera o tamanho reservado dos elementos ou bloqueia o carrinho.

## Responsividade

- Desktop: hero amplo, navegacao horizontal e grade de quatro destaques.
- Tablet: navegacao compacta e grades de duas ou tres colunas.
- Mobile: cabecalho enxuto, hero vertical com leitura sobre degradê, categorias arrastaveis e produtos em duas colunas.
- Larguras-alvo: 320, 360, 375, 390, 414, 768, 1024, 1280, 1366, 1440 e 1920 px.

## Invariantes funcionais

- Carrinho, personalizacao, checkout, login, Meus Pedidos e links legais mantem os mesmos handlers.
- Fotos enviadas pela administradora nao sao alteradas.
- Nenhuma migration ou escrita no banco integra esta mudanca.
- WhatsApp nao recebe numero inventado e permanece indisponivel quando nao configurado.
- Pix nao e anunciado como disponivel quando nao configurado.

## Validacao

- Testes unitarios para selecao dos destaques e composicao das categorias.
- `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.
- Verificacao visual e de overflow nas larguras-alvo.
- Smoke test local e em producao para menu, hero, filtros, produto, carrinho e links.
- Comparacao de contagem do catalogo antes e depois, sem alterar dados.
