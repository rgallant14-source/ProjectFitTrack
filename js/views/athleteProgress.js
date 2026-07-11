import { h, mount, emptyState } from '../components/dom.js';
import { logsForUser, workoutsForCurrentUser, clipsForUser, setClipsFilterAthlete, navigate } from '../store.js';
import { ICONS } from '../components/icons.js';

export function renderAthleteProgress(container, member, { onClose }) {
  const logs = logsForUser(member.id);
  const workouts = workoutsForCurrentUser();
  const clipCount = clipsForUser(member.id).length;

  function exerciseName(log) {
    if (log.exerciseName) return log.exerciseName;
    const workout = workouts.find((w) => w.id === log.workoutId);
    return workout?.exercises.find((e) => e.id === log.exerciseId)?.name ?? 'Exercise';
  }

  const sorted = [...logs].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const node = h(`
    <div class="screen stack gap-lg">
      <div class="screen-header">
        <button class="icon-btn" id="btn-close">${ICONS.close}</button>
        <span></span>
      </div>
      <div class="stack gap-xs">
        <h1 class="h-title">${member.fullName}</h1>
        <div class="caption">${logs.length} logged result${logs.length === 1 ? '' : 's'}</div>
      </div>

      <button class="card card-tappable row gap-md" id="btn-view-clips">
        <span class="card-icon" style="color:var(--hue-pink-1);">${ICONS.film}</span>
        <div class="stack gap-xs" style="flex:1;">
          <div class="h-headline">View Clips &amp; Highlights</div>
          <div class="caption">${clipCount} clip${clipCount === 1 ? '' : 's'} posted</div>
        </div>
        <svg class="chevron" width="18" height="18" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>

      ${sorted.length ? sorted.map((log) => `
        <div class="card stack gap-xs">
          <div class="row-between">
            <div class="body-text" style="font-weight:600;">${exerciseName(log)}</div>
            <div class="caption">${new Date(log.completedAt).toLocaleDateString()}</div>
          </div>
          <div class="caption">
            ${log.weightUsed != null ? `Weight: ${log.weightUsed} lbs &nbsp;·&nbsp; ` : ''}
            ${log.rpe != null ? `RPE: ${log.rpe} &nbsp;·&nbsp; ` : ''}
            ${log.timeOrRecord ? `Record: ${log.timeOrRecord}` : ''}
          </div>
          ${log.notes ? `<div class="body-text">${log.notes}</div>` : ''}
        </div>
      `).join('') : `<div class="card">${emptyState({ icon: ICONS.clipboard, title: 'No results yet', subtitle: `${member.fullName.split(' ')[0]} hasn't logged anything yet.` })}</div>`}
    </div>
  `);

  node.querySelector('#btn-close').addEventListener('click', onClose);
  node.querySelector('#btn-view-clips').addEventListener('click', () => {
    setClipsFilterAthlete(member.id);
    onClose();
    navigate('clips');
  });
  mount(container, node);
}
