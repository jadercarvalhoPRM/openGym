#!/bin/sh
set -eu

# Image entrypoint: no Portainer command parser or secrets in startup arguments.
prepare() {
    required=${OPENGYM_BOOTSTRAP_REQUIRED:-0}
    case "$required" in 0|1) ;; *) exit 1 ;; esac
    upstream=${OPENGYM_API_UPSTREAM:-api}
    case "$upstream" in ''|*[!A-Za-z0-9_.-]*) exit 1 ;; esac
    case "$upstream" in [A-Za-z0-9_]*) ;; *) exit 1 ;; esac
    cp /opt/opengym/nginx.conf /etc/nginx/conf.d/default.conf
    cp /opt/opengym/api-proxy.conf /etc/nginx/snippets/api-proxy.conf
    if [ "$required" = 1 ] || [ -n "${OPENGYM_BOOTSTRAP_AUTH:-}" ]; then
        test -n "${OPENGYM_BOOTSTRAP_AUTH:-}"
        umask 077
        printf '%s\n' "$OPENGYM_BOOTSTRAP_AUTH" > /etc/nginx/bootstrap.htpasswd
        test "$(wc -l < /etc/nginx/bootstrap.htpasswd)" -eq 1
        grep -Eq '^opengym-preview:\{SHA\}[A-Za-z0-9+/]{27}=$' /etc/nginx/bootstrap.htpasswd
        chown root:nginx /etc/nginx/bootstrap.htpasswd
        chmod 640 /etc/nginx/bootstrap.htpasswd
        if ! grep -q '^[[:space:]]*auth_basic ' /etc/nginx/conf.d/default.conf; then
            sed -i '/^server {/a\    auth_basic "openGym preview";\n    auth_basic_user_file /etc/nginx/bootstrap.htpasswd;' /etc/nginx/conf.d/default.conf
        fi
        test "$(grep -c '^[[:space:]]*auth_basic ' /etc/nginx/conf.d/default.conf)" -eq 1
        test "$(grep -c '^[[:space:]]*auth_basic_user_file ' /etc/nginx/conf.d/default.conf)" -eq 1
        grep -Eq '^[[:space:]]*auth_basic "openGym preview";$' /etc/nginx/conf.d/default.conf
        grep -Eq '^[[:space:]]*auth_basic_user_file /etc/nginx/bootstrap.htpasswd;$' /etc/nginx/conf.d/default.conf
    fi
    sed -i "s|proxy_pass http://[^;]*;|proxy_pass http://${upstream}:3000;|g" /etc/nginx/snippets/api-proxy.conf
    grep -Fq "proxy_pass http://${upstream}:3000;" /etc/nginx/snippets/api-proxy.conf
    nginx -t
}

# Prove preparation is safe twice on the same filesystem before opening a listener.
prepare
prepare
exec /docker-entrypoint.sh "$@"
