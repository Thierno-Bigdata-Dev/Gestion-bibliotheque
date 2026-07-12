/**
 * UI Controller
 * Manages DOM updates, modals, and user interactions.
 */

import { appStore } from './store.js';
import { Components } from './components.js';
import { ApiService } from './api.js';

export const UI = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        
        // Listen to store changes
        appStore.subscribe('isOffline', isOffline => this.updateConnectionStatus(isOffline));
        appStore.subscribe('activeTab', tabId => this.renderTab(tabId));
        appStore.subscribe('books', books => this.renderBooks(books));
        appStore.subscribe('users', users => this.renderUsers(users));
        appStore.subscribe('loans', loans => {
            this.renderLoans(loans);
            this.renderDashboardStats();
        });
    },

    cacheDOM() {
        this.dom = {
            tabs: document.querySelectorAll('.menu-item'),
            tabContents: document.querySelectorAll('.tab-content'),
            offlineBanner: document.getElementById('offline-banner'),
            booksList: document.getElementById('books-list'),
            usersList: document.getElementById('users-list'),
            loansList: document.getElementById('loans-list'),
            recentLoansList: document.getElementById('recent-loans-list')
        };
    },

    bindEvents() {
        // Tab navigation
        this.dom.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = tab.getAttribute('data-tab');
                appStore.setState('activeTab', tabId);
            });
        });

        // Sidebar Toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.getElementById('app-root').classList.toggle('sidebar-collapsed');
            });
        }

        // Search inputs
        const bindSearch = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    const queries = appStore.getState('searchQueries');
                    appStore.setState('searchQueries', { ...queries, [key]: e.target.value.toLowerCase() });
                    // Trigger re-render based on search
                    if (key === 'books') this.renderBooks(appStore.getState('books'));
                    if (key === 'users') this.renderUsers(appStore.getState('users'));
                    if (key === 'loans') this.renderLoans(appStore.getState('loans'));
                });
            }
        };

        bindSearch('search-books', 'books');
        bindSearch('search-users', 'users');
        bindSearch('search-loans', 'loans');
    },

    switchTab(tabId) {
        appStore.setState('activeTab', tabId);
    },

    renderTab(tabId) {
        this.dom.tabs.forEach(t => t.classList.remove('active'));
        this.dom.tabContents.forEach(c => c.classList.remove('active'));
        
        const activeNav = document.querySelector(`.menu-item[onclick*="${tabId}"]`);
        const activeContent = document.getElementById(tabId);
        
        if (activeNav) activeNav.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    },

    updateConnectionStatus(isOffline) {
        if (this.dom.offlineBanner) {
            this.dom.offlineBanner.style.display = isOffline ? 'block' : 'none';
        }
    },

    // -----------------------------------------
    // RENDERERS
    // -----------------------------------------
    renderBooks(books) {
        const query = appStore.getState('searchQueries').books;
        const filtered = books.filter(b => 
            b.title.toLowerCase().includes(query) || 
            b.author.toLowerCase().includes(query) || 
            b.isbn.toLowerCase().includes(query)
        );

        this.dom.booksList.innerHTML = '';
        if (filtered.length === 0) {
            this.dom.booksList.innerHTML = Components.getEmptyStateHTML(
                query ? "Aucun livre trouvé pour votre recherche." : "Le catalogue est vide.",
                "Ajoutez des livres pour commencer à gérer votre bibliothèque.",
                "fa-book-open"
            );
            return;
        }

        filtered.forEach(book => {
            const actions = `
                <button class="btn-icon btn-icon-danger" onclick="window.App.deleteBook(${book.id})" title="Supprimer">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            this.dom.booksList.appendChild(Components.createBookRow(book, actions));
        });
    },

    renderUsers(users) {
        const query = appStore.getState('searchQueries').users;
        const filtered = users.filter(u => 
            u.first_name.toLowerCase().includes(query) || 
            u.last_name.toLowerCase().includes(query) || 
            u.email.toLowerCase().includes(query)
        );

        this.dom.usersList.innerHTML = '';
        if (filtered.length === 0) {
            this.dom.usersList.innerHTML = Components.getEmptyStateHTML(
                query ? "Aucun utilisateur trouvé pour votre recherche." : "Aucun utilisateur enregistré.",
                "Créez des profils pour commencer à prêter des livres.",
                "fa-users"
            );
            return;
        }

        filtered.forEach(user => {
            const actions = `
                <button class="btn-icon btn-icon-info" onclick="window.App.viewUserProfile(${user.id})" title="Voir le profil">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button class="btn-icon btn-icon-danger" onclick="window.App.deleteUser(${user.id})" title="Supprimer">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            this.dom.usersList.appendChild(Components.createUserRow(user, actions));
        });
    },

    renderLoans(loans) {
        const query = appStore.getState('searchQueries').loans;
        const filtered = loans.filter(l => {
            const bookTitle = l.book ? l.book.title.toLowerCase() : '';
            const userName = l.user ? `${l.user.first_name} ${l.user.last_name}`.toLowerCase() : '';
            return bookTitle.includes(query) || userName.includes(query);
        });

        this.dom.loansList.innerHTML = '';
        if (filtered.length === 0) {
            this.dom.loansList.innerHTML = Components.getEmptyStateHTML(
                query ? "Aucun emprunt trouvé pour votre recherche." : "Aucun emprunt enregistré.",
                "Les emprunts apparaîtront ici.",
                "fa-hand-holding-hand"
            );
        } else {
            filtered.forEach(loan => {
                let actions = '';
                if (loan.status === 'active') {
                    actions += `
                        <button class="btn-icon btn-icon-success" onclick="window.App.returnBook(${loan.id})" title="Restituer">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button class="btn-icon btn-icon-info" onclick="window.App.renewLoan(${loan.id})" title="Renouveler (+15j)">
                            <i class="fa-solid fa-calendar-plus"></i>
                        </button>
                    `;
                }
                this.dom.loansList.appendChild(Components.createLoanRow(loan, actions));
            });
        }

        // Render Recent Loans in Dashboard
        this.dom.recentLoansList.innerHTML = '';
        const recent = [...loans].sort((a, b) => new Date(b.borrowed_at) - new Date(a.borrowed_at)).slice(0, 5);
        if (recent.length === 0) {
            this.dom.recentLoansList.innerHTML = Components.getEmptyStateHTML("Aucune activité récente", "", "fa-clock");
        } else {
            recent.forEach(loan => {
                const tr = document.createElement('tr');
                const bookTitle = loan.book ? loan.book.title : `Livre #${loan.book_id}`;
                const userName = loan.user ? `${loan.user.first_name} ${loan.user.last_name}` : `Utilisateur #${loan.user_id}`;
                let badgeClass = 'badge-warning';
                let badgeText = 'En cours';
                if (loan.status === 'returned') {
                    badgeClass = 'badge-success'; badgeText = 'Retourné';
                } else if (new Date() > new Date(loan.due_at)) {
                    badgeClass = 'badge-danger'; badgeText = 'En retard';
                    tr.classList.add('row-overdue');
                }
                tr.innerHTML = `
                    <td><strong>${Components.escapeHtml(bookTitle)}</strong></td>
                    <td>${Components.escapeHtml(userName)}</td>
                    <td>${loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString('fr-FR') : '-'}</td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                `;
                this.dom.recentLoansList.appendChild(tr);
            });
        }

        this.renderDashboardChart(loans);
    },

    renderDashboardStats() {
        const books = appStore.getState('books');
        const loans = appStore.getState('loans');
        const users = appStore.getState('users');

        document.getElementById('stat-total-books').textContent = books.length;
        document.getElementById('stat-total-users').textContent = users.length;
        
        const activeLoans = loans.filter(l => l.status === 'active').length;
        document.getElementById('stat-active-loans').textContent = activeLoans;
        
        const returnedLoans = loans.filter(l => l.status === 'returned').length;
        const returnRate = loans.length === 0 ? 0 : Math.round((returnedLoans / loans.length) * 100);
        document.getElementById('stat-return-rate').textContent = `${returnRate}%`;
    },

    renderDashboardChart(loans) {
        const canvas = document.getElementById('loansChart');
        if (!canvas) return;
        
        if (loans.length === 0) {
            if (window.loansChartInstance) window.loansChartInstance.destroy();
            return;
        }
        
        let active = 0, returned = 0, overdue = 0;
        loans.forEach(l => {
            if (l.status === 'returned') returned++;
            else if (new Date() > new Date(l.due_at)) overdue++;
            else active++;
        });
        
        if (window.loansChartInstance) {
            window.loansChartInstance.data.datasets[0].data = [returned, active, overdue];
            window.loansChartInstance.update();
        } else {
            const ctx = canvas.getContext('2d');
            window.loansChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Retournés', 'En cours', 'En retard'],
                    datasets: [{
                        data: [returned, active, overdue],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
            });
        }
    },

    // Modals
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            if (modalId === 'modal-loan') {
                this.populateLoanSelects();
            }
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    customConfirm(message) {
        return new Promise((resolve) => {
            document.getElementById('confirm-modal-message').textContent = message;
            this.openModal('modal-confirm');
            
            const btnOk = document.getElementById('btn-confirm-ok');
            const btnCancel = document.getElementById('btn-confirm-cancel');
            
            const newBtnOk = btnOk.cloneNode(true);
            const newBtnCancel = btnCancel.cloneNode(true);
            btnOk.parentNode.replaceChild(newBtnOk, btnOk);
            btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
            
            newBtnOk.addEventListener('click', () => {
                this.closeModal('modal-confirm');
                resolve(true);
            });
            newBtnCancel.addEventListener('click', () => {
                this.closeModal('modal-confirm');
                resolve(false);
            });
        });
    },

    populateLoanSelects() {
        const bookSelect = document.getElementById('loan-book-select');
        const userSelect = document.getElementById('loan-user-select');
        
        bookSelect.innerHTML = '<option value="">Sélectionnez un livre...</option>';
        appStore.getState('books').forEach(b => {
            if (b.available_quantity > 0) {
                bookSelect.innerHTML += `<option value="${b.id}">${Components.escapeHtml(b.title)} (${b.available_quantity} dispo)</option>`;
            }
        });
        
        userSelect.innerHTML = '<option value="">Sélectionnez un utilisateur...</option>';
        appStore.getState('users').forEach(u => {
            userSelect.innerHTML += `<option value="${u.id}">${Components.escapeHtml(u.first_name)} ${Components.escapeHtml(u.last_name)}</option>`;
        });
    }
};
