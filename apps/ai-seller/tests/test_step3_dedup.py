"""Шаг 3: дедуп (слой 0) ловит двойную доставку от канала, а не атаку."""

from src.db.dedup import is_duplicate


async def test_second_identical_message_is_duplicate(fake_redis) -> None:
    kw = dict(channel="telegram", external_id="42", ttl_seconds=60)
    assert await is_duplicate(fake_redis, text="Во сколько заезд?", **kw) is False
    assert await is_duplicate(fake_redis, text="Во сколько заезд?", **kw) is True
    # Пробелы по краям не делают сообщение другим: канал их иногда добавляет.
    assert await is_duplicate(fake_redis, text="  Во сколько заезд? ", **kw) is True


async def test_other_text_or_other_client_is_not_duplicate(fake_redis) -> None:
    await is_duplicate(fake_redis, channel="telegram", external_id="42", text="Привет", ttl_seconds=60)
    assert (
        await is_duplicate(fake_redis, channel="telegram", external_id="42", text="Привет!", ttl_seconds=60)
        is False
    )
    assert (
        await is_duplicate(fake_redis, channel="telegram", external_id="43", text="Привет", ttl_seconds=60)
        is False
    )


async def test_key_layout(fake_redis) -> None:
    await is_duplicate(fake_redis, channel="widget", external_id="7", text="x", ttl_seconds=60)
    keys = [k.decode() for k in await fake_redis.keys("dedup:*")]
    assert len(keys) == 1
    assert keys[0].startswith("dedup:widget:7:")
    assert await fake_redis.ttl(keys[0]) > 0
