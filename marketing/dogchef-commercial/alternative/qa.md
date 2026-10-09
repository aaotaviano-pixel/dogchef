# QA do master cinematográfico

## Resultado

- Arquivo: `output/dogchef-site-experience-surreal-silent.mp4`
- Formato: H.264 High / MP4, `yuv420p`
- Resolução: 1080 × 1920 (`9:16`)
- Duração: 45,00 s
- Cadência: 30 fps reais (1.350 quadros)
- Tamanho: 37.067.768 bytes (aproximadamente 35,4 MiB)
- SHA-256: `abc85c47b4fbdf72af4af08d89c39505b59566c1c374869f5494d477d6d9cd22`
- Áudio: ausente nesta prévia

## Verificações realizadas

- JavaScript dos scripts de captura, composição e renderização validado pelo Node.js.
- Movimento derivado de frame, sem aleatoriedade ou dependência de rede durante a renderização final.
- Estados estáticos recapturados em DPR 2; fotografias e tipografia do site permanecem mais nítidas no master.
- Banner principal e carrossel de categorias capturados em movimento diretamente da produção.
- Enquadramento do banner recebeu deslocamento vertical contínuo para comunicar navegação, sem super zoom.
- A permanência na tela principal foi reduzida e o ritmo entre banner, categorias e catálogo foi reequilibrado.
- O vazio após categorias continua coberto pela ponte animada “PRENSADÕES”.
- Produto real “Combo do Chef” apresentado dentro da mesma moldura de navegação.
- Carrinho e pagamento foram retirados da montagem final.
- A antiga etapa de pagamento foi substituída por uma cena editorial do Dog do Chef: fotografia real, logo, Guaxupé — Minas Gerais e a assinatura “Sabor que surpreende”.
- Seção real “Sobre nós” mantida antes da assinatura MPO.
- Transições entre marca local, seção institucional e CTA usam recortes opacos; não há sobreposição fantasma de telas.
- Logotipo, domínio, textos e elementos principais permanecem dentro da área segura vertical.
- O renderizador espera o carregamento de imagens, vídeos e fontes, aquece o primeiro quadro e aguarda a composição completa antes de cada captura.
- Quadros-chave e junções do render paralelo inspecionados em resolução integral.
- MP4 decodificado integralmente sem erro.
- Decodificação confirmou 1.350 quadros, 45,00 s, 1080 × 1920 e 30 fps.
- Nenhuma ocorrência foi emitida pelo filtro `blackdetect`.
- Paleta confirmada no CSS da produção: `#d6402c`, `#f0a202`, `#241c15`, `#fff6ec`.

## Segurança

A aquisição do material adicionou um item somente ao carrinho temporário da sessão automatizada e parou antes de login, criação de pedido ou pagamento. Nenhum pedido de produção foi enviado.

## Observação

A gravação de referência enviada não possui faixa de áudio; por isso ela foi usada apenas para estudar ritmo de navegação e continuidade visual. A trilha ou locução pode ser produzida depois sem alterar esta composição.
