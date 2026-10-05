# openGym — revisão independente QA

Data: 2026-10-05. Responsável: Quinn (@qa), invocado pelo orquestrador após revisão de arquitetura. Base upstream c42ba6b98e3776af5981f20c05ba392238799670; release CI f3dd43948ac8b4971392c89ac9e037d547a3590a publicado com imagens testadas. Correção posterior de link source aguarda nova imagem web. Nenhuma memória global foi escrita.

## Veredito e fronteiras

**Destino vigente por instrução posterior do usuário: `https://app.comespecialista.online`.** Novo A apenas no host `app` (95.217.161.179, DNSonly), RP_ID `app.comespecialista.online`, ORIGIN `https://app.comespecialista.online`. Menções ao apex abaixo são histórico da preparação anterior e não autorizam DNS/deploy/teste nesse host. Scripts QA live já usam somente subdomínio; nenhuma requisição pública foi executada até este marco. Restart focal da API para mudar ambiente deve preservar volume ativo e ocorrer antes de qualquer cadastro humano.

**QA DNS pública PASS**: resolver independente1.1.1.1 retorna `app.comespecialista.online →95.217.161.179`, TTL300 (`live-dns-qa.json`). Executado somente após confirmação do DNS pelo DevOps; não houve HTTP/TLS. Web/HTTPS aguardam nova imagem saudável protegida.

Plano read-only de recuperação VPS em `backup-restore-plan.md`: Export do frontend não cobre identidade/chaves do servidor. Candidato restrito é Browse do volume próprio já disponível em Portainer, snapshot com API0 e downloads privados; restore novo volume isolado/readback. Nenhuma operação foi executada, capacidade Browse ainda precisa verificação, e AC6 permanece pendente.

**Aplicativo em runtime local: PASS** (21 verificações após correção source). **CI release37379154770: PASS**, incluindo Node22/Docker/nginx/20 verificações browser e publicação das mesmas imagens testadas. **Produção completa: CONCERNS/HOLD**, até gates no domínio definitivo, proprietário humano e operação VPS serem executados; preview protegida autorizada. **CodeRabbit: WAIVED pelo usuário**, por usar conta pessoal; não houve execução nem PASS atribuído à ferramenta. CI PASS não significa hostname operando, biometria física validada nem proprietário provisionado.

O orquestrador recebeu cedo cada resultado e devolveu um achado real adicional de validação ao implementador. QA não editou o runtime da aplicação; criou apenas runner de testes/evidências e este relatório. Os resultados anteriores de testes do runner com seletores/expectativas incorretos foram corrigidos antes da execução completa final.

## Gates executados independentemente

| Gate | Resultado | Evidência |
| --- | --- | --- |
| Lint JS/JSX + sintaxe API | PASS exit 0 | qa-lint.log |
| Typecheck proporcional JSDoc | PASS exit 0 | qa-typecheck.log; cobre api/validation.js, não todo frontend JS |
| Testes de produto | PASS 199 frontend + 7 API | qa-test.log |
| Build Vite | PASS exit 0 | qa-build.log; aviso de tamanho de chunk Hindi não é falha |
| Locales | PASS exit 0 | qa-locales.log; 11 locales, 636 chaves |
| Auditoria dependências de runtime | 0 vulnerabilidades conhecidas em API e frontend | api-audit.json, frontend-audit.json; `npm audit --omit=dev --json` |
| Mídia inteira | PASS nomes EXDB de 1324 JPG + 1324 GIF | `node scripts/audit-media.mjs` executado pela QA; conteúdo real amostrado no navegador |
| Diff whitespace | PASS `git diff --check` | warnings CRLF não são erros; core diff revisado em qa-reviewed-core.diff |
| E2E browser | PASS 20 verificações | browser-qa.json, browser-qa.log e imagens qa-*.png |

Ambiente local: Windows, Node v24.13.1, Chrome headless lançado com perfil isolado e Playwright bundled. O build/runtime final usa Node22: compatibilidade da imagem é gate CI Docker ainda pendente. API usou diretório recém-criado privado no TEMP, sem data/secret/vapid/passkey upstream. Portas 3000, 5173 e 8888 estavam livres antes da execução; runner encerrou apenas processos próprios. Porta 8080 e Chrome existente foram preservados.

## E2E real executado

Runner: `node scripts/qa-browser.mjs`. Frontend Vite proxy + API Node + mídia local. URL `http://localhost:5173`, exceção segura WebAuthn de localhost. Browser gerou autenticação com CDP Virtual Authenticator; a API verificou criptografia de cadastro e login. Nenhum cookie foi forjado neste runner, nenhuma passkey upstream reutilizada. Cópia de credencial **gerada pelo próprio autenticador de teste** entre autenticadores virtuais modelou sincronização de um gerenciador de passkeys; não prova hardware físico.

1. Cadastro pela interface, cerimônia WebAuthn e `/api/me` autenticado.
2. Criar/renomear rotina e abrir seletor de exercício.
3. Adicionar exercício, salvar plano de segunda-feira e criar peso; API confirma estado.
4. Editar peso pela interface e confirmar persistência.
5. Iniciar treino, marcar série, finalizar e ler histórico salvo autenticado; `active` ausente no snapshot servidor.
6. Reload mantém rotina/peso/treino.
7. Logout UI → `/api/me` 401 → login UI WebAuthn → histórico preservado.
8. Segundo perfil criado por passkey, sem rotinas/treinos de A; admin retorna 403.
9. PUT autenticado de B com `ownerId=A` retorna 409 e não muda B.
10. Snapshot autenticado obsoleto retorna 409 após write novo; target salvo permanece 69, não 65.
11. JSON `{"state":` e state array retornam 400; health permanece 200.
12. Segundo contexto de navegador usa cerimônia de login WebAuthn e recebe dados de A.
13. Guest carrega plano PPL, recarrega e mantém dados locais; nenhum PUT /api/data, GET privado 401.
14. API reiniciada com uid A em ADMIN_UIDS e INVITE_ONLY=1: A admin200, B403; criar/revogar convite e negar inválido/revogado.
15. Reinício mantém treino e sessão/passkey reais do teste.
16. Remover peso pela UI e confirmar API.
17. Remover rotina pela UI e confirmar API.
18. JPG/GIF servidos por proxy frontend com MIME image/* e bytes reais >100.
19. Backup privado do runtime isolado, iniciar API no diretório restaurado, sessão e histórico preservados.
20. Zero `pageerror` no navegador principal.

Este ensaio de restauração é local. Não prova montagem/backup/recovery da VPS.

## Revisão de riscos e RED → GREEN

| Risco | Resultado da revisão | Evidência/limite |
| --- | --- | --- |
| Segredos tracked upstream | Correção necessária foi aplicada ao tracking futuro; Dockerignore e volume fresh previstos | Histórico continua comprometido; volume novo é gate de destino, não comprovado localmente pela Docker |
| Ownership A/401/B | Cache por uid, epoch em requests/timers, limpeza de UI e cópia offline separada | store-red.log contém falhas pré-fix; 7 regressões store passam no qa-test.log; browser valida B isolado/crossowner; fixture store distingue-se de sessão real |
| Snapshot obsoleto | CAS server revision + ownerId, 409 sem overwrite; Settings informa conflito/offline e restauração explícita | API integração + navegador autenticado confirmam latest preservado; não foi implementado merge automático |
| Update durante PUT/inflight de perfil anterior | finally reprograma dirty novo, epoch evita retorno A em B; implementador acrescentou regressões | Testes store no qa-test.log; caso de alta latência browser não foi executado separadamente |
| Payload nested inválido | QA identificou `workouts.entries` validado incorretamente como `w.ex`; dev capturou HTTP200 RED e corrigiu | api-nested-red.log; QA final qa-test.log7/7. `api-nested-green.log` teve timeout antigo na checagem corruptDB e não é usado como único gate final |
| JSON/DB corrompida | Bad JSON400, arrays/nested400, body413; db existente inválida fecha startup sem overwrite | Integração7/7; malformed também browser. Signed-cookie fixture desses testes é para storage, não prova WebAuthn |
| Endpoint push arbitrário | API aceita apenas HTTPS providers conhecidos sem credentials/ports | Teste rejeita localhost/non-HTTPS antes de rede; notificação real em dispositivo não executada |
| Bootstrap | BasicAuth temporário no router + invite-only fechado padrão; primeiro proprietário humano antes de abertura | Revisão de deploy/stack.yml; proteção operando na VPS/hostname e posse humana ainda pendentes |
| Imagens/build | Dockerfile correto, validation.js incluído, npm ci, mídia baked, labels revision/source, publish mesmas imagens testadas | Revisão estática; Docker build/smoke devem executar no CI e digests depois verificar destino |
| Egress API | Rede dedicada com egress NAT, API sem host port; apenas web também em matriz | Revisão infra; isolamento real da rede não executado localmente |

CodeRabbit: anteriormente bloqueado por autenticação/conta da ferramenta, depois **dispensado explicitamente pelo usuário em 2026-10-05**: "faça sem o CodeRabbit, pq a minha conta é pessoal". Estado WAIVED, nenhum review automatizado ou zero CRITICAL alegado. Revisão independente/E2E/CI Docker continuam obrigatórios. A preparação Windows nativa não equivale a review executado e não deverá ser retomada nesta entrega.

Atualização do harness após revisão: o antigo `api-nested-green.log` preserva 6/7 por timeout 1200 ms do processo de corrupção. O implementador ampliou prazo de observação para 10 s e cancela timer ao sair, mantendo assert de exit nãozero e bytes intactos. `api-process-green.log` mostra 7/7 em 1,38 s, sem relaxar o comportamento testado. Este ajuste é exclusivamente do teste; a QA live não alterará dados reais e nenhuma operação fora do openGym está autorizada.

## Rastreabilidade da story e gates restantes

| AC | Cobertura nesta revisão | Estado integral |
| --- | --- | --- |
| AC1 | Arquitetura aprovada antes de código; infra conhecida | Verificado documentalmente |
| AC2 | lint/typecheck proporcional/testes/build/locales PASS; Node22/Docker CI PASS | Local/CI PASS; destino pendente |
| AC3 | same-origin localhost; produção apex HTTPS ainda não executado | Pendente produção |
| AC4 | Cadastro/login/logout virtuais, 2 perfis, 401/403/CAS real | Local PASS; domínio/humano pendente |
| AC5 | UI rotina/peso CRUD + treino salvo/readback/reload | Local PASS; repetir smoke público |
| AC6 | Reinício/restore local isolado; Docker key restart PASS | Local/CI PASS; volumes/restore VPS pendentes |
| AC7 | Mobile viewport, guest/PPL, EXDB toda, JPG/GIF; Docker2648checksums PASS | Local/CI PASS; image/nginx público pendente |
| AC8 | Admin+convites local depois de restart com owner uid | Local PASS; bootstrap proprietário pendente |
| AC9 | Workflow CI PASS, imagens publicadas por commit/digest | Portainer/config/digest destino pendentes |
| AC10 | Veredito QA local explicitamente limitado | Story não Done; E2E público pendente |
| AC11 | Runtime fresh local/CI e tracking futuro protegido | Fresh produção/chaves destino pendentes |
| AC12 | Plano protegido revisado | Pendente cadastro humano final/abertura |
| AC13 | Store red/green + browser perfis/crossowner | Local PASS; propriedade humana e smoke final pendentes |
| AC14 | CAS/malformed/nested/corrupção local e malformed/body Docker PASS | Local/CI PASS; imagem destino pendente |
| AC15 | Docker/media manifest CI PASS; footer fork corrigido e DOM local PASS | Source imagem posterior/destino pendentes |

Antes da conclusão: CI Docker build/Compose/runtime/nginx/rate limit/body limit + checksums; imagens correspondentes por commit/digest; DNS/HTTPS efetivos; Portainer mostra stack isolada/volumes e configuração RP_ID/ORIGIN exata; bootstrap passkey do proprietário humano protegido; E2E público; reinício/backup/restore na VPS; source correspondente publicado. PWA install/offline cache e recebimento de push em dispositivo físico ainda não foram validados; declarar separadamente, sem confundir HTTP200 push/test com entrega.

QA editará apenas QA Results da story; checklist/status final ficam com PO/orquestrador/implementador conforme autoridade.

## CI remoto — atualização antes da preview

Primeiro run [37378408631](https://github.com/jadercarvalhoPRM/openGym/actions/runs/37378408631), commit `2f557d0b5df09acd941dbb9d20b411a3e0d7ec89`: quality gates Node22 PASS e browser E2E **20/20 PASS**, confirmado por download independente do artifact em `reports/ci-first/`. Screenshot mobile de treino salvo inspecionado visualmente: cabeçalho, plano, peso e navegação visíveis sem overflow aparente. Docker config/build falhou antes de construir: fixture sintética bcrypt esperava dollars RAW, porém `docker compose config --format json` serializa dollars duplicados. Log preservado em `qa-ci-first-failure.log`. Docker runtime gate foi SKIPPED, então este run não prova imagem/nginx PASS.

A causa do teste foi verificada no [código oficial Docker Compose](https://github.com/docker/compose/blob/main/cmd/compose/config.go): `runConfig` duplica dollars após serializar quando interpolation está ligada. Ajustar o assert do serializer não substitui gate de label/runtime e HTTP BasicAuth401/200 no destino. Fix delegado a @devops; QA não editou o teste infra. A execução publicadora [37378591908](https://github.com/jadercarvalhoPRM/openGym/actions/runs/37378591908) do mesmo commit foi cancelada antes de Docker; não publicou imagens e não é PASS.

O usuário pediu preview assim que disponível. Publicação em run `publish=true` é permitida **somente depois de todos os quality/E2E/Docker smoke desse próprio run passarem**, usando as mesmas imagens testadas; não é dispensa de gate. Preview protegida no domínio pode anteceder bootstrap/restore, com status parcial explícito. `scripts/qa-live.mjs` está preparado para TLS e GET apenas do domínio autorizado, sem mutações de dados/identidades, e ainda não foi executado contra produção neste ponto.

Run [37378870869](https://github.com/jadercarvalhoPRM/openGym/actions/runs/37378870869), commit `f2242ce6b7f2464769f6e47a6b580a5c14fe982b`, publish=true: quality e browser PASS, mas label-proof falhou pois override de nome de rede perdeu external=true na conversão CLI stack; rede de teste precriada foi tratada como nova rede. Log independente em `qa-ci-label-proof-failure.log`; Docker runtime/publicação SKIPPED. Teste infra corrigido faz assert de output serializado esperado `$$` e adicionalmente inicializa Swarm **somente no runner descartável de GitHub Actions previamente inactive**, deploy de template com 0 réplicas/nenhum pull e inspect do label REAL igual ao sample raw. `finally` remove Swarm de teste; não opera a VPS.

DevOps corrigiu somente override de teste incluindo external:true explícito. Run [37379154770](https://github.com/jadercarvalhoPRM/openGym/actions/runs/37379154770), commit `f3dd43948ac8b4971392c89ac9e037d547a3590a`, publish=true, terminou SUCCESS; nenhum gate foi removido.

### Veredito independente do CI publicador: PASS

QA consultou status e baixou logs/artefato independentemente (`qa-ci-release-status.json`, `qa-ci-release.log`, `ci-release/`). Node **22.23.3**: lint/typecheck proporcional/build/locales/runtime audit, **199 frontend + 7 API**, browser **20/20**, stack config e label real Swarm raw-bcrypt, build de ambas imagens e Docker smoke **PASS**. Smoke verifica volume zero-user, nginx proxy/shell/PWA, 401, malformed400, body413, todos os **2648 checksums**, preservação secret/VAPID após restart e burst autenticador com429. O 502 transitório no log está dentro do restart controlado; health recuperou200 e assert final passou. Passkeys virtuais foram validadas pelo API Node22; este smoke Docker não cadastra proprietário.

As imagens publicadas são as mesmas construídas/testadas nesse run:

- API: `ghcr.io/jadercarvalhoprm/opengym-api@sha256:15c8a4e2f9f1c9bacd8fcec5d9b96a59207c36d43c28bc57e38614c9c91b0957`.
- Web: `ghcr.io/jadercarvalhoprm/opengym-web@sha256:943d198b5bf7f9fbbf7019c470a7164471fd3ae242aa85384d057fbc25c39bb5`.

CI PASS libera implantação da preview protegida, **não** equivale a runtime VPS/HTTPS PASS. Anonimato dos pulls, configurações/digests efetivos na VPS, TLS/BasicAuth401+200, first-owner humano, restart/backup/restore VPS e smoke posterior ainda devem ser registrados. CodeRabbit permanece WAIVED.

Auditoria adicional completa do frontend (`qa-frontend-full-audit.json`, exit1): **15 achados**, 5 moderate/9 high/1 critical; runtime `--omit=dev` continua0. Crítico é `tar` transitivo de `@capacitor/assets`, ferramenta de assets/mobile fora do build web executado. Há achados em ferramentas dev/teste (Vitest/mocker, PostCSS, nanoid etc). Imagem web final copia somente `dist`/mídia para nginx, sem node_modules; API instala runtime omitdev. Nenhum destes15 foi identificado como biblioteca runtime do serviço web/API; são risco residual da cadeia de build/desenvolvimento e não se pode dizer "audit global zero". Não foi executado upgrade major automático ou tooling mobile fora do escopo.

Triage verificada no lock/código instalado: `qa-tar-chain.json` comprova dev `@capacitor/assets3.0.5 → @capacitor/cli5.7.8 → tar6.2.1`. CLI `dist/util/template.js` chama `tar.extract`; callers são add/update/migrate Android/iOS. Workflow e script build executam `vite build`, sem `cap` ou `capacitor-assets`; imagem final nginx recebe apenas dist/mídia. [Advisory oficial node-tar](https://github.com/isaacs/node-tar/security/advisories/GHSA-34x7-hfp2-rc4v) descreve exploração via extração de archive hostil. Não foi identificado esse caminho executado no build web atual.

PostCSS8.5.20 está na cadeia Vite efetivamente executada (`qa-postcss-chain.json`). [Advisory oficial PostCSS](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp) exige CSS controlado pelo atacante e `from` ausente para ler sourcemap fora da árvore. Código instalado Vite8.1.5 `runPostCSS` passa `from: source` explicitamente e o projeto não introduz processamento PostCSS custom/sourceMappingURL. [Vitest/mocker advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9) refere-se a ferramenta de mock/teste, ausente no serviço final. Estes controles reduzem exposição do fluxo atual; não são remediação das versões vulneráveis nem promessa de ausência de outros exploits. Nenhum bloqueador concreto de runtime foi encontrado nesta triagem proporcional.

### Achado adicional na preparação da QA live

AC15/source correspondente tinha falha: `Settings.jsx` footer normal usava href hardcoded `https://github.com/DuarteSantos8/openGym`. REPO fork estava correto, porém usado apenas nos links demo/mobile, ausentes no build selfhost normal. Bundle local pré-patch contém exclusivamente URL upstream (`qa-source-link-red.log`). @dev corrigiu footer para `href={REPO}`. QA acrescentou assert DOM selfhost em `qa-browser.mjs` e executou **21/21 PASS** (`browser-qa-source-green.json`, `browser-qa.log`); esse run já observou o fix pelo Vite. **Não houve RED DOM pré-fix**: não se rotula o run como RED nem restaura código antigo no checkout compartilhado durante release. Evidência anterior é inspeção source+dist. `scripts/qa-live-ui.mjs` verifica link efetivamente renderizado no modo guest; nova imagem web corrigida ainda exige CI/promoção/destino. API não foi alterada por este fix. Preview protegida inicial pode ser apresentada com status parcial.

### Preparação operacional da prévia

Variante autorizada: serviços isolados criados via Portainer Advancedmode sem credenciais de registry; imagem por digest publicada pelo próprio projeto. Nginx startup troca upstream `api` por DNS `opengym_api`, usando rede dedicada, e aplica BasicAuth no server para cobrir SPA/API/mídia/PWA. Revisão estática de `deploy/preview-start.sh`: env obrigatório/hash SHA formato previsto, umask077, arquivo root:nginx640 e nginx-t antes exec. Não há regra allow/satisfy loopback nesta versão, então não existe exceção de autorização baseada em XFF; web image não contém Docker HEALTHCHECK e não herda probe Compose não autenticado. Verificação externa com BasicAuth será gate de saúde.

QA avisou antes da criação web um risco de startup repetido no mesmo filesystem: sed inseria auth_basic novamente sem guard, podendo falhar nginx-t por diretivas duplicadas. DevOps corrigiu com guard, count==1 para ambas diretivas e validação de realm/path. QA releu script e liberou GO estático antes CreateWEB. Wrapper operacional deverá executar prepare duas vezes (sem exec dentro de prepare), com DOIS nginx-t, e depois exec entrypoint. Prova runtime/HTTP continua pendente. QA não editou infra nem inventou log de falha de produção.

DevOps confirmou rede exclusiva `opengym_private_v1` e API saudável montando volume efetivo **`opengym_data_v1-meuservidor1`**, criado novo pelo dropdown Portainer; nome difere do template. Volume inicial `opengym_data_v1` vazio foi preservado, sem migração ou recriação API. Backup/restore deve usar o volume ativo efetivo, nunca assumir o nome do template. DNS previsto: único A95.217.161.179, modo DNSonly; QA assertará este endereço quando hostname receber GO.

Primeira criação web: orquestrador/DevOps reportaram log do próprio serviço com shell syntax error `unexpected end of file (expecting "}")`; empacotamento do comando no parser Portainer precisa correção. Serviço não passou gate de startup; DNS ainda não salvo nesse ponto. QA não iniciou smoke público, não marcou nginx/runtime PASS, e ofereceu revisão read-only dos Args sanitizados (script deve chegar inteiro a sh-c, nenhum segredo dentro dele).

Segunda variante curta e quoted também foi reportada dividida em13 Args pelo parser Portainer. Nenhuma terceira tentativa UI: orquestrador determinou incorporar startup em nova imagem web própria com ENTRYPOINT/CMD JSON, incluindo footer corrigido, sem override do comando na UI. API/volume VPS existentes ficam preservados. Nova imagem exige revisão e CI real com bootstrap401/200 cobrindo API/mídia, preparação repetida/restart e fail-closed env obrigatório; padrão upstreamapi local eopengym_api no destino. DNS não salvo e testes públicos não executados neste marco.

Checklist live preparado, aguardando GO hostname: DNS A esperado conforme modo DevOps; TLS com validação de cadeia/hostname;401 sem credenciais na interface/API/PWA/JPG/GIF/JS, incluindo tentativa de headers loopback forjados;200 correto com credenciais carregadas do arquivo privado; private routes continuam401 por ausência de sessão passkey; manifest2648 e imagens reais; headers; navegador guest isolado sem qualquer request de escrita e footer fork. Sem CUA, sem ler/tocar UCP ou serviços vizinhos; sem cadastro fake de proprietário.
