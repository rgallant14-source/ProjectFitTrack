import { h, mount } from '../components/dom.js';
import { findOrganizationByJoinCode } from '../store.js';

const ROLE_HINTS = {
  athlete: 'Athletes see and log their own assigned workouts.',
  admin: 'Admins can upload workouts, assign them, and track the whole team\u2019s progress.',
  parent: 'Parents/guardians get read-only visibility into their athlete\u2019s activity and approve who\u2019s allowed to message them.',
};

// Athletes and parents both have to supply a real team join code here —
// tying the account to an actual team from the start, rather than letting
// anyone create an account and go looking for one to join afterward.
// Admin accounts don't require one yet (verifying that someone actually
// coaches for the club they claim is a bigger identity-verification
// project, deliberately out of scope for this pass).
const REQUIRES_TEAM_CODE = { athlete: true, admin: false, parent: true };

export function renderSignUp(container, { onDetailsReady }) {
  let role = 'athlete';

  const node = h(`
    <div class="screen stack gap-lg">
      <h1 class="h-title">Create Your Account</h1>
      <div class="card stack gap-md">
        <div class="field">
          <label for="name">Full name</label>
          <input id="name" type="text" autocomplete="name" />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="email" />
        </div>
        <div class="field">
          <label for="phone">Phone (optional \u2014 lets you verify by text instead of email)</label>
          <input id="phone" type="tel" autocomplete="tel" placeholder="(555) 555-5555" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="new-password" />
        </div>
        <div class="field">
          <label>Account type</label>
          <div class="segmented" id="role-picker">
            <button data-role="athlete" class="active">Athlete</button>
            <button data-role="admin">Coach / Club</button>
            <button data-role="parent">Parent</button>
          </div>
          <div class="caption" id="role-hint">${ROLE_HINTS[role]}</div>
        </div>
        <div class="field" id="team-code-field">
          <label for="team-code">Team join code</label>
          <input id="team-code" type="text" placeholder="e.g. RIVERSIDE24" style="text-transform:uppercase" />
          <div class="caption">Ask your athlete's coach or club for this code \u2014 it's how we confirm this account belongs to a real team.</div>
        </div>
      </div>
      <div id="err" class="error-text"></div>
      <button class="btn btn-primary" id="btn-submit">Continue</button>
    </div>
  `);

  function updateTeamCodeVisibility() {
    node.querySelector('#team-code-field').style.display = REQUIRES_TEAM_CODE[role] ? 'flex' : 'none';
  }
  updateTeamCodeVisibility();

  node.querySelector('#role-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-role]');
    if (!btn) return;
    role = btn.dataset.role;
    [...node.querySelectorAll('#role-picker button')].forEach((b) => b.classList.toggle('active', b === btn));
    node.querySelector('#role-hint').textContent = ROLE_HINTS[role];
    updateTeamCodeVisibility();
  });

  const submitBtn = node.querySelector('#btn-submit');
  submitBtn.addEventListener('click', () => {
    const fullName = node.querySelector('#name').value.trim();
    const email = node.querySelector('#email').value.trim();
    const phone = node.querySelector('#phone').value.trim();
    const errEl = node.querySelector('#err');
    errEl.textContent = '';
    if (!fullName || !email) return;

    let organizationId = null;
    if (REQUIRES_TEAM_CODE[role]) {
      const code = node.querySelector('#team-code').value.trim();
      if (!code) {
        errEl.textContent = 'A team join code is required for this account type.';
        return;
      }
      const org = findOrganizationByJoinCode(code);
      if (!org) {
        errEl.textContent = "That join code wasn't recognized. Check with your coach and try again.";
        return;
      }
      organizationId = org.id;
    }

    onDetailsReady({ fullName, email, phone, role, organizationId });
  });

  mount(container, node);
}
