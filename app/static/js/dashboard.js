/**
 * Dashboard Module
 * Handles all dashboard functionality, charts, tables, and real-time updates
 */

class Dashboard {
    constructor() {
        this.charts = {};
        this.tables = {};
        this.refreshInterval = null;
        this.currentTrendPeriod = '7d';
        this.isDarkMode = true;
        
        this.init();
    }

    /**
     * Initialize dashboard
     */
    async init() {
        this.setupGreeting();
        this.startLiveClock();
        this.loadDarkModePreference();
        this.setupEventListeners();
        await this.loadDashboardData();
        this.startAutoRefresh();
    }

    /**
     * Setup greeting based on time of day
     */
    setupGreeting() {
        const hour = new Date().getHours();
        let greeting;
        
        if (hour >= 5 && hour < 12) {
            greeting = 'Good Morning';
        } else if (hour >= 12 && hour < 17) {
            greeting = 'Good Afternoon';
        } else if (hour >= 17 && hour < 22) {
            greeting = 'Good Evening';
        } else {
            greeting = 'Good Night';
        }
        
        document.getElementById('greetingText').textContent = greeting;
        
        // Set user name from stored data
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                if (fullName) {
                    document.getElementById('dashboardUserName').textContent = fullName;
                }
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
    }

    /**
     * Start live clock
     */
    startLiveClock() {
        const updateClock = () => {
            const now = new Date();
            
            // Update time
            const timeString = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            document.getElementById('liveClock').textContent = timeString;
            
            // Update date
            const dateString = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            document.getElementById('liveDate').textContent = dateString;
        };
        
        updateClock();
        setInterval(updateClock, 1000);
    }

    /**
     * Load dark mode preference
     */
    loadDarkModePreference() {
        const darkMode = localStorage.getItem('darkMode');
        
        if (darkMode === 'false') {
            this.isDarkMode = false;
            document.body.classList.add('light-mode');
            document.getElementById('darkModeToggle').classList.add('light-mode');
            document.getElementById('darkModeToggle').querySelector('i').classList.remove('bi-moon-stars-fill');
            document.getElementById('darkModeToggle').querySelector('i').classList.add('bi-sun-fill');
        }
    }

    /**
     * Toggle dark/light mode
     */
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        const toggleBtn = document.getElementById('darkModeToggle');
        const icon = toggleBtn.querySelector('i');
        
        if (this.isDarkMode) {
            document.body.classList.remove('light-mode');
            toggleBtn.classList.remove('light-mode');
            icon.classList.remove('bi-sun-fill');
            icon.classList.add('bi-moon-stars-fill');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.add('light-mode');
            toggleBtn.classList.add('light-mode');
            icon.classList.remove('bi-moon-stars-fill');
            icon.classList.add('bi-sun-fill');
            localStorage.setItem('darkMode', 'false');
        }
        
