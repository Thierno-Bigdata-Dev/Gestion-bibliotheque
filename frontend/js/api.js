/**
 * API Service Layer
 * Handles all network requests, retries, and formatting.
 */

const API_URLS = {
    books: '/api/books',
    users: '/api/users',
    loans: '/api/loans'
};

export const ApiService = {
    async request(url, options = {}) {
        const timeout = 6000;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        const defaultOptions = {
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            clearTimeout(id);
            
            let data = null;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            }
            
            if (!response.ok) {
                const errMsg = (data && data.error) ? data.error : `HTTP ${response.status}`;
                throw new Error(errMsg);
            }
            return data;
        } catch (err) {
            clearTimeout(id);
            if (err.name === 'AbortError') {
                throw new Error("Délai de connexion dépassé (Timeout API)");
            }
            throw err;
        }
    },

    // Resources specifics
    async getBooks() {
        return this.request(API_URLS.books);
    },
    async createBook(data) {
        return this.request(API_URLS.books, { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteBook(id) {
        return this.request(`${API_URLS.books}/${id}`, { method: 'DELETE' });
    },

    async getUsers() {
        return this.request(API_URLS.users);
    },
    async createUser(data) {
        return this.request(API_URLS.users, { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteUser(id) {
        return this.request(`${API_URLS.users}/${id}`, { method: 'DELETE' });
    },

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
