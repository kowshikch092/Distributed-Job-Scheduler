import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database.base import Base


class JobDependency(Base):
    __tablename__ = "job_dependencies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    parent_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    child_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    parent_job = relationship(
        "Job",
        foreign_keys=[parent_job_id],
    )

    child_job = relationship(
        "Job",
        foreign_keys=[child_job_id],
    )