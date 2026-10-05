# openGym: arquitetura para lançamento

Data: 2026-10-05. Base inspecionada: `c42ba6b98e3776af5981f20c05ba392238799670`.
Autor: Aria (@architect). Inspeção estática, sem alteração da aplicação e sem alegação de execução E2E.

## Decisão e escopo

Manter a aplicação existente e suas funcionalidades declaradas em README. Publicar na VPS/Portainer existente, isolada dos demais serviços, em `https://comespecialista.online`. Não reescrever stack, criar pagamentos, autenticação por senha, email ou banco SQL. Caminho web/PWA com servidor e sincronização é o produto a publicar; o APK standalone não é requisito deste lançamento.

Implementação pode iniciar após a story `docs/stories/production-launch.md` aprovada, seguindo este plano. Publicação pública permanece HOLD até correções críticas, gates reais e definição do bootstrap humano.

Revisão técnica concluída: story Approved em 2026-10-05. Aceites AC1–AC15 fiéis à entrega existente; liberação para implementação, sem veredito de produção.

Infra verificada por @devops: Portainer endpoint 1; Swarm 28.5.0 de um nó `meuservidor1`; Traefik com providers Docker/Swarm, rede `matriz` overlay attachable, entrada `websecure` 443, resolver `letsencryptresolver`, desafio HTTP na entrada `web` 80; registry GHCR já configurado. Host informado `95.217.161.179`. Apex atualmente possui MX/TXT e nenhum A/AAAA; alteração DNS deve preservar registros de email. Colisão de router com WordPress permanece gate de deploy a verificar antes de criar rota. SSH root falhou; operar pela sessão Portainer autorizada e build/release via GitHub Actions, sem prometer SSH disponível.

## Stack e fluxo efetivo

| Parte | Implementação encontrada | Requisito operacional |
| --- | --- | --- |
| Web/PWA | React 19, Vite 8, React Router HashRouter, Zustand, service worker | Build normal, sem VITE_DEMO/VITE_MOBILE; nginx serve artefatos e mídia |
| API | Node 22, `http` nativo, @simplewebauthn/server 13 e web-push | Uma réplica, interna, porta 3000; same-origin via `/api/` |
| Auth | Passkey discoverable; desafio TTL de 5 min; sessão HMAC HttpOnly/SameSite=Lax/Secure quando ORIGIN HTTPS | RP_ID=comespecialista.online, ORIGIN=https://comespecialista.online antes do primeiro cadastro |
| Dados | `db.json`, `state-<uid>.json`, `secret`, `vapid.json` em DATA_DIR | Volume novo, persistente, isolado; backups privados; sem banco externo |
| Admin | ADMIN_UIDS ou flag local; habilitar/desabilitar perfis, convites, histórico e presença | Bootstrap só após registro de passkey do proprietário; nunca usar usuário upstream |
| Mídia | Dataset local `media/img` e `media/gif`; job de download opcional | 1324 JPG e 1324 GIF presentes no checkout; validar todos nomes usados pela EXDB |
| Jobs | Rest-timer setTimeout em memória; lembrete a cada 10 s, lastReminder persistido; presença TTL em memória | Sem cron/tabelas auxiliares; reinício perde rest timers/presença, preserva lembrete diário |
| Mail/pagamentos | Ausentes | Nenhuma configuração necessária |

Proxy HTTPS existente → nginx openGym → API openGym. Apenas nginx entra na rede do proxy. API não publica porta no host. Diretório/volume de runtime não entra em imagem ou Git. Uma réplica evita escritores concorrentes sobre `db` em memória e arquivos JSON. Não usar render.yaml: fornece apenas web e não configura API/dados. Mídia pode ser incluída na imagem web immutable validada por manifesto e digest: assets não sofrem mutações de usuários, e reconstrução/reinício preserva disponibilidade sem volume mutable. Esta equivalência foi aprovada pelo orquestrador e incorporada em AC7; volume durável continua obrigatório para /data.

## Achados e mínimo necessário

