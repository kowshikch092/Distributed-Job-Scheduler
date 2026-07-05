/**
 * Worker Management Module
 */

class WorkerManager {
    constructor() {
        this.refreshInterval = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadWorkers();
        await this.loadWorkerStats();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        document.getElementById('refreshWorkersBtn').addEventListener('click', async () => {
            await this.loadWorkers();
            await this.loadWorkerStats();
            utils.showToast('Workers refreshed', 'success');
        });

        document.getElementById('startAllWorkersBtn').addEventListener('click', () => this.startAllWorkers());
        document.getElementById('stopAllWorkersBtn').addEventListener('click', () => this.stopAllWorkers());
    }

    async loadWorkerStats() {
        try {
            const workers = await api.get('/workers/');
            if (workers) {
                const online = workers.filter(w => w.status === 'online').length;
                const offline = workers.filter(w => w.status === 'offline').length;
                const cpuAvg = Math.round(workers.reduce((sum, w) => sum + (w.cpu_usage || 0), 0) / workers.length);
                const memAvg = Math.round(workers.reduce((sum, w) => sum + (w.memory_usage || 0), 0) / workers.length);
                
                document.getElementById('onlineWorkersCount').textContent = online;
                document.getElementById('offlineWorkersCount').textContent = offline;
                document.getElementById('avgCpuUsage').textContent = cpuAvg + '%';
                document.getElementById('avgMemoryUsage').textContent = memAvg + '%';
            }
        } catch (error) {
            console.error('Error loading worker stats:', error);
        }
    }

