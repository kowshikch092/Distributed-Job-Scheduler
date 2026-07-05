(function () {
    const STORAGE_KEY = 'job_scheduler_nav_state';

    function readState() {
        try {
            return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function writeState(state) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function getCurrentPageKey() {
        return window.location.pathname.replace(/\/+$/, '') || '/dashboard';
    }

    function updateActiveLink() {
        const currentPage = getCurrentPageKey();
        document.querySelectorAll('.sidebar .nav-item, .sidebar .sidebar-brand').forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;
            const normalized = href.replace(/\/+$/, '');
            const isActive = normalized === currentPage || (normalized !== '/dashboard' && currentPage.startsWith(normalized));
            link.classList.toggle('active', isActive);
        });
    }

    function rememberCurrentState() {
        const state = readState();
        const pageKey = getCurrentPageKey();
        state[pageKey] = {
            ...(state[pageKey] || {}),
            path: pageKey,
            lastVisited: Date.now(),
            scrollY: window.scrollY,
            hash: window.location.hash || ''
        };
        writeState(state);
    }

    function restoreState() {
        const pageKey = getCurrentPageKey();
        const state = readState()[pageKey] || {};
        if (state.scrollY != null) {
            window.scrollTo({ top: state.scrollY, behavior: 'auto' });
        }
    }

    function persistFilterState() {
        document.querySelectorAll('[data-nav-persist]').forEach((element) => {
            const key = element.getAttribute('data-nav-persist');
            const value = element.type === 'checkbox' ? element.checked : element.value;
            const state = readState();
            const pageKey = getCurrentPageKey();
            state[pageKey] = state[pageKey] || {};
            state[pageKey][key] = value;
            writeState(state);
        });
    }

    function restoreFilterState() {
        const pageKey = getCurrentPageKey();
        const state = readState()[pageKey] || {};
        document.querySelectorAll('[data-nav-persist]').forEach((element) => {
            const key = element.getAttribute('data-nav-persist');
            if (state[key] === undefined) return;
            if (element.type === 'checkbox') {
                element.checked = Boolean(state[key]);
            } else {
                element.value = state[key];
            }
        });
    }

    function persistTabState() {
        document.querySelectorAll('[data-nav-tab]').forEach((tab) => {
            if (tab.classList.contains('active')) {
                const state = readState();
                const pageKey = getCurrentPageKey();
                state[pageKey] = state[pageKey] || {};
                state[pageKey].activeTab = tab.getAttribute('data-nav-tab');
                writeState(state);
            }
        });
    }

    function restoreTabState() {
        const pageKey = getCurrentPageKey();
        const state = readState()[pageKey] || {};
        const activeTab = state.activeTab;
        if (!activeTab) return;
        document.querySelectorAll(`[data-nav-tab="${activeTab}"]`).forEach((element) => {
            element.classList.add('active');
            element.click();
        });
    }

    function persistPaginationState() {
        document.querySelectorAll('[data-nav-page]').forEach((element) => {
            const state = readState();
            const pageKey = getCurrentPageKey();
            state[pageKey] = state[pageKey] || {};
            state[pageKey].pagination = element.value || element.textContent;
            writeState(state);
        });
    }

    function restorePaginationState() {
        const pageKey = getCurrentPageKey();
        const state = readState()[pageKey] || {};
        if (!state.pagination) return;
        document.querySelectorAll('[data-nav-page]').forEach((element) => {
            if (element.value === state.pagination || element.textContent === state.pagination) {
                element.value = state.pagination;
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        updateActiveLink();
        restoreFilterState();
        restoreTabState();
        restorePaginationState();
        restoreState();

        document.addEventListener('input', (event) => {
            const target = event.target;
            if (target.matches('[data-nav-persist]')) {
                persistFilterState();
            }
        }, true);

        document.addEventListener('change', (event) => {
            const target = event.target;
            if (target.matches('[data-nav-persist]')) {
                persistFilterState();
            }
            if (target.matches('[data-nav-page]')) {
                persistPaginationState();
            }
            if (target.matches('[data-nav-tab]')) {
                persistTabState();
            }
        }, true);

        window.addEventListener('scroll', rememberCurrentState, { passive: true });
        window.addEventListener('beforeunload', rememberCurrentState);
        window.addEventListener('pageshow', restoreState);
    });
})();
