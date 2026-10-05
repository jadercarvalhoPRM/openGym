# Estado da sessão — openGym

Atualizado: 2026-10-05 (America/Sao_Paulo), snapshot atual de @devops.

## Objetivo e estado atual

Implementar e publicar `https://github.com/jadercarvalhoPRM/openGym.git` no VPS/Portainer, domínio `comespecialista.online`. Checkout `C:/Users/jader/Desktop/PROJETOS-AI/openGym`, base `c42ba6b98e3776af5981f20c05ba392238799670`. Story `docs/stories/production-launch.md` **Approved**; arquitetura aprovada; produto implementado e QA local independente **PASS: 199 frontend + 7 API + 20 checks browser**, lint/typecheck/build/locales/audit proporcional. Evidências em reports/implementation.md, production-architecture.md, production-qa.md e production-infrastructure.md.

## Autorizações e restrições vigentes

- **PROIBIDO tocar no UCP**: nenhum acesso/mutação do repositório, serviços, stacks, dados, DNS, packages, registries exclusivos ou volumes. Recursos compartilhados existentes só serão conectados pelo novo openGym; nunca modificar/reiniciar proxy ou vizinhos.
- Humano autorizou VPS/Portainer + apex comespecialista.online + configurações Cloudflare necessárias. Preserve todos os MX/TXT e demais hosts.
- CodeRabbit **WAIVED**, não PASS, decisão humana explícita em 2026-10-05: “faça sem o CodeRabbit, pq a minha conta é pessoal”. Revisão não executada; listener próprio OAuth encerrado. Histórico em reports/coderabbit-review.md. Nenhuma dispensa dos gates restantes.

## Infra verificada e pacote preparado

Portainer endpoint1 Swarm no node meuservidor1; rede matriz existente, TLS letsencryptresolver. Apex sem A/AAAA; IP VPS95.217.161.179. Stack isolada openGym: API1 replica stop-first, sem porta pública, rede privada com egress; web também conecta matriz. Volume **novo/vazio opengym_data_v1**, sem importar data upstream, fresh secret/VAPID. Mídia2.648 assets embutidos com manifest em imagem imutável. Configs Docker/nginx, workflow CI e runbook deploy preparados; runtime Docker ainda não executado.

## Próxima sequência obrigatória

1. Scan proporcional de conteúdo staged sem runtime; commit/push somente openGym.
2. CI inicial sem publicação: Node22, lint/typecheck/test/build/locales/audit, E2E browser, compose/stack, build Docker/nginx, smoke volume fresh/body/rate/media/restart. Corrigir qualquer falha antes publicação.
3. Publish true das mesmas imagens testadas; somente novos packages opengym-api/web públicos; verificar pull anônimo e digest.
4. DNS somente novo apex A; deploy Portainer isolado com imagens por digest, BasicAuth bootstrap temporário e novo volume. Verificar HTTPS/health/serviços/assets e vizinhos preservados.
5. Humano cadastra passkey do dono no hostname final sob proteção; configurar ADMIN_UIDS+INVITE_ONLY=1, QA real e remover proteção temporária após confirmação. Sem fabricar admin ou credencial permanente virtual.
6. QA público auth/CRUD/sync/restart/backup/restore e confirmar commit/digests/config efetiva; só então concluir produção.

## Histórico de implementação/QA

Conteúdo abaixo preservado como histórico, com gates antigos substituídos pelo snapshot acima.

## Marco do @dev — 2026-10-05

Arquitetura GO recebida; story Approved. Núcleo implementado para revisão independente: ownership por uid com cópia offline recuperável, reset 401/logout/troca, timers/responses inflight com uid/epoch, migração guest explícita, revision CAS e ownerId no HTTP, erro de conflito visível com Export/restauração confirmada, validação de payloads nested, 400/413, startup fail-closed em DB/state corruptos e push HTTPS providers conhecidos. Dados/chaves upstream foram removidos do tracking futuro preservando arquivos locais; produção deve usar volume vazio.

Gates locais @dev: lint, typecheck JSDoc restrito à fronteira da API, locales, 199 testes frontend + 7 testes HTTP API, build. Logs e self-audit em `reports/implementation.md`; novo RED→GREEN de nested entries/sets após achado QA. Não houve deploy ou E2E público por @dev. WSL não instalado impede CodeRabbit, sem alegação de revisão automatizada.

QA independente roda cerimônias WebAuthn com autenticador virtual e UI/sync em ambiente isolado; DevOps prepara Docker/CI/GHCR/Portainer/DNS/TLS/volumes/mídia. Gates externos: build/smoke real Docker, revisão independente, imagem/commit publicados, produção HTTPS, bootstrap humano seguro sem credenciais upstream/teste permanentes, auth/CRUD/sync público, restart persistência e backup/restauração. Próxima ação @dev: corrigir qualquer achado de QA e revalidar; @dev não faz push nem muta Portainer/Cloudflare.

Atualização QA: E2E local 19 PASS e `reports/qa-test.log` 199+7 PASS. Log histórico `api-nested-green.log` contém uma falha de timeout1200ms (6/7), preservado; teste processo passa a janela10s, sem relaxar fail-closed ou prova de preservação de bytes. CodeRabbit Windows nativo será preparado por DevOps a pedido humano; a ausência de WSL não dispensa esse gate. Aguardar achados dessa revisão mantendo a proibição UCP.
