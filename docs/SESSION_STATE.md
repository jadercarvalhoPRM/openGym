# Estado da sessão — openGym

Atualizado: 2026-10-05 (America/Sao_Paulo), snapshot atual de @devops.

## Objetivo e estado atual

Implementar e publicar `https://github.com/jadercarvalhoPRM/openGym.git` no VPS/Portainer, domínio `app.comespecialista.online`. Checkout `C:/Users/jader/Desktop/PROJETOS-AI/openGym`, base `c42ba6b98e3776af5981f20c05ba392238799670`. Story `docs/stories/production-launch.md` **Approved**; arquitetura aprovada; produto implementado e QA local independente **PASS: 199 frontend + 7 API + 20 checks browser**, lint/typecheck/build/locales/audit proporcional. Evidências em reports/implementation.md, production-architecture.md, production-qa.md e production-infrastructure.md.

## Autorizações e restrições vigentes

- **PROIBIDO tocar no UCP**: nenhum acesso/mutação do repositório, serviços, stacks, dados, DNS, packages, registries exclusivos ou volumes. Recursos compartilhados existentes só serão conectados pelo novo openGym; nunca modificar/reiniciar proxy ou vizinhos.
- Humano autorizou VPS/Portainer + subdomínio final app.comespecialista.online + configurações Cloudflare necessárias. Preserve todos os MX/TXT e demais hosts.
- CodeRabbit **WAIVED**, não PASS, decisão humana explícita em 2026-10-05: “faça sem o CodeRabbit, pq a minha conta é pessoal”. Revisão não executada; listener próprio OAuth encerrado. Histórico em reports/coderabbit-review.md. Nenhuma dispensa dos gates restantes.

## Infra verificada e pacote preparado

CI publicadora **SUCCESS 37379154770**, commit `f3dd43948ac8b4971392c89ac9e037d547a3590a`: Node22, 199 frontend + 7 API + 20 browser, Docker/nginx fresh-volume/proxy/auth/body/rate/media/restart, raw Swarm bcrypt label. Runtime audit omit-dev zero; full dev audit 15 achados em dependências de desenvolvimento/build, triagem e limites em QA. CodeRabbit continua WAIVED, não PASS.

Imagens PUBLIC verificadas por digest anônimo: API `sha256:15c8a4e2f9f1c9bacd8fcec5d9b96a59207c36d43c28bc57e38614c9c91b0957`; WEB `sha256:943d198b5bf7f9fbbf7019c470a7164471fd3ae242aa85384d057fbc25c39bb5`, namespace `ghcr.io/jadercarvalhoprm/opengym-{api,web}`. Host Linux amd64 compatível.

Portainer endpoint1: API `tyvt0sil8etf98d3qlob2bykv` RUNNING/HEALTHY, uma réplica, stop-first, sem portas, rede própria `opengym_private_v1`. Mount efetivo **`opengym_data_v1-meuservidor1` → `/data`**, volume NOVO autocriado devido nome composto do seletor Portainer; chaves fresh, zero contas, sem upstream. Volume original novo `opengym_data_v1` permanece vazio e preservado. Não migrar/recriar API sem necessidade.

WEB inicial falhou FECHADO no parser de Command do Portainer: primeira variante singlequote escapada dividiu Args; segunda variante doublequote Base64 público também foi dividida. Primeiro serviço `ov78g2d9mi1nb0jdycr7kzxgs` removido apenas por ser WEB falhado sem volume; segundo `oyjcr7nxfja8j0hk2dx8w4ejt` falhado. Nenhum Nginx ativo, nenhum signup exposto. **DNS app salvo**: nosso A apex recém-criado foi renomeado para app após steering humano; app estava livre. Resolver1.1.1.1 confirma95.217.161.179 TTL300; apex voltou a MX/TXT originais. API ORIGIN/RP_ID atualizados para app.comespecialista.online preservando imagem/volume; próxima WEB Host deve usar app.

Próxima rota aprovada: bake startup WEB em ENTRYPOINT JSON, incluir footer fork corrigido (QA local agora21/21), publicar somente nova WEB após CI smoke protegido; não mudar API/image/dados. UCP e proxy compartilhado intocados.

## Próxima sequência obrigatória

1. Corrigir implantação WEB com startup baked, upstream default api/local e opengym_api/prod, bootstrap required=1 fail-closed/verifier privado; revisão QA antes push.
2. CI publicadora WEB-only mantém quality/E2E e Docker smoke: 401 sem Basic, 200 correto, proxy/mídia, duas preparações/nginx-t e restart. Publicar somente se gates passam; API produção não é promovida.
3. Recriar somente WEB com nova imagem por digest e campos Command/Entrypoint UI vazios, ENV privada própria. Verificar actual tasks e proteção.
4. DNS subdomínio app já salvo, somente A95.217.161.179 DNS-only; verificar HTTPS/TLS, 401/200 e QA live. Abrir domínio e arquivo privado acesso.txt ao humano, sem senha em chat/logs/Git.
5. Humano cadastra passkey do dono no hostname final sob proteção; configurar ADMIN_UIDS+INVITE_ONLY=1, QA real e remover proteção temporária após confirmação. Sem fabricar admin ou credencial permanente virtual.
6. QA público auth/CRUD/sync/restart/backup/restore e confirmar commit/digests/config efetiva; só então concluir produção.

## Histórico de implementação/QA

Conteúdo abaixo preservado como histórico, com gates antigos substituídos pelo snapshot acima.

## Marco do @dev — 2026-10-05

Arquitetura GO recebida; story Approved. Núcleo implementado para revisão independente: ownership por uid com cópia offline recuperável, reset 401/logout/troca, timers/responses inflight com uid/epoch, migração guest explícita, revision CAS e ownerId no HTTP, erro de conflito visível com Export/restauração confirmada, validação de payloads nested, 400/413, startup fail-closed em DB/state corruptos e push HTTPS providers conhecidos. Dados/chaves upstream foram removidos do tracking futuro preservando arquivos locais; produção deve usar volume vazio.

Gates locais @dev: lint, typecheck JSDoc restrito à fronteira da API, locales, 199 testes frontend + 7 testes HTTP API, build. Logs e self-audit em `reports/implementation.md`; novo RED→GREEN de nested entries/sets após achado QA. Não houve deploy ou E2E público por @dev. WSL não instalado impede CodeRabbit, sem alegação de revisão automatizada.

QA independente roda cerimônias WebAuthn com autenticador virtual e UI/sync em ambiente isolado; DevOps prepara Docker/CI/GHCR/Portainer/DNS/TLS/volumes/mídia. Gates externos: build/smoke real Docker, revisão independente, imagem/commit publicados, produção HTTPS, bootstrap humano seguro sem credenciais upstream/teste permanentes, auth/CRUD/sync público, restart persistência e backup/restauração. Próxima ação @dev: corrigir qualquer achado de QA e revalidar; @dev não faz push nem muta Portainer/Cloudflare.

Atualização QA: E2E local 19 PASS e `reports/qa-test.log` 199+7 PASS. Log histórico `api-nested-green.log` contém uma falha de timeout1200ms (6/7), preservado; teste processo passa a janela10s, sem relaxar fail-closed ou prova de preservação de bytes. CodeRabbit Windows nativo será preparado por DevOps a pedido humano; a ausência de WSL não dispensa esse gate. Aguardar achados dessa revisão mantendo a proibição UCP.
