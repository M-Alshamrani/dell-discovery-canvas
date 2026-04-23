# Dell Discovery Canvas — static-file image
# Base: nginx:alpine (multi-arch, includes linux/arm64 for Dell GB10 / Grace).
FROM nginx:1.27-alpine

# Drop the default site config; we ship our own.
RUN rm /etc/nginx/conf.d/default.conf

# Custom server config: MIME for ESM + AVIF, cache policy, security headers.
COPY nginx.conf /etc/nginx/conf.d/dell-discovery.conf

# Static app payload. Copy whitelist of folders, not '. .', so junk like the
# brace-expansion folder and host-only scripts (start.sh/start.bat) stay out.
COPY index.html robots.txt styles.css app.js /usr/share/nginx/html/
COPY core/         /usr/share/nginx/html/core/
COPY state/        /usr/share/nginx/html/state/
COPY services/     /usr/share/nginx/html/services/
COPY interactions/ /usr/share/nginx/html/interactions/
COPY ui/           /usr/share/nginx/html/ui/
COPY diagnostics/  /usr/share/nginx/html/diagnostics/
COPY Logo/         /usr/share/nginx/html/Logo/

# nginx:alpine already EXPOSEs 80 and runs as root for low ports; keep defaults.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
