from datetime import datetime
from sqlalchemy.orm import Session

from app.repositories.job_execution_repository import JobExecutionRepository
from app.models.job import Job
from app.models.worker import Worker


class JobExecutionService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = JobExecutionRepository(db)

    def start_execution(self, job: Job, worker: Worker):
        return self.repository.create_execution(job, worker, status="RUNNING")

    def complete_execution(self, execution, exit_code: int | None = 0, error_message: str | None = None):
        completed_at = datetime.utcnow()
        status = "COMPLETED" if error_message is None else "FAILED"
        return self.repository.update_execution(
            execution,
            status=status,
            completed_at=completed_at,
            exit_code=exit_code,
            error_message=error_message,
        )
