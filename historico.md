# Historico do DogChef

## 2026-08-02 — Diferenciacao visual da vitrine

- Adicionada diferenciacao tonal dos cards por categoria usando apenas CSS.
- Preservadas as fotos reais, o fallback e os dados do catalogo.
- Reorganizado o carrossel de categorias para usar cards com imagem e loop automatico no desktop.
- Pausado o movimento do carrossel ao passar o mouse ou receber foco.
- Mantida a rolagem manual no mobile.
- Ajustada a composicao do showcase para ocupar melhor o desktop, mantendo a experiencia mobile existente.
- Validacao visual realizada nos tamanhos 375px, 390px, 414px e desktop; sem overflow horizontal ou imagens quebradas.

## 2026-08-02 — Recuperacao de senha de clientes

- Adicionado o link “Esqueci minha senha” ao acesso do cliente.
- Criados os endpoints de solicitacao e conclusao do reset.
- Integrado o envio do link pelo Supabase Auth sem alterar o login interno existente.
- Mantido o hash `scrypt` no banco, sem salvar senha ou token em texto.
- Adicionada pagina `/auth/reset-password` com validacao de sessao, senha e confirmacao.
- Documentadas as Redirect URLs e a necessidade de SMTP proprio para producao.

## 2026-08-02 — Correcao do salvamento do showcase

- Corrigida a funcao SQL `set_showcase_products` para incluir `where featured = true` ao limpar os destaques.
- O Supabase rejeitava o `update` global com `UPDATE requires a WHERE clause`, impedindo adicionar produtos ao showcase.
- A correcao foi isolada em uma migration nova e preserva a troca atomica da selecao de ate cinco produtos ativos.

## 2026-08-02 — Identidade visual aprovada e canais sociais

- Aplicada a paleta oficial vermelho `#D6402C`, mostarda `#F0A202`, grelha `#241C15`, creme `#FFF6EC` e verde `#5B8C3A` na vitrine.
- Mantida a diferenciacao sistematica dos cards por categoria sem editar imagens reais ou fallback.
- Melhorada a interacao do carrossel de categorias com pausa temporaria em toque, foco, roda do mouse e selecao.
- Adicionada pilha circular de Instagram e WhatsApp inspirada na referencia Dona Gula, sem alterar o checkout.
- Instagram aponta para o perfil Dog do Chef; WhatsApp aguarda o numero comercial da cliente.

## 2026-08-02 — Showcase e senha administrativa

- Corrigido o fallback do showcase para aceitar funcao SQL antiga sem exibir o aviso de migration quando as atualizacoes filtradas conseguem concluir.
- Aplicada no Supabase a funcao `set_showcase_products` com `where featured = true`.
- Criada e aplicada a tabela `admin_settings`, que guarda somente o hash da senha administrativa.
- Adicionada a troca de senha em Configuracoes, com senha atual e confirmacao dupla da nova.
- Removido o acesso administrativo do rodape publico; o link direto continua em `/admin/login`.
- Ativada apenas localmente a previa `NEXT_PUBLIC_DOGCHEF_DARK_PREVIEW=true` para avaliacao visual.
- Corrigida a codificacao do salt no hash `scrypt` da senha administrativa para que a validacao apos o bootstrap funcione corretamente.

## 2026-08-02 — Logo oficial Dog do Chef

- Substituido o icone generico pela arte oficial enviada pela cliente em todos os pontos de marca.
- Atualizados storefront, acesso administrativo, autentificacao, paginas legais e rastreamento por meio do `.brand-mark` global.
- Atualizados favicon, manifest e icones de notificacao para usar a mesma arte em PNG.
- Nenhum dado, produto, pedido ou fluxo de negocio foi alterado.

## 2026-08-02 — Diferenciacao visual por descricao do produto

- Ajustados os cards para diferenciar produtos por nome, descricao e categoria.
- Criados tratamentos especificos para duplo, bacon, calabresa, queijos, cortes nobres, monstro, combos, gratinados, porcoes e bebidas.
- Adicionadas molduras, fundos, detalhes e etiquetas curtas sem alterar fotos reais.
- Corrigidas prioridades para ingredientes comuns como batata palha, mussarela e bacon nao classificarem a categoria errada.
- Confirmada a ausencia de overflow horizontal no catalogo local.

## 2026-08-02 — Tema escuro, interacoes e canais sociais

- Tema escuro aplicado por padrao ao storefront, com cores de contraste derivadas da identidade Dog do Chef.
- Instagram passou a usar o link comercial oficial, icone de camera compativel com a biblioteca atual e gradiente caracteristico.
- Rodape reorganizado com assinatura da marca, contato social e links legais em uma faixa escura.
- Animacoes de entrada durante o scroll ficaram mais perceptiveis no mobile, com atraso progressivo por card e respeito a `prefers-reduced-motion`.
- Showcase ajustado para alternar automaticamente a cada 4,8 segundos; quando nao ha selecao manual, usa ate cinco produtos disponiveis como fallback.
- Validacoes permanecem no servidor nas rotas de cadastro, checkout, imagens, showcase, login, pedidos e webhooks.

## 2026-08-02 — Rate limiting distribuido das APIs

- Adicionado `middleware.ts` compativel com Edge Runtime para interceptar `/api/v1/*`.
- Criadas politicas diferenciadas para leitura publica, autenticacao, pedidos e demais escritas.
- Adicionadas `@upstash/ratelimit` e `@upstash/redis` com versoes fixadas.
- Documentadas as variaveis Upstash no `.env.example` e no README.
- Upstash `dogchef-ratelimit` provisionado no plano Free, conectado aos ambientes Production
  e Preview da Vercel e validado em producao pelos headers de rate limit.

## 2026-08-09 — Vitrine clara e seleção de impressora

- O tema claro passou a ser o padrao do storefront; o modo escuro ficou opt-in por
  `NEXT_PUBLIC_DOGCHEF_DARK_PREVIEW=true`.
- A paleta clara foi reforcada com creme, vermelho, mostarda e verde, preservando o
  emblema oficial e sem alterar fotos enviadas pela administradora.
- O painel ganhou seletor de impressora. O perfil escolhido fica no navegador e acompanha
  confirmacoes e reimpresses; o agente local resolve o endereco por ID.
- `agent/index.ts` passou a aceitar varios perfis em `PRINTER_PROFILES_JSON`, mantendo
  compatibilidade com a configuracao de uma unica impressora.

## 2026-08-09 — Reset seguro dos indicadores e descoberta Windows

- O painel passou a zerar indicadores por marco no `audit_log`, preservando pedidos e clientes.
- O agente Windows passou a descobrir impressoras instaladas via `Win32_Printer`.
- A lista descoberta, estado e impressora padrao sao exibidos no painel pela tabela `print_agents`.
- Tickets para impressoras descobertas usam o spooler RAW do Windows; perfis TCP e compartilhados continuam suportados.
