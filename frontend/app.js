/**
 * Dakar Institute of Technology (DIT) - Library Management System
 * Architecture Frontend Modulaire et Accessible (WCAG/ARIA Compliant)
 */

// 1. SERVICES INTERNES & APIS
const API_URLS = {
    books: '/api/books',
    users: '/api/users',
    loans: '/api/loans'
};

const ApiService = {
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
    }
};

// 2. ETAT DE L'APPLICATION (App State)
const AppState = {
    books: [],
    users: [],
    loans: [],
    activeTab: 'dashboard',
    isOffline: false,
    activeModal: null,
    previousFocusedElement: null,
    needsRefresh: { books: true, users: true, loans: true, dashboard: true }
};

let loansChartInstance = null;

// 3. ACCESSIBILITE - FOCUS TRAP MANAGER
const FocusTrap = {
    activeListener: null,
    
    trap(modalEl) {
        // Supprimer d'éventuels écouteurs précédents
        this.untrap(modalEl);
        
        const focusableSelectors = 'input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex="0"]';
        const focusableEls = modalEl.querySelectorAll(focusableSelectors);
        if (focusableEls.length === 0) return;
        
        const firstFocusable = focusableEls[0];
        const lastFocusable = focusableEls[focusableEls.length - 1];
        
        // Placer le focus sur le premier élément de formulaire du modal
        setTimeout(() => firstFocusable.focus(), 150);
        
        this.activeListener = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) { // Shift + Tab
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else { // Tab
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
        };
        
        modalEl.addEventListener('keydown', this.activeListener);
    },
    
    untrap(modalEl) {
        if (this.activeListener) {
            modalEl.removeEventListener('keydown', this.activeListener);
            this.activeListener = null;
        }
    }
};

// 4. SQUELETTES DE CHARGEMENT & ETATS VIDES
const UILoader = {
    showTableSkeleton(tbodyId, columnsCount, rowsCount = 4) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        
        tbody.innerHTML = '';
        const template = document.getElementById('template-skeleton-row');
        if (!template) return;
        
        for (let i = 0; i < rowsCount; i++) {
            const clone = template.content.cloneNode(true);
            const row = clone.querySelector('tr');
            
            // Adapter le nombre de colonnes si besoin
            const currentCols = row.querySelectorAll('td').length;
            if (currentCols !== columnsCount) {
                row.innerHTML = '';
                for (let j = 0; j < columnsCount - 1; j++) {
                    const td = document.createElement('td');
                    td.innerHTML = '<div class="skeleton skeleton-text"></div>';
                    row.appendChild(td);
                }
                const actionsTd = document.createElement('td');
                actionsTd.innerHTML = '<div class="actions-cell"><div class="skeleton skeleton-btn"></div></div>';
                row.appendChild(actionsTd);
            }
            tbody.appendChild(clone);
        }
    },
    
    renderEmptyState(tbodyId, columnsCount, message, iconClass = 'fa-folder-open') {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="${columnsCount}" class="empty-state-cell">
                    <div class="empty-state-body">
                        <i class="fa-solid ${iconClass}" aria-hidden="true"></i>
                        <p>${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
};

// 5. VALIDATIONS DE FORMULAIRE (Client-Side)
const FormValidator = {
    clearErrors(formEl) {
        formEl.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('invalid');
        });
    },
    
    setError(inputEl, hasError) {
        const group = inputEl.closest('.form-group');
        if (!group) return;
        
        if (hasError) {
            group.classList.add('invalid');
            inputEl.setAttribute('aria-invalid', 'true');
        } else {
            group.classList.remove('invalid');
            inputEl.setAttribute('aria-invalid', 'false');
        }
    },
    
    validateBook() {
        const title = document.getElementById('book-title');
        const author = document.getElementById('book-author');
        const isbn = document.getElementById('book-isbn');
        const year = document.getElementById('book-year');
        const qty = document.getElementById('book-qty');
        
        let isValid = true;
        
        // Titre & Auteur requis
        this.setError(title, title.value.trim() === '');
        this.setError(author, author.value.trim() === '');
        
        if (title.value.trim() === '' || author.value.trim() === '') isValid = false;
        
        // ISBN : requis + 10 ou 13 chiffres
        const isbnVal = isbn.value.trim().replace(/-/g, '');
        const isbnReg = /^[0-9]{10}$|^[0-9]{13}$/;
        const isbnErr = isbnVal === '' || !isbnReg.test(isbnVal);
        this.setError(isbn, isbnErr);
        if (isbnErr) isValid = false;
        
        // Année optionnelle mais doit être cohérente
        if (year.value) {
            const yVal = parseInt(year.value);
            const currentYear = new Date().getFullYear();
            const yearErr = yVal < 1000 || yVal > (currentYear + 5);
            this.setError(year, yearErr);
            if (yearErr) isValid = false;
        } else {
            this.setError(year, false);
        }
        
        // Quantité >= 1
        const qtyVal = parseInt(qty.value);
        const qtyErr = isNaN(qtyVal) || qtyVal < 1;
        this.setError(qty, qtyErr);
        if (qtyErr) isValid = false;
        
        return isValid;
    },
    
    validateUser() {
        const firstname = document.getElementById('user-firstname');
        const lastname = document.getElementById('user-lastname');
        const email = document.getElementById('user-email');
        const role = document.getElementById('user-role');
        
        let isValid = true;
        
        this.setError(firstname, firstname.value.trim() === '');
        this.setError(lastname, lastname.value.trim() === '');
        this.setError(role, role.value === '');
        
        if (firstname.value.trim() === '' || lastname.value.trim() === '' || role.value === '') isValid = false;
        
        // Email académique obligatoire terminant par @dit.sn (ou format standard valide)
        const emailVal = email.value.trim();
        const emailReg = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const isAcademic = emailVal.endsWith('@dit.sn') || emailVal.endsWith('@dit.edu.sn');
        const emailErr = emailVal === '' || !emailReg.test(emailVal) || !isAcademic;
        
        this.setError(email, emailErr);
        if (emailErr) isValid = false;
        
        return isValid;
    },
    
    validateLoan() {
        const user = document.getElementById('loan-user-select');
        const book = document.getElementById('loan-book-select');
        
        let isValid = true;
        this.setError(user, user.value === '');
        this.setError(book, book.value === '');
        
        if (user.value === '' || book.value === '') isValid = false;
        return isValid;
    }
};

