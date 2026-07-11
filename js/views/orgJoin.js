import { h, mount } from '../components/dom.js';
import { joinOrganization, getState } from '../store.js';
import { showToast } from '../components/dom.js';
import { ICONS } from '../components/icons.js';

export function renderOrgJoin(container, { onDone, onClose }) {
  const node = h(`
    <div class="sheet-backdrop" id="backdrop">
      <div class="sheet stack gap-lg">
        <div class="sheet-grabber"></div>
        <div class="sheet-header">
          <h2 class="h-title">Join a Team</h2>
          <button class="icon-btn" id="btn-close">${ICONS.close}</button>
        </div>
        <p class="subheadline">Enter the join code your coach or club shared with you.</p>
        <div class="card field">
          <label for="code">Join code</label>
          <input id="code" type="text" placeholder="e.g. RIVERSIDE24" style="text-transform:uppercase" />
        </div>
        <div id="err" class="error-text"></div>
        <button class="btn btn-primary" id="btn-join">Join</button>
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
    joinBtn.textContent = 'Joining…';
    const ok = await joinOrganization(code);
    if (!ok) {
      node.querySelector('#err').textContent = getState().errorMessage;
      joinBtn.disabled = false;
      joinBtn.textContent = 'Join';
      return;
    }
    showToast('Joined Riverside FC Academy');
    onDone();
  });

  mount(container, node);
}
