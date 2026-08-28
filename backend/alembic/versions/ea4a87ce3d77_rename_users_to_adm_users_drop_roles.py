"""rename users to adm_users, drop roles

Revision ID: ea4a87ce3d77
Revises: 61e7310baeb1
Create Date: 2026-08-28 15:40:43.543194

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea4a87ce3d77'
down_revision: Union[str, Sequence[str], None] = '61e7310baeb1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'adm_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('email_verified_at', sa.DateTime(), nullable=True),
        sa.Column('password', sa.String(length=255), nullable=True),
        sa.Column('id_adm_privileges', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('last_password_updated', sa.Date(), nullable=True),
        sa.Column('waiver_count', sa.Integer(), nullable=True),
        sa.Column('theme', sa.String(length=199), nullable=True),
        sa.Column('remember_token', sa.String(length=100), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_adm_users_id'), 'adm_users', ['id'], unique=False)
    op.create_index(op.f('ix_adm_users_email'), 'adm_users', ['email'], unique=True)

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_roles_id'), table_name='roles')
    op.drop_index(op.f('ix_roles_name'), table_name='roles')
    op.drop_table('roles')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table('roles',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_roles_name'), 'roles', ['name'], unique=1)
    op.create_index(op.f('ix_roles_id'), 'roles', ['id'], unique=False)
    op.create_table('users',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('email', sa.VARCHAR(), nullable=True),
    sa.Column('hashed_password', sa.VARCHAR(), nullable=True),
    sa.Column('role_id', sa.INTEGER(), nullable=True),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=1)

    op.drop_index(op.f('ix_adm_users_email'), table_name='adm_users')
    op.drop_index(op.f('ix_adm_users_id'), table_name='adm_users')
    op.drop_table('adm_users')