    async loadWorkers() {
        try {
            const workers = await api.get('/workers/');
            const grid = document.getElementById('workersGrid');
            grid.innerHTML = '';

            if (workers && workers.length > 0) {
                workers.forEach(worker => {
                    grid.insertAdjacentHTML('beforeend', this.createWorkerCard(worker));
                });
            } else {
                grid.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <i class="bi bi-cpu fs-1 text-muted"></i>
                        <p class="text-muted mt-2">No workers found</p>
                    </div>
                `;
            }

            // Add event listeners to worker action buttons
            document.querySelectorAll('.worker-action').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = btn.dataset.action;
                    const workerId = btn.dataset.workerId;
                    this.handleWorkerAction(action, workerId);
                });
            });
        } catch (error) {
            utils.handleError(error, 'Failed to load workers');
        }
    }

    createWorkerCard(worker) {
        const statusColor = worker.status === 'online' ? 'success' : 
                           worker.status === 'busy' ? 'warning' : 'danger';
        const cpuColor = worker.cpu_usage > 80 ? 'danger' : 
                         worker.cpu_usage > 60 ? 'warning' : 'success';
        const memColor = worker.memory_usage > 80 ? 'danger' : 
                         worker.memory_usage > 60 ? 'warning' : 'success';

        return `
            <div class="col-xl-4 col-lg-6 mb-4">
                <div class="card glass-card worker-card" data-worker-id="${worker.id}">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-2">
                            <span class="status-dot ${worker.status}"></span>
                            <h6 class="mb-0">${utils.escapeHtml(worker.name || `Worker #${worker.id}`)}</h6>
                        </div>
                        <span class="badge bg-${statusColor}">${worker.status}</span>
                    </div>
                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-6">
                                <small class="text-muted">CPU Usage</small>
                                <div class="d-flex align-items-center gap-2">
                                    <div class="progress flex-grow-1" style="height: 6px;">
                                        <div class="progress-bar bg-${cpuColor}" style="width: ${worker.cpu_usage || 0}%"></div>
                                    </div>
                                    <span class="text-${cpuColor} fw-bold small">${worker.cpu_usage || 0}%</span>
                                </div>
                            </div>
                            <div class="col-6">
                                <small class="text-muted">Memory</small>
                                <div class="d-flex align-items-center gap-2">
                                    <div class="progress flex-grow-1" style="height: 6px;">
                                        <div class="progress-bar bg-${memColor}" style="width: ${worker.memory_usage || 0}%"></div>
                                    </div>
                                    <span class="text-${memColor} fw-bold small">${worker.memory_usage || 0}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="worker-info mb-3">
                            <div class="d-flex justify-content-between mb-1">
                                <small class="text-muted">Current Job:</small>
                                <small>${utils.escapeHtml(worker.current_job || 'Idle')}</small>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <small class="text-muted">Queue:</small>
                                <small>${utils.escapeHtml(worker.queue || 'N/A')}</small>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <small class="text-muted">Jobs Completed:</small>
                                <small>${worker.jobs_completed || 0}</small>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <small class="text-muted">Uptime:</small>
                                <small>${worker.uptime || 'N/A'}</small>
                            </div>
                            <div class="d-flex justify-content-between">
                                <small class="text-muted">Last Heartbeat:</small>
                                <small>${worker.last_heartbeat ? utils.formatDate(worker.last_heartbeat, 'relative') : 'N/A'}</small>
                            </div>
                        </div>
                        
                        <div class="worker-actions d-flex gap-2">
                            <button class="btn btn-outline-primary btn-sm flex-grow-1 worker-action" 
                                    data-action="details" data-worker-id="${worker.id}">
                                <i class="bi bi-eye"></i> Details
                            </button>
                            ${worker.status === 'online' ? `
                                <button class="btn btn-outline-warning btn-sm worker-action" 
                                        data-action="stop" data-worker-id="${worker.id}">
                                    <i class="bi bi-stop-fill"></i> Stop
                                </button>
                            ` : `
                                <button class="btn btn-outline-success btn-sm worker-action" 
                                        data-action="start" data-worker-id="${worker.id}">
                                    <i class="bi bi-play-fill"></i> Start
                                </button>
                            `}
                            <button class="btn btn-outline-danger btn-sm worker-action" 
                                    data-action="restart" data-worker-id="${worker.id}">
                                <i class="bi bi-arrow-repeat"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async handleWorkerAction(action, workerId) {
        switch(action) {
            case 'details':
                await this.viewWorkerDetails(workerId);
                break;
            case 'start':
                await this.startWorker(workerId);
                break;
            case 'stop':
                await this.stopWorker(workerId);
                break;
            case 'restart':
                await this.restartWorker(workerId);
                break;
        }
    }

    async viewWorkerDetails(id) {
        try {
            const worker = await api.get(`/workers/${id}`);
            
            const content = document.getElementById('workerDetailsContent');
            content.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>Worker Information</h6>
                        <table class="table table-sm">
                            <tr><td><strong>ID:</strong></td><td>#${worker.id}</td></tr>
                            <tr><td><strong>Name:</strong></td><td>${utils.escapeHtml(worker.name)}</td></tr>
                            <tr><td><strong>Status:</strong></td><td>${worker.status}</td></tr>
                            <tr><td><strong>Host:</strong></td><td>${utils.escapeHtml(worker.host || 'N/A')}</td></tr>
                            <tr><td><strong>PID:</strong></td><td>${worker.pid || 'N/A'}</td></tr>
                            <tr><td><strong>Version:</strong></td><td>${worker.version || 'N/A'}</td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>Resource Usage</h6>
                        <div class="mb-3">
                            <label>CPU Usage</label>
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar bg-${worker.cpu_usage > 80 ? 'danger' : 'success'}" 
                                     style="width: ${worker.cpu_usage || 0}%">
                                    ${worker.cpu_usage || 0}%
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label>Memory Usage</label>
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar bg-${worker.memory_usage > 80 ? 'danger' : 'success'}" 
                                     style="width: ${worker.memory_usage || 0}%">
                                    ${worker.memory_usage || 0}%
                                </div>
                            </div>
                        </div>
                        <div id="workerCpuChart" style="height: 200px;"></div>
                    </div>
                </div>
            `;
            
            $('#workerDetailsModal').modal('show');
            
            // Create CPU chart
            setTimeout(() => {
                new ApexCharts(document.querySelector('#workerCpuChart'), {
                    series: [{
                        name: 'CPU',
                        data: worker.cpu_history || [0, 0, 0, 0, 0]
                    }],
                    chart: {
                        type: 'line',
                        height: 200,
                        animations: { enabled: false }
                    },
                    stroke: { curve: 'smooth', width: 2 },
                    xaxis: { labels: { show: false } },
                    yaxis: { max: 100 }
                }).render();
            }, 500);
            
        } catch (error) {
            utils.handleError(error, 'Failed to load worker details');
        }
    }

    async startWorker(id) {
        try {
            await api.post(`/workers/${id}/start`);
            utils.showToast('Worker started', 'success');
            await this.loadWorkers();
        } catch (error) {
            utils.handleError(error, 'Failed to start worker');
        }
    }

    async stopWorker(id) {
        const confirmed = await utils.confirmAction('Stop Worker', 'Are you sure you want to stop this worker?', 'Stop');
        if (confirmed) {
            try {
                await api.post(`/workers/${id}/stop`);
                utils.showToast('Worker stopped', 'success');
                await this.loadWorkers();
            } catch (error) {
                utils.handleError(error, 'Failed to stop worker');
            }
        }
    }

    async restartWorker(id) {
        const confirmed = await utils.confirmAction('Restart Worker', 'Are you sure you want to restart this worker?', 'Restart');
        if (confirmed) {
            try {
                await api.post(`/workers/${id}/restart`);
                utils.showToast('Worker restarted', 'success');
                await this.loadWorkers();
            } catch (error) {
                utils.handleError(error, 'Failed to restart worker');
            }
        }
    }

    async startAllWorkers() {
        const confirmed = await utils.confirmAction('Start All Workers', 'Start all stopped workers?', 'Start All');
        if (confirmed) {
            try {
                await api.post('/workers/start-all');
                utils.showToast('All workers started', 'success');
                await this.loadWorkers();
            } catch (error) {
                utils.handleError(error, 'Failed to start workers');
            }
        }
    }

    async stopAllWorkers() {
        const confirmed = await utils.confirmAction('Stop All Workers', 'This will stop all running workers. Continue?', 'Stop All');
        if (confirmed) {
            try {
                await api.post('/workers/stop-all');
                utils.showToast('All workers stopped', 'success');
                await this.loadWorkers();
            } catch (error) {
                utils.handleError(error, 'Failed to stop workers');
            }
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(async () => {
            await this.loadWorkerStats();
            // Update worker cards without full reload
            try {
                const workers = await api.get('/workers/');
                if (workers) {
                    document.querySelectorAll('.worker-card').forEach(card => {
                        const workerId = card.dataset.workerId;
                        const worker = workers.find(w => w.id == workerId);
                        if (worker) {
                            // Update status dot and badge
                            const statusDot = card.querySelector('.status-dot');
                            const statusBadge = card.querySelector('.badge');
                            statusDot.className = `status-dot ${worker.status}`;
                            statusBadge.textContent = worker.status;
                            
                            // Update CPU and memory
                            const cpuBar = card.querySelector('.progress-bar:first-of-type');
                            const memBar = card.querySelector('.progress-bar:last-of-type');
                            if (cpuBar) cpuBar.style.width = (worker.cpu_usage || 0) + '%';
                            if (memBar) memBar.style.width = (worker.memory_usage || 0) + '%';
                            
                            // Update last heartbeat
                            const heartbeat = card.querySelector('.d-flex.justify-content-between:last-of-type small:last-child');
                            if (heartbeat && worker.last_heartbeat) {
                                heartbeat.textContent = utils.formatDate(worker.last_heartbeat, 'relative');
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Auto-refresh error:', error);
            }
        }, 10000); // Every 10 seconds
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

let workerManager;
document.addEventListener('DOMContentLoaded', () => {
    workerManager = new WorkerManager();
});

window.addEventListener('beforeunload', () => {
    if (workerManager) {
        workerManager.destroy();
    }
});