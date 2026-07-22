import { h, mount, emptyState, avatarColorClass } from '../components/dom.js';
import {
  parentDashboardStatsList, pendingMessageRequestsForCurrentUser, acceptMessageRequest,
  declineMessageRequest, navigate,
} from '../store.js';
import { ICONS } from '../components/icons.js';

function initialsOf(name) {
  return name.split(' ').map((s) => s[0]).join('').toUpperCase();
}

function childCard(stats) {
  return `
    <div class="card stack gap-md">
      <div class="row gap-md" style="align-items:center;">
        <div class="avatar ${avatarColorClass(stats.athlete.id)}" style="width:48px;height:48px;font-size:16px;flex-shrink:0;">${initialsOf(stats.athlete.fullName)}</div>
        <div class="stack gap-xs" style="flex:1;">
          <div class="body-text" style="font-weight:700;">${stats.athlete.fullName}</div>
          ${stats.streak > 0 ? `<span class="streak-badge">${ICONS.fire} ${stats.streak} day streak</span>` : ''}
        </div>
      </div>
      <div class="row gap-sm">
        <div class="stack gap-xs" style="flex:1; text-align:center;">
          <div class="h-headline">${stats.logsCount}</div>
          <div class="caption">Logged Results</div>
        </div>
        <div class="stack gap-xs" style="flex:1; text-align:center;">
          <div class="h-headline">${stats.completedCount}/${stats.totalPastWorkouts}</div>
          <div class="caption">Workouts Done</div>
        </div>
      </div>
      ${stats.recentLogs.length ? `
        <div class="stack gap-xs" style="border-top:1px solid var(--divider); padding-top:10px;">
          <div class="caption" style="font-weight:700; color:var(--text-primary);">Most Recent</div>
          <div class="row-between">
            <div class="body-text">${stats.recentLogs[0].exerciseName}</div>
            <div class="caption">${stats.recentLogs[0].weightUsed ? stats.recentLogs[0].weightUsed + ' lb' : (stats.recentLogs[0].timeOrRecord || '')}</div>
          </div>
        </div>
      ` : ''}
    </div>`;
}

// The parent role's Dashboard-tab equivalent: a read-only family summary
// instead of the athlete's own workout dashboard — one card per linked
// child, since a parent can have more than one — plus anything needing
// the parent's attention (pending message requests across all children).
export function renderParentHome(container) {
  function draw() {
    const statsList = parentDashboardStatsList();
    const requests = pendingMessageRequestsForCurrentUser();

    const node = h(`
      <div class="screen stack gap-lg">
        <h1 class="h-hero">Family</h1>

        ${!statsList.length ? `<div class="card">${emptyState({
            icon: ICONS.familyLink,
            title: 'No athlete linked yet',
            subtitle: 'Go to your Profile tab and link your athlete to see their activity here.',
          })}</div>` : statsList.map(childCard).join('')}

        ${statsList.length ? `
          <button class="card card-tappable" id="btn-view-clips" style="color:var(--accent-2); font-weight:600; text-align:center;">View Clips &amp; Highlights</button>
          <button class="card card-tappable" id="btn-link-another" style="color:var(--accent-2); font-weight:600; text-align:center;">+ Link Another Athlete</button>
        ` : ''}

        ${requests.length ? `
          <div class="stack gap-sm">
            <div class="h-headline">Message Requests Needing Approval</div>
            ${requests.map((r) => `
              <div class="card stack gap-sm" data-request-id="${r.conversation.id}">
                <div class="row gap-md">
                  <div class="avatar ${avatarColorClass(r.otherId)}" style="width:36px;height:36px;font-size:13px;flex-shrink:0;">${initialsOf(r.otherName)}</div>
                  <div class="body-text" style="font-weight:600; flex:1;">${r.otherName}</div>
                </div>
                <div class="row gap-sm">
                  <button class="btn btn-secondary" style="flex:1;" data-decline-request="${r.conversation.id}">Decline</button>
                  <button class="btn btn-primary" style="flex:1;" data-accept-request="${r.conversation.id}">Accept</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `);

    node.querySelector('#btn-view-clips')?.addEventListener('click', () => navigate('clips'));
    node.querySelector('#btn-link-another')?.addEventListener('click', () => navigate('profile'));
    node.querySelectorAll('[data-accept-request]').forEach((btn) => {
      btn.addEventListener('click', () => { acceptMessageRequest(btn.dataset.acceptRequest); draw(); });
    });
    node.querySelectorAll('[data-decline-request]').forEach((btn) => {
      btn.addEventListener('click', () => { declineMessageRequest(btn.dataset.declineRequest); draw(); });
    });

    mount(container, node);
  }

  draw();
}
