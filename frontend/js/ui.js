/**
 * UI Controller
 * Manages DOM updates, modals, and user interactions.
 */

import { appStore } from './store.js?v=14';
import { Components } from './components.js?v=14';
import { ApiService } from './api.js?v=14';

export const UI = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.startClock();
        
        // Listen to store changes
        appStore.subscribe('isOffline', isOffline => this.updateConnectionStatus(isOffline));
        appStore.subscribe('activeTab', tabId => this.renderTab(tabId));
        appStore.subscribe('books', books => {
            this.renderBooks(books);
            if (appStore.getState('userRole') === 'public') {
                this.renderAvailableBooks(books);
            }
        });
        appStore.subscribe('users', users => {
            this.renderUsers(users);
        });
        appStore.subscribe('loans', loans => {
            this.renderLoans(loans);
            this.renderDashboardStats();
            if (appStore.getState('userRole') === 'public') {
                this.renderMyLoans(loans);
            }
        });
        appStore.subscribe('userLoans', userLoans => {
            // Only relevant in public (student/teacher) mode
            if (appStore.getState('userRole') === 'public') {
                UI._myLoansAll = userLoans || [];
                UI.renderMyLoans(userLoans || []);
            }
        });
        appStore.subscribe('userRole', role => {
            this.handleRoleChange(role);
            if (role === 'public') {
                this.renderStudentPortal();
            }
        });
        appStore.subscribe('activeStudentId', studentId => this.renderStudentProfile(studentId));
        appStore.subscribe('allUsers', users => this.renderPendingTab(users));
        appStore.subscribe('isLoading', isLoading => {
            const announcer = document.getElementById('a11y-announcer');
            if (isLoading) {
                if (announcer) announcer.textContent = 'Chargement des données en cours...';
                this.renderBooks([]);
                this.renderUsers([]);
                this.renderLoans([]);
                this.renderPendingTab([]);
            } else {
                if (announcer) announcer.textContent = 'Chargement terminé.';
                this.renderBooks(appStore.getState('books'));
                this.renderUsers(appStore.getState('users'));
                this.renderLoans(appStore.getState('loans'));
                this.renderPendingTab(appStore.getState('allUsers'));
                if (appStore.getState('userRole') === 'public') {
                    this.renderStudentPortal();
                }
            }
        });

        // Initial setup from persisted store
        const initialRole = appStore.getState('userRole');
        this.handleRoleChange(initialRole);
        this.renderTab(appStore.getState('activeTab'));
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
        
        const activeNav = document.querySelector(`.menu-item[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(`tab-${tabId}`);
        
        if (activeNav) {
            activeNav.classList.add('active');
            
            // Update page header text
            const titleEl = document.getElementById('page-title');
            const subTitleEl = document.getElementById('page-subtitle');
            
            if (titleEl && activeNav.dataset.title) {
                titleEl.textContent = activeNav.dataset.title;
            }
            if (subTitleEl && activeNav.dataset.subtitle) {
                subTitleEl.textContent = activeNav.dataset.subtitle;
            }
        }
        
        if (activeContent) {
            activeContent.classList.add('active');
        }
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
        if (appStore.getState('isLoading')) {
            this.dom.booksList.innerHTML = Components.getSkeletonRowHTML(8).repeat(5);
            return;
        }

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

        const role = appStore.getState('userRole');
        filtered.forEach(book => {
            let actions = '';
            if (role === 'admin') {
                actions = `
                    <button class="btn-icon btn-icon-danger" onclick="window.App.deleteBook(${book.id})" title="Supprimer">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
            } else {
                const isAvailable = book.available_quantity > 0;
                actions = isAvailable ? `
                    <button class="btn btn-primary btn-sm" onclick="window.App.reserveBook('${book.title.replace(/'/g, "\\'")}')" style="padding: 6px 12px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-calendar-plus"></i> Réserver
                    </button>
                ` : `
                    <button class="btn btn-secondary btn-sm" disabled style="padding: 6px 12px; font-size: 11px; opacity: 0.6;">
                        Indisponible
                    </button>
                `;
            }
            this.dom.booksList.appendChild(Components.createBookRow(book, actions));
        });
    },

    renderCatalog(books) {
        const container = document.getElementById('catalog-container');
        if (!container) return;

        if (appStore.getState('isLoading')) {
            container.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin fa-3x" style="color:var(--primary)"></i><p>Chargement du catalogue...</p></div>';
            return;
        }

        container.innerHTML = '';
        if (books.length === 0) {
            container.innerHTML = Components.getEmptyStateHTML(
                "Catalogue vide",
                "Aucun livre n'est disponible pour le moment.",
                "fa-book-open"
            );
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'catalog-grid';

        books.forEach(book => {
            const card = Components.createBookCard(book);
            grid.appendChild(card);
        });

        container.appendChild(grid);
    },

    renderUsers(users) {
        if (appStore.getState('isLoading')) {
            this.dom.usersList.innerHTML = Components.getSkeletonRowHTML(6).repeat(5);
            return;
        }

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
        if (appStore.getState('isLoading')) {
            this.dom.loansList.innerHTML = Components.getSkeletonRowHTML(8).repeat(5);
            return;
        }

        const query = appStore.getState('searchQueries').loans;
        const filtered = loans.filter(l => {
            const bTitle = l.book ? l.book.title.toLowerCase() : '';
            const uName = l.user ? `${l.user.first_name} ${l.user.last_name}`.toLowerCase() : '';
            return bTitle.includes(query) || uName.includes(query);
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
                        <button class="btn-icon btn-icon-success" onclick="window.App.returnLoan(${loan.id})" title="Restituer">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button class="btn-icon btn-icon-info" onclick="window.App.renewLoan(${loan.id})" title="Renouveler (+15j)">
                            <i class="fa-solid fa-calendar-plus"></i>
                        </button>
                    `;
                } else if (loan.status === 'pending') {
                    actions += `
                        <button class="btn-icon btn-icon-success" onclick="window.App.approveLoan(${loan.id})" title="Approuver l'emprunt">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button class="btn-icon btn-icon-danger" onclick="window.App.rejectLoan(${loan.id})" title="Rejeter la demande">
                            <i class="fa-solid fa-xmark"></i>
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
                } else if (loan.status === 'pending') {
                    badgeClass = 'badge-warning'; badgeText = 'En attente';
                } else if (new Date() > new Date(loan.due_at)) {
                    badgeClass = 'badge-danger'; badgeText = 'En retard';
                    tr.classList.add('row-overdue');
                }

                let actions = '';
                if (loan.status === 'active') {
                    actions += `<button class="btn-icon btn-icon-success" onclick="window.App.returnLoan(${loan.id})" title="Restituer"><i class="fa-solid fa-check"></i></button>`;
                } else if (loan.status === 'pending') {
                    actions += `<button class="btn-icon btn-icon-success" onclick="window.App.approveLoan(${loan.id})" title="Approuver"><i class="fa-solid fa-check"></i></button>
                                <button class="btn-icon btn-icon-danger" onclick="window.App.rejectLoan(${loan.id})" title="Rejeter"><i class="fa-solid fa-xmark"></i></button>`;
                }

                tr.innerHTML = `
                    <td><strong>${Components.escapeHtml(bookTitle)}</strong></td>
                    <td>${Components.escapeHtml(userName)}</td>
                    <td>${loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString('fr-FR') : '-'}</td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                    <td><div style="display:flex;gap:4px;">${actions}</div></td>
                `;
                this.dom.recentLoansList.appendChild(tr);
            });
        }

        this.renderDashboardChart(loans);
    },

    renderPendingTab(allUsers = null) {
        if (!allUsers && appStore.getState('allUsers')) {
            allUsers = appStore.getState('allUsers');
        }
        if (!allUsers) allUsers = [];
        
        const pendingTableBody = document.getElementById('pending-table-body');
        const allAccountsBody = document.getElementById('all-accounts-body');
        
        if (!pendingTableBody || !allAccountsBody) return;

        if (appStore.getState('isLoading')) {
            pendingTableBody.innerHTML = Components.getSkeletonRowHTML(6).repeat(3);
            allAccountsBody.innerHTML = Components.getSkeletonRowHTML(7).repeat(3);
            return;
        }

        const pendingUsers = allUsers.filter(u => u.status === 'EN_ATTENTE');
        
        // Update stats
        document.getElementById('pending-stat-count').textContent = pendingUsers.length;
        document.getElementById('active-stat-count').textContent = allUsers.filter(u => u.status === 'ACTIF').length;
        document.getElementById('rejected-stat-count').textContent = allUsers.filter(u => u.status === 'REJETÉ').length;
        
        // Update menu badge
        const badge = document.getElementById('pending-count-badge');
        if (badge) {
            badge.textContent = pendingUsers.length;
            badge.style.display = pendingUsers.length > 0 ? 'inline-block' : 'none';
        }

        // Render Pending Table
        pendingTableBody.innerHTML = '';
        if (pendingUsers.length === 0) {
            pendingTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;padding:40px;color:var(--text-secondary);">
                        <i class="fa-solid fa-user-clock" style="font-size:32px;margin-bottom:12px;opacity:0.4;display:block;"></i>
                        Aucun compte en attente de validation.
                    </td>
                </tr>
            `;
        } else {
            pendingUsers.forEach(user => {
                const tr = document.createElement('tr');
                const reqDate = user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '-';
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td><strong>${Components.escapeHtml(user.first_name + ' ' + user.last_name)}</strong></td>
                    <td>${Components.escapeHtml(user.email)}</td>
                    <td><span class="badge badge-info">${Components.escapeHtml(user.role)}</span></td>
                    <td>${reqDate}</td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button class="btn btn-primary btn-sm" onclick="window.App.validateUser(${user.id})" title="Valider le compte">
                                <i class="fa-solid fa-check"></i> Valider
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="window.App.rejectUser(${user.id})" style="background:#ef4444;border-color:#ef4444;color:white;" title="Rejeter la demande">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </td>
                `;
                pendingTableBody.appendChild(tr);
            });
        }

        // Render All Accounts Table
        const statusFilter = document.getElementById('accounts-filter-status')?.value;
        let filteredAccounts = allUsers;
        if (statusFilter) {
            filteredAccounts = filteredAccounts.filter(u => u.status === statusFilter);
        }

        allAccountsBody.innerHTML = '';
        if (filteredAccounts.length === 0) {
            allAccountsBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;">Aucun compte trouvé.</td></tr>`;
        } else {
            filteredAccounts.forEach(user => {
                const tr = document.createElement('tr');
                const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('fr-FR') : 'Jamais';
                
                let statusBadge = 'badge-secondary';
                if (user.status === 'ACTIF') statusBadge = 'badge-success';
                else if (user.status === 'EN_ATTENTE') statusBadge = 'badge-warning';
                else if (user.status === 'REJETÉ' || user.status === 'SUSPENDU') statusBadge = 'badge-danger';
                
                let actions = '';
                if (user.id !== appStore.getState('currentUser')?.id) {
                    if (user.status === 'EN_ATTENTE') {
                        actions = `<button class="btn-icon btn-icon-success" onclick="window.App.validateUser(${user.id})" title="Valider"><i class="fa-solid fa-check"></i></button>`;
                    } else if (user.status === 'ACTIF') {
                        actions = `<button class="btn-icon btn-icon-danger" onclick="window.App.suspendUser(${user.id})" title="Suspendre"><i class="fa-solid fa-ban"></i></button>`;
                    } else if (user.status === 'SUSPENDU') {
                        actions = `<button class="btn-icon btn-icon-success" onclick="window.App.validateUser(${user.id})" title="Réactiver"><i class="fa-solid fa-play"></i></button>`;
                    }
                    actions += `<button class="btn-icon btn-icon-danger" onclick="window.App.deleteUser(${user.id})" title="Supprimer"><i class="fa-solid fa-trash"></i></button>`;
                }
                
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td><strong>${Components.escapeHtml(user.first_name + ' ' + user.last_name)}</strong></td>
                    <td>${Components.escapeHtml(user.email)}</td>
                    <td>${Components.escapeHtml(user.role)}</td>
                    <td><span class="badge ${statusBadge}">${user.status || 'INCONNU'}</span></td>
                    <td style="font-size:12px;color:var(--text-secondary)">${lastLogin}</td>
                    <td><div style="display:flex;gap:4px;">${actions}</div></td>
                `;
                allAccountsBody.appendChild(tr);
            });
        }
    },

    renderDashboardStats() {
        const books = appStore.getState('books');
        const loans = appStore.getState('loans');
        const users = appStore.getState('users');

        document.getElementById('stat-total-books').textContent = books.length;
        document.getElementById('stat-total-users').textContent = users.length;

        const students = users.filter(u => u.role === 'Etudiant').length;
        const teachers = users.filter(u => u.role === 'Enseignant').length;
        const studentLabel = students > 1 ? 'étudiants' : 'étudiant';
        const teacherLabel = teachers > 1 ? 'enseignants' : 'enseignant';
        document.getElementById('stat-users-detail').textContent = `${students} ${studentLabel} / ${teachers} ${teacherLabel}`;
        
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
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            
            document.body.style.overflow = 'hidden';
            if (modalId === 'modal-loan') {
                this.populateLoanSelects();
            }
            
            // A11y: set focus on the first input or the close button
            setTimeout(() => {
                const focusable = modal.querySelector('input, select, textarea, button');
                if (focusable) focusable.focus();
            }, 100);
            
            // Basic focus trap
            modal.addEventListener('keydown', this.handleFocusTrap);
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            modal.removeEventListener('keydown', this.handleFocusTrap);
        }
    },

    handleFocusTrap(e) {
        if (e.key === 'Escape') {
            UI.closeModal(e.currentTarget.id);
            return;
        }
        if (e.key === 'Tab') {
            const focusableEls = e.currentTarget.querySelectorAll('a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled])');
            if (!focusableEls.length) return;
            const first = focusableEls[0];
            const last = focusableEls[focusableEls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                last.focus();
                e.preventDefault();
            } else if (!e.shiftKey && document.activeElement === last) {
                first.focus();
                e.preventDefault();
            }
        }
    },

    viewUserProfile(userId) {
        const user = appStore.getState('users').find(u => u.id === userId);
        if (!user) return;

        const loans = appStore.getState('loans').filter(l => l.user_id === userId);

        document.getElementById('prof-full-name').textContent = `${user.first_name || ''} ${user.last_name || user.name || ''}`;
        document.getElementById('prof-role').textContent = user.role || 'Étudiant';
        document.getElementById('prof-email').textContent = user.email;
        document.getElementById('prof-id').textContent = `#${user.id}`;
        document.getElementById('prof-created').textContent = user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '-';

        const listEl = document.getElementById('prof-loans-list');
        listEl.innerHTML = '';
        if (loans.length === 0) {
            listEl.innerHTML = '<tr><td colspan="4" style="text-align: center;">Aucun emprunt enregistré.</td></tr>';
        } else {
            loans.forEach(loan => {
                const bookTitle = loan.book ? loan.book.title : `Livre #${loan.book_id}`;
                const bDate = loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString('fr-FR') : '-';
                const rDate = loan.returned_at ? new Date(loan.returned_at).toLocaleDateString('fr-FR') : '-';
                
                let badgeClass = 'badge-warning';
                let badgeText = 'En cours';
                if (loan.status === 'returned') {
                    badgeClass = 'badge-success';
                    badgeText = 'Retourné';
                } else if (new Date() > new Date(loan.due_at)) {
                    badgeClass = 'badge-danger';
                    badgeText = 'En retard';
                }

                listEl.innerHTML += `
                    <tr>
                        <td><strong>${Components.escapeHtml(bookTitle)}</strong></td>
                        <td>${bDate}</td>
                        <td>${rDate}</td>
                        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                    </tr>
                `;
            });
        }
        
        this.openModal('modal-user-profile');
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
    },

    handleRoleChange(role) {
        const selector = document.getElementById('portal-selector');
        const appRoot = document.getElementById('app-root');
        if (!role) {
            if (selector) selector.style.display = 'flex';
            if (appRoot) appRoot.style.display = 'none';
        } else {
            if (selector) selector.style.display = 'none';
            if (appRoot) appRoot.style.display = 'flex';

            document.body.classList.remove('mode-public', 'mode-admin');
            document.body.classList.add(`mode-${role}`);

            // Redirect to correct default tab
            const currentTab = appStore.getState('activeTab');
            if (role === 'public' && (currentTab === 'dashboard' || currentTab === 'users' || currentTab === 'loans' || currentTab === 'books' || currentTab === 'catalog')) {
                appStore.setState('activeTab', 'student-portal');
            } else if (role === 'admin' && (currentTab === 'student-portal' || currentTab === 'catalog')) {
                appStore.setState('activeTab', 'dashboard');
            }

            this.renderBooks(appStore.getState('books'));
        }
    },

    populateStudentDropdown(users) {
        const select = document.getElementById('student-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- Choisir un compte étudiant/enseignant --</option>';
        users.forEach(u => {
            select.innerHTML += `<option value="${u.id}">${Components.escapeHtml(u.first_name)} ${Components.escapeHtml(u.last_name)} (${u.role})</option>`;
        });
        const activeStudentId = appStore.getState('activeStudentId');
        if (activeStudentId) {
            select.value = activeStudentId;
        }
    },

    renderStudentProfile(studentId) {
        const profileView = document.getElementById('student-profile-view');
        const footerName = document.getElementById('active-student-name');
        
        if (!studentId) {
            if (profileView) profileView.classList.add('hidden');
            if (footerName) footerName.textContent = 'Lecteur Public';
            return;
        }

        const student = appStore.getState('users').find(u => u.id === Number(studentId));
        if (!student) {
            if (profileView) profileView.classList.add('hidden');
            if (footerName) footerName.textContent = 'Lecteur Public';
            return;
        }

        if (profileView) profileView.classList.remove('hidden');
        if (footerName) footerName.textContent = `${student.first_name} ${student.last_name}`;

        document.getElementById('stu-full-name').textContent = `${student.first_name} ${student.last_name}`;
        document.getElementById('stu-role').textContent = student.role;
        document.getElementById('stu-email').textContent = student.email;
        document.getElementById('stu-id').textContent = student.unique_id || `ID-${student.id}`;
        document.getElementById('stu-created').textContent = student.created_at ? new Date(student.created_at).toLocaleDateString('fr-FR') : '-';

        const loans = appStore.getState('loans').filter(l => l.user_id === Number(studentId));
        const list = document.getElementById('stu-loans-list');
        const count = document.getElementById('stu-loans-count');

        if (count) count.textContent = `${loans.length} emprunt${loans.length > 1 ? 's' : ''}`;
        if (list) {
            list.innerHTML = '';
            if (loans.length === 0) {
                list.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:24px;">Aucun historique d'emprunts trouvé.</td></tr>`;
            } else {
                loans.forEach(loan => {
                    const tr = document.createElement('tr');
                    const statusClass = loan.status === 'RETROURNÉ' ? 'badge-success' : (loan.status === 'RETARD' ? 'badge-danger' : 'badge-warning');
                    tr.innerHTML = `
                        <td><strong>${Components.escapeHtml(loan.book_title || 'Livre #' + loan.book_id)}</strong></td>
                        <td>${loan.borrow_date ? new Date(loan.borrow_date).toLocaleDateString('fr-FR') : '-'}</td>
                        <td>${loan.return_due_date ? new Date(loan.return_due_date).toLocaleDateString('fr-FR') : '-'}</td>
                        <td>${loan.actual_return_date ? new Date(loan.actual_return_date).toLocaleDateString('fr-FR') : '-'}</td>
                        <td><span class="badge ${statusClass}">${loan.status}</span></td>
                    `;
                    list.appendChild(tr);
                });
            }
        }
    },

    startClock() {
        const update = () => {
            const el = document.getElementById('current-time');
            if (el) {
                el.textContent = new Date().toLocaleTimeString('fr-FR');
            }
        };
        update();
        setInterval(update, 1000);
    },

    // -----------------------------------------------
    // Student / Teacher Portal
    // -----------------------------------------------
    renderStudentPortal() {
        const user     = appStore.getState('currentUser');
        const myLoans  = appStore.getState('userLoans') || [];
        const books    = appStore.getState('books') || [];

        // Update welcome banner
        if (user) {
            const titleEl = document.getElementById('portal-welcome-title');
            const subEl   = document.getElementById('portal-welcome-sub');
            if (titleEl) titleEl.textContent = `Bonjour, ${user.first_name} 👋`;
            if (subEl)   subEl.textContent   = `${user.role} — ${user.email}`;
        }

        this._myLoansAll    = myLoans;
        this._myLoansFilter = this._myLoansFilter || 'all';
        this.renderMyLoans(myLoans);

        // Available books
        this.renderAvailableBooks(books);

        // Bind search on available books
        const searchEl = document.getElementById('search-available-books');
        if (searchEl && !searchEl._bound) {
            searchEl._bound = true;
            searchEl.addEventListener('input', () => {
                this.renderAvailableBooks(appStore.getState('books'), searchEl.value);
            });
        }
    },

    renderMyLoans(loans, filter) {
        filter = filter || this._myLoansFilter || 'all';
        this._myLoansFilter = filter;

        const tbody = document.getElementById('my-loans-list');
        if (!tbody) return;

        const now = new Date();
        const myLoans = loans || this._myLoansAll || [];

        // Update stats
        const active   = myLoans.filter(l => l.status !== 'returned' && new Date(l.due_at) >= now).length;
        const overdue  = myLoans.filter(l => l.status !== 'returned' && new Date(l.due_at) < now).length;
        const returned = myLoans.filter(l => l.status === 'returned').length;

        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        setEl('portal-stat-active',   active);
        setEl('portal-stat-overdue',  overdue);
        setEl('portal-stat-returned', returned);
        setEl('my-loans-count',       myLoans.length);

        // Highlight active filter button
        document.querySelectorAll('#loans-filter-chips [data-lfilter]').forEach(btn => {
            btn.className = btn.dataset.lfilter === filter
                ? 'btn btn-primary btn-sm'
                : 'btn btn-secondary btn-sm';
        });

        // Apply filter
        let filtered = myLoans;
        if (filter === 'active')   filtered = myLoans.filter(l => l.status !== 'returned' && new Date(l.due_at) >= now);
        if (filter === 'overdue')  filtered = myLoans.filter(l => l.status !== 'returned' && new Date(l.due_at) < now);
        if (filter === 'returned') filtered = myLoans.filter(l => l.status === 'returned');

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            const msgs = {
                all:      'Vous n\'avez aucun emprunt enregistré.',
                active:   'Aucun emprunt en cours.',
                overdue:  'Aucun emprunt en retard. 🎉',
                returned: 'Aucun livre retourné.',
            };
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--text-secondary);">
                <i class="fa-solid fa-handshake" style="font-size:32px;opacity:0.3;display:block;margin-bottom:12px;"></i>
                ${msgs[filter] || msgs.all}</td></tr>`;
            return;
        }

        const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';

        filtered.forEach(loan => {
            const bookTitle = loan.book?.title || `Livre #${loan.book_id}`;
            const isOverdue = loan.status !== 'returned' && new Date(loan.due_at) < now;
            let badgeCls = 'badge', badgeTxt = 'En cours';
            if (loan.status === 'returned') { badgeCls += ' badge-success'; badgeTxt = 'Retourné'; }
            else if (loan.status === 'pending') { badgeCls += ' badge-warning'; badgeTxt = '⏳ En attente'; }
            else if (loan.status === 'rejected') { badgeCls += ' badge-danger'; badgeTxt = '✖ Rejeté'; }
            else if (isOverdue)             { badgeCls += ' badge-danger';  badgeTxt = '⚠️ En retard'; }
            else                            { badgeCls += ' badge-info'; badgeTxt = 'En cours'; }

            const tr = document.createElement('tr');
            if (isOverdue) tr.style.background = 'rgba(239,68,68,0.05)';
            tr.innerHTML = `
                <td><strong>${Components.escapeHtml(bookTitle)}</strong></td>
                <td style="font-size:13px;color:var(--text-secondary);">${fmt(loan.borrowed_at)}</td>
                <td style="font-size:13px;color:var(--text-secondary);">${fmt(loan.due_at)}</td>
                <td style="font-size:13px;color:var(--text-secondary);">${fmt(loan.returned_at)}</td>
                <td><span class="${badgeCls}">${badgeTxt}</span></td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderAvailableBooks(books, searchQuery = '') {
        const grid = document.getElementById('available-books-grid');
        if (!grid) return;

        const q = searchQuery.toLowerCase();
        const available = (books || []).filter(b => {
            const matchSearch = !q ||
                b.title?.toLowerCase().includes(q) ||
                b.author?.toLowerCase().includes(q);
            return b.available_quantity > 0 && matchSearch;
        });

        const countEl = document.getElementById('available-books-count');
        if (countEl) countEl.textContent = available.length;

        grid.innerHTML = '';
        if (available.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-secondary);">
                <i class="fa-solid fa-book-open" style="font-size:40px;opacity:0.25;display:block;margin-bottom:12px;"></i>
                ${q ? `Aucun livre disponible correspondant à "${Components.escapeHtml(q)}".` : 'Aucun livre disponible pour le moment.'}
            </div>`;
            return;
        }

        available.forEach(book => {
            const card = document.createElement('div');
            card.style.cssText = 'background:var(--bg-secondary);border:1px solid #1e293b;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:all 0.2s ease;cursor:default;position:relative;';

            const dispoBadge = `<div style="position:absolute;top:12px;right:12px;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:4px 10px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.5px;z-index:10;backdrop-filter:blur(4px);">✓ ${book.available_quantity} DISPO</div>`;

            const coverHtml = book.image_url
                ? `<div style="position:relative;height:130px;"><img src="${Components.escapeHtml(book.image_url)}" alt="${Components.escapeHtml(book.title)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.parentElement.innerHTML='<div style=\\'height:100%;display:flex;align-items:center;justify-content:center;background:#1e293b;font-size:40px;color:#475569\\'><i class=\\'fa-solid fa-book\\'></i></div>'"></div>`
                : `<div style="position:relative;height:130px;display:flex;align-items:center;justify-content:center;background:#1e293b;font-size:40px;color:#475569;"><i class="fa-solid fa-book"></i></div>`;

            card.innerHTML = `
                ${dispoBadge}
                ${coverHtml}
                <div style="padding:12px;flex:1;display:flex;flex-direction:column;gap:4px;">
                    <div style="font-size:10px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:0.5px;">${Components.escapeHtml(book.category || 'Autre')}</div>
                    <div style="font-weight:700;font-size:14px;color:#f8fafc;line-height:1.3;margin-bottom:2px;" title="${Components.escapeHtml(book.title)}">${Components.escapeHtml(book.title)}</div>
                    <div style="font-size:11px;color:#94a3b8;">par ${Components.escapeHtml(book.author)}</div>
                    <div style="font-size:10px;color:#475569;font-family:monospace;">${Components.escapeHtml(book.isbn || 'N/A')}</div>
                    <div style="margin-top:auto;padding-top:12px;">
                        <button onclick="window.App.borrowBook(${book.id})" style="width:100%;background:#8b5cf6;color:white;border:none;padding:8px;border-radius:6px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='#7c3aed'" onmouseout="this.style.background='#8b5cf6'">
                            <i class="fa-solid fa-bookmark"></i> Emprunter
                        </button>
                    </div>
                </div>
            `;

            // Hover effect
            card.addEventListener('mouseenter', () => { card.style.borderColor = '#8b5cf6'; card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; });
            card.addEventListener('mouseleave', () => { card.style.borderColor = '#1e293b'; card.style.transform = ''; card.style.boxShadow = ''; });

            grid.appendChild(card);
        });
    },

    _getCategoryIcon(category) {
        const icons = {
            'Informatique & Big Data': '<i class="fa-solid fa-laptop-code"></i>',
            'Marketing Digital': '<i class="fa-solid fa-bullhorn"></i>',
            'Littérature': '<i class="fa-solid fa-feather-pointed"></i>',
        };
        return icons[category] || '<i class="fa-solid fa-bookmark"></i>';
    }
};

window.UI = UI;
