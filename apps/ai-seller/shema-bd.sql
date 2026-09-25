-- ─────────────────────────────────────────────────────────────────────
-- ИИ-продавец. Схема ядра.
--
-- Сведена из десятков боевых проектов. Здесь только те таблицы,
-- к которым независимо пришли почти все сборки. Каталог товаров,
-- продукты, тарифы и всё прочее добавляется под задачу отдельно.
--
-- Читать сверху вниз: клиент → диалог → сообщения. Знания живут отдельной
-- веткой и с диалогом не связаны.
-- ─────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- для полнотекстового поиска

-- 🔴 ГЛАВНОЕ ПРАВИЛО ЭТОЙ СХЕМЫ
-- Ни у одного времени нет DEFAULT now(). Все метки ставит приложение.
-- server_default = время НАЧАЛА транзакции: метки схлопываются, и любой
-- расчёт «за сколько ответили» начинает врать. Ошибка тихая: данные есть,
-- выглядят разумно, а отчёт неверный.


-- ─── Перечисления ───

CREATE TYPE conversation_mode AS ENUM (
    'bot_active',       -- бот ведёт разговор
    'needs_human',      -- бот попросил человека, но продолжает отвечать
    'owner_takeover'    -- человек вошёл, бот замолчал
);
-- 🔴 needs_human и owner_takeover — разные состояния, и переход между ними
-- делает ЧЕЛОВЕК, а не модель. Автопереход в owner_takeover по сигналу
-- модели означает: бот замолчал, оператор спит, клиент ушёл.

CREATE TYPE funnel_stage AS ENUM (
    'new', 'qualifying', 'presenting', 'objection', 'closing', 'won', 'lost'
);
-- Этапы под свою воронку. Канона тут нет, это ваша модель продажи.

CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system', 'operator');


-- ─── Организации (Э4, ADR-083 платформы) ───
-- Один экземпляр-продавец обслуживает много гостиниц. Строку заводит
-- платформа (PUT /seller/organizations/{id}); у помощника таблица пуста,
-- его строки везде с organization_id IS NULL.

CREATE TABLE organizations (
    id            UUID PRIMARY KEY,           -- идентификатор организации платформы
    name          TEXT NOT NULL,
    -- Публичный ключ виджета (sk_ + hex): стоит в теге на сайте гостиницы.
    public_key    TEXT NOT NULL UNIQUE,
    -- FALSE — расширение «ИИ-продавец» погашено: виджет отвечает 403 и гаснет.
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    -- Домены сайтов гостиницы: дверь виджета открывается только с них.
    hosts         JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Промпт продавца гостиницы: ядро правил + профиль из «Настроек».
    system_prompt TEXT,
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL
);


-- ─── Клиенты ───

CREATE TABLE clients (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Идентификатор в системе канала. 🔴 Всегда строка, даже если пришло
    -- число: чужой API однажды отдаст его в другом виде.
    external_id  TEXT NOT NULL,
    channel      TEXT NOT NULL,
    name         TEXT,
    phone        TEXT,
    email        TEXT,
    -- NULL — строка помощника или диалог продавца до Э4 (в панели не виден).
    organization_id UUID REFERENCES organizations(id),
    created_at   TIMESTAMPTZ NOT NULL
);

