/**
 * Execution History Manager
 * Responsible for fetching execution data, rendering the execution table,
 * and refreshing data inside the SPA without business logic leaking into templates.
 */

class ExecutionManager {
    constructor() {
        this.tableBody = document.querySelector('#executionsTable tbody');
        this.executions = [];
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.loadExecutions();
        this.startAutoRefresh();
    }

    cacheElements() {
        this.searchInput = document.getElementById('executionSearch');
        this.statusFilter = document.getElementById('executionStatusFilter');
        this.workerFilter = document.getElementById('executionWorkerFilter');
        this.timeFilter = document.getElementById('executionTimeFilter');
        this.executionCount = document.getElementById('executionCount');
        this.totalCount = document.getElementById('totalExecutionEntries');
        this.completedCount = document.getElementById('completedExecutionCount');
        this.failedCount = document.getElementById('failedExecutionCount');
        this.runningCount = document.getElementById('runningExecutionCount');
        this.pendingCount = document.getElementById('pendingExecutionCount');
    }

    setupEventListeners() {
        document.getElementById('refreshExecutionsBtn').addEventListener('click', () => this.loadExecutions());
        document.getElementById('downloadExecutionsBtn').addEventListener('click', () => this.exportExecutions());
        this.searchInput.addEventListener('input', utils.debounce(() => this.renderTable(), 250));
        this.statusFilter.addEventListener('change', () => this.renderTable());
        this.workerFilter.addEventListener('change', () => this.renderTable());
        this.timeFilter.addEventListener('change', () => this.renderTable());
    }

    async loadExecutions() {
        try {
            const response = await api.get('/executions/?limit=200');
            this.executions = Array.isArray(response) ? response : [];
            this.applyWorkerFilterOptions();
            this.renderTable();
            this.updateSummaryCards();
            utils.showToast('Execution history refreshed', 'success', 1200);
        } catch (error) {
            console.error('Failed to load executions:', error);
            utils.handleError(error, 'Failed to refresh execution history');
        }
    }

    applyWorkerFilterOptions() {
        const workers = [...new Set(this.executions
            .map(exec => exec.worker_name || exec.worker_id)
            .filter(Boolean)
            .sort((a, b) => String(a).localeCompare(String(b)))
        )];

        this.workerFilter.innerHTML = `
            <option value="">All Workers</option>
            ${workers.map(worker => `
                <option value="${utils.escapeHtml(String(worker))}">${utils.escapeHtml(String(worker))}</option>
            `).join('')}
        `;
    }

    getFilteredExecutions() {
        const search = this.searchInput.value.trim().toLowerCase();
        const status = this.statusFilter.value;
        const worker = this.workerFilter.value.toLowerCase();
        const timeRange = this.timeFilter.value;
        const now = new Date();

        return this.executions.filter(exec => {
            if (status && exec.status !== status) {
                return false;
            }

            if (worker) {
                const workerText = String(exec.worker_name || exec.worker_id || '').toLowerCase();
                if (!workerText.includes(worker)) {
                    return false;
                }
            }

            if (search) {
                const target = [exec.job_name, exec.worker_name, exec.status, exec.error_message]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!target.includes(search)) {
                    return false;
                }
            }

            if (timeRange) {
                const startedAt = exec.started_at ? new Date(exec.started_at) : null;
                if (!startedAt) {
                    return false;
                }

                const elapsed = (now - startedAt) / 1000 / 60;
                if (timeRange === '15m' && elapsed > 15) return false;
                if (timeRange === '1h' && elapsed > 60) return false;
                if (timeRange === '6h' && elapsed > 360) return false;
                if (timeRange === '24h' && elapsed > 1440) return false;
                if (timeRange === '7d' && elapsed > 10080) return false;
            }

            return true;
        });
    }

    renderTable() {
        const executions = this.getFilteredExecutions();
        this.executionCount.textContent = utils.formatNumber(executions.length);

        if (!this.tableBody) {
            return;
        }

        if (executions.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-2"></i>
                        <div class="mt-2">No execution history records match the current filters.</div>
                    </td>
                </tr>
            `;
            return;
        }

        this.tableBody.innerHTML = executions.map(exec => {
            return `
                <tr>
                    <td>${this.formatTimestamp(exec.started_at)}</td>
                    <td>${utils.escapeHtml(exec.job_name || String(exec.job_id || 'Unknown'))}</td>
                    <td>${utils.escapeHtml(exec.worker_name || String(exec.worker_id || 'Unassigned'))}</td>
                    <td>${this.renderStatusBadge(exec.status)}</td>
                    <td>${this.formatDuration(exec.duration_seconds)}</td>
                    <td>${utils.escapeHtml(exec.error_message || '')}</td>
                </tr>
            `;
        }).join('');

        this.updateSummaryCards(executions);
    }

    renderStatusBadge(status) {
        const normalized = (status || '').toUpperCase();
        const badgeMap = {
            COMPLETED: 'success',
            FAILED: 'danger',
            DEAD: 'danger',
            RUNNING: 'info',
            READY: 'warning',
            WAITING: 'warning',
        };
        const badgeClass = badgeMap[normalized] || 'secondary';
        return `<span class="badge bg-${badgeClass}">${utils.escapeHtml(normalized)}</span>`;
    }

    updateSummaryCards(executions = null) {
        const list = executions || this.executions;
        const counts = {
            total: list.length,
            completed: list.filter(item => item.status === 'COMPLETED').length,
            failed: list.filter(item => item.status === 'FAILED' || item.status === 'DEAD').length,
            running: list.filter(item => item.status === 'RUNNING').length,
            pending: list.filter(item => item.status === 'READY' || item.status === 'WAITING').length,
        };

        this.totalCount.textContent = utils.formatNumber(counts.total);
        this.completedCount.textContent = utils.formatNumber(counts.completed);
        this.failedCount.textContent = utils.formatNumber(counts.failed);
        this.runningCount.textContent = utils.formatNumber(counts.running);
        this.pendingCount.textContent = utils.formatNumber(counts.pending);
    }

    formatTimestamp(value) {
        if (!value) {
            return '—';
        }

        try {
            const date = new Date(value);
            return date.toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
        } catch (error) {
            return String(value);
        }
    }

    formatDuration(seconds) {
        if (seconds == null || isNaN(seconds)) {
            return '—';
        }

        const secs = Number(seconds);
        if (secs < 60) {
            return `${secs}s`;
        }

        const minutes = Math.floor(secs / 60);
        const remaining = secs % 60;
        return `${minutes}m ${remaining}s`;
    }

    exportExecutions() {
        const rows = this.getFilteredExecutions();
        const csvHead = 'Started,Job,Worker,Status,Duration,Error\n';
        const csvBody = rows.map(exec => {
            const columns = [
                this.formatTimestamp(exec.started_at),
                exec.job_name || exec.job_id || '',
                exec.worker_name || exec.worker_id || '',
                exec.status || '',
                this.formatDuration(exec.duration_seconds),
                exec.error_message || '',
            ].map(value => `"${String(value).replace(/"/g, '""')}"`);
            return columns.join(',');
        }).join('\n');

        const blob = new Blob([csvHead + csvBody], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `execution_history_${new Date().toISOString().slice(0, 10)}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            this.loadExecutions();
        }, 10000);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

window.ExecutionManager = ExecutionManager;

function initializeExecutionManager() {
    if (!window.executionManager && window.ExecutionManager && window.location.pathname === '/executions') {
        window.executionManager = new ExecutionManager();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExecutionManager);
} else {
    initializeExecutionManager();
}
