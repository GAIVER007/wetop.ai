"""Шаг 4: сборка контекста. Неизменяемый префикс сверху (кэш промпта у роутера),
знания вторым system-сообщением, история — чистый текст, обрезанный
до history_turns, сообщение клиента последним."""

from src.ai.context import OUTPUT_INSTRUCTIONS, HistoryTurn, build_messages
from src.db.base import FunnelStage

PROMPT = "Ты продавец мебели. Отвечай коротко."


def turns(n: int) -> list[HistoryTurn]:
    return [HistoryTurn(role="user" if i % 2 == 0 else "assistant", text=f"реплика {i}") for i in range(n)]


def test_prefix_is_identical_across_calls() -> None:
    first = build_messages(system_prompt=PROMPT, knowledge=[], history=turns(2), user_text="а", history_turns=20)
    second = build_messages(
        system_prompt=PROMPT, knowledge=["факт"], history=turns(7), user_text="б", history_turns=20
    )
    assert first[0] == second[0]
    assert first[0]["role"] == "system"
    assert first[0]["content"].startswith(PROMPT)
    assert OUTPUT_INSTRUCTIONS in first[0]["content"]


def test_knowledge_is_second_system_message_only_when_present() -> None:
    with_kb = build_messages(
        system_prompt=PROMPT, knowledge=["Стол — 10 000", "Стул — 3 000"], history=[], user_text="?", history_turns=5
    )
    assert with_kb[1]["role"] == "system"
    assert "Стол — 10 000" in with_kb[1]["content"]
    assert "Стул — 3 000" in with_kb[1]["content"]
    assert with_kb[1]["content"].startswith("Факты из базы знаний")

    without_kb = build_messages(system_prompt=PROMPT, knowledge=[], history=[], user_text="?", history_turns=5)
    assert len(without_kb) == 2
    assert [m["role"] for m in without_kb] == ["system", "user"]


def test_history_trimmed_to_last_turns_and_is_plain_text() -> None:
    messages = build_messages(
        system_prompt=PROMPT, knowledge=[], history=turns(30), user_text="вопрос", history_turns=4
    )
    history = messages[1:-1]
    assert [m["content"] for m in history] == ["реплика 26", "реплика 27", "реплика 28", "реплика 29"]
    assert [m["role"] for m in history] == ["user", "assistant", "user", "assistant"]
    assert all(isinstance(m["content"], str) for m in messages)
    assert messages[-1] == {"role": "user", "content": "вопрос"}


def test_empty_history_turns_are_skipped() -> None:
    history = [HistoryTurn(role="user", text=""), HistoryTurn(role="assistant", text="   "), HistoryTurn(role="user", text="есть")]
    messages = build_messages(system_prompt=PROMPT, knowledge=[], history=history, user_text="x", history_turns=10)
    assert [m["content"] for m in messages[1:-1]] == ["есть"]


def test_output_instructions_mention_contract() -> None:
    for name in ("reply", "needs_human", "human_reason", "funnel_stage", "lead"):
        assert name in OUTPUT_INSTRUCTIONS, name
    for stage in FunnelStage:
        assert stage.value in OUTPUT_INSTRUCTIONS, stage.value
    assert len(OUTPUT_INSTRUCTIONS.strip().splitlines()) <= 30


def test_custom_output_instructions() -> None:
    messages = build_messages(
        system_prompt=PROMPT, knowledge=[], history=[], user_text="x", history_turns=1, output_instructions="ИНСТР"
    )
    assert messages[0]["content"] == PROMPT + "\n\nИНСТР"


def test_history_turns_are_clipped_to_max_turn_chars() -> None:
    """🔴 Аудит 30.09.2026: текущий ход режет guardrails, а история уходила в модель
    как есть. Красный на коде до правки: параметра нет."""
    long_turn = HistoryTurn(role="user", text="ж" * 10_000)
    messages = build_messages(
        system_prompt=PROMPT, knowledge=[], history=[long_turn], user_text="?", history_turns=5, max_turn_chars=4000
    )
    assert len(messages[1]["content"]) == 4000
    untouched = build_messages(system_prompt=PROMPT, knowledge=[], history=[long_turn], user_text="?", history_turns=5)
    assert len(untouched[1]["content"]) == 10_000
