import { h, mount, showToast } from '../components/dom.js';
import { getState, logOut, setNotificationsEnabled, isAdmin, logsForUser, clipsForUser, workoutsForCurrentUser, navigate } from '../store.js';
import { requestNotificationPermission } from '../notifications.js';
import { ICONS } from '../components/icons.js';

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

  const social = user.socialLinks || {};

  const node = h(`
    <div class="screen stack gap-lg">
      <div class="row-between">
        <h1 class="h-hero">Profile</h1>
        <button class="btn btn-secondary btn-pill-sm" id="btn-edit">Edit</button>
      </div>

      <div class="stack gap-md center">
        <div class="avatar-ring" style="margin:0 auto;">
          <div class="avatar-inner">
            ${user.avatarDataUrl
              ? `<img src="${user.avatarDataUrl}" alt="Profile photo" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />`
              : `<div class="avatar" style="width:100%; height:100%;">${initials}</div>`}
          </div>
        </div>
        <div class="stack gap-xs" style="align-items:center;">
          <div class="h-title">${user.fullName}</div>
          <div class="caption">${admin ? 'Coach / Club Admin' : 'Athlete'}${state.currentOrganization ? ' · ' + state.currentOrganization.name : ''}</div>
          ${user.bio ? `<div class="body-text center" style="max-width:320px;">${user.bio}</div>` : ''}
        </div>
      </div>

      ${!admin ? `
        <div class="row gap-sm">
          <div class="stat-pill">
            <div class="stat-value gradient-text">${myLogs.length}</div>
            <div class="stat-label">Logged Results</div>
          </div>
          <div class="stat-pill">
            <div class="stat-value gradient-text">${completedWorkouts}</div>
            <div class="stat-label">Workouts Done</div>
          </div>
          <button class="stat-pill card-tappable" id="btn-view-clips" style="border:none; cursor:pointer;">
            <div class="stat-value gradient-text">${clips.length}</div>
            <div class="stat-label">Clips</div>
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
               <div class="body-text" style="font-weight:600;">${state.currentOrganization.name}</div>
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
