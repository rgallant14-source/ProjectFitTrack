import { h, mount, showToast } from '../components/dom.js';
import { addAdditionalTeam, getState } from '../store.js';
import { ICONS } from '../components/icons.js';

// Redeeming a single-use invite code to attach an ADDITIONAL team to an
// already-existing athlete account. Distinct from the signup-time team
// code flow: this code only works because a coach or the athlete's own
// parent minted it specifically for them, not because it's a code someone
// happened to pass around.
export function renderAddTeam(container, { onDone, onClose }) {
  const node = h(`
    <div class="sheet-backdrop" id="backdrop">
      <div class="sheet stack gap-lg">
        <div class="sheet-grabber"></div>
        <div class="sheet-header">
          <h2 class="h-title">Add Another Team</h2>
          <button class="icon-btn" id="btn-close">${ICONS.close}</button>
        </div>
        <p class="subheadline">Enter the invite code your coach or parent gave you for the new team. This is different from a regular team join code \u2014 it's a one-time code made just for you.</p>
        <div class="card field">
          <label for="invite-code">Invite code</label>
          <input id="invite-code" type="text" placeholder="e.g. XK4P-9RQ2" style="text-transform:uppercase" />
        </div>
        <div id="err" class="error-text"></div>
        <button class="btn btn-primary" id="btn-add">Add Team</button>
      </div>
    </div>
  `);

  node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
  node.querySelector('#btn-close').addEventListener('click', onClose);

  node.querySelector('#btn-add').addEventListener('click', () => {
    const code = node.querySelector('#invite-code').value.trim();
    if (!code) return;
    const ok = addAdditionalTeam(code);
    if (!ok) {
      node.querySelector('#err').textContent = getState().errorMessage;
      return;
    }
    showToast('Team added');
    onDone();
  });

  mount(container, node);
}
