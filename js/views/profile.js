import { h, mount, showToast } from '../components/dom.js';
import { getState, logOut, setNotificationsEnabled, isAdmin, logsForUser, clipsForUser, workoutsForCurrentUser, navigate, currentStreakForUser } from '../store.js';
import { requestNotificationPermission } from '../notifications.js';
import { ICONS } from '../components/icons.js';
import { organizationDisplayName } from '../models.js';

function socialIcon(platform, url) {
  const has = !!url;
  const href = has ? (url.startsWith('http') ? url : `https://${url}`) : '#';
  return `<a class="social-icon ${has ? '' : 'empty'}" href="${has ? href : '#'}" target="${has ? '_blank' : ''}" rel="noopener" data-empty="${!has}" data-platform="${platform}">${ICONS[platform]}</a>`;
}

export function renderProfile(container, { onJoinOrg, onEditProfile }) {
  const state = getState();
  const user = state.currentUser;
  const admin = isAdmin();
  const initials = user.fullName.split(' ').map((s) => s[0]).join('').toUpperCase();

  // Simple stat rollups for the athlete stat row — social-app-style numbers
  // rather than a plain paragraph of text. Tapping "Clips" jumps to the
  // dedicated Clips tab, since that's where clips actually live now.
  const myLogs = logsForUser(user.id);
  const myWorkouts = workoutsForCurrentUser();
  const completedWorkouts = myWorkouts.filter((w) => new Date(w.date) <= new Date() && w.exercises.every((ex) => myLogs.some((l) => l.exerciseId === ex.id))).length;
  const clips = clipsForUser(user.id);
  const streak = currentStreakForUser(user.id);

  const social = user.socialLinks || {};

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
          <div class="caption" style="color:rgba(255,255,255,0.85);">${admin ? 'Coach / Club Admin' : 'Athlete'}${state.currentOrganization ? ' · ' + organizationDisplayName(state.currentOrganization) : ''}</div>
          ${user.bio ? `<div class="body-text center" style="max-width:320px; color:rgba(255,255,255,0.95);">${user.bio}</div>` : ''}
        </div>
        ${!admin && streak > 0 ? `<span class="streak-badge" style="background:rgba(255,255,255,0.2); backdrop-filter:blur(4px);">🔥 ${streak} day streak</span>` : ''}
      </div>

      ${!admin ? `
        <div class="bento-grid">
          <div class="bento-card blue">
            <span class="bento-icon">📝</span>
            <div><div class="bento-value">${myLogs.length}</div><div class="bento-label">Logged Results</div></div>
          </div>
          <div class="bento-card green">
            <span class="bento-icon">✅</span>
            <div><div class="bento-value">${completedWorkouts}</div><div class="bento-label">Workouts Done</div></div>
          </div>
          <button class="bento-card wide pink card-tappable" id="btn-view-clips" style="border:none; cursor:pointer; text-align:left; align-items:flex-start;">
            <span class="bento-icon">🎬</span>
            <div><div class="bento-value">${clips.length}</div><div class="bento-label">Clips &amp; highlights — tap to view</div></div>
          </button>
        </div>

        <div class="stack gap-sm">
          <div class="h-headline">Socials</div>
          <div class="social-icon-row">
            ${socialIcon('instagram', social.instagram)}
            ${socialIcon('tiktok', social.tiktok)}
            ${socialIcon('x', social.x)}
            ${socialIcon('youtube', social.youtube)}
          </div>
        </div>
      ` : ''}

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

      <div class="stack gap-sm">
        <div class="h-headline">Notifications</div>
        <label class="card row-between" style="cursor:pointer;">
          <span class="body-text">Workout reminders</span>
          <input id="notif-toggle" type="checkbox" ${state.notificationsEnabled ? 'checked' : ''} />
        </label>
      </div>

      <button class="btn btn-danger" id="btn-logout" style="margin-top:16px;">Log Out</button>
    </div>
  `);

  node.querySelector('#btn-edit').addEventListener('click', onEditProfile);
  node.querySelector('#btn-view-clips')?.addEventListener('click', () => navigate('clips'));
  node.querySelector('#btn-join-org')?.addEventListener('click', onJoinOrg);

  node.querySelector('#notif-toggle').addEventListener('change', async (e) => {
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
