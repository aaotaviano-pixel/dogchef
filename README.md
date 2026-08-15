# DogChef

Plataforma de pedidos para a DogChef, com cardápio, conta do cliente, acesso opcional pelo Google, checkout, Pix, acompanhamento com avisos no site, painel administrativo e impressão térmica ESC/POS por agente local.

## Requisitos

- Node.js 20.9 ou superior e npm.
- Um projeto Supabase para operação persistente.
- Uma conta Vercel para publicação.
- Opcionalmente: credenciais Google OAuth, Mercado Pago, número de atendimento por WhatsApp, Google Maps e uma impressora térmica ESC/POS.

## Executar localmente

```powershell
cd C:\DOGCHEF
Copy-Item .env.example .env.local
npm install
npm run dev
```

Abra `http://localhost:3000`. Para validações locais:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

## Vitrine publica

A home usa os dados reais de `/api/v1/menu`. O hero e a faixa **Destaques da casa** sao
alimentados pelos produtos escolhidos no Showcase do painel; quando nao ha selecao, entram
somente produtos disponiveis do catalogo. Categorias, precos, horarios, taxa, Pix e
WhatsApp nunca sao simulados pela camada visual.

As derivacoes de apresentacao ficam em `src/lib/storefront-presentation.ts`. A composicao
e os estilos publicos ficam em `src/components/storefront.tsx` e no bloco escopado
`.storefront-reference-redesign` de `src/app/globals.css`. O redesign nao exige migration.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha somente as integrações que serão usadas. Nunca versione `.env.local`, tokens, senhas ou chaves privadas.

| Grupo | Variáveis | Uso |
| --- | --- | --- |
| Aplicação | `NEXT_PUBLIC_APP_URL`, `APP_TIMEZONE` | URL pública e fuso da operação. |
| Sessões | `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET` | Login do admin e assinatura independente da sessão do cliente; os segredos devem ser aleatórios e ter pelo menos 32 caracteres. |
| Supabase | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Acesso somente no servidor. Obrigatórias para produção persistente. |
| Supabase público | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Login opcional com Google no navegador. A chave publicável pode ser exposta; a chave secreta nunca. |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Limitação distribuída das APIs no middleware Edge. Obrigatórias para proteção ativa em produção. |
| Pix | `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` | Criação e validação de pagamentos Pix. |
| WhatsApp | `NEXT_PUBLIC_WHATSAPP_NUMBER` | Somente o botão público de atendimento. O site não envia mensagens automáticas de pedido. |
| Maps | `GOOGLE_MAPS_API_KEY` | Opcional para recursos futuros de endereço; não é necessário para calcular a taxa atual. |
| Agente de impressão | `DOGCHEF_API_URL`, `PRINT_AGENT_TOKEN`, `PRINTER_TRANSPORT`, `PRINTER_HOST`, `PRINTER_PORT`, `PRINTER_SHARE` | Uso exclusivo da máquina conectada à impressora. |

## Supabase e migrations

As migrations em `supabase/migrations/` criam catálogo, contas de cliente, vínculo opcional com Supabase Auth, zonas de entrega, pedidos, pagamentos, auditoria, agentes e fila de impressão. Elas também habilitam RLS e restringem acesso direto do navegador.

1. Crie um projeto no Supabase e guarde o *project ref*.
2. Configure `SUPABASE_URL` e `SUPABASE_SECRET_KEY` em `.env.local`.
3. Autentique e associe o CLI ao projeto:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Para conferir o estado remoto antes de publicar:

```powershell
npx supabase migration list
```

Use uma nova migration para alterações de esquema ou dados de produção; não edite uma migration já aplicada. As rotas da aplicação usam a chave secreta somente no servidor, e o cliente não recebe acesso direto a pedidos.

## Contas de cliente e Meus Pedidos

