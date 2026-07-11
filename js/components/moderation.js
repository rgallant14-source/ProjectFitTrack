import { h, showToast } from './dom.js';
import { ICONS } from './icons.js';
import { REPORT_REASONS } from '../models.js';
import { reportContent } from '../store.js';

// A small bottom-sheet action menu — e.g. tapping a kebab icon in a
// message thread header to show "Block" / "Report". `actions` is an array
// of { label, icon, danger, onSelect }.
export function openActionMenu(actions) {
  const backdrop = h(`
    <div class="sheet-backdrop" id="backdrop">
      <div class="sheet stack gap-xs">
        <div class="sheet-grabber"></div>
        ${actions.map((a, i) => `
          <button class="card card-tappable row gap-md" data-action-index="${i}" style="margin-bottom:4px; ${a.danger ? 'color:var(--danger, #ef4444);' : ''}">
            <span style="width:20px; height:20px; flex-shrink:0;">${a.icon || ''}</span>
            <span class="body-text" style="font-weight:600; color:inherit;">${a.label}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `);
  backdrop.addEventListener('click', (e) => { if (e.target.id === 'backdrop') backdrop.remove(); });
  backdrop.querySelectorAll('[data-action-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = actions[Number(btn.dataset.actionIndex)];
      backdrop.remove();
      action.onSelect?.();
    });
  });
  document.body.appendChild(backdrop);
}

// The report sheet: pick a reason, optional note, submit. `target`
// describes what's being reported so reportContent() has everything it
// needs; `contentSnapshot` is a short plain-text copy of the reported
// content so a moderator has context even if the original is later edited
// or removed.
export function openReportSheet({ targetType, targetOwnerId, targetId, contentSnapshot = '' }) {
  const backdrop = h(`
    <div class="sheet-backdrop" id="backdrop">
      <div class="sheet stack gap-md">
        <div class="sheet-grabber"></div>
        <div class="sheet-header">
          <h2 class="h-title">Report</h2>
          <button class="icon-btn" id="btn-close">${ICONS.close}</button>
        </div>
        <div class="caption">This is sent to the coach(es) who manage this person's team so they can follow up.</div>
        <div class="field">
          <label for="reason">Reason</label>
          <select id="reason">
            ${REPORT_REASONS.map((r) => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="note">Additional detail (optional)</label>
          <textarea id="note" rows="3" placeholder="Anything that would help a coach understand what happened"></textarea>
        </div>
        <button class="btn btn-danger" id="btn-submit">Submit Report</button>
      </div>
    </div>
  `);
  backdrop.addEventListener('click', (e) => { if (e.target.id === 'backdrop') backdrop.remove(); });
  backdrop.querySelector('#btn-close').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#btn-submit').addEventListener('click', () => {
    const reason = backdrop.querySelector('#reason').value;
    const note = backdrop.querySelector('#note').value.trim();
    reportContent({ targetType, targetOwnerId, targetId, reason, note, contentSnapshot });
    backdrop.remove();
    showToast('Report submitted');
  });
  document.body.appendChild(backdrop);
}
