import { h, mount, showToast, formatDate, avatarColorClass, emptyState } from '../components/dom.js';
import {
  rosterMembers, overallCompletionForUser, workoutsForCurrentUser, deleteWorkout,
  adminOrganizations, switchOrganization, getState, reportsVisibleToModerator,
  resolveReport, directoryName,
} from '../store.js';
import { ICONS } from '../components/icons.js';
import { organizationDisplayName } from '../models.js';

function miniBar(fraction) {
  return `
    <div style="background:var(--surface-elevated); border-radius:6px; height:6px; overflow:hidden; width:100%;">
      <div style="background:var(--accent); height:100%; width:${Math.round(fraction * 100)}%;"></div>
    </div>`;
}

function rosterRow(member) {
  const fraction = overallCompletionForUser(member.id);
  const initials = member.fullName.split(' ').map((s) => s[0]).join('').toUpperCase();
  return `
    <button class="card card-tappable row gap-md" data-athlete-id="${member.id}" style="margin-bottom:8px;">
      <div class="avatar ${avatarColorClass(member.id)}" style="width:44px;height:44px;font-size:15px;flex-shrink:0;">${initials}</div>
      <div class="stack gap-xs" style="flex:1;">
        <div class="body-text" style="font-weight:600;">${member.fullName}</div>
        ${miniBar(fraction)}
      </div>
      <div class="caption" style="flex-shrink:0;">${Math.round(fraction * 100)}%</div>
    </button>`;
}

function workoutManageRow(workout) {
  const assignedLabel = workout.assignedTo === 'all' ? 'Whole team' : `${workout.assignedTo.length} athlete${workout.assignedTo.length === 1 ? '' : 's'}`;
  return `
    <div class="card row gap-md" style="margin-bottom:8px;">
      <div class="stack gap-xs" style="flex:1;">
        <div class="body-text" style="font-weight:600;">${workout.title}</div>
        <div class="caption">${workout.dayLabel} · ${formatDate(workout.date, { month: 'short', day: 'numeric' })} · Assigned: ${assignedLabel}</div>
      </div>
      <button class="icon-btn icon-btn-sm danger" data-delete-id="${workout.id}">${ICONS.trash}</button>
    </div>`;
}

function reportRow(report) {
  const reasonLabel = { message: 'Message', clip: 'Clip', comment: 'Comment', user: 'Account' }[report.targetType] || 'Content';
  return `
    <div class="card stack gap-sm" data-report-id="${report.id}">
      <div class="row-between">
        <div class="caption" style="font-weight:700; color:var(--text-primary);">${reasonLabel} reported</div>
        <div class="caption">${formatDate(report.createdAt, { month: 'short', day: 'numeric' })}</div>
      </div>
      <div class="body-text">${report.reason}</div>
      ${report.note ? `<div class="caption">"${report.note}"</div>` : ''}
      <div class="caption">Reported by ${directoryName(report.reporterId)} · About ${directoryName(report.targetOwnerId)}</div>
      <button class="btn btn-secondary" data-resolve-report="${report.id}">Mark Resolved</button>
    </div>`;
}

export function renderTeam(container, { onNewWorkout, onOpenAthlete }) {
  function draw() {
    const roster = rosterMembers();
    const workouts = workoutsForCurrentUser().sort((a, b) => new Date(b.date) - new Date(a.date));
    const myOrgs = adminOrganizations();
    const activeOrgId = getState().currentOrganization?.id;
    const reports = reportsVisibleToModerator();

    const node = h(`
      <div class="screen stack gap-lg">
        <div class="row-between">
          <h1 class="h-hero">Team</h1>
          <button class="pill-action-btn primary" id="btn-new-workout">${ICONS.plus} New Workout</button>
        </div>

        ${reports.length ? `
          <div class="stack gap-sm">
            <div class="h-headline row gap-xs">${ICONS.shield} Reports Needing Review</div>
            ${reports.map(reportRow).join('')}
          </div>
        ` : ''}

        ${myOrgs.length > 1 ? `
          <div class="stack gap-sm">
            <div class="caption row gap-xs">${ICONS.usersSwitch} You manage ${myOrgs.length} teams — switch below</div>
            <div class="row-wrap gap-sm">
              ${myOrgs.map((org) => `
                <button class="pill-action-btn ${org.id === activeOrgId ? 'primary' : ''}" data-switch-org="${org.id}">${organizationDisplayName(org)}</button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="stack gap-sm">
          <div class="h-headline">Athlete Progress</div>
          ${roster.length ? roster.map(rosterRow).join('') : `<div class="card">${emptyState({ icon: ICONS.people, title: 'No athletes yet', subtitle: "This team's roster is empty so far." })}</div>`}
        </div>

        <div class="stack gap-sm">
          <div class="h-headline">Manage Workouts</div>
          ${workouts.length ? workouts.map(workoutManageRow).join('') : `<div class="card">${emptyState({ icon: ICONS.clipboard, title: 'No workouts posted', subtitle: 'Tap "New Workout" above to post the first one.' })}</div>`}
        </div>
      </div>
    `);

    node.querySelector('#btn-new-workout').addEventListener('click', onNewWorkout);

    node.querySelectorAll('[data-resolve-report]').forEach((btn) => {
      btn.addEventListener('click', () => {
        resolveReport(btn.dataset.resolveReport);
        showToast('Report marked resolved');
        draw();
      });
    });

    node.querySelectorAll('[data-switch-org]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchOrganization(btn.dataset.switchOrg);
        draw();
      });
    });

    node.querySelectorAll('[data-athlete-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const member = roster.find((m) => m.id === btn.dataset.athleteId);
        onOpenAthlete(member);
      });
    });

    node.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this workout for everyone it was assigned to?')) {
          deleteWorkout(btn.dataset.deleteId);
          showToast('Workout deleted');
          draw();
        }
      });
    });

    mount(container, node);
  }

  draw();
}