| ID | Prioridade | Evidência no checkout | Ação necessária e gate |
| --- | --- | --- | --- |
| A1 | CRÍTICA | `git ls-files data` inclui secret, vapid.json, db.json. DB tem 1 usuário e 1 credencial. Valores secretos não foram exibidos. | Nunca montar/copiar data upstream em produção. Criar volume vazio para gerar secret/VAPID novos. Parar tracking runtime futuro, ignorar data, .env, backups e excluir do contexto Docker. Preservar evidência local; remoção do HEAD não desfaz exposição do histórico. Confirmar produção não contém credencial upstream e não reutiliza chaves. |
| A2 | ALTA | `docker-compose.yml` build usa `web/Dockerfile`, inexistente; Dockerfile real está na raiz. `.env.example` prometido pelo README inexiste. | Corrigir build context/path e adicionar exemplo sem segredos. Build determinístico com npm ci, sem fallback silencioso a npm install. Fixar imagens do release por commit/digest. |
| A3 | ALTA | `useStore.boot()` em 401 só remove usuário e mantém S. `setUser()` troca usuário sem reset de S; `pullState()` pode enviar S local mais recente/dirty para novo usuário. | Ownership por uid no estado local e nos requests/timers. Nunca transmitir estado A ao usuário B. Expiração/revogação elimina exposição de A na UI sem destruir único estado offline não sincronizado; preservar cópia separada por dono. Guest→perfil novo continua migração intencional; guest→perfil existente não sobrescreve perfil existente silenciosamente. Teste falha antes/passando depois com estados diferentes A/B e resposta 401 real. |
| A4 | ALTA | PUT /api/data grava snapshot sem checar revisão; pullState chama persist que altera _ts até em leitura; sync normal só ocorre no boot/debounce. | Evitar overwrite obsoleto entre dois dispositivos: revisão controlada no servidor e comparação otimista na gravação, 409 preserva local pendente, sem merge inventado. Pull não fabrica timestamp novo. Reconsultar no retorno online/foreground quando seguro. E2E dois contextos mostra sync e conflito sem perda. |
| A5 | ALTA | API aceita `state: []` ou core fields incorretos; admin usa `.map`/`.slice`, lembrete usa `.some`. `readBody` bad JSON cai no catch 500, nginx tem default body 1 MB e API permite 5 MB. | Validar objeto e shapes de coleções efetivamente lidas, limites e timestamps/revisões; 400 para JSON/shape inválido e 413 coerente para excesso. Nginx precisa permitir limite API documentado. Não transformar bad state em reset silencioso. Payloads reais capturados localmente entram nos testes. |
| A6 | ALTA | startup faz catch silencioso na leitura de db.json e readState; DB corrompida vira DB vazia que saveDb poderá sobrescrever. | Falhar fechado em arquivo persistente existente inválido. Fresh bootstrap apenas quando arquivo inexiste. Testar arquivo corrupto preservado, diagnóstico sem segredos e nenhum overwrite. |
| A7 | ALTA | Push subscribe armazena endpoint arbitrário; sendPush passa diretamente para web-push. | Impedir destinos locais/privados e esquemas inválidos. Gate com subscription de destino proibido rejeitada antes de rede; destinos de push usados pelo navegador continuam aceitos. Não desligar funcionalidade declarada para ocultar falta de validação. |
| A8 | MÉDIA | SECURITY documenta ausência de rate limit e headers; proxy nginx não os aplica. | Configurar rate limit de auth e mutações no proxy; body limit; headers proporcionais sem quebrar passkey/PWA. Não assumir X-Forwarded-For de cliente não confiável. E2E permite fluxo normal e retorna 429 para excesso controlado. |
| A9 | MÉDIA | media job clona HEAD e só confere se img contém qualquer item; shell não usa fail-fast; mídia parcial pode aparentar pronta. | Preferir mídia já existente validada e persistente. Se job baixar, fixar commit completo já usado pelo mobile `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`, fail-fast e manifesto EXDB JPG/GIF. Nunca marcar pronta por mera contagem/pasta não vazia. |
| A10 | MÉDIA | Link source code em Settings aponta DuarteSantos8 upstream. | Link para jadercarvalhoPRM/openGym com mudanças do release publicadas e licença/NOTICE preservadas. Isso oferece fonte correspondente da versão servida. |
| A11 | MÉDIA | frontend possui build/test; API apenas start; sem scripts lint/typecheck na raiz ou packages. | Adicionar gates proporcionais JS/JSX e testes API/sync/E2E; registrar checks ausentes inicialmente. Não fingir execução de scripts inexistentes nem transformar app em TypeScript para cumprir nome do gate. |

