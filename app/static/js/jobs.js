/**
 * Job Management Module
 */

class JobManager {
    constructor() {
        this.table = null;
        this.currentPage = 1;
        this.currentFilter = '';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadJobs();
        await this.loadJobStats();
        await this.loadQueuesForFilter();
    }

    setupEventListeners() {
        // Create job
        document.getElementById('createJobBtn').addEventListener('click', async () => {
            await this.loadQueuesForForm();
            $('#createJobModal').modal('show');
        });

        document.getElementById('saveJobBtn').addEventListener('click', () => this.createJob());

        // Refresh
        document.getElementById('refreshJobsBtn').addEventListener('click', async () => {
            await this.loadJobs();
            await this.loadJobStats();
            utils.showToast('Jobs refreshed', 'success');
        });

        // Filters
        document.getElementById('jobSearch').addEventListener('input', utils.debounce(() => {
            this.table.search(this.value).draw();
        }, 300));

        document.getElementById('jobStatusFilter').addEventListener('change', function() {
            window.jobManager.currentFilter = this.value;
            window.jobManager.table.column(5).search(this.value).draw();
        });

        document.getElementById('jobQueueFilter').addEventListener('change', function() {
            window.jobManager.table.column(3).search(this.value).draw();
        });

        // Filter cards
        document.querySelectorAll('.filter-card').forEach(card => {
            card.addEventListener('click', function() {
                const status = this.dataset.status;
                document.getElementById('jobStatusFilter').value = status;
                window.jobManager.table.column(5).search(status).draw();
                
                // Highlight active card
                document.querySelectorAll('.filter-card').forEach(c => c.style.borderColor = '');
                this.style.borderColor = 'var(--primary-color)';
            });
        });

        // Select all
        document.getElementById('selectAllJobs').addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.job-checkbox');
            checkboxes.forEach(cb => cb.checked = this.checked);
            window.jobManager.updateBulkButtons();
        });

        // Bulk actions
        document.getElementById('bulkCancelBtn').addEventListener('click', () => this.bulkCancel());
        document.getElementById('bulkDeleteBtn').addEventListener('click', () => this.bulkDelete());
    }

    async loadJobStats() {
        try {
            const response = await api.get('/jobs/stats');
            if (response) {
                document.getElementById('allJobsCount').textContent = utils.formatNumber(response.total || 0);
                document.getElementById('pendingJobsCount').textContent = utils.formatNumber(response.pending || 0);
                document.getElementById('runningJobsCount').textContent = utils.formatNumber(response.running || 0);
                document.getElementById('completedJobsCount').textContent = utils.formatNumber(response.completed || 0);
                document.getElementById('failedJobsCount').textContent = utils.formatNumber(response.failed || 0);
                document.getElementById('cancelledJobsCount').textContent = utils.formatNumber(response.cancelled || 0);
            }
        } catch (error) {
            console.error('Error loading job stats:', error);
        }
    }

    async loadJobs() {
        try {
            const response = await api.get('/jobs/');
            
            if (this.table) {
                this.table.destroy();
            }

            const tableBody = document.querySelector('#jobsTable tbody');
            tableBody.innerHTML = '';

            if (response && response.length > 0) {
                response.forEach(job => this.addJobRow(job));
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="10" class="text-center py-5">
                            <i class="bi bi-inbox fs-1 text-muted"></i>
                            <p class="text-muted mt-2">No jobs found</p>
                        </td>
                    </tr>
                `;
            }

            this.initializeTable();
        } catch (error) {
            utils.handleError(error, 'Failed to load jobs');
        }
    }

    addJobRow(job) {
        const statusBadge = this.getStatusBadge(job.status);
        const priorityBadge = this.getPriorityBadge(job.priority);
        const tableBody = document.querySelector('#jobsTable tbody');
        const jobId = JSON.stringify(job.id);
        
        const row = `
            <tr data-job-id="${job.id}">
                <td>
                    <input type="checkbox" class="form-check-input job-checkbox" value="${job.id}" onchange="jobManager.updateBulkButtons()">
                </td>
                <td>
                    <span class="text-monospace">#${job.id}</span>
                </td>
                <td>
                    <a href="#" class="text-decoration-none fw-medium" onclick="jobManager.viewJobDetails(${jobId}); return false;">
                        ${utils.escapeHtml(job.name || 'Unnamed Job')}
                    </a>
                </td>
                <td>
                    <span class="badge bg-secondary">${utils.escapeHtml(job.queue_name || 'N/A')}</span>
                </td>
                <td>${priorityBadge}</td>
                <td>${statusBadge}</td>
                <td>
                    <span class="text-muted">${utils.escapeHtml(job.worker || 'Unassigned')}</span>
                </td>
                <td>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar ${this.getProgressClass(job.status)}" 
                             style="width: ${job.progress || 0}%"></div>
                    </div>
                    <small class="text-muted">${job.progress || 0}%</small>
                </td>
                <td>
                    <small class="text-muted">${utils.formatDate(job.created_at, 'relative')}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="jobManager.viewJobDetails(${jobId})" title="View">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${job.status === 'failed' ? `
                            <button class="btn btn-outline-warning" onclick="jobManager.retryJob(${jobId})" title="Retry">
                                <i class="bi bi-arrow-repeat"></i>
                            </button>
                        ` : ''}
                        ${job.status === 'running' || job.status === 'pending' ? `
                            <button class="btn btn-outline-danger" onclick="jobManager.cancelJob(${jobId})" title="Cancel">
                                <i class="bi bi-x-circle"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-outline-danger" onclick="jobManager.deleteJob(${jobId})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    }

    initializeTable() {
        this.table = utils.initDataTable('#jobsTable', {
            order: [[8, 'desc']],
            pageLength: 25,
            columnDefs: [
                { orderable: false, targets: [0, 9] }
            ],
            drawCallback: () => {
                this.updateBulkButtons();
            }
        });
    }

    getStatusBadge(status) {
        const badges = {
            'pending': '<span class="status-badge status-pending"><i class="bi bi-clock"></i>Pending</span>',
            'running': '<span class="status-badge status-running"><i class="bi bi-play-circle"></i>Running</span>',
            'completed': '<span class="status-badge status-completed"><i class="bi bi-check-circle"></i>Completed</span>',
            'failed': '<span class="status-badge status-failed"><i class="bi bi-x-circle"></i>Failed</span>',
            'cancelled': '<span class="status-badge bg-secondary text-white"><i class="bi bi-slash-circle"></i>Cancelled</span>'
        };
        return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
    }

    getPriorityBadge(priority) {
        const badges = {
            1: '<span class="badge bg-secondary">Low</span>',
            2: '<span class="badge bg-info">Normal</span>',
            3: '<span class="badge bg-warning">High</span>',
            4: '<span class="badge bg-danger">Critical</span>'
        };
        return badges[priority] || badges[2];
    }

    getProgressClass(status) {
        const classes = {
            'completed': 'bg-success',
            'running': 'bg-info',
            'failed': 'bg-danger',
            'cancelled': 'bg-secondary'
        };
        return classes[status] || 'bg-warning';
    }

    async createJob() {
        const name = document.getElementById('jobName').value.trim();
        const queueId = document.getElementById('jobQueue').value;
        const priority = parseInt(document.getElementById('jobPriority').value);
        const type = document.getElementById('jobType').value;
        const maxRetries = parseInt(document.getElementById('jobMaxRetries').value);
        const timeout = parseInt(document.getElementById('jobTimeout').value);
        const schedule = document.getElementById('jobSchedule').value;
        
        let payload = {};
        const payloadText = document.getElementById('jobPayload').value.trim();
        if (payloadText) {
            try {
                payload = JSON.parse(payloadText);
            } catch (e) {
                utils.showToast('Invalid JSON payload', 'error');
                return;
            }
        }

        if (!name) {
            utils.showToast('Job name is required', 'error');
            return;
        }

        if (!queueId) {
            utils.showToast('Queue is required', 'error');
            return;
        }

        try {
            const response = await api.post('/jobs/', {
                name: name,
                    queue_id: queueId,
                priority: priority,
                job_type: type,
                payload: payload,
                max_retries: maxRetries,
                timeout: timeout,
                scheduled_at: schedule || null
            });

            utils.showToast('Job created successfully', 'success');
            $('#createJobModal').modal('hide');
            document.getElementById('createJobForm').reset();
            await this.loadJobs();
            await this.loadJobStats();
        } catch (error) {
            utils.handleError(error, 'Failed to create job');
        }
    }

    async viewJobDetails(id) {
        try {
            const job = await api.get(`/jobs/${id}`);
            
            const content = document.getElementById('jobDetailsContent');
            content.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>Job Information</h6>
                        <table class="table table-sm">
                            <tr><td><strong>ID:</strong></td><td>#${job.id}</td></tr>
                            <tr><td><strong>Name:</strong></td><td>${utils.escapeHtml(job.name)}</td></tr>
                            <tr><td><strong>Status:</strong></td><td>${this.getStatusBadge(job.status)}</td></tr>
                            <tr><td><strong>Queue:</strong></td><td>${utils.escapeHtml(job.queue_name || 'N/A')}</td></tr>
                            <tr><td><strong>Priority:</strong></td><td>${this.getPriorityBadge(job.priority)}</td></tr>
                            <tr><td><strong>Worker:</strong></td><td>${utils.escapeHtml(job.worker || 'Unassigned')}</td></tr>
                            <tr><td><strong>Attempts:</strong></td><td>${job.attempts || 0} / ${job.max_retries || 3}</td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>Timeline</h6>
                        <div class="timeline">
                            ${this.buildTimeline(job)}
                        </div>
                        <h6 class="mt-4">Payload</h6>
                        <pre class="bg-dark p-3 rounded"><code>${JSON.stringify(job.payload, null, 2)}</code></pre>
                    </div>
                </div>
                ${job.error ? `
                    <div class="row mt-3">
                        <div class="col-12">
                            <h6>Error</h6>
                            <pre class="bg-danger bg-opacity-10 text-danger p-3 rounded"><code>${utils.escapeHtml(job.error)}</code></pre>
                        </div>
                    </div>
                ` : ''}
            `;
            
            $('#jobDetailsModal').modal('show');
        } catch (error) {
            utils.handleError(error, 'Failed to load job details');
        }
    }

    buildTimeline(job) {
        const events = [];
        
        if (job.created_at) {
            events.push({ time: job.created_at, event: 'Created', icon: 'bi-plus-circle', color: 'text-primary' });
        }
        if (job.started_at) {
            events.push({ time: job.started_at, event: 'Started', icon: 'bi-play-circle', color: 'text-info' });
        }
        if (job.completed_at) {
            events.push({ time: job.completed_at, event: 'Completed', icon: 'bi-check-circle', color: 'text-success' });
        }
        if (job.failed_at) {
            events.push({ time: job.failed_at, event: 'Failed', icon: 'bi-x-circle', color: 'text-danger' });
        }
        
        return events.map(e => `
            <div class="timeline-item d-flex align-items-center mb-2">
                <i class="bi ${e.icon} ${e.color} me-2"></i>
                <div>
                    <small class="text-muted">${utils.formatDate(e.time)}</small>
                    <div>${e.event}</div>
                </div>
            </div>
        `).join('');
    }

    async retryJob(id) {
        const confirmed = await utils.confirmAction('Retry Job', 'Are you sure you want to retry this job?', 'Retry');
        if (confirmed) {
            try {
                await api.post(`/jobs/${id}/retry`);
                utils.showToast('Job queued for retry', 'success');
                await this.loadJobs();
            } catch (error) {
                utils.handleError(error, 'Failed to retry job');
            }
        }
    }

    async cancelJob(id) {
        const confirmed = await utils.confirmAction('Cancel Job', 'Are you sure you want to cancel this job?', 'Cancel');
        if (confirmed) {
            try {
                await api.post(`/jobs/${id}/cancel`);
                utils.showToast('Job cancelled', 'success');
                await this.loadJobs();
            } catch (error) {
                utils.handleError(error, 'Failed to cancel job');
            }
        }
    }

    async deleteJob(id) {
        const confirmed = await utils.confirmAction('Delete Job', 'This action cannot be undone.', 'Delete');
        if (confirmed) {
            try {
                await api.delete(`/jobs/${id}`);
                utils.showToast('Job deleted', 'success');
                await this.loadJobs();
                await this.loadJobStats();
            } catch (error) {
                utils.handleError(error, 'Failed to delete job');
            }
        }
    }

    async bulkCancel() {
        const selected = this.getSelectedJobs();
        if (selected.length === 0) return;
        
        const confirmed = await utils.confirmAction(
            'Cancel Jobs',
            `Are you sure you want to cancel ${selected.length} job(s)?`,
            'Cancel All'
        );
        
        if (confirmed) {
            try {
                await Promise.all(selected.map(id => api.post(`/jobs/${id}/cancel`)));
                utils.showToast(`${selected.length} job(s) cancelled`, 'success');
                await this.loadJobs();
            } catch (error) {
                utils.handleError(error, 'Failed to cancel some jobs');
            }
        }
    }

    async bulkDelete() {
        const selected = this.getSelectedJobs();
        if (selected.length === 0) return;
        
        const confirmed = await utils.confirmAction(
            'Delete Jobs',
            `Are you sure you want to delete ${selected.length} job(s)? This cannot be undone.`,
            'Delete All'
        );
        
        if (confirmed) {
            try {
                await Promise.all(selected.map(id => api.delete(`/jobs/${id}`)));
                utils.showToast(`${selected.length} job(s) deleted`, 'success');
                await this.loadJobs();
                await this.loadJobStats();
            } catch (error) {
                utils.handleError(error, 'Failed to delete some jobs');
            }
        }
    }

    getSelectedJobs() {
        const checkboxes = document.querySelectorAll('.job-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    updateBulkButtons() {
        const selected = this.getSelectedJobs();
        document.getElementById('bulkCancelBtn').disabled = selected.length === 0;
        document.getElementById('bulkDeleteBtn').disabled = selected.length === 0;
    }

    async loadQueuesForFilter() {
        try {
            const queues = await api.get('/queues/');
            const select = document.getElementById('jobQueueFilter');
            if (queues) {
                queues.forEach(q => {
                    select.insertAdjacentHTML('beforeend', `<option value="${q.name}">${q.name}</option>`);
                });
            }
        } catch (error) {
            console.error('Error loading queues for filter:', error);
        }
    }

    async loadQueuesForForm() {
        try {
            const queues = await api.get('/queues/');
            const select = document.getElementById('jobQueue');
            select.innerHTML = '<option value="">Select Queue</option>';
            if (queues) {
                queues.forEach(q => {
                    select.insertAdjacentHTML('beforeend', `<option value="${q.id}">${q.name}</option>`);
                });
            }
        } catch (error) {
            console.error('Error loading queues for form:', error);
        }
    }
}

let jobManager;
document.addEventListener('DOMContentLoaded', () => {
    jobManager = new JobManager();
});