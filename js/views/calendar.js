import { h, mount, formatDate, categoryTag, emptyState } from '../components/dom.js';
import { getState, workoutsForCurrentUser, setSelectedDate, practicesForCurrentUser, practiceRsvpStatus, setPracticeRsvp, isAdmin, organizationsForCurrentUser } from '../store.js';
import { isSameDay, organizationDisplayName } from '../models.js';
import { ICONS } from '../components/icons.js';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const start = new Date(year, month, 1 - startOffset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function practiceCard(practice) {
  const time = new Date(practice.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const rsvp = practiceRsvpStatus(practice.id);
  return `
    <div class="card stack gap-sm" data-practice-id="${practice.id}">
      <div class="row-between">
        <div class="stack gap-xs">
          <div class="h-headline">${practice.title}</div>
          <div class="caption">${time} · ${practice.durationMinutes} min · ${practice.location}</div>
        </div>
        <span class="caption" style="background:var(--surface-elevated); padding:4px 10px; border-radius:var(--radius-pill); white-space:nowrap;">${practice.source}</span>
      </div>
      <div class="row gap-sm">
        <button class="pill-action-btn ${rsvp === 'going' ? 'primary' : ''}" data-rsvp="going" data-rsvp-practice="${practice.id}" style="flex:1; justify-content:center;">Going</button>
        <button class="pill-action-btn ${rsvp === 'not_going' ? 'danger' : ''}" data-rsvp="not_going" data-rsvp-practice="${practice.id}" style="flex:1; justify-content:center;">Can't make it</button>
      </div>
    </div>`;
}

export function renderCalendar(container, { onOpenWorkout }) {
  const workouts = workoutsForCurrentUser();
  const practices = practicesForCurrentUser();
  const selected = new Date(getState().selectedDate);
  let viewDate = new Date(selected.getFullYear(), selected.getMonth(), 1);

  // Only worth labeling which team a workout belongs to when the athlete
  // is actually on more than one — avoids clutter for the common case.
  const myTeams = !isAdmin() ? organizationsForCurrentUser() : [];
  const teamNameById = myTeams.length > 1
    ? Object.fromEntries(myTeams.map((o) => [o.id, organizationDisplayName(o)]))
    : null;

  function draw() {
    const days = buildMonthGrid(viewDate);
    const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const dayWorkouts = workouts.filter((w) => isSameDay(w.date, getState().selectedDate));
    const dayPractices = practices.filter((p) => isSameDay(p.date, getState().selectedDate))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const node = h(`
      <div class="screen stack gap-lg">
        <h1 class="h-hero">Calendar</h1>
        <div class="card stack gap-md">
          <div class="row-between">
            <button class="icon-btn icon-btn-sm" id="prev">${ICONS.chevronLeft}</button>
            <div class="h-headline">${monthLabel}</div>
            <button class="icon-btn icon-btn-sm" id="next">${ICONS.chevronRight}</button>
          </div>
          <div class="cal-grid">
            ${DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
            ${days.map((d) => {
              const outside = d.getMonth() !== viewDate.getMonth();
              const isToday = isSameDay(d, new Date());
              const isSelected = isSameDay(d, getState().selectedDate);
              const hasWorkout = workouts.some((w) => isSameDay(w.date, d));
              const hasPractice = practices.some((p) => isSameDay(p.date, d));
              const cls = ['cal-day', outside && 'outside', isToday && 'today', isSelected && 'selected'].filter(Boolean).join(' ');
              let dots = '';
              if (hasWorkout && hasPractice) {
                dots = `<span class="cal-dot" style="left:calc(50% - 6px);"></span><span class="cal-dot" style="left:calc(50% + 2px); background:var(--warning);"></span>`;
              } else if (hasWorkout) {
                dots = `<span class="cal-dot"></span>`;
              } else if (hasPractice) {
                dots = `<span class="cal-dot" style="background:var(--warning);"></span>`;
              }
              return `<button class="${cls}" data-date="${d.toISOString()}">${d.getDate()}${dots}</button>`;
            }).join('')}
          </div>
        </div>

        <div class="stack gap-sm">
          <div class="h-headline">${formatDate(getState().selectedDate)}</div>

          ${dayWorkouts.length ? dayWorkouts.map((w) => `
            <button class="card card-tappable stack gap-sm" data-workout-id="${w.id}">
              <div class="row">
                <div class="stack gap-xs" style="flex:1;">
                  <div class="h-headline">${w.title}</div>
                  <div class="caption">${teamNameById ? teamNameById[w.organizationId] + ' · ' : ''}${w.dayLabel} · ${w.sessionLength} · ${w.exercises.length} exercises</div>
                </div>
                <svg class="chevron" width="18" height="18" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </div>
              <div class="row-wrap gap-xs">${[...new Set(w.exercises.map((ex) => ex.block))].slice(0, 3).map(categoryTag).join('')}</div>
            </button>
          `).join('') : ''}

          ${dayPractices.map(practiceCard).join('')}

          ${!dayWorkouts.length && !dayPractices.length ? `<div class="card">${emptyState({ icon: ICONS.calendarRest, title: 'Nothing scheduled', subtitle: 'No workout or practice on this day.' })}</div>` : ''}
        </div>
      </div>
    `);

    node.querySelector('#prev').addEventListener('click', () => {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      draw();
    });
    node.querySelector('#next').addEventListener('click', () => {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
      draw();
    });
    node.querySelectorAll('[data-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setSelectedDate(new Date(btn.dataset.date).toISOString());
        draw();
      });
    });
    node.querySelectorAll('[data-workout-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const workout = workouts.find((w) => w.id === btn.dataset.workoutId);
        onOpenWorkout(workout);
      });
    });
    node.querySelectorAll('[data-rsvp-practice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setPracticeRsvp(btn.dataset.rsvpPractice, btn.dataset.rsvp);
        draw();
      });
    });

    mount(container, node);
  }

  draw();
}
