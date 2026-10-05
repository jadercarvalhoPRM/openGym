# Infraestrutura openGym — 2026-10-05

## Estado observado

- Checkout novo C:/Users/jader/Desktop/PROJETOS-AI/openGym, origem pública jadercarvalhoPRM/openGym, commit base c42ba6b98e3776af5981f20c05ba392238799670, main. Clone inicialmente limpo; nenhum checkout sobrescrito.
- Portainer sessão admin existente, endpoint 1 primary, Swarm 28.5.0, nó único meuservidor1, 8 CPU/16.4 GB. Baseline da tela: 17 stacks, 28 services, 26 volumes. Nenhum serviço vizinho alterado.
- Traefik rede matriz overlay attachable, providers Docker/Swarm, web80/websecure443, resolver letsencryptresolver HTTP challenge web. Router WordPress só wordpress01.comespecialista.online.
- GHCR registry id1 ghcr authentication-enabled. Fork GitHub público, admin/push autorizados, main sem proteção; inicialmente sem workflow.
- Cloudflare zona comespecialista.online ativa. servidor.comespecialista.online A95.217.161.179 DNS only. Apex somente 3MX/TXT SPF, sem A/AAAA; apex e www HTTP sem resolução. Preservar email e demais serviços. Busca opengym sem registro.
- Docker local não encontrado; SSH root com chave existente negado; WSL não instalado. Não foi instalada ferramenta nem criado acesso adicional.

## Pacote preparado

Imagens próprias API/web com source/revision OCI. npm ci obrigatório; mídia local validada integralmente:1324 JPG+1324 GIF e correspondência EXDB, manifesto SHA256 produzido no build. Assets persistem na imagem por digest; /data é volume independente novo.

Compose local corrige Dockerfile e usa loopback8080, volume named novo sem ./data upstream. Swarm deploy/stack.yml: API única stop-first, overlay dedicada com egress NAT para web-push e nenhuma porta API; só web adicional matriz. Volume produção opengym_data_v1 deve nascer vazio.

Nginx: corpo5MiB, same-origin /api, headers, auth2req/s burst20 e API10req/s burst60 com429. Real-IP confia somente subnet matriz10.0.1.0/24 observada; valor específico desta VPS.

CI: gates produto/audits/media, E2E browser com passkey virtual/treino/sync, Compose/Swarm config, build Docker e runtime smoke antes de publicar exatamente as imagens testadas. Publicação exige workflow_dispatch publish=true e repository exato. Sem upstream latest. Artifacts guardam digests/evidências, nunca /data.

## Gates

PASS: clone/status base, identificação sessões, mídia2648 EXDB, node --check dos smokes, YAML sintático Compose/Swarm/workflow, assertions isolamento/single-writer/volume/bootstrap e git diff --check.

Docker build/nginx -t/stack config/runtime smoke NÃO EXECUTADOS localmente: sem daemon/SSH. Checks locais sintáticos não equivalem runtime.

Pendente: QA independente final, CI Docker, resolução CodeRabbit antes push, digests/source publicados, router apex final, baseline serviços antes/depois, volume vazio, DNS/TLS, bootstrap humano, restart persistência, backup/restore real e QA hostname final.

CodeRabbit: comando de review efetivamente tentado retornou exit1 por WSL não instalado. Revisão NÃO EXECUTADA; nenhum achado HIGH/CRITICAL produzido. Task AIOX github-devops-pre-push-quality-gate.md268–287 não documenta substituição de review. Root recebeu instrução e erro para decisão humana após revisão concreta. Não houve push/deploy nem bypass.

## Fontes

- [GitHub GHCR publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images): GITHUB_TOKEN/packages:write e ações fixadas por SHA consultado via API oficial.
- [Docker Compose services](https://docs.docker.com/reference/compose-file/services/).
- reports/production-architecture.md, docs/stories/production-launch.md, deploy/README.md e configs locais.
