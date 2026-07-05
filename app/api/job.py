import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.workflow import Workflow
from app.models.job import Job
from app.schemas.job import JobCreate

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def _get_or_create_default_workflow(db: Session):
    workflow = db.query(Workflow).order_by(Workflow.created_at.asc()).first()
    if workflow is not None:
        return workflow

    workflow = Workflow(
        id=uuid.uuid4(),
        name="Default Workflow",
        status="CREATED",
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


def _serialize_job(job: Job):
    status = (job.status or '').upper()
    normalized_status = {
        'READY': 'pending',
        'WAITING': 'pending',
        'RUNNING': 'running',
        'COMPLETED': 'completed',
        'FAILED': 'failed',
        'DEAD': 'failed',
        'CANCELLED': 'cancelled',
    }.get(status, status.lower() if status else 'pending')

    progress = {
        'pending': 0,
        'running': 50,
        'completed': 100,
        'failed': 0,
        'cancelled': 0,
    }.get(normalized_status, 0)

    return {
        'id': job.id,
        'name': job.name,
        'status': normalized_status,
        'priority': job.priority,
        'queue_id': job.queue_id,
        'queue_name': job.queue.name if job.queue else None,
        'worker_id': job.worker_id,
        'worker': job.worker.name if job.worker else None,
        'progress': progress,
        'created_at': job.created_at,
        'started_at': job.started_at,
        'completed_at': job.completed_at,
        'attempts': job.retry_count,
        'max_retries': job.max_retries,
        'job_type': job.job_type,
        'payload': {},
        'error': None,
    }


@router.get("/")
def list_jobs(limit: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Job).order_by(Job.created_at.desc())
    if limit is not None:
        query = query.limit(limit)
    return [_serialize_job(job) for job in query.all()]


@router.get("/stats")
def job_stats(db: Session = Depends(get_db)):
    jobs = db.query(Job).all()
    pending = sum(1 for job in jobs if (job.status or '').upper() in {'READY', 'WAITING'})
    running = sum(1 for job in jobs if (job.status or '').upper() == 'RUNNING')
    completed = sum(1 for job in jobs if (job.status or '').upper() == 'COMPLETED')
    failed = sum(1 for job in jobs if (job.status or '').upper() in {'FAILED', 'DEAD'})
    cancelled = sum(1 for job in jobs if (job.status or '').upper() == 'CANCELLED')

    return {
        'total': len(jobs),
        'pending': pending,
        'running': running,
        'completed': completed,
        'failed': failed,
        'cancelled': cancelled,
    }


@router.get("/{job_id}")
def get_job(job_id: UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _serialize_job(job)


@router.post("/")
def create_job(
    job: JobCreate,
    db: Session = Depends(get_db),
):

    workflow = db.query(Workflow).filter(Workflow.id == job.workflow_id).first() if job.workflow_id else _get_or_create_default_workflow(db)

    new_job = Job(
        id=uuid.uuid4(),
        workflow_id=workflow.id,
        queue_id=job.queue_id,
        name=job.name,
        job_type=job.job_type or 'default',
        priority=job.priority,
        status='READY',
        retry_count=0,
        max_retries=3,
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return {
        "message": "Job created successfully",
        "job_id": new_job.id,
    }


@router.post("/{job_id}/retry")
def retry_job(job_id: UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = 'READY'
    job.worker_id = None
    db.commit()
    db.refresh(job)
    return _serialize_job(job)


@router.post("/{job_id}/cancel")
def cancel_job(job_id: UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = 'CANCELLED'
    job.worker_id = None
    db.commit()
    db.refresh(job)
    return _serialize_job(job)


@router.delete("/{job_id}")
def delete_job(job_id: UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    db.delete(job)
    db.commit()
    return {"message": "Job deleted successfully"}