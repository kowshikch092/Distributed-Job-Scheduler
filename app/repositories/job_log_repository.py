from sqlalchemy.orm import Session

from app.models.job_log import JobLog


class JobLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_log(
        self,
        job_id,
        status,
        message=None,
        retry_attempts=0,
        started_at=None,
        failed_at=None,
    ):
        log = JobLog(
            job_id=job_id,
            status=status,
            message=message,
            retry_attempts=retry_attempts,
            started_at=started_at,
            failed_at=failed_at,
        )

        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log