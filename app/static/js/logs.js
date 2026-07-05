/**
 * Log Viewer
 * Handles the log page behavior and keeps rendering logic out of the template.
 */

class LogViewer {
    constructor() {
        this.isPaused = false;
        this.logs = [];
        this.filteredLogs = [];
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.loadLogs();
        this.startAutoRefresh();
    }

    cacheElements() {
        this.viewer = document.getElementById('logViewer');
        this.levelFilter = document.getElementById('logLevelFilter');
        this.sourceFilter = document.getElementById('logSourceFilter');
        this.timeFilter = document.getElementById('logTimeFilter');
        this.searchInput = document.getElementById('logSearch');
        this.pauseBtn = document.getElementById('pauseLogsBtn');
        this.downloadBtn = document.getElementById('downloadLogsBtn');
        this.clearBtn = document.getElementById('clearLogsBtn');
        this.totalCount = document.getElementById('totalLogEntries');
        this.errorCount = document.getElementById('errorLogCount');
        this.warningCount = document.getElementById('warningLogCount');
        this.infoCount = document.getElementById('infoLogCount');
        this.logCount = document.getElementById('logCount');
    }

    setupEventListeners() {
        this.pauseBtn?.addEventListener('click', () => this.togglePause());
        this.downloadBtn?.addEventListener('click', () => this.downloadLogs());
        this.clearBtn?.addEventListener('click', () => this.clearLogs());
        this.levelFilter?.addEventListener('change', () => this.applyFilters());
        this.sourceFilter?.addEventListener('change', () => this.applyFilters());
        this.timeFilter?.addEventListener('change', () => this.loadLogs());
        this.searchInput?.addEventListener('input', utils.debounce(() => this.applyFilters(), 300));
    }

    async loadLogs() {
        try {
            const timeRange = this.timeFilter?.value || '15m';
            const response = await api.get(`/logs?range=${timeRange}`);
            if (response && Array.isArray(response.logs)) {
                this.logs = response.logs;
                this.updateStats();
                this.applyFilters();
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            if (this.viewer) {
                this.viewer.innerHTML = `
                    <div class="text-center text-danger py-5">
                        <i class="bi bi-exclamation-triangle fs-1"></i>
                        <p class="mt-2">Failed to load logs</p>
                    </div>
                `;
            }
        }
    }

    updateStats() {
        const errors = this.logs.filter(l => l.level === 'error').length;
        const warnings = this.logs.filter(l => l.level === 'warning').length;
        const infos = this.logs.filter(l => l.level === 'info').length;
        this.totalCount && (this.totalCount.textContent = utils.formatNumber(this.logs.length));
        this.errorCount && (this.errorCount.textContent = utils.formatNumber(errors));
        this.warningCount && (this.warningCount.textContent = utils.formatNumber(warnings));
        this.infoCount && (this.infoCount.textContent = utils.formatNumber(infos));
    }

    applyFilters() {
        const level = this.levelFilter?.value || '';
        const source = this.sourceFilter?.value || '';
        const search = this.searchInput?.value.toLowerCase() || '';
        this.filteredLogs = this.logs.filter(log => {
            if (level && log.level !== level) return false;
            if (source && log.source !== source) return false;
            if (search && !String(log.message || '').toLowerCase().includes(search)) return false;
            return true;
        });
        this.renderLogs();
    }

    renderLogs() {
        if (!this.viewer) return;
        this.logCount && (this.logCount.textContent = String(this.filteredLogs.length));
        if (this.filteredLogs.length === 0) {
            this.viewer.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-inbox fs-1"></i>
                    <p class="mt-2">No logs match the current filters</p>
                </div>
            `;
            return;
        }
        this.viewer.innerHTML = this.filteredLogs.map(log => `
            <div class="log-entry">
                <span class="log-timestamp">${this.formatTimestamp(log.timestamp)}</span>
                <span class="log-level ${utils.escapeHtml(log.level || '')}">[${utils.escapeHtml(String(log.level || '').toUpperCase())}]</span>
                <span class="log-source">[${utils.escapeHtml(log.source || 'system')} ]</span>
                <span class="log-message">${utils.escapeHtml(log.message || '')}</span>
            </div>
        `).join('');
        if (document.getElementById('autoScroll')?.checked) {
            this.viewer.scrollTop = this.viewer.scrollHeight;
        }
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (!this.pauseBtn) return;
        if (this.isPaused) {
            this.pauseBtn.innerHTML = '<i class="bi bi-play-fill"></i> Resume';
            this.pauseBtn.classList.add('btn-outline-success');
            this.pauseBtn.classList.remove('btn-outline-secondary');
        } else {
            this.pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
            this.pauseBtn.classList.add('btn-outline-secondary');
            this.pauseBtn.classList.remove('btn-outline-success');
            this.loadLogs();
        }
    }

    downloadLogs() {
        const content = this.filteredLogs.map(log =>
            `[${this.formatTimestamp(log.timestamp)}] [${String(log.level || '').toUpperCase()}] [${log.source || 'system'}] ${log.message || ''}`
        ).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        utils.showToast('Logs downloaded', 'success');
    }

    async clearLogs() {
        const confirmed = await utils.confirmAction('Clear Logs', 'Are you sure you want to clear all logs?', 'Clear');
        if (!confirmed) return;
        try {
            await api.delete('/logs');
            this.logs = [];
            this.filteredLogs = [];
            this.renderLogs();
            this.updateStats();
            utils.showToast('Logs cleared', 'success');
        } catch (error) {
            utils.handleError(error);
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            if (!this.isPaused) {
                this.loadLogs();
            }
        }, 5000);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

window.LogViewer = LogViewer;

function initializeLogViewer() {
    if (!window.logViewer && window.LogViewer && window.location.pathname === '/logs') {
        window.logViewer = new LogViewer();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLogViewer);
} else {
    initializeLogViewer();
}
