"""Ведение диалога человеком (S2.6): ответственный, следующий шаг, внутренние заметки.

Только добавляет: три необязательные колонки у conversations и таблицу conversation_notes.
Откат удаляет заметки: перед ним их выгрузить.

🔴 Ветка от 0009, а не продолжение 0011: 0010 (сужение ключей) и 0011 (Telegram) выкладываются отдельно и вручную, а образу
с этими колонками нужна 0012 уже при первом запуске. Поэтому у цепочки две головы (0011 и 0012), и применяется эта
миграция явно: `alembic upgrade 0012` (точка входа делает это сама, `scripts/docker-entrypoint.sh`).
"""
import sqlalchemy as sa
from alembic import op

revision = '0012'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    uuid = sa.Uuid(as_uuid=True)
    tz = sa.DateTime(timezone=True)
    op.add_column('conversations', sa.Column('assignee_user_id', uuid))
    op.add_column('conversations', sa.Column('assignee_name', sa.String(120)))
    op.add_column('conversations', sa.Column('next_step', sa.String(200)))
    op.create_table('conversation_notes',
        sa.Column('id', uuid, primary_key=True),
        sa.Column('conversation_id', uuid, sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_user_id', uuid),
        sa.Column('author_name', sa.String(120), nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('created_at', tz, nullable=False))
    op.create_index('idx_conv_note', 'conversation_notes', ['conversation_id', 'created_at'])


def downgrade():
    op.drop_index('idx_conv_note', table_name='conversation_notes')
    op.drop_table('conversation_notes')
    op.drop_column('conversations', 'next_step')
    op.drop_column('conversations', 'assignee_name')
    op.drop_column('conversations', 'assignee_user_id')