- Cadastro e login usam e-mail e senha; a senha é armazenada somente como hash `scrypt` com salt aleatório.
- O acesso pelo Google é opcional e vincula o identificador autenticado ao cadastro interno. O site nunca recebe a senha Google.
- Contas criadas pelo Google pedem o telefone em Meus pedidos ou no primeiro checkout, sem inventar dados para completar o cadastro.
- A sessão fica em cookie `httpOnly`, assinado por `CUSTOMER_SESSION_SECRET`, por até 30 dias.
- O checkout exige uma conta, mas o acesso é integrado à finalização para manter o fluxo curto.
- `/meus-pedidos` lista somente pedidos vinculados ao cliente autenticado.
- `/pedido/[publicCode]` aceita a conta proprietária ou um token antigo de rastreamento válido. O código público sozinho não libera o pedido.
- Pedidos anteriores à migration continuam preservados com `customer_id` nulo e não são vinculados automaticamente.
- Meus pedidos e a página de acompanhamento consultam mudanças a cada poucos segundos, exibem aviso dentro do site e podem emitir uma notificação do navegador quando o cliente autorizar.
- O link “Esqueci minha senha” usa o e-mail de recuperação do Supabase Auth. O servidor mantém o hash `scrypt` interno sincronizado, então o login atual continua funcionando.
- O fluxo nunca informa se um e-mail existe. O link é de uso único e expira conforme as regras do Supabase Auth; nenhuma senha ou token é salvo pelo DogChef.
- O showcase do admin usa a função protegida `set_showcase_products`; a migration `20260802190000_fix_showcase_update_where.sql` corrige a política de atualização segura do Supabase. A API também possui fallback server-side com filtros explícitos para compatibilidade.

Antes de publicar esta funcionalidade, aplique `20260801164243_customer_accounts.sql` e `20260802181751_customer_google_auth.sql` no banco e configure `CUSTOMER_SESSION_SECRET` na Vercel.

## Login com Google

O botão aparece somente quando as variáveis públicas do Supabase estão preenchidas. O login por e-mail continua disponível mesmo sem Google.

1. No Google Auth Platform, crie um cliente OAuth do tipo **Aplicação Web**.
2. Adicione as origens do site e do desenvolvimento, por exemplo `http://localhost:3000`.
3. No Supabase, abra **Authentication → Providers → Google**, copie a URL de callback indicada pelo Supabase para os redirecionamentos autorizados no Google e informe o Client ID e o Client Secret.
4. Em **Authentication → URL Configuration**, informe a URL pública do site e permita `https://SEU_DOMINIO/auth/google` e `http://localhost:3000/auth/google`.
5. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` na Vercel. O Client Secret do Google fica somente no painel do Supabase.

## Recuperação de senha

O cliente pode solicitar a recuperação dentro do acesso da conta. O endpoint `/api/v1/customer/password/forgot` cria o vínculo do cadastro interno com um usuário do Supabase Auth quando necessário e solicita o envio do link. A página `/auth/reset-password` valida a sessão de recuperação, atualiza a senha no Supabase e grava somente o hash `scrypt` no cadastro interno.

No Supabase, em **Authentication → URL Configuration → Redirect URLs**, permita as URLs usadas pelos ambientes:

```text
http://localhost:3000/auth/reset-password
http://127.0.0.1:3000/auth/reset-password
https://dogchef-one.vercel.app/auth/reset-password
```

O envio usa o serviço de e-mail do Supabase. Para produção, configure um SMTP próprio em **Authentication → SMTP Settings**, porque o serviço padrão é limitado e serve apenas para testes. Não coloque credenciais SMTP no código, no frontend ou no Git.

Depois, teste uma conta nova e uma conta por senha com o mesmo e-mail. O vínculo só ocorre após o Supabase confirmar o usuário e o e-mail.

## Senha administrativa

O primeiro acesso usa `ADMIN_PASSWORD` configurada no ambiente. Dentro de **Configurações**, o administrador pode informar a senha atual e repetir a nova senha duas vezes. Depois da primeira troca, somente um hash `scrypt` com salt é salvo na tabela `admin_settings`; a senha nunca é gravada no código, no frontend ou em texto puro no banco.

A migration `20260802210000_admin_password_settings.sql` precisa estar aplicada no Supabase remoto. O endereço direto do painel é `/admin/login` e não fica exposto no rodapé da loja.

## Publicar na Vercel

1. Envie o projeto a um repositório Git privado ou importe a pasta pela Vercel.
2. Na Vercel, configure todas as variáveis necessárias em **Project Settings → Environment Variables**, para os ambientes desejados.
3. Defina `NEXT_PUBLIC_APP_URL` com a URL final do domínio, sem barra ao final.
4. Faça o deploy:

```powershell
npx vercel link
npx vercel --prod
```

Após o primeiro deploy, configure os webhooks com a URL de produção:

- Mercado Pago: `https://SEU_DOMINIO/api/v1/payments/webhook`

