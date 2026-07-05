from datetime import datetime
from sqlalchemy.orm import Session

from app.models.job_execution import JobExecution
from app.models.job import Job
from app.models.worker import Worker


class JobExecutionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_execution(self, job: Job, worker: Worker, status: str):
        execution = JobExecution(
            job_id=job.id,
            worker_id=worker.id if worker else None,
            status=status,
            started_at=datetime.utcnow(),
        )
        self.db.add(execution)
        self.db.commit()
        self.db.refresh(execution)
        return execution

    def update_execution(self, execution: JobExecution, status: str, completed_at: datetime, exit_code: int | None = None, error_message: str | None = None):
        execution.status = status
        execution.completed_at = completed_at
        execution.duration_seconds = int((completed_at - execution.started_at).total_seconds())
        execution.exit_code = exit_code
        execution.error_message = error_message
        self.db.commit()
        self.db.refresh(execution)
        return execution

    def get_by_job(self, job_id):
        return (
            self.db.query(JobExecution)
            .filter(JobExecution.job_id == job_id)
            .order_by(JobExecution.started_at.desc())
            .first()
        )
