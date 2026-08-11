# Auditoria de producao - DogChef

Data: 2026-08-11
Escopo: aplicacao Next.js, APIs, Supabase/PostgreSQL, Vercel, autenticacao,
pagamentos, imagens, impressao local, performance e validacao do storefront.

## Resultado executivo

- O storefront de producao respondeu HTTP 200 e carregou o catalogo real.
- O alias publico `https://dogchef-one.vercel.app/` foi usado para validar a interface.
- O deployment direto da Vercel continua sujeito a protecao de acesso da conta; isso e
  uma politica da Vercel, nao um erro do aplicativo.
- Nao foram criados pedidos, clientes, pagamentos ou alteracoes remotas durante a auditoria.
- A aplicacao tem persistencia de pedido antes da impressao, rate limiting por rota,
  RLS restritiva e validacao de entrada com Zod.

## Pontos fortes

- Next.js App Router com TypeScript e compilacao de producao validada.
- Supabase acessado no servidor por chave secreta; o navegador usa somente a chave publica.
- RLS habilitada nas tabelas de negocio e acesso direto revogado para `anon` e `authenticated`.
- Sessao administrativa e sessao de cliente usam cookies separados, assinados e `httpOnly`.
- Senhas locais usam scrypt com salt; senha de cartao nunca e salva.
- Checkout recalcula catalogo, disponibilidade, adicionais, horario, frete e total no servidor.
- Cliente consulta somente seus proprios pedidos; acompanhamento publico exige token hash.
- Upload aceita somente imagens declaradas, com limite de 12 arquivos e 8 MB por arquivo.
- Impressao local nao tenta acessar IP privado pela Vercel: o agente local faz polling HTTPS
  autenticado e conversa com Windows, USB/spooler, TCP, UNC ou IPP.
- O pedido permanece salvo quando a impressao falha e pode ser reenviado.
- Home validada sem overflow em 375, 390, 414, 768, 1366 e 1920 px.
- Console de producao nao apresentou erros ou avisos durante o smoke test.

## Correcoes aplicadas nesta auditoria

1. Atualizado `next` e `eslint-config-next` de 16.2.12 para 16.3.0.
2. Atualizadas dependencias transitivas de `postcss`, `sharp`, `nanoid` e `js-yaml`.
3. `npm audit` completo terminou com zero vulnerabilidades.
4. Webhook Mercado Pago agora rejeita assinatura fora de uma janela de 5 minutos.
5. Entregas de webhook passam a ser registradas em `payment_webhook_deliveries`, com
   deduplicacao por request/payload e marca de processamento.
6. Webhook consulta o pedido diretamente pelo ID externo, em vez de carregar a lista de
   pedidos administrativos.
7. Webhook valida modalidade Pix, moeda BRL e valor total do pedido.
8. Status de pagamento aprovado nao pode ser rebaixado por notificacao atrasada.
9. Corpo JSON malformado do webhook retorna erro 400 padronizado.

## Validacoes executadas

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `npm test`: 5 testes IPP aprovados.
- `npm run build`: aprovado com Next.js 16.3.0.
- `npm audit --json`: zero vulnerabilidades.
- Home de producao: HTTP 200.
- API `/api/v1/menu`: catalogo carregado, 6 categorias, 32 produtos e pedidos abertos.
- Carrinho: adicionar, abrir, incrementar, decrementar e remover item aprovados.
- Produto: modal de personalizacao e preco total visualizados.
- Responsividade: nenhum overflow horizontal nos breakpoints auditados.
- Testes reais de IPP e Windows continuam registrados no Segundo Cerebro; nao foram
  repetidos nesta rodada para nao criar novo job fisico sem necessidade.

## Pendencias externas

- Aplicar `supabase/migrations/20260810030000_print_test_jobs.sql` no projeto Supabase
  remoto. A CLI exige login ou `SUPABASE_ACCESS_TOKEN`; nenhum token foi criado ou exposto.
- Configurar Mercado Pago real, SMTP do Supabase e numero comercial do WhatsApp.
- Instalar/configurar o agente local no computador da cozinha e validar impressora fisica.
- Validar fluxo OAuth Google com uma conta real da cliente.
- O alias publico e o endereco de deployment podem ter politicas diferentes de protecao
  da Vercel; o dominio oficial deve apontar para o projeto correto da conta conectada.

## Arquivos relevantes

- `middleware.ts`: rate limiting Edge por IP e sensibilidade da rota.
- `src/lib/store.ts`: persistencia, consulta direta de pedido, webhook idempotente e fila.
- `src/app/api/v1/payments/webhook/route.ts`: assinatura e processamento Mercado Pago.
- `agent/index.ts` e `agent/ipp.ts`: camada local de impressao.
- `supabase/migrations/`: schema aditivo e politicas de dados.
- `C:\mind\projetos\dogchef\`: Segundo Cerebro atualizado com esta rodada.