-- Уникальность внешнего id — в пределах организации; у строк без неё своя:
-- NULL в обычном уникальном индексе различен, дубли прошли бы молча.
CREATE UNIQUE INDEX uq_clients_org_channel_external
    ON clients (organization_id, channel, external_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX uq_clients_channel_external_null
    ON clients (channel, external_id) WHERE organization_id IS NULL;
CREATE INDEX idx_clients_org ON clients (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_clients_phone ON clients (phone) WHERE phone IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- СОГЛАСИЕ НА ОБРАБОТКУ ДАННЫХ
--
-- Отдельная таблица, а не флаг на клиенте: согласие нужно уметь
-- ПРЕДЪЯВИТЬ. Флаг «да/нет» доказательством не является — нужны момент,
-- канал, версия текста и то, что именно человек нажал.
--
-- 🔴 Включается настройкой. Если основание обработки — договор с клиентом
-- или другое законное основание, гейт согласия не нужен и мешает.
-- Основание выясняется на брифе, раздел 5б.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE consents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id      UUID NOT NULL REFERENCES clients(id),

    -- Что именно человек подтвердил. Версия обязательна: текст политики
    -- меняется, а согласие дано на конкретную редакцию.
    policy_version TEXT NOT NULL,
    policy_url     TEXT NOT NULL,

    -- Как получено: нажатие кнопки, отдельное сообщение, галочка
    -- в виджете. Продолжение переписки согласием НЕ считается.
    method         TEXT NOT NULL,
    -- Дословно то, что было показано человеку в момент нажатия.
    shown_text     TEXT NOT NULL,

    granted_at     TIMESTAMPTZ NOT NULL,
    -- Отзыв согласия. Человек вправе передумать, и это надо уметь принять.
    revoked_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_consents_active ON consents (client_id)
    WHERE revoked_at IS NULL;


-- ─── Люди, которые заходят в панель ───

CREATE TABLE dashboard_users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email              TEXT NOT NULL UNIQUE,

    -- 🔴 Отпечаток пароля, а не пароль. Файл настроек и дамп базы
    -- читают агент, бэкап и любой, кто попал на сервер.
    password_hash      TEXT NOT NULL,

    -- 'owner' правит промпт, грузит документы и меняет сроки.
    -- 'operator' читает диалоги, перехватывает и видит лиды.
    role               TEXT NOT NULL,

    -- Второй фактор. Секрет создаётся при подключении аутентификатора
    -- и показывается человеку ОДИН раз — в виде QR-кода.
    totp_secret        TEXT,
    totp_confirmed_at  TIMESTAMPTZ,

    -- 🔴 Защита от повтора: один и тот же код в пределах своего окна
    -- принимается ровно один раз. Иначе подсмотренный код работает
    -- ещё полминуты.
    totp_last_step     BIGINT,

    -- Резервные коды на случай потерянного телефона. Хранятся
    -- отпечатками, использованный гасится.
    backup_codes       JSONB NOT NULL DEFAULT '[]'::jsonb,

    failed_logins      INTEGER NOT NULL DEFAULT 0,
    blocked_until      TIMESTAMPTZ,
    last_login_at      TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─── Диалоги ───

CREATE TABLE conversations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    -- Дублирует организацию клиента намеренно: политика RLS и панель
    -- отбирают диалоги без соединения с clients.
    organization_id  UUID REFERENCES organizations(id),
    mode             conversation_mode NOT NULL DEFAULT 'bot_active',
    funnel_stage     funnel_stage      NOT NULL DEFAULT 'new',
    -- Свободная сумка: имя, контакт, боли, интересы, бюджет, срок.
    -- Плюс флаги идемпотентности внешних действий: лид создан, письмо ушло,
    -- задача поставлена. Проверяются ДО действия, чтобы не создать дубль.
    lead_data        JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL,
    -- По нему сортируется список у оператора и по нему же сторож находит
    -- зависшие разговоры.
    last_activity_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_conv_active   ON conversations (is_active, last_activity_at DESC);
CREATE INDEX idx_conv_mode     ON conversations (mode) WHERE mode <> 'bot_active';
CREATE INDEX idx_conv_lead     ON conversations USING GIN (lead_data);
CREATE INDEX idx_conversations_org ON conversations (organization_id) WHERE organization_id IS NOT NULL;

-- RLS изоляции организаций (Э4). 🔴 Честно: пока бот ходит в базу
-- владельцем таблиц, владелец политики ОБХОДИТ — действующая гарантия
-- изоляции сегодня это фильтры приложения (tests/test_orgs_isolation.py).
-- Политики заработают, когда появится непривилегированный пользователь БД.
ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents     ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_clients ON clients
    USING (organization_id IS NOT DISTINCT FROM NULLIF(current_setting('app.org_id', true), '')::uuid);
CREATE POLICY org_isolation_conversations ON conversations
    USING (organization_id IS NOT DISTINCT FROM NULLIF(current_setting('app.org_id', true), '')::uuid);
CREATE POLICY org_isolation_documents ON documents
    USING (organization_id IS NOT DISTINCT FROM NULLIF(current_setting('app.org_id', true), '')::uuid);


-- ─── Сообщения ───

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            message_role NOT NULL,
    content         TEXT NOT NULL,
    -- Своё это сообщение или чужое. Без пометки не отличить ответ бота
    -- от ответа человека, вошедшего в тот же диалог.
    sent_by_us      BOOLEAN NOT NULL DEFAULT FALSE,
    audio_url       TEXT,
    tokens_used     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_msg_conv ON messages (conversation_id, created_at);


-- ─── Действия оператора ───
-- Кто и когда вмешался: перехватил, вернул боту, поправил промпт.
-- Нужна, чтобы разобрать спорный диалог через месяц.

CREATE TABLE owner_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    action          TEXT NOT NULL,
    payload         JSONB,
    created_at      TIMESTAMPTZ NOT NULL
);


-- ─── База знаний ───

CREATE TABLE documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    source      TEXT NOT NULL,
    -- Хеш содержимого: один и тот же документ не грузится дважды —
    -- в пределах организации (у двух гостиниц бывает одинаковый прайс).
    file_hash   TEXT NOT NULL,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX uq_documents_org_hash
    ON documents (organization_id, file_hash) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX uq_documents_hash_null
    ON documents (file_hash) WHERE organization_id IS NULL;
CREATE INDEX idx_documents_org ON documents (organization_id) WHERE organization_id IS NOT NULL;

CREATE TABLE knowledge_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content     TEXT NOT NULL,
    -- 384 — размерность multilingual-e5-small. Меняете модель эмбеддингов,
    -- меняете это число и переиндексируете ВСЁ. Иначе поиск молча врёт.
    embedding   VECTOR(384),
    -- В SQLAlchemy атрибут назовите chunk_metadata: имя metadata занято.
    meta        JSONB,
    created_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_chunks_vec ON knowledge_chunks
    USING hnsw (embedding vector_cosine_ops);

-- Полнотекстовый индекс нужен, только если в базе есть каталог: товары,
-- артикулы, номера моделей. Для базы из услуг и правил хватает вектора.
CREATE INDEX idx_chunks_fts ON knowledge_chunks
    USING GIN (to_tsvector('russian', content));


-- ─────────────────────────────────────────────────────────────────────
-- ИСХОДЯЩИЕ: OUTBOX
--
-- Появился после инцидента на боевом проекте: отправка падала МОЛЧА.
-- В базе сообщение есть, получатель его не видел, в логах ни ошибки.
-- Отдельная таблица, а не флаг на сообщении: алерт владельцу — не реплика
-- в диалоге, у него свой получатель и свой срок жизни.
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE delivery_status_enum AS ENUM (
    'pending',   -- сохранено, доставка не подтверждена
    'sent',      -- подтверждено получателем (HTTP 200 от его API)
    'failed',    -- сдались после исчерпания окна повторов
    'skipped'    -- намеренно не отправляли (дедуп, тишина ночью)
);

CREATE TYPE outbox_kind_enum AS ENUM (
    'reply',      -- ответ клиенту в канал
    'alert'       -- уведомление владельцу или оператору
);

CREATE TABLE outbox (
    id                  bigserial PRIMARY KEY,
    kind                outbox_kind_enum NOT NULL,

    -- Куда шлём. Для alert — 'email' или 'telegram': один и тот же алерт
    -- кладётся ДВУМЯ строками, по одной на канал. Молчание почты не должно
    -- зависеть от того, дошло ли в мессенджер.
    transport           text NOT NULL,
    recipient           text NOT NULL,

    body                text NOT NULL,
    -- Ключ дедупа: одинаковый инцидент за окно молчания не шлётся дважды.
    dedup_key           text,

    status              delivery_status_enum NOT NULL DEFAULT 'pending',
    attempts            integer NOT NULL DEFAULT 0,
    last_error          text,
    last_attempt_at     timestamptz,
    sent_at             timestamptz,

    -- До какого момента добиваем. Дальше — 'failed' и алерт о том,
    -- что алерт не доставлен.
    expires_at          timestamptz NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Выборка цикла повторной доставки: только то, что ещё живо.
CREATE INDEX idx_outbox_pending ON outbox (status, expires_at)
    WHERE status = 'pending';

-- Дедуп проверяется по ключу за окно, поэтому индекс частичный.
CREATE INDEX idx_outbox_dedup ON outbox (dedup_key, created_at)
    WHERE dedup_key IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- ЧЕГО ЗДЕСЬ НЕТ СОЗНАТЕЛЬНО
--
-- Таблицы под отчётность. Заводятся «на будущее» почти всегда и почти
-- всегда остаются пустыми: пока нет живого запроса, писать в них некому.
-- Заводите, когда запрос появится.
--
-- Каталог товаров. Он есть не у всех и устроен у каждого по-своему.
-- Если он нужен, добавьте флаг вида seen_in_feed: снятое с выгрузки
-- помечается, а не удаляется, иначе бот рассказывает про товары-призраки.
--
-- tenant_id ОТДЕЛЬНЫМ полем всего подряд. С Э4 (ADR-083) мультиарендность
-- продавца есть, но ровно в объёме organization_id у clients, conversations
-- и documents: сообщения, согласия и очередь наследуют организацию через
-- диалог и клиента, и дублировать её в каждую таблицу не нужно.
-- ─────────────────────────────────────────────────────────────────────
