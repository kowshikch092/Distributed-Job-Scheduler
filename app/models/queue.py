import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database.base import Base


class Queue(Base):
    __tablename__ = "queues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    workflow_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String(100), nullable=False)

    priority = Column(Integer, default=5)

    concurrency = Column(Integer, default=3)

    status = Column(String(30), default="ACTIVE")

    created_at = Column(DateTime, default=datetime.utcnow)

    workflow = relationship(
        "Workflow",
        back_populates="queues",
    )

    jobs = relationship(
        "Job",
        back_populates="queue",
        cascade="all, delete-orphan",
    )