/**
 * Authentication Module
 * Handles JWT authentication, token management, and auto-logout
 */

class AuthManager {
    constructor() {
        this.tokenCheckInterval = null;
        this.init();
    }

    /**
     * Initialize auth manager
     */
    init() {
        this.checkAuth();
        this.startTokenCheck();
        this.setupAutoLogout();
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        return !!token;
    }

    /**
     * Get current user info
     */
    getUser() {
        try {
            const userData = localStorage.getItem('user');
            return userData ? JSON.parse(userData) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Check authentication and redirect if needed
     */
    checkAuth() {
        const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
        const currentPath = window.location.pathname;
        
        // Skip auth check for public paths
        if (publicPaths.some(path => currentPath.startsWith(path))) {
            return;
        }
        
        // Redirect to login if not authenticated
        if (!this.isAuthenticated()) {
            sessionStorage.setItem('redirect_url', currentPath);
            window.location.href = '/login';
        }
    }

    /**
     * Start periodic token validation
     */
    startTokenCheck() {
        // Check token every 5 minutes
        this.tokenCheckInterval = setInterval(() => {
            if (this.isAuthenticated()) {
                this.validateToken();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Validate current token
     */
    async validateToken() {
        try {
            // Attempt to access a protected endpoint to validate token
            await api.get('/auth/validate');
        } catch (error) {
            if (error.status === 401) {
                this.logout();
            }
        }
    }

    /**
     * Setup auto logout based on token expiry
     */
    setupAutoLogout() {
        // Parse JWT to get expiry time
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        
        if (token) {
            try {
                const payload = this.parseJWT(token);
                
                if (payload && payload.exp) {
                    const expiryTime = payload.exp * 1000; // Convert to milliseconds
                    const currentTime = Date.now();
                    const timeUntilExpiry = expiryTime - currentTime;
                    
                    if (timeUntilExpiry > 0) {
                        // Auto logout 1 minute before token expires
                        const logoutTime = timeUntilExpiry - 60000;
                        
                        if (logoutTime > 0) {
                            setTimeout(() => {
                                this.showSessionExpiryWarning();
                            }, logoutTime);
                        }
                    } else {
                        // Token already expired
                        this.logout();
                    }
                }
            } catch (e) {
                console.error('Error parsing JWT:', e);
            }
        }
    }

    /**
     * Parse JWT token
     */
    parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

    /**
     * Show session expiry warning
     */
    async showSessionExpiryWarning() {
        const result = await Swal.fire({
            title: 'Session Expiring',
            text: 'Your session is about to expire. Would you like to continue?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Continue Session',
            cancelButtonText: 'Logout',
            timer: 30000,
            timerProgressBar: true
        });

        if (result.isConfirmed) {
            // Attempt to refresh the session
            try {
                await api.get('/auth/validate');
                this.setupAutoLogout(); // Reset the timer
            } catch (error) {
                this.logout();
            }
        } else {
            this.logout();
        }
    }

    /**
     * Logout user
     */
    logout() {
        // Clear all auth data
        localStorage.removeItem('access_token');
        localStorage.removeItem('remember_me');
        localStorage.removeItem('user');
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('redirect_url');
        
        // Clear interval
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
        }
        
        // Redirect to login
        window.location.href = '/login';
    }
}

// Create global auth manager instance
const auth = new AuthManager();

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, auth };
}