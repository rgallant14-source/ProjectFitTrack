import { h, mount } from '../components/dom.js';
import { verifyAge, getState } from '../store.js';
import { ICONS } from '../components/icons.js';

export function renderAgeVerification(container, { onVerified, onBack }) {
  // Reflect whatever's currently in state.errorMessage directly, rather
  // than clearing it here: verifyAge()'s own notify() causes this whole
  // screen to remount before the click handler below gets a chance to
  // update the old (by-then-detached) DOM node, so the template itself
  // needs to be the source of truth for the error text.
  const existingError = getState().errorMessage;
  const defaultDob = new Date();
  defaultDob.setFullYear(defaultDob.getFullYear() - 15);
  const dobStr = defaultDob.toISOString().slice(0, 10);
  const maxDob = new Date().toISOString().slice(0, 10);

  const node = h(`
    <div class="screen stack gap-lg">
      <button class="icon-btn" id="btn-back">${ICONS.back}</button>
      <div class="stack gap-xs">
        <h1 class="h-title">Verify Your Age</h1>
        <p class="subheadline">FitTrack is built for teen athletes. You must be at least 13 to create an account.</p>
      </div>
      <div class="card field">
        <label for="dob">Date of birth</label>
        <input type="date" id="dob" value="${dobStr}" max="${maxDob}" />
      </div>
      <div id="err" class="error-text">${existingError || ''}</div>
      <button class="btn btn-primary" id="btn-continue">Continue</button>
    </div>
  `);

  node.querySelector('#btn-back').addEventListener('click', onBack);
  node.querySelector('#btn-continue').addEventListener('click', () => {
    const dob = node.querySelector('#dob').value;
    if (!dob) return;
    const ok = verifyAge(dob);
    if (ok) onVerified();
    // On failure, verifyAge()'s notify() triggers a fresh remount of this
    // same screen (see above) which will show the error via the template.
  });

  mount(container, node);
}
