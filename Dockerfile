FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json server.mjs mcp.mjs ads.mjs workspace.mjs settings.mjs sync.mjs ./
COPY --chown=node:node public ./public
RUN mkdir /app/data
RUN chown node:node /app/data
USER node
LABEL org.opencontainers.image.source="https://github.com/canmingwei27-star/Amazon-work-web"
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
