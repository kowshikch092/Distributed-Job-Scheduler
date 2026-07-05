from datetime import datetime, timedelta

import time

from app.repositories.job_repository import JobRepository
from app.repositories.job_dependency_repository import JobDependencyRepository
from app.repositories.job_log_repository import JobLogRepository
from app.repositories.worker_repository import WorkerRepository
from app.services.job_execution_service import JobExecutionService
from app.services.notification_service import NotificationService
from app.services.worker_service import WorkerService


class SchedulerService:

    def __init__(self, db):
        self.db = db
        self.job_repository = JobRepository(db)
        self.dependency_repository = JobDependencyRepository(db)
        self.worker_repository = WorkerRepository(db)
        self.job_log_repository = JobLogRepository(db)
        self.job_execution_service = JobExecutionService(db)
        self.notification_service = NotificationService()
        self.worker_service = WorkerService()
        self.last_worker_check = datetime.utcnow()
        self.default_worker = self.worker_repository.ensure_default_worker()

    def handle_dead_workers(self):
        dead_workers = self.worker_repository.mark_dead_workers()

        if not dead_workers:
            return

        dead_worker_ids = [worker.id for worker in dead_workers]
        requeued_jobs = self.job_repository.requeue_jobs_from_workers(dead_worker_ids)

        for job in requeued_jobs:
            self.job_log_repository.create_log(
                job.id,
                "RETRY",
                f"Worker timeout; retry {job.retry_count}",
                retry_attempts=job.retry_count,
            )

        print(f"⚠️ Marked {len(dead_workers)} worker(s) DEAD and requeued {len(requeued_jobs)} job(s)")

    def start(self):
        print("🚀 Scheduler Started...")

        while True:
            self.worker_repository.update_heartbeat(self.default_worker)

            if datetime.utcnow() - self.last_worker_check >= timedelta(seconds=10):
                self.handle_dead_workers()
                self.last_worker_check = datetime.utcnow()

            # Step 1: Get all READY jobs
            ready_jobs = self.job_repository.get_ready_jobs()

            if not ready_jobs:
                print("No READY jobs found...")
                time.sleep(5)
                continue

            # Step 2: Process every READY job
            for job in ready_jobs:

                print(f"\nChecking Job: {job.name}")

                # Step 3: Check whether all dependencies are completed
                if not self.dependency_repository.dependencies_completed(job.id):
                    print(f"Waiting for dependencies: {job.name}")
                    continue

                assigned_worker = self.worker_repository.get_available_worker() or self.default_worker
                if assigned_worker is None:
                    print(f"No available worker found for {job.name}")
                    continue

                # Step 4: Mark job as RUNNING
                job.started_at = datetime.utcnow()
                self.job_repository.update_status(job, "RUNNING")
                self.job_repository.assign_worker(job, assigned_worker)
                self.job_log_repository.create_log(
                    job.id,
                    "STARTED",
                    "Job execution started",
                    retry_attempts=job.retry_count,
                )
                execution = self.job_execution_service.start_execution(job, assigned_worker)
                print(f"{job.name} → RUNNING")

                # Step 5: Execute the job
                try:
                    self.worker_service.execute(job)
                    job.completed_at = datetime.utcnow()
                    self.job_repository.update_status(job, "COMPLETED")
                    self.job_repository.clear_worker(job)
                    self.job_log_repository.create_log(
                        job.id,
                        "COMPLETED",
                        "Job completed successfully",
                        retry_attempts=job.retry_count,
                    )
                    self.job_execution_service.complete_execution(
                        execution,
                        exit_code=0,
                    )
                    self.job_repository.mark_child_jobs_ready(job.id)
                    print(f"✅ {job.name} COMPLETED")
                except Exception as e:
                    print(f"❌ {job.name} FAILED")
                    self.notification_service.send_webhook(
                        f"Job failed: {job.name}",
                        str(e),
                    )
                    self.notification_service.send_email(
                        f"Job failed: {job.name}",
                        str(e),
                    )
                    self.job_log_repository.create_log(
                        job.id,
                        "FAILED",
                        str(e),
                        retry_attempts=job.retry_count,
                    )
                    self.job_execution_service.complete_execution(
                        execution,
                        exit_code=1,
                        error_message=str(e),
                    )
                    self.job_repository.increment_retry(job)

                    if job.retry_count < job.max_retries:
                        self.job_repository.update_status(job, "READY")
                        self.job_repository.clear_worker(job)
                        self.job_log_repository.create_log(
                            job.id,
                            "RETRY",
                            f"Retry {job.retry_count}",
                            retry_attempts=job.retry_count,
                        )
                        print(
                            f"🔄 Retrying {job.name} "
                            f"({job.retry_count}/{job.max_retries})"
                        )
                    else:
                        self.job_repository.update_status(job, "DEAD")
                        self.job_repository.clear_worker(job)
                        self.notification_service.send_webhook(
                            f"Job dead: {job.name}",
                            "Maximum retries exceeded",
                        )
                        self.notification_service.send_email(
                            f"Job dead: {job.name}",
                            "Maximum retries exceeded",
                        )
                        self.job_log_repository.create_log(
                            job.id,
                            "DEAD",
                            "Maximum retries exceeded",
                            retry_attempts=job.retry_count,
                        )
                        print(f"💀 {job.name} moved to DEAD")

            # Step 7: Wait before checking again
            time.sleep(2)