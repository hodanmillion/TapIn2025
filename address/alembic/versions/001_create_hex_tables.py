"""Create hex tables

Revision ID: 001
Revises: 
Create Date: 2025-07-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create PostGIS extension
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    
    # Create hex_cells table
    op.create_table('hex_cells',
        sa.Column('h3_index', sa.String(20), primary_key=True),
        sa.Column('resolution', sa.Integer, nullable=False),
        sa.Column('center_lat', sa.Float, nullable=False),
        sa.Column('center_lng', sa.Float, nullable=False),
        sa.Column('display_name', sa.String(255)),
        sa.Column('locality', sa.String(255)),
        sa.Column('active_users', sa.Integer, default=0),
        sa.Column('created_at', sa.TIMESTAMP, server_default=sa.func.current_timestamp()),
        sa.Column('updated_at', sa.TIMESTAMP, server_default=sa.func.current_timestamp())
    )
    
    # Create user_hex_locations table
    op.create_table('user_hex_locations',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(255), nullable=False),
        sa.Column('h3_index', sa.String(20), sa.ForeignKey('hex_cells.h3_index'), nullable=False),
        sa.Column('joined_at', sa.TIMESTAMP, server_default=sa.func.current_timestamp()),
        sa.Column('last_active', sa.TIMESTAMP, server_default=sa.func.current_timestamp()),
        sa.UniqueConstraint('user_id', 'h3_index')
    )
    
    # Create hex_landmarks table
    op.create_table('hex_landmarks',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('h3_index', sa.String(20), sa.ForeignKey('hex_cells.h3_index'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(100)),
        sa.Column('description', sa.Text),
        sa.Column('lat', sa.Float, nullable=False),
        sa.Column('lng', sa.Float, nullable=False),
        sa.Column('created_at', sa.TIMESTAMP, server_default=sa.func.current_timestamp())
    )
    
    # Create indexes
    op.create_index('idx_hex_cells_resolution', 'hex_cells', ['resolution'])
    op.create_index('idx_user_hex_locations_user_id', 'user_hex_locations', ['user_id'])
    op.create_index('idx_user_hex_locations_h3_index', 'user_hex_locations', ['h3_index'])
    op.create_index('idx_hex_landmarks_h3_index', 'hex_landmarks', ['h3_index'])


def downgrade():
    op.drop_index('idx_hex_landmarks_h3_index')
    op.drop_index('idx_user_hex_locations_h3_index')
    op.drop_index('idx_user_hex_locations_user_id')
    op.drop_index('idx_hex_cells_resolution')
    op.drop_table('hex_landmarks')
    op.drop_table('user_hex_locations')
    op.drop_table('hex_cells')