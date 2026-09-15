"""rename adm_password_history.updated_by to created_at

Revision ID: 219810c6de37
Revises: d8b4e4d86505
Create Date: 2026-09-15 14:25:40.552300

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '219810c6de37'
down_revision: Union[str, Sequence[str], None] = 'd8b4e4d86505'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("adm_password_history", schema=None) as batch_op:
        batch_op.alter_column("updated_by", new_column_name="created_at")

    with op.batch_alter_table("adm_password_history", schema=None) as batch_op:
        batch_op.alter_column(
            "created_at",
            existing_type=sa.Integer(),
            type_=sa.DateTime(),
            existing_nullable=True,
            postgresql_using="NULL::timestamp",
        )


def downgrade() -> None:
    with op.batch_alter_table("adm_password_history", schema=None) as batch_op:
        batch_op.alter_column(
            "created_at",
            existing_type=sa.DateTime(),
            type_=sa.Integer(),
            existing_nullable=True,
            postgresql_using="NULL::integer",
        )

    with op.batch_alter_table("adm_password_history", schema=None) as batch_op:
        batch_op.alter_column("created_at", new_column_name="updated_by")

