FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json server.mjs mcp.mjs ads.mjs workspace.mjs settings.mjs sync.mjs auth.mjs sales-anomalies.mjs campaign-report.mjs update-bridge.mjs release-notes.mjs ./
COPY --chown=node:node public ./public
COPY --chown=node:node updater ./updater
RUN mkdir /app/data /updates /backups
RUN chown node:root /updates && chmod 0770 /updates && chmod 0700 /backups
RUN chown node:node /app/data
LABEL org.opencontainers.image.version="1.2.9" io.amazon-work.data-schema="1" io.amazon-work.release-notes="优化更新记录、版本特性展示和固定方向进度条；统一宽表底部滑条"
USER node
LABEL org.opencontainers.image.source="https://github.com/canmingwei27-star/Amazon-work-web"
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
