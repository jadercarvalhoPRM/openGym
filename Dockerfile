# Multi-stage: build the React app, then serve it with nginx.
# Self-hosters never need Node locally — `docker compose up` builds everything.
#
# --platform=$BUILDPLATFORM pins the build stage to the host's native arch even when
# cross-building for other targets (e.g. amd64 host building an arm64 image). The build
# output (static JS/CSS/HTML) is arch-independent, so there's no reason to run it under
# QEMU — and QEMU-emulated npm installs are known to corrupt esbuild/rollup's platform-
# specific native binaries, which is what breaks `vite build` with unrelated-looking
# module-resolution errors.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM alpine:3.22 AS media
WORKDIR /media
COPY media/img ./img
COPY media/gif ./gif
RUN test "$(find img -name '*.jpg' | wc -l)" -eq 1324 \
    && test "$(find gif -name '*.gif' | wc -l)" -eq 1324 \
    && find img gif -type f -print0 | sort -z | xargs -0 sha256sum > manifest.sha256

FROM nginx:1.28-alpine
ARG REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/jadercarvalhoPRM/openGym" \
      org.opencontainers.image.revision=$REVISION
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY web/api-proxy.conf /etc/nginx/snippets/api-proxy.conf
COPY deploy/web-start.sh /usr/local/bin/opengym-web-start.sh
COPY web/nginx.conf /opt/opengym/nginx.conf
COPY web/api-proxy.conf /opt/opengym/api-proxy.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=media /media/img /usr/share/nginx/html/img
COPY --from=media /media/gif /usr/share/nginx/html/gif
COPY --from=media /media/manifest.sha256 /usr/share/nginx/html/media-manifest.sha256
EXPOSE 80
ENTRYPOINT ["/bin/sh", "/usr/local/bin/opengym-web-start.sh"]
CMD ["nginx", "-g", "daemon off;"]
