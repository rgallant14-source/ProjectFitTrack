export function h(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function mount(container, node) {
  container.innerHTML = '';
  container.appendChild(node);
}

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}

export function formatDate(iso, opts = { weekday: 'long', month: 'short', day: 'numeric' }) {
  return new Date(iso).toLocaleDateString(undefined, opts);
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Deterministic color assignment so the same person always gets the same
// avatar color across the app, instead of one repeated gradient everywhere.
export function avatarColorClass(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `c${hash % 5}`;
}

const BLOCK_TAG_CLASS = {
  'Warm-up': 'warmup',
  'Strength': 'strength',
  'Agility': 'agility',
  'Ball Skills': 'ballskills',
  'Technical': 'technical',
  'Recovery': 'recovery',
};

export function categoryTag(block) {
  const cls = BLOCK_TAG_CLASS[block] || 'warmup';
  return `<span class="cat-tag ${cls}">${block}</span>`;
}

// Consistent empty-state markup: icon + title + optional subtitle, used
// everywhere instead of a single flat line of gray text.
export function emptyState({ icon, title, subtitle = '' }) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${title}</div>
      ${subtitle ? `<div class="empty-subtitle">${subtitle}</div>` : ''}
    </div>`;
}