// 6. LOGIQUE GLOBALE INTERACTIVE (UI/UX Orchestrator)
const UI = {
    init() {
        this.initClock();
        this.bindEvents();
        this.loadDashboardData();
    },
    
    initClock() {
        const timeEl = document.getElementById('current-time');
        const tick = () => {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('fr-FR');
        };
        tick();
        setInterval(tick, 1000);
    },
    
    bindEvents() {
        // Menu navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.getAttribute('data-tab');
                this.switchTab(tabId);
            });
            // Accessibilité clavier sur le menu
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const tabId = item.getAttribute('data-tab');
                    this.switchTab(tabId);
                }
            });
        });
        
        // Modals Escape Listener
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && AppState.activeModal) {
                closeModal(AppState.activeModal);
            }
        });
        
        // Formulaires Submit
        document.getElementById('form-book').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBookSubmit();
        });
        document.getElementById('form-user').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUserSubmit();
        });
        document.getElementById('form-loan').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLoanSubmit();
        });
    },
    
    switchTab(tabId) {
        if (AppState.activeTab === tabId) return;
        AppState.activeTab = tabId;
        
        // Activer classe menu
        document.querySelectorAll('.menu-item').forEach(item => {
            const isTarget = item.getAttribute('data-tab') === tabId;
            item.classList.toggle('active', isTarget);
            item.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        });
        
        // Activer classe section
        document.querySelectorAll('.tab-content').forEach(section => {
            section.classList.toggle('active', section.id === `tab-${tabId}`);
        });
        
        // Titres & Subtitles
        const title = document.getElementById('page-title');
        const subtitle = document.getElementById('page-subtitle');
        
        switch (tabId) {
            case 'dashboard':
                title.textContent = "Tableau de Bord";
                subtitle.textContent = "Aperçu général des statistiques et activités";
                this.loadDashboardData();
                break;
            case 'books':
                title.textContent = "Catalogue des Livres";
                subtitle.textContent = "Gérez l'inventaire des livres académiques du DIT";
                this.loadBooksList();
                break;
            case 'users':
                title.textContent = "Utilisateurs L2 DIT";
                subtitle.textContent = "Gestion des étudiants, professeurs et personnel administratif";
                this.loadUsersList();
                break;
            case 'loans':
                title.textContent = "Gestion des Emprunts";
                subtitle.textContent = "Suivez les livres empruntés et enregistrez les retours";
                this.loadLoansList();
                break;
        }
    },
    
    updateConnectionStatus(offline) {
        AppState.isOffline = offline;
        const indicator = document.getElementById('connection-status');
        const text = document.getElementById('connection-text');
        const errorPanel = document.getElementById('service-error-panel');
        
        if (offline) {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Service Hors-ligne';
            errorPanel.style.display = 'flex';
            // Masquer les statistiques
            document.querySelectorAll('.tab-content').forEach(sec => sec.classList.remove('active'));
        } else {
            indicator.className = 'status-indicator online';
            text.textContent = 'Système Connecté';
            errorPanel.style.display = 'none';
            // Restaurer l'onglet actif
            const currentTab = document.getElementById(`tab-${AppState.activeTab}`);
            if (currentTab) currentTab.classList.add('active');
        }
    },
    
    // CHARGEMENTS DES DONNEES
    async loadDashboardData() {
        UILoader.showTableSkeleton('recent-loans-list', 4, 3);
        try {
            const books = await ApiService.request(API_URLS.books);
            const users = await ApiService.request(API_URLS.users);
            const loans = await ApiService.request(API_URLS.loans);
            
            AppState.books = books;
            AppState.users = users;
            AppState.loans = loans;
            
            this.updateConnectionStatus(false);
            this.renderDashboardStats();
            renderDashboardChart();
        } catch (err) {
            console.error(err);
            this.updateConnectionStatus(true);
            showToast("Microservices inaccessibles. Veuillez vérifier Docker Compose.", "danger");
        }
    },
    
    renderDashboardStats() {
        const totalBooks = AppState.books.reduce((acc, b) => acc + b.quantity, 0);
        const availBooks = AppState.books.reduce((acc, b) => acc + b.available_quantity, 0);
        const totalUsers = AppState.users.length;
        const activeLoans = AppState.loans.filter(l => l.status === 'active').length;
        
        const returnedCount = AppState.loans.filter(l => l.status === 'returned').length;
        const rate = AppState.loans.length > 0 ? Math.round((returnedCount / AppState.loans.length) * 100) : 100;
        
        document.getElementById('stat-total-books').textContent = totalBooks;
        document.getElementById('stat-avail-books').textContent = availBooks;
        document.getElementById('stat-total-users').textContent = totalUsers;
        document.getElementById('stat-active-loans').textContent = activeLoans;
        document.getElementById('stat-return-rate').textContent = `${rate}%`;
        
        // Rendu récents emprunts (max 5)
        const list = document.getElementById('recent-loans-list');
        list.innerHTML = '';
        const recent = AppState.loans.slice(0, 5);
        
        if (recent.length === 0) {
            list.innerHTML = '<tr><td colspan="4" class="empty-state-cell">Aucun emprunt récent.</td></tr>';
            return;
        }
        
        recent.forEach(loan => {
            const bookTitle = loan.book ? loan.book.title : `Livre #${loan.book_id}`;
            const userName = loan.user ? `${loan.user.first_name} ${loan.user.last_name}` : `Utilisateur #${loan.user_id}`;
            const dateStr = loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString('fr-FR') : '--';
            const badgeClass = loan.status === 'active' ? 'badge-warning' : 'badge-success';
            const badgeText = loan.status === 'active' ? 'En cours' : 'Retourné';
            
            const tr = document.createElement('tr');
            if (loan.status === 'active' && new Date() > new Date(loan.due_at)) {
                tr.classList.add('row-overdue');
            }
            tr.innerHTML = `
                <td><strong>${escapeHtml(bookTitle)}</strong></td>
                <td>${escapeHtml(userName)}</td>
                <td>${dateStr}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            `;
            list.appendChild(tr);
        });
        
        renderDashboardChart();
    },
    
    async loadBooksList() {
        UILoader.showTableSkeleton('books-list', 8);
        try {
            const books = await ApiService.request(API_URLS.books);
            AppState.books = books;
            this.updateConnectionStatus(false);
            this.renderBooks(books);
        } catch (err) {
            this.updateConnectionStatus(true);
        }
    },
    
    renderBooks(books) {
        const list = document.getElementById('books-list');
        list.innerHTML = '';
        
        if (books.length === 0) {
            UILoader.renderEmptyState('books-list', 8, "Aucun livre enregistré au catalogue.", "fa-book");
            return;
        }
        
        books.forEach(b => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${b.id}</td>
                <td><strong>${escapeHtml(b.title)}</strong></td>
                <td>${escapeHtml(b.author)}</td>
                <td><code>${escapeHtml(b.isbn)}</code></td>
                <td>${b.published_year || '--'}</td>
                <td>${b.quantity}</td>
                <td>
                    <span class="badge ${b.available_quantity > 0 ? 'badge-success' : 'badge-danger'}">
                        ${b.available_quantity} / ${b.quantity} dispos
                    </span>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-secondary btn-xs" onclick="editBook(${b.id})" aria-label="Modifier le livre ${escapeHtml(b.title)}">
                        <i class="fa-solid fa-pen" aria-hidden="true"></i>
                    </button>
                    <button class="btn btn-danger btn-xs" onclick="deleteBook(${b.id})" aria-label="Supprimer le livre ${escapeHtml(b.title)}">
                        <i class="fa-solid fa-trash" aria-hidden="true"></i>
                    </button>
                </td>
            `;
            list.appendChild(tr);
        });
    },
    
    async loadUsersList() {
        UILoader.showTableSkeleton('users-list', 6);
        try {
            const users = await ApiService.request(API_URLS.users);
            AppState.users = users;
            this.updateConnectionStatus(false);
            this.renderUsers(users);
        } catch (err) {
            this.updateConnectionStatus(true);
        }
    },
    
    renderUsers(users) {
        const list = document.getElementById('users-list');
        list.innerHTML = '';
        
        if (users.length === 0) {
            UILoader.renderEmptyState('users-list', 6, "Aucun utilisateur inscrit.", "fa-users");
            return;
        }
        
        users.forEach(u => {
            const tr = document.createElement('tr');
            const roleClass = u.role === 'Etudiant' ? 'badge-primary' : (u.role === 'Professeur' ? 'badge-info' : 'badge-success');
            const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '--';
            
            tr.innerHTML = `
                <td>${u.id}</td>
                <td><strong>${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</strong></td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="badge ${roleClass}">${u.role}</span></td>
                <td>${dateStr}</td>
                <td class="actions-cell">
                    <button class="btn btn-info btn-xs" onclick="viewUserProfile(${u.id})">
                        <i class="fa-solid fa-user-tag" aria-hidden="true"></i> Profil
                    </button>
                    <button class="btn btn-secondary btn-xs" onclick="editUser(${u.id})" aria-label="Modifier le profil de ${escapeHtml(u.first_name)}">
                        <i class="fa-solid fa-pen" aria-hidden="true"></i>
                    </button>
                    <button class="btn btn-danger btn-xs" onclick="deleteUser(${u.id})" aria-label="Supprimer le profil de ${escapeHtml(u.first_name)}">
                        <i class="fa-solid fa-trash" aria-hidden="true"></i>
                    </button>
                </td>
            `;
            list.appendChild(tr);
        });
    },
    
    async loadLoansList() {
        UILoader.showTableSkeleton('loans-list', 8);
        try {
            const loans = await ApiService.request(API_URLS.loans);
            AppState.loans = loans;
            this.updateConnectionStatus(false);
            this.renderLoans(loans);
        } catch (err) {
            this.updateConnectionStatus(true);
        }
    },
    
    renderLoans(loans) {
        const list = document.getElementById('loans-list');
        list.innerHTML = '';
        
        if (loans.length === 0) {
            UILoader.renderEmptyState('loans-list', 8, "Aucun emprunt enregistré.", "fa-handshake");
            return;
        }
        
        loans.forEach(l => {
            const bookTitle = l.book ? l.book.title : `Livre #${l.book_id}`;
            const userName = l.user ? `${l.user.first_name} ${l.user.last_name}` : `Utilisateur #${l.user_id}`;
            const bDate = l.borrowed_at ? new Date(l.borrowed_at).toLocaleDateString('fr-FR') : '--';
            const dDate = l.due_at ? new Date(l.due_at).toLocaleDateString('fr-FR') : '--';
            const rDate = l.returned_at ? new Date(l.returned_at).toLocaleDateString('fr-FR') : '--';
            
            const isLate = l.status === 'active' && new Date() > new Date(l.due_at);
            const badgeClass = l.status === 'active' ? (isLate ? 'badge-danger' : 'badge-warning') : 'badge-success';
            const badgeText = l.status === 'active' ? (isLate ? 'En retard' : 'Actif') : 'Retourné';
            
            const tr = document.createElement('tr');
            if (isLate) {
                tr.classList.add('row-overdue');
            }
            tr.innerHTML = `
                <td>${l.id}</td>
                <td><strong>${escapeHtml(bookTitle)}</strong></td>
                <td>${escapeHtml(userName)}</td>
                <td>${bDate}</td>
                <td>${dDate}</td>
                <td>${rDate}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td class="actions-cell">
                    ${l.status === 'active' ? 
                        `<div style="display:flex;gap:4px;">
                            <button class="btn btn-success btn-xs" onclick="returnBook(${l.id})"><i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i> Restituer</button>
                            <button class="btn btn-info btn-xs" onclick="renewLoan(${l.id})"><i class="fa-solid fa-calendar-plus" aria-hidden="true"></i> Renouveler</button>
                        </div>` : 
                        `<span class="badge badge-success"><i class="fa-solid fa-check" aria-hidden="true"></i> Fini</span>`
                    }
                </td>
            `;
            list.appendChild(tr);
        });
    },
    
    // SUBMISSION FORMULAIRES (CRUD)
    async handleBookSubmit() {
        if (!FormValidator.validateBook()) {
            showToast("Veuillez corriger les erreurs de saisie du livre.", "warning");
            return;
        }
        
        const submitBtn = document.getElementById('btn-submit-book');
        setButtonLoading(submitBtn, true);
        
        const id = document.getElementById('book-id').value;
        const payload = {
            title: document.getElementById('book-title').value.trim(),
            author: document.getElementById('book-author').value.trim(),
            isbn: document.getElementById('book-isbn').value.trim().replace(/-/g, ''),
            published_year: parseInt(document.getElementById('book-year').value) || null,
            quantity: parseInt(document.getElementById('book-qty').value) || 1
        };
        
        const isEdit = id !== '';
        const url = isEdit ? `${API_URLS.books}/${id}` : API_URLS.books;
        const method = isEdit ? 'PUT' : 'POST';
        
        try {
            await ApiService.request(url, {
                method: method,
                body: JSON.stringify(payload)
            });
            showToast(isEdit ? "Livre mis à jour avec succès." : "Nouveau livre enregistré au catalogue.", "success");
            closeModal('modal-book');
            this.loadBooksList();
        } catch (err) {
            showToast(err.message, "danger");
        } finally {
            setButtonLoading(submitBtn, false);
        }
    },
    
    async handleUserSubmit() {
        if (!FormValidator.validateUser()) {
            showToast("Veuillez corriger les erreurs du profil utilisateur.", "warning");
            return;
        }
        
        const submitBtn = document.getElementById('btn-submit-user');
        setButtonLoading(submitBtn, true);
        
        const id = document.getElementById('user-id').value;
        const payload = {
            first_name: document.getElementById('user-firstname').value.trim(),
            last_name: document.getElementById('user-lastname').value.trim(),
            email: document.getElementById('user-email').value.trim(),
            role: document.getElementById('user-role').value
        };
        
        const isEdit = id !== '';
        const url = isEdit ? `${API_URLS.users}/${id}` : API_URLS.users;
        const method = isEdit ? 'PUT' : 'POST';
        
        try {
            await ApiService.request(url, {
                method: method,
                body: JSON.stringify(payload)
            });
            showToast(isEdit ? "Profil de l'utilisateur mis à jour." : "Nouvel utilisateur inscrit.", "success");
            closeModal('modal-user');
            this.loadUsersList();
        } catch (err) {
            showToast(err.message, "danger");
        } finally {
            setButtonLoading(submitBtn, false);
        }
    },
    
    async handleLoanSubmit() {
        if (!FormValidator.validateLoan()) {
            showToast("Veuillez sélectionner les entités requises.", "warning");
            return;
        }
        
        const submitBtn = document.getElementById('btn-submit-loan');
        setButtonLoading(submitBtn, true);
        
        const payload = {
            user_id: parseInt(document.getElementById('loan-user-select').value),
            book_id: parseInt(document.getElementById('loan-book-select').value)
        };
        
        try {
            await ApiService.request(API_URLS.loans, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showToast("Emprunt enregistré et stock décrémenté.", "success");
            closeModal('modal-loan');
            this.switchTab('loans');
        } catch (err) {
            showToast(err.message, "danger");
        } finally {
            setButtonLoading(submitBtn, false);
        }
    }
};

