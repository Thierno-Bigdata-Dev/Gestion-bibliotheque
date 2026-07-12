/**
 * Global State Management (Store)
 * Implements a simple reactive PubSub pattern.
 */

class Store {
    constructor() {
        this.state = {
            books: [],
            users: [],
            loans: [],
            isOffline: false,
            activeTab: 'dashboard',
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
