import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database.base import Base


class Worker(Base):
    __tablename__ = "workers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name = Column(String(100), nullable=False)

    status = Column(String(20), default="ONLINE")

    created_at = Column(DateTime, default=datetime.utcnow)

    last_heartbeat = Column(DateTime, default=datetime.utcnow)

    jobs = relationship(
        "Job",
        back_populates="worker",
    )

    executions = relationship(
        "JobExecution",
        back_populates="worker",
        cascade="all, delete-orphan",
    )