Faça um pedido de teste, confirme o webhook e só então habilite a operação pública. A Vercel hospeda a aplicação; a impressora permanece na rede local e é atendida pelo agente abaixo.

## Proteção das APIs e rate limiting

O arquivo `middleware.ts` protege todas as rotas `/api/v1/*` antes que elas alcancem
os handlers. O identificador combina o host e o IP validado a partir de
`x-real-ip` ou do primeiro IP válido em `x-forwarded-for`.

Limites atuais por IP:

- Leituras `GET`, incluindo `/api/v1/menu`: 60 requisições por minuto.
- Autenticação e recuperação de acesso: 5 requisições por minuto.
- Criação de pedidos `POST /api/v1/orders`: 10 requisições por minuto.
- Demais escritas: 30 requisições por minuto.

Quando o limite é ultrapassado, a resposta é `429` com JSON contendo `code:
RATE_LIMITED`, `retryAfter` e o cabeçalho `Retry-After`. Também são enviados os
headers `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset`.

### Configuração

1. Crie uma base Redis REST no [Upstash Console](https://console.upstash.com/redis).
2. Copie somente a **REST URL** e o **REST Token** mostrados pela base.
3. Para desenvolvimento local, instale as dependências e preencha `.env.local`:

```powershell
cd C:\DOGCHEF
npm install @upstash/ratelimit@2.0.8 @upstash/redis@1.38.1 --save-exact
```

```text
UPSTASH_REDIS_REST_URL=https://seu-banco.upstash.io
UPSTASH_REDIS_REST_TOKEN=seu-token-rest
```

4. Na Vercel, abra **Project Settings → Environment Variables** e adicione as duas
   variáveis nos ambientes **Production** e **Preview**. Elas são server-side e nunca
   devem usar o prefixo `NEXT_PUBLIC_`. A integração oficial **Upstash for Redis** da
   Vercel pode criar automaticamente `KV_REST_API_URL` e `KV_REST_API_TOKEN`; o
   middleware aceita esses nomes ou os nomes `UPSTASH_REDIS_REST_*`.
5. Faça um novo deploy para aplicar as variáveis:

```powershell
npx vercel --prod
```

Sem essas variáveis, o middleware fica temporariamente fail-open para não derrubar o
ambiente local. Em produção, a proteção só deve ser considerada ativa depois de
configurar o Upstash e validar uma resposta `429`. O limitador reduz abuso e spam,
mas não substitui a proteção de borda da Vercel, firewall/WAF, monitoramento e limites
do provedor quando houver uma campanha distribuída de DDoS.

## Pix (Mercado Pago)

1. Crie uma aplicação no Mercado Pago e obtenha um access token apropriado ao ambiente.
2. Adicione `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` na Vercel e localmente, quando necessário.
3. Cadastre o endpoint de webhook de produção no painel do Mercado Pago.
4. Teste uma cobrança Pix real ou de sandbox e confirme que o status é atualizado pelo webhook assinado.

Sem essas variáveis, Pix aparece como “aguardando configuração”; dinheiro e cartão na entrega continuam disponíveis para teste. Nunca confirme manualmente um pedido Pix sem status `approved`.

## WhatsApp e avisos de pedido

Defina `NEXT_PUBLIC_WHATSAPP_NUMBER` com DDI, DDD e número, usando apenas dígitos, para liberar o botão de atendimento. Não há envio automático de status por WhatsApp nem necessidade de token da Meta.

O painel consulta novos pedidos a cada 8 segundos, mostra o contador, exibe um aviso e tenta emitir som. Ao tocar no sino, a administradora pode autorizar notificações do navegador. O cliente recebe mudanças dentro de Meus pedidos e na página de acompanhamento; notificações do navegador funcionam enquanto o site estiver aberto ou em segundo plano, conforme as permissões do aparelho.

## Privacidade e termos

- `/politica-de-privacidade` explica os dados usados, login Google, fornecedores e direitos do titular.
- `/termos-de-uso` descreve confirmação, disponibilidade, pagamento, entrega, retirada e cancelamento.
- O cadastro e o checkout apresentam links para os dois documentos.
- Antes da operação comercial, a responsável deve revisar os textos e confirmar os canais oficiais de contato.

## Taxa de entrega

Todo endereço usa inicialmente a taxa padrão de R$ 8,00. A administradora pode alterar esse valor no painel e cadastrar somente bairros que tenham uma taxa diferente. Quando o bairro informado pelo cliente não estiver na lista de exceções, o checkout usa automaticamente a taxa padrão.

As comparações de bairro ignoram maiúsculas, minúsculas e acentos. Excluir uma exceção faz o bairro voltar imediatamente para a taxa padrão. `GOOGLE_MAPS_API_KEY` continua opcional; se for usada futuramente, restrinja-a ao domínio e apenas às APIs necessárias.

## Administração

- Acesse `https://SEU_DOMINIO/admin`.
- O acesso só é habilitado com `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET`.
- A sessão é protegida por cookie `httpOnly`, válido por 12 horas e marcado como seguro em produção.
- O painel é dividido em Visão geral, Pedidos, Produtos, Showcase, Configurações e Impressão.
- Em Produtos, a administradora pode cadastrar, editar, pausar e excluir itens, além de enviar várias fotos direto do celular. Cada envio aceita até 12 imagens JPG, PNG, WEBP ou AVIF de até 8 MB; novos envios podem ser feitos ao editar o produto.
- A galeria permite escolher a foto principal e remover fotos individualmente. A foto principal também é usada nos cards e no banner.
- Em Showcase, até cinco produtos ativos podem ser escolhidos e reordenados para formar o carrossel da home.
- Em Configurações, a senha administrativa pode ser trocada com confirmação dupla da nova senha.
- Em desenvolvimento sem Supabase, alterações de catálogo ficam em `.data/catalog.json` e fotos em `public/uploads/`; ambos são ignorados pelo Git. Produção exige Supabase para persistência.
- A migration `20260731224500_admin_catalog_and_gallery.sql` cria a galeria, a ordenação do showcase e o bucket público `product-images`. A chave secreta continua restrita ao servidor.

## Adicionais

O banco já possui grupos de adicionais, opções, limites de seleção e vínculos com produtos. O catálogo carrega essas relações automaticamente e recalcula os valores no servidor. Nenhum adicional ou preço fictício é criado: cadastre os dados reais em `product_option_groups`, `product_options` e `product_option_group_products` quando a cliente definir nomes e valores.

Troque a senha administrativa e a chave de sessão caso sejam expostas. Não compartilhe essas variáveis por chat, commit ou ticket público.

O storefront usa o tema claro por padrão, com a identidade visual do Dog do Chef em creme, vermelho, mostarda e verde. Para testar temporariamente a versão escura, defina `NEXT_PUBLIC_DOGCHEF_DARK_PREVIEW=true` no ambiente desejado.

## Agente local ESC/POS

O agente em `agent/index.ts` é executado no computador da cozinha. Ele consulta a API protegida, reserva um trabalho de impressão e envia o ticket ESC/POS por rede TCP, compartilhamento ou spooler RAW do Windows. Ele não se conecta diretamente ao Supabase.

1. Na máquina da impressora, copie `agent/.env.example` para `agent/.env`.
2. Preencha `DOGCHEF_API_URL`, `PRINT_AGENT_TOKEN` e `PRINT_AGENT_ID`.
3. Escolha um transporte quando necessário:
   - Rede: `PRINTER_TRANSPORT=tcp`, `PRINTER_HOST` e `PRINTER_PORT` (normalmente `9100`).
   - USB compartilhada no Windows: `PRINTER_TRANSPORT=windows-share` e `PRINTER_SHARE=\\SERVIDOR\\NOME_DA_IMPRESSORA`.
4. No Windows, o agente consulta as impressoras instaladas e as envia ao painel como opções com estado e impressora padrão. A seleção usa o spooler RAW do Windows, sem exigir que a administradora descubra IP ou compartilhamento.
5. Para impressoras de rede ou computadores não Windows, configure no ambiente da aplicação uma lista pública apenas de IDs e nomes em `PRINT_PRINTER_OPTIONS`, por exemplo `[{"id":"cozinha","name":"Impressora da cozinha"}]`, e os endereços locais em `PRINTER_PROFILES_JSON` dentro de `agent/.env`.
6. Para IPP, use um perfil local como `{"id":"ipp-virtual","name":"IPP virtual de teste","transport":"ipp","ippUri":"http://192.168.1.11:10631/p/virtual","ippDocumentFormat":"text/plain"}`. Esse endereço nunca deve ser colocado na Vercel.
7. Abra o painel, entre em **Impressão** e selecione uma impressora. A escolha fica salva neste navegador e é enviada junto aos próximos tickets; endereços e credenciais continuam somente no agente local.
8. Mantenha o processo em execução:

```powershell
cd C:\DOGCHEF
npm run print-agent
```

Antes de aceitar pedidos, valide a instalação sem criar pedido no sistema:

```powershell
npm run print-agent:list
npm run print-agent:test -- --printer-id windows-nome-da-impressora-xxxxxxxx
npm run print-agent:diagnose -- --ipp-url http://192.168.1.11:10631/p/virtual
npm run print-agent:test -- --ipp-url http://192.168.1.11:10631/p/virtual
```

O primeiro comando mostra o nome, ID e estado informados pelo Windows. O segundo envia
um ticket de teste diretamente à impressora escolhida. `print-agent:diagnose` executa a
verificação de protocolo sem imprimir; para a IPP virtual, `--ipp-url` faz o acesso partir
do computador local, nunca da Vercel. Para uma impressora instalada no Windows, não é
necessário informar IP; para uma impressora TCP não instalada no Windows, configure o
perfil com host e porta antes do teste.

O token do agente deve ser longo, aleatório e exclusivo. Em produção, execute-o como serviço do Windows ou tarefa agendada, com reinício automático, e faça um teste de ticket antes do horário de atendimento. Falhas transitórias são tentadas novamente até cinco vezes; depois disso, o painel permite reimpressão manual.

Para registrar a inicialização automática no Windows, depois de configurar `agent/.env`,
execute uma vez:

```powershell
powershell -ExecutionPolicy Bypass -File .\agent\install-windows.ps1
```

O script cria a tarefa **DogChef Print Agent** para o usuário atual, inicia o agente no
login do Windows e solicita reinício automático em caso de falha. Ele não abre uma porta
local nem expõe a impressora na internet. Para remover a tarefa:

```powershell
powershell -ExecutionPolicy Bypass -File .\agent\uninstall-windows.ps1
```

O painel administrativo também oferece **Testar impressão**, que cria somente um trabalho
de diagnóstico na fila, sem criar pedido falso. O pedido continua independente da fila:
se a impressora estiver desligada, o pedido permanece salvo e pode ser reimpresso depois.

O agente não abre servidor HTTP/WS local e não depende de CORS ou mixed content: ele faz
polling autenticado HTTPS para a Vercel e a conexão com USB, spooler, TCP ou IPP parte
sempre do computador local. Os eventos operacionais são emitidos como JSON no stdout,
incluindo `PRINT_SERVICE_CONNECTED`, `IPP_JOB_ACCEPTED`, `PRINT_JOB_SUCCESS`,
`PRINT_JOB_FAILED`, `PRINTER_DISCOVERY`, `IPP_CONNECTED`, `IPP_TIMEOUT` e
`PRINT_SERVICE_DISCONNECTED`.

A suíte do agente cobre cinco cenários do protocolo IPP: montagem das requisições,
decodificação de resposta, request HTTP local, erro de status IPP e timeout.

## Indicadores do painel

Em **Configurações**, a ação **Zerar indicadores** cria um marco de auditoria e faz o painel começar a contar a partir daquele momento. Pedidos, clientes, pagamentos e registros antigos não são apagados; eles continuam preservados para consulta e rastreabilidade.

## Arquitetura

```text
Cliente (Next.js) ──> API Routes ──> Supabase
                       │              ├─ pedidos, catálogo e zonas
                       │              ├─ pagamentos, auditoria e outbox
                       │              └─ fila de impressão
                       ├─ Mercado Pago (Pix + webhook assinado)
                       ├─ Avisos no site e no navegador (sem mensageria paga)
                       └─ Agente local ──> impressora ESC/POS

Admin (/admin) ──────> API Routes protegidas por sessão
```

O servidor é responsável por preço, disponibilidade, regras de entrega, transição de status, autenticação administrativa e segredos. O navegador apenas consome as rotas da aplicação.

## Limitação importante: fallback sem banco

Quando `SUPABASE_URL` e `SUPABASE_SECRET_KEY` não estão configuradas, o ambiente local pode operar em modo de demonstração. Catálogo, contas de teste e pedidos ficam em arquivos dentro de `.data/`, ignorados pelo Git. Em produção, o catálogo continua visível, mas a aplicação mantém o recebimento de pedidos fechado deliberadamente. Esse fallback serve apenas para desenvolvimento local:

- os dados sobrevivem ao reinício da máquina local, mas não são compartilhados entre servidores;
- não há persistência, auditoria ou concorrência confiável;
- webhooks, fila de impressão e atualizações de pagamento não têm garantia operacional;
- não é seguro nem adequado para receber pedidos reais.

Para abrir a operação da DogChef ao público, configure Supabase, variáveis de produção, webhooks e o agente de impressão antes de aceitar pedidos.

## Dados pendentes da cliente

O código permanece funcional sem inventar estes dados, mas a ativação final depende de:

- credenciais da conta Mercado Pago da própria cliente;
- número público de WhatsApp, caso o botão de atendimento seja usado;
- bairros que realmente precisam de taxa diferente do valor padrão;
- nomes e preços dos adicionais;
- modelo e endereço da impressora térmica;
- arquivo oficial da logo em boa resolução;
- condições comerciais do contrato e vencimento mensal no dia 10.
# Auditoria e operacao

O relatorio tecnico mais recente esta em
[`AUDITORIA_PRODUCAO_2026-08-11.md`](./AUDITORIA_PRODUCAO_2026-08-11.md). Ele registra
validacoes de producao, seguranca, pagamentos, dependencias, imagens e impressao sem
expor segredos.

## Refinamento mobile de 2026-08-15

A vitrine possui hero mobile retangular 4:3, titulo animado por etapas e categorias reais
em faixa automatica. `Destaques da casa` permanece branco; a partir de `Escolha seu
favorito`, todo o cardapio usa cards escuros sobre um degrade que termina em preto. A
faixa antiga de beneficios foi removida. A especificacao e o plano ficam em
`docs/superpowers/`; esta rodada foi validada antes da publicacao em producao.
