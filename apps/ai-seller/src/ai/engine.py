"""Движок диалога: конвейер одного хода, process_message().

Порядок шагов PIPELINE фиксированный (AGENTS.md «Горячий путь»). Каждый шаг —
метод с тем же именем, он дописывает себя в trace на входе. Ранние ветки
(отбой, экран согласия, сбой промпта или модели) пропускают только модель,
а не отправку: клиент всегда получает ответ, а история — ровно ту реплику,
которая реально ушла. Маскировка ПД живёт внутри llm.generate (один раз,
до каскада); здесь — только снятие масок. Исключение из process_message
не выходит никогда: ошибка хода не должна ронять обработчик канала.
Замок и очередь — src/ai/turn_lock.py; типы хода — src/ai/engine_types.py.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable
from urllib.parse import urlparse

import sqlalchemy as sa

from src import dependencies
from src.ai import budget
from src.ai import lead as lead_rules
from src.ai.context import HistoryTurn, build_messages
from src.ai.engine_types import IncomingMessage, Status, Turn, TurnOutcome
from src.ai.guardrails import OutputContext, apply_strikes, check_input, check_output
from src.ai.humanizer import humanize
from src.ai.turn_lock import TurnLock, lock_ttl_seconds
from src.alerts.raise_alert import raise_alert
from src.channels.consent_gate import consent_required, consent_screen
from src.channels.sender import Sender, SendResult
from src.config import Settings, get_settings
from src.db.base import ConversationMode, FunnelStage, MessageRole, utcnow
from src.db.dedup import is_duplicate
from src.db.models import Client, Conversation, Message, Organization
from src.knowledge import retriever
from src.knowledge.prompt import PromptMissing, load_system_prompt
from src.security.llm_keys import org_llm_api_key
from src.security.pii import unmask

__all__ = ["Engine", "IncomingMessage", "NEUTRAL_REPLY", "PIPELINE", "REFUSAL_REPLY", "Status", "TurnOutcome", "build_engine"]

logger = logging.getLogger(__name__)

PIPELINE: tuple[str, ...] = (
    "accept", "dedup", "lock", "contact", "guard_in", "consent", "context",
    "model", "unmask", "guard_out", "checks", "send", "record",
)
LeadHook = Callable[[uuid.UUID, dict], Awaitable[None]]

# Общие фразы ядра; клиентские формулировки — в промпте.
NEUTRAL_REPLY = "Сейчас не могу ответить, администратор свяжется с вами."
REFUSAL_REPLY = "Я помогаю с вопросами по размещению и бронированию, давайте вернёмся к ним."

_QUEUE_DRAIN_LIMIT = 20  # предел на вызов: очередь не должна крутить нас вечно
_ROLE_TO_TURN = {MessageRole.USER: "user", MessageRole.ASSISTANT: "assistant", MessageRole.OPERATOR: "assistant"}


class Engine:
    """Один экземпляр на канал: отправитель и правила разметки — свойства канала."""

    def __init__(
        self, *, settings: Settings, sessionmaker, redis, sender: Sender, llm, embedder,
        prompt_loader: Callable[[], str] | None = None, lead_hook: LeadHook | None = None,
        channel_markdown: bool = False, channel_emoji: bool = False,
    ) -> None:
        self._settings, self._sessionmaker, self._redis = settings, sessionmaker, redis
        self._sender, self._llm, self._embedder, self._lead_hook = sender, llm, embedder, lead_hook
        self._prompt_loader = prompt_loader or (lambda: load_system_prompt(settings.prompt_path))
        self._markdown, self._emoji = channel_markdown, channel_emoji

    # ─── Вход ───

    async def process_message(self, incoming: IncomingMessage) -> TurnOutcome:
        return await self._process(incoming)

    async def _process(self, incoming: IncomingMessage, *, from_queue: bool = False) -> TurnOutcome:
        """from_queue: повтор из очереди — дедуп он уже прошёл (иначе был бы
        отброшен как дубль самого себя), а замок держит внешний вызов."""
        outcome = TurnOutcome("error", None, None, False, [], [], [])
        ctx = dependencies.conversation_id_var.set(None)
        # Организация хода — инструментам (котировка Q-166): снимается вместе с диалогом ниже.
        org_ctx = dependencies.organization_id_var.set(incoming.organization_id)
        turn: Turn | None = None
        try:
            async with self._sessionmaker() as session:
                turn = Turn(incoming=incoming, session=session, outcome=outcome)
                await self._accept(turn)
                if from_queue:
                    turn.step("lock")
                    await self._run_locked(turn)
                elif not await self._dedup(turn) and await self._lock(turn):
                    try:
                        await self._run_locked(turn)
                    except Exception:
                        await self._on_exception(turn)
                    # Очередь разбирает тот, кто держит замок; он же его и снимает.
                    await self._drain_queue(turn.lock)
        except Exception:
            await self._on_exception(turn, incoming)
        finally:
            dependencies.conversation_id_var.reset(ctx)
            dependencies.organization_id_var.reset(org_ctx)
        return outcome

    async def _run_locked(self, t: Turn) -> None:
        conv = t.conversation
        stmt = sa.select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at)
        t.history = list((await t.session.execute(stmt)).scalars())
        # Реплика клиента — сразу, до ответа: сторож должен видеть неотвеченное.
        t.session.add(Message(conversation_id=conv.id, role=MessageRole.USER, content=t.incoming.text,
                              sent_by_us=False, created_at=t.incoming.received_at))
        await t.session.commit()
        t.outcome.status = "replied"
        await self._contact(t)
        if await self._guard_in(t):
            if t.reply is None:
                await self._consent(t)
            if t.reply is None:
                await self._context(t)
            if t.reply is None:
                await self._model(t)
            if t.reply is None:  # модель ответила: снять маски, проверить, дополнить
                self._unmask(t)
                self._guard_out(t)
                await self._checks(t)
            if await self._send(t):
                await self._record(t)
        await self._finish(t)

    # ─── Шаги ───

    async def _accept(self, t: Turn) -> None:
        t.step("accept")
        inc, session = t.incoming, t.session
        org = inc.org_uuid()
        stmt = sa.select(Client).where(Client.channel == inc.channel, Client.external_id == str(inc.external_id))
        # Клиент — в пределах организации входящего (Э4): один человек на
        # сайтах двух гостиниц — два клиента. Без организации — как раньше.
        stmt = stmt.where(Client.organization_id == org) if org else stmt.where(Client.organization_id.is_(None))
        client = (await session.execute(stmt)).scalar_one_or_none()
        if client is None:
            client = Client(channel=inc.channel, external_id=str(inc.external_id), name=inc.client_name,
                            organization_id=org, created_at=utcnow())
            session.add(client)
            await session.flush()
        stmt = (sa.select(Conversation).where(Conversation.client_id == client.id, Conversation.is_active.is_(True))
                .order_by(Conversation.last_activity_at.desc()).limit(1))
        conv = (await session.execute(stmt)).scalar_one_or_none()
        if conv is None:
            now = utcnow()
            conv = Conversation(client_id=client.id, organization_id=org, mode=ConversationMode.BOT_ACTIVE,
                                funnel_stage=FunnelStage.NEW, lead_data={}, created_at=now, last_activity_at=now)
            session.add(conv)
        await session.commit()
        t.client, t.conversation, t.lead = client, conv, dict(conv.lead_data or {})
        t.outcome.conversation_id = conv.id
        dependencies.conversation_id_var.set(str(conv.id))

    async def _dedup(self, t: Turn) -> bool:
        t.step("dedup")
        inc = t.incoming
        duplicate = await is_duplicate(self._redis, channel=inc.channel, external_id=str(inc.external_id),
                                       text=inc.text, ttl_seconds=self._settings.guard_dedup_ttl_seconds)
        if duplicate:
            t.outcome.status = "duplicate"
        return duplicate

    async def _lock(self, t: Turn) -> bool:
        """Только захват: всё после SET NX живёт под try/finally вызывающего."""
        t.step("lock")
        lock = TurnLock(self._redis, t.conversation.id, ttl_seconds=lock_ttl_seconds(self._settings))
        if await lock.acquire():
            t.lock = lock
            return True
        # Занят — в очередь, не мимо: ранний выход теряет реплику клиента.
        await lock.enqueue(t.incoming.to_json())
        t.outcome.status = "queued"
        # Пока клали в очередь, держатель мог её проверить и снять замок:
        # тогда сообщение разбираем сами, иначе оно ждёт следующего входящего.
        if await lock.acquire():
            await self._drain_queue(lock)
        return False

    async def _contact(self, t: Turn) -> None:
        t.step("contact")
        s = self._settings
        client_texts = [m.content for m in t.history if m.role == MessageRole.USER]
        t.verdict = check_input(t.incoming.text, history=client_texts[-s.guard_crescendo_window:],
                                max_chars=s.guard_max_input_chars, crescendo_window=s.guard_crescendo_window,
                                crescendo_hits=s.guard_crescendo_hits)
        if t.verdict.contacts.any:
            t.lead = lead_rules.merge_contacts(t.lead, t.verdict.contacts)
            if t.conversation.funnel_stage == FunnelStage.NEW:
                t.conversation.funnel_stage = FunnelStage.QUALIFYING

    async def _guard_in(self, t: Turn) -> bool:
        t.step("guard_in")
        s = self._settings
        t.verdict = await apply_strikes(self._redis, t.verdict, conversation_id=str(t.conversation.id), ip=t.incoming.ip,
                                        limit=s.injection_strike_limit, window_seconds=s.injection_strike_window_seconds,
                                        block_ttl_seconds=s.ip_block_ttl_seconds)
        t.outcome.reasons.extend(t.verdict.reasons)
        if t.verdict.action == "block":
            t.outcome.status = "blocked"
            return False
        if t.verdict.action == "refuse":
            t.reply = REFUSAL_REPLY
            t.outcome.reasons.append("refused")
        return True

    async def _consent(self, t: Turn) -> None:
        t.step("consent")
        if await consent_required(t.session, self._settings, t.client.id):
            t.reply, t.outcome.status = consent_screen(self._settings).text, "consent"

    async def _context(self, t: Turn) -> None:
        t.step("context")
        s = self._settings
        org = t.incoming.org_uuid()
        if org is not None:
            # Промпт гостиницы (Э4): ядро правил + профиль, собранные в
            # organizations.system_prompt. Нет строки или промпта — отказ,
            # а не файл PROMPT_PATH: отвечать по чужой инструкции нельзя.
            row = await t.session.get(Organization, org)
            system_prompt = (row.system_prompt or "") if row is not None else ""
            # С2: ход гостиницы идёт с её ключом модели, если партнёр его подключил.
            t.llm_api_key = await org_llm_api_key(t.session, org, s)
            if not system_prompt.strip():
                logger.error("системный промпт организации %s недоступен", org)
                return self._fail(t, "prompt_missing")
        else:
            try:
                system_prompt = self._prompt_loader()
            except PromptMissing:
                logger.error("системный промпт недоступен: %s", s.prompt_path)
                return self._fail(t, "prompt_missing")
        try:
            chunks = await retriever.search(t.session, self._embedder, t.verdict.text, top_k=s.kb_top_k,
                                            organization_id=org)
            knowledge = [c.content for c in chunks]
        except Exception:
            logger.warning("поиск по базе знаний не удался, отвечаем без фактов", exc_info=True)
            knowledge = []
        history = [HistoryTurn(role=_ROLE_TO_TURN[m.role], text=m.content) for m in t.history if m.role in _ROLE_TO_TURN]
        t.messages = build_messages(system_prompt=system_prompt, knowledge=knowledge, history=history,
                                    user_text=t.verdict.text, history_turns=s.llm_history_turns)

    async def _model(self, t: Turn) -> None:
        t.step("model")
        if await self._over_daily_budget(t):
            return
        try:
            t.result = await self._llm.generate(t.messages, api_key=t.llm_api_key)
        except Exception:
            logger.exception("слой модели поднял исключение")
            t.result = None
        if t.result is None or not t.result.ok or t.result.parsed is None:
            # Алерт владельцу — шаг 8; клиенту нейтральная фраза, не текст ошибки.
            logger.error("модель не ответила: %s", getattr(t.result, "error", None) or "exception")
            self._fail(t, "llm_failed")

    async def _over_daily_budget(self, t: Turn) -> bool:
        """Дневной предел гостиницы на ключе платформы (src/ai/budget.py).

        Выше предела модель не зовём: гостю — нейтральная фраза, диалог помечен
        для сотрудника (пометка, не перехват: бот и дальше отвечает), владельцу —
        алерт раз в сутки. Сбой подсчёта продавца не глушит: ход идёт к модели.
        """
        org, limit = t.incoming.org_uuid(), self._settings.llm_daily_tokens_per_org
        if org is None or t.llm_api_key is not None or limit <= 0:
            return False
        try:
            spend = await budget.daily_budget(t.session, org, limit)
        except Exception:
            logger.exception("расход гостиницы %s за сутки не посчитан, зовём модель", org)
            return False
        if not spend.exceeded:
            return False
        logger.warning("гостиница %s: дневной предел %d исчерпан (%d), модель не зовём", org, limit, spend.spent)
        hotel = await t.session.get(Organization, org)
        await raise_alert(self._sessionmaker, self._redis, self._settings, event_type=budget.ALERT_EVENT,
                          body=budget.alert_body(hotel.name if hotel else None, org, spend),
                          dedup_key=f"{budget.ALERT_EVENT}:{org}:{spend.day}")
        self._fail(t, "daily_budget")
        t.outcome.needs_human = True
        if t.conversation.mode == ConversationMode.BOT_ACTIVE:
            t.conversation.mode = ConversationMode.NEEDS_HUMAN
        return True

    def _unmask(self, t: Turn) -> None:
        t.step("unmask")
        t.reply = unmask(t.result.parsed.reply, t.result.mapping)

    def _guard_out(self, t: Turn) -> None:
        t.step("guard_out")
        ctx = OutputContext(first_turn=not any(m.role == MessageRole.ASSISTANT for m in t.history),
                            contact_known=bool(t.lead.get("phone")), allowed_prices=None, allowed_urls=self._allowed_urls())
        out = check_output(t.reply, ctx)
        t.reply, t.outcome.edits = out.text, t.outcome.edits + out.edits

    async def _checks(self, t: Turn) -> None:
        t.step("checks")
        parsed, conv, lead = t.result.parsed, t.conversation, t.lead
        t.outcome.needs_human = parsed.needs_human
        # Пометка, не передача: бот продолжает отвечать; owner_takeover не трогаем.
        if parsed.needs_human and conv.mode == ConversationMode.BOT_ACTIVE:
            conv.mode = ConversationMode.NEEDS_HUMAN
        if parsed.funnel_stage:
            conv.funnel_stage = FunnelStage(parsed.funnel_stage)
        lead, t.reply = lead_rules.apply_turn(
            lead, text=t.verdict.text, reply=t.reply, model_lead=parsed.lead, client_name=t.incoming.client_name,
            turn_index=sum(1 for m in t.history if m.role == MessageRole.USER))
        # Заявка — внешнее действие: проверка «уже сделано» ДО вызова.
        if lead_rules.is_complete(lead) and not lead.get("lead_created_at") and self._lead_hook:
            try:
                await self._lead_hook(conv.id, dict(lead))
                lead["lead_created_at"] = utcnow().isoformat()
            except Exception:
                logger.exception("заявка не создана, повторим на следующем ходе")
                t.outcome.reasons.append("lead_hook_failed")
        t.lead = lead
        t.reply = humanize(t.reply, markdown=self._markdown, emoji=self._emoji)

    async def _send(self, t: Turn) -> bool:
        t.step("send")
        try:
            r = await self._sender.send(channel=t.incoming.channel, external_id=str(t.incoming.external_id), text=t.reply)
        except Exception:
            logger.exception("отправитель поднял исключение")
            r = SendResult(ok=False, error="exception")
        if not r.ok:
            logger.error("ответ не доставлен: %s", r.error)
            t.outcome.status, t.outcome.reasons = "send_failed", t.outcome.reasons + ["send_failed"]
            return False
        t.sent = True
        return True

    async def _record(self, t: Turn) -> None:
        t.step("record")
        r = t.result
        # Расход — только у ответа модели: у фраз без неё (отказ, согласие, предел) полей нет.
        usage = dict(tokens_used=r.tokens_used, llm_model=r.model, tokens_input=r.tokens_input,
                     tokens_cached=r.tokens_cached, tokens_output=r.tokens_output) if r is not None else {}
        t.session.add(Message(conversation_id=t.conversation.id, role=MessageRole.ASSISTANT, content=t.reply,
                              sent_by_us=True, created_at=utcnow(), **usage))

    async def _finish(self, t: Turn) -> None:
        """Общий выход: lead_data и режим сохраняются даже без доставки — они про клиента, не про канал."""
        conv = t.conversation
        conv.lead_data = dict(t.lead)  # новый dict: правки внутри старого SQLAlchemy не видит
        conv.last_activity_at = utcnow()
        await t.session.commit()
        t.outcome.reply = t.reply

    # ─── Вспомогательное ───

    @staticmethod
    def _fail(t: Turn, reason: str) -> None:
        """Сбой на нашей стороне: клиенту нейтральная фраза, причина — в outcome."""
        t.reply, t.outcome.status = NEUTRAL_REPLY, "error"
        t.outcome.reasons.append(reason)

    async def _on_exception(self, t: Turn | None, incoming: IncomingMessage | None = None) -> None:
        """Исключение хода: в журнал с трассировкой, статус error, клиенту нейтральная фраза."""
        inc = incoming or t.incoming
        logger.exception("сбой хода: %s/%s", inc.channel, inc.external_id)
        if t is not None:
            t.outcome.status, t.outcome.reasons = "error", t.outcome.reasons + ["exception"]
        if t is None or not t.sent:
            if t is not None:
                t.sent = True  # второй раз (внешний except) не шлём
            try:
                await self._sender.send(channel=inc.channel, external_id=str(inc.external_id), text=NEUTRAL_REPLY)
            except Exception:
                logger.exception("нейтральный ответ не доставлен")

    def _allowed_urls(self) -> set[str]:
        url = self._settings.public_base_url.strip()
        host = urlparse(url if "://" in url else f"https://{url}").hostname if url else None
        return {host} if host else set()

    async def _drain_queue(self, lock: TurnLock) -> None:
        """Под своим замком: LPOP → ход, пока очередь не пуста; замок снимается
        атомарно только при пустой очереди. Предел на вызов, чтобы не крутиться
        вечно; при пределе замок не снимаем — он истечёт по TTL, а не сломает порядок."""
        try:
            for _ in range(_QUEUE_DRAIN_LIMIT):
                if await lock.release_if_idle():
                    return
                raw = await lock.pop_queued()
                if raw is not None:
                    await self._process(IncomingMessage.from_json(raw), from_queue=True)
            logger.warning("очередь %s не разобрана за %d ходов, замок останется до TTL", lock.queue_key,
                           _QUEUE_DRAIN_LIMIT)
        except Exception:
            logger.exception("очередь %s не разобрана", lock.queue_key)
            await lock.release()


def build_engine(
    settings: Settings | None = None, *, sender: Sender, lead_hook: LeadHook | None = None,
    channel_markdown: bool = False, channel_emoji: bool = False,
) -> Engine:
    """Движок из синглтонов процесса. Импорты внутри: клиент роутера и модель
    эмбеддингов не нужны тем, кто собирает движок на подменах."""
    from src.ai.llm import get_cascade_client
    from src.knowledge.embedder import get_embedder

    return Engine(
        settings=settings or get_settings(), sessionmaker=dependencies.get_sessionmaker(), redis=dependencies.get_redis(),
        sender=sender, llm=get_cascade_client(), embedder=get_embedder(), lead_hook=lead_hook,
        channel_markdown=channel_markdown, channel_emoji=channel_emoji,
    )
