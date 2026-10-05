# Story: Publicar openGym em produção

## Status: Approved

Data: 2026-10-05 (America/Sao_Paulo). Responsável pelo escopo: @po. Revisão de arquitetura: aprovada por @architect em `reports/production-architecture.md`. A autorização humana cobre implementação e publicação; Approved libera implementação focal e não substitui os gates de QA/produção.

## Objetivo e fonte

Como operador da instância, quero o aplicativo existente do repositório `https://github.com/jadercarvalhoPRM/openGym.git` funcionando na VPS/Portainer em `https://comespecialista.online`, para usar os recursos já implementados com autenticação e dados persistentes.

Fontes verificadas: pedido humano; destino informado ao orquestrador; `README.md` (Features, Quick start, Your data, Configuration); `docs/SELF_HOSTING.md`; `docker-compose.yml`; `api/package.json`; `frontend/package.json`; `api/server.js`; `frontend/src/store/useStore.js`. Commit inicial do checkout: `c42ba6b98e3776af5981f20c05ba392238799670`.

## Escopo

- Restrição humana explícita: é proibido tocar no UCP. Não abrir, ler, modificar, instalar, reiniciar ou configurar seu repositório, serviços, dados, configurações, DNS, packages ou volumes. Todas as ações desta story ficam confinadas ao openGym; infraestrutura compartilhada só permite alterações em recursos identificados como openGym, preservando os demais.
- Disponibilizar a versão self-hosted existente: frontend React/Vite servido por nginx, API Node/WebAuthn e persistência JSON.
- Configurar build/deploy, DNS/HTTPS, origem única, volumes, mídia de exercícios, bootstrap, backup e verificação funcional.
- Corrigir somente falhas constatadas que impeçam essa entrega. Recursos do roadmap, redesign, autenticação alternativa, cobrança e distribuição de APK não fazem parte deste lançamento.
- O idioma português já existe no produto; preservar as funcionalidades upstream sem adicionar requisitos de customização.

## Critérios de aceite

- [x] AC1 — @architect registra a arquitetura de produção e aprova o escopo antes de alterações no código. A revisão identifica proxy/rede/volumes reais da VPS, compatibilidade com Portainer e risco de impacto em outros serviços. Evidência: `reports/production-architecture.md`; rede matriz/Traefik/Swarm informados por @devops. Colisão de router e volume fresh são gates de deploy pendentes.
- [ ] AC2 — Testes reais da stack passam: `npm test` e `npm run build` em `frontend/`, validação da sintaxe da API e configuração Compose. Registrar comandos, resultados e commit. Não há scripts de lint/typecheck no checkout inicial; definir verificações equivalentes proporcionais e justificar os itens ausentes. Nenhum gate ausente pode ser reportado como executado.
- [ ] AC3 — A URL pública responde por HTTPS com certificado válido; frontend e `/api` usam a mesma origem. `RP_ID=comespecialista.online` e `ORIGIN=https://comespecialista.online` correspondem à URL final antes do cadastro de passkeys. `/api/health` retorna HTTP 200 e `ok: true` no destino de produção.
- [ ] AC4 — Cadastro de perfil, login com passkey, logout e novo login são verificados na URL definitiva. Registrar evidência de WebAuthn real no navegador disponível; autenticador virtual deve ser identificado como tal e não alegado como teste de biometria física. Requisições sem sessão a dados privados retornam 401, e perfis distintos mantêm dados isolados.
- [ ] AC5 — Pela interface, criar, consultar, editar e remover rotina e registro de peso; montar plano semanal; executar e salvar um treino com séries. Confirmar resultado pela interface após reload e pela leitura autenticada de `/api/data`. Usar dados de teste identificáveis e registrar a limpeza sem apagar dados de usuários.
- [ ] AC6 — Dados do perfil, plano, peso e treino persistem após recriação/reinício controlado dos contêineres. `db.json`, `state-<user>.json`, `secret` e `vapid.json` permanecem em volume durável. Registrar backup e procedimento de restauração; exercitar restauração em área isolada antes de declarar recuperação validada.
- [ ] AC7 — Biblioteca de exercícios e pelo menos uma animação carregam na instância pública; imagens/GIFs permanecem disponíveis após restart/redeploy por volume persistente ou inclusão na imagem web immutable validada por manifesto e digest, e o frontend consegue consultar a API. Validar navegação principal, layout mobile e modo visitante local, sem confundir armazenamento de visitante com sincronização autenticada. Equivalência de mídia immutable aprovada por @architect e orquestrador em 2026-10-05.
- [ ] AC8 — Bootstrap documentado usa capacidades existentes e evita exposição acidental de administração ou segredos. Identificar operador, política de cadastro e sequência do primeiro perfil; se usar `INVITE_ONLY`, habilitar após provisionamento seguro do administrador e verificar criação/revogação de convite e recusa de convite inválido. Administração opcional não exige nova feature.
- [ ] AC9 — Deployment é rastreável ao código verificado por commit e imagem/digest; registrar stack, host/domínio, volumes, configuração efetiva sem segredos e procedimento de rollback. Confirmar estado no Portainer e pela URL pública, não somente por build local.
- [ ] AC10 — @qa emite veredito após E2E de produção e lista achados, gates executados e limitações. Story só pode virar Done quando todos os aceites obrigatórios forem verificados; bloqueios de credenciais, navegador, DNS ou dispositivo ficam explícitos.
- [ ] AC11 — Achado de @architect: o checkout contém dados/chaves upstream versionados. A produção começa com volume novo e vazio, gerando `secret` e VAPID novos no runtime; não reutilizar identidade, credencial, chave ou estado upstream. Remover esses artefatos do tracking futuro e acrescentar proteção contra novo commit de dados/segredos, sem imprimir valores nem apagar evidência/histórico nesta story.
- [ ] AC12 — Primeiro cadastro humano ocorre após HTTPS, em janela isolada de bootstrap sem cadastro público aberto. Se administração/invite-only forem habilitados, a sequência é cadastro protegido → identificação do uid → `ADMIN_UIDS` → `INVITE_ONLY` → abertura pública. Validar que nenhuma credencial/admin de teste ou upstream vira proprietário permanente da instância.
- [ ] AC13 — Corrigir o achado de ownership do store: sessão expirada/401, logout e troca A→B não expõem nem sincronizam estado de A para B. Criar regressão que falhe primeiro com o cenário exato; demonstrar auth/sync E2E com dois perfis e dados distintos. Migração visitante→novo perfil deve ser explícita/documentada; falha offline preserva a única cópia recuperável sem permitir mistura de perfis.
- [ ] AC14 — Validar sincronização entre duas sessões/dispositivos: revisão obsoleta não sobrescreve silenciosamente estado mais novo; payload JSON malformado é rejeitado sem corromper arquivos ou derrubar runtime. Documentar a política efetiva de conflito e evidências.
- [ ] AC15 — Confirmar e corrigir a referência de Dockerfile ausente encontrada por @architect; o build Compose final realmente constrói a API e o web. Fixar a origem da mídia a commit/manifest validado e verificar completude dos arquivos servidos. Link de código-fonte/licença da versão publicada deve apontar o fork com os patches distribuídos.

