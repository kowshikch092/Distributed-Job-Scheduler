import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.database.base import Base


class JobLog(Base):
    __tablename__ = "job_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    status = Column(String(30), nullable=False)

    message = Column(String, nullable=True)

    retry_attempts = Column(Integer, default=0)

    started_at = Column(DateTime, nullable=True)

    failed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)