"""Per-agent Telegram storage and update deduplication; synthetic data only."""
import uuid
import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from src.db.models import TelegramConnection, TelegramInboundEvent
from src.db.base import utcnow
from tests.dashboard_fakes import seed_org, sync_db
from tests.test_whatsapp import ORG


def test_connection_and_event_are_agent_scoped(sync_db):
    seed_org(sync_db, ORG)
    agent = uuid.UUID(ORG)
    with sync_db() as session:
        session.add(TelegramConnection(agent_id=agent, bot_id='123456789', bot_username='test_bot',
            token_encrypted=b'encrypted', webhook_secret_encrypted=b'encrypted',
            allowed_user_ids=['1234'], enabled=False, connection_state='CONFIGURED', updated_at=utcnow()))
        session.commit()
        for _ in range(2):
            session.add(TelegramInboundEvent(id=uuid.uuid4(), agent_id=agent, update_id='42',
                received_at=utcnow(), state='RECEIVED', attempts=0, payload_encrypted=b'encrypted'))
            if _ == 0:
                session.commit()
            else:
                with pytest.raises(IntegrityError):
                    session.commit()
                session.rollback()
        assert session.scalar(sa.select(sa.func.count()).select_from(TelegramInboundEvent)) == 1
