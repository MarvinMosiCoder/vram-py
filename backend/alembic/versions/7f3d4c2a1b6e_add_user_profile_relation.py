"""Add the user foreign key to profile history.

Revision ID: 7f3d4c2a1b6e
Revises: c4af3bd01771
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f3d4c2a1b6e"
down_revision: Union[str, Sequence[str], None] = "c4af3bd01771"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "adm_user_profiles",
        "adm_user_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_foreign_key(
        "fk_adm_user_profiles_adm_user_id",
        "adm_user_profiles",
        "adm_users",
        ["adm_user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_adm_user_profiles_adm_user_id",
        "adm_user_profiles",
        type_="foreignkey",
    )
    op.alter_column(
        "adm_user_profiles",
        "adm_user_id",
        existing_type=sa.Integer(),
        nullable=True,
    )