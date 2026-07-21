import { h, mount, showToast } from '../components/dom.js';
import {
  isAdmin, isParent, adminOrganizations, generateTeamInviteCodeForManagedOrg,
  generateTeamInviteCodeFromJoinCode, activeInviteCodesIssuedByCurrentUser, getState,
} from '../store.js';
import { ICONS } from '../components/icons.js';
import { organizationDisplayName } from '../models.js';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Mints a single-use "add an additional team" invite code — for a coach,
// scoped to a team they manage; for a parent, proven by supplying that
// team's own blanket join code (the same code they'd have from actually
// registering their athlete there).
export function renderGenerateInvite(container, { onClose }) {
  const admin = isAdmin();
  const parent = isParent();
  let generatedCode = null;

  function draw() {
    const myOrgs = admin ? adminOrganizations() : [];
    const outstanding = activeInviteCodesIssuedByCurrentUser();

    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Invite an Athlete to a Team</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>
          <p class="subheadline">${admin
            ? 'Give an athlete who already has an account a one-time code to add one of your teams.'
            : "Have your athlete's second team's join code? Turn it into a one-time code just for your athlete to add that team to their account."}</p>

          ${admin ? `
            <div class="field">
              <label>Which team?</label>
              <div class="stack gap-sm">
                ${myOrgs.map((o) => `
                  <button class="card card-tappable row gap-md" data-org-id="${o.id}" style="margin-bottom:8px;">
                    <div class="body-text" style="font-weight:600;">${organizationDisplayName(o)}</div>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : `
            <div class="card field">
              <label for="join-code">Team join code</label>
              <input id="join-code" type="text" placeholder="e.g. RIVERSIDE24" style="text-transform:uppercase" />
            </div>
            <div id="err" class="error-text"></div>
            <button class="btn btn-primary" id="btn-generate-parent">Generate Code</button>
          `}

          ${generatedCode ? `
            <div class="card stack gap-sm" style="border:1px solid rgba(139,92,246,0.4);">
              <div class="caption" style="font-weight:700; color:var(--text-primary);">Give this code to your athlete</div>
              <div class="h-title center" style="letter-spacing:4px;">${generatedCode}</div>
              <div class="caption">One-time use \u2014 they'll enter it from Profile &gt; Add Another Team.</div>
            </div>
          ` : ''}

          ${outstanding.length ? `
            <div class="stack gap-sm">
              <div class="h-headline">Codes Not Yet Used</div>
              ${outstanding.map((i) => `
                <div class="card row-between">
                  <div class="stack gap-xs">
                    <div class="body-text" style="font-weight:600;">${i.code}</div>
                    <div class="caption">${timeAgo(i.createdAt)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `);

    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);

    node.querySelectorAll('[data-org-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const invite = generateTeamInviteCodeForManagedOrg(btn.dataset.orgId);
        if (invite) { generatedCode = invite.code; showToast('Invite code generated'); }
        draw();
      });
    });

    node.querySelector('#btn-generate-parent')?.addEventListener('click', () => {
      const code = node.querySelector('#join-code').value.trim();
      if (!code) return;
      const invite = generateTeamInviteCodeFromJoinCode(code);
      if (!invite) {
        node.querySelector('#err').textContent = getState().errorMessage;
        return;
      }
      generatedCode = invite.code;
      showToast('Invite code generated');
      draw();
    });

    mount(container, node);
  }

  draw();
}
