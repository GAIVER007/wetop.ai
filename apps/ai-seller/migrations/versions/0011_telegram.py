"""Telegram test channel. Production: apply only AFTER separately approved 0010.

Adds tables only; rollback requires export of new connection/event data first.
"""
import sqlalchemy as sa
from alembic import op
revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    uuid = sa.Uuid(as_uuid=True)
    tz = sa.DateTime(timezone=True)
    op.create_table('telegram_connections',
        sa.Column('agent_id', uuid, sa.ForeignKey('agents.id'), primary_key=True),
        sa.Column('bot_id', sa.Text, nullable=False, unique=True),
        sa.Column('bot_username', sa.Text, nullable=False),
        sa.Column('token_encrypted', sa.LargeBinary, nullable=False),
        sa.Column('webhook_secret_encrypted', sa.LargeBinary, nullable=False),
        sa.Column('allowed_user_ids', sa.JSON, nullable=False),
        sa.Column('enabled', sa.Boolean, nullable=False),
        sa.Column('connection_state', sa.Text, nullable=False),
        sa.Column('last_error_code', sa.Text),
        sa.Column('last_received_at', tz), sa.Column('last_sent_at', tz),
        sa.Column('updated_at', tz, nullable=False),
        sa.CheckConstraint("connection_state IN ('CONFIGURED','CONNECTING','CONNECTED','ERROR')", name='ck_telegram_connection_state'))
    op.create_table('telegram_inbound_events',
        sa.Column('id', uuid, primary_key=True),
        sa.Column('agent_id', uuid, sa.ForeignKey('agents.id'), nullable=False),
        sa.Column('update_id', sa.Text, nullable=False),
        sa.Column('received_at', tz, nullable=False),
        sa.Column('state', sa.Text, nullable=False),
        sa.Column('attempts', sa.Integer, nullable=False),
        sa.Column('next_retry_at', tz), sa.Column('error_code', sa.Text),
        sa.Column('payload_encrypted', sa.LargeBinary, nullable=False),
        sa.UniqueConstraint('agent_id', 'update_id', name='uq_telegram_agent_update'),
        sa.CheckConstraint("state IN ('RECEIVED','PROCESSING','DONE','FAILED')", name='ck_telegram_event_state'))
    op.create_index('idx_telegram_event_retry', 'telegram_inbound_events', ['state', 'next_retry_at'])


def downgrade():
    op.drop_table('telegram_inbound_events')
    op.drop_table('telegram_connections')
