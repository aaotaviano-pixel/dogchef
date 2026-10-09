# Dog do Chef — experiência cinematográfica

Esta pasta contém uma apresentação vertical construída do zero a partir do site de produção. O animatic anterior permanece intacto.

## Abrir

- Prévia interativa: `http://127.0.0.1:3192/marketing/dogchef-commercial/alternative/index.html`
- Master cinematográfico definitivo (45 s, 30 fps): `output/dogchef-site-experience-surreal-silent.mp4`

## Arquivos principais

- `index.html`, `styles-surreal.css`, `player-surreal.js`: direção cinematográfica e animação determinística.
- `styles.css`, `player.js`: base da versão limpa preservada.
- `capture-tour.mjs`: captura segura dos estados do site real em viewport móvel.
- `capture-motion.mjs`: captura o banner e o carrossel reais em movimento e registra os quadros de origem.
- `render.mjs`: renderização quadro a quadro.
- `assets/capture-manifest.json`: origem, paleta e verificações da captura.
- `analysis.md`: leitura das referências.
- `storyboard.md`: estrutura narrativa.
- `qa.md`: validação da entrega.

## Segurança do fluxo

A aquisição do material abriu um produto e adicionou um item apenas ao carrinho temporário do navegador automatizado; nenhum login, pedido ou pagamento foi enviado. O filme final não mostra carrinho ou pagamento: encerra valorizando o estabelecimento e, em seguida, apresenta a assinatura MPO.
