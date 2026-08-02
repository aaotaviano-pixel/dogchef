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
npm run lint
npm run typecheck
npm run build
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha somente as integrações que serão usadas. Nunca versione `.env.local`, tokens, senhas ou chaves privadas.

| Grupo | Variáveis | Uso |
| --- | --- | --- |
| Aplicação | `NEXT_PUBLIC_APP_URL`, `APP_TIMEZONE` | URL pública e fuso da operação. |
| Sessões | `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET` | Login do admin e assinatura independente da sessão do cliente; os segredos devem ser aleatórios e ter pelo menos 32 caracteres. |
| Supabase | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Acesso somente no servidor. Obrigatórias para produção persistente. |
| Supabase público | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Login opcional com Google no navegador. A chave publicável pode ser exposta; a chave secreta nunca. |
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
- Recuperação de senha por e-mail permanece desativada para manter o projeto gratuito e sem dependência de SMTP.

Antes de publicar esta funcionalidade, aplique `20260801164243_customer_accounts.sql` e `20260802181751_customer_google_auth.sql` no banco e configure `CUSTOMER_SESSION_SECRET` na Vercel.

## Login com Google

O botão aparece somente quando as variáveis públicas do Supabase estão preenchidas. O login por e-mail continua disponível mesmo sem Google.

1. No Google Auth Platform, crie um cliente OAuth do tipo **Aplicação Web**.
2. Adicione as origens do site e do desenvolvimento, por exemplo `http://localhost:3000`.
3. No Supabase, abra **Authentication → Providers → Google**, copie a URL de callback indicada pelo Supabase para os redirecionamentos autorizados no Google e informe o Client ID e o Client Secret.
4. Em **Authentication → URL Configuration**, informe a URL pública do site e permita `https://SEU_DOMINIO/auth/google` e `http://localhost:3000/auth/google`.
5. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` na Vercel. O Client Secret do Google fica somente no painel do Supabase.

Depois, teste uma conta nova e uma conta por senha com o mesmo e-mail. O vínculo só ocorre após o Supabase confirmar o usuário e o e-mail.

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
- Em desenvolvimento sem Supabase, alterações de catálogo ficam em `.data/catalog.json` e fotos em `public/uploads/`; ambos são ignorados pelo Git. Produção exige Supabase para persistência.
- A migration `20260731224500_admin_catalog_and_gallery.sql` cria a galeria, a ordenação do showcase e o bucket público `product-images`. A chave secreta continua restrita ao servidor.

## Adicionais

O banco já possui grupos de adicionais, opções, limites de seleção e vínculos com produtos. O catálogo carrega essas relações automaticamente e recalcula os valores no servidor. Nenhum adicional ou preço fictício é criado: cadastre os dados reais em `product_option_groups`, `product_options` e `product_option_group_products` quando a cliente definir nomes e valores.

Troque a senha administrativa e a chave de sessão caso sejam expostas. Não compartilhe essas variáveis por chat, commit ou ticket público.

## Agente local ESC/POS

O agente em `agent/index.ts` é executado no computador da cozinha. Ele consulta a API protegida, reserva um trabalho de impressão e envia o ticket ESC/POS por rede TCP ou compartilhamento de impressora do Windows. Ele não se conecta diretamente ao Supabase.

1. Na máquina da impressora, copie `agent/.env.example` para `agent/.env`.
2. Preencha `DOGCHEF_API_URL`, `PRINT_AGENT_TOKEN` e `PRINT_AGENT_ID`.
3. Escolha um transporte:
   - Rede: `PRINTER_TRANSPORT=tcp`, `PRINTER_HOST` e `PRINTER_PORT` (normalmente `9100`).
   - USB compartilhada no Windows: `PRINTER_TRANSPORT=windows-share` e `PRINTER_SHARE=\\SERVIDOR\\NOME_DA_IMPRESSORA`.
4. Mantenha o processo em execução:

```powershell
cd C:\DOGCHEF
npm run print-agent
```

O token do agente deve ser longo, aleatório e exclusivo. Em produção, execute-o como serviço do Windows ou tarefa agendada, com reinício automático, e faça um teste de ticket antes do horário de atendimento. Falhas transitórias são tentadas novamente até cinco vezes; depois disso, o painel permite reimpressão manual.

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
