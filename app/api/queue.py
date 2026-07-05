import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.job import Job
from app.models.workflow import Workflow
from app.models.queue import Queue
from app.schemas.queue import QueueCreate

router = APIRouter(prefix="/queues", tags=["Queues"])


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


def _serialize_queue(queue: Queue):
    queue_jobs = queue.jobs or []
    status = (queue.status or '').lower()
    return {
        'id': queue.id,
        'name': queue.name,
        'priority': queue.priority,
        'concurrency': queue.concurrency,
        'status': status,
        'workflow_id': queue.workflow_id,
        'active_jobs': sum(1 for job in queue_jobs if job.status == 'RUNNING'),
        'waiting_jobs': sum(1 for job in queue_jobs if job.status in {'READY', 'WAITING'}),
        'completed_jobs': sum(1 for job in queue_jobs if job.status == 'COMPLETED'),
        'failed_jobs': sum(1 for job in queue_jobs if job.status in {'FAILED', 'DEAD'}),
        'workers': len({job.worker_id for job in queue_jobs if job.worker_id is not None}),
        'avg_time': 'N/A',
    }


@router.get("/")
def list_queues(db: Session = Depends(get_db)):
    queues = db.query(Queue).order_by(Queue.created_at.asc()).all()
    return [_serialize_queue(queue) for queue in queues]


@router.get("/stats")
def queue_stats(db: Session = Depends(get_db)):
    queues = db.query(Queue).all()
    jobs = db.query(Job).all()

    return {
        'total': len(queues),
        'pending_jobs': sum(1 for job in jobs if (job.status or '').upper() in {'READY', 'WAITING'}),
        'active_jobs': sum(1 for job in jobs if (job.status or '').upper() == 'RUNNING'),
        'completed_today': sum(1 for job in jobs if (job.status or '').upper() == 'COMPLETED'),
    }


@router.get("/{queue_id}")
def get_queue(queue_id: UUID, db: Session = Depends(get_db)):
    queue = db.query(Queue).filter(Queue.id == queue_id).first()
    if queue is None:
        raise HTTPException(status_code=404, detail="Queue not found")
    return _serialize_queue(queue)


@router.post("/")
def create_queue(
    queue: QueueCreate,
    db: Session = Depends(get_db),
):

    workflow = db.query(Workflow).filter(Workflow.id == queue.workflow_id).first() if queue.workflow_id else _get_or_create_default_workflow(db)

    new_queue = Queue(
        id=uuid.uuid4(),
        workflow_id=workflow.id,
        name=queue.name,
        priority=queue.priority,
        concurrency=queue.concurrency,
        status='ACTIVE',
    )

    db.add(new_queue)
    db.commit()
    db.refresh(new_queue)

    return {
        "message": "Queue created successfully",
        "queue_id": new_queue.id,
    }


@router.put("/{queue_id}")
def update_queue(queue_id: UUID, queue: QueueCreate, db: Session = Depends(get_db)):
    existing_queue = db.query(Queue).filter(Queue.id == queue_id).first()
    if existing_queue is None:
        raise HTTPException(status_code=404, detail="Queue not found")

    existing_queue.name = queue.name
    existing_queue.priority = queue.priority
    existing_queue.concurrency = queue.concurrency
    if queue.workflow_id:
        existing_queue.workflow_id = queue.workflow_id

    db.commit()
    db.refresh(existing_queue)
    return _serialize_queue(existing_queue)


@router.post("/{queue_id}/{action}")
def toggle_queue_state(queue_id: UUID, action: str, db: Session = Depends(get_db)):
    queue = db.query(Queue).filter(Queue.id == queue_id).first()
    if queue is None:
        raise HTTPException(status_code=404, detail="Queue not found")

    if action == 'pause':
        queue.status = 'PAUSED'
    elif action == 'resume':
        queue.status = 'ACTIVE'
    elif action == 'purge':
        jobs = db.query(Job).filter(Job.queue_id == queue.id, Job.status.in_(['READY', 'WAITING'])).all()
        for job in jobs:
            db.delete(job)
    else:
        raise HTTPException(status_code=400, detail='Unsupported queue action')

    db.commit()
    db.refresh(queue)
    return _serialize_queue(queue)


@router.delete("/{queue_id}")
def delete_queue(queue_id: UUID, db: Session = Depends(get_db)):
    queue = db.query(Queue).filter(Queue.id == queue_id).first()
    if queue is None:
        raise HTTPException(status_code=404, detail="Queue not found")

    db.delete(queue)
    db.commit()
    return {"message": "Queue deleted successfully"}