// 7. COMPOSANTS ET ACTIONS APPLICATIVES INDIVIDUELLES
// Fermeture/ouverture Modals avec focus-trap & a11y focus saving
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Garder le focus précédent pour le restaurer lors de la fermeture (WCAG standard)
    AppState.previousFocusedElement = document.activeElement;
    
    AppState.activeModal = modalId;
    modal.classList.add('show');
    
    // Masquer le reste du document pour les lecteurs d'écran
    document.getElementById('app-root').setAttribute('aria-hidden', 'true');
    
    // Focus Trap & Cyclage Tabulation
    FocusTrap.trap(modal);
    
    if (modalId === 'modal-loan') {
        populateLoanFormSelectors();
    }
}

// Custom UI Confirm Dialog
function customConfirm(message) {
    return new Promise((resolve) => {
        document.getElementById('confirm-modal-message').textContent = message;
        openModal('modal-confirm');
        
        const btnOk = document.getElementById('btn-confirm-ok');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        
        // Nettoyer les anciens event listeners
        const newBtnOk = btnOk.cloneNode(true);
        const newBtnCancel = btnCancel.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
        
        newBtnOk.addEventListener('click', () => {
            closeModal('modal-confirm');
            resolve(true);
        });
        
        newBtnCancel.addEventListener('click', () => {
            closeModal('modal-confirm');
            resolve(false);
        });
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    FocusTrap.untrap(modal);
    modal.classList.remove('show');
    AppState.activeModal = null;
    
    // Rendre à nouveau visible le document pour les lecteurs d'écran
    document.getElementById('app-root').removeAttribute('aria-hidden');
    
    // Nettoyer les validations
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        FormValidator.clearErrors(form);
        const hiddenId = form.querySelector('input[type="hidden"]');
        if (hiddenId) hiddenId.value = '';
    }
    
    // Titres réinitialisés
    if (modalId === 'modal-book') document.getElementById('book-modal-title').textContent = "Ajouter un nouveau livre";
    if (modalId === 'modal-user') document.getElementById('user-modal-title').textContent = "Créer un profil utilisateur";
    
    // Restaurer le focus clavier
    if (AppState.previousFocusedElement) {
        AppState.previousFocusedElement.focus();
        AppState.previousFocusedElement = null;
    }
}

async function populateLoanFormSelectors() {
    const userSelect = document.getElementById('loan-user-select');
    const bookSelect = document.getElementById('loan-book-select');
    
    userSelect.innerHTML = '<option value="" disabled selected>Chargement des emprunteurs...</option>';
    bookSelect.innerHTML = '<option value="" disabled selected>Chargement du catalogue...</option>';
    
    try {
        const users = await ApiService.request(API_URLS.users);
        const books = await ApiService.request(API_URLS.books);
        
        // Remplir utilisateurs
        userSelect.innerHTML = '<option value="" disabled selected>Choisir un emprunteur...</option>';
        users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.first_name} ${u.last_name} (${u.role})`;
            userSelect.appendChild(opt);
        });
        
        // Remplir livres (uniquement s'ils sont physiquement disponibles)
        bookSelect.innerHTML = '<option value="" disabled selected>Choisir un livre à prêter...</option>';
        const available = books.filter(b => b.available_quantity > 0);
        if (available.length === 0) {
            bookSelect.innerHTML = '<option value="" disabled>Aucun livre disponible actuellement</option>';
        } else {
            available.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = `${b.title} (ISBN: ${b.isbn}) - [${b.available_quantity} dispos]`;
                bookSelect.appendChild(opt);
            });
        }
    } catch (err) {
        showToast("Erreur lors de la récupération des listes d'emprunt.", "danger");
    }
}

// Bouton enregistrement Spinner (anti double soumission)
let buttonHtmlCache = {};
function setButtonLoading(buttonEl, isLoading) {
    if (!buttonEl) return;
    
    if (isLoading) {
        buttonEl.disabled = true;
        buttonHtmlCache[buttonEl.id] = buttonEl.innerHTML;
        buttonEl.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Enregistrement...';
    } else {
        buttonEl.disabled = false;
        if (buttonHtmlCache[buttonEl.id]) {
            buttonEl.innerHTML = buttonHtmlCache[buttonEl.id];
        }
    }
}

// Editeurs CRUD
function editBook(id) {
    const book = AppState.books.find(b => b.id === id);
    if (!book) return;
    
    document.getElementById('book-id').value = book.id;
    document.getElementById('book-title').value = book.title;
    document.getElementById('book-author').value = book.author;
    document.getElementById('book-isbn').value = book.isbn;
    document.getElementById('book-year').value = book.published_year || '';
    document.getElementById('book-qty').value = book.quantity;
    
    document.getElementById('book-modal-title').textContent = "Modifier les détails du livre";
    openModal('modal-book');
}

function editUser(id) {
    const user = AppState.users.find(u => u.id === id);
    if (!user) return;
    
    document.getElementById('user-id').value = user.id;
    document.getElementById('user-firstname').value = user.first_name;
    document.getElementById('user-lastname').value = user.last_name;
    document.getElementById('user-email').value = user.email;
    document.getElementById('user-role').value = user.role;
    
    document.getElementById('user-modal-title').textContent = "Modifier le profil de l'utilisateur";
    openModal('modal-user');
}

// Suppressions CRUD
async function deleteBook(id) {
    if (!await customConfirm("Voulez-vous retirer définitivement cet ouvrage du catalogue ?")) return;
    try {
        await ApiService.request(`${API_URLS.books}/${id}`, { method: 'DELETE' });
        showToast("Livre supprimé du catalogue.", "success");
        UI.loadBooksList();
    } catch (err) {
        showToast(err.message, "danger");
    }
}

async function deleteUser(id) {
    if (!await customConfirm("Voulez-vous supprimer définitivement ce profil utilisateur ?")) return;
    try {
        await ApiService.request(`${API_URLS.users}/${id}`, { method: 'DELETE' });
        showToast("Utilisateur supprimé de la base.", "success");
        UI.loadUsersList();
    } catch (err) {
        showToast(err.message, "danger");
    }
}

// Retour Emprunt
async function returnBook(loanId) {
    if (!await customConfirm("Confirmer la restitution et l'incrémentation du stock ?")) return;
    
    try {
        await ApiService.request(`${API_URLS.loans}/${loanId}/return`, { method: 'POST' });
        showToast("Livre restitué avec succès.", "success");
        AppState.needsRefresh.dashboard = true;
        UI.loadDashboardData();
    } catch (e) {
        showToast("Erreur lors de la restitution.", "danger");
    }
}

async function renewLoan(loanId) {
    if (!await customConfirm("Voulez-vous renouveler cet emprunt pour 15 jours supplémentaires ?")) return;
    
    try {
        await ApiService.request(`${API_URLS.loans}/${loanId}/renew`, { method: 'POST' });
        showToast("Emprunt renouvelé avec succès (+15 jours).", "success");
        AppState.needsRefresh.dashboard = true;
        UI.loadDashboardData();
    } catch (e) {
        showToast("Erreur lors du renouvellement.", "danger");
    }
}

// ==========================================
// User Profile Modal logic

// Affichage profil utilisateur détaillé et son historique personnel d'emprunts
async function viewUserProfile(userId) {
    const user = AppState.users.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('prof-full-name').textContent = `${user.first_name} ${user.last_name}`;
    document.getElementById('prof-role').textContent = user.role;
    document.getElementById('prof-email').textContent = user.email;
    document.getElementById('prof-id').textContent = user.id;
    document.getElementById('prof-created').textContent = user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '--';
    
    // Classes de style du rôle
    const badge = document.getElementById('prof-role');
    badge.className = 'badge ' + (user.role === 'Etudiant' ? 'badge-primary' : (user.role === 'Professeur' ? 'badge-info' : 'badge-success'));
    
    const loansList = document.getElementById('prof-loans-list');
    loansList.innerHTML = '<tr><td colspan="4" class="empty-state-cell">Chargement de l\'historique...</td></tr>';
    
    openModal('modal-user-profile');
    
    try {
        const history = await ApiService.request(`${API_URLS.loans}/user/${userId}`);
        loansList.innerHTML = '';
        
        if (history.length === 0) {
            loansList.innerHTML = '<tr><td colspan="4" class="empty-state-cell">Aucun emprunt enregistré pour cet utilisateur.</td></tr>';
            return;
        }
        
        history.forEach(loan => {
            const title = loan.book ? loan.book.title : `Livre #${loan.book_id}`;
            const bDate = loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString('fr-FR') : '--';
            const rDate = loan.returned_at ? new Date(loan.returned_at).toLocaleDateString('fr-FR') : 'Non retourné';
            const badgeClass = loan.status === 'active' ? 'badge-warning' : 'badge-success';
            const badgeText = loan.status === 'active' ? 'En cours' : 'Restitué';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(title)}</strong></td>
                <td>${bDate}</td>
                <td>${rDate}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            `;
            loansList.appendChild(tr);
        });
    } catch (err) {
        loansList.innerHTML = '<tr><td colspan="4" class="empty-state-cell text-danger">Échec du chargement de l\'historique.</td></tr>';
    }
}

// 8. FONCTIONS COMPLEMENTAIRES ET UTILS
// Barre de recherche réactive
function setupSearchFilters() {
    document.getElementById('search-books').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = AppState.books.filter(b => 
            b.title.toLowerCase().includes(q) || 
            b.author.toLowerCase().includes(q) || 
            b.isbn.toLowerCase().includes(q)
        );
        UI.renderBooks(filtered);
    });

    document.getElementById('search-users').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = AppState.users.filter(u => 
            u.first_name.toLowerCase().includes(q) || 
            u.last_name.toLowerCase().includes(q) || 
            u.email.toLowerCase().includes(q)
        );
        UI.renderUsers(filtered);
    });

    document.getElementById('search-loans').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = AppState.loans.filter(l => {
            const name = l.user ? `${l.user.first_name} ${l.user.last_name}`.toLowerCase() : '';
            const title = l.book ? l.book.title.toLowerCase() : '';
            return name.includes(q) || title.includes(q);
        });
        UI.renderLoans(filtered);
    });
}

// Notification Toast (avec attributs d'accessibilité aria-live)
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'danger') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    if (type === 'info') iconClass = 'fa-circle-info';
    
    toast.innerHTML = `
        <div class="toast-icon" aria-hidden="true">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="toast-content">
            <p>${escapeHtml(message)}</p>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto-destruct 4s
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Echappement XSS
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, (m) => {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return m;
        }
    });
}