## Tarefas e sequência

- [x] Inspecionar repositório e documentar requisitos existentes (@po).
- [x] Revisar arquitetura, destino e segurança de bootstrap (@architect).
- [x] Aprovar tecnicamente a story e atualizar status para Approved (@architect, autorizado pelo orquestrador após revisão).
- [x] Rodar baseline e definir equivalentes reais de lint/typecheck ausentes (@dev/@qa).
- [ ] Implementar ajustes mínimos comprovados e artefatos de deploy (@dev/@devops).
- [ ] Tratar achados de @architect: chaves/dados tracked, ownership/sync, conflito, payload malformado, Dockerfile, mídia e referência ao source (@dev).
- [ ] Rodar testes e build; revisar alterações (@qa).
- [ ] Configurar Cloudflare e publicar stack isolada na VPS/Portainer (@devops).
- [ ] Executar E2E público, auth, CRUD, persistência e backup (@qa/@devops).
- [ ] Registrar evidências, checklist, file list e veredito final (@qa/orquestrador).

## Notas técnicas para implementação

- A API não possui CRUD separado por recurso: `GET /api/data` retorna `{ state }`, `PUT /api/data` aceita `{ state }` e retorna `{ ok, ts }`. Rotinas, plano semanal, peso e treinos vivem no estado do perfil; não inventar endpoints REST para cumprir o aceite.
- `active` é deliberadamente removido na sincronização e representa treino em andamento local. O teste de persistência cobre treino finalizado, não promete sincronização de sessão em andamento.
- Health upstream: `GET /api/health`. Cadastro: `/api/register/options` e `/api/register/verify`; login: `/api/login/options` e `/api/login/verify`; sessão: `/api/me` e `/api/logout`.
- Portas locais devem ser verificadas antes de iniciar processos; health HTTP deve comprovar runtime. A porta e rota externas serão definidas pela arquitetura existente da VPS, sem assumir disponibilidade de 8080.
- Compose upstream usa imagens `latest` do autor e suporta build local; a escolha de produção precisa garantir rastreabilidade do código deste fork. Não declarar o fork publicado apenas por subir uma imagem upstream.

## Self-audit obrigatório

