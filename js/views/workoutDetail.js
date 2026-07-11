import { h, mount, showToast, categoryTag, formatDate } from '../components/dom.js';
import { getState, findLog, saveLog, exerciseHistory } from '../store.js';
import { makeExerciseLog, uuid, BLOCKS, BLOCK_LOG_FIELDS } from '../models.js';
import { ICONS } from '../components/icons.js';

function groupByBlock(exercises) {
  const map = new Map();
  BLOCKS.forEach((b) => map.set(b, []));
  exercises.forEach((ex) => map.get(ex.block)?.push(ex));
  return [...map.entries()].filter(([, items]) => items.length);
}

function exerciseRowHtml(exercise, workout) {
  const logged = !!findLog(exercise.id, workout.id);
  const tutorialHtml = exercise.tutorialUrl
    ? `<a href="${exercise.tutorialUrl}" target="_blank" rel="noopener" class="caption" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;" onclick="event.stopPropagation()">▶ Watch tutorial</a>`
    : '';
  return `
    <button class="exercise-row card-tappable" data-exercise-id="${exercise.id}" style="background:none;width:100%;">
      <svg class="check-icon" viewBox="0 0 24 24">
        ${logged
          ? `<path d="M12 2a10 10 0 100 20 10 10 0 000-20z" fill="var(--success)"/><path d="M8 12l2.5 2.5L16 9" stroke="#0f1119" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
          : `<circle cx="12" cy="12" r="9" fill="none" stroke="var(--text-tertiary)" stroke-width="1.8"/>`}
      </svg>
      <div class="stack gap-xs" style="flex:1; text-align:left;">
        <div class="body-text" style="font-weight:600;">${exercise.name}</div>
        <div class="row gap-xs" style="margin-top:2px;">${categoryTag(exercise.block)}<span class="caption">${exercise.prescribed}</span></div>
        ${tutorialHtml}
      </div>
      <span class="caption" style="flex-shrink:0; color:var(--accent-2); font-weight:600;">${logged ? 'Edit' : 'Log'}</span>
      <svg class="chevron" width="16" height="16" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>`;
}

export function renderWorkoutDetail(container, workout, { onClose }) {
  function draw() {
    const grouped = groupByBlock(workout.exercises);
    const loggedCount = workout.exercises.filter((ex) => findLog(ex.id, workout.id)).length;

    const node = h(`
      <div class="screen stack gap-lg">
        <div class="row-between">
          <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          <span class="caption">${loggedCount}/${workout.exercises.length} logged</span>
        </div>
        <div class="stack gap-xs">
          <h1 class="h-title">${workout.title}</h1>
          <div class="caption">${workout.dayLabel} · ${workout.sessionLength}</div>
        </div>
        ${grouped.map(([block, items]) => `
          <div class="stack gap-sm">
            <div class="h-headline">${block}</div>
            <div class="card">
              ${items.map((ex) => exerciseRowHtml(ex, workout)).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `);

    node.querySelector('#btn-close').addEventListener('click', onClose);
    node.querySelectorAll('[data-exercise-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const exercise = workout.exercises.find((ex) => ex.id === btn.dataset.exerciseId);
        openLogSheet(exercise, workout, draw);
      });
    });

    mount(container, node);
  }

  draw();
}

function historyRow(log, previousLog, fields) {
  let deltaHtml = '';
  if (previousLog && fields.includes('weight') && log.weightUsed != null && previousLog.weightUsed != null) {
    const diff = log.weightUsed - previousLog.weightUsed;
    if (diff !== 0) {
      deltaHtml = `<span class="caption" style="color:${diff > 0 ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} lbs</span>`;
    }
  }
  const valueLabel = fields.includes('weight')
    ? (log.weightUsed != null ? `${log.weightUsed} lbs` : '—')
    : (log.timeOrRecord || '—');
  return `
    <div class="row-between" style="padding:6px 0;">
      <div class="stack gap-xs">
        <span class="body-text" style="font-weight:600;">${valueLabel}${log.rpe != null ? ` <span class="caption">· RPE ${log.rpe}</span>` : ''}</span>
        <span class="caption">${formatDate(log.completedAt, { month: 'short', day: 'numeric' })}</span>
      </div>
      ${deltaHtml}
    </div>`;
}

