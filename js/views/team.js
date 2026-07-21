import { h, mount, showToast, formatDate, avatarColorClass, emptyState } from '../components/dom.js';
import {
  rosterMembers, overallCompletionForUser, workoutsForCurrentUser, deleteWorkout,
  adminOrganizations, switchOrganization, getState, reportsVisibleToModerator,
  resolveReport, directoryName, isAdminVerified,
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
        <div class="row gap-xs" style="align-items:center;">
          <div class="body-text" style="font-weight:600;">${workout.title}</div>
          ${!workout.createdByVerified ? '<span class="caption" style="color:var(--warning); font-weight:700;">Pending Verification</span>' : ''}
        </div>
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

export function renderTeam(container, { onNewWorkout, onOpenAthlete, onGenerateInvite, onBulkUpload, onCreateTeam, onVerificationIntake }) {
  function draw() {
    const roster = rosterMembers();
    const workouts = workoutsForCurrentUser().sort((a, b) => new Date(b.date) - new Date(a.date));
    const myOrgs = adminOrganizations();
    const activeOrgId = getState().currentOrganization?.id;
    const reports = reportsVisibleToModerator();
    const hasNoTeams = myOrgs.length === 0;
    const verified = isAdminVerified();

    const node = h(`
      <div class="screen stack gap-lg">
        <div class="row-between">
          <h1 class="h-hero">Team</h1>
          <button class="pill-action-btn primary" id="btn-new-workout" ${hasNoTeams ? 'disabled' : ''}>${ICONS.plus} New Workout</button>
        </div>

        ${!verified ? `
          <div class="card stack gap-sm" style="border:1px solid var(--warning);">
            <div class="caption row gap-xs" style="font-weight:700; color:var(--text-primary);">${ICONS.shield} Account Pending Verification</div>
            <div class="caption">You can still set up your team and post workouts, but messaging athletes and parents is unavailable until you're verified.</div>
            <button class="btn btn-secondary" id="btn-verify-banner">Verify Your Account</button>
          </div>
        ` : ''}

        ${hasNoTeams ? `
          <div class="card stack gap-sm" style="border:1px solid rgba(139,92,246,0.4);">
            <div class="h-headline">Create Your First Team</div>
            <div class="caption">You don't manage any teams yet — create one to start posting workouts and inviting athletes.</div>
            <button class="btn btn-primary" id="btn-create-team-empty">Create a Team</button>
          </div>
        ` : ''}

        <button class="card card-tappable row gap-md" id="btn-create-team">
          <span class="card-icon">${ICONS.plus}</span>
          <div class="stack gap-xs" style="flex:1;">
            <div class="h-headline">Create a Team</div>
            <div class="caption">Set up a new club or squad and get a join code to share</div>
          </div>
        </button>

        <button class="card card-tappable row gap-md" id="btn-invite-athlete" ${hasNoTeams ? 'disabled' : ''}>
          <span class="card-icon">${ICONS.familyLink}</span>
          <div class="stack gap-xs" style="flex:1;">
            <div class="h-headline">Invite an Athlete to a Team</div>
            <div class="caption">One-time code for an existing athlete to add one of your teams</div>
          </div>
        </button>

        <button class="card card-tappable row gap-md" id="btn-bulk-upload" ${hasNoTeams ? 'disabled' : ''}>
          <span class="card-icon">${ICONS.download}</span>
          <div class="stack gap-xs" style="flex:1;">
            <div class="h-headline">Bulk Upload Workouts</div>
            <div class="caption">Download a template, fill it in, and upload many workouts at once</div>
          </div>
        </button>

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

        ${!hasNoTeams ? `
          <div class="stack gap-sm">
            <div class="h-headline">Athlete Progress</div>
            ${roster.length ? roster.map(rosterRow).join('') : `<div class="card">${emptyState({ icon: ICONS.people, title: 'No athletes yet', subtitle: "This team's roster is empty so far." })}</div>`}
          </div>

          <div class="stack gap-sm">
            <div class="h-headline">Manage Workouts</div>
            ${workouts.length ? workouts.map(workoutManageRow).join('') : `<div class="card">${emptyState({ icon: ICONS.clipboard, title: 'No workouts posted', subtitle: 'Tap "New Workout" above to post the first one.' })}</div>`}
          </div>
        ` : ''}
      </div>
    `);

    node.querySelector('#btn-new-workout').addEventListener('click', onNewWorkout);
    node.querySelector('#btn-invite-athlete').addEventListener('click', onGenerateInvite);
    node.querySelector('#btn-bulk-upload').addEventListener('click', onBulkUpload);
    node.querySelector('#btn-create-team').addEventListener('click', onCreateTeam);
    node.querySelector('#btn-create-team-empty')?.addEventListener('click', onCreateTeam);
    node.querySelector('#btn-verify-banner')?.addEventListener('click', onVerificationIntake);

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
