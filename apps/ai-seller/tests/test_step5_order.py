"""Шаг 5: порядок конвейера фиксированный. Подмена модели или отправителя
заглушкой (в том числе отказывающей) не меняет порядок пройденных шагов."""

from src.ai.engine import PIPELINE, NEUTRAL_REPLY
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    ScriptedLlm,
    engine_env,
    incoming,
    reply,
)


def assert_in_pipeline_order(trace: list[str]) -> None:
    """trace — подпоследовательность PIPELINE без повторов и перестановок."""
    assert trace, "трасса пуста"
    positions = [PIPELINE.index(step) for step in trace]
    assert positions == sorted(positions), f"шаги не по порядку: {trace}"
    assert len(set(positions)) == len(positions), f"шаг повторился: {trace}"
    assert trace[0] == PIPELINE[0]


def test_pipeline_constant_matches_contract() -> None:
    assert PIPELINE == (
        "accept", "dedup", "lock", "contact", "guard_in", "consent", "context",
        "model", "unmask", "guard_out", "checks", "send", "record",
    )


async def test_normal_turn_walks_whole_pipeline(engine_env) -> None:
    engine = engine_env.engine(llm=ScriptedLlm([reply("Апартаменты есть.")]))
    outcome = await engine.process_message(incoming("Есть свободные апартаменты?"))
    assert outcome.status == "replied"
    assert_in_pipeline_order(outcome.trace)
    for step in ("accept", "dedup", "lock", "guard_in", "context", "model", "send", "record"):
        assert step in outcome.trace
    assert outcome.trace[-1] == "record"


async def test_llm_failure_keeps_order(engine_env) -> None:
    engine = engine_env.engine(llm=ScriptedLlm([RuntimeError("модель легла")]))
    outcome = await engine.process_message(incoming("Есть свободные апартаменты?", external_id="2"))
    assert outcome.reply == NEUTRAL_REPLY
    assert_in_pipeline_order(outcome.trace)
    assert outcome.trace.index("model") < outcome.trace.index("send")
    assert outcome.trace[-1] == "record"


async def test_send_failure_keeps_order(engine_env) -> None:
    engine = engine_env.engine(sender=MemorySender(fail=True), llm=ScriptedLlm([reply("Есть.")]))
    outcome = await engine.process_message(incoming("Есть свободные апартаменты?", external_id="3"))
    assert outcome.status == "send_failed"
    assert_in_pipeline_order(outcome.trace)
    assert "send" in outcome.trace
    assert outcome.trace.index("checks") < outcome.trace.index("send")
    # Ответ не отправлен — записи ответа быть не должно, шаг record не пройден.
    assert "record" not in outcome.trace


async def test_trace_order_is_stable_across_runs(engine_env) -> None:
    """Три прогона подряд в одном диалоге: трасса каждого — в порядке PIPELINE."""
    engine = engine_env.engine(llm=ScriptedLlm([reply("Да.")]))
    for i, text in enumerate(("Первый", "Второй", "Третий")):
        outcome = await engine.process_message(incoming(text, external_id="4"))
        assert outcome.status == "replied", i
        assert_in_pipeline_order(outcome.trace)
