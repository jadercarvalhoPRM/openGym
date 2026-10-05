# openGym — revisão independente QA

Data: 2026-10-05. Responsável: Quinn (@qa), invocado pelo orquestrador após revisão de arquitetura. Base upstream c42ba6b98e3776af5981f20c05ba392238799670; alterações de lançamento ainda locais nesta revisão. Nenhuma memória global foi escrita.

## Veredito e fronteiras

**Aplicativo em runtime local: PASS**, dentro dos cenários executados abaixo. **Promoção/produção: CONCERNS/HOLD**, até Docker/Node22/nginx e gates no domínio definitivo serem executados. **CodeRabbit: WAIVED pelo usuário**, que solicitou explicitamente prosseguir sem a ferramenta por usar conta pessoal; não houve execução nem PASS atribuído à ferramenta. PASS local não significa app publicado, biometria física validada nem proprietário provisionado.

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
| AC2 | lint/typecheck proporcional/testes/build/locales PASS; Node22/Docker pendente CI | Local PASS; imagem pendente |
| AC3 | same-origin localhost; produção apex HTTPS ainda não executado | Pendente produção |
| AC4 | Cadastro/login/logout virtuais, 2 perfis, 401/403/CAS real | Local PASS; domínio/humano pendente |
| AC5 | UI rotina/peso CRUD + treino salvo/readback/reload | Local PASS; repetir smoke público |
| AC6 | Reinício API e restore local isolado | Local PASS; volumes/restore VPS pendentes |
| AC7 | Mobile viewport, guest/PPL, EXDB toda, amostra JPG/GIF | Local PASS; image/nginx público pendente |
| AC8 | Admin+convites local depois de restart com owner uid | Local PASS; bootstrap proprietário pendente |
| AC9 | Workflow de imagens/digests e stack revisados | Pendente CI/Portainer destino |
| AC10 | Veredito QA local explicitamente limitado | Story não Done; E2E público pendente |
| AC11 | Runtime fresh local e tracking futuro protegido | Fresh produção/chaves destino pendentes |
| AC12 | Plano protegido revisado | Pendente cadastro humano final/abertura |
| AC13 | Store red/green + browser perfis/crossowner | Local PASS; propriedade humana e smoke final pendentes |
| AC14 | CAS, malformed, nested e corrupção testados | Local PASS; imagem destino pendente |
| AC15 | Path Docker corrigido/media manifest/source fork | Local estático PASS; Docker+source publicado pendentes |

Antes da conclusão: CI Docker build/Compose/runtime/nginx/rate limit/body limit + checksums; imagens correspondentes por commit/digest; DNS/HTTPS efetivos; Portainer mostra stack isolada/volumes e configuração RP_ID/ORIGIN exata; bootstrap passkey do proprietário humano protegido; E2E público; reinício/backup/restore na VPS; source correspondente publicado. PWA install/offline cache e recebimento de push em dispositivo físico ainda não foram validados; declarar separadamente, sem confundir HTTP200 push/test com entrega.

QA editará apenas QA Results da story; checklist/status final ficam com PO/orquestrador/implementador conforme autoridade.
