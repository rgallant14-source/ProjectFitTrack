import { h, mount } from '../components/dom.js';
import { workoutsForCurrentUser, findLog, isAdmin, rosterMembers, overallCompletionForUser } from '../store.js';
import { isSameDay } from '../models.js';
import { equipmentForWorkout, quoteOfTheDay, highlightOfTheDay } from '../dailyContent.js';

function progressRing(fraction) {
  const r = 24, c = 2 * Math.PI * r;
  const offset = c * (1 - fraction);
  return `
    <div class="ring-wrap">
      <svg viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--surface-elevated)" stroke-width="6"/>
        <circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--accent)" stroke-width="6"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="ring-label">${Math.round(fraction * 100)}%</div>
    </div>`;
}

function workoutRow(workout) {
  return `
    <button class="card card-tappable row" data-workout-id="${workout.id}" style="margin-bottom:8px;">
      <div class="stack gap-xs" style="flex:1;">
        <div class="h-headline">${workout.title}</div>
        <div class="caption">${workout.dayLabel} · ${workout.sessionLength} · ${workout.exercises.length} exercises</div>
      </div>
      <svg class="chevron" width="18" height="18" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>`;
}

function equipmentCard(workout) {
  const items = equipmentForWorkout(workout);
  return `
    <div class="card stack gap-sm">
      <div class="row gap-sm">
        <span style="font-size:20px;">🎒</span>
        <div class="h-headline">Equipment Needed Today</div>
      </div>
      ${items.length
        ? `<div class="row-wrap gap-sm">${items.map((item) => `<span class="caption" style="background:var(--surface-elevated); padding:6px 12px; border-radius:var(--radius-pill);">${item}</span>`).join('')}</div>`
        : `<div class="caption">Just yourself — no extra gear needed today.</div>`}
    </div>`;
}

function quoteCard() {
  const q = quoteOfTheDay();
  return `
    <div class="card card-glow stack gap-sm">
      <div class="row gap-sm">
        <span style="font-size:20px;">💬</span>
        <div class="h-headline">Quote of the Day</div>
      </div>
      <div class="body-text" style="font-style:italic;">"${q.text}"</div>
      <div class="caption">— ${q.author}</div>
    </div>`;
}

function highlightCard() {
  const highlight = highlightOfTheDay();
  return `
    <div class="card stack gap-sm">
      <div class="row gap-sm">
        <span style="font-size:20px;">🔥</span>
        <div class="h-headline">Today's Top Play</div>
      </div>
      <div class="clip-thumb" style="border-radius:var(--radius-control);">
        <iframe src="https://www.youtube.com/embed/${highlight.videoId}" title="${highlight.title}" allowfullscreen loading="lazy"></iframe>
      </div>
      <div class="caption">${highlight.title}</div>
    </div>`;
}

export function renderDashboard(container, { onOpenWorkout }) {
  const workouts = workoutsForCurrentUser();
  const today = workouts.find((w) => isSameDay(w.date, new Date()));
  const upcoming = workouts.filter((w) => new Date(w.date) > new Date()).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
  const admin = isAdmin();

  let summaryCard;
  if (admin) {
    // Admins get a team-wide snapshot instead of a personal progress ring —
    // their own completion percentage isn't meaningful here.
    const roster = rosterMembers();
    const avg = roster.length
      ? roster.reduce((sum, m) => sum + overallCompletionForUser(m.id), 0) / roster.length
      : 0;
    summaryCard = `
      <div class="card row gap-md">
        ${progressRing(avg)}
        <div class="stack gap-xs">
          <div class="h-headline">Team Completion</div>
          <div class="caption">${roster.length} athlete${roster.length === 1 ? '' : 's'} · average across assigned workouts</div>
        </div>
      </div>`;
  } else {
    let fraction = 0;
    if (today && today.exercises.length) {
      const logged = today.exercises.filter((ex) => findLog(ex.id, today.id)).length;
      fraction = logged / today.exercises.length;
    }
    summaryCard = `
      <div class="card row gap-md">
        ${progressRing(fraction)}
        <div class="stack gap-xs">
          <div class="h-headline">Today's Progress</div>
          <div class="caption">${fraction >= 1 ? 'All exercises logged' : 'Keep going — log your results'}</div>
        </div>
      </div>`;
  }

  const node = h(`
    <div class="screen stack gap-lg">
      <h1 class="h-hero">Dashboard</h1>

      ${summaryCard}

      <div class="stack gap-sm">
        <div class="h-headline">${admin ? "Today's Team Workout" : "Today's Workout"}</div>
        ${today ? workoutRow(today) : `<div class="card subheadline">No workout scheduled today.</div>`}
      </div>

      ${!admin ? equipmentCard(today) : ''}

      ${quoteCard()}

      ${highlightCard()}

      ${upcoming.length ? `
        <div class="stack gap-sm">
          <div class="h-headline">Coming Up</div>
          ${upcoming.map(workoutRow).join('')}
        </div>` : ''}
    </div>
  `);

  node.querySelectorAll('[data-workout-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const workout = workouts.find((w) => w.id === btn.dataset.workoutId);
      onOpenWorkout(workout);
    });
  });

  mount(container, node);
}
