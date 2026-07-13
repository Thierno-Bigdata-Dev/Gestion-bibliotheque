/**
 * API Service Layer
 * Handles all network requests, retries, and formatting.
 * Supports JWT authentication via Authorization header.
 */

const API_URLS = {
    books: '/api/books',
    users: '/api/users',
    loans: '/api/loans',
    auth: '/api/users/auth'
};

export const ApiService = {
    // ─────────────────────────────────────────────
    // CORE REQUEST METHOD
    // ─────────────────────────────────────────────
    async request(url, options = {}, retries = 2, backoff = 500) {
        const timeout = 8000;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        // Auto-inject JWT token if present
        const token = localStorage.getItem('authToken');
        const defaultHeaders = { 'Content-Type': 'application/json' };
        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }

        const defaultOptions = {
            headers: { ...defaultHeaders, ...(options.headers || {}) },
            signal: controller.signal
        };

        try {
            const response = await fetch(url, { ...options, ...defaultOptions });
            clearTimeout(id);

            let data = null;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            }

            if (response.status === 401) {
                // Token expired or invalid → force logout
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                window.location.reload();
                throw new Error('Session expirée. Veuillez vous reconnecter.');
            }

            if (!response.ok) {
                const errMsg = (data && data.error) ? data.error : `Erreur Serveur HTTP ${response.status}`;
                throw new Error(errMsg);
            }
            return data;
        } catch (err) {
            clearTimeout(id);
            // Retry logic for network failures or timeouts on GET requests
            if (retries > 0 && (!options.method || options.method === 'GET')) {
                console.warn(`[API] Retrying ${url} in ${backoff}ms... (${retries} attempts left)`);
                await new Promise(res => setTimeout(res, backoff));
                return this.request(url, options, retries - 1, backoff * 2);
            }
            
            if (err.name === 'AbortError') {
                throw new Error("Délai de connexion dépassé (Timeout API). Veuillez vérifier votre connexion.");
            }
            if (err.message === 'Failed to fetch') {
                throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion internet.");
            }
            throw err;
        }
    },

    // ─────────────────────────────────────────────
    // AUTH METHODS
    // ─────────────────────────────────────────────
    async login(email, password) {
        return this.request(`${API_URLS.auth}/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    async register(data) {
        return this.request(`${API_URLS.auth}/register`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getMe() {
        return this.request(`${API_URLS.auth}/me`);
    },

    // ─────────────────────────────────────────────
    // BOOKS
    // ─────────────────────────────────────────────
    async getBooks() {
        return this.request(API_URLS.books);
    },
    async createBook(data) {
        return this.request(API_URLS.books, { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteBook(id) {
        return this.request(`${API_URLS.books}/${id}`, { method: 'DELETE' });
    },

    // ─────────────────────────────────────────────
    // USERS
    // ─────────────────────────────────────────────
    async getUsers() {
        return this.request(API_URLS.users);
    },
    async getPendingUsers() {
        return this.request(`${API_URLS.users}/pending`);
    },
    async getAllUsers() {
        return this.request(`${API_URLS.users}/all`);
    },
    async createUser(data) {
        return this.request(API_URLS.users, { method: 'POST', body: JSON.stringify(data) });
    },
    async validateUser(id) {
        return this.request(`${API_URLS.users}/${id}/validate`, { method: 'PUT' });
    },
    async rejectUser(id) {
        return this.request(`${API_URLS.users}/${id}/reject`, { method: 'PUT' });
    },
    async suspendUser(id) {
        return this.request(`${API_URLS.users}/${id}/suspend`, { method: 'PUT' });
    },
    async deleteUser(id) {
        return this.request(`${API_URLS.users}/${id}`, { method: 'DELETE' });
    },

    // ─────────────────────────────────────────────
    // LOANS
    // ─────────────────────────────────────────────
    async getLoans() {
        return this.request(API_URLS.loans);
    },
    async createLoan(data) {
        return this.request(API_URLS.loans, { method: 'POST', body: JSON.stringify(data) });
    },
    async returnLoan(id) {
        return this.request(`${API_URLS.loans}/${id}/return`, { method: 'POST' });
    },
    async renewLoan(id) {
        return this.request(`${API_URLS.loans}/${id}/renew`, { method: 'POST' });
    }
};
