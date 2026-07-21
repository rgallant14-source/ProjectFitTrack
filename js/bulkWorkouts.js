import { BLOCKS } from './models.js';

// Column names are matched exactly (case-sensitive, trimmed) so a coach
// editing the downloaded template doesn't need to guess variants.
export const BULK_UPLOAD_HEADERS = [
  'Workout Key', 'Workout Title', 'Date', 'Day Label', 'Session Length',
  'Assigned To', 'Exercise Name', 'Block', 'Prescribed', 'Tutorial URL',
];
const REQUIRED_HEADERS = ['Workout Key', 'Workout Title', 'Date', 'Assigned To', 'Exercise Name', 'Block', 'Prescribed'];

// A few example rows shipped in the downloadable template — one row per
// block type isn't necessary, just enough to show the "repeat the workout
// columns on every exercise row" pattern and the Warm-up-has-no-metrics
// case alongside a scored one.
export function templateRows() {
  return [
    ['W1-Mon', 'Week 1 \u2013 Speed & Strength', '2026-08-04', 'Monday', '45 min', 'All', 'Dynamic Warm-up', 'Warm-up', '5 min light jog + leg swings', ''],
    ['W1-Mon', 'Week 1 \u2013 Speed & Strength', '2026-08-04', 'Monday', '45 min', 'All', 'Goblet Squat', 'Strength', '3x10 @ moderate weight', ''],
    ['W1-Mon', 'Week 1 \u2013 Speed & Strength', '2026-08-04', 'Monday', '45 min', 'All', '5-10-5 Shuttle', 'Agility', '4 reps, walk back to recover', ''],
  ];
}

function normalizeBlock(raw) {
  return BLOCKS.find((b) => b.toLowerCase() === raw.trim().toLowerCase()) ?? null;
}

function parseDateLoose(raw) {
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Pure — takes parsed headers/rows and a roster ([{id, fullName}, ...])
// and returns { workouts, errors, warnings }. Nothing here touches app
// state; the caller is responsible for actually creating the workouts
// (see commitBulkWorkouts in store.js) only after the person has reviewed
// this result in a preview screen.
export function buildWorkoutDrafts(headers, rows, roster) {
  const errors = [];
  const warnings = [];

  const normalizedHeaders = headers.map((h) => h.trim());
  const missing = REQUIRED_HEADERS.filter((h) => !normalizedHeaders.includes(h));
  if (missing.length) {
    errors.push(`Missing required column(s): ${missing.join(', ')}. Download a fresh template if you're unsure of the exact column names.`);
    return { workouts: [], errors, warnings };
  }

  const col = (name) => normalizedHeaders.indexOf(name);
  const idx = {
    key: col('Workout Key'), title: col('Workout Title'), date: col('Date'),
    dayLabel: col('Day Label'), sessionLength: col('Session Length'),
    assignedTo: col('Assigned To'), exerciseName: col('Exercise Name'),
    block: col('Block'), prescribed: col('Prescribed'), tutorialUrl: col('Tutorial URL'),
  };

  const groups = new Map(); // Workout Key -> draft

  rows.forEach((cells, rowIndex) => {
    const lineNo = rowIndex + 2; // header is line 1, rows are 1-indexed after it
    const get = (i) => (i >= 0 && cells[i] !== undefined ? cells[i].trim() : '');
    const key = get(idx.key);
    if (!key) { errors.push(`Row ${lineNo}: missing Workout Key \u2014 skipped.`); return; }

    let draft = groups.get(key);
    if (!draft) {
      const title = get(idx.title);
      const dateIso = parseDateLoose(get(idx.date));
      if (!title) { errors.push(`Row ${lineNo}: missing Workout Title for "${key}" \u2014 skipped.`); return; }
      if (!dateIso) { errors.push(`Row ${lineNo}: unrecognized Date "${get(idx.date)}" for "${key}" \u2014 skipped.`); return; }

      const assignedRaw = get(idx.assignedTo);
      let assignedTo = 'all';
      const unmatchedNames = [];
      if (assignedRaw.toLowerCase() !== 'all') {
        // Semicolons only — commas are the CSV delimiter itself, so a
        // comma-separated name list would silently corrupt the columns
        // after it if someone forgot to quote the cell.
        const names = assignedRaw.split(';').map((n) => n.trim()).filter(Boolean);
        const matchedIds = [];
        names.forEach((n) => {
          const member = roster.find((m) => m.fullName.toLowerCase() === n.toLowerCase() || m.id === n);
          if (member) matchedIds.push(member.id); else unmatchedNames.push(n);
        });
        assignedTo = matchedIds;
      }

      draft = {
        key, title, date: dateIso,
        dayLabel: get(idx.dayLabel) || undefined,
        sessionLength: get(idx.sessionLength) || undefined,
        assignedTo, unmatchedNames,
        exercises: [],
      };
      groups.set(key, draft);
    } else {
      // Later rows shouldn't disagree with the first row's workout-level
      // fields — if they do, keep the first row's values (don't let a
      // typo three rows down silently change the workout) and just flag it.
      const title = get(idx.title);
      if (title && title !== draft.title) {
        warnings.push(`Row ${lineNo}: title differs from the first row for "${key}" \u2014 using "${draft.title}".`);
      }
    }

    const exerciseName = get(idx.exerciseName);
    const blockRaw = get(idx.block);
    const prescribed = get(idx.prescribed);
    if (!exerciseName) { errors.push(`Row ${lineNo}: missing Exercise Name \u2014 skipped.`); return; }
    const block = normalizeBlock(blockRaw);
    if (!block) { errors.push(`Row ${lineNo}: "${blockRaw}" isn't a recognized block (must be one of ${BLOCKS.join(', ')}) \u2014 skipped.`); return; }
    if (!prescribed) { errors.push(`Row ${lineNo}: missing Prescribed value for "${exerciseName}" \u2014 skipped.`); return; }

    draft.exercises.push({ name: exerciseName, block, prescribed, tutorialUrl: get(idx.tutorialUrl) || null });
  });

  const workouts = [];
  groups.forEach((draft) => {
    if (Array.isArray(draft.assignedTo) && draft.unmatchedNames.length) {
      if (draft.assignedTo.length === 0) {
        errors.push(`Workout "${draft.key}": none of the assigned names matched your roster (${draft.unmatchedNames.join(', ')}) \u2014 not created.`);
        return;
      }
      warnings.push(`Workout "${draft.key}": ${draft.unmatchedNames.length} assigned name(s) not found on roster (${draft.unmatchedNames.join(', ')}) \u2014 created for the rest.`);
    }
    if (!draft.exercises.length) {
      errors.push(`Workout "${draft.key}": no valid exercises \u2014 not created.`);
      return;
    }
    workouts.push(draft);
  });

  return { workouts, errors, warnings };
}
