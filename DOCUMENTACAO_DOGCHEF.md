# Documentacao do Projeto DogChef

Ultima verificacao local: 31/07/2026.

Este documento resume onde esta o projeto DogChef, como ele esta estruturado, quais tecnologias usa, quais comandos executar e o que ainda precisa ser configurado para funcionar como produto em producao.

## 1. Localizacao

O projeto foi localizado em:

```text
C:\DOGCHEF
```

A conversa local do Codex encontrada para este projeto aparece como:

```text
Nome: Criar plataforma DogChef
ID: 019fb60d-0f4a-7972-91d0-dfe817426d4a
```

Tambem existem prompts/anexos locais do Codex citando que o projeto deveria ser criado em `C:\DOGCHEF`.

## 2. Status atual encontrado

O projeto existe localmente e contem codigo de uma plataforma de pedidos chamada DogChef.

Status tecnico observado:

- Existe `package.json`.
- Existe `node_modules`, indicando que dependencias ja foram instaladas ao menos uma vez.
- Existe `.next`, indicando que o projeto ja foi executado ou buildado.
- Existe pasta `src` com app Next.js.
- Existe pasta `supabase` com migrations SQL.
- Existe pasta `agent` com agente local de impressao.
- Nao existe pasta `.git` em `C:\DOGCHEF`.
- Nao existe `.vercel/project.json`.

Conclusao: o projeto esta localmente criado, mas nao esta versionado em Git nessa pasta e nao esta vinculado a um projeto Vercel nessa pasta.

## 3. Stack principal

Tecnologias identificadas no `package.json`:

- Next.js `16.2.12`
- React `19.2.8`
- TypeScript `5.9.3`
- Supabase JS `2.111.0`
- Mercado Pago SDK `3.2.1`
- Zod `4.4.3`
- Lucide React `1.28.0`
- ESLint `9.39.5`
- TSX `4.23.1`

O projeto e um app web moderno com rotas de frontend e API usando Next.js App Router.

## 4. Objetivo do sistema

O DogChef foi planejado como uma plataforma de pedidos para uma operacao de lanches/restaurante, com:

- Cardapio online.
- Checkout.
- Pedido para retirada ou entrega.
- Pagamento via Pix, dinheiro ou cartao.
- Acompanhamento publico do pedido por codigo.
- Painel administrativo.
- Gestao completa de produtos com cadastro, edicao, exclusao e galeria de fotos.
- Showcase administravel com ate cinco produtos e ordem configuravel.
- Controle de status do pedido.
- Integracao com Mercado Pago para Pix.
- Webhook de pagamento.
- Botao opcional de atendimento por WhatsApp, sem mensagens automaticas de pedido.
- Login opcional com Google por Supabase Auth.
- Avisos de status dentro do site e notificacoes do navegador mediante permissao.
- Agente local para impressao termica ESC/POS.
- Banco persistente via Supabase/PostgreSQL.

## 5. Estrutura de pastas

Estrutura principal localizada:

