FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
COPY validation.js ./
ARG REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/jadercarvalhoPRM/openGym" \
      org.opencontainers.image.revision=$REVISION
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
EXPOSE 3000
CMD ["node", "server.js"]
