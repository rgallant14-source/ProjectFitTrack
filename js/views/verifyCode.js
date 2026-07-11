import { h, mount } from '../components/dom.js';
import { requestSignupVerification, resendSignupVerification, confirmSignupVerification } from '../store.js';
import { ICONS } from '../components/icons.js';

// The activation step of signup: a 6-digit code the person has to enter
// before their account is actually created. There's no real email/SMS
// provider wired up in this build, so the "sent" code is shown right on
// screen with an explicit demo-mode note — the mechanics (code, attempt
// limit, resend, expiry-by-restart) are real; the delivery is simulated,
// same as how the practice schedule is clearly labeled "(simulated)"
// elsewhere in the app.
export function renderVerifyCode(container, { fullName, email, phone, role, organizationId, onVerified, onBack }) {
  let channel = phone ? 'text' : 'email';
  let demoCode = requestSignupVerification({ fullName, email, phone, role, organizationId, channel });

  function draw() {
    const destination = channel === 'text' ? (phone || email) : email;

    const node = h(`
      <div class="screen stack gap-lg">
        <button class="icon-btn" id="btn-back">${ICONS.back}</button>
        <div class="stack gap-xs">
          <h1 class="h-title">Verify It's You</h1>
          <p class="subheadline">Enter the 6-digit code we sent by ${channel === 'text' ? 'text' : 'email'} to ${destination}.</p>
        </div>

        ${phone ? `
          <div class="segmented" id="channel-picker">
            <button data-channel="email" class="${channel === 'email' ? 'active' : ''}">Email</button>
            <button data-channel="text" class="${channel === 'text' ? 'active' : ''}">Text</button>
          </div>
        ` : ''}

        <div class="card stack gap-sm">
          <div class="caption" style="font-weight:700; color:var(--text-primary);">Demo mode</div>
          <div class="caption">There's no email/SMS service connected in this build, so here's the code that would normally have been sent:</div>
          <div class="h-title center" id="demo-code" style="letter-spacing:6px;">${demoCode}</div>
        </div>

        <div class="card field">
          <label for="code-input">6-digit code</label>
          <input id="code-input" type="text" inputmode="numeric" maxlength="6" placeholder="123456" />
        </div>
        <div id="err" class="error-text"></div>
        <button class="btn btn-primary" id="btn-verify">Activate Account</button>
        <button class="btn btn-secondary" id="btn-resend">Resend Code</button>
      </div>
    `);

    node.querySelector('#btn-back').addEventListener('click', onBack);

    node.querySelector('#channel-picker')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-channel]');
      if (!btn) return;
      channel = btn.dataset.channel;
      draw();
    });

    node.querySelector('#btn-resend').addEventListener('click', () => {
      demoCode = resendSignupVerification();
      draw();
    });

    const verifyBtn = node.querySelector('#btn-verify');
    verifyBtn.addEventListener('click', () => {
      const input = node.querySelector('#code-input').value;
      if (!input.trim()) return;
      const result = confirmSignupVerification(input);
      if (!result.ok) {
        node.querySelector('#err').textContent = result.error;
        if (result.exhausted) {
          verifyBtn.disabled = true;
          node.querySelector('#btn-resend').disabled = true;
        }
        return;
      }
      onVerified(result);
    });

    mount(container, node);
  }

  draw();
}
