# Образ приложения ИИ-продавца. Один образ на app и monitor:
# monitor запускается тем же образом с другой командой (см. compose.yml).
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Непривилегированный пользователь: процесс, получающий текст от чужих
# людей из интернета, не должен быть root внутри контейнера.
RUN useradd --create-home --uid 1000 --shell /usr/sbin/nologin app

WORKDIR /app

# Сначала torch с CPU-индекса и только потом остальное: иначе с PyPI
# приедет CUDA-сборка и образ вырастет с ~2 ГБ до ~9.
COPY requirements.txt .
RUN pip install --index-url https://download.pytorch.org/whl/cpu "torch>=2.14,<2.15" \
    && pip install -r requirements.txt

# Модель эмбеддингов (~450 МБ) кладётся в образ отдельным слоем: на старте
# контейнер в сеть не ходит. Имя модели здесь совпадает с умолчанием
# KB_EMBED_MODEL в env.example; сменили модель — меняем в обоих местах
# и переиндексируем базу знаний (размерность VECTOR в схеме тоже).
ENV HF_HOME=/app/.hf
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-small')" \
    && chown -R app:app /app/.hf
# Офлайн-режим: библиотека не проверяет обновления модели при загрузке.
ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

# Исходники в образ, а не bind-mount: с монтированием compose up после
# правки процесс не перезапускает (см. compose.yml).
COPY --chown=app:app src ./src
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app alembic.ini .
COPY --chown=app:app scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh

# Тома для данных и журнала. chown здесь не действует на bind-mount с хоста:
# перед первым compose up каталоги ./data и ./logs создаёт хост
# (mkdir + chown 1000:1000, см. vykatka.md), иначе файл журнала не откроется.
RUN mkdir -p /app/data /app/logs && chown -R app:app /app

USER app

EXPOSE 8000

# curl в slim-образе нет; проверка живости — стандартной библиотекой.
# Публичный /health отвечает только статусом, подробности — /internal/health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status == 200 else 1)"

# Точка входа накатывает миграции перед веб-процессом (см. scripts/).
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "src.main:app", "--bind", "0.0.0.0:8000", "--workers", "2"]
