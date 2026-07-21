import { h, mount, showToast } from '../components/dom.js';
import { parseDelimited, buildCsv, downloadTextFile } from '../components/csv.js';
import { BULK_UPLOAD_HEADERS, templateRows, buildWorkoutDrafts } from '../bulkWorkouts.js';
import { rosterMembers, commitBulkWorkouts, getState } from '../store.js';
import { ICONS } from '../components/icons.js';

function formatAssigned(draft) {
  if (draft.assignedTo === 'all') return 'Whole team';
  const roster = rosterMembers();
  const names = draft.assignedTo.map((id) => roster.find((m) => m.id === id)?.fullName ?? id);
  return names.join(', ');
}

export function renderBulkUpload(container, { onDone, onClose }) {
  let stage = 'input'; // 'input' | 'preview' | 'done'
  let parsed = null; // { workouts, errors, warnings }

  function downloadTemplate() {
    const csv = buildCsv(BULK_UPLOAD_HEADERS, templateRows());
    downloadTextFile('fittrack-workout-template.csv', csv);
    showToast('Template downloaded');
  }

  function handleParsedText(text) {
    const { headers, rows } = parseDelimited(text);
    parsed = buildWorkoutDrafts(headers, rows, rosterMembers());
    stage = 'preview';
    draw();
  }

  function drawInput() {
    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Bulk Upload Workouts</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>
          <p class="subheadline">Download the template, fill it in with Excel, Sheets, or Numbers, then upload it here \u2014 or paste rows straight from a spreadsheet below. Nothing is created until you review and confirm on the next screen.</p>

          <button class="card card-tappable row gap-md" id="btn-download-template">
            <span class="card-icon">${ICONS.download}</span>
            <div class="stack gap-xs" style="flex:1;">
              <div class="h-headline">Download Template (.csv)</div>
              <div class="caption">Includes example rows showing the format</div>
            </div>
          </button>

          <div class="field">
            <label for="file-input">Upload completed file</label>
            <input id="file-input" type="file" accept=".csv,.txt" />
          </div>

          <div class="stack gap-sm">
            <div class="caption" style="font-weight:700; color:var(--text-primary);">Or paste rows from a spreadsheet</div>
            <textarea id="paste-area" rows="6" placeholder="Select your rows in Excel/Sheets (including the header row), copy, and paste here"></textarea>
            <button class="btn btn-secondary" id="btn-parse-paste">Parse Pasted Rows</button>
          </div>

          <div id="err" class="error-text"></div>
        </div>
      </div>
    `);

    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);
    node.querySelector('#btn-download-template').addEventListener('click', downloadTemplate);

    node.querySelector('#file-input').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        handleParsedText(text);
      } catch {
        node.querySelector('#err').textContent = "Couldn't read that file. Make sure it's a .csv exported from your spreadsheet.";
      }
    });

    node.querySelector('#btn-parse-paste').addEventListener('click', () => {
      const text = node.querySelector('#paste-area').value;
      if (!text.trim()) return;
      handleParsedText(text);
    });

    mount(container, node);
  }

  function drawPreview() {
    const { workouts, errors, warnings } = parsed;

    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Review Before Creating</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>

          ${errors.length ? `
            <div class="card stack gap-sm" style="border:1px solid var(--danger, #ef4444);">
              <div class="caption" style="font-weight:700; color:var(--danger, #ef4444);">${errors.length} issue${errors.length === 1 ? '' : 's'} \u2014 these rows/workouts will be skipped</div>
              ${errors.map((e) => `<div class="caption">${e}</div>`).join('')}
            </div>
          ` : ''}

          ${warnings.length ? `
            <div class="card stack gap-sm" style="border:1px solid var(--warning);">
              <div class="caption" style="font-weight:700; color:var(--text-primary);">${warnings.length} warning${warnings.length === 1 ? '' : 's'}</div>
              ${warnings.map((w) => `<div class="caption">${w}</div>`).join('')}
            </div>
          ` : ''}

          <div class="stack gap-sm">
            <div class="h-headline">${workouts.length} Workout${workouts.length === 1 ? '' : 's'} Ready to Create</div>
            ${workouts.length ? workouts.map((w) => `
              <div class="card stack gap-xs">
                <div class="body-text" style="font-weight:600;">${w.title}</div>
                <div class="caption">${new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${w.dayLabel ? ' · ' + w.dayLabel : ''} \u00b7 ${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}</div>
                <div class="caption">Assigned: ${formatAssigned(w)}</div>
              </div>
            `).join('') : `<div class="caption">Nothing valid to create \u2014 fix the issues above and try again.</div>`}
          </div>

          <button class="btn btn-secondary" id="btn-start-over">Start Over</button>
          <button class="btn btn-primary" id="btn-confirm" ${workouts.length ? '' : 'disabled'}>Create ${workouts.length} Workout${workouts.length === 1 ? '' : 's'}</button>
        </div>
      </div>
    `);

    node.addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);
    node.querySelector('#btn-start-over').addEventListener('click', () => { stage = 'input'; parsed = null; draw(); });
    node.querySelector('#btn-confirm').addEventListener('click', () => {
      const count = commitBulkWorkouts(workouts);
      showToast(`${count} workout${count === 1 ? '' : 's'} created`);
      stage = 'done';
      draw();
    });

    mount(container, node);
  }

  function drawDone() {
    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="stack gap-md" style="align-items:center; padding:24px 0;">
            <span style="width:48px; height:48px; color:var(--success, #22c55e);">${ICONS.checkCircle}</span>
            <div class="h-title">Workouts Created</div>
            <div class="caption center">You can find them on the Team tab and edit or remove any of them from there.</div>
          </div>
          <button class="btn btn-primary" id="btn-done">Done</button>
        </div>
      </div>
    `);
    node.querySelector('#btn-done').addEventListener('click', onDone);
    mount(container, node);
  }

  function draw() {
    if (stage === 'preview') drawPreview();
    else if (stage === 'done') drawDone();
    else drawInput();
  }

  draw();
}
