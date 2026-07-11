import { h, mount, showToast, avatarColorClass } from '../components/dom.js';
import { getState, rosterMembers, linkParentToAthlete } from '../store.js';
import { ICONS } from '../components/icons.js';
import { organizationDisplayName } from '../models.js';

// Shared "which athlete is yours?" picker — assumes state.currentOrganization
// is already set to the right team (either from a join code validated at
// signup, or from the standalone Profile > Join flow). Used right after a
// parent's account is created, and from Profile if they need to (re)link.
export function renderAthletePicker(container, { onDone, onClose }) {
  const org = getState().currentOrganization;
  const roster = rosterMembers();

  const node = h(`
    <div class="sheet-backdrop" id="backdrop">
      <div class="sheet stack gap-lg">
        <div class="sheet-grabber"></div>
        <div class="sheet-header">
          <h2 class="h-title">Which athlete is yours?</h2>
          ${onClose ? `<button class="icon-btn" id="btn-close">${ICONS.close}</button>` : ''}
        </div>
        <p class="subheadline">${org ? organizationDisplayName(org) : ''}</p>
        <div class="stack gap-sm">
          ${roster.length ? roster.map((m) => `
            <button class="card card-tappable row gap-md" data-athlete-id="${m.id}" data-athlete-name="${m.fullName}" style="margin-bottom:8px;">
              <div class="avatar ${avatarColorClass(m.id)}" style="width:40px;height:40px;font-size:14px;">${m.fullName.split(' ').map((s) => s[0]).join('').toUpperCase()}</div>
              <div class="body-text" style="font-weight:600;">${m.fullName}</div>
            </button>
          `).join('') : `<div class="caption">No athletes found on this roster yet.</div>`}
        </div>
      </div>
    </div>
  `);

  if (onClose) {
    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);
  }
  node.querySelectorAll('[data-athlete-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      linkParentToAthlete(btn.dataset.athleteId);
      showToast(`Linked to ${btn.dataset.athleteName}`);
      onDone();
    });
  });

  mount(container, node);
}
