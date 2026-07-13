/**
 * Global State Management (Store)
 * Implements a simple reactive PubSub pattern.
 */

class Store {
    constructor() {
        this.state = {
            books: [],
            users: [],
            allUsers: [],
            loans: [],
            isOffline: false,
            isLoading: true,
            activeTab: sessionStorage.getItem('activeTab') || 'dashboard',
            userRole: sessionStorage.getItem('userRole') || null,
            activeStudentId: sessionStorage.getItem('activeStudentId') || null,
            currentUser: JSON.parse(localStorage.getItem('currentUser') || 'null'),
            authToken: localStorage.getItem('authToken') || null,
            searchQueries: {
                books: '',
                users: '',
                loans: ''
            }
        };
        this.listeners = {};
    }

    // Abonnement à des changements d'état
    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);
    }

    // Mise à jour de l'état
    setState(key, value) {
        this.state[key] = value;
        if (['userRole', 'activeStudentId', 'activeTab'].includes(key)) {
            if (value === null) {
                sessionStorage.removeItem(key);
            } else {
                sessionStorage.setItem(key, value);
            }
        }
        this.notify(key, value);
    }

    getState(key) {
        return this.state[key];
    }

    notify(key, value) {
        if (this.listeners[key]) {
            this.listeners[key].forEach(callback => callback(value));
        }
    }
}

export const appStore = new Store();