// Initialisation globale
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    setupSearchFilters();
});

// ==========================================
// Chart.js & Analytics
// ==========================================
function renderDashboardChart() {
    const canvas = document.getElementById('loansChart');
    if (!canvas) return;
    
    // Si aucun emprunt, on ne crée pas le graphe
    if (AppState.loans.length === 0) {
        if (loansChartInstance) loansChartInstance.destroy();
        return;
    }
    
    let active = 0, returned = 0, overdue = 0;
    
    AppState.loans.forEach(l => {
        if (l.status === 'returned') {
            returned++;
        } else {
            if (new Date() > new Date(l.due_at)) {
                overdue++;
            } else {
                active++;
            }
        }
    });
    
    if (loansChartInstance) {
        loansChartInstance.data.datasets[0].data = [returned, active, overdue];
        loansChartInstance.update();
    } else {
        const ctx = canvas.getContext('2d');
        loansChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Retournés', 'En cours', 'En retard'],
                datasets: [{
                    data: [returned, active, overdue],
                    backgroundColor: [
                        '#10b981', // green
                        '#f59e0b', // yellow/orange
                        '#ef4444'  // red
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e2e8f0', // var(--text-primary) equivalent
                            font: { family: "'Outfit', sans-serif" }
                        }
                    }
                }
            }
        });
    }
}

