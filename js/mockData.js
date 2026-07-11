import { makeWorkout, makeExercise, makeOrganization, makePracticeEvent, uuid } from './models.js';

// Multiple teams under (mostly) the same club, so a single coach/admin can
// manage more than one roster — e.g. a club director or a coach who runs
// both the U16 Girls and U14 Boys squads. This is what makes admin-to-team
// a many-to-many relationship instead of 1-to-1.
export const ORGANIZATIONS = [
  makeOrganization({ id: 'org-riverside-u16g', name: 'Riverside FC Academy', teamName: 'U16 Girls', sport: 'Soccer', joinCode: 'RIVERSIDE24' }),
  makeOrganization({ id: 'org-riverside-u14b', name: 'Riverside FC Academy', teamName: 'U14 Boys', sport: 'Soccer', joinCode: 'RIVU14B' }),
  makeOrganization({ id: 'org-westside-u18g', name: 'Westside SC', teamName: 'U18 Girls', sport: 'Soccer', joinCode: 'WESTSIDE18' }),
];

// Kept for backward compatibility with earlier seed/join-code flows.
export const sampleOrg = ORGANIZATIONS[0];

function dateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function dateTimeOffset(days, hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function mondayExercises() {
  return [
    makeExercise({ id: uuid(), name: 'Dynamic mobility', block: 'Warm-up', prescribed: '5 min' }),
    makeExercise({ id: uuid(), name: 'Goblet Squat', block: 'Strength', prescribed: '3 x 10', tutorialUrl: 'https://example.com/tutorials/goblet-squat' }),
    makeExercise({ id: uuid(), name: 'Romanian Deadlift', block: 'Strength', prescribed: '3 x 10', tutorialUrl: 'https://example.com/tutorials/rdl' }),
    makeExercise({ id: uuid(), name: 'Walking Lunges', block: 'Strength', prescribed: '3 x 10' }),
    makeExercise({ id: uuid(), name: 'Push-ups', block: 'Strength', prescribed: '3 x 10' }),
    makeExercise({ id: uuid(), name: 'Cone dribbling', block: 'Ball Skills', prescribed: '10 min', tutorialUrl: 'https://example.com/tutorials/cone-dribbling' }),
    makeExercise({ id: uuid(), name: 'Wall passes', block: 'Ball Skills', prescribed: '100 each foot' }),
  ];
}

function tuesdayExercises() {
  return [
    makeExercise({ id: uuid(), name: 'A-skips', block: 'Agility', prescribed: '3 x 20m', tutorialUrl: 'https://example.com/tutorials/a-skips' }),
    makeExercise({ id: uuid(), name: '6 x 10m accelerations', block: 'Agility', prescribed: '6 reps' }),
    makeExercise({ id: uuid(), name: '5-10-5 shuttle', block: 'Agility', prescribed: 'x5', tutorialUrl: 'https://example.com/tutorials/5-10-5-shuttle' }),
    makeExercise({ id: uuid(), name: 'Inside/outside touches', block: 'Ball Skills', prescribed: '200' }),
    makeExercise({ id: uuid(), name: 'Weak-foot passing', block: 'Ball Skills', prescribed: '100' }),
  ];
}

function saturdayExercises() {
  return [
    makeExercise({ id: uuid(), name: 'Bounding', block: 'Agility', prescribed: '4 x 20m' }),
    makeExercise({ id: uuid(), name: 'Lateral hops', block: 'Agility', prescribed: '3 x 15' }),
    makeExercise({ id: uuid(), name: '500 total touches', block: 'Technical', prescribed: '30 min circuit' }),
    makeExercise({ id: uuid(), name: 'Juggling personal best', block: 'Technical', prescribed: 'Max attempt', tutorialUrl: 'https://example.com/tutorials/juggling' }),
  ];
}

function workoutsForOrg(orgId, titlePrefix = '') {
  return [
    makeWorkout({ id: uuid(), title: `${titlePrefix}Strength A + Ball Skills`, date: dateOffset(-2), weekNumber: 1, dayLabel: 'Monday', sessionLength: '60 min', exercises: mondayExercises(), organizationId: orgId, assignedTo: 'all' }),
    makeWorkout({ id: uuid(), title: `${titlePrefix}Agility + Ball Skills`, date: dateOffset(-1), weekNumber: 1, dayLabel: 'Tuesday', sessionLength: '55 min', exercises: tuesdayExercises(), organizationId: orgId, assignedTo: 'all' }),
    makeWorkout({ id: uuid(), title: `${titlePrefix}Strength B + Ball Skills`, date: dateOffset(0), weekNumber: 1, dayLabel: 'Wednesday', sessionLength: '60 min', exercises: mondayExercises(), organizationId: orgId, assignedTo: 'all' }),
    makeWorkout({ id: uuid(), title: `${titlePrefix}Agility + Ball Skills`, date: dateOffset(1), weekNumber: 1, dayLabel: 'Thursday', sessionLength: '55 min', exercises: tuesdayExercises(), organizationId: orgId, assignedTo: 'all' }),
    makeWorkout({ id: uuid(), title: `${titlePrefix}Strength C + Ball Skills`, date: dateOffset(3), weekNumber: 1, dayLabel: 'Friday', sessionLength: '60 min', exercises: mondayExercises(), organizationId: orgId, assignedTo: 'all' }),
    makeWorkout({ id: uuid(), title: `${titlePrefix}Agility + Technical`, date: dateOffset(4), weekNumber: 1, dayLabel: 'Saturday', sessionLength: '50 min', exercises: saturdayExercises(), organizationId: orgId, assignedTo: 'all' }),
  ];
}

// Every seeded org gets its own copy of the 6-week-plan-style week so
// switching teams as an admin actually shows different content.
export function seedWorkouts() {
  return [
    ...workoutsForOrg(ORGANIZATIONS[0].id),
    ...workoutsForOrg(ORGANIZATIONS[1].id, 'U14 '),
    ...workoutsForOrg(ORGANIZATIONS[2].id, 'U18 '),
  ];
}

// A small seeded roster per org so each managed team has real athletes.
// In a real backend this comes from actual signups/invites tied to the
// organization, not a hardcoded list.
export function seedRosterByOrg() {
  return {
    [ORGANIZATIONS[0].id]: [
      { id: 'athlete-1', fullName: 'Maya Chen', email: 'maya@example.com', role: 'athlete', organizationId: ORGANIZATIONS[0].id },
      { id: 'athlete-2', fullName: 'Zoe Patterson', email: 'zoe@example.com', role: 'athlete', organizationId: ORGANIZATIONS[0].id },
      { id: 'athlete-3', fullName: 'Ava Torres', email: 'ava@example.com', role: 'athlete', organizationId: ORGANIZATIONS[0].id },
    ],
    [ORGANIZATIONS[1].id]: [
      { id: 'athlete-4', fullName: 'Diego Ramirez', email: 'diego@example.com', role: 'athlete', organizationId: ORGANIZATIONS[1].id },
      { id: 'athlete-5', fullName: 'Sam Lee', email: 'sam@example.com', role: 'athlete', organizationId: ORGANIZATIONS[1].id },
    ],
    [ORGANIZATIONS[2].id]: [
      { id: 'athlete-6', fullName: 'Priya Nair', email: 'priya@example.com', role: 'athlete', organizationId: ORGANIZATIONS[2].id },
    ],
  };
}

// Sample clips for the primary seeded roster so the Clips tab has real
// content for an admin to review/critique immediately.
export function seedRosterClips() {
  return {
    'athlete-1': [
      { id: uuid(), url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', platform: 'youtube', title: 'First touch drill — week 2', addedAt: dateOffset(-3), likes: [], reactions: {} },
    ],
    'athlete-2': [
      { id: uuid(), url: 'https://app.veo.co/matches/sample-match-id/', platform: 'veo', title: 'Saturday match highlights', addedAt: dateOffset(-1), likes: [], reactions: {} },
    ],
  };
}

export function seedClipComments(clips) {
  const comments = {};
  const athlete1Clip = clips['athlete-1']?.[0];
  if (athlete1Clip) {
    comments[athlete1Clip.id] = [
      { id: uuid(), authorId: 'admin-1', authorName: 'Coach Alvarez', authorRole: 'admin', text: 'Nice first touch on the far side — try opening your hips earlier next rep. 💪', createdAt: dateOffset(-2) },
    ];
  }
  return comments;
}

export function seedRosterLogs(workouts) {
  const logs = [];
  const org1Workouts = workouts.filter((w) => w.organizationId === ORGANIZATIONS[0].id);
  const monday = org1Workouts.find((w) => w.dayLabel === 'Monday');
  const tuesday = org1Workouts.find((w) => w.dayLabel === 'Tuesday');
  if (monday) {
    monday.exercises.slice(0, 4).forEach((ex, i) => {
      logs.push({
        id: uuid(), exerciseId: ex.id, workoutId: monday.id, userId: 'athlete-1',
        exerciseName: ex.name, block: ex.block,
        weightUsed: ex.block === 'Strength' ? 45 + i * 5 : null, rpe: 6 + (i % 3),
        timeOrRecord: null, notes: '', isShared: true, completedAt: dateOffset(-2),
      });
    });
    monday.exercises.slice(0, 2).forEach((ex, i) => {
      logs.push({
        id: uuid(), exerciseId: ex.id, workoutId: monday.id, userId: 'athlete-2',
        exerciseName: ex.name, block: ex.block,
        weightUsed: ex.block === 'Strength' ? 35 + i * 5 : null, rpe: 7,
        timeOrRecord: null, notes: 'Felt strong today', isShared: true, completedAt: dateOffset(-2),
      });
    });
  }
  if (tuesday) {
    tuesday.exercises.forEach((ex, i) => {
      logs.push({
        id: uuid(), exerciseId: ex.id, workoutId: tuesday.id, userId: 'athlete-3',
        exerciseName: ex.name, block: ex.block,
        weightUsed: null, rpe: 5 + (i % 4), timeOrRecord: ex.name.includes('shuttle') ? '4.8s' : null,
        notes: '', isShared: true, completedAt: dateOffset(-1),
      });
    });
  }
  return logs;
}

// Multi-week dummy history for the demo athlete login (Jordan Casey), so
// opening a Strength or Agility exercise's log sheet shows a real trend —
// e.g. Goblet Squat weight climbing week over week — without requiring the
// person testing the app to manually log four weeks of data first.
// Matched by exercise NAME (not a specific workout's exerciseId), which is
// how the app looks up history in general, since a repeated weekly workout
// generates a fresh exercise id each time it's created.
export function seedDemoAthleteHistory() {
  const userId = 'demo-athlete-1';
  const entries = [
    { name: 'Goblet Squat', block: 'Strength', weeksAgo: 3, weight: 30, rpe: 6 },
    { name: 'Goblet Squat', block: 'Strength', weeksAgo: 2, weight: 35, rpe: 6 },
    { name: 'Goblet Squat', block: 'Strength', weeksAgo: 1, weight: 40, rpe: 7 },
    { name: 'Romanian Deadlift', block: 'Strength', weeksAgo: 3, weight: 40, rpe: 6 },
    { name: 'Romanian Deadlift', block: 'Strength', weeksAgo: 2, weight: 45, rpe: 7 },
    { name: 'Romanian Deadlift', block: 'Strength', weeksAgo: 1, weight: 45, rpe: 6 },
    { name: '5-10-5 shuttle', block: 'Agility', weeksAgo: 3, record: '5.1s', rpe: 7 },
    { name: '5-10-5 shuttle', block: 'Agility', weeksAgo: 2, record: '4.9s', rpe: 7 },
    { name: '5-10-5 shuttle', block: 'Agility', weeksAgo: 1, record: '4.8s', rpe: 8 },
  ];
  return entries.map((e) => ({
    id: uuid(),
    exerciseId: `history-${e.name}-${e.weeksAgo}`,
    workoutId: `history-workout-${e.weeksAgo}`,
    userId,
    exerciseName: e.name,
    block: e.block,
    weightUsed: e.weight ?? null,
    rpe: e.rpe,
    timeOrRecord: e.record ?? null,
    notes: '',
    isShared: false,
    completedAt: dateOffset(-7 * e.weeksAgo),
  }));
}

// ---------- Simulated 3rd-party practice schedule (PlayMetrics-style) ----------
// NOTE: this is simulated data, not a live PlayMetrics integration — there is
// no public third-party API PlayMetrics exposes for this, so these events
// are generated locally and clearly labeled as simulated in the UI.
function practicesForOrg(orgId, weekday1 = 2, weekday2 = 4) {
  const events = [];
  for (let week = 0; week < 3; week++) {
    [weekday1, weekday2].forEach((targetDow, idx) => {
      const today = new Date();
      const daysUntil = ((targetDow - today.getDay() + 7) % 7) + week * 7;
      const iso = dateTimeOffset(daysUntil, 16, 30);
      events.push(makePracticeEvent({
        id: uuid(),
        title: 'Team Practice',
        date: iso,
        durationMinutes: 90,
        location: 'Riverside Sports Complex — Field 3',
        organizationId: orgId,
        source: 'PlayMetrics (simulated)',
      }));
    });
  }
  return events;
}

export function seedPractices() {
  return [
    ...practicesForOrg(ORGANIZATIONS[0].id),
    ...practicesForOrg(ORGANIZATIONS[1].id, 1, 3),
    ...practicesForOrg(ORGANIZATIONS[2].id, 2, 5),
  ];
}

// Which admin(s) manage which org. The demo admin (Coach Alvarez) manages
// two teams at the same club — the many-to-many relationship you asked for.
// Westside SC's U18 Girls team is run by a different, separate admin
// account, showing a club/org isn't locked to exactly one admin either.
export const ORG_ADMIN_DIRECTORY = {
  [ORGANIZATIONS[0].id]: [{ id: 'admin-1', fullName: 'Coach Alvarez' }],
  [ORGANIZATIONS[1].id]: [{ id: 'admin-1', fullName: 'Coach Alvarez' }],
  [ORGANIZATIONS[2].id]: [{ id: 'admin-2', fullName: 'Coach Rivera' }],
};
