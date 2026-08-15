# Convencoes do DogChef

## Paleta oficial da vitrine

- Vermelho: `#D6402C` para chamadas principais, estados ativos e acentos de apetite.
- Mostarda: `#F0A202` para selos, indicadores e contraste pontual.
- Grelha: `#241C15` para textos fortes e contraste escuro sem dominar a tela.
- Creme: `#FFF6EC` para fundo da loja e areas que deixam as fotos respirarem.
- Verde: `#5B8C3A` para disponibilidade e sinais positivos.
- Tons claros de apoio sao derivados desses cinco tokens e ficam concentrados em `src/app/globals.css`.

## Diferenciacao visual dos produtos

Os cards da vitrine usam o identificador estavel da categoria como classe de apresentacao:

- `product-card--tradicionais`
- `product-card--prensadoes`
- `product-card--combos`
- `product-card--dog-no-pote`
- `product-card--porcoes`
- `product-card--bebidas`

Cada categoria recebe um fundo claro e um acento derivado da paleta oficial do DogChef. O tratamento vive em `src/app/globals.css` e apenas enquadra a imagem; os arquivos reais de imagem nao sao alterados.

O fallback de produto sem foto continua sendo resolvido no servidor por `src/lib/store.ts`.

## Recuperacao de senha

- O link de recuperacao fica disponivel no login de cliente.
- A resposta do pedido e generica, mesmo quando o e-mail nao existe.
- O token de recuperacao pertence ao Supabase Auth e nunca e salvo em tabela, log ou cookie proprio.
- O hash interno continua sendo `scrypt` com salt aleatorio; nenhuma senha e armazenada em texto.
- A pagina de troca exige nova senha e confirmacao antes de concluir.

## Showcase

- A selecao do showcase aceita no maximo cinco produtos ativos e preserva a ordem escolhida pelo admin.
- A limpeza de destaques sempre usa filtro explicito (`featured = true`); nunca executar `UPDATE` global sem `WHERE`.
- A migration `20260802190000_fix_showcase_update_where.sql` e a correcao definitiva da funcao SQL. A API mantem fallback filtrado para compatibilidade durante a atualizacao do banco remoto.
- Rotas e URLs de redirect devem ser mantidas no Supabase para cada ambiente autorizado.

## Categorias da vitrine

As categorias sao exibidas em um carrossel horizontal. No desktop, o trilho se move continuamente e pausa ao receber foco ou ao passar o mouse. No mobile, a navegacao fica manual por toque para preservar controle e desempenho. A segunda copia visual do trilho e decorativa e nao entra na navegacao por teclado.

Toque, foco, roda do mouse ou selecao de categoria pausam o movimento por 4,8 segundos antes de retomar. A categoria selecionada recebe o destaque vermelho-claro, sem alterar o filtro de produtos ate a escolha do cliente.

## Canais sociais

- Instagram usa exclusivamente `https://www.instagram.com/dogdochef_prensado/`.
- Os botoes flutuantes usam formato circular, empilhamento vertical e areas de toque de 46px no mobile.
- WhatsApp usa o verde oficial quando configurado; enquanto o numero comercial estiver pendente, o link fica com o placeholder `[PENDENTE-CLIENTE]` e nao abre uma conversa invalida.
- O WhatsApp social e apenas contato; nao substitui o checkout nem o fluxo de pedidos.

## Senha administrativa

- `ADMIN_PASSWORD` e apenas a credencial inicial do ambiente.
- A troca acontece em Configuracoes com senha atual, nova senha e confirmacao repetida.
- A tabela `admin_settings` armazena somente hash `scrypt` com salt; nunca salvar senha em texto.
- O bootstrap por `ADMIN_PASSWORD` fica disponivel somente ate a primeira troca confirmada no painel.
- O link direto do painel e `/admin/login` e nao aparece no rodape publico.

## Previa visual local

- O storefront usa corpo creme, hero/cardapio/rodape escuros, destaques e `Sobre nos`
  claros, com comandos vermelhos.
- `NEXT_PUBLIC_DOGCHEF_DARK_PREVIEW` e legado e nao controla mais a composicao publica.
- A decisao e somente visual; nunca alterar dados ou regras de negocio para mudar o tema.

## Vitrine aprovada em 2026-08-15

- Usar `/api/v1/menu` como unica fonte de categorias, disponibilidade, horarios, taxa e
  capacidades de pagamento/contato.
- O hero usa produtos ativos do Showcase, ordenados por `showcaseOrder`, com fallback
  somente para produtos ativos do catalogo.
- Sem ranking confiavel, usar "Destaques da casa"; nao inventar "mais vendidos",
  avaliacoes, quantidade de clientes, promocoes ou beneficios.