        // Update charts with new theme
        this.updateChartsTheme();
    }

    /**
     * Update charts theme based on dark/light mode
     */
    updateChartsTheme() {
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.updateOptions) {
                chart.updateOptions({
                    theme: {
                        mode: this.isDarkMode ? 'dark' : 'light'
                    }
                });
            }
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Dark mode toggle
        document.getElementById('darkModeToggle').addEventListener('click', () => {
            this.toggleDarkMode();
        });
        
        // Refresh button
        document.getElementById('refreshDashboard').addEventListener('click', async () => {
            const refreshBtn = document.getElementById('refreshDashboard');
            refreshBtn.classList.add('refreshing');
            
            await this.loadDashboardData();
            
            setTimeout(() => {
                refreshBtn.classList.remove('refreshing');
            }, 1000);
        });
        
        // Stat card click events
        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('click', function() {
                const label = this.querySelector('.stat-label').textContent.toLowerCase();
                const routes = {
                    'total jobs': '/jobs',
                    'running jobs': '/jobs?status=running',
                    'completed': '/jobs?status=completed',
                    'failed': '/jobs?status=failed',
                    'workers': '/workers',
                    'queues': '/queues'
                };
                
                if (routes[label]) {
                    window.appRouter?.navigate(routes[label]);
                }
            });
        });
    }

    /**
     * Load all dashboard data
     */
    async loadDashboardData() {
        try {
            utils.setPageLoading(true);
            
            // Fetch dashboard stats
            const statsResponse = await api.get('/dashboard/stats');
            
            if (statsResponse) {
                this.updateStatsCards(statsResponse);
                this.updateCharts(statsResponse);
            }
            
            // Fetch additional data for tables
            await Promise.all([
                this.loadRecentJobs(),
                this.loadWorkers(),
                this.loadQueues()
            ]);
            
            // Show success toast on manual refresh
            if (document.getElementById('refreshDashboard').classList.contains('refreshing')) {
                utils.showToast('Dashboard updated successfully', 'success', 2000);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            utils.handleError(error, 'Failed to load dashboard data');
            
            // Show error state in cards
            this.showErrorState();
        } finally {
            utils.setPageLoading(false);
            this.removeSkeletons();
        }
    }

    /**
     * Update statistics cards with animation
     */
    updateStatsCards(data) {
        const stats = [
            { id: 'totalJobs', value: data.total_jobs || 0, trend: data.jobs_trend || 0, trendId: 'totalJobsTrend' },
            { id: 'runningJobs', value: data.running_jobs || 0, label: 'Active', labelId: 'runningJobsLabel' },
            { id: 'completedJobs', value: data.completed_jobs || 0, trend: data.completed_trend || 0, trendId: 'completedJobsTrend' },
            { id: 'failedJobs', value: data.failed_jobs || 0, trend: data.failed_trend || 0, trendId: 'failedJobsTrend' },
            { id: 'workersOnline', value: data.workers_online || 0, label: 'Online', labelId: 'workersOnlineLabel' },
            { id: 'totalQueues', value: data.active_queues || 0, label: 'Active', labelId: 'totalQueuesLabel' }
        ];
        
        stats.forEach(stat => {
            const element = document.getElementById(stat.id);
            if (element) {
                // Remove skeleton
                element.innerHTML = '';
                
                // Animate counter
                this.animateCounter(element, stat.value);
                
                // Update trend if exists
                if (stat.trendId) {
                    const trendElement = document.getElementById(stat.trendId);
                    if (trendElement) {
                        const trendValue = stat.trend;
                        const trendPrefix = trendValue >= 0 ? '+' : '';
                        trendElement.textContent = `${trendPrefix}${trendValue}%`;
                        
                        // Update trend color
                        const trendParent = trendElement.parentElement;
                        if (trendValue > 0) {
                            trendParent.className = 'stat-trend text-success';
                            trendParent.querySelector('i').className = 'bi bi-arrow-up-short';
                        } else if (trendValue < 0) {
                            trendParent.className = 'stat-trend text-danger';
                            trendParent.querySelector('i').className = 'bi bi-arrow-down-short';
                        }
                    }
                }
                
                // Update label if exists
                if (stat.labelId) {
                    const labelElement = document.getElementById(stat.labelId);
                    if (labelElement) {
                        labelElement.textContent = stat.label;
                    }
                }
            }
        });
    }

    /**
     * Animate counter from 0 to target value
     */
    animateCounter(element, targetValue) {
        const duration = 1000; // 1 second
        const startTime = performance.now();
        const startValue = 0;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(startValue + (targetValue - startValue) * easeProgress);
            
            element.textContent = utils.formatNumber(currentValue);
            element.classList.add('counter-animate');
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    /**
     * Update all charts
     */
    updateCharts(data) {
        this.createJobStatusChart(data);
        this.createWorkerUtilizationChart(data);
        this.createQueueThroughputChart(data);
        this.createJobCompletionTrendChart(data);
    }

    /**
     * Create Job Status Distribution Pie Chart
     */
    createJobStatusChart(data) {
        const options = {
            series: [
                data.running_jobs || 0,
                data.completed_jobs || 0,
                data.failed_jobs || 0,
                data.pending_jobs || 0
            ],
            chart: {
                type: 'donut',
                height: 300,
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                }
            },
            labels: ['Running', 'Completed', 'Failed', 'Pending'],
            colors: ['#3b82f6', '#10b981', '#ef4444', '#f59e0b'],
            plotOptions: {
                pie: {
                    donut: {
                        size: '70%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Total Jobs',
                                formatter: function(w) {
                                    return utils.formatNumber(w.globals.seriesTotals.reduce((a, b) => a + b, 0));
                                }
                            }
                        }
                    }
                }
            },
            legend: {
                position: 'bottom',
                horizontalAlign: 'center',
                fontSize: '13px',
                markers: {
                    width: 12,
                    height: 12
                }
            },
            tooltip: {
                y: {
                    formatter: function(value) {
                        return utils.formatNumber(value) + ' jobs';
                    }
                }
            },
            responsive: [{
                breakpoint: 480,
                options: {
                    chart: {
                        height: 250
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }]
        };
        
        this.renderChart('jobStatusChart', options);
    }

    /**
     * Create Worker Utilization Chart
     */
    createWorkerUtilizationChart(data) {
        const workers = data.workers || [];
        const workerNames = workers.map(w => w.name || `Worker ${w.id}`);
        const workerUtil = workers.map(w => w.utilization || Math.floor(Math.random() * 100));
        
        const options = {
            series: [{
                name: 'Utilization',
                data: workerUtil.length > 0 ? workerUtil : [0, 0, 0, 0, 0]
            }],
            chart: {
                type: 'bar',
                height: 300,
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                }
            },
            plotOptions: {
                bar: {
                    borderRadius: 8,
                    borderRadiusApplication: 'end',
                    distributed: true,
                    columnWidth: '60%'
                }
            },
            dataLabels: {
                enabled: false
            },
            xaxis: {
                categories: workerNames.length > 0 ? workerNames : ['Worker 1', 'Worker 2', 'Worker 3', 'Worker 4', 'Worker 5'],
                labels: {
                    style: {
                        fontSize: '11px'
                    }
                }
            },
            yaxis: {
                max: 100,
                labels: {
                    formatter: function(value) {
                        return value + '%';
                    }
                }
            },
            colors: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
            tooltip: {
                y: {
                    formatter: function(value) {
                        return value + '% utilization';
                    }
                }
            }
        };
        
        this.renderChart('workerUtilChart', options);
    }

    /**
     * Create Queue Throughput Chart
     */
    createQueueThroughputChart(data) {
        const queues = data.queues || [];
        const queueNames = queues.map(q => q.name || `Queue ${q.id}`);
        const throughput = queues.map(q => q.throughput || Math.floor(Math.random() * 100));
        
        const options = {
            series: [{
                name: 'Jobs/Hour',
                data: throughput.length > 0 ? throughput : [0, 0, 0, 0]
            }],
            chart: {
                type: 'line',
                height: 300,
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                }
            },
            stroke: {
                curve: 'smooth',
                width: 3
            },
            markers: {
                size: 5,
                hover: {
                    size: 8
                }
            },
            xaxis: {
                categories: queueNames.length > 0 ? queueNames : ['Queue 1', 'Queue 2', 'Queue 3', 'Queue 4'],
                labels: {
                    style: {
                        fontSize: '11px'
                    }
                }
            },
            yaxis: {
                labels: {
                    formatter: function(value) {
                        return utils.formatNumber(value);
                    }
                }
            },
            tooltip: {
                y: {
                    formatter: function(value) {
                        return utils.formatNumber(value) + ' jobs/hour';
                    }
                }
            }
        };
        
        this.renderChart('queueThroughputChart', options);
    }

    /**
     * Create Job Completion Trend Chart
     */
    createJobCompletionTrendChart(data) {
        const trendData = data.completion_trend || this.generateMockTrendData();
        
        const options = {
            series: [
                {
                    name: 'Completed',
                    data: trendData.completed
                },
                {
                    name: 'Failed',
                    data: trendData.failed
                }
            ],
            chart: {
                type: 'area',
                height: 400,
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                },
                stacked: true
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            fill: {
                type: 'gradient',
                gradient: {
                    opacityFrom: 0.6,
                    opacityTo: 0.1
                }
            },
            colors: ['#10b981', '#ef4444'],
            xaxis: {
                categories: trendData.dates,
                labels: {
                    style: {
                        fontSize: '11px'
                    }
                }
            },
            yaxis: {
                labels: {
                    formatter: function(value) {
                        return utils.formatNumber(value);
                    }
                }
            },
            legend: {
                position: 'top',
                horizontalAlign: 'right'
            },
            tooltip: {
                y: {
                    formatter: function(value) {
                        return utils.formatNumber(value) + ' jobs';
                    }
                }
            }
        };
        
        this.renderChart('jobCompletionTrendChart', options);
    }

    /**
     * Generate mock trend data
     */
    generateMockTrendData() {
        const dates = [];
        const completed = [];
        const failed = [];
        const now = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            completed.push(Math.floor(Math.random() * 50) + 20);
            failed.push(Math.floor(Math.random() * 10) + 1);
        }
        
        return { dates, completed, failed };
    }

    /**
     * Update trend period and refresh chart
     */
    async updateTrendPeriod(period, buttonElement) {
        this.currentTrendPeriod = period;
        
        // Update active button
        const buttonGroup = buttonElement.parentElement;
        buttonGroup.querySelectorAll('.btn').forEach(btn => {
            btn.classList.remove('active');
        });
        buttonElement.classList.add('active');
        
        // Fetch data for new period
        try {
            const response = await api.get(`/dashboard/stats?period=${period}`);
            if (response && response.completion_trend) {
                this.createJobCompletionTrendChart(response);
            } else {
                this.createJobCompletionTrendChart({
                    completion_trend: this.generateMockTrendData()
                });
            }
            
            utils.showToast(`Showing data for last ${period.replace('d', ' days')}`, 'info', 2000);
        } catch (error) {
            console.error('Error updating trend:', error);
            this.createJobCompletionTrendChart({
                completion_trend: this.generateMockTrendData()
            });
        }
    }

    /**
     * Render or update chart
     */
    renderChart(chartId, options) {
        const chartElement = document.querySelector(`#${chartId}`);
        if (!chartElement) return;
        
        // Clear skeleton
        chartElement.innerHTML = '';
        
        // Destroy existing chart if exists
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
        }
        
        // Create new chart
        const chart = new ApexCharts(chartElement, options);
        chart.render();
        this.charts[chartId] = chart;
    }

    /**
     * Refresh specific chart
     */
    async refreshChart(chartId) {
        try {
            const response = await api.get('/dashboard/stats');
            if (response) {
                switch(chartId) {
                    case 'jobStatusChart':
                        this.createJobStatusChart(response);
                        break;
                    case 'workerUtilChart':
                        this.createWorkerUtilizationChart(response);
                        break;
                    case 'queueThroughputChart':
                        this.createQueueThroughputChart(response);
                        break;
                    case 'jobCompletionTrendChart':
                        this.createJobCompletionTrendChart(response);
                        break;
                }
                utils.showToast('Chart updated', 'success', 2000);
            }
        } catch (error) {
            utils.handleError(error, 'Failed to refresh chart');
        }
    }

    /**
     * Load recent jobs table
     */
    async loadRecentJobs() {
        try {
            const response = await api.get('/jobs/?limit=10');
            
            if (response && response.length > 0) {
                this.populateRecentJobsTable(response.slice(0, 5));
            } else {
                this.showEmptyTable('recentJobsTable', 'No recent jobs found');
            }
        } catch (error) {
            console.error('Error loading recent jobs:', error);
            this.showEmptyTable('recentJobsTable', 'Failed to load jobs');
        }
    }

    /**
     * Populate recent jobs table
     */
    populateRecentJobsTable(jobs) {
        const tableBody = document.querySelector('#recentJobsTable tbody');
        tableBody.innerHTML = '';
        
        jobs.forEach(job => {
            const statusClass = this.getStatusClass(job.status);
            const row = `
                <tr>
                    <td>
                        <span class="text-monospace">#${job.id}</span>
                    </td>
                    <td>
                        <span class="fw-medium">${utils.escapeHtml(job.name || 'Unnamed Job')}</span>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            <i class="bi bi-${this.getStatusIcon(job.status)}"></i>
                            ${job.status || 'Unknown'}
                        </span>
                    </td>
                    <td>
                        <span class="text-muted">${utils.escapeHtml(job.worker || 'Unassigned')}</span>
                    </td>
                    <td>
                        <span class="text-muted">${utils.formatDate(job.created_at, 'relative')}</span>
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
        
        // Initialize DataTable
        if (this.tables.recentJobs) {
            this.tables.recentJobs.destroy();
        }
        this.tables.recentJobs = utils.initDataTable('#recentJobsTable', {
            pageLength: 5,
            lengthChange: false,
            searching: false,
            info: false,
            order: [[4, 'desc']]
        });
    }

    /**
     * Load workers table
     */
    async loadWorkers() {
        try {
            const response = await api.get('/workers/');
            
            if (response && response.length > 0) {
                this.populateWorkersTable(response.slice(0, 5));
            } else {
                this.showEmptyTable('workersTable', 'No workers found');
            }
        } catch (error) {
            console.error('Error loading workers:', error);
            this.showEmptyTable('workersTable', 'Failed to load workers');
        }
    }

    /**
     * Populate workers table
     */
    populateWorkersTable(workers) {
        const tableBody = document.querySelector('#workersTable tbody');
        tableBody.innerHTML = '';
        
        workers.forEach(worker => {
            const statusClass = worker.status === 'online' ? 'online' : (worker.status === 'busy' ? 'busy' : 'offline');
            const row = `
                <tr>
                    <td>
                        <span class="text-monospace">#${worker.id}</span>
                    </td>
                    <td>
                        <span class="fw-medium">${utils.escapeHtml(worker.name || `Worker ${worker.id}`)}</span>
                    </td>
                    <td>
                        <div class="worker-status">
                            <span class="status-dot ${statusClass}"></span>
                            <span>${worker.status || 'Unknown'}</span>
                        </div>
                    </td>
                    <td>
                        <span class="text-muted">${utils.escapeHtml(worker.queue || 'None')}</span>
                    </td>
                    <td>
                        <span class="text-muted">${worker.uptime || 'N/A'}</span>
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
        
        // Initialize DataTable
        if (this.tables.workers) {
            this.tables.workers.destroy();
        }
        this.tables.workers = utils.initDataTable('#workersTable', {
            pageLength: 5,
            lengthChange: false,
            searching: false,
            info: false,
            order: [[0, 'asc']]
        });
    }

    /**
     * Load queues table
     */
    async loadQueues() {
        try {
            const response = await api.get('/queues/');
            
            if (response && response.length > 0) {
                this.populateQueuesTable(response.slice(0, 5));
            } else {
                this.showEmptyTable('queuesTable', 'No queues found');
            }
        } catch (error) {
            console.error('Error loading queues:', error);
            this.showEmptyTable('queuesTable', 'Failed to load queues');
        }
    }

    /**
     * Populate queues table
     */
    populateQueuesTable(queues) {
        const tableBody = document.querySelector('#queuesTable tbody');
        tableBody.innerHTML = '';
        
        queues.forEach(queue => {
            const row = `
                <tr>
                    <td>
                        <span class="fw-medium">${utils.escapeHtml(queue.name || 'Unnamed Queue')}</span>
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
                    <td>
                        <span>${queue.workers || 0}</span>
                    </td>
                    <td>
                        <span class="text-muted">${queue.avg_time || 'N/A'}</span>
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
        
        // Initialize DataTable
        if (this.tables.queues) {
            this.tables.queues.destroy();
        }
        this.tables.queues = utils.initDataTable('#queuesTable', {
            pageLength: 10,
            lengthChange: true,
            order: [[1, 'desc']]
        });
    }

    /**
     * Get status CSS class
     */
    getStatusClass(status) {
        const statusMap = {
            'completed': 'status-completed',
            'running': 'status-running',
            'pending': 'status-pending',
            'failed': 'status-failed',
            'queued': 'status-queued'
        };
        return statusMap[status?.toLowerCase()] || 'status-pending';
    }

    /**
     * Get status icon
     */
    getStatusIcon(status) {
        const iconMap = {
            'completed': 'check-circle',
            'running': 'play-circle',
            'pending': 'clock',
            'failed': 'x-circle',
            'queued': 'hourglass-split'
        };
        return iconMap[status?.toLowerCase()] || 'circle';
    }

    /**
     * Show empty table state
     */
    showEmptyTable(tableId, message) {
        const tableBody = document.querySelector(`#${tableId} tbody`);
        const colSpan = document.querySelector(`#${tableId} thead tr`).children.length;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="${colSpan}" class="text-center py-5">
                    <div class="empty-state">
                        <i class="bi bi-inbox fs-1 text-muted"></i>
                        <p class="text-muted mt-2 mb-0">${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Show error state in cards
     */
    showErrorState() {
        const statIds = ['totalJobs', 'runningJobs', 'completedJobs', 'failedJobs', 'workersOnline', 'totalQueues'];
        statIds.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.querySelector('.skeleton-loader')) {
                element.innerHTML = '<span class="text-danger">--</span>';
            }
        });
    }

    /**
     * Remove skeleton loaders
     */
    removeSkeletons() {
        document.querySelectorAll('.skeleton-loader').forEach(skeleton => {
            skeleton.style.display = 'none';
        });
    }

    /**
     * Start auto refresh
     */
    startAutoRefresh() {
        // Refresh dashboard data every 30 seconds
        this.refreshInterval = setInterval(async () => {
            try {
                const response = await api.get('/dashboard/stats');
                if (response) {
                    this.updateStatsCards(response);
                    // Only update stats, don't reload tables to avoid disruption
                }
            } catch (error) {
                console.error('Auto refresh error:', error);
            }
        }, 30000);
    }

    /**
     * Stop auto refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Cleanup on page unload
     */
    destroy() {
        this.stopAutoRefresh();
        
        // Destroy all charts
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        
        // Destroy all DataTables
        Object.values(this.tables).forEach(table => {
            if (table && table.destroy) {
                table.destroy();
            }
        });
        
        this.charts = {};
        this.tables = {};
    }
}

// Create global dashboard instance
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (dashboard) {
        dashboard.destroy();
    }
});

// Add escapeHtml utility if not exists in utils
if (!utils.escapeHtml) {
    utils.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}