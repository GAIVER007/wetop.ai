# «Сторож сторожа» (plans/slice-12-guard-server.md): Node 24 запускает TypeScript без сборки, зависимостей нет.
FROM node:24-alpine
WORKDIR /app
COPY watch-logic.ts server.ts ./
USER node
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
CMD ["node", "server.ts"]
