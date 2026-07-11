import { h, mount, categoryTag, formatDate, emptyState } from '../components/dom.js';
import { getState, loggedExerciseNames, exerciseHistory } from '../store.js';
import { BLOCK_LOG_FIELDS } from '../models.js';
import { ICONS } from '../components/icons.js';

function entryRow(log, previousLog, fields) {
  let deltaHtml = '';
  if (previousLog && fields.includes('weight') && log.weightUsed != null && previousLog.weightUsed != null) {
    const diff = log.weightUsed - previousLog.weightUsed;
    if (diff !== 0) {
      deltaHtml = `<span class="caption" style="color:${diff > 0 ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} lbs</span>`;
    }
  }
  const valueLabel = fields.includes('weight')
    ? (log.weightUsed != null ? `${log.weightUsed} lbs` : '—')
    : (log.timeOrRecord || '—');
  return `
    <div class="row-between" style="padding:5px 0;">
      <div class="stack gap-xs">
        <span class="body-text" style="font-weight:600;">${valueLabel}${log.rpe != null ? ` <span class="caption">· RPE ${log.rpe}</span>` : ''}</span>
        <span class="caption">${formatDate(log.completedAt, { month: 'short', day: 'numeric' })}</span>
      </div>
      ${deltaHtml}
    </div>`;
}

function movementCard(userId, name) {
  const history = exerciseHistory(userId, name);
  if (!history.length) return '';
  const latest = history[0];
  const fields = BLOCK_LOG_FIELDS[latest.block] ?? [];

  return `
    <div class="card stack gap-sm">
      <div class="row-between">
        <div class="stack gap-xs">
          <div class="h-headline">${name}</div>
          ${categoryTag(latest.block)}
        </div>
        <span class="caption">${history.length} logged</span>
      </div>
      <div class="stack" style="gap:0; border-top:1px solid var(--divider); padding-top:8px;">
        ${history.slice(0, 5).map((log, i) => entryRow(log, history[i + 1], fields)).join('')}
      </div>
    </div>`;
}

export function renderProgressHistory(container, { onClose }) {
  const userId = getState().currentUser.id;
  const names = loggedExerciseNames(userId);

  const node = h(`
    <div class="screen stack gap-lg">
      <div class="screen-header">
        <button class="icon-btn" id="btn-close">${ICONS.back}</button>
        <div class="h-headline screen-title">Progress History</div>
        <span style="width:40px;"></span>
      </div>

      ${names.length
        ? names.map((name) => movementCard(userId, name)).join('')
        : `<div class="card">${emptyState({ icon: ICONS.trendingUp, title: 'No history yet', subtitle: 'Log a result on any exercise and it will start showing up here so you can track progress over time.' })}</div>`}
    </div>
  `);

  node.querySelector('#btn-close').addEventListener('click', onClose);
  mount(container, node);
}