function openLogSheet(exercise, workout, onSaved) {
  const existing = findLog(exercise.id, workout.id) || makeExerciseLog({
    id: uuid(), exerciseId: exercise.id, workoutId: workout.id, userId: getState().currentUser.id,
    exerciseName: exercise.name, block: exercise.block,
  });
  const fields = BLOCK_LOG_FIELDS[exercise.block] ?? [];
  const showWeight = fields.includes('weight');
  const showRecord = fields.includes('record');
  const showRpe = fields.includes('rpe');

  const history = exerciseHistory(getState().currentUser.id, exercise.name, { excludeLogId: existing.id }).slice(0, 4);

  const backdrop = h(`
    <div class="sheet-backdrop" id="backdrop">
      <div class="sheet stack gap-md">
        <div class="sheet-grabber"></div>
        <div class="sheet-header">
          <div class="stack gap-xs">
            <div class="h-headline">${exercise.name}</div>
            <div class="caption">${categoryTag(exercise.block)} ${exercise.prescribed}</div>
          </div>
          <button class="icon-btn icon-btn-sm" id="btn-cancel">${ICONS.close}</button>
        </div>

        ${showWeight ? `
          <div class="field">
            <label for="weight">Weight used</label>
            <input id="weight" type="number" inputmode="decimal" placeholder="lbs" value="${existing.weightUsed ?? ''}" />
          </div>` : ''}

        ${showRecord ? `
          <div class="field">
            <label for="record">Time / record</label>
            <input id="record" type="text" placeholder="e.g. 1.9s, 34 juggles" value="${existing.timeOrRecord ?? ''}" />
          </div>` : ''}

        ${showRpe ? `
          <div class="field">
            <label id="rpe-label">RPE: ${existing.rpe ?? 5}</label>
            <input id="rpe" type="range" min="1" max="10" step="1" value="${existing.rpe ?? 5}" />
          </div>` : ''}

        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" rows="3" placeholder="${fields.length ? 'How did it feel?' : 'Anything worth noting?'}">${existing.notes ?? ''}</textarea>
        </div>

        <label class="row gap-sm" style="cursor:pointer;">
          <input id="shared" type="checkbox" ${existing.isShared ? 'checked' : ''} />
          <span class="body-text">Share with coach &amp; team</span>
        </label>

        ${history.length ? `
          <div class="stack gap-xs" style="border-top:1px solid var(--divider); padding-top:12px;">
            <div class="caption" style="font-weight:700; color:var(--text-primary);">Recent history</div>
            <div class="stack" style="gap:0;">
              ${history.map((log, i) => historyRow(log, history[i + 1], fields)).join('')}
            </div>
          </div>` : `
          <div class="caption" style="border-top:1px solid var(--divider); padding-top:12px;">No history yet for this movement — this will be your first logged result.</div>`}

        <button class="btn btn-primary" id="btn-save">Save</button>
      </div>
    </div>
  `);

  backdrop.querySelector('#rpe')?.addEventListener('input', (e) => {
    backdrop.querySelector('#rpe-label').textContent = `RPE: ${e.target.value}`;
  });
  backdrop.querySelector('#btn-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target.id === 'backdrop') backdrop.remove(); });

  backdrop.querySelector('#btn-save').addEventListener('click', () => {
    const weightVal = showWeight ? backdrop.querySelector('#weight').value : '';
    saveLog({
      ...existing,
      exerciseName: exercise.name,
      block: exercise.block,
      weightUsed: showWeight && weightVal !== '' ? Number(weightVal) : null,
      rpe: showRpe ? Number(backdrop.querySelector('#rpe').value) : null,
      timeOrRecord: showRecord ? (backdrop.querySelector('#record').value || null) : null,
      notes: backdrop.querySelector('#notes').value,
      isShared: backdrop.querySelector('#shared').checked,
      completedAt: new Date().toISOString(),
    });
    backdrop.remove();
    showToast('Result logged');
    onSaved();
  });

  document.body.appendChild(backdrop);
}
