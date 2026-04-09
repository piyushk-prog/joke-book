/**
 * ui.js — Shared UI components for JokeBook
 * Toast notifications, modals, confirm dialogs, empty states
 */

const UI = {
  /** Show a toast notification */
  toast(message, duration = 2500) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /** Show a confirm dialog. Returns a promise that resolves to true/false */
  confirm(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal">
          <h3 class="modal-title">${title}</h3>
          <p class="modal-message">${message}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button class="btn btn-danger" data-action="confirm">Delete</button>
          </div>
        </div>
      `;

      overlay.querySelector('[data-action="cancel"]').onclick = () => {
        overlay.remove();
        resolve(false);
      };
      overlay.querySelector('[data-action="confirm"]').onclick = () => {
        overlay.remove();
        resolve(true);
      };
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      };

      document.body.appendChild(overlay);
    });
  },

  /** Render an empty state with icon and message */
  emptyState(icon, title, subtitle) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${subtitle}</p>
      </div>
    `;
  },

  /** Format a date nicely */
  formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  },

  /** Truncate text to a max length */
  truncate(text, maxLen = 80) {
    if (!text || text.length <= maxLen) return text || '';
    return text.slice(0, maxLen).trimEnd() + '...';
  },

  /** Escape HTML to prevent XSS */
  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /** Status badge HTML */
  statusBadge(status) {
    const labels = { draft: 'Draft', polished: 'Polished', retired: 'Retired' };
    return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
  },

  /** Category badge */
  categoryBadge(category) {
    if (!category) return '';
    return `<span class="badge badge-category">${UI.esc(category)}</span>`;
  },

  /** Tag chips */
  tagChips(tags) {
    if (!tags || tags.length === 0) return '';
    return tags.map(t => `<span class="chip">${UI.esc(t)}</span>`).join('');
  }
};

export default UI;