// ==========================================
// CSV Export Functions
// ==========================================
function exportToCSV(filename, rows) {
    const processRow = function(row) {
        let finalVal = '';
        for (let j = 0; j < row.length; j++) {
            let innerValue = row[j] === null || row[j] === undefined ? '' : row[j].toString();
            if (row[j] instanceof Date) {
                innerValue = row[j].toLocaleString();
            }
            let result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0)
                result = '"' + result + '"';
            if (j > 0)
                finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

    let csvFile = '\uFEFF'; // BOM for UTF-8 Excel compatibility
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

function exportBooksCSV() {
    const rows = [["ID", "Titre", "Auteur", "ISBN", "Année", "Quantité Totale", "Disponible"]];
    AppState.books.forEach(b => {
        rows.push([b.id, b.title, b.author, b.isbn, b.published_year || '', b.quantity, b.available_quantity]);
    });
    exportToCSV(`inventaire_livres_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function exportUsersCSV() {
    const rows = [["ID", "Prénom", "Nom", "Email", "Rôle", "Inscrit le"]];
    AppState.users.forEach(u => {
        const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '';
        rows.push([u.id, u.first_name, u.last_name, u.email, u.role, dateStr]);
    });
    exportToCSV(`utilisateurs_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function exportLoansCSV() {
    const rows = [["ID", "Livre", "Emprunteur", "Emprunté le", "Date limite", "Retourné le", "Statut"]];
    AppState.loans.forEach(l => {
        const bookTitle = l.book ? l.book.title : `Livre #${l.book_id}`;
        const userName = l.user ? `${l.user.first_name} ${l.user.last_name}` : `Utilisateur #${l.user_id}`;
        const bDate = l.borrowed_at ? new Date(l.borrowed_at).toLocaleDateString('fr-FR') : '';
        const dDate = l.due_at ? new Date(l.due_at).toLocaleDateString('fr-FR') : '';
        const rDate = l.returned_at ? new Date(l.returned_at).toLocaleDateString('fr-FR') : '';
        const status = l.status === 'active' ? (new Date() > new Date(l.due_at) ? 'En retard' : 'En cours') : 'Retourné';
        
        rows.push([l.id, bookTitle, userName, bDate, dDate, rDate, status]);
    });
    exportToCSV(`historique_emprunts_${new Date().toISOString().slice(0,10)}.csv`, rows);
}
