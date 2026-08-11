# Pendencias do DogChef

## Numero e credenciais do WhatsApp comercial

- A cliente ainda precisa informar o numero comercial completo com codigo do pais e DDD.
- Ate a configuracao, a vitrine exibe o botao verde com o placeholder `[PENDENTE-CLIENTE]`, bloqueando a abertura de uma conversa invalida.
- O numero deve ser cadastrado somente em `NEXT_PUBLIC_WHATSAPP_NUMBER` no ambiente da aplicacao, sem senha ou token.

## Producao

- Migrations do showcase e da senha administrativa aplicadas no projeto Supabase remoto em 2026-08-02.
- Configurar SMTP proprio e as Redirect URLs do Supabase Auth para o reset de senha em producao.
- Upstash `dogchef-ratelimit` provisionado no plano Free e conectado aos ambientes
  Production e Preview da Vercel em 2026-08-02. O middleware de rate limiting esta ativo;
  acompanhar o consumo da cota e manter as credenciais fora do Git.
- Para listar mais de uma impressora no painel, cadastrar apenas IDs e nomes em
  `PRINT_PRINTER_OPTIONS` e os respectivos enderecos locais em `agent/.env` usando
  `PRINTER_PROFILES_JSON`. A impressora padrão continua compatível sem configuração extra.
- No Windows, o agente local precisa permanecer em execução para que a lista de impressoras
  instaladas apareça no painel e para que o spooler receba os tickets.
- A conta/serviço do Windows precisa ter permissão para imprimir na impressora escolhida.
- A migration `20260810030000_print_test_jobs.sql` precisa estar aplicada no Supabase remoto
  para habilitar o botão **Testar impressão** do painel sem criar pedido de teste.
- A impressora IPP virtual `http://192.168.1.11:10631/p/virtual` só é acessível a computadores
  na mesma rede; a Vercel não deve e não consegue acessá-la diretamente.
- Depois de preencher `agent/.env` na máquina real, executar uma vez
  `agent/install-windows.ps1` para registrar a inicialização automática do agente.
