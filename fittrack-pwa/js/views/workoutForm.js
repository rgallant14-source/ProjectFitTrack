import { h, mount, showToast } from '../components/dom.js';
import { createWorkout, rosterMembers } from '../store.js';
import { makeExercise, uuid, BLOCKS } from '../models.js';
import { ICONS } from '../components/icons.js';

function exerciseRowFields(rowId) {
  return `
    <div class="card stack gap-sm" data-row-id="${rowId}" style="margin-bottom:8px;">
      <div class="row-between">
        <span class="caption">Exercise</span>
        <button class="icon-btn icon-btn-sm danger" data-remove-row>${ICONS.trash}</button>
      </div>
      <input type="text" placeholder="Exercise name" data-field="name" />
      <div class="row gap-sm">
        <select data-field="block" style="flex:1; background:var(--surface-elevated); color:var(--text-primary); border:none; border-radius:12px; padding:12px;">
          ${BLOCKS.map((b) => `<option value="${b}">${b}</option>`).join('')}
        </select>
        <input type="text" placeholder="e.g. 3 x 10" data-field="prescribed" style="flex:1;" />
      </div>
      <input type="url" placeholder="Tutorial link (optional)" data-field="tutorialUrl" />
    </div>`;
}

export function renderWorkoutForm(container, { onDone, onCancel }) {
  let rowCount = 0;
  const roster = rosterMembers();

  const node = h(`
    <div class="screen stack gap-lg">
      <div class="screen-header">
        <button class="icon-btn" id="btn-cancel">${ICONS.close}</button>
        <div class="h-headline screen-title">New Workout</div>
        <span style="width:40px;"></span>
      </div>

      <div class="card stack gap-md">
        <div class="field">
          <label for="title">Title</label>
          <input id="title" type="text" placeholder="e.g. Strength A + Ball Skills" />
        </div>
        <div class="row gap-sm">
          <div class="field" style="flex:1;">
            <label for="date">Date</label>
            <input id="date" type="date" />
          </div>
          <div class="field" style="flex:1;">
            <label for="length">Session length</label>
            <input id="length" type="text" placeholder="60 min" />
          </div>
        </div>
        <div class="field">
          <label for="day">Day label</label>
          <input id="day" type="text" placeholder="Monday" />
        </div>
      </div>

      <div class="stack gap-sm">
        <div class="row-between">
          <div class="h-headline">Exercises</div>
          <button class="pill-action-btn" id="btn-add-row">${ICONS.plus} Add Exercise</button>
        </div>
        <div id="rows"></div>
      </div>

      <div class="stack gap-sm">
        <div class="h-headline">Assign To</div>
        <div class="card stack gap-sm">
          <label class="row gap-sm" style="cursor:pointer;">
            <input type="radio" name="assign" value="all" checked />
            <span class="body-text">Whole team</span>
          </label>
          <label class="row gap-sm" style="cursor:pointer;">
            <input type="radio" name="assign" value="specific" />
            <span class="body-text">Specific athletes</span>
          </label>
          <div id="athlete-picker" class="stack gap-xs" style="display:none; padding-left:24px;">
            ${roster.map((m) => `
              <label class="row gap-sm" style="cursor:pointer;">
                <input type="checkbox" data-athlete-checkbox value="${m.id}" />
                <span class="body-text">${m.fullName}</span>
              </label>`).join('')}
          </div>
        </div>
      </div>

      <div id="err" class="error-text"></div>
      <button class="btn btn-primary" id="btn-save">Post Workout</button>
    </div>
  `);

  const rowsEl = node.querySelector('#rows');

  function addRow() {
    rowCount += 1;
    const rowEl = h(exerciseRowFields(rowCount));
    rowEl.querySelector('[data-remove-row]').addEventListener('click', () => rowEl.remove());
    rowsEl.appendChild(rowEl);
  }
  addRow(); // start with one blank exercise row

  node.querySelector('#btn-add-row').addEventListener('click', addRow);
  node.querySelector('#btn-cancel').addEventListener('click', onCancel);

  node.querySelectorAll('input[name="assign"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      node.querySelector('#athlete-picker').style.display = radio.value === 'specific' && radio.checked ? 'flex' : 'none';
    });
  });

  node.querySelector('#btn-save').addEventListener('click', () => {
    const title = node.querySelector('#title').value.trim();
    const dateVal = node.querySelector('#date').value;
    const length = node.querySelector('#length').value.trim();
    const day = node.querySelector('#day').value.trim();
    const errEl = node.querySelector('#err');

    if (!title || !dateVal || !length || !day) {
      errEl.textContent = 'Please fill in title, date, session length, and day label.';
      return;
    }

    const exercises = [...rowsEl.querySelectorAll('[data-row-id]')].map((row) => {
      const name = row.querySelector('[data-field="name"]').value.trim();
      const block = row.querySelector('[data-field="block"]').value;
      const prescribed = row.querySelector('[data-field="prescribed"]').value.trim();
      const tutorialUrl = row.querySelector('[data-field="tutorialUrl"]').value.trim() || null;
      return name ? makeExercise({ id: uuid(), name, block, prescribed: prescribed || '-', tutorialUrl }) : null;
    }).filter(Boolean);

    if (!exercises.length) {
      errEl.textContent = 'Add at least one exercise.';
      return;
    }

    const assignMode = node.querySelector('input[name="assign"]:checked').value;
    let assignedTo = 'all';
    if (assignMode === 'specific') {
      assignedTo = [...node.querySelectorAll('[data-athlete-checkbox]:checked')].map((cb) => cb.value);
      if (!assignedTo.length) {
        errEl.textContent = 'Select at least one athlete, or choose "Whole team".';
        return;
      }
    }

    errEl.textContent = '';
    createWorkout({
      title,
      date: new Date(dateVal).toISOString(),
      dayLabel: day,
      sessionLength: length,
      exercises,
      assignedTo,
    });
    showToast('Workout posted');
    onDone();
  });

  mount(container, node);
}
