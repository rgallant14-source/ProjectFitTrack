import { h, mount, showToast } from '../components/dom.js';
import { joinOrganization, getState, isParent } from '../store.js';
import { ICONS } from '../components/icons.js';
import { organizationDisplayName } from '../models.js';
import { renderAthletePicker } from './athletePicker.js';

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
        renderAthletePicker(container, { onDone, onClose });
      } else {
        showToast(`Joined ${organizationDisplayName(getState().currentOrganization)}`);
        onDone();
      }
    });

    mount(container, node);
  }

  drawCodeStep();
}
