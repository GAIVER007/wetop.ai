# Дежурный агент на сервере (plans/slice-12-guard-server.md, шаг 12.3).
#
# Внутри только Claude Code, git и клон репозитория. Ни базы, ни .env боевой PMS, ни служебного ключа:
# неисправности агент читает ключом на чтение (GUARD_READ_KEY, apps/api/src/auth/auth.guard.ts).
FROM node:24-alpine

RUN apk add --no-cache git openssh-client ca-certificates tini \
  && npm install -g --omit=dev @anthropic-ai/claude-code \
  && npm cache clean --force

# Клон живёт в домашней папке агента, а не в томе с чужими файлами: контейнер одноразовый по смыслу,
# при пересоздании клон делается заново и наверняка совпадает с GitHub.
WORKDIR /home/node/work
COPY run.sh /usr/local/bin/guard-run
RUN chmod +x /usr/local/bin/guard-run && chown -R node:node /home/node
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/usr/local/bin/guard-run"]
