import { h, mount, showToast, categoryTag } from '../components/dom.js';
import { getState, findLog, saveLog } from '../store.js';
import { makeExerciseLog, uuid, BLOCKS } from '../models.js';
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

function openLogSheet(exercise, workout, onSaved) {
  const existing = findLog(exercise.id, workout.id) || makeExerciseLog({
    id: uuid(), exerciseId: exercise.id, workoutId: workout.id, userId: getState().currentUser.id,
  });

  const backdrop = h(`
    <div class="sheet-backdrop" id="backdrop">
      <div class="sheet stack gap-md">
        <div class="sheet-grabber"></div>
        <div class="sheet-header">
          <div class="stack gap-xs">
            <div class="h-headline">${exercise.name}</div>
            <div class="caption">${exercise.prescribed}</div>
          </div>
          <button class="icon-btn icon-btn-sm" id="btn-cancel">${ICONS.close}</button>
        </div>

        <div class="field">
          <label for="weight">Weight used</label>
          <input id="weight" type="number" inputmode="decimal" placeholder="lbs" value="${existing.weightUsed ?? ''}" />
        </div>

        <div class="field">
          <label id="rpe-label">RPE: ${existing.rpe ?? 5}</label>
          <input id="rpe" type="range" min="1" max="10" step="1" value="${existing.rpe ?? 5}" />
        </div>

        <div class="field">
          <label for="record">Time / record</label>
          <input id="record" type="text" placeholder="e.g. 1.9s, 34 juggles" value="${existing.timeOrRecord ?? ''}" />
        </div>

        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" rows="3">${existing.notes ?? ''}</textarea>
        </div>

        <label class="row gap-sm" style="cursor:pointer;">
          <input id="shared" type="checkbox" ${existing.isShared ? 'checked' : ''} />
          <span class="body-text">Share with coach &amp; team</span>
        </label>

        <button class="btn btn-primary" id="btn-save">Save</button>
      </div>
    </div>
  `);

  backdrop.querySelector('#rpe').addEventListener('input', (e) => {
    backdrop.querySelector('#rpe-label').textContent = `RPE: ${e.target.value}`;
  });
  backdrop.querySelector('#btn-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#backdrop').addEventListener('click', (e) => { if (e.target.id === 'backdrop') backdrop.remove(); });

  backdrop.querySelector('#btn-save').addEventListener('click', () => {
    const weightVal = backdrop.querySelector('#weight').value;
    saveLog({
      ...existing,
      weightUsed: weightVal === '' ? null : Number(weightVal),
      rpe: Number(backdrop.querySelector('#rpe').value),
      timeOrRecord: backdrop.querySelector('#record').value || null,
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
