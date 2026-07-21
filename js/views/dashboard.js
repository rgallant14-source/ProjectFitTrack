import { h, mount, categoryTag, emptyState } from '../components/dom.js';
import { ICONS } from '../components/icons.js';
import { workoutsForCurrentUser, findLog, isAdmin, rosterMembers, overallCompletionForUser, currentStreakForUser, getState, logsForUser, organizationsForCurrentUser } from '../store.js';
import { isSameDay, organizationDisplayName } from '../models.js';
import { equipmentForWorkout, quoteOfTheDay, highlightOfTheDay } from '../dailyContent.js';

function workoutRow(workout, teamNameById) {
  const blocks = [...new Set(workout.exercises.map((ex) => ex.block))].slice(0, 3);
  return `
    <button class="card card-tappable stack gap-sm" data-workout-id="${workout.id}" style="margin-bottom:8px;">
      <div class="row">
        <div class="stack gap-xs" style="flex:1;">
          <div class="row gap-xs" style="align-items:center;">
            <div class="h-headline">${workout.title}</div>
            ${!workout.createdByVerified ? '<span class="caption" style="color:var(--warning); font-weight:700;">Pending Verification</span>' : ''}
          </div>
          <div class="caption">${teamNameById ? teamNameById[workout.organizationId] + ' · ' : ''}${workout.dayLabel} · ${workout.sessionLength} · ${workout.exercises.length} exercises</div>
        </div>
        <svg class="chevron" width="18" height="18" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
      <div class="row-wrap gap-xs">${blocks.map(categoryTag).join('')}</div>
    </button>`;
}

function equipmentCard(workout) {
  const items = equipmentForWorkout(workout);
  return `
    <div class="card stack gap-sm">
      <div class="row gap-sm">
        <span class="card-icon" style="color:var(--hue-orange-1);">${ICONS.backpack}</span>
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
        <span class="card-icon" style="color:var(--hue-pink-1);">${ICONS.quote}</span>
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
        <span class="card-icon" style="color:var(--hue-orange-2);">${ICONS.fire}</span>
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
  const user = getState().currentUser;

  // Only worth labeling which team a workout belongs to when the athlete
  // is actually on more than one — avoids clutter for the common case.
  const myTeams = !admin ? organizationsForCurrentUser() : [];
  const teamNameById = myTeams.length > 1
    ? Object.fromEntries(myTeams.map((o) => [o.id, organizationDisplayName(o)]))
    : null;

  let bento;
  if (admin) {
    // Admins get a team-wide snapshot instead of personal stats.
    const roster = rosterMembers();
    const avgPct = roster.length
      ? Math.round((roster.reduce((sum, m) => sum + overallCompletionForUser(m.id), 0) / roster.length) * 100)
      : 0;
    const totalLogged = roster.reduce((sum, m) => sum + logsForUser(m.id).length, 0);
    bento = `
      <div class="bento-grid">
        <div class="bento-card blue">
          <span class="bento-icon">${ICONS.chart}</span>
          <div><div class="bento-value">${avgPct}%</div><div class="bento-label">Team Completion</div></div>
        </div>
        <div class="bento-card orange">
          <span class="bento-icon">${ICONS.people}</span>
          <div><div class="bento-value">${roster.length}</div><div class="bento-label">Athletes</div></div>
        </div>
        <div class="bento-card wide purple">
          <span class="bento-icon">${ICONS.clipboard}</span>
          <div><div class="bento-value">${totalLogged}</div><div class="bento-label">Results logged this week across your team</div></div>
        </div>
      </div>`;
  } else {
    let fraction = 0;
    if (today && today.exercises.length) {
      const logged = today.exercises.filter((ex) => findLog(ex.id, today.id)).length;
      fraction = logged / today.exercises.length;
    }
    const streak = currentStreakForUser(user.id);
    const totalLogged = logsForUser(user.id).length;
    bento = `
      <div class="bento-grid">
        <div class="bento-card blue">
          <span class="bento-icon">${ICONS.bolt}</span>
          <div><div class="bento-value">${Math.round(fraction * 100)}%</div><div class="bento-label">Today's Progress</div></div>
        </div>
        <div class="bento-card orange">
          <span class="bento-icon">${ICONS.fire}</span>
          <div><div class="bento-value">${streak}</div><div class="bento-label">Day Streak</div></div>
        </div>
        <div class="bento-card wide green">
          <span class="bento-icon">${ICONS.trendingUp}</span>
          <div><div class="bento-value">${totalLogged}</div><div class="bento-label">Total results logged — keep it up!</div></div>
        </div>
      </div>`;
  }

  const node = h(`
    <div class="screen stack gap-lg">
      <div class="row-between">
        <h1 class="h-hero">Hey, ${user.fullName.split(' ')[0]}</h1>
        ${!admin && currentStreakForUser(user.id) > 0 ? `<span class="streak-badge">${ICONS.fire} ${currentStreakForUser(user.id)}</span>` : ''}
      </div>

      ${bento}

      <div class="stack gap-sm">
        <div class="h-headline">${admin ? "Today's Team Workout" : "Today's Workout"}</div>
        ${today ? workoutRow(today, teamNameById) : `<div class="card">${emptyState({ icon: ICONS.calendarRest, title: 'No workout today', subtitle: 'Enjoy the rest — recovery is part of training too.' })}</div>`}
      </div>

      ${!admin ? equipmentCard(today) : ''}

      ${quoteCard()}

      ${highlightCard()}

      ${upcoming.length ? `
        <div class="stack gap-sm">
          <div class="h-headline">Coming Up</div>
          ${upcoming.map((w) => workoutRow(w, teamNameById)).join('')}
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
