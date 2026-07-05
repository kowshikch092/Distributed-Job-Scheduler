/**
 * Queue Management Module
 */

class QueueManager {
    constructor() {
        this.table = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadQueues();
        await this.loadQueueStats();
    }

    setupEventListeners() {
        // Create queue
        document.getElementById('createQueueBtn').addEventListener('click', () => {
            $('#createQueueModal').modal('show');
        });

        document.getElementById('saveQueueBtn').addEventListener('click', () => this.createQueue());

        // Update queue
        document.getElementById('updateQueueBtn').addEventListener('click', () => this.updateQueue());

        // Refresh
        document.getElementById('refreshQueuesBtn').addEventListener('click', async () => {
            await this.loadQueues();
            await this.loadQueueStats();
            utils.showToast('Queues refreshed', 'success');
        });

        // Search
        document.getElementById('queueSearch').addEventListener('input', utils.debounce(() => {
            this.table.search(this.value).draw();
        }, 300));

        // Status filter
        document.getElementById('queueStatusFilter').addEventListener('change', function() {
            window.queueManager.table.column(7).search(this.value).draw();
        });
    }

    async loadQueueStats() {
        try {
            const response = await api.get('/queues/stats');
            if (response) {
                document.getElementById('totalQueuesCount').textContent = utils.formatNumber(response.total || 0);
                document.getElementById('totalPendingJobs').textContent = utils.formatNumber(response.pending_jobs || 0);
                document.getElementById('totalActiveJobs').textContent = utils.formatNumber(response.active_jobs || 0);
                document.getElementById('totalCompletedJobs').textContent = utils.formatNumber(response.completed_today || 0);
            }
        } catch (error) {
            console.error('Error loading queue stats:', error);
        }
    }

