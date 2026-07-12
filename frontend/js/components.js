/**
 * UI Components Layer
 * Functions for generating HTML templates and DOM elements.
 */

export const Components = {
    // ---- Notifications (Toasts) ----
    showToast(message, type = "info") {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                     type === 'danger' ? 'triangle-exclamation' : 
                     type === 'warning' ? 'circle-exclamation' : 'circle-info';
                     
        toast.innerHTML = `
            <i class="fa-solid fa-${icon}" aria-hidden="true"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        container.appendChild(toast);
        
        // Timeout pour l'animation de sortie
        setTimeout(() => toast.classList.add('removing'), 3000);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3300);
    },

    // ---- Empty States ----
    getEmptyStateHTML(title, message, iconClass) {
        return `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px 20px;">
                    <div class="empty-state">
                        <i class="fa-solid ${iconClass}" style="font-size: 3rem; color: var(--border-color); margin-bottom: 15px;"></i>
                        <h3 style="color: var(--text-primary); font-size: 1.2rem; margin-bottom: 5px;">${title}</h3>
                        <p style="color: var(--text-secondary);">${message}</p>
                    </div>
                </td>
            </tr>
        `;
    },

    // ---- Table Rows ----
    createBookRow(book, actionsHtml) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${book.id}</td>
            <td><strong>${this.escapeHtml(book.title)}</strong></td>
            <td>${this.escapeHtml(book.author)}</td>
            <td>${this.escapeHtml(book.isbn)}</td>
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
