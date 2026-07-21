import { h, mount, showToast } from '../components/dom.js';
import { submitVerificationRequest, verificationRequestForCurrentUser, getState, isAdminVerified } from '../store.js';
import { ICONS } from '../components/icons.js';

// Coach identity/affiliation intake. Submitting this does NOT verify or
// unlock anything today — there's no backend yet to hold a decision the
// applicant couldn't just edit on themselves (see isAdminVerified's note
// in store.js). This only collects the info a future real review process
// would need, and shows the coach what they've already submitted.
export function renderVerificationIntake(container, { onClose }) {
  function draw() {
    const existing = verificationRequestForCurrentUser();
    const verified = isAdminVerified();

    const node = verified ? drawVerifiedNode() : existing ? drawSubmittedNode(existing) : drawFormNode();
    mount(container, node);
  }

  function drawVerifiedNode() {
    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Account Verified</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>
          <div class="card stack gap-sm">
            <div class="body-text">Your account is verified — messaging and every coach feature is available.</div>
          </div>
        </div>
      </div>
    `);
    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);
    return node;
  }

  function drawSubmittedNode(existing) {
    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Submission Received</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>
          <div class="card stack gap-sm" style="border:1px solid var(--warning);">
            <div class="caption" style="font-weight:700; color:var(--text-primary);">Pending review</div>
            <div class="caption">There's no live review process yet in this build \u2014 this is saved and ready for whenever one exists. Messaging stays unavailable on this account until then.</div>
          </div>
          <div class="card stack gap-xs">
            <div class="body-text" style="font-weight:600;">${existing.clubName}</div>
            ${existing.league ? `<div class="caption">League/association: ${existing.league}</div>` : ''}
            ${existing.websiteUrl ? `<div class="caption">Website: ${existing.websiteUrl}</div>` : ''}
            ${existing.note ? `<div class="caption">"${existing.note}"</div>` : ''}
            <div class="caption">Submitted ${new Date(existing.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <button class="btn btn-secondary" id="btn-edit">Edit Submission</button>
        </div>
      </div>
    `);
    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);
    node.querySelector('#btn-edit').addEventListener('click', () => {
      mount(container, drawFormNode(existing));
    });
    return node;
  }

  function drawFormNode(existing = null) {
    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Verify Your Coaching Account</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>
          <p class="subheadline">Tell us about your club or team. Messaging athletes and parents is unavailable until your account is verified \u2014 everything else (creating a team, posting workouts) still works in the meantime.</p>

          <div class="card stack gap-md">
            <div class="field">
              <label for="club-name">Club / organization name</label>
              <input id="club-name" type="text" placeholder="e.g. Riverside FC Academy" value="${existing?.clubName ?? ''}" />
            </div>
            <div class="field">
              <label for="league">League / association (optional)</label>
              <input id="league" type="text" placeholder="e.g. State Youth Soccer League" value="${existing?.league ?? ''}" />
            </div>
            <div class="field">
              <label for="website">Club website or social page (optional)</label>
              <input id="website" type="url" placeholder="https://..." value="${existing?.websiteUrl ?? ''}" />
            </div>
            <div class="field">
              <label for="note">Anything else that would help confirm your affiliation (optional)</label>
              <textarea id="note" rows="3" placeholder="e.g. Listed as head coach on the club roster page">${existing?.note ?? ''}</textarea>
            </div>
          </div>

          <div id="err" class="error-text"></div>
          <button class="btn btn-primary" id="btn-submit">${existing ? 'Update Submission' : 'Submit for Review'}</button>
        </div>
      </div>
    `);

    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);
    node.querySelector('#btn-submit').addEventListener('click', () => {
      const clubName = node.querySelector('#club-name').value.trim();
      const league = node.querySelector('#league').value.trim();
      const websiteUrl = node.querySelector('#website').value.trim();
      const note = node.querySelector('#note').value.trim();
      const result = submitVerificationRequest({ clubName, league, websiteUrl, note });
      if (!result) {
        node.querySelector('#err').textContent = getState().errorMessage;
        return;
      }
      showToast('Submitted');
      draw();
    });

    return node;
  }

  draw();
}
