# Implementação openGym — evidência local

Data: 2026-10-05. Base: c42ba6b98e3776af5981f20c05ba392238799670. Implementador: Dex (@dev). Produção não foi validada neste relatório.

## Origem das reproduções

Os bugs foram reproduzidos contra o código inicial em runtime local isolado, pois essa implantação ainda não tinha produção. Não existe payload/log de produção a alegar. Fixtures são dados de QA criados na execução; não contêm PII, cookies, secret, VAPID ou passkeys do upstream. A fixture de store reproduz o caminho observado de cache A + /api/me 401 + login B.

Payload: `{"routines":[{"id":"qa-A","name":"QA A routine","ex":[]}],"bodyweight":[{"d":"2026-10-05","w":81}],"workouts":[],"_ts":1234}`. Resposta HTTP da sessão expirada: `401 {"error":"not signed in"}`. Payload JSON malformado: `{"state":`. Subscription proibida usa `http://127.0.0.1:3000/api/health`, com chaves fictícias, sem envio de rede.

## RED → GREEN e caminhos

| Achado | RED antes do fix | GREEN / trace |
| --- | --- | --- |
| A3 ownership | reports/store-red.log: 3 falhas, estado A ainda visível após 401 e enviado para B; timestamp indevido | useStore.test.js: reset, cache por uid, debounce e resposta inflight isolados por epoch; migração guest explícita em cadastro |
| A4 concorrência | reports/api-red.log: não existe revision na resposta; overwrite sem CAS | GET revision=0 → PUT owner=A/base=0/revision=1 → PUT obsoleto 409 → owner/cookie divergente 409 → GET preservado; cache dirty intacto no conflito |
| A5 payload | reports/api-red.log: JSON malformado 500, arrays aceitas | 400 objetos/coleções inválidas; 413 corpo >5 MiB; health segue 200 |
| A5 nested revisão QA | reports/api-nested-red.log: workouts.entries objeto aceito (200) | reports/api-nested-green.log: nested rejeitado, mas suite6/7 por timeout1200ms de DB corrupta; QA independente reports/qa-test.log7/7; log falhado preservado |
| A6 dados corrompidos | reports/api-red.log: startup continua com DB corrompida | arquivo existente inválido impede startup, bytes preservados; state existente inválido também fail-closed |
| A7 SSRF push | reports/api-red.log: endpoint HTTP privado aceito | subscription recusada antes da rede; envio filtra providers HTTPS conhecidos; contas disabled não recebem push |

Os testes de HTTP criam usuários e sessões apenas no diretório temporário da suíte para isolar a persistência. Isso não comprova cerimônia WebAuthn. QA independente testa cadastro/login pela interface com autenticador virtual e deve declarar essa condição.

## Comportamento de sincronização

- Localização por dono: `gym_profile_<uid>` guarda state/dirty/revision; `gym_profile_guest` fica separado. Chave legada gym_state_v1 acompanha somente o contexto ativo.
- Expiração e logout escondem dados da conta na UI. A cópia offline fica recuperável após nova autenticação com o mesmo uid, sem virar visitante ou outra conta.
- Cadastro novo migra visitante de forma explícita; login em conta existente preserva visitante separado. UI informa a migração antes do cadastro.
- GET não muda `_ts`. PUT usa revision definida pelo servidor e ownerId que precisa corresponder ao cookie; versão obsoleta recebe 409. Não há merge automático.
- Settings mostra conflito/offline, oferece Export existente e restauração confirmada da versão do servidor. Falha de restauração preserva dirty. Eventos online/foreground reconsultam; alterações durante PUT lento são reprogramadas.
- `_revision` persiste dentro do arquivo; API a entrega separada do state. Arquivos legados válidos começam revision=0 sem reescrita ao ler. Rollback de código legado remove a proteção CAS; exige manutenção/backup e clientes compatíveis. Não há migração SQL.

## Gates executados

`npm run lint`: ESLint sintaxe/regras de runtime JS/JSX do frontend; node --check API. Encontrou 22 chaves duplicadas pré-existentes nos locales; remoção manteve o último valor efetivo de Save/Finish workout. `npm run typecheck`: TypeScript checkJs/JSDoc da fronteira api/validation.js; não é verificação estática completa do frontend JavaScript. Build Vite verifica JSX/imports. `npm run locales`: 11 locales, 636 chaves consistentes; novas mensagens traduzidas em PT, demais locales usam fallback EN explícito.

`npm test`: 199 testes frontend (inclui 7 de ownership/sync) + 7 HTTP API. `npm run build` passou; aviso existente de chunk Hindi >1500 KB registrado, sem erro de build. Logs: reports/tests-green.log, lint.log, typecheck.log, locales.log, build.log. Novas mudanças após estes logs devem ser revalidadas pela QA.

`npm audit --prefix frontend --omit=dev --audit-level=high` e equivalente API: ambos zero vulnerabilidades conhecidas nesta consulta (reports/audit-frontend.log e audit-api.log). `git diff --check` sem erros. Mídia DevOps auditada localmente pelo manifesto: 1324 JPG + 1324 GIF.

CodeRabbit indisponível: `wsl --list --quiet` confirma WSL não instalado. Revisão independente @qa é gate obrigatório; nenhuma aprovação CodeRabbit foi alegada.

Atualização: o usuário exigiu CodeRabbit; DevOps prepara versão Windows nativa. A revisão não está dispensada pela ausência de WSL. QA independente registrou E2E local19 PASS e suites199+7 PASS em reports/qa-test.log. A execução histórica api-nested-green.log teve timeout de processo (6/7); preservada e reconhecida. Teste processo foi corrigido para aguardar até10s com timer cancelado no encerramento, mantendo prova de exit nãozero e bytes intactos. Revalidação: reports/api-process-green.log.

## Dados e proteção de fonte

`git rm --cached` remove tracking futuro de data/db.json, data/secret, data/vapid.json mantendo bytes locais. .gitignore bloqueia runtime/.env/backups/deps. As chaves públicas no histórico continuam expostas: produção precisa volume novo/vazio e geração runtime própria. Não foram impressos nem reutilizados valores. DevOps configura Dockerignore e volume fresco; este relatório não prova o runtime de produção.

Link source da interface agora aponta jadercarvalhoPRM/openGym; licença/NOTICE preservadas. Mudanças ainda precisam ser publicadas no fork para cumprir a oferta de fonte correspondente do serviço.

## Self-audit e gates restantes

- user shapes register/login/me mantidos; GET /data {state,revision}, PUT {ok,ts,revision}; diferença por método intencional. Todas mutações da UI usam o mesmo PUT snapshot.
- Jobs: push/subs/invites/lastReminder no DB existente; timers/presença efêmeros. Sem tabela auxiliar/cron novo.
- Revisão/idempotência: leitura legada revision=0; write CAS adiciona campo reservado, não há reescrita silenciosa. Backup/restauração real é gate DevOps.
- QA local navegador/passkey virtual/CRUD/sync e QA público obrigatório pendentes ao fechar a implementação. Docker build/smoke GHCR, DNS/TLS, volume produção, restart/restore, bootstrap humano e dispositivo físico permanecem separados dos testes acima.