Os achados de comportamento A3-A7 são inferências diretas do caminho do código e exigem reprodução controlada pelo implementador antes de alegar correção. Não existe payload/log de produção desta implantação ainda; não inventar evidência. A1/A2 são confirmados por leitura e inventário do checkout.

## Contratos e auditoria de funcionalidade

- register/verify, login/verify e me retornam o mesmo user `{id,name,admin}`; erros usam `{error}`. Manter esse contrato.
- GET /api/data retorna `{state}` e PUT retorna `{ok,ts}`; métodos diferem legitimamente. Extensão de revisão deve ser consistente nos dois sem misturar formatos de campo.
- Dados de rotinas, exercícios customizados, peso, histórico e preferências são CRUD sobre snapshot de estado; não há rotas POST/DELETE distintas para cada entidade.
- Jobs não precisam de tabelas auxiliares: subs/invites/lastReminder pertencem a db.json; timers/presença são explicitamente efêmeros.
- Logout normal e logout/all devem limpar conta/contexto da UI; revogação e troca de usuário são o risco A3. Limpar timer de sync antigo também é necessário.
- Não há migrations SQL. Compatibilidade de dados JSON precisa ser idempotente, permitir arquivos existentes válidos e rollback com backup. Nova revisão ausente em dados legados precisa de valor inicial definido.

## Bootstrap e proteção do primeiro acesso

Não disponibilizar signup aberto na internet para criar o primeiro admin. Manter acesso ao app restrito durante janela de bootstrap (proteção temporária no proxy/Cloudflare ou acesso privado equivalente). Com hostname HTTPS definitivo e volume vazio, proprietário registra passkey pelo navegador real. Operador lê apenas o uid gerado, inclui ADMIN_UIDS e ativa INVITE_ONLY=1. Validar acesso admin e geração de convite antes de remover restrição temporária. Não gerar uma senha, não forjar cookie de admin e não herdar passkey do clone. Passkey virtual em E2E prova protocolo/UI automatizados, mas não substitui cadastro humano que entrega posse ao proprietário.

## Sequência de entrega

1. @devops identifica VPS/Portainer/rede proxy, cria diretórios/volumes e registra baseline dos serviços vizinhos sem mutá-los. @po aprova story com estes aceites.
2. @dev reproduz e corrige A2-A7/A10/A11; tests first para bugs; atualiza story/file list. @devops cobre Compose/proxy/media/release/backup em coordenação, sem concorrência de edição.
3. @qa roda lint, typecheck equivalente JS, unit/API/sync, build, locale check e navegador guest+passkey em HTTPS/local secure origin com payloads capturados. Sem unit-only verdict para integração.
4. @devops publica imagens/digest/source e stack isolada. DNS/HTTPS comespecialista.online é autorizado pelo usuário; não alterar outros domínios/apps. Verifica config efetiva ORIGIN/RP_ID, `/api/health`, TLS, mídia e persistência após restart.
5. Bootstrap humano e QA externo no domínio final: passkey cadastro/login/logout, dados/isolamento A/B, sync entre contextos, convite/admin, PWA/assets/offline após carga, workout/peso/rotina/export/import. Notificação opt-in de dispositivo físico é gate próprio; `push/test {ok:true}` não prova recebimento.
6. Fazer backup e restore ensaiado em diretório isolado; registrar caminho privado, permissões, commit/digests e rollback. @qa libera somente gates executados; pendências humanas/exteriores ficam nomeadas.

## Restrições assumidas e fontes

Assume uso pessoal/pequeno número de perfis conforme README; sem escala horizontal. O proprietário informou VPS/Portainer existente e domínio comespecialista.online, com configuração DNS/HTTPS autorizada. Não há AGENTS.md, CLAUDE.md ou SESSION_STATE.md upstream no inventário inicial. Seguir orquestração/story do workspace raiz; não aplicar os scripts npm de AIOX ao app de outra stack.

Fonte principal: README.md, SECURITY.md, docs/SELF_HOSTING.md, NOTICE.md e código do commit indicado. Referências externas verificadas para RP/origin e variáveis: [SimpleWebAuthn server](https://simplewebauthn.dev/docs/packages/server), [Docker Compose environment](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/). Documentação atual SimpleWebAuthn é v14; não usar isso para atualizar pacote 13 sem necessidade.
