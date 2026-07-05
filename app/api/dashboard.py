from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.queue import Queue
from app.models.job import Job
from app.models.worker import Worker
from app.models.workflow import Workflow

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get("/stats")
def dashboard_stats(period: str | None = None, db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    workers = db.query(Worker).order_by(Worker.created_at.asc()).all()
    queues = db.query(Queue).order_by(Queue.created_at.asc()).all()

    job_status_counts = {
        'READY': 0,
        'WAITING': 0,
        'RUNNING': 0,
        'COMPLETED': 0,
        'FAILED': 0,
        'DEAD': 0,
        'CANCELLED': 0,
    }

    for job in jobs:
        current_status = (job.status or '').upper()
        if current_status in job_status_counts:
            job_status_counts[current_status] += 1

    worker_status_counts = {}
    for worker in workers:
        worker_status_counts[worker.status] = worker_status_counts.get(worker.status, 0) + 1

    return {
        'total_jobs': len(jobs),
        'pending_jobs': job_status_counts['READY'] + job_status_counts['WAITING'],
        'running_jobs': job_status_counts['RUNNING'],
        'completed_jobs': job_status_counts['COMPLETED'],
        'failed_jobs': job_status_counts['FAILED'] + job_status_counts['DEAD'],
        'cancelled_jobs': job_status_counts['CANCELLED'],
        'workers_online': worker_status_counts.get('ONLINE', 0),
        'active_queues': sum(1 for queue in queues if queue.status == 'ACTIVE'),
        'jobs_trend': 0,
        'completed_trend': 0,
        'failed_trend': 0,
        'jobs': job_status_counts,
        'workers': [
            {
                'id': worker.id,
                'name': worker.name,
                'status': (worker.status or '').lower(),
                'last_heartbeat': worker.last_heartbeat,
                'utilization': 0,
            }
            for worker in workers
        ],
        'queues': [
            {
                'id': queue.id,
                'name': queue.name,
                'status': (queue.status or '').lower(),
                'priority': queue.priority,
                'throughput': sum(1 for job in queue.jobs or [] if job.status == 'COMPLETED'),
                'active_jobs': sum(1 for job in queue.jobs or [] if job.status == 'RUNNING'),
                'waiting_jobs': sum(1 for job in queue.jobs or [] if job.status in {'READY', 'WAITING'}),
                'completed_jobs': sum(1 for job in queue.jobs or [] if job.status == 'COMPLETED'),
                'failed_jobs': sum(1 for job in queue.jobs or [] if job.status in {'FAILED', 'DEAD'}),
                'workers': len({job.worker_id for job in queue.jobs or [] if job.worker_id is not None}),
                'avg_time': 'N/A',
            }
            for queue in queues
        ],
        'workflows': db.query(func.count(Workflow.id)).scalar(),
    }


@router.get("/workers")
def worker_dashboard(db: Session = Depends(get_db)):
    workers = db.query(Worker).order_by(Worker.created_at.asc()).all()

    return [
        {
            "id": worker.id,
            "name": worker.name,
            "status": worker.status,
            "last_heartbeat": worker.last_heartbeat,
        }
        for worker in workers
    ]


@router.get("/jobs")
def job_dashboard(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()

    return [
        {
            "id": job.id,
            "name": job.name,
            "status": job.status,
            "retry_count": job.retry_count,
            "max_retries": job.max_retries,
            "worker_id": job.worker_id,
        }
        for job in jobs
    ]


@router.get("/dlq")
def dead_letter_queue(db: Session = Depends(get_db)):
    jobs = db.query(Job).filter(Job.status == "DEAD").order_by(Job.created_at.desc()).all()

    return [
        {
            "id": job.id,
            "name": job.name,
            "retry_count": job.retry_count,
            "max_retries": job.max_retries,
        }
        for job in jobs
    ]