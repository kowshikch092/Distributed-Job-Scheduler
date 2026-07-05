from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.repositories.worker_repository import WorkerRepository
from app.schemas.worker import WorkerHeartbeat
from app.services.worker_service import WorkerService

router = APIRouter(
    prefix="/workers",
    tags=["Workers"],
)


def _serialize_worker(worker):
    return {
        'id': worker.id,
        'name': worker.name,
        'status': (worker.status or '').lower(),
        'last_heartbeat': worker.last_heartbeat,
        'cpu_usage': 0,
        'memory_usage': 0,
        'current_job': None,
        'queue': None,
        'jobs_completed': 0,
        'uptime': 'N/A',
        'host': None,
        'pid': None,
        'version': None,
        'cpu_history': [0, 0, 0, 0, 0],
    }


@router.post("/heartbeat")
def heartbeat(
    data: WorkerHeartbeat,
    db: Session = Depends(get_db),
):
    service = WorkerService(db)
    worker = service.heartbeat(data.worker_id)

    return {
        "message": "Heartbeat received",
        "worker_id": worker.id,
        "status": worker.status,
    }


@router.get("/")
def list_workers(db: Session = Depends(get_db)):
    repo = WorkerRepository(db)
    workers = repo.get_all()

    return [_serialize_worker(worker) for worker in workers]


@router.get("/{worker_id}")
def get_worker(worker_id: str, db: Session = Depends(get_db)):
    repo = WorkerRepository(db)
    worker = repo.get_by_id(worker_id)
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")
    return _serialize_worker(worker)


@router.post("/{worker_id}/start")
def start_worker(worker_id: str, db: Session = Depends(get_db)):
    repo = WorkerRepository(db)
    worker = repo.get_by_id(worker_id)
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker.status = 'ONLINE'
    worker.last_heartbeat = datetime.utcnow()
    db.commit()
    db.refresh(worker)
    return _serialize_worker(worker)


@router.post("/{worker_id}/stop")
def stop_worker(worker_id: str, db: Session = Depends(get_db)):
    repo = WorkerRepository(db)
    worker = repo.get_by_id(worker_id)
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker.status = 'OFFLINE'
    db.commit()
    db.refresh(worker)
    return _serialize_worker(worker)


@router.post("/{worker_id}/restart")
def restart_worker(worker_id: str, db: Session = Depends(get_db)):
    repo = WorkerRepository(db)
    worker = repo.get_by_id(worker_id)
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker.status = 'ONLINE'
    worker.last_heartbeat = datetime.utcnow()
    db.commit()
    db.refresh(worker)
    return _serialize_worker(worker)


@router.post("/start-all")
def start_all_workers(db: Session = Depends(get_db)):
    workers = WorkerRepository(db).get_all()
    for worker in workers:
        worker.status = 'ONLINE'
        worker.last_heartbeat = datetime.utcnow()
    db.commit()
    return [_serialize_worker(worker) for worker in workers]


@router.post("/stop-all")
def stop_all_workers(db: Session = Depends(get_db)):
    workers = WorkerRepository(db).get_all()
    for worker in workers:
        worker.status = 'OFFLINE'
    db.commit()
    return [_serialize_worker(worker) for worker in workers]