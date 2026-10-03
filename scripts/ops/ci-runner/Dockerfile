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
       ca-certificates curl git jq unzip libicu74 tini \
  && rm -rf /var/lib/apt/lists/*

# Системные библиотеки и шрифты Chromium для Playwright ставятся здесь, при сборке, от root. Внутри контейнера sudo
# не работает: compose задаёт no-new-privileges, и `playwright install --with-deps` падал за две секунды с «The "no new
# privileges" flag is set, which prevents sudo from running as root» (первый настоящий прогон 03.10.2026, все три части
# UI и проверка главной). Поэтому задачи на этом раннере зовут `playwright install chromium` без --with-deps. Список —
# то, что ставит `playwright install-deps chromium` версии 1.63 для Ubuntu 24.04 (инструменты и chromium), сверяет
# tests/unit/ci-runner.test.ts.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       xvfb fonts-noto-color-emoji fonts-unifont libfontconfig1 libfreetype6 xfonts-cyrillic xfonts-scalable \
       fonts-liberation fonts-ipafont-gothic fonts-wqy-zenhei fonts-tlwg-loma-otf fonts-freefont-ttf \
       libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo2 libcups2t64 libdbus-1-3 \
       libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
       libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

# Раннер отказывается работать от root. sudo в образе нет: под no-new-privileges он всё равно не работает.
RUN useradd -m -s /bin/bash runner

# Хук перед каждой задачей: задачи из запроса на слияние из чужого форка раннер не выполняет (job-started.sh,
# ADR-137). Файл root и лежит вне тома раннера: хук приходит с образом, а не с проверяемой веткой.
COPY job-started.sh /usr/local/lib/wetop-ci/job-started.sh
RUN chmod 0755 /usr/local/lib/wetop-ci/job-started.sh
ENV ACTIONS_RUNNER_HOOK_JOB_STARTED=/usr/local/lib/wetop-ci/job-started.sh

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
