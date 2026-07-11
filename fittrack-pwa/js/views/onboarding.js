import { h, mount } from '../components/dom.js';

export function renderOnboarding(container, { onSignUp, onLogIn }) {
  const node = h(`
    <div class="screen stack gap-lg" style="min-height:100vh; justify-content:center;">
      <div class="stack gap-md center">
        <div class="hero-icon">⚽️</div>
        <h1 class="h-hero">FitTrack</h1>
        <p class="subheadline">Train smarter. Track everything. Share your progress.</p>
      </div>
      <div class="stack gap-sm" style="margin-top: 40px;">
        <button class="btn btn-primary" id="btn-signup">Create Account</button>
        <button class="btn btn-secondary" id="btn-login">Log In</button>
      </div>
    </div>
  `);
  node.querySelector('#btn-signup').addEventListener('click', onSignUp);
  node.querySelector('#btn-login').addEventListener('click', onLogIn);
  mount(container, node);
}
