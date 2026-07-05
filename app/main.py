from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from threading import Thread

from app.api.auth import router as auth_router
from app.api.workflow import router as workflow_router
from app.api.queue import router as queue_router
from app.api.job import router as job_router
from app.api.worker import router as worker_router
from app.api.dashboard import router as dashboard_router
from app.api.workflow_pdf import router as workflow_pdf_router
from app.api.job_dependency import router as dependency_router
from app.api.job_execution import router as job_execution_router

from app.database.create_tables import create_tables
from app.database.session import SessionLocal
from app.services.scheduler_service import SchedulerService

app = FastAPI(
    title="Distributed Job Scheduler",
    version="1.0.0",
)

# ---------------- Static Files & Templates ----------------
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# ---------------- API Routers (Backend) ----------------
app.include_router(auth_router)
app.include_router(workflow_router)
app.include_router(queue_router)
app.include_router(job_router)
app.include_router(worker_router)
app.include_router(dashboard_router)
app.include_router(dependency_router)
app.include_router(workflow_pdf_router)
app.include_router(job_execution_router)

# ---------------- Scheduler Setup ----------------

def run_scheduler():
    db = SessionLocal()
    scheduler = SchedulerService(db)
    scheduler.start()


@app.on_event("startup")
def startup_event():
    create_tables()
    thread = Thread(target=run_scheduler, daemon=True)
    thread.start()


# ---------------- Root API Endpoint ----------------

@app.get("/api")
def api_root():
    return {
        "message": "Distributed Job Scheduler API is Running 🚀"
    }


# ---------------- Frontend Template Routes ----------------

def render_frontend_page(request: Request, template_name: str, context: dict):
    fragment = request.query_params.get("fragment") == "1"
    return templates.TemplateResponse(
        template_name,
        {
            **context,
            "request": request,
            "fragment": fragment,
        }
    )


@app.get("/", response_class=HTMLResponse)
async def root_page(request: Request):
    """Root page - redirect to dashboard if token exists, else to login."""
    return RedirectResponse(url="/login")


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Render the login page."""
    return render_frontend_page(
        request,
        "login.html",
        {
            "page_title": "Login"
        }
    )


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    """Render the registration page."""
    return render_frontend_page(
        request,
        "register.html",
        {
            "page_title": "Create Account"
        }
    )


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    """Render the dashboard page."""
    return render_frontend_page(
        request,
        "dashboard.html",
        {
            "page_title": "Dashboard",
            "active_page": "dashboard"
        }
    )


@app.get("/queues", response_class=HTMLResponse)
async def queues_page(request: Request):
    """Render the queues management page."""
    return render_frontend_page(
        request,
        "queues.html",
        {
            "page_title": "Queues",
            "active_page": "queues"
        }
    )


@app.get("/queues/{queue_id}", response_class=HTMLResponse)
async def queue_details_page(request: Request, queue_id: int):
    """Render the queue details page."""
    return render_frontend_page(
        request,
        "queue_details.html",
        {
            "page_title": f"Queue #{queue_id}",
            "active_page": "queues",
            "queue_id": queue_id
        }
    )


@app.get("/jobs", response_class=HTMLResponse)
async def jobs_page(request: Request):
    """Render the jobs management page."""
    return render_frontend_page(
        request,
        "jobs.html",
        {
            "page_title": "Jobs",
            "active_page": "jobs"
        }
    )


@app.get("/jobs/{job_id}", response_class=HTMLResponse)
async def job_details_page(request: Request, job_id: int):
    """Render the job details page."""
    return render_frontend_page(
        request,
        "job_details.html",
        {
            "page_title": f"Job #{job_id}",
            "active_page": "jobs",
            "job_id": job_id
        }
    )


@app.get("/workers", response_class=HTMLResponse)
async def workers_page(request: Request):
    """Render the workers management page."""
    return render_frontend_page(
        request,
        "workers.html",
        {
            "request": request,
            "page_title": "Workers",
            "active_page": "workers"
        }
    )


@app.get("/workers/{worker_id}", response_class=HTMLResponse)
async def worker_details_page(request: Request, worker_id: int):
    """Render the worker details page."""
    return render_frontend_page(
        request,
        "worker_details.html",
        {
            "page_title": f"Worker #{worker_id}",
            "active_page": "workers",
            "worker_id": worker_id
        }
    )


@app.get("/workflows", response_class=HTMLResponse)
async def workflows_page(request: Request):
    """Render the workflows management page."""
    return render_frontend_page(
        request,
        "workflows.html",
        {
            "page_title": "Workflows",
            "active_page": "workflows"
        }
    )


@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request):
    """Render the settings page."""
    return render_frontend_page(
        request,
        "settings.html",
        {
            "page_title": "Settings",
            "active_page": "settings"
        }
    )


@app.get("/logs", response_class=HTMLResponse)
async def logs_page(request: Request):
    """Render the logs page."""
    return render_frontend_page(
        request,
        "logs.html",
        {
            "page_title": "Execution Logs",
            "active_page": "logs"
        }
    )


@app.get("/executions", response_class=HTMLResponse)
async def executions_page(request: Request):
    """Render the execution history page."""
    return render_frontend_page(
        request,
        "executions.html",
        {
            "page_title": "Execution History",
            "active_page": "logs"
        }
    )


# ---------------- Error Handlers ----------------

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions."""
    # For API routes, return JSON
    if request.url.path.startswith("/auth") or request.url.path.startswith("/api"):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": str(exc.detail)}
        )
    
    # For frontend routes, render error pages
    if exc.status_code == 404:
        return templates.TemplateResponse(
            "404.html",
            {"request": request, "page_title": "404 - Page Not Found"},
            status_code=404
        )
    
    return templates.TemplateResponse(
        "500.html",
        {"request": request, "page_title": "500 - Server Error"},
        status_code=exc.status_code
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Handle generic exceptions."""
    # For API routes, return JSON
    if request.url.path.startswith("/auth") or request.url.path.startswith("/api"):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )
    
    return templates.TemplateResponse(
        "500.html",
        {"request": request, "page_title": "500 - Server Error"},
        status_code=500
    )