import { h, mount } from '../components/dom.js';
import { signUp, getState } from '../store.js';

const ROLE_HINTS = {
  athlete: 'Athletes see and log their own assigned workouts.',
  admin: 'Admins can upload workouts, assign them, and track the whole team\u2019s progress.',
  parent: 'Parents/guardians get read-only visibility into their athlete\u2019s activity and approve who\u2019s allowed to message them. You\u2019ll link to your athlete\u2019s team next.',
};

// Role selection happens FIRST, before any age check — a coach or parent
// creating an account should never see a "you must be 13" screen aimed at
// a teen athlete. Only the athlete path continues on to age verification
// (owned by app.js as its own screen, same as before) via
// onNeedsAgeVerification; admin/parent sign up directly.
export function renderSignUp(container, { onDone, onNeedsAgeVerification }) {
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
      </div>
      <div id="err" class="error-text"></div>
      <button class="btn btn-primary" id="btn-submit">${role === 'athlete' ? 'Continue' : 'Sign Up'}</button>
    </div>
  `);

  node.querySelector('#role-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-role]');
    if (!btn) return;
    role = btn.dataset.role;
    [...node.querySelectorAll('#role-picker button')].forEach((b) => b.classList.toggle('active', b === btn));
    node.querySelector('#role-hint').textContent = ROLE_HINTS[role];
    node.querySelector('#btn-submit').textContent = role === 'athlete' ? 'Continue' : 'Sign Up';
  });

  const submitBtn = node.querySelector('#btn-submit');
  submitBtn.addEventListener('click', async () => {
    const fullName = node.querySelector('#name').value.trim();
    const email = node.querySelector('#email').value.trim();
    if (!fullName || !email) return;

    if (role === 'athlete') {
      onNeedsAgeVerification({ fullName, email });
      return;
    }

    submitBtn.textContent = 'Creating account\u2026';
    submitBtn.disabled = true;
    await signUp({ fullName, email, role });
    const err = getState().errorMessage;
    if (err) {
      node.querySelector('#err').textContent = err;
      submitBtn.textContent = 'Sign Up';
      submitBtn.disabled = false;
      return;
    }
    onDone();
  });

  mount(container, node);
}
