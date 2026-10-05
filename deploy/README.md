# Lançamento em comespecialista.online

Stack: Portainer endpoint1, nó meuservidor1, Traefik matriz/websecure/letsencryptresolver. Esta configuração é específica da VPS verificada em2026-10-05.

## Release

1. Executar QA independente e resolver qualquer gate bloqueante antes do push.
2. Workflow Verify and publish openGym testa source/build/Docker. Primeiro executar sem publish; publicar com workflow_dispatch publish=true somente após revisão do resultado. Imagens publicadas são exatamente aquelas exercitadas no runtime smoke.
3. Novas packages GHCR nascem PRIVATE, mesmo com este repo público. Antes de deploy, abrir Packages do proprietário, apenas opengym-api e opengym-web, Package settings → Change visibility → Public. Não alterar packages vizinhas. A sessão GitHub do proprietário foi verificada; token CLI atual não tem read:packages. Alternativa privada exige ACL/read:packages existente comprovado; auth-enabled em Portainer sozinho não comprova isso.
4. Usar os RepoDigests do artifact opengym-ci-<commit>: OPENGYM_API_IMAGE e OPENGYM_WEB_IMAGE devem terminar em @sha256:<digest>. Rodar scripts/verify-public-images.mjs com os dois refs: token anônimo fica somente em memória, manifest precisa responder200 e hash corresponder ao digest. Nunca usar latest nem imagens duartesantos8.
5. Confirmar inexistência de opengym_data_v1 e de router Host comespecialista.online antes da criação. Se volume existir, inspecionar metadados/conteúdo sem exibir chaves; não apagar nem sobrescrever.
6. Criar A apex95.217.161.179 DNS only preservando MX/TXT/email e todos os demais registros. Testar emissão TLS antes aceitar passkeys.

## Bootstrap humano protegido

Template stack.yml contém middleware Basic Auth obrigatório durante bootstrap. OPENGYM_BOOTSTRAP_AUTH é linha htpasswd gerada com senha aleatória forte e guardada somente em arquivo privado/Portainer; nunca Git/report/log. No campo Environment variables Portainer, fornecer hash RAW com dollar simples. Escape dollar como dollar duplo somente se inserir hash literalmente no YAML. Não duplicar no valor da variável: interpolação não deve transformar o hash. scripts/verify-stack-config.mjs comprova com exemplo bcrypt sintético no CI; após deploy verificar igualdade do label em memória, imprimindo só booleano, e exigir401 sem credencial/200 com credencial temporária.

Para primeiro proprietário, ADMIN_UIDS vazio e INVITE_ONLY=0 apenas atrás do middleware. O proprietário abre o hostname HTTPS final, atravessa proteção temporária e cria seu perfil/passkey no dispositivo real. Ler apenas uid desse perfil, configurar ADMIN_UIDS e INVITE_ONLY=1, atualizar API stop-first. Verificar me.user.admin=true e signup sem convite403. Então remover os dois labels de middleware temporário do web. Senha temporária não é a autenticação do app e deve ser descartada após bootstrap.

API só possui conexão à rede dedicada; nenhuma porta host. Volume novo/vazio gera secret/VAPID novos. Nunca copiar data upstream do checkout. Mídia fica na imagem com manifesto integral.

## Verificação final

Confirmar RP_ID/ORIGIN pelo ambiente e registro real; digest OCI deve corresponder ao CI. GET /api/health200, cert válido, nginx mídia JPG/GIF, manifest/SW, sem demo/mobile. Fazer E2E humano cadastro/login/logout/admin/convite e QA sync/isolamento. Reiniciar somente API openGym e verificar dados/chaves preservados. Push físico opt-in é gate distinto de HTTP200.

Guardar baseline dos serviços vizinhos antes/depois sem alterar nenhum deles. Se falhar, parar a stack openGym e remover somente a rota DNS recém-criada ou restaurar valor anterior documentado. Preservar volume novo e evidências, nunca down --volumes em produção.

## Backup e restore

Antes de backup, parar somente API openGym para snapshot consistente. Copiar volume opengym_data_v1 integral (users/passkeys públicas/state/secret/VAPID) para arquivo privado fora do volume runtime. Arquivo contém segredos e dados pessoais: permissões restritas, sem upload público nem artifact CI. Ensaiar restore em volume novo isolado com nenhuma rota pública; manter RP_ID/ORIGIN se testar passkey correspondente.

Deploy atual não fornece SSH funcionando. Backup/restore permanece gate externo até operação efetivamente disponível em Portainer/host e evidência verificada. Não registrar como realizado apenas porque este procedimento está documentado.

## Referências

- [GHCR: visibilidade privada inicial e acesso público anônimo](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
- [Docker interpolation](https://docs.docker.com/reference/compose-file/interpolation/).
- [Traefik BasicAuth: hashes e escape literal](https://doc.traefik.io/traefik/v3.4/middlewares/http/basicauth/).
