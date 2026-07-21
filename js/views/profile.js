import { h, mount, showToast, avatarColorClass, emptyState } from '../components/dom.js';
import {
  getState, logOut, setNotificationsEnabled, isAdmin, isParent, logsForUser, clipsForUser,
  workoutsForCurrentUser, navigate, currentStreakForUser, linkedAthleteForCurrentParent,
  unlinkParent, parentLinksForAthlete, setShareMessagesWithParent, blockedUserIds,
  unblockUser, directoryName, organizationsForCurrentUser,
} from '../store.js';
import { requestNotificationPermission } from '../notifications.js';
import { ICONS } from '../components/icons.js';
import { organizationDisplayName } from '../models.js';

const ROLE_LABEL = { admin: 'Coach / Club Admin', parent: 'Parent / Guardian', athlete: 'Athlete' };

function socialIcon(platform, url) {
  const has = !!url;
  const href = has ? (url.startsWith('http') ? url : `https://${url}`) : '#';
  return `<a class="social-icon ${has ? '' : 'empty'}" href="${has ? href : '#'}" target="${has ? '_blank' : ''}" rel="noopener" data-empty="${!has}" data-platform="${platform}">${ICONS[platform]}</a>`;
}

export function renderProfile(container, { onJoinOrg, onEditProfile, onViewHistory, onAddTeam, onGenerateInvite }) {
  function draw() {
    const state = getState();
    const user = state.currentUser;
    const admin = isAdmin();
    const parent = isParent();
    const athlete = !admin && !parent;
    const initials = user.fullName.split(' ').map((s) => s[0]).join('').toUpperCase();

    const myLogs = athlete ? logsForUser(user.id) : [];
    const myWorkouts = athlete ? workoutsForCurrentUser() : [];
    const completedWorkouts = myWorkouts.filter((w) => new Date(w.date) <= new Date() && w.exercises.every((ex) => myLogs.some((l) => l.exerciseId === ex.id))).length;
    const clips = athlete ? clipsForUser(user.id) : [];
    const streak = athlete ? currentStreakForUser(user.id) : 0;
    const social = user.socialLinks || {};

    const linkedAthlete = parent ? linkedAthleteForCurrentParent() : null;
    const myParentLinks = athlete ? parentLinksForAthlete(user.id) : [];
    const myBlocked = blockedUserIds(user.id);
    const myTeams = athlete ? organizationsForCurrentUser() : [];

    const node = h(`
      <div class="screen stack gap-lg">
        <div class="row-between">
          <h1 class="h-hero">Profile</h1>
          <button class="btn btn-secondary btn-pill-sm" id="btn-edit">Edit</button>
        </div>

        <div class="profile-hero">
          <div class="avatar-ring">
            <div class="avatar-inner">
              ${user.avatarDataUrl
                ? `<img src="${user.avatarDataUrl}" alt="Profile photo" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />`
                : `<div class="avatar" style="width:100%; height:100%;">${initials}</div>`}
            </div>
          </div>
          <div class="stack gap-xs" style="align-items:center;">
            <div class="h-title" style="color:#fff;">${user.fullName}</div>
            <div class="caption" style="color:rgba(255,255,255,0.85);">${ROLE_LABEL[user.role]}${athlete && myTeams.length ? ' · ' + (myTeams.length === 1 ? organizationDisplayName(myTeams[0]) : `${myTeams.length} teams`) : (admin && state.currentOrganization ? ' · ' + organizationDisplayName(state.currentOrganization) : '')}</div>
            ${user.bio ? `<div class="body-text center" style="max-width:320px; color:rgba(255,255,255,0.95);">${user.bio}</div>` : ''}
          </div>
          ${athlete && streak > 0 ? `<span class="streak-badge" style="background:rgba(255,255,255,0.2); backdrop-filter:blur(4px); box-shadow:none;">${ICONS.fire} ${streak} day streak</span>` : ''}
        </div>

        ${athlete ? `
          <div class="bento-grid">
            <div class="bento-card blue">
              <span class="bento-icon">${ICONS.clipboard}</span>
              <div><div class="bento-value">${myLogs.length}</div><div class="bento-label">Logged Results</div></div>
            </div>
            <div class="bento-card green">
              <span class="bento-icon">${ICONS.checkCircle}</span>
              <div><div class="bento-value">${completedWorkouts}</div><div class="bento-label">Workouts Done</div></div>
            </div>
            <button class="bento-card wide pink card-tappable" id="btn-view-clips" style="border:none; cursor:pointer; text-align:left; align-items:flex-start;">
              <span class="bento-icon">${ICONS.film}</span>
              <div><div class="bento-value">${clips.length}</div><div class="bento-label">Clips &amp; highlights — tap to view</div></div>
            </button>
          </div>

          <button class="card card-tappable row gap-md" id="btn-view-history">
            <span class="card-icon" style="color:var(--hue-blue-1);">${ICONS.trendingUp}</span>
            <div class="stack gap-xs" style="flex:1;">
              <div class="h-headline">Progress History</div>
              <div class="caption">See how each movement has changed over time</div>
            </div>
            <svg class="chevron" width="18" height="18" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>

          <div class="stack gap-sm">
            <div class="h-headline">Socials</div>
            <div class="social-icon-row">
              ${socialIcon('instagram', social.instagram)}
              ${socialIcon('tiktok', social.tiktok)}
              ${socialIcon('x', social.x)}
              ${socialIcon('youtube', social.youtube)}
            </div>
          </div>

          ${myParentLinks.length ? `
            <div class="stack gap-sm">
              <div class="h-headline">Parents &amp; Guardians</div>
              ${myParentLinks.map((link) => `
                <label class="card row-between" style="cursor:pointer;" data-family-link="${link.id}">
                  <div class="stack gap-xs">
                    <div class="body-text" style="font-weight:600;">${directoryName(link.parentId)}</div>
                    <div class="caption">Share my message activity with them</div>
                  </div>
                  <input type="checkbox" data-share-toggle="${link.id}" ${link.shareMessages ? 'checked' : ''} />
                </label>
              `).join('')}
            </div>
          ` : ''}
        ` : ''}

        ${parent ? `
          <div class="stack gap-sm">
            <div class="h-headline">Family</div>
            ${linkedAthlete ? `
              <div class="card row gap-md">
                <div class="avatar ${avatarColorClass(linkedAthlete.id)}" style="width:44px;height:44px;font-size:15px;flex-shrink:0;">${linkedAthlete.fullName.split(' ').map((s) => s[0]).join('').toUpperCase()}</div>
                <div class="stack gap-xs" style="flex:1;">
                  <div class="body-text" style="font-weight:600;">${linkedAthlete.fullName}</div>
                  <div class="caption">${state.currentOrganization ? organizationDisplayName(state.currentOrganization) : ''}</div>
                </div>
                <button class="btn btn-secondary btn-pill-sm" id="btn-unlink">Unlink</button>
              </div>
            ` : `<button class="card card-tappable" id="btn-join-org" style="color:var(--accent-2); font-weight:600;">+ Link Your Athlete</button>`}
            <button class="card card-tappable row gap-md" id="btn-generate-invite">
              <span class="card-icon">${ICONS.familyLink}</span>
              <div class="stack gap-xs" style="flex:1;">
                <div class="h-headline">Invite to Another Team</div>
                <div class="caption">Turn a team's join code into a one-time code for your athlete</div>
              </div>
            </button>
          </div>
        ` : athlete ? `
          <div class="stack gap-sm">
            <div class="h-headline">Teams</div>
            ${myTeams.map((org) => `
              <div class="card stack gap-xs">
                <div class="body-text" style="font-weight:600;">${organizationDisplayName(org)}</div>
                <div class="caption">${org.sport}</div>
              </div>
            `).join('')}
            <button class="card card-tappable" id="btn-add-team" style="color:var(--accent-2); font-weight:600;">+ Add Another Team</button>
          </div>
        ` : `
          <div class="stack gap-sm">
            <div class="h-headline">Organization</div>
            ${state.currentOrganization
              ? `<div class="card stack gap-xs">
                   <div class="body-text" style="font-weight:600;">${organizationDisplayName(state.currentOrganization)}</div>
                   <div class="caption">${state.currentOrganization.sport}</div>
                 </div>`
              : `<button class="card card-tappable" id="btn-join-org" style="color:var(--accent-2); font-weight:600;">+ Join a Team</button>`
            }
          </div>
        `}

        <div class="stack gap-sm">
          <div class="h-headline">Blocked Accounts</div>
          ${myBlocked.length
            ? myBlocked.map((id) => `
                <div class="card row-between" data-blocked-row="${id}">
                  <div class="body-text" style="font-weight:600;">${directoryName(id)}</div>
                  <button class="btn btn-secondary btn-pill-sm" data-unblock="${id}">Unblock</button>
                </div>
              `).join('')
            : `<div class="card">${emptyState({ icon: ICONS.ban, title: 'No one blocked', subtitle: "You can block anyone from a message thread or a clip's report menu." })}</div>`}
        </div>

        ${!parent ? `
          <div class="stack gap-sm">
            <div class="h-headline">Notifications</div>
            <label class="card row-between" style="cursor:pointer;">
              <span class="body-text">Workout reminders</span>
              <input id="notif-toggle" type="checkbox" ${state.notificationsEnabled ? 'checked' : ''} />
            </label>
          </div>
        ` : ''}

        <button class="btn btn-danger" id="btn-logout" style="margin-top:16px;">Log Out</button>
      </div>
    `);

    node.querySelector('#btn-edit').addEventListener('click', onEditProfile);
    node.querySelector('#btn-view-clips')?.addEventListener('click', () => navigate('clips'));
    node.querySelector('#btn-view-history')?.addEventListener('click', onViewHistory);
    node.querySelector('#btn-join-org')?.addEventListener('click', onJoinOrg);
    node.querySelector('#btn-add-team')?.addEventListener('click', onAddTeam);
    node.querySelector('#btn-generate-invite')?.addEventListener('click', onGenerateInvite);
    node.querySelector('#btn-unlink')?.addEventListener('click', () => {
      if (!confirm(`Unlink from ${linkedAthlete?.fullName}? You'll stop seeing their activity here.`)) return;
      unlinkParent();
      showToast('Unlinked');
      draw();
    });

    node.querySelectorAll('[data-share-toggle]').forEach((toggle) => {
      toggle.addEventListener('change', (e) => {
        setShareMessagesWithParent(toggle.dataset.shareToggle, e.target.checked);
        showToast(e.target.checked ? 'Sharing messages with this parent' : 'Message sharing turned off');
      });
    });

    node.querySelectorAll('[data-unblock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        unblockUser(btn.dataset.unblock);
        showToast('Unblocked');
        draw();
      });
    });

    node.querySelector('#notif-toggle')?.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const granted = await requestNotificationPermission();
        setNotificationsEnabled(granted);
        showToast(granted ? 'Reminders enabled' : 'Notifications permission was denied');
        e.target.checked = granted;
      } else {
        setNotificationsEnabled(false);
      }
    });

    node.querySelector('#btn-logout').addEventListener('click', logOut);

    mount(container, node);
  }

  draw();
}