```text
C:\DOGCHEF
|-- agent
|   |-- .env.example
|   `-- index.ts
|-- public
|   `-- icon.svg
|-- src
|   |-- app
|   |-- components
|   `-- lib
|-- supabase
|   |-- config.toml
|   `-- migrations
|-- .env.example
|-- .gitignore
|-- eslint.config.mjs
|-- next.config.ts
|-- package.json
|-- package-lock.json
|-- README.md
`-- tsconfig.json
```

## 6. Arquivos importantes

### `package.json`

Define scripts e dependencias do projeto.

Scripts disponiveis:

```powershell
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run print-agent
```

### `.env.example`

Modelo das variaveis de ambiente da aplicacao.

Inclui configuracoes para:

- URL publica da aplicacao.
- Senha administrativa.
- Segredo de sessao administrativa.
- Supabase.
- Mercado Pago.
- WhatsApp Cloud API.
- Google Maps.
- Agente local de impressao.

Nao deve conter credenciais reais.

### `agent/.env.example`

Modelo de configuracao especifico para o computador que ficara conectado a impressora termica.

Inclui:

- URL da API DogChef.
- Token do agente.
- ID do agente.
- Transporte da impressora.
- IP/porta de impressora de rede.
- Compartilhamento Windows para impressora USB.

### `README.md`

Ja contem instrucoes de execucao local, Supabase, Vercel, Pix, WhatsApp, Google Maps, painel admin e agente de impressao.

### `supabase/migrations`

Contem migrations SQL para criar schema e dados iniciais.

Migrations encontradas:

```text
20260731030445_initial_schema.sql
20260731154338_seed_dog_do_chef_catalog.sql
```

## 7. Rotas de frontend

Rotas principais identificadas:

```text
/
/pedido/[publicCode]
/admin
/admin/login
```

Funcao esperada:

- `/`: vitrine/cardapio e checkout.
- `/pedido/[publicCode]`: acompanhamento publico de pedido.
- `/admin/login`: login administrativo.
- `/admin`: painel administrativo.

## 8. Rotas de API

APIs identificadas:

```text
/api/v1/menu
/api/v1/orders
/api/v1/orders/[publicCode]
/api/v1/admin/login
/api/v1/admin/logout
/api/v1/admin/dashboard
/api/v1/admin/orders/[id]/status
/api/v1/admin/products/[id]
/api/v1/admin/settings/accepting-orders
/api/v1/admin/working-hours
/api/v1/payments/webhook
/api/v1/whatsapp/webhook
/api/v1/print-agent/heartbeat
/api/v1/print-agent/jobs/claim
/api/v1/print-agent/jobs/[id]/complete
```

Leitura funcional:

- `menu`: entrega catalogo/cardapio.
- `orders`: cria pedidos.
- `orders/[publicCode]`: consulta pedido publico.
- `admin/*`: login, logout, painel e acoes administrativas.
- `payments/webhook`: recebe confirmacoes do Mercado Pago.
- `whatsapp/webhook`: recebe eventos/verificacao da Meta.
- `print-agent/*`: comunicacao do agente local de impressao.

## 9. Componentes principais

Componentes encontrados:

```text
src/components/storefront.tsx
src/components/order-tracker.tsx
src/components/admin-login.tsx
src/components/admin-dashboard.tsx
```

Papeis provaveis:

- `storefront.tsx`: interface do cliente e fluxo de compra.
- `order-tracker.tsx`: tela de acompanhamento do pedido.
- `admin-login.tsx`: tela de login do admin.
- `admin-dashboard.tsx`: painel administrativo.

## 10. Bibliotecas internas

Arquivos em `src/lib`:

```text
auth.ts
checkout.ts
http.ts
integrations/mercado-pago.ts
integrations/whatsapp.ts
money.ts
orders.ts
print-agent-auth.ts
seed.ts
shop.ts
store.ts
supabase.ts
types.ts
```

Leitura funcional:

- `auth.ts`: autenticacao administrativa.
- `checkout.ts`: validacao e precificacao do pedido.
- `http.ts`: helpers de resposta HTTP.
- `mercado-pago.ts`: integracao Pix/Mercado Pago.
- `whatsapp.ts`: integracao WhatsApp Cloud API.
- `money.ts`: formatacao/conversao de dinheiro em centavos.
- `orders.ts`: regras e persistencia de pedidos.
- `print-agent-auth.ts`: autenticacao do agente de impressao.
- `seed.ts`: dados/fallback de desenvolvimento.
- `shop.ts`: regras de cardapio/loja.
- `store.ts`: armazenamento local/fallback ou acesso aos dados.
- `supabase.ts`: cliente Supabase server-side.
- `types.ts`: tipos TypeScript do dominio.

## 11. Modelo de dominio

Tipos principais identificados em `src/lib/types.ts`:

- `Product`
- `Category`
- `OptionGroup`
- `Option`
- `DeliveryZone`
- `WorkingHour`
- `Catalog`
- `CartLine`
- `CheckoutInput`
- `Quote`
- `Order`
- `OrderStatus`
- `PaymentStatus`
- `PaymentMethod`
- `DeliveryType`

Status de pedido:

```text
pending_approval
confirmed
preparing
out_for_delivery
delivered
cancelled
```

Formas de pagamento:

```text
pix
cash
card
```

Tipos de entrega:

```text
delivery
pickup
```

Regra da taxa de entrega:

- Taxa padrao inicial de R$ 8,00 em `store_settings.default_delivery_fee_cents`.
- Bairros ausentes em `delivery_zones` usam a taxa padrao.
- `delivery_zones` contem apenas excecoes com valor diferente.
- O painel permite alterar a taxa padrao e cadastrar, editar ou excluir excecoes.

## 12. Banco de dados

O banco previsto e Supabase/PostgreSQL.

Tabelas principais da migration inicial:

```text
store_settings
working_hours
menu_categories
products
product_option_groups
product_option_group_products
product_options
delivery_zones
orders
order_items
order_events
payment_attempts
payment_webhook_deliveries
notification_outbox
print_agents
print_jobs
audit_log
```

Recursos importantes no schema:

- Enum de status de pedido.
- Enum de status de pagamento.
- Enum de fila de notificacao.
- Enum de fila de impressao.
- `pgcrypto`.
- Schema `private`.
- RLS habilitado nas tabelas.
- Revogacao de acesso direto para `anon` e `authenticated`.
- Trigger para atualizar `updated_at`.
- Trigger para validar transicoes de pedido.
- Funcao `claim_print_jobs` para o agente reservar trabalhos de impressao.
- Indices para pedidos, pagamentos, eventos, fila de impressao e outbox.

## 13. Regras de status no banco

A migration define regras para evitar transicoes invalidas.

Fluxo permitido:

```text
pending_approval -> confirmed ou cancelled
confirmed -> preparing ou cancelled
preparing -> out_for_delivery, delivered ou cancelled
out_for_delivery -> delivered ou cancelled
delivered/cancelled -> terminal
```

Regras especificas:

- Pedido de retirada nao pode ir para `out_for_delivery`.
- Pedido de entrega precisa passar por `out_for_delivery` antes de `delivered`.
- Pedido Pix so pode ser confirmado se o pagamento estiver `approved`.

## 14. Pagamentos

O projeto suporta:

- Pix via Mercado Pago.
- Dinheiro.
- Cartao.

Pontos importantes:

- Mercado Pago depende de `MERCADO_PAGO_ACCESS_TOKEN`.
- Webhook depende de `MERCADO_PAGO_WEBHOOK_SECRET`.
- Sem configuracao, Pix deve ficar como aguardando configuracao.
- Cartao e dinheiro podem funcionar como meios operacionais sem gateway online, conforme regra do sistema.

Endpoint de webhook:

```text
/api/v1/payments/webhook
```

## 15. Atendimento e notificacoes

`NEXT_PUBLIC_WHATSAPP_NUMBER` libera somente o botao publico de atendimento. O fluxo de pedidos nao agenda nem envia mensagens automaticas pelo WhatsApp e nao depende de credenciais da Meta.

As mudancas de status sao comunicadas no proprio site:

- O painel administrativo consulta novos pedidos a cada 8 segundos, mostra contador e aviso visual, tenta emitir som e pode usar a notificacao do navegador quando autorizada.
- Meus pedidos consulta mudancas a cada 8 segundos.
- A pagina individual do pedido consulta mudancas a cada 10 segundos.
- O cliente pode autorizar notificacoes do navegador. Elas exigem o site aberto ou em segundo plano e seguem as limitacoes do aparelho.

O codigo legado da WhatsApp Cloud API permanece isolado para uma possivel decisao futura, mas nao e chamado pela transicao de pedidos.

## 15.1 Login com Google

O acesso pelo Google usa Supabase Auth e aparece somente quando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` estao configuradas. O retorno e validado no servidor antes da criacao da sessao interna.

- Contas existentes por senha sao vinculadas pelo mesmo e-mail verificado.
- Contas novas pelo Google nao recebem senha ou telefone inventado.
- O telefone e solicitado em Meus pedidos ou no primeiro checkout.
- A migration `20260802181751_customer_google_auth.sql` torna telefone e hash opcionais somente quando existe um identificador autenticado.

## 16. Impressao termica

Existe um agente local em:

```text
agent/index.ts
```

Esse agente deve rodar no computador conectado a impressora.

Comando:

```powershell
cd C:\DOGCHEF
npm run print-agent
```

O agente:

- Nao deve acessar Supabase diretamente.
- Consulta a API da aplicacao.
- Usa token proprio.
- Reserva trabalhos de impressao.
- Marca trabalhos como concluidos.
- Tenta novamente falhas transitorias ate cinco vezes.
- Permite reimpressao manual pelo painel.
- Pode imprimir via TCP ou compartilhamento Windows.

Variaveis principais:

```text
DOGCHEF_API_URL
PRINT_AGENT_TOKEN
PRINT_AGENT_ID
PRINTER_TRANSPORT
PRINTER_HOST
PRINTER_PORT
PRINTER_SHARE
```

## 17. Variaveis de ambiente

Para desenvolvimento local:

```powershell
cd C:\DOGCHEF
Copy-Item .env.example .env.local
```

Principais grupos:

- Aplicacao: `NEXT_PUBLIC_APP_URL`, `APP_TIMEZONE`.
- Admin: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`.
- Supabase privado: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- Supabase publico: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Pix: `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`.
- WhatsApp: `NEXT_PUBLIC_WHATSAPP_NUMBER` somente para atendimento.
- Google Maps: `GOOGLE_MAPS_API_KEY`.
- Impressao: variaveis do agente.

Regra de seguranca:

- Nunca versionar `.env.local`.
- Nunca colocar `SUPABASE_SECRET_KEY` com prefixo `NEXT_PUBLIC_`.
- Nunca expor token de Mercado Pago, segredo OAuth, Supabase secret ou senha admin no frontend.

## 18. Como rodar localmente

No PowerShell:

```powershell
cd C:\DOGCHEF
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abrir:

```text
http://localhost:3000
```

Painel admin local:

```text
http://localhost:3000/admin
```

## 19. Comandos de validacao

```powershell
cd C:\DOGCHEF
npm run lint
npm run typecheck
npm run build
```

Esses comandos validam estilo, tipos e build de producao.

## 20. Git

Status encontrado:

```text
C:\DOGCHEF nao possui pasta .git
```

Isso significa que a pasta ainda nao esta versionada localmente como repositorio Git.

Para publicar em GitHub, sera necessario inicializar Git ou clonar/criar um repositorio remoto e conectar essa pasta.

## 21. Vercel

Status encontrado:

```text
C:\DOGCHEF nao possui .vercel/project.json
```

Isso significa que a pasta ainda nao esta vinculada a um projeto Vercel localmente.

Para publicar, sera necessario:

```powershell
cd C:\DOGCHEF
npx vercel link
npx vercel --prod
```

Antes do deploy real, precisam existir as variaveis de ambiente corretas na Vercel.

## 22. Supabase

Para usar banco persistente:

```powershell
cd C:\DOGCHEF
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Ponto importante:

- Nao editar migrations ja aplicadas em producao.
- Criar novas migrations para alteracoes futuras.
- Confirmar que as variaveis `SUPABASE_URL` e `SUPABASE_SECRET_KEY` existem no ambiente de producao.

## 23. Fallback sem banco

O README informa que, sem `SUPABASE_URL` e `SUPABASE_SECRET_KEY`, o sistema entra em modo de demonstracao/fallback.

Riscos desse modo:

- Pedidos podem sumir ao reiniciar.
- Nao ha persistencia confiavel.
- Nao e adequado para pedidos reais.
- Webhooks, fila de impressao e pagamentos nao tem garantia operacional.

Uso correto:

- Apenas desenvolvimento local ou preview temporario.

## 24. O que parece pronto no projeto

Com base na estrutura e arquivos encontrados, o projeto ja possui:

- App Next.js criado.
- Tela principal.
- Tela de pedido publico.
- Tela de login admin.
- Painel admin.
- APIs de cardapio.
- APIs de pedido.
- APIs administrativas.
- API de pagamento webhook.
- Codigo legado de webhook do WhatsApp, atualmente fora do fluxo automatico de pedidos.
- API de agente de impressao.
- Schema Supabase inicial.
- Seed/catalogo inicial.
- Tipos TypeScript do dominio.
- Documentacao inicial no README.
- Arquivo `.env.example`.
- Agente local de impressao.

## 25. O que ainda precisa ser confirmado/configurado

Antes de tratar como produto final, confirmar:

- Repositorio Git criado e conectado.
- Projeto Vercel vinculado.
- Variaveis de ambiente configuradas na Vercel.
- Projeto Supabase criado.
- Migrations aplicadas no Supabase.
- Dados reais do cardapio ajustados.
- Senha admin forte definida.
- `ADMIN_SESSION_SECRET` forte definido.
- Mercado Pago configurado, se Pix real for usado.
- Webhook do Mercado Pago cadastrado.
- Google OAuth configurado no Google Auth Platform e no Supabase, caso o botao seja ativado.
- URLs `/auth/google` local e de producao permitidas no Supabase Auth.
- Impressora testada com o agente local.
- `PRINT_AGENT_TOKEN` criado e configurado tanto no site quanto no agente.
- Build de producao aprovado com `npm run build`.

## 26. Observacoes de seguranca

Pontos positivos encontrados:

- Segredos ficam previstos em variaveis de ambiente.
- Supabase usa chave secreta apenas server-side.
- Schema habilita RLS.
- Acesso direto de `anon` e `authenticated` e revogado nas tabelas.
- Webhooks tem variaveis especificas para validacao.
- Admin usa senha e segredo de sessao.
- Agente de impressao usa token proprio.

Pontos que exigem atencao:

- Nao usar senha admin fraca.
- Nao publicar `.env.local`.
- Nao expor `SUPABASE_SECRET_KEY`.
- Nao aceitar pedidos reais em fallback sem banco.
- Nao operar Pix real sem validar webhook.
- Nao rodar agente de impressao com token compartilhado publicamente.

## 27. Como localizar novamente

Pasta:

```text
C:\DOGCHEF
```

Comandos uteis:

```powershell
cd C:\DOGCHEF
Get-ChildItem -Force
```

Rodar site:

```powershell
cd C:\DOGCHEF
npm run dev
```

Validar build:

```powershell
cd C:\DOGCHEF
npm run build
```

Rodar agente de impressao:

```powershell
cd C:\DOGCHEF
npm run print-agent
```

## 28. Resumo executivo

DogChef e uma plataforma Next.js para pedidos de restaurante/lanchonete com painel admin, contas de cliente, login opcional pelo Google, pagamentos, avisos no site, Supabase e impressao termica local.

O codigo esta em `C:\DOGCHEF`.

O repositorio local esta conectado ao GitHub em `aaotaviano-pixel/dogchef`. A publicacao deve continuar sendo conferida separadamente na conta correta da Vercel.

Para virar operacao real, os pontos criticos sao:

1. Configurar Supabase persistente.
2. Aplicar migrations.
3. Configurar variaveis de ambiente.
4. Vincular Git.
5. Publicar na Vercel.
6. Configurar webhooks.
7. Testar pedido completo.
8. Testar impressao local.
