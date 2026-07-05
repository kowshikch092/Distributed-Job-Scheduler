import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database.base import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    workflow_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
    )

    queue_id = Column(
        UUID(as_uuid=True),
        ForeignKey("queues.id", ondelete="CASCADE"),
        nullable=False,
    )

    worker_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workers.id", ondelete="SET NULL"),
        nullable=True,
    )

    name = Column(String(100), nullable=False)

    job_type = Column(String(50), nullable=False)

    priority = Column(Integer, default=5)

    status = Column(String(30), default="WAITING")

    retry_count = Column(Integer, default=0)

    max_retries = Column(Integer, default=3)

    created_at = Column(DateTime, default=datetime.utcnow)

    started_at = Column(DateTime, nullable=True)

    completed_at = Column(DateTime, nullable=True)

    workflow = relationship(
        "Workflow",
        back_populates="jobs",
    )

    queue = relationship(
        "Queue",
        back_populates="jobs",
    )

    worker = relationship(
        "Worker",
        back_populates="jobs",
    )

    executions = relationship(
        "JobExecution",
        back_populates="job",
        cascade="all, delete-orphan",
    )