import { h, mount } from '../components/dom.js';
import { signUp, getState } from '../store.js';

export function renderSignUp(container, { onDone }) {
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
            <button data-role="admin">Coach / Club / Parent Admin</button>
          </div>
          <div class="caption" id="role-hint">Athletes see and log their own assigned workouts.</div>
        </div>
      </div>
      <div id="err" class="error-text"></div>
      <button class="btn btn-primary" id="btn-submit">Sign Up</button>
    </div>
  `);

  node.querySelector('#role-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-role]');
    if (!btn) return;
    role = btn.dataset.role;
    [...node.querySelectorAll('#role-picker button')].forEach((b) => b.classList.toggle('active', b === btn));
    node.querySelector('#role-hint').textContent = role === 'admin'
      ? 'Admins can upload workouts, assign them, and track the whole team\u2019s progress.'
      : 'Athletes see and log their own assigned workouts.';
  });

  const submitBtn = node.querySelector('#btn-submit');
  submitBtn.addEventListener('click', async () => {
    const fullName = node.querySelector('#name').value.trim();
    const email = node.querySelector('#email').value.trim();
    if (!fullName || !email) return;
    submitBtn.textContent = 'Creating account…';
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
