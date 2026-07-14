/**
 * Application Entry Point (Main)
 * Bootstraps the application, links UI and API, and exposes global methods for inline HTML events.
 */

import { ApiService } from './api.js?v=6';
import { appStore } from './store.js?v=6';
import { UI } from './ui.js?v=6';
import { Components } from './components.js?v=6';
import { AuthUI } from './auth.js?v=6';

class App {
    async init() {
        AuthUI.init();           // Show auth screen or restore session
        UI.init();
        await this.loadAllData();
        this.bindForms();
        this.bindPortalEvents();
        this.startAutoPolling();
    }

    async loadAllData() {
        appStore.setState('isLoading', true);
        try {
            appStore.setState('isOffline', false);
            
            // Promise.all for parallel fetching
            const role = appStore.getState('userRole');
            
            const promises = [
                ApiService.getBooks(),
                ApiService.getUsers(),
                ApiService.getLoans()
            ];
            
            if (role === 'admin') {
                promises.push(ApiService.getAllUsers());
            }
            
            const results = await Promise.all(promises);
            const books = results[0];
            const users = results[1];
            const loans = results[2];
            
            appStore.setState('books', books);
            appStore.setState('users', users);
            appStore.setState('loans', loans);
            
            if (role === 'admin') {
                appStore.setState('allUsers', results[3]);
            }
            
        } catch (error) {
            console.error(error);
            appStore.setState('isOffline', true);
            Components.showToast("Erreur de Connexion avec le backend.", "danger");
        } finally {
            appStore.setState('isLoading', false);
        }
    }

    // Export CSV logic
    exportToCSV(filename, rows) {
        const processRow = function(row) {
            let finalVal = '';
            for (let j = 0; j < row.length; j++) {
                let innerValue = row[j] === null || row[j] === undefined ? '' : row[j].toString();
                let result = innerValue.replace(/"/g, '""');
                if (result.search(/("|,|\n)/g) >= 0) result = '"' + result + '"';
                if (j > 0) finalVal += ',';
                finalVal += result;
            }
            return finalVal + '\n';
        };

        let csvFile = '\uFEFF'; 
        for (let i = 0; i < rows.length; i++) {
            csvFile += processRow(rows[i]);
        }

        const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) { 
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Exposed Global Methods for HTML inline handlers
    exportBooksCSV() {
        const rows = [["ID", "Titre", "Auteur", "ISBN", "Année", "Quantité Totale", "Disponible"]];
        appStore.getState('books').forEach(b => {
            rows.push([b.id, b.title, b.author, b.isbn, b.published_year || '', b.quantity, b.available_quantity]);
        });
        this.exportToCSV(`inventaire_livres.csv`, rows);
    }

    exportUsersCSV() {
        const rows = [["ID", "Prénom", "Nom", "Email", "Rôle"]];
        appStore.getState('users').forEach(u => {
            rows.push([u.id, u.first_name, u.last_name, u.email, u.role]);
        });
        this.exportToCSV(`utilisateurs.csv`, rows);
    }

    exportLoansCSV() {
        const rows = [["ID", "Livre", "Emprunteur", "Statut"]];
        appStore.getState('loans').forEach(l => {
            const bookTitle = l.book ? l.book.title : `Livre #${l.book_id}`;
            const userName = l.user ? `${l.user.first_name} ${l.user.last_name}` : `Utilisateur #${l.user_id}`;
            rows.push([l.id, bookTitle, userName, l.status]);
        });
        this.exportToCSV(`historique_emprunts.csv`, rows);
    }

    async deleteBook(id) {
        if (!await UI.customConfirm("Voulez-vous retirer définitivement cet ouvrage du catalogue ?")) return;
        try {
            await ApiService.deleteBook(id);
            Components.showToast("Livre supprimé.", "success");
            this.loadAllData();
        } catch (err) {
            Components.showToast(err.message, "danger");
        }
    }

    async deleteUser(id) {
        if (!await UI.customConfirm("Voulez-vous supprimer définitivement ce profil ?")) return;
        try {
            await ApiService.deleteUser(id);
            Components.showToast("Utilisateur supprimé.", "success");
            this.loadAllData();
        } catch (err) {
            Components.showToast(err.message, "danger");
        }
    }

    async validateUser(id) {
        try {
            await ApiService.validateUser(id);
            Components.showToast("Compte validé avec succès.", "success");
            this.loadAllData();
        } catch (err) {
            Components.showToast(err.message, "danger");
        }
    }

    async rejectUser(id) {
        if (!await UI.customConfirm("Voulez-vous rejeter cette demande de compte ?")) return;
        try {
            await ApiService.rejectUser(id);
            Components.showToast("Compte rejeté.", "warning");
            this.loadAllData();
        } catch (err) {
            Components.showToast(err.message, "danger");
        }
    }

    async suspendUser(id) {
        if (!await UI.customConfirm("Voulez-vous suspendre ce compte (l'utilisateur ne pourra plus se connecter) ?")) return;
        try {
            await ApiService.suspendUser(id);
            Components.showToast("Compte suspendu.", "warning");
            this.loadAllData();
        } catch (err) {
            Components.showToast(err.message, "danger");
        }
    }

    async returnBook(id) {
        if (!await UI.customConfirm("Confirmer la restitution ?")) return;
        try {
            await ApiService.returnLoan(id);
            Components.showToast("Livre restitué avec succès.", "success");
            this.loadAllData();
        } catch (e) {
            Components.showToast("Erreur lors de la restitution.", "danger");
        }
    }

    async renewLoan(id) {
        if (!await UI.customConfirm("Voulez-vous renouveler cet emprunt (+15 jours) ?")) return;
        try {
            await ApiService.renewLoan(id);
            Components.showToast("Emprunt renouvelé avec succès.", "success");
            this.loadAllData();
        } catch (e) {
            Components.showToast("Erreur lors du renouvellement.", "danger");
        }
    }

    viewUserProfile(id) {
        UI.viewUserProfile(id);
    }

    bindForms() {
        document.getElementById('form-book')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }
            
            const data = {
                title: document.getElementById('book-title').value,
                author: document.getElementById('book-author').value,
                isbn: document.getElementById('book-isbn').value,
                published_year: parseInt(document.getElementById('book-year').value),
                quantity: parseInt(document.getElementById('book-qty').value)
            };
            try {
                await ApiService.createBook(data);
                Components.showToast("Livre ajouté au catalogue !", "success");
                UI.closeModal('modal-book');
                e.target.reset();
                this.loadAllData();
            } catch (err) {
                Components.showToast(err.message, "danger");
            } finally {
                if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
            }
        });

        document.getElementById('form-user')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }

            const data = {
                first_name: document.getElementById('user-firstname').value,
                last_name: document.getElementById('user-lastname').value,
                email: document.getElementById('user-email').value,
                role: document.getElementById('user-role').value
            };
            try {
                await ApiService.createUser(data);
                Components.showToast("Utilisateur créé avec succès !", "success");
                UI.closeModal('modal-user');
                e.target.reset();
                this.loadAllData();
            } catch (err) {
                Components.showToast(err.message, "danger");
            } finally {
                if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
            }
        });