- O carrossel avanca em 4,8 segundos, pausa por 7 segundos apos interacao e para quando a
  aba nao esta visivel.
- Controles precisam funcionar por teclado, e animacoes devem respeitar
  `prefers-reduced-motion`.
- Fotos cadastradas no painel continuam sendo renderizadas diretamente, sem edicao.

## Marca oficial

- A marca oficial e o arquivo `public/images/dogchef/dog-do-chef-logo.png`, usando exatamente o emblema enviado pela cliente.
- O `.brand-mark` usa esse arquivo como imagem de fundo no storefront, painel, login, paginas legais, recuperacao de senha e rastreamento.
- O favicon, manifest e notificacoes do navegador usam `public/icon.png`, uma copia da mesma arte.
- Nao substituir o emblema por icones genericos sem uma nova aprovacao de identidade visual.

## Diferenciacao visual dos produtos

- `productVisualTreatment` le nome, descricao e categoria para escolher uma identidade visual deterministica por produto.
- Os tratamentos cobrem duplo, bacon, calabresa, queijos, cortes nobres, monstro, combo, gratinado, porcao, bebidas e classicos.
- A diferenciacao vive somente em classes e tokens CSS no storefront: fundo, moldura, detalhe e etiqueta curta.
- `product.imageUrl` e `product.images` continuam sendo usados sem edicao, reprocessamento ou substituicao, inclusive quando a foto foi enviada pela administradora.

## Movimento e fluxo tonal da vitrine

- Em ate 619 px, o hero publico usa retangulo 4:3; nao voltar ao empilhamento vertical de
  imagem e texto com 620 px de altura.
- A manchete anima em tres etapas quando o produto do Showcase muda e fica estatica sob
  `prefers-reduced-motion`.
- Categorias reais rodam automaticamente na faixa vermelha. A segunda copia e apenas
  visual, usa `aria-hidden` e nao recebe foco.
- Interacao pausa a faixa temporariamente e retoma em 4,8 segundos; foco de toque nao pode
  prender a animacao. Botoes originais continuam filtrando o menu.
- A manchete do hero alterna exatamente tres mensagens curtas e verdadeiras no ciclo do
  Showcase. Nao inserir ranking, promocao ou promessa comercial sem fonte real.
- Sob `prefers-reduced-motion`, manter a manchete estatica e reduzir a velocidade da faixa
  de categorias, sem desativar o movimento automatico solicitado.
- `Destaques da casa` usa superficie clara. O wrapper `.storefront-dark-flow` comeca em
  `Escolha seu favorito`; desde a primeira categoria, cards e textos usam tema escuro.
  O wrapper termina junto com o cardapio e `Sobre nos` volta para superficie branca com
  texto escuro.
- No mobile, Instagram e WhatsApp ficam no final da pagina, sem flutuar sobre produtos.

## Protecao de API

- Rate limiting distribuido fica centralizado em `middleware.ts`.
- A chave de limite combina host e IP validado de `x-real-ip` ou `x-forwarded-for`.
- Respostas bloqueadas usam status 429, `code: RATE_LIMITED` e `Retry-After`.
- Credenciais Upstash sao server-side e nunca usam prefixo `NEXT_PUBLIC_`.

## Impressao

- Em Windows, a lista de impressoras instaladas vem do agente local autenticado e e gravada
  apenas como capacidade operacional em `print_agents`; nomes, estado e padrao aparecem no
  painel, mas enderecos e credenciais nunca aparecem no frontend.
- O spooler RAW do Windows recebe tickets ESC/POS para a impressora selecionada.
- `PRINT_PRINTER_OPTIONS` e `PRINTER_PROFILES_JSON` permanecem como fallback para rede,
  compartilhamento e ambientes sem descoberta automatica.
- O painel salva a escolha no navegador e envia o ID junto ao ticket.
- Perfis `transport=ipp` sao resolvidos somente pelo agente local; URI IPP nunca vai para
  variavel `NEXT_PUBLIC_` nem e acessada pelo servidor Vercel.
- O botao **Testar impressao** usa `print_jobs.kind=test` e `order_id=null` apos a migration
  aditiva; nao criar pedido falso para testar hardware.

## Indicadores

- Para zerar somente os numeros exibidos, usar o marco auditavel de `dashboard_metrics_reset`.
- Nunca apagar ou sobrescrever pedidos, pagamentos ou clientes para limpar um dashboard.

## Pagamentos

- Validar assinatura, timestamp, pedido, moeda e valor antes de processar webhook.
- Registrar e deduplicar entregas; consultar o pedido diretamente, sem carregar a lista
  administrativa inteira.
- Nunca rebaixar pagamento aprovado por evento atrasado.
