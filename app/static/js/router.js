class AppRouter {
    constructor() {
        this.currentPath = window.location.pathname;
        this.stateCache = new Map();
        this.transitionTimer = null;
        this.init();
    }

    init() {
        document.addEventListener('click', (event) => {
            const target = event.target.closest('[data-app-link]');
            if (!target) {
                return;
            }

            const href = target.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:')) {
                return;
            }

            const url = new URL(href, window.location.origin);
            if (url.origin !== window.location.origin) {
                return;
            }

            event.preventDefault();
            this.navigate(url.pathname + url.search, { push: true });
        });

        window.addEventListener('popstate', () => {
            this.navigate(window.location.pathname + window.location.search, { push: false });
        });

        this.updateActiveState(this.currentPath);
    }

    async navigate(path, options = {}) {
        const url = new URL(path, window.location.origin);
        const nextPath = `${url.pathname}${url.search}`;

        if (nextPath === this.currentPath && options.push !== true) {
            return;
        }

        this.transitionInProgress = true;
        this.animateTransition();

        const content = await this.fetchPage(nextPath);
        if (!content) {
            this.transitionInProgress = false;
            return;
        }

        this.renderContent(content, nextPath);
        this.updateActiveState(nextPath);
        this.currentPath = nextPath;

        if (options.push !== false) {
            window.history.pushState({ path: nextPath }, '', nextPath);
        }

        this.transitionInProgress = false;
    }

    async fetchPage(path) {
        const cacheKey = path;
        if (this.stateCache.has(cacheKey)) {
            return this.stateCache.get(cacheKey);
        }

        const url = `${path}${path.includes('?') ? '&' : '?'}fragment=1`;
        const response = await fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });

        if (!response.ok) {
            window.location.assign(path);
            return null;
        }

        const html = await response.text();
        this.stateCache.set(cacheKey, html);
        return html;
    }

    async renderContent(html, path) {
        const container = document.querySelector('[data-app-content]');
        if (!container) {
            window.location.assign(path);
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'page-shell';
        wrapper.innerHTML = html;

        const scripts = Array.from(wrapper.querySelectorAll('script'));
        const nextContent = wrapper.querySelector('[data-app-content]') || wrapper;
        const existingContent = container;

        const preserveState = {
            scrollY: window.scrollY,
            path: this.currentPath
        };

        sessionStorage.setItem('app:state', JSON.stringify(preserveState));

        existingContent.classList.add('is-transitioning');
        setTimeout(async () => {
            existingContent.innerHTML = nextContent.innerHTML;
            await this.executeScripts(scripts);
            existingContent.classList.remove('is-transitioning');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            this.reinitializePageScripts(path);
        }, 120);
    }

    executeScripts(scripts) {
        const promises = [];

        scripts.forEach(script => {
            const newScript = document.createElement('script');
            if (script.src) {
                const existing = document.querySelector(`script[src="${script.src}"]`);
                if (existing) {
                    return;
                }

                newScript.src = script.src;
                newScript.async = false;
                promises.push(new Promise(resolve => {
                    newScript.onload = resolve;
                    newScript.onerror = resolve;
                }));
            } else {
                newScript.text = script.textContent;
            }
            document.body.appendChild(newScript);
            newScript.parentNode.removeChild(newScript);
        });

        return Promise.all(promises);
    }

    animateTransition() {
        const container = document.querySelector('[data-app-content]');
        if (!container) {
            return;
        }
        container.classList.add('is-transitioning');
        if (this.transitionTimer) {
            clearTimeout(this.transitionTimer);
        }
        this.transitionTimer = setTimeout(() => {
            container.classList.remove('is-transitioning');
        }, 220);
    }

    updateActiveState(path) {
        const normalized = path.replace(/\?.*$/, '');
        document.querySelectorAll('.nav-item').forEach((item) => {
            const href = item.getAttribute('href');
            if (!href) {
                return;
            }
            const isActive = normalized === href || (href !== '/' && normalized.startsWith(href));
            item.classList.toggle('active', isActive);
        });

        const breadcrumb = document.getElementById('appBreadcrumb');
        if (breadcrumb) {
            const title = path.replace(/\//g, ' ').trim() || 'Home';
            const crumb = document.createElement('li');
            crumb.className = 'breadcrumb-item active';
            crumb.textContent = title.split('/').filter(Boolean).pop() || 'Dashboard';
            const items = breadcrumb.querySelectorAll('.breadcrumb-item.active');
            items.forEach((item) => item.remove());
            breadcrumb.appendChild(crumb);
        }
    }

    reinitializePageScripts(path) {
        // Destroy any existing page-level managers and clear references
        if (window.dashboard && typeof window.dashboard.destroy === 'function') {
            window.dashboard.destroy();
        }
        if (window.jobManager && typeof window.jobManager.destroy === 'function') {
            window.jobManager.destroy();
        }
        if (window.queueManager && typeof window.queueManager.destroy === 'function') {
            window.queueManager.destroy();
        }
        if (window.workerManager && typeof window.workerManager.destroy === 'function') {
            window.workerManager.destroy();
        }
        if (window.executionManager && typeof window.executionManager.destroy === 'function') {
            window.executionManager.destroy();
        }

        // Clear global references so bootstrappers always create fresh instances
        try {
            window.dashboard = undefined;
            window.jobManager = undefined;
            window.queueManager = undefined;
            window.workerManager = undefined;
            window.executionManager = undefined;
        } catch (e) {
            // ignore in environments where window is restricted
        }

        if (window.__appRouteBootstrapped) {
            window.__appRouteBootstrapped = false;
        }

        const scripts = {
            '/dashboard': () => {
                if (!window.dashboard) {
                    window.dashboard = new Dashboard();
                }
            },
            '/jobs': () => {
                if (!window.jobManager) {
                    window.jobManager = new JobManager();
                }
            },
            '/queues': () => {
                if (!window.queueManager) {
                    window.queueManager = new QueueManager();
                }
            },
            '/workers': () => {
                if (!window.workerManager) {
                    window.workerManager = new WorkerManager();
                }
            },
            '/logs': () => {
                if (window.LogViewer && !window.logViewer) {
                    window.logViewer = new LogViewer();
                }
            },
            '/executions': () => {
                if (window.ExecutionManager && !window.executionManager) {
                    window.executionManager = new ExecutionManager();
                }
            }
        };

        // Normalize path to pathname only so querystrings still bootstrap routes
        let pathname = path;
        try {
            pathname = new URL(path, window.location.origin).pathname;
        } catch (e) {
            // fallback to raw path if URL parsing fails
            pathname = path.replace(/\?.*$/, '');
        }

        Object.entries(scripts).forEach(([route, boot]) => {
            if (pathname === route || pathname.startsWith(route + '/')) {
                boot();
            }
        });
    }
}

window.appRouter = new AppRouter();