        document.getElementById('form-loan')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }

            const data = {
                book_id: parseInt(document.getElementById('loan-book-select').value),
                user_id: parseInt(document.getElementById('loan-user-select').value)
            };
            try {
                await ApiService.createLoan(data);
                Components.showToast("Emprunt enregistré avec succès !", "success");
                UI.closeModal('modal-loan');
                e.target.reset();
                this.loadAllData();
            } catch (err) {
                Components.showToast(err.message, "danger");
            } finally {
                if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
            }
        });
    }

    bindPortalEvents() {
        // Logout (also called by AuthUI directly)
        document.getElementById('btn-logout')?.addEventListener('click', () => {
            AuthUI.logout();
        });
        // Student profile selector
        document.getElementById('student-select')?.addEventListener('change', (e) => {
            appStore.setState('activeStudentId', e.target.value || null);
        });
    }

    reserveBook(title) {
        Components.showToast(`Demande de réservation enregistrée pour : "${title}".`, "success");
    }

    startAutoPolling() {
        // Poll every 10 seconds to update dashboard in real-time
        setInterval(() => this.loadAllData(), 10000);
    }
}

// Global Exports
const app = new App();

// Export required methods to window so inline HTML works without changing index.html completely.
window.App = app;
window.exportBooksCSV = () => app.exportBooksCSV();
window.exportUsersCSV = () => app.exportUsersCSV();
window.exportLoansCSV = () => app.exportLoansCSV();
window.openModal = (id) => UI.openModal(id);
window.closeModal = (id) => UI.closeModal(id);
window.switchTab = (id) => UI.switchTab(id);
window.loadAllData = () => app.loadAllData();

document.addEventListener('DOMContentLoaded', () => app.init());
