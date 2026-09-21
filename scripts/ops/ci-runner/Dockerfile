# Свой раннер GitHub Actions на сервере (разбор 21.09.2026: включённые минуты выбраны, бюджет Actions
# стоит $0 со «Stop usage», и ни одна проверка не запускается — падает за две секунды).
#
# На self-hosted минуты не тарифицируются вообще. Держим здесь только то, чему не нужен Docker:
# lint/typecheck/unit и три части UI. Раннер намеренно без доступа к сокету Docker — иначе код из любой
# ветки получил бы root на машине, где рядом живут чужие проекты.
FROM ubuntu:24.04

ARG RUNNER_VERSION=""
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates curl git jq sudo unzip libicu74 tini \
  && rm -rf /var/lib/apt/lists/*

# Раннер отказывается работать от root, а `playwright install --with-deps` зовёт apt через sudo.
RUN useradd -m -s /bin/bash runner \
  && echo 'runner ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/runner \
  && chmod 0440 /etc/sudoers.d/runner

USER runner
WORKDIR /home/runner/actions-runner

# Версия не закреплена намеренно: раннер сам отказывается работать, когда отстаёт от GitHub больше чем на
# один выпуск, и тогда сборка образа — единственный способ его обновить. Закрепить можно build-arg.
RUN set -eu; \
    url="$( [ -n "${RUNNER_VERSION}" ] \
      && echo "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
      || curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
         | jq -r '.assets[].browser_download_url' | grep -E 'actions-runner-linux-x64-[0-9.]+\.tar\.gz$' | head -1 )"; \
    echo "раннер: $url"; \
    curl -fsSL "$url" -o runner.tar.gz; \
    tar xzf runner.tar.gz; \
    rm runner.tar.gz

COPY --chown=runner:runner entrypoint.sh /home/runner/entrypoint.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/bin/bash", "/home/runner/entrypoint.sh"]