    async loadQueues() {
        try {
            const response = await api.get('/queues/');
            
            if (this.table) {
                this.table.destroy();
            }

            const tableBody = document.querySelector('#queuesTable tbody');
            tableBody.innerHTML = '';

            if (response && response.length > 0) {
                response.forEach(queue => this.addQueueRow(queue));
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center py-5">
                            <i class="bi bi-inbox fs-1 text-muted"></i>
                            <p class="text-muted mt-2">No queues found</p>
                        </td>
                    </tr>
                `;
            }

            this.initializeTable();
        } catch (error) {
            utils.handleError(error, 'Failed to load queues');
        }
    }

    addQueueRow(queue) {
        const priorityBadge = this.getPriorityBadge(queue.priority);
        const statusBadge = this.getStatusBadge(queue.status);
        const tableBody = document.querySelector('#queuesTable tbody');
        
        const row = `
            <tr data-queue-id="${queue.id}">
                <td>
                    <a href="/queues/${queue.id}" class="text-decoration-none fw-medium">
                        ${utils.escapeHtml(queue.name)}
                    </a>
                </td>
                <td>${priorityBadge}</td>
                <td>
                    <span class="badge bg-info">${queue.concurrency || 1}x</span>
                </td>
                <td>
                    <span class="text-info fw-bold">${queue.active_jobs || 0}</span>
                </td>
                <td>
                    <span class="text-warning fw-bold">${queue.waiting_jobs || 0}</span>
                </td>
                <td>
                    <span class="text-success fw-bold">${queue.completed_jobs || 0}</span>
                </td>
                <td>
                    <span class="text-danger fw-bold">${queue.failed_jobs || 0}</span>
                </td>
                <td>${statusBadge}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="queueManager.editQueue(${queue.id})" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="queueManager.togglePause(${queue.id})" title="Pause/Resume">
                            <i class="bi bi-${queue.status === 'paused' ? 'play-fill' : 'pause-fill'}"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="queueManager.purgeQueue(${queue.id})" title="Purge">
                            <i class="bi bi-eraser"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="queueManager.deleteQueue(${queue.id})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    }

    initializeTable() {
        this.table = utils.initDataTable('#queuesTable', {
            order: [[0, 'asc']],
            pageLength: 25,
            columnDefs: [
                { orderable: false, targets: [8] }
            ]
        });
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

    getStatusBadge(status) {
        const badges = {
            'active': '<span class="badge bg-success">Active</span>',
            'paused': '<span class="badge bg-warning">Paused</span>',
            'draining': '<span class="badge bg-info">Draining</span>'
        };
        return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
    }

    async createQueue() {
        const name = document.getElementById('queueName').value.trim();
        const priority = parseInt(document.getElementById('queuePriority').value);
        const concurrency = parseInt(document.getElementById('queueConcurrency').value);
        const maxRetries = parseInt(document.getElementById('queueMaxRetries').value);
        const description = document.getElementById('queueDescription').value.trim();
        const durable = document.getElementById('queueDurable').checked;

        if (!name) {
            utils.showToast('Queue name is required', 'error');
            return;
        }

        try {
            const response = await api.post('/queues/', {
                name: name,
                priority: priority,
                concurrency: concurrency,
                max_retries: maxRetries,
                description: description,
                durable: durable
            });

            utils.showToast('Queue created successfully', 'success');
            $('#createQueueModal').modal('hide');
            document.getElementById('createQueueForm').reset();
            await this.loadQueues();
            await this.loadQueueStats();
        } catch (error) {
            utils.handleError(error, 'Failed to create queue');
        }
    }

    async editQueue(id) {
        try {
            const queue = await api.get(`/queues/${id}`);
            
            document.getElementById('editQueueId').value = queue.id;
            document.getElementById('editQueueName').value = queue.name;
            document.getElementById('editQueuePriority').value = queue.priority;
            document.getElementById('editQueueConcurrency').value = queue.concurrency;
            document.getElementById('editQueueMaxRetries').value = queue.max_retries;
            document.getElementById('editQueueDescription').value = queue.description || '';
            
            $('#editQueueModal').modal('show');
        } catch (error) {
            utils.handleError(error, 'Failed to load queue details');
        }
    }

    async updateQueue() {
        const id = document.getElementById('editQueueId').value;
        const name = document.getElementById('editQueueName').value.trim();
        const priority = parseInt(document.getElementById('editQueuePriority').value);
        const concurrency = parseInt(document.getElementById('editQueueConcurrency').value);
        const maxRetries = parseInt(document.getElementById('editQueueMaxRetries').value);
        const description = document.getElementById('editQueueDescription').value.trim();

        if (!name) {
            utils.showToast('Queue name is required', 'error');
            return;
        }

        try {
            await api.put(`/queues/${id}`, {
                name: name,
                priority: priority,
                concurrency: concurrency,
                max_retries: maxRetries,
                description: description
            });

            utils.showToast('Queue updated successfully', 'success');
            $('#editQueueModal').modal('hide');
            await this.loadQueues();
        } catch (error) {
            utils.handleError(error, 'Failed to update queue');
        }
    }

    async togglePause(id) {
        try {
            const queue = await api.get(`/queues/${id}`);
            const action = queue.status === 'paused' ? 'resume' : 'pause';
            
            const confirmed = await utils.confirmAction(
                `${action.charAt(0).toUpperCase() + action.slice(1)} Queue`,
                `Are you sure you want to ${action} this queue?`,
                action.charAt(0).toUpperCase() + action.slice(1)
            );

            if (confirmed) {
                await api.post(`/queues/${id}/${action}`);
                utils.showToast(`Queue ${action}d successfully`, 'success');
                await this.loadQueues();
            }
        } catch (error) {
            utils.handleError(error, 'Failed to toggle queue status');
        }
    }

    async purgeQueue(id) {
        const confirmed = await utils.confirmAction(
            'Purge Queue',
            'This will remove all waiting jobs from the queue. Running jobs will not be affected.',
            'Purge'
        );

        if (confirmed) {
            try {
                await api.post(`/queues/${id}/purge`);
                utils.showToast('Queue purged successfully', 'success');
                await this.loadQueues();
                await this.loadQueueStats();
            } catch (error) {
                utils.handleError(error, 'Failed to purge queue');
            }
        }
    }

    async deleteQueue(id) {
        const confirmed = await utils.confirmAction(
            'Delete Queue',
            'This action cannot be undone. All jobs in this queue will be lost.',
            'Delete'
        );

        if (confirmed) {
            try {
                await api.delete(`/queues/${id}`);
                utils.showToast('Queue deleted successfully', 'success');
                await this.loadQueues();
                await this.loadQueueStats();
            } catch (error) {
                utils.handleError(error, 'Failed to delete queue');
            }
        }
    }
}

let queueManager;
document.addEventListener('DOMContentLoaded', () => {
    queueManager = new QueueManager();
});