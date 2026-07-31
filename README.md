# DogChef

Plataforma de pedidos para a DogChef, com cardápio, checkout, Pix, acompanhamento de pedido, painel administrativo e impressão térmica ESC/POS por agente local.

## Requisitos

- Node.js 20.9 ou superior e npm.
- Um projeto Supabase para operação persistente.
- Uma conta Vercel para publicação.
- Opcionalmente: credenciais Mercado Pago, WhatsApp Cloud API, Google Maps e uma impressora térmica ESC/POS.

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
| Admin | `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Login em `/admin`; a chave de sessão deve ser aleatória e ter pelo menos 32 caracteres. |
| Supabase | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Acesso somente no servidor. Obrigatórias para produção persistente. |
| Supabase público | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Preparadas para recursos públicos futuros; não exponha a chave secreta. |
| Pix | `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` | Criação e validação de pagamentos Pix. |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Mensagens transacionais e validação do webhook da Meta. |
| Maps | `GOOGLE_MAPS_API_KEY` | Opcional; a operação usa zonas/bairros cadastrados enquanto não houver chave. |
| Agente de impressão | `DOGCHEF_API_URL`, `PRINT_AGENT_TOKEN`, `PRINTER_TRANSPORT`, `PRINTER_HOST`, `PRINTER_PORT`, `PRINTER_SHARE` | Uso exclusivo da máquina conectada à impressora. |

## Supabase e migrations

A migration inicial fica em `supabase/migrations/` e cria catálogo, zonas de entrega, pedidos, pagamentos, auditoria, outbox de WhatsApp, agentes e fila de impressão. Ela também habilita RLS e restringe acesso direto do navegador.

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
- WhatsApp Cloud API: `https://SEU_DOMINIO/api/v1/whatsapp/webhook`

Faça um pedido de teste, confirme o webhook e só então habilite a operação pública. A Vercel hospeda a aplicação; a impressora permanece na rede local e é atendida pelo agente abaixo.

## Pix (Mercado Pago)

1. Crie uma aplicação no Mercado Pago e obtenha um access token apropriado ao ambiente.
2. Adicione `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` na Vercel e localmente, quando necessário.
3. Cadastre o endpoint de webhook de produção no painel do Mercado Pago.
4. Teste uma cobrança Pix real ou de sandbox e confirme que o status é atualizado pelo webhook assinado.

Sem essas variáveis, Pix aparece como “aguardando configuração”; dinheiro e cartão na entrega continuam disponíveis para teste. Nunca confirme manualmente um pedido Pix sem status `approved`.

## WhatsApp Cloud API

1. Crie/configure o número comercial no Meta for Developers.
2. Cadastre `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_APP_SECRET`.
3. Crie e aprove o template `dogchef_status` (ou ajuste `WHATSAPP_TEMPLATE_NAME`) em `pt_BR`, com três parâmetros no corpo: nome, código do pedido e mensagem de status.
4. Cadastre e valide o webhook `GET/POST` da aplicação na Meta.

A aplicação envia mensagens transacionais para os estados confirmado e saiu para entrega. Sem credenciais, a ação é simulada e dados pessoais não são gravados em logs de deploy.

## Google Maps e zonas de entrega

`GOOGLE_MAPS_API_KEY` é opcional. Enquanto não houver uma integração de geocodificação ativa, a regra de entrega usa as zonas e aliases de bairro cadastrados no catálogo/banco, com taxa e mínimo por zona. Mantenha essas zonas atualizadas no painel ou nas migrations antes de abrir a loja.

Se usar a chave do Google, restrinja-a ao domínio da Vercel e apenas às APIs necessárias. Não use uma chave sem restrições em produção.

## Administração

- Acesse `https://SEU_DOMINIO/admin`.
- O acesso só é habilitado com `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET`.
- A sessão é protegida por cookie `httpOnly`, válido por 12 horas e marcado como seguro em produção.
- O painel acompanha pedidos, permite avançar/cancelar estados permitidos, pausa produtos e mostra a situação das integrações.

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

O token do agente deve ser longo, aleatório e exclusivo. Em produção, execute-o como serviço do Windows ou tarefa agendada, com reinício automático, e faça um teste de ticket antes do horário de atendimento.

## Arquitetura

```text
Cliente (Next.js) ──> API Routes ──> Supabase
                       │              ├─ pedidos, catálogo e zonas
                       │              ├─ pagamentos, auditoria e outbox
                       │              └─ fila de impressão
                       ├─ Mercado Pago (Pix + webhook assinado)
                       ├─ WhatsApp Cloud API (templates de status)
                       └─ Agente local ──> impressora ESC/POS

Admin (/admin) ──────> API Routes protegidas por sessão
```

O servidor é responsável por preço, disponibilidade, regras de entrega, transição de status, autenticação administrativa e segredos. O navegador apenas consome as rotas da aplicação.

## Limitação importante: fallback sem banco

Quando `SUPABASE_URL` e `SUPABASE_SECRET_KEY` não estão configuradas, a aplicação entra em modo de demonstração com catálogo e pedidos em memória. Esse fallback serve apenas para desenvolvimento e preview:

- os pedidos somem ao reiniciar a instância;
- não há persistência, auditoria ou concorrência confiável;
- webhooks, fila de impressão e atualizações de pagamento não têm garantia operacional;
- não é seguro nem adequado para receber pedidos reais.

Para publicar a operação da DogChef, configure Supabase, variáveis de produção, webhooks e o agente de impressão antes de aceitar pedidos.
