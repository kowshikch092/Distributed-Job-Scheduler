/**
 * Utility Functions Module
 * Reusable helper functions, toast notifications, formatters, etc.
 */

class Utils {
    constructor() {
        this.toastContainer = null;
        this.initToastContainer();
    }

    /**
     * Initialize toast notification container
     */
    initToastContainer() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toastContainer')) {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            container.style.zIndex = '1060';
            document.body.appendChild(container);
        }
        this.toastContainer = document.getElementById('toastContainer');
    }

    /**
     * Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - success, error, warning, info
     * @param {number} duration - Duration in milliseconds
     */
    showToast(message, type = 'info', duration = 3000) {
        const icons = {
            success: 'bi-check-circle-fill',
            error: 'bi-x-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        const toastId = 'toast-' + Date.now();
        
        const toastHTML = `
            <div id="${toastId}" class="toast fade-in" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header" style="background: ${colors[type]}; color: white;">
                    <i class="bi ${icons[type]} me-2"></i>
                    <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body" style="background: #1e293b; color: #f1f5f9;">
                    ${message}
                </div>
            </div>
        `;

        this.toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
            delay: duration,
            animation: true
        });
        
        toast.show();
        
        // Remove toast after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    /**
     * Show SweetAlert2 confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} text - Dialog text
     * @param {string} confirmText - Confirm button text
     * @returns {Promise} - Resolves with boolean
     */
    async confirmAction(title = 'Are you sure?', text = '', confirmText = 'Confirm') {
        const result = await Swal.fire({
            title: title,
            text: text,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#6366f1',
            cancelButtonColor: '#64748b',
            confirmButtonText: confirmText,
            cancelButtonText: 'Cancel',
            customClass: {
                popup: 'swal-custom-popup',
                title: 'swal-custom-title',
                confirmButton: 'swal-custom-confirm',
                cancelButton: 'swal-custom-cancel'
            }
        });
        
        return result.isConfirmed;
    }

    /**
     * Format date to readable string
     * @param {string|Date} date - Date to format
     * @param {string} format - Format type (full, short, relative)
     * @returns {string} - Formatted date string
     */
    formatDate(date, format = 'full') {
        const d = new Date(date);
        
        if (format === 'relative') {
            return this.getRelativeTime(d);
        }
        
        const options = {
            full: { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            },
            short: { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            }
        };
        
        return d.toLocaleDateString('en-US', options[format] || options.full);
    }

    /**
     * Get relative time string
     * @param {Date} date - Date to compare
     * @returns {string} - Relative time string
     */
    getRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return this.formatDate(date, 'short');
    }

    /**
     * Format number with commas
     * @param {number} number - Number to format
     * @returns {string} - Formatted number
     */
    formatNumber(number) {
        return new Intl.NumberFormat('en-US').format(number);
    }

    /**
     * Escape HTML to safely render user-provided content
     * @param {string} value - Raw text to escape
     * @returns {string} - Escaped HTML string
     */
    escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    /**
     * Format bytes to human readable size
     * @param {number} bytes - Bytes to format
     * @returns {string} - Formatted size
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Limit in milliseconds
     * @returns {Function} - Throttled function
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} - Is valid email
     */
    validateEmail(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    /**
     * Generate random ID
     * @param {number} length - ID length
     * @returns {string} - Random ID
     */
    generateId(length = 8) {
        return Math.random().toString(36).substring(2, length + 2);
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise} - Resolves when copied
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!', 'success', 2000);
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                this.showToast('Copied to clipboard!', 'success', 2000);
            } catch (err) {
                this.showToast('Failed to copy to clipboard', 'error', 3000);
            }
            document.body.removeChild(textarea);
        }
    }

    /**
     * Initialize DataTable with default configuration
     * @param {string} selector - CSS selector for table
     * @param {object} options - DataTable options
     * @returns {object} - DataTable instance
     */
    initDataTable(selector, options = {}) {
        const defaultOptions = {
            responsive: true,
            pageLength: 25,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
            language: {
                search: '<i class="bi bi-search"></i>',
                searchPlaceholder: 'Search...',
                lengthMenu: 'Show _MENU_ entries',
                info: 'Showing _START_ to _END_ of _TOTAL_ entries',
                paginate: {
                    first: '<i class="bi bi-chevron-double-left"></i>',
                    last: '<i class="bi bi-chevron-double-right"></i>',
                    previous: '<i class="bi bi-chevron-left"></i>',
                    next: '<i class="bi bi-chevron-right"></i>'
                }
            },
            dom: '<"row mb-3"<"col-md-6"l><"col-md-6"f>>rt<"row mt-3"<"col-md-6"i><"col-md-6"p>>',
            ...options
        };
        
        return $(selector).DataTable(defaultOptions);
    }

    /**
     * Initialize ApexChart with default theme
     * @param {string} selector - CSS selector for chart container
     * @param {object} options - Chart options
     * @returns {object} - ApexCharts instance
     */
    initChart(selector, options = {}) {
        const defaultOptions = {
            chart: {
                type: 'line',
                height: 350,
                background: 'transparent',
                foreColor: '#94a3b8',
                toolbar: {
                    show: true,
                    tools: {
                        download: true,
                        selection: true,
                        zoom: true,
                        zoomin: true,
                        zoomout: true,
                        pan: true,
                        reset: true
                    }
                },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                }
            },
            theme: {
                mode: 'dark',
                palette: 'palette1'
            },
            grid: {
                borderColor: '#334155',
                strokeDashArray: 4
            },
            tooltip: {
                theme: 'dark'
            },
            ...options
        };
        
        return new ApexCharts(document.querySelector(selector), defaultOptions);
    }

    /**
     * Set page loading state
     * @param {boolean} isLoading - Loading state
     */
    setPageLoading(isLoading) {
        const existingLoader = document.getElementById('pageLoader');
        
        if (isLoading) {
            if (!existingLoader) {
                const loaderHTML = `
                    <div id="pageLoader" class="page-loader">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', loaderHTML);
                
                // Add styles dynamically
                const style = document.createElement('style');
                style.textContent = `
                    .page-loader {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(15, 23, 42, 0.8);
                        backdrop-filter: blur(5px);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 9999;
                    }
                `;
                document.head.appendChild(style);
            }
        } else if (existingLoader) {
            existingLoader.remove();
        }
    }

    /**
     * Handle API error and show appropriate message
     * @param {Error} error - Error object
     * @param {string} fallbackMessage - Fallback error message
     */
    handleError(error, fallbackMessage = 'An unexpected error occurred') {
        console.error('Error:', error);
        
        let message = fallbackMessage;
        
        if (error.status === 401) {
            // Already handled by API client
            return;
        } else if (error.status === 403) {
            message = 'You do not have permission to perform this action';
        } else if (error.status === 404) {
            message = 'The requested resource was not found';
        } else if (error.status === 422) {
            message = error.data?.detail || 'Validation error';
        } else if (error.status >= 500) {
            message = 'A server error occurred. Please try again later.';
        } else if (error.message) {
            message = error.message;
        }
        
        this.showToast(message, 'error', 5000);
    }
}

// Create global utils instance
const utils = new Utils();

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Utils, utils };
}

// Add SweetAlert2 custom styles
const swalStyles = document.createElement('style');
swalStyles.textContent = `
    .swal-custom-popup {
        background: #1e293b !important;
        border: 1px solid #334155 !important;
        border-radius: 16px !important;
        color: #f1f5f9 !important;
    }
    
    .swal-custom-title {
        color: #f1f5f9 !important;
    }
    
    .swal-custom-confirm {
        background: #6366f1 !important;
        border-radius: 8px !important;
        padding: 10px 24px !important;
        font-weight: 600 !important;
    }
    
    .swal-custom-cancel {
        background: #475569 !important;
        border-radius: 8px !important;
        padding: 10px 24px !important;
        font-weight: 600 !important;
        color: #f1f5f9 !important;
    }
    
    .swal2-timer-progress-bar {
        background: #6366f1 !important;
    }
`;
document.head.appendChild(swalStyles);