- [ ] Contratos de API e shapes foram comparados conforme a operação; diferenças intencionais de GET e PUT são documentadas, sem requisito de igualdade literal.
- [ ] Troca de perfil/logout foi exercitada para evitar estado cruzado, incluindo sincronização pendente.
- [ ] Jobs de lembretes/push existentes foram identificados; dependências em `db.json`, assinaturas e VAPID foram preservadas. Não há banco SQL ou tabelas auxiliares no baseline.
- [ ] Formato persistente permaneceu compatível; se houver migração, demonstrar idempotência e rollback em dados isolados. Se não houver migração, registrar N/A com evidência.
- [ ] Falhas corrigidas têm payload/log real, reprodução que falhou antes, teste passando após fix e trace E2E pelo caminho corrigido. Log sintético ou unitário isolado não substitui validação de integração.

## Riscos, revisão e rollback

- Domínio/origem incorretos impedem WebAuthn e trocar RP_ID após cadastro invalida passkeys. Mitigação: fixar URL final antes do bootstrap; validar parâmetros no runtime.
- Volume incorreto perde dados e segredo de sessão. Mitigação: volume durável, backup antes de mudanças e restart/restore isolados.
- Publicação em infraestrutura compartilhada pode afetar serviços existentes. Mitigação: stack/rede identificadas e mudanças confinadas ao openGym.
- Cadastro/admin upstream são opcionais e padrão aberto. Mitigação: revisar exposição de produção e registrar política sem inventar fluxo de autenticação.
- Revisão de mudanças: @architect (integração), @qa (regressão/auth/dados), @devops (publicação/rollback). CodeRabbit, se disponível, deve ser registrado; ausência não pode gerar alegação falsa de aprovação.
- Rollback: preservar backup e dados novos; restaurar imagem/configuração anterior com volume existente. Caso mudança de formato exija restaurar dados, validar a compatibilidade e escolher recuperação sem sobrescrever dados atuais silenciosamente. Registrar passos concretos após conhecer a VPS.

## Evidências e veredito

Pendente. Inserir links/arquivos para logs sanitizados, testes, build, inspeção do runtime, E2E e imagens/digests. Nenhum resultado de produção foi validado pelo @po.

## File list

- `docs/stories/production-launch.md` — story e gates do lançamento.
- `docs/SESSION_STATE.md` — objetivo e estado inicial da execução.
- `reports/production-architecture.md` — arquitetura, riscos concretos, plano mínimo e aprovação técnica.

Atualizar esta lista com cada arquivo efetivamente alterado; nenhum arquivo de implementação foi alterado pelo @po.

## QA Results

QA DNS independente do subdomínio PASS: `app.comespecialista.online` consultado em1.1.1.1 retorna A95.217.161.179 TTL300 (`reports/live-dns-qa.json`). Sem HTTP/TLS ainda; web protegida/novo digest e owner humano pendentes.

Steering posterior do usuário — destino vigente é `app.comespecialista.online`, substituindo plano apex antes de qualquer QA pública. QA atualizou scripts para esse host e validará TLS/RP_ID/ORIGIN/roteador compatíveis; A apenas `app`95.217.161.179 DNSonly. Nenhum cadastro humano havia ocorrido; API deverá mudar somente ambiente e preservar volume ativo `opengym_data_v1-meuservidor1`. Passkey proprietário e QA pública continuam pendentes. Registros CI/apex anteriores são histórico, não configuração final aprovada.

Atualização CI independente de Quinn (@qa), 2026-10-05 — Run [37379154770](https://github.com/jadercarvalhoPRM/openGym/actions/runs/37379154770), commit `f3dd43948ac8b4971392c89ac9e037d547a3590a`, **SUCCESS/PASS** confirmado por consulta e download independente do artefato. Node22.23.3 quality,199+7, browser20/20, Docker build/fresh-volume smoke/nginx/2648checksums/restartkeys/429 e raw bcrypt label real Swarm PASS. Mesmas imagens publicadas: API digest `15c8a4e2f9f1c9bacd8fcec5d9b96a59207c36d43c28bc57e38614c9c91b0957`, web `943d198b5bf7f9fbbf7019c470a7164471fd3ae242aa85384d057fbc25c39bb5`. Preview protegida pode ser implantada; QA VPS/TLS/BasicAuth401+200, configuração/digests destino, passkey proprietário humano e restart/restore VPS permanecem pendentes. Audit runtime0; audit completo15dev-only (inclui critical tar/mobiletooling), risco residual explicitado no relatório, sem claim global0. CodeRabbit WAIVED. Story não Done.

2026-10-05 — Quinn (@qa): aplicativo local PASS nos gates executados: lint/typecheck proporcional, build/locales, 199 testes frontend + 7 API e 20 verificações E2E browser com cerimônia WebAuthn de autenticador virtual. Evidência: `reports/production-qa.md`, `reports/browser-qa.json`, `reports/qa-test.log`. Revisão independente identificou payload nested workouts.entries aceito incorretamente; @dev reproduziu RED e corrigiu, QA final PASS. Nenhum cookie foi forjado no browser E2E; fixture assinada dos testes API é evidência de storage, não de autenticação humana. Promoção/produção CONCERNS/HOLD: Docker/Node22/nginx+CI, CodeRabbit indisponível sem waiver presumido, domínio HTTPS, digests/Portainer, bootstrap do proprietário humano e E2E/restart/restore VPS continuam pendentes. Story não Done.

Atualização posterior de Quinn (@qa), 2026-10-05 — Usuário dispensou explicitamente CodeRabbit: "faça sem o CodeRabbit, pq a minha conta é pessoal". Gate CodeRabbit WAIVED, sem review/zero CRITICAL fictício; gates CI Docker/nginx e QA de produção permanecem obrigatórios. Harness de processo revisado mantém asserts fail-closed/preservação de bytes e `reports/api-process-green.log` confirma 7/7. Próxima validação: CI real antes da promoção de imagens e smoke independente somente openGym em `https://comespecialista.online`, ainda protegido até cadastro humano do proprietário. Nenhum recurso UCP poderá ser acessado ou alterado.

## Dev Agent Record — 2026-10-05

Implementação focal A3–A7/A10/A11 disponível para QA. Dados runtime removidos do tracking futuro (bytes locais preservados). Contratos/ownership/CAS, payload inválido, fail-closed e push providers cobertos por regressões e HTTP local; RED/trace/GREEN em `reports/implementation.md`. Não há alegação de produção nem wave completa.

Baseline: frontend sem lint/typecheck e API sem testes. Gates adicionados: root npm scripts, ESLint JS/JSX, Node syntax, TypeScript checkJs/JSDoc somente da fronteira `api/validation.js`, 199 testes frontend + 7 HTTP API, locales e build. Build passa com aviso de chunk grande. CodeRabbit não executável (WSL não instalado); QA independente obrigatória continua pendente.

Atualização: QA independente registrou E2E local 19 PASS e suites em `reports/qa-test.log`; produção ainda pendente. CodeRabbit Windows nativo está em preparação por @devops a pedido do usuário; indisponibilidade WSL acima não encerra esse gate. Uma execução nested teve timeout de processo em 1200 ms (6/7), preservada em `reports/api-nested-green.log`; comportamento nested foi aprovado, mas o log não representa 7/7. O teste agora aguarda encerramento fail-closed por até 10 s, cancelando o timer quando encerra.

File list adicional do @dev:
- `package.json`, `package-lock.json` — entrada dos gates, instalação usa locks separados frontend/API.
- `.gitignore`, `.env.example` — proteção runtime e configuração sem segredos.
- `data/db.json`, `data/secret`, `data/vapid.json` — removidos do tracking futuro, preservados localmente.
- `api/server.js`, `api/validation.js`, `api/server.test.js`, `api/package.json` — contratos, validação, persistência, segurança e testes HTTP.
- `frontend/src/store/useStore.js`, `frontend/src/store/useStore.test.js` — isolamento por uid, offline, CAS, inflight e reprogramação.
- `frontend/src/views/Login.jsx`, `frontend/src/views/Settings.jsx`, `frontend/src/lib/demo.js` — migração explícita, aviso/recovery sync e source do fork.
- `frontend/src/locales/{de,es,fr,hi,it,ko,pl,pt,ru,tr,zh}.js` — duplicatas antigas preservando último valor e mensagens de sync/migração.
- `frontend/package.json`, `frontend/package-lock.json`, `frontend/eslint.config.js`, `frontend/tsconfig.validation.json` — gates JS/JSDoc.
- `reports/implementation.md`, `reports/{store-red,store-green,api-red,api-green,api-nested-red,api-nested-green,tests-green,lint,typecheck,locales,build}.log` — evidência local.
- `reports/api-process-green.log`, `reports/tests-process-green.log`, `reports/lint-process.log`, `reports/typecheck-process.log` — revalidação do harness de startup; log histórico flaky preservado.
- `reports/source-link-build.log`, `reports/source-link-lint.log` — validação focal A10: footer Settings usa `href={REPO}` do fork; asserção DOM independente pertence à QA e publicação da nova web à DevOps.

Arquivos Docker/Compose/proxy/workflow/mídia pertencem ao @devops; runner navegador e veredito pertencem à QA. Atualizar seus respectivos registros após validação final.
