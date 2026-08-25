# DogChef - Impressao local com QZ Tray

## Objetivo

Permitir que o painel administrativo hospedado na Vercel imprima em filas reais do Windows do computador da loja. A impressao nao depende do servidor acessar a rede local.

## Diagnostico

O fluxo atual salva trabalhos em `print_jobs` e depende do agente local DogChef buscar a fila. Por isso `Ctrl+P` funciona, mas o botao interno informa desconexao quando o agente nao esta instalado ou ativo.

## Arquitetura aprovada

1. O navegador carrega o painel vindo da Vercel.
2. O cliente QZ conecta somente ao QZ Tray em `localhost` por WebSocket seguro.
3. O QZ consulta as filas reais do Windows, identifica a padrao e envia HTML rasterizado ao spooler.
4. A impressora escolhida e salva no `localStorage`, pois pertence ao computador, nao a toda a loja.
5. Se QZ estiver indisponivel, o painel oferece imediatamente a impressao nativa do navegador com apenas o recibo.
6. O agente DogChef e sua fila permanecem como compatibilidade, sem migrations e sem remocao de dados.

## Seguranca e limites

- Nenhuma chave privada sera enviada ao frontend.
- Sem certificado comercial QZ, o usuario aceita e pode memorizar a permissao local. Impressao totalmente silenciosa fica documentada como opcional e depende de certificado confiavel.
- O sucesso do QZ significa que o trabalho foi enviado ao spooler; nao comprova que o papel saiu.
- A confirmacao do pedido nunca depende da impressora.
- Um bloqueio local impede o mesmo clique de criar trabalhos simultaneos duplicados.

## UX

O painel de impressao mostra conexao QZ, filas encontradas, padrao, seletor persistente, reconexao, teste e fallback do navegador. Estados de carregamento sao limitados e erros sao curtos e acionaveis.

## Compatibilidade

USB e rede aparecem quando instaladas como filas do Windows. O QZ nao exige VID/PID nem endereco IP quando o driver ja esta instalado. O fallback nativo continua disponivel em qualquer navegador com `window.print()`.
