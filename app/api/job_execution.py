from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.job_execution import JobExecution
from app.schemas.job_execution import JobExecutionRead

router = APIRouter(
    prefix="/executions",
    tags=["Executions"],
)


@router.get("/", response_model=list[JobExecutionRead])
def list_executions(limit: int | None = None, db: Session = Depends(get_db)):
    query = db.query(JobExecution).order_by(JobExecution.started_at.desc())
    if limit is not None:
        query = query.limit(limit)
    return query.all()


@router.get("/{execution_id}", response_model=JobExecutionRead)
def get_execution(execution_id: str, db: Session = Depends(get_db)):
    execution = db.query(JobExecution).filter(JobExecution.id == execution_id).first()
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution
