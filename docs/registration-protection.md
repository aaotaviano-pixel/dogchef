# Proteção contra cadastros abusivos

## Implementação local

- Cadastro por e-mail: limite compartilhado de 3 tentativas/hora por IP, 10/dia por IP e 3/hora por e-mail, além do limite curto de 5/minuto no middleware.
- Primeiro cadastro Google: exige identidade Google confirmada pelo Supabase e passa pelos mesmos limites antes de inserir em `customer_accounts`. Clientes existentes não consomem a cota de novos cadastros.
- IPv6 é agrupado por /64. Variações Gmail com pontos, `+alias` e `googlemail.com` compartilham a cota de e-mail; isso não mescla nem modifica contas existentes.
- Contadores usam HMAC com `CUSTOMER_SESSION_SECRET`: não armazenam IP/e-mail em texto aberto no Redis. Os domínios da loja compartilham os mesmos contadores.
- Campo invisível anti-bot, validação de telefone e corpo JSON limitado a 16 KiB nos dois endpoints.
- Login administrativo tem um contador curto separado do cadastro e login de clientes.
- Falha/timeout do Redis bloqueia somente novos cadastros com HTTP 503. Excesso de tentativas retorna HTTP 429 com `Retry-After`. O middleware geral mantém o comportamento anterior de disponibilidade para loja e checkout.

Não houve migration nem modificação de dados existentes. Pedidos, produtos, sessões e credenciais existentes foram preservados.

## Configuração necessária ao publicar

O servidor precisa de `CUSTOMER_SESSION_SECRET` e de um dos pares já suportados:

- `KV_REST_API_URL` / `KV_REST_API_TOKEN`; ou
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

Sem esse armazenamento, o cadastro retorna 503 por segurança. Use Redis separado em desenvolvimento para não consumir as cotas reais da loja. Não publique valores de exemplo nem rotacione o segredo de sessões apenas para ativar esta melhoria.

### CAPTCHA opcional, preparado mas ainda não ativado

Configure um widget Cloudflare Turnstile para os hostnames efetivamente usados pela loja. Adicione **juntas** as variáveis `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` no ambiente correspondente e faça um novo build/deploy. A chave pública é incorporada ao frontend no build. Nunca exponha a chave secreta no frontend.

A API valida o token no Siteverify e exige hostname correspondente e ação `register`. Tokens ausentes, expirados ou inválidos não autorizam cadastro. Com apenas uma variável configurada, o cadastro retorna 503. Sem ambas, continuam valendo limites, validação e honeypot, mas não há CAPTCHA.

Não use as chaves de teste da Cloudflare em produção. Após provisionar, teste criação de uma conta consentida em homologação, expiração do desafio e retorno do login Google de cliente existente.

### E-mail e limite da proteção

O cadastro por senha atual é próprio, em `customer_accounts`, e **ainda não confirma a propriedade do e-mail**. O painel Supabase consultado não tinha SMTP personalizado configurado. Ativar uma opção de confirmação no Supabase não adiciona confirmação automaticamente ao endpoint próprio: isso requer uma implementação específica e um remetente autorizado, a serem tratados numa etapa posterior sem migrar usuários às cegas.

O bloqueio Google ocorre antes de criar o cliente da loja, mas depois da autenticação do provedor: ele não impede a criação prévia de uma identidade em Supabase Auth. Não equivale a um bloqueio global de bots no provedor.

Limites por IP podem afetar pessoas numa mesma rede e não impedem um atacante distribuído de criar contas com IPs e e-mails diferentes. Avaliar os retornos 429/503 após publicação e ajustar limites conforme tráfego legítimo, sem registrar senhas/tokens/IPs em logs.

## Validação e publicação

Testes automatizados cobrem cotas, Redis indisponível/timeout, identificação de IP, aliases, corpo inválido/excessivo, telefone, Siteverify, cadastro válido com senha derivada e login/criação Google. As integrações de escrita são simuladas: nenhum cliente de teste foi inserido no banco de produção.

Também foram executados build, TypeScript, ESLint e conferência do formulário local no navegador.

No momento da implementação, a publicação estava impedida: a conta GitHub conectada (`MarcosPauloOtaviano`) tinha apenas leitura no repositório `aaotaviano-pixel/dogchef`, e a credencial local da Vercel retornava 403. É necessário autenticar com acesso de escrita/publicação; não trocar o repositório nem criar uma segunda loja para contornar esse bloqueio. O login Cloudflare também dependia do titular da conta.

As mudanças deste documento descrevem o código local; não constituem evidência de deploy em produção.
