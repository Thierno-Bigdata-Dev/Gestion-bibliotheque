/**
 * Auth UI Controller
 * Handles login, register forms and auth screen visibility.
 * Exposes global `authUI` object used by inline HTML events.
 */

import { ApiService } from './api.js?v=16';
import { appStore } from './store.js?v=16';
import { Components } from './components.js?v=16';

export const AuthUI = {
    // ─────────────────────────────────────────────
    // INIT: check token on load
    // ─────────────────────────────────────────────
    init() {
        const token = localStorage.getItem('authToken');
        const user  = JSON.parse(localStorage.getItem('currentUser') || 'null');

        if (token && user) {
            // Restore session : map role → userRole
            this._applySession(user);
            this._hideAuthScreen();
        } else {
            this._showAuthScreen();
        }

        this._bindForms();
    },

    // ─────────────────────────────────────────────
    // FORMS BINDING
    // ─────────────────────────────────────────────
    _bindForms() {
        document.getElementById('form-login')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this._handleLogin();
        });
        document.getElementById('form-register')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this._handleRegister();
        });
    },

    async _handleLogin() {
        const email    = document.getElementById('login-email')?.value.trim();
        const password = document.getElementById('login-password')?.value;
        const errEl    = document.getElementById('login-error');
        const btn      = document.getElementById('btn-login-submit');

        errEl.style.display = 'none';
        btn.disabled = true;
        btn.classList.add('is-loading');
        btn.querySelector('.btn-text').textContent = 'Connexion…';

        try {
            const res = await ApiService.login(email, password);
            // Store token + user
            localStorage.setItem('authToken', res.token);
            localStorage.setItem('currentUser', JSON.stringify(res.user));
            appStore.setState('authToken', res.token);
            appStore.setState('currentUser', res.user);

            this._applySession(res.user);
            this._hideAuthScreen();
            Components.showToast(`Bienvenue, ${res.user.first_name} !`, 'success');
        } catch (err) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.classList.remove('is-loading');
            btn.querySelector('.btn-text').textContent = 'Se connecter';
        }
    },

    async _handleRegister() {
        const data = {
            first_name: document.getElementById('reg-firstname')?.value.trim(),
            last_name:  document.getElementById('reg-lastname')?.value.trim(),
            email:      document.getElementById('reg-email')?.value.trim().toLowerCase(),
            password:   document.getElementById('reg-password')?.value,
            role:       document.getElementById('reg-role')?.value,
        };

        const errEl  = document.getElementById('register-error');
        const succEl = document.getElementById('register-success');
        const btn    = document.getElementById('btn-register-submit');

        errEl.style.display  = 'none';
        succEl.style.display = 'none';
        btn.disabled = true;
        btn.classList.add('is-loading');
        btn.querySelector('.btn-text').textContent = 'Création…';

        try {
            await ApiService.register(data);
            succEl.innerHTML = `✅ Compte créé avec succès ! <br>Votre demande est en attente de validation par un administrateur.`;
            succEl.style.display = 'block';
            document.getElementById('form-register').reset();
        } catch (err) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.classList.remove('is-loading');
            btn.querySelector('.btn-text').textContent = 'Créer mon compte';
        }
    },

    // ─────────────────────────────────────────────
    // SESSION HELPERS
    // ─────────────────────────────────────────────
    _applySession(user) {
        // Map API role → internal userRole
        const role = user.role === 'Admin' ? 'admin' : 'public';
        appStore.setState('userRole', role);
        appStore.setState('currentUser', user);

        // Update sidebar user info if present
        this._updateSidebarUser(user);
    },

    _updateSidebarUser(user) {
        const nameEl   = document.getElementById('sidebar-user-name');
        const roleEl   = document.getElementById('sidebar-user-role');
        const avatarEl = document.getElementById('sidebar-user-avatar');
        if (nameEl) nameEl.textContent = `${user.first_name} ${user.last_name}`;
        if (roleEl) roleEl.textContent = user.role;
        if (avatarEl) avatarEl.textContent = user.first_name?.[0]?.toUpperCase() || '?';
    },

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('activeStudentId');
        appStore.setState('authToken', null);
        appStore.setState('currentUser', null);
        appStore.setState('userRole', null);
        appStore.setState('activeStudentId', null);
        this._showAuthScreen();
    },

    // Catalogue public — now a separate page
    goToCatalog() {
        window.location.href = 'catalogue.html';
    },

    // ─────────────────────────────────────────────
    // OVERLAY VISIBILITY
    // ─────────────────────────────────────────────
    _showAuthScreen() {
        const el = document.getElementById('auth-screen');
        if (el) el.classList.remove('hidden');
        const app = document.getElementById('app-root');
        if (app) app.style.display = 'none';
    },

    _hideAuthScreen() {
        const el = document.getElementById('auth-screen');
        if (el) el.classList.add('hidden');
        const app = document.getElementById('app-root');
        if (app) app.style.display = '';
    },

    // ─────────────────────────────────────────────
    // PUBLIC TAB SWITCHERS (called from inline HTML)
    // ─────────────────────────────────────────────
    showLoginTab() {
        document.getElementById('form-login').style.display = 'flex';
        document.getElementById('form-register').style.display = 'none';
        document.getElementById('tab-login').classList.add('active');
        document.getElementById('tab-register').classList.remove('active');
        document.getElementById('login-error').style.display = 'none';
    },

    showRegisterTab() {
        document.getElementById('form-login').style.display = 'none';
        document.getElementById('form-register').style.display = 'flex';
        document.getElementById('tab-login').classList.remove('active');
        document.getElementById('tab-register').classList.add('active');
        document.getElementById('register-error').style.display = 'none';
        document.getElementById('register-success').style.display = 'none';
    },

    togglePassword(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        const btn = input.parentElement?.querySelector('.btn-toggle-password i');
        if (btn) {
            btn.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        }
    }
};

// Expose globally for inline HTML onclick handlers
window.authUI = AuthUI;
