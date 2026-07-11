import { h, mount, emptyState, avatarColorClass } from '../components/dom.js';
import {
  parentDashboardStats, pendingMessageRequestsForCurrentUser, acceptMessageRequest,
  declineMessageRequest, navigate,
} from '../store.js';
import { ICONS } from '../components/icons.js';

function initialsOf(name) {
  return name.split(' ').map((s) => s[0]).join('').toUpperCase();
}

// The parent role's Dashboard-tab equivalent: a read-only family summary
// instead of the athlete's own workout dashboard, plus anything needing
// the parent's attention (pending message requests).
export function renderParentHome(container) {
  function draw() {
    const stats = parentDashboardStats();
    const requests = pendingMessageRequestsForCurrentUser();

    const node = h(`
      <div class="screen stack gap-lg">
        <h1 class="h-hero">Family</h1>

        ${!stats ? `<div class="card">${emptyState({
            icon: ICONS.familyLink,
            title: 'No athlete linked yet',
            subtitle: 'Go to your Profile tab and link your athlete to see their activity here.',
          })}</div>` : `
          <div class="profile-hero" style="padding:24px;">
            <div class="avatar-ring" style="width:72px; height:72px;">
              <div class="avatar-inner"><div class="avatar ${avatarColorClass(stats.athlete.id)}" style="width:100%; height:100%;">${initialsOf(stats.athlete.fullName)}</div></div>
            </div>
            <div class="stack gap-xs" style="align-items:center;">
              <div class="h-title" style="color:#fff;">${stats.athlete.fullName}</div>
              ${stats.streak > 0 ? `<span class="streak-badge" style="background:rgba(255,255,255,0.2); backdrop-filter:blur(4px); box-shadow:none;">${ICONS.fire} ${stats.streak} day streak</span>` : ''}
            </div>
          </div>

          <div class="bento-grid">
            <div class="bento-card blue">
              <span class="bento-icon">${ICONS.clipboard}</span>
              <div><div class="bento-value">${stats.logsCount}</div><div class="bento-label">Logged Results</div></div>
            </div>
            <div class="bento-card green">
              <span class="bento-icon">${ICONS.checkCircle}</span>
              <div><div class="bento-value">${stats.completedCount}/${stats.totalPastWorkouts}</div><div class="bento-label">Workouts Done</div></div>
            </div>
            <button class="bento-card wide pink card-tappable" id="btn-view-clips" style="border:none; cursor:pointer; text-align:left; align-items:flex-start;">
              <span class="bento-icon">${ICONS.film}</span>
              <div><div class="bento-value">View</div><div class="bento-label">Clips &amp; highlights</div></div>
            </button>
          </div>

          <div class="stack gap-sm">
            <div class="h-headline">Recent Activity</div>
            ${stats.recentLogs.length ? stats.recentLogs.map((l) => `
              <div class="card row-between">
                <div class="stack gap-xs">
                  <div class="body-text" style="font-weight:600;">${l.exerciseName}</div>
                  <div class="caption">${new Date(l.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                </div>
                <div class="caption">${l.weightUsed ? l.weightUsed + ' lb' : (l.timeOrRecord || '')}</div>
              </div>
            `).join('') : `<div class="card">${emptyState({ icon: ICONS.clipboard, title: 'No logged results yet' })}</div>`}
          </div>
        `}

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
