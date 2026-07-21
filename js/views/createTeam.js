import { h, mount, showToast } from '../components/dom.js';
import { createOrganization } from '../store.js';
import { ICONS } from '../components/icons.js';

const SPORTS = ['Soccer', 'Basketball', 'Volleyball', 'Baseball', 'Softball', 'Track & Field', 'Swimming', 'Other'];

export function renderCreateTeam(container, { onDone, onClose }) {
  let stage = 'form'; // 'form' | 'created'
  let createdOrg = null;

  function drawForm() {
    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Create a Team</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>
          <p class="subheadline">Set up your club or team and get a join code to share with athletes and parents.</p>

          <div class="card stack gap-md">
            <div class="field">
              <label for="org-name">Club / organization name</label>
              <input id="org-name" type="text" placeholder="e.g. Riverside FC Academy" />
            </div>
            <div class="field">
              <label for="team-name">Team / squad name (optional)</label>
              <input id="team-name" type="text" placeholder="e.g. U16 Girls" />
            </div>
            <div class="field">
              <label for="sport">Sport</label>
              <select id="sport">
                ${SPORTS.map((s) => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
          </div>

          <div id="err" class="error-text"></div>
          <button class="btn btn-primary" id="btn-create">Create Team</button>
        </div>
      </div>
    `);

    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);
    node.querySelector('#btn-create').addEventListener('click', () => {
      const name = node.querySelector('#org-name').value.trim();
      const teamName = node.querySelector('#team-name').value.trim();
      const sport = node.querySelector('#sport').value;
      if (!name) {
        node.querySelector('#err').textContent = 'Give your club or organization a name.';
        return;
      }
      createdOrg = createOrganization({ name, teamName, sport });
      stage = 'created';
      draw();
    });

    mount(container, node);
  }

  function drawCreated() {
    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Team Created</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>
          <div class="card stack gap-sm" style="border:1px solid rgba(139,92,246,0.4);">
            <div class="caption" style="font-weight:700; color:var(--text-primary);">Share this join code with your athletes and their parents</div>
            <div class="h-title center" style="letter-spacing:4px;">${createdOrg.joinCode}</div>
            <div class="caption">Athletes enter it during signup (or from Profile &gt; Add Another Team). Parents enter it too, or use it to generate a one-time invite from their Profile.</div>
          </div>
          <button class="btn btn-primary" id="btn-done">Done</button>
        </div>
      </div>
    `);
    node.querySelector('#btn-close').addEventListener('click', onDone);
    node.querySelector('#btn-done').addEventListener('click', onDone);
    mount(container, node);
  }

  function draw() {
    if (stage === 'created') drawCreated();
    else drawForm();
  }

  draw();
}
