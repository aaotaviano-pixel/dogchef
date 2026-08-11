# Arquitetura do DogChef

## Camada visual da vitrine

`src/components/storefront.tsx` monta o carrossel de categorias, o showcase principal, os destaques e a grade de produtos. A camada de estilo da vitrine fica concentrada em `src/app/globals.css`.

O tratamento visual por categoria e deliberadamente apresentado apenas no frontend:

1. O produto recebe uma classe baseada em `categoryId`.
2. O fundo e o acento do card sao definidos por tokens CSS locais.
3. A foto real fica dentro de `product-image-frame`, sem edicao, regeneracao ou substituicao do arquivo.
4. O comportamento de categoria selecionada continua sendo controlado por `activeCategory`.

Cada card tambem recebe `productVisualTreatment`, em `src/components/storefront.tsx`. A funcao combina nome, descricao e categoria para produzir uma classe de tratamento, aplicada apenas na moldura, fundo e etiqueta do card. As URLs de imagem permanecem inalteradas, portanto fotos do admin e fotos de fallback nao passam por edicao.

O tema visual claro do storefront e o padrao, usando creme, vermelho, mostarda e verde. A classe `theme-dark-preview` so e aplicada quando `NEXT_PUBLIC_DOGCHEF_DARK_PREVIEW=true`, para uma previa local reversivel.

O carrossel de categorias usa duas copias visuais do mesmo conjunto para formar um loop continuo no desktop. A segunda copia tem `aria-hidden` e `tabIndex=-1`; no mobile ela fica oculta e a primeira copia usa rolagem horizontal nativa. Foco, toque, roda do mouse e clique pausam a animacao por 4,8 segundos.

Os botoes sociais da vitrine ficam em `dogchef-social-stack`: Instagram aponta para o perfil oficial e WhatsApp usa a URL configurada no catalogo. Sem numero comercial, o item permanece visivel como placeholder bloqueado para nao criar um link falso.

## Recuperacao de senha de clientes

O login legado por e-mail continua usando o hash `scrypt` armazenado em `customer_accounts`. Para recuperar a senha sem migrar contas existentes de uma vez:

1. `CustomerAccess` solicita o reset em `/api/v1/customer/password/forgot`.
2. A API encontra o cadastro interno e garante um usuario correspondente no Supabase Auth, sem expor credenciais.
3. O Supabase envia o link de recuperacao para o e-mail do cliente.
4. `/auth/reset-password` valida a sessao de recuperacao, atualiza o usuario Auth e chama `/api/v1/customer/password/reset`.
5. A API confirma o token com `auth.getUser`, encontra `customer_accounts.auth_user_id` e grava apenas um novo hash `scrypt`.

As respostas do pedido de recuperacao sao genericas para evitar enumeracao de e-mails. O envio real depende do provedor de e-mail configurado no Supabase; SMTP proprio e necessario para operacao confiavel em producao.

## Persistencia do showcase

O painel envia a lista ordenada para `/api/v1/admin/showcase`, que chama a funcao protegida `set_showcase_products(text[])` no Supabase. A funcao valida produtos ativos, limita a cinco itens e substitui a selecao em uma operacao atomica. A limpeza usa `where featured = true` para permanecer compativel com a politica de atualizacao segura do Supabase.

## Senha administrativa

O login aceita a senha inicial de `ADMIN_PASSWORD` durante o bootstrap e, quando existir, prioriza o hash salvo em `admin_settings`. A rota protegida `/api/v1/admin/settings/password` exige a sessao administrativa, valida a senha atual e salva apenas um hash `scrypt` com salt, marcando o bootstrap como concluido. O frontend oferece os tres campos em Configuracoes. Sem a tabela remota, a troca e recusada explicitamente para nao aparentar persistencia.

## Identidade da marca

O emblema oficial fica em `public/images/dogchef/dog-do-chef-logo.png` e e aplicado via CSS no seletor global `.brand-mark`, evitando duplicacao de markup entre storefront, admin e telas de autenticacao. `public/icon.png` e usado como favicon, icone do manifest e icone das notificacoes do navegador.

## Rate limiting das APIs

`middleware.ts` intercepta `/api/v1/*` no Edge Runtime antes dos handlers. Com
`UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`, aplica janelas deslizantes por
IP: 60 GETs publicos por minuto, 5 requisicoes de autenticacao, 10 criacoes de pedido
e 30 demais escritas. O bloqueio retorna 429 JSON com `Retry-After`; sem credenciais
Upstash, o middleware permanece fail-open para nao derrubar o ambiente local.

## Impressao e escolha de impressora

O agente Windows consulta `Win32_Printer`, gera IDs estaveis, envia nomes, estado e
impressora padrao no heartbeat e grava essa capacidade na tabela existente `print_agents`.
O painel administrativo mostra as impressoras instaladas quando o agente esta conectado.
A escolha fica no navegador do painel e e enviada no momento da confirmacao ou reimpressao.
Para impressoras Windows descobertas, o agente usa o spooler RAW (`winspool.drv`); hosts,
shares e qualquer detalhe de rede continuam fora do banco e do frontend. Sem descoberta,
o agente usa perfis `PRINTER_PROFILES_JSON` ou a configuracao legada `PRINTER_TRANSPORT`,
`PRINTER_HOST`, `PRINTER_PORT` ou `PRINTER_SHARE`.

Os comandos `print-agent:list` e `print-agent:test` fazem diagnostico local sem criar
pedido ou inserir trabalho na fila da aplicacao.

O botao **Testar impressao** do painel cria um `print_jobs.kind = 'test'` com `order_id`
nulo. A migration `20260810030000_print_test_jobs.sql` permite esse job diagnostico sem
fake order; o mesmo agente autenticado consome e confirma o resultado. Falha de impressao
nao altera o pedido nem bloqueia o checkout.

O agente nao abre servidor HTTP/WS local e nao depende de CORS ou mixed content: ele faz
polling autenticado HTTPS para a Vercel e a conexao com USB, spooler, TCP ou IPP parte
sempre do computador local. Os eventos operacionais sao emitidos como JSON no stdout,
incluindo `PRINT_SERVICE_CONNECTED`, `IPP_JOB_ACCEPTED`, `PRINT_JOB_SUCCESS`,
`PRINT_JOB_FAILED` e `PRINT_SERVICE_DISCONNECTED`.

## Indicadores administrativos

`resetDashboardMetrics` registra um evento `dashboard_metrics_reset` no `audit_log`. O painel
filtra apenas pedidos criados depois do ultimo marco, sem alterar ou excluir pedidos antigos.
