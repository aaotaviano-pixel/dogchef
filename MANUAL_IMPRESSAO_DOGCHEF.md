# Manual de Impressao - DogChef

## Resumo para a administradora

1. Instale a impressora normalmente no Windows.
2. Imprima uma pagina de teste pelo proprio Windows.
3. De dois cliques em `Instalar-QZ-DogChef.cmd` ou instale pelo link **Instalar QZ Tray** dentro do painel.
4. Deixe o QZ Tray aberto ao lado do relogio do Windows.
5. Abra o DogChef, entre em **Impressao**, escolha a impressora e clique em **Testar impressao**.
6. Na primeira vez, permita o acesso e marque a opcao para lembrar.

Nao e preciso descobrir IP, porta, VID, PID ou compartilhamento. Se uma impressora USB ou de rede aparece em **Configuracoes > Bluetooth e dispositivos > Impressoras e scanners** do Windows, ela deve aparecer no DogChef.

## Como funciona

```text
DogChef na Vercel (HTTPS)
  -> navegador da loja
  -> QZ Tray em localhost (WebSocket local)
  -> fila/spooler do Windows
  -> impressora USB, de rede ou termica
```

A Vercel nao acessa a rede local. O pedido e salvo antes de qualquer tentativa de impressao. Quando um envio falha, o pedido continua no painel e pode ser impresso novamente.

## Instalacao simples

### Opcao 1 - arquivo do DogChef

De dois cliques em `Instalar-QZ-DogChef.cmd`. O Windows pode pedir permissao de administrador. Ao terminar, o QZ Tray inicia e fica na bandeja do sistema.

### Opcao 2 - instalador oficial

No painel, abra **Impressao** e clique em **Instalar QZ Tray**. Baixe a versao para Windows, execute o instalador e mantenha as opcoes padrao.

O QZ Tray inicia com o Windows por padrao. Se nao aparecer ao lado do relogio, abra **QZ Tray** pelo menu Iniciar.

## Usar o painel

- **QZ conectado**: o navegador encontrou o servico local.
- **Conectando**: tentativa em andamento, limitada a 15 segundos.
- **QZ desconectado**: abra/instale o QZ e clique em **Reconectar**.
- **Imprimir em**: mostra as filas reais informadas pelo Windows.
- **Testar impressao**: envia um cupom curto para a fila escolhida.
- **Imprimir pelo navegador**: abre o mesmo cupom isolado no dialogo padrao (`Ctrl+P`).
- **Imprimir agora**: imprime um pedido salvo; cliques simultaneos repetidos sao bloqueados.
- **Fila do agente**: compatibilidade com a instalacao antiga, nao e o caminho principal.

A mensagem **enviado para a impressora** confirma que o QZ entregou o trabalho ao spooler. A confirmacao fisica continua sendo o papel sair corretamente.

## Seguranca

O frontend nao contem chave privada. Sem certificado confiavel do QZ, o aplicativo pode mostrar um pedido de permissao. Clique em permitir somente quando o dominio exibido for o DogChef e marque para lembrar a decisao.

Impressao totalmente silenciosa depende de certificado QZ real e assinatura no backend. Esse recurso nao foi fingido nem habilitado com chaves de demonstracao. Se for contratado futuramente, a chave privada deve existir apenas como segredo do servidor.

## Impressora USB

Instale o driver do fabricante, conecte o cabo e confirme que a fila aparece no Windows. O DogChef usa a fila do Windows; nao exige VID/PID.

## Impressora de rede

Adicione a impressora no Windows por IP, compartilhamento ou IPP. Depois que a fila estiver instalada e uma pagina de teste do Windows funcionar, clique em **Reconectar** no DogChef.

O endereco IPP virtual `http://192.168.1.11:10631/p/virtual` e local. Ele deve ser instalado/testado no computador da mesma rede; nunca deve ser configurado como destino da Vercel.

## Fallback do navegador

Se QZ estiver fechado, o botao de pedido abre automaticamente o recibo no dialogo nativo. O fallback usa um documento interno temporario e nao depende de liberar pop-ups. O documento contem somente o pedido, sem menu, painel ou botoes administrativos.

## Matriz de validacao - 25/08/2026

| Teste | Resultado | Evidencia |
| --- | --- | --- |
| T01 - build/lint/testes | TESTADO E APROVADO | Suite, TypeScript, ESLint e build Next executados. |
| T02 - QZ instalado e ativo | TESTADO E APROVADO | QZ Tray 2.2.6 e portas locais 8181/8182. |
| T03 - QZ ausente | TESTADO E APROVADO | Timeout em 15 s, mensagem clara e reconexao habilitada. |
| T04 - descoberta Windows | TESTADO E APROVADO | Quatro filas reais encontradas nesta maquina. |
| T05 - impressora padrao | TESTADO E APROVADO | Microsoft Print to PDF identificada como padrao do Windows. |
| T06 - selecao persistente | TESTADO E APROVADO | Fila escolhida mantida apos recarregar a pagina. |
| T07 - QZ reconnect | TESTADO E APROVADO | Filas retornaram depois de reiniciar o QZ. |
| T08 - bloqueio duplicado | TESTADO E APROVADO | Teste unitario bloqueia trabalho simultaneo e libera retry. |
| T09 - recibo seguro | TESTADO E APROVADO | Dados escapados e layout de 80 mm testado. |
| T10 - painel desktop | TESTADO E APROVADO | QZ, seletor e acoes renderizados sem sobreposicao. |
| T11 - painel mobile 375 px | TESTADO E APROVADO | Sem overflow horizontal. |
| T12 - envio a impressora fisica | PENDENTE DE HARDWARE/AMBIENTE | Esta maquina possui somente filas virtuais. |
| T13 - papel impresso | PENDENTE DE HARDWARE/AMBIENTE | Exige impressora termica fisica conectada. |
| T14 - IPP virtual 192.168.1.11 | PENDENTE DE HARDWARE/AMBIENTE | Servidor IPP precisa estar ativo e alcancavel na rede local. |
| T15 - producao Vercel -> papel | PENDENTE DE HARDWARE/AMBIENTE | Validar no computador da loja depois do deploy e da permissao QZ. |

## Solucao rapida de problemas

| Sintoma | Acao |
| --- | --- |
| QZ desconectado | Abra QZ Tray e clique em **Reconectar**. |
| Nenhuma impressora | Instale o driver/fila no Windows e confirme a pagina de teste do sistema. |
| Fila aparece, mas nao imprime | Abra a fila no Windows, confira papel, offline, pausa e trabalhos presos. |
| Pedido salvo, impressao falhou | Use **Imprimir agora** novamente ou **Imprimir pelo navegador**. |
| Dialogo nativo nao abre | Clique em **Imprimir pelo navegador**. Atualize o navegador se a caixa de impressao continuar indisponivel. |
| QZ pede permissao sempre | Marque para lembrar; impressao silenciosa sem dialogo exige certificado real. |
| Impressao duplica | Nao acione a fila legada junto com o QZ. Em timeout de envio, confira a impressora antes de tentar novamente. |
| IPP local nao responde | Confirme servidor, IP, porta, firewall e se ambos estao na mesma rede. |

## Agente antigo

O `DogChef Print Agent` continua no repositorio para quem ja utiliza polling da fila e ESC/POS RAW/TCP/IPP. Suas configuracoes permanecem em `agent/.env`; nenhum dado ou migration foi removido. Novas instalacoes devem comecar pelo QZ Tray, que e mais simples para impressoras ja reconhecidas pelo Windows.
