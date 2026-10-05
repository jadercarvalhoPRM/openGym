# openGym: implantação isolada por Services UI

Destino final solicitado: **https://app.comespecialista.online**. Registro A próprio
DNS-only aponta 95.217.161.179; apex preserva MX/TXT e nenhum A criado por nós.
Nenhum recurso UCP pode ser acessado ou alterado. Não modificar/reiniciar Traefik.

Portainer endpoint1, nó `meuservidor1`, rede overlay própria `opengym_private_v1`
com egress. UI Advanced image mode para imagens públicas com pull anônimo.
Service labels `com.docker.stack.namespace=opengym`. API somente rede própria;
WEB também conecta `matriz`, sem host ports. Uma réplica em cada serviço,
stop-first/parallelism1, restart on-failure, placement node.hostname==meuservidor1.
API limite256MB/.5CPU; WEB128MB/.5CPU.

API existente `tyvt0sil8etf98d3qlob2bykv`, digest
`ghcr.io/jadercarvalhoprm/opengym-api@sha256:15c8a4e2f9f1c9bacd8fcec5d9b96a59207c36d43c28bc57e38614c9c91b0957`.
Mount **real** `/data` vem do volume novo **opengym_data_v1-meuservidor1**.
O seletor Portainer compôs nome+node no Source e o engine criou esse volume vazio;
volume original `opengym_data_v1` continua vazio/preservado. Nunca copiar ./data.
Não promover nova API junto com a correção WEB. API ENV origem/RP:
`ORIGIN=https://app.comespecialista.online`, `RP_ID=app.comespecialista.online`.

WEB nova deve usar imagem testada por digest, com **Command e Entrypoint UI VAZIOS**.
ENTRYPOINT JSON e CMD já existem na imagem. Não repetir overrides inline: parser
Portainer dividiu tanto POSIX escapedquotes quanto doublequoted argumentos.
As duas tentativas ficaram fechadas antes de qualquer listener; primeiro WEB
falhado sem dados foi removido, segundo deve ser substituído somente pelo próprio
WEB ao obter a nova imagem. API/volumes/vizinhos permanecem.

ENV bootstrap WEB, fornecida em arquivo privado fora Git (verifier jamais aqui):

```text
OPENGYM_API_UPSTREAM=opengym_api
OPENGYM_BOOTSTRAP_REQUIRED=1
OPENGYM_BOOTSTRAP_AUTH=<verifier privado temporário do bootstrap.env>
```

O entrypoint restaura templates pristine, valida upstream, exige verifier quando
required=1, cria htpasswd root:nginx640, valida duas preparações/nginx-t antes de
exec Nginx. BasicAuth é server-level e cobre SPA/API/assets/PWA, sem loopback bypass.
Não há healthcheck na imagem WEB; comprovar prontidão por TLS/HTTP401 anônimo e
HTTP200 com Basic via QA usando arquivo privado username/password, sem output.
Docker smoke também comprova upstream inválido fail-closed e restart do mesmo
container com proteção idempotente.

Labels WEB (sem credential no Traefik):

```text
traefik.enable=true
traefik.docker.network=matriz
traefik.http.routers.opengym.rule=Host(`app.comespecialista.online`)
traefik.http.routers.opengym.entrypoints=websecure
traefik.http.routers.opengym.tls.certresolver=letsencryptresolver
traefik.http.routers.opengym.service=opengym
traefik.http.services.opengym.loadbalancer.server.port=80
```

Bootstrap final exige gesto humano: registrar passkey no hostname final protegido.
Só após verificar dono real, configurar ADMIN_UIDS + INVITE_ONLY=1 na API, preservando
mount/digest, e substituir task WEB com REQUIRED=0 **e AUTH removido**, mantendo
UPSTREAM. REQUIRED=0 sozinho com AUTH retido continua protegido. Container novo
explicitamente sem AUTH serve HTTP200 sem WWW-Authenticate, comprovado em CI.
QA live deve validar TLS/401/200/assets/origem/RP antes disponibilizar; cadastro,
sync/persistência/backup/restauração seguem gates antes declarar produção completa.
