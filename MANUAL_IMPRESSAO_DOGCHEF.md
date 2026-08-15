# Manual de Impressao - DogChef

Este manual explica como deixar a impressao funcionando no DogChef publicado na
Vercel. A Vercel salva os pedidos, mas a impressora fica no estabelecimento. Por
isso, o computador da cozinha precisa executar o **DogChef Print Agent**.

## Como a impressao funciona

1. O cliente faz o pedido no site.
2. A administradora confirma o pedido no painel.
3. O DogChef Print Agent, instalado no computador da cozinha, busca o ticket pela
   internet de forma autenticada.
4. O agente envia o ticket para a impressora instalada no Windows, USB, rede ou IPP.

O pedido e salvo antes da impressao. Se a impressora estiver desligada, o pedido nao
e perdido e pode ser reimpresso pelo painel.

## Antes de comecar

- Deixe o computador da cozinha ligado e conectado a internet.
- Para impressora USB, instale-a normalmente no Windows e imprima uma pagina de teste
  pelo proprio Windows antes de abrir o DogChef.
- Para impressora de rede, confirme que o computador consegue acessar o IP e a porta
  informados pelo fabricante.
- Nao coloque senha, token ou endereco interno da impressora na Vercel, no GitHub ou
  no painel do cliente. Esses dados ficam somente no computador da cozinha.

## Configuracao inicial do agente

No computador ligado a impressora, abra o PowerShell e execute:

```powershell
cd C:\DOGCHEF
Copy-Item .\agent\.env.example .\agent\.env
notepad .\agent\.env
```

Preencha somente os dados recebidos da administracao tecnica:

- `DOGCHEF_API_URL`: endereco publico do DogChef.
- `PRINT_AGENT_TOKEN`: mesmo token privado configurado na Vercel.
- `PRINT_AGENT_ID`: um nome para este computador, por exemplo `cozinha-1`.

Nao copie o token em conversas ou capturas de tela.

### Impressora USB instalada no Windows

Nao e preciso procurar VID, PID, porta USB ou nome tecnico. Com a impressora instalada,
rode:

```powershell
npm run print-agent:list
```

Escolha no painel a fila que aparece nessa lista. O agente usa o spooler real do
Windows, igual a janela de impressao do sistema.

### Impressora de rede TCP

No `agent/.env`, use o IP e porta fornecidos pelo fabricante, geralmente `9100`:

```env
PRINTER_TRANSPORT=tcp
PRINTER_HOST=192.168.1.50
PRINTER_PORT=9100
```

O exemplo acima e apenas ilustrativo. Use o IP real da impressora.

### Impressora IPP de teste

Para a IPP virtual usada nesta validacao, mantenha o endereco apenas em
`agent/.env`:

```env
PRINTER_PROFILES_JSON=[{"id":"ipp-virtual","name":"IPP virtual de teste","transport":"ipp","ippUri":"http://192.168.1.11:10631/p/virtual","ippDocumentFormat":"text/plain"}]
```

Em seguida, teste sem criar pedido:

```powershell
npm run print-agent:diagnose -- --ipp-url http://192.168.1.11:10631/p/virtual
npm run print-agent:test -- --ipp-url http://192.168.1.11:10631/p/virtual
```

O primeiro comando apenas consulta a IPP. O segundo envia um ticket minimo. So
considere a impressao aprovada quando aparecerem `IPP_JOB_ACCEPTED` e
`PRINT_JOB_SUCCESS` no terminal ou quando a fila virtual registrar o documento.

## Iniciar todos os dias

Para testar manualmente o agente:

```powershell
cd C:\DOGCHEF
npm run print-agent
```

Depois de confirmar que esta conectado, feche o teste com `Ctrl+C` e instale a
inicializacao automatica uma unica vez:

```powershell
powershell -ExecutionPolicy Bypass -File .\agent\install-windows.ps1
```

O Windows iniciara a tarefa **DogChef Print Agent** ao entrar na conta. Para conferir,
abra o Agendador de Tarefas do Windows e procure esse nome.

## Escolher e testar pelo painel

1. Abra o link administrativo do DogChef e entre com a senha atual.
2. Entre em **Impressao**.
3. Aguarde o status de servico conectado e as impressoras encontradas.
4. Selecione a impressora desejada.
5. Clique em **Testar impressao**.
6. Confira o resultado no terminal do agente e na fila/impressora.

Para pedidos reais, confirme o pedido primeiro. Se a impressao falhar, o painel deve
mostrar o pedido salvo e permitir **Reimprimir pedido** depois que a conexao voltar.

## Significado dos status

- **Servico local conectado**: o agente chegou a API do DogChef.
- **Impressora disponivel**: o Windows ou o perfil local informou que ela esta pronta.
- **Impressora sem resposta**: a fila existe, mas nao respondeu ao teste.
- **Servico de impressao desconectado**: o agente nao esta aberto, perdeu a internet ou
  o token nao corresponde ao configurado na Vercel.
- **Falha na impressao**: o pedido foi preservado; corrija a causa e use reimpressao.

## Resultado da validacao em 15/08/2026

- O agente descobriu quatro filas reais do Windows nesta maquina: OneNote, XPS,
  Microsoft Print to PDF e Fax. Nenhuma impressora termica fisica estava instalada.
- A maquina esta em `192.168.1.9`; o destino `192.168.1.11:10631` foi marcado pelo
  Windows como **Unreachable**.
- O diagnostico IPP e o envio do ticket de teste foram executados e terminaram em
  `IPP_TIMEOUT` / `PRINT_JOB_FAILED`. Nenhum trabalho foi aceito pela IPP virtual.

Para repetir com sucesso, inicie ou reconecte o servidor IPP virtual em
`192.168.1.11`, confira firewall/porta `10631` e execute os dois comandos de teste
novamente. O site da Vercel nunca deve tentar acessar esse IP diretamente: somente o
computador local com o agente faz essa conexao.

## Solucao rapida de problemas

| Sintoma | O que conferir |
| --- | --- |
| `IPP_TIMEOUT` | Servidor IPP ligado, IP correto, porta `10631` liberada no firewall e computadores na mesma rede. |
| Nenhuma impressora na lista | Instale a impressora no Windows e imprima a pagina de teste do Windows. |
| `Agente nao autorizado` | O token local nao corresponde ao token privado da Vercel. Gere/atualize-o somente pela administracao tecnica. |
| Pedido salvo, mas sem impressao | Deixe o agente ativo, corrija a impressora e use **Reimprimir pedido**. |
| Painel nao permite teste | Confirme a senha administrativa atual e se a migration de teste de impressao foi aplicada no banco. |

