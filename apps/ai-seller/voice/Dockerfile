# Образ голосового воркера (ИИ-колл-центр). Контекст сборки: apps/ai-seller (см. voice/compose.yml).
# Тяжёлый стек текстового продавца (torch, модель эмбеддингов) воркеру не нужен: ставится только voice/requirements.txt.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Непривилегированный пользователь: процесс получает звук и текст от чужих людей из телефонной сети
RUN useradd --create-home --uid 1000 --shell /usr/sbin/nologin app

WORKDIR /app

COPY voice/requirements.txt ./voice/requirements.txt
RUN pip install -r voice/requirements.txt

# Исходники в образ, а не bind-mount: правка применяется пересборкой. Секретов и .env в образе нет, ключи приходят
# из env_file на сервере
COPY --chown=app:app voice ./voice

# Журнал звонков и очередь событий живут на томе: пересоздание контейнера их не уносит (apps/ai-seller/AGENTS.md)
RUN mkdir -p /data && chown app:app /data
VOLUME ["/data"]

USER app
CMD ["python", "-m", "voice.worker"]
