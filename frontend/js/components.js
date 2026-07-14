/**
 * UI Components Layer
 * Functions for generating HTML templates and DOM elements.
 */

export const Components = {
    // ---- Notifications (Toasts) ----
    showToast(message, type = "info") {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        
        const icon = type === 'success' ? 'check-circle' : 
                     type === 'danger' ? 'triangle-exclamation' : 
                     type === 'warning' ? 'circle-exclamation' : 'circle-info';
                     
        toast.innerHTML = `
            <i class="fa-solid fa-${icon}" aria-hidden="true"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        // Stacking logic - Append at the top (or bottom depending on CSS, assuming bottom)
        container.appendChild(toast);
        
        // Timeout pour l'animation de sortie
        setTimeout(() => toast.classList.add('removing'), 4000);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 4300);
    },

    // ---- Empty States ----
    getEmptyStateHTML(title, message, iconClass, actionBtnHtml = '') {
        return `
            <tr>
                <td colspan="10" style="text-align: center; padding: 60px 20px;">
                    <div class="empty-state">
                        <i class="fa-solid ${iconClass}" style="font-size: 3rem; color: var(--border-color); margin-bottom: 20px;" aria-hidden="true"></i>
                        <h3 style="color: var(--text-primary); font-size: 1.2rem; margin-bottom: 8px;">${title}</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 16px;">${message}</p>
                        ${actionBtnHtml}
                    </div>
                </td>
            </tr>
        `;
    },

    // ---- Skeletons ----
    getSkeletonRowHTML(columns) {
        let colsHtml = '';
        for (let i = 0; i < columns; i++) {
            colsHtml += `<td><div class="skeleton skeleton-text"></div></td>`;
        }
        return `<tr>${colsHtml}</tr>`;
    },

    // ---- Table Rows ----
    createBookRow(book, actionsHtml) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${book.id}</td>
            <td><strong>${this.escapeHtml(book.title)}</strong></td>
            <td>${this.escapeHtml(book.author)}</td>
            <td>${this.escapeHtml(book.isbn)}</td>
            <td><span class="badge badge-primary">${this.escapeHtml(book.category || 'Autre')}</span></td>
            <td>${book.published_year || '-'}</td>
            <td>${book.quantity}</td>
            <td><span class="badge ${book.available_quantity > 0 ? 'badge-success' : 'badge-danger'}">${book.available_quantity}</span></td>
            <td>
                <div class="actions-cell">
                    ${actionsHtml}
                </div>
            </td>
        `;
        return tr;
    },

    createUserRow(user, actionsHtml) {
        const tr = document.createElement('tr');
        const roleClass = user.role === 'Etudiant' ? 'badge-info' : 
                          user.role === 'Professeur' ? 'badge-success' : 'badge-warning';
        const dateStr = user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '-';
        tr.innerHTML = `
            <td>#${user.id}</td>
            <td><strong>${this.escapeHtml(user.first_name)} ${this.escapeHtml(user.last_name)}</strong></td>
            <td>${this.escapeHtml(user.email)}</td>
            <td><span class="badge ${roleClass}">${user.role}</span></td>
            <td>${dateStr}</td>
            <td>
                <div class="actions-cell">
                    ${actionsHtml}
                </div>
            </td>
        `;
        return tr;
    },

    createLoanRow(loan, actionsHtml) {
        const tr = document.createElement('tr');
        const bookTitle = loan.book ? loan.book.title : `Livre #${loan.book_id}`;
        const userName = loan.user ? `${loan.user.first_name} ${loan.user.last_name}` : `Utilisateur #${loan.user_id}`;
        
        let badgeClass = 'badge-warning';
        let badgeText = 'En cours';
        if (loan.status === 'returned') {
            badgeClass = 'badge-success';
            badgeText = 'Retourné';
        } else if (new Date() > new Date(loan.due_at)) {
            badgeClass = 'badge-danger';
            badgeText = 'En retard';
            tr.classList.add('row-overdue');
        }

        const bDate = loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString('fr-FR') : '-';
        const dDate = loan.due_at ? new Date(loan.due_at).toLocaleDateString('fr-FR') : '-';
        const rDate = loan.returned_at ? new Date(loan.returned_at).toLocaleDateString('fr-FR') : '-';

        tr.innerHTML = `
            <td>#${loan.id}</td>
            <td><strong>${this.escapeHtml(bookTitle)}</strong></td>
            <td>${this.escapeHtml(userName)}</td>
            <td>${bDate}</td>
            <td>${dDate}</td>
            <td>${rDate}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td>
                <div class="actions-cell">
                    ${actionsHtml}
                </div>
            </td>
        `;
        return tr;
    },

    createBookCard(book) {
        const div = document.createElement('div');
        div.className = 'book-card';
        div.tabIndex = 0;
        
        const imageUrl = book.image_url || '';
        const category = book.category || 'Autre';
        
        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${this.escapeHtml(imageUrl)}" alt="Couverture de ${this.escapeHtml(book.title)}" class="book-cover" onerror="this.outerHTML='<div class=\\'book-cover\\'><i class=\\'fa-solid fa-book\\'></i></div>'">`;
        } else {
            imageHtml = `<div class="book-cover"><i class="fa-solid fa-book"></i></div>`;
        }
        
        div.innerHTML = `
            ${imageHtml}
            <div class="book-info">
                <div class="book-category-label">${this.escapeHtml(category)}</div>
                <div class="book-title">${this.escapeHtml(book.title)}</div>
                <div class="book-author">${this.escapeHtml(book.author)}</div>
                <div class="book-action">
                    <button class="btn btn-primary" style="width: 100%" onclick="window.App.requireLoginToBorrow()">
                        <i class="fa-solid fa-bookmark"></i> Emprunter
                    </button>
                </div>
            </div>
        `;
        return div;
    },

    // Utilities
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};
