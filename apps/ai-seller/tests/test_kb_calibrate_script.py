"""Скрипт калибровки читает базу и ничего не пишет; вывод без текстов записей (S3)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import sqlalchemy as sa

from src.db.models import SupportKnowledge, SupportKnowledgeUsage
from src.knowledge import support_kb as kb

ROOT = Path(__file__).resolve().parent.parent
SECRET_TEXT = "СЕКРЕТНЫЙ-ТЕКСТ-ЗАПИСИ-НЕ-ДОЛЖЕН-ПОПАСТЬ-В-ВЫВОД стирка загрузка машины пятьсот тенге"


def load_script():
    spec = importlib.util.spec_from_file_location("kb_calibrate", ROOT / "scripts" / "kb_calibrate.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["kb_calibrate"] = module
    spec.loader.exec_module(module)
    return module


async def test_script_is_read_only_and_prints_titles_not_bodies(db_session, fake_embedder, tmp_path, capsys, monkeypatch) -> None:
    entry = await kb.create_entry(
        db_session, title="Стирка", category="HOW_TO", visibility="PUBLIC_SUPPORT", content=SECRET_TEXT, by="a"
    )
    await kb.publish(db_session, fake_embedder, entry.id, approved_by="a")
    await db_session.commit()

    csv_file = tmp_path / "eval.csv"
    csv_file.write_text("question;expected\nстирка загрузка машины;Стирка\nкосмос звёзды галактика;\n", encoding="utf-8")

    script = load_script()
    # сессия и эмбеддер — те же, что в тесте (у скрипта свои через dependencies; подменяем на тестовые)
    class Maker:
        def __call__(self):
            class Ctx:
                async def __aenter__(self_inner):
                    return db_session

                async def __aexit__(self_inner, *a):
                    return False

            return Ctx()

    monkeypatch.setattr(script, "get_sessionmaker", lambda: Maker())
    monkeypatch.setattr(script, "get_embedder", lambda: fake_embedder)
    code = await script.run(csv_file)
    out = capsys.readouterr().out

    assert code == 0
    assert "Стирка" in out and "SUPPORT_KB_HIGH=" in out and "SUPPORT_KB_MEDIUM=" in out
    assert "СЕКРЕТНЫЙ-ТЕКСТ" not in out
    # только чтение: журнал использования и записи не изменились
    usage = (await db_session.execute(sa.select(sa.func.count()).select_from(SupportKnowledgeUsage))).scalar_one()
    versions = (await db_session.execute(sa.select(SupportKnowledge.version))).scalars().all()
    assert usage == 0 and versions == [1]


def test_bad_arguments_exit_codes(tmp_path, capsys) -> None:
    script = load_script()
    assert script.main(["kb_calibrate.py"]) == 2
    assert script.main(["kb_calibrate.py", str(tmp_path / "нет.csv")]) == 2
    bad = tmp_path / "bad.csv"
    bad.write_text("", encoding="utf-8")
    assert script.main(["kb_calibrate.py", str(bad)]) == 1
