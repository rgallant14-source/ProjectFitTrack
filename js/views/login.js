import { h, mount } from '../components/dom.js';
import { logIn, getState } from '../store.js';
import { ICONS } from '../components/icons.js';

export function renderLogin(container, { onDone, onBack }) {
  const node = h(`
    <div class="screen stack gap-lg">
      <button class="icon-btn" id="btn-back">${ICONS.back}</button>
      <h1 class="h-title">Welcome Back</h1>
      <div class="card stack gap-md">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="email" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="current-password" />
        </div>
        <div class="field">
          <label>Log in as</label>
          <div class="segmented" id="role-picker">
            <button data-role="athlete" class="active">Athlete</button>
            <button data-role="admin">Admin</button>
          </div>
        </div>
      </div>
      <div id="err" class="error-text"></div>
      <button class="btn btn-primary" id="btn-submit">Log In</button>
    </div>
  `);

  node.querySelector('#btn-back').addEventListener('click', onBack);

  let role = 'athlete';
  node.querySelector('#role-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-role]');
    if (!btn) return;
    role = btn.dataset.role;
    [...node.querySelectorAll('#role-picker button')].forEach((b) => b.classList.toggle('active', b === btn));
  });

  const submitBtn = node.querySelector('#btn-submit');
  submitBtn.addEventListener('click', async () => {
    const email = node.querySelector('#email').value.trim();
    if (!email) return;
    submitBtn.textContent = 'Logging in…';
    submitBtn.disabled = true;
    await logIn({ email, role });
    const err = getState().errorMessage;
    if (err) {
      node.querySelector('#err').textContent = err;
      submitBtn.textContent = 'Log In';
      submitBtn.disabled = false;
      return;
    }
    onDone();
  });

  mount(container, node);
}
