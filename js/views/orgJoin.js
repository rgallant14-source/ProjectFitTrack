import { h, mount, showToast, avatarColorClass } from '../components/dom.js';
import { joinOrganization, getState, isParent, rosterMembers, linkParentToAthlete } from '../store.js';
import { ICONS } from '../components/icons.js';
import { organizationDisplayName } from '../models.js';

export function renderOrgJoin(container, { onDone, onClose }) {
  function drawCodeStep() {
    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">${isParent() ? "Find Your Athlete's Team" : 'Join a Team'}</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>
          <p class="subheadline">${isParent() ? "Enter the join code your athlete's coach or club shared." : 'Enter the join code your coach or club shared with you.'}</p>
          <div class="card field">
            <label for="code">Join code</label>
            <input id="code" type="text" placeholder="e.g. RIVERSIDE24" style="text-transform:uppercase" />
          </div>
          <div id="err" class="error-text"></div>
          <button class="btn btn-primary" id="btn-join">${isParent() ? 'Find Team' : 'Join'}</button>
        </div>
      </div>
    `);

    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);

    const joinBtn = node.querySelector('#btn-join');
    joinBtn.addEventListener('click', async () => {
      const code = node.querySelector('#code').value.trim();
      if (!code) return;
      joinBtn.disabled = true;
      joinBtn.textContent = isParent() ? 'Finding…' : 'Joining…';
      const ok = await joinOrganization(code);
      if (!ok) {
        node.querySelector('#err').textContent = getState().errorMessage;
        joinBtn.disabled = false;
        joinBtn.textContent = isParent() ? 'Find Team' : 'Join';
        return;
      }
      if (isParent()) {
        drawAthletePicker();
      } else {
        showToast(`Joined ${organizationDisplayName(getState().currentOrganization)}`);
        onDone();
      }
    });

    mount(container, node);
  }

  // Parent-only second step: pick which athlete on the now-found roster is
  // theirs. Linking always grants message-request co-approval; full
  // message-content visibility stays a separate toggle the athlete
  // controls from their own Profile.
  function drawAthletePicker() {
    const org = getState().currentOrganization;
    const roster = rosterMembers();

    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Which athlete is yours?</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>
          <p class="subheadline">${organizationDisplayName(org)}</p>
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

    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);
    node.querySelectorAll('[data-athlete-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        linkParentToAthlete(btn.dataset.athleteId);
        showToast(`Linked to ${btn.dataset.athleteName}`);
        onDone();
      });
    });

    mount(container, node);
  }

  drawCodeStep();
}
