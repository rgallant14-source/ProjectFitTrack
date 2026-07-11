import { h, mount, showToast, avatarColorClass } from '../components/dom.js';
import {
  getState, isAdmin, rosterMembers, clipFeedEntries, setClipsFilterAthlete,
  clipCommentsForClip, addClipComment, addClip, toggleClipLike, toggleClipReaction,
} from '../store.js';
import { detectClipPlatform, youtubeVideoId, uuid, makeClip } from '../models.js';
import { PLATFORM_LABEL, ICONS } from '../components/icons.js';

const QUICK_EMOJIS = ['👍', '🔥', '👏', '💪', '😮'];

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function clipPost(entry, { showAthleteName }) {
  const { athleteId, athleteName, clip } = entry;
  const ytId = clip.platform === 'youtube' ? youtubeVideoId(clip.url) : null;
  const comments = clipCommentsForClip(clip.id);
  const initials = athleteName.split(' ').map((s) => s[0]).join('').toUpperCase();
  const currentUserId = getState().currentUser?.id;
  const likes = clip.likes ?? [];
  const reactions = clip.reactions ?? {};
  const iLiked = likes.includes(currentUserId);

  const reactionChips = QUICK_EMOJIS.map((emoji) => {
    const users = reactions[emoji] ?? [];
    const mine = users.includes(currentUserId);
    return `
      <button class="pill-action-btn" data-reaction="${emoji}" data-clip-owner="${athleteId}" data-reaction-clip="${clip.id}"
        style="background:${mine ? 'var(--gradient-primary-soft)' : 'var(--surface-elevated)'}; border:${mine ? '1px solid rgba(139,92,246,0.4)' : 'none'};">
        <span>${emoji}</span>${users.length ? `<span class="caption" style="color:var(--text-primary);">${users.length}</span>` : ''}
      </button>`;
  }).join('');

  return `
    <div class="card stack gap-md" data-clip-post="${clip.id}" data-athlete-id="${athleteId}">
      ${showAthleteName ? `
        <div class="row gap-sm">
          <div class="avatar ${avatarColorClass(athleteId)}" style="width:32px; height:32px; font-size:12px;">${initials}</div>
          <div class="stack gap-xs">
            <div class="caption" style="color:var(--text-primary); font-weight:700;">${athleteName}</div>
            <div class="caption">${timeAgo(clip.addedAt)}</div>
          </div>
        </div>` : `<div class="caption">${timeAgo(clip.addedAt)}</div>`}

      <div class="clip-thumb" style="border-radius:var(--radius-control);">
        <span class="clip-platform-badge">${PLATFORM_LABEL[clip.platform] || 'Clip'}</span>
        ${ytId
          ? `<iframe src="https://www.youtube.com/embed/${ytId}" title="${clip.title}" allowfullscreen loading="lazy"></iframe>`
          : `<a href="${clip.url}" target="_blank" rel="noopener" class="clip-play-icon" style="text-decoration:none;">▶</a>`}
      </div>
      <div class="body-text" style="font-weight:600;">${clip.title || 'Untitled clip'}</div>

      <div class="row gap-sm" style="align-items:center;">
        <button class="pill-action-btn ${iLiked ? 'primary' : ''}" data-like-clip="${clip.id}" data-like-owner="${athleteId}">
          ${iLiked ? ICONS.heart : ICONS.heartOutline}
          <span>${likes.length || ''} Like${likes.length === 1 ? '' : 's'}</span>
        </button>
      </div>

      <div class="row-wrap gap-xs">${reactionChips}</div>

      <div class="stack gap-sm" style="border-top:1px solid var(--divider); padding-top:12px;">
        <div class="caption" style="font-weight:700; color:var(--text-primary);">${comments.length ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Critique this clip'}</div>
        ${comments.map((c) => `
          <div class="row gap-sm" style="align-items:flex-start;">
            <div class="avatar ${avatarColorClass(c.authorId)}" style="width:26px;height:26px;font-size:10px;flex-shrink:0;">${c.authorName.split(' ').map((s) => s[0]).join('').toUpperCase()}</div>
            <div class="stack gap-xs">
              <div class="caption"><span style="color:var(--text-primary); font-weight:700;">${c.authorName}</span> ${c.authorRole === 'admin' ? '· Coach' : ''} · ${timeAgo(c.createdAt)}</div>
              <div class="body-text">${c.text}</div>
            </div>
          </div>
        `).join('')}
        <div class="row gap-sm">
          <input type="text" placeholder="Add a comment or emoji..." data-comment-input style="flex:1; background:var(--surface-elevated); border:none; border-radius:var(--radius-pill); padding:10px 14px; color:var(--text-primary); font-size:14px; outline:none;" />
          <button class="icon-btn icon-btn-sm primary" data-comment-submit>${ICONS.send}</button>
        </div>
      </div>
    </div>`;
}

export function renderClips(container) {
  const admin = isAdmin();

  function draw() {
    const entries = clipFeedEntries();
    const roster = rosterMembers();
    const filterId = getState().clipsFilterAthleteId;

    const node = h(`
      <div class="screen stack gap-lg">
        <div class="row-between">
          <h1 class="h-hero">Clips</h1>
          ${!admin ? `<button class="pill-action-btn primary" id="btn-add-clip">${ICONS.plus} Add</button>` : ''}
        </div>

        ${admin ? `
          <div class="row-wrap gap-sm" id="athlete-filter">
            <button class="pill-action-btn ${!filterId ? 'primary' : ''}" data-athlete-filter="">All Athletes</button>
            ${roster.map((m) => `
              <button class="pill-action-btn ${filterId === m.id ? 'primary' : ''}" data-athlete-filter="${m.id}">${m.fullName.split(' ')[0]}</button>
            `).join('')}
          </div>
        ` : ''}

        ${entries.length
          ? entries.map((entry) => clipPost(entry, { showAthleteName: admin })).join('')
          : `<div class="card subheadline">${admin ? 'No clips posted by your athletes yet.' : 'No clips yet — add a YouTube skill video or a Veo/Trace game clip to get feedback from your coach.'}</div>`}
      </div>
    `);

    node.querySelector('#btn-add-clip')?.addEventListener('click', () => openAddClipSheet(draw));

    node.querySelectorAll('[data-athlete-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setClipsFilterAthlete(btn.dataset.athleteFilter || null);
        draw();
      });
    });

    node.querySelectorAll('[data-like-clip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleClipLike(btn.dataset.likeOwner, btn.dataset.likeClip);
        draw();
      });
    });

    node.querySelectorAll('[data-reaction]').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleClipReaction(btn.dataset.clipOwner, btn.dataset.reactionClip, btn.dataset.reaction);
        draw();
      });
    });

    node.querySelectorAll('[data-clip-post]').forEach((postEl) => {
      const clipId = postEl.dataset.clipPost;
      const input = postEl.querySelector('[data-comment-input]');
      const submit = postEl.querySelector('[data-comment-submit]');
      const submitComment = () => {
        if (!input.value.trim()) return;
        addClipComment(clipId, input.value);
        draw();
      };
      submit.addEventListener('click', submitComment);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitComment(); });
    });

    mount(container, node);
  }

  draw();
}

function openAddClipSheet(onDone) {
  const user = getState().currentUser;
  const backdrop = h(`
    <div class="sheet-backdrop" id="backdrop">
      <div class="sheet stack gap-md">
        <div class="sheet-grabber"></div>
        <div class="sheet-header">
          <h2 class="h-title">Add Clip</h2>
          <button class="icon-btn" id="btn-close">${ICONS.close}</button>
        </div>
        <div class="caption">Paste a link from YouTube, Veo, Trace, or Hudl.</div>
        <div class="field">
          <label for="clip-url">Clip link</label>
          <input id="clip-url" type="url" placeholder="https://..." />
        </div>
        <div class="field">
          <label for="clip-title">Title (optional)</label>
          <input id="clip-title" type="text" placeholder="e.g. Game-winning goal vs. Central" />
        </div>
        <button class="btn btn-primary" id="btn-save">Add Clip</button>
      </div>
    </div>
  `);
  backdrop.querySelector('#backdrop').addEventListener('click', (e) => { if (e.target.id === 'backdrop') backdrop.remove(); });
  backdrop.querySelector('#btn-close').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#btn-save').addEventListener('click', () => {
    const url = backdrop.querySelector('#clip-url').value.trim();
    const title = backdrop.querySelector('#clip-title').value.trim();
    if (!url) return;
    addClip(user.id, makeClip({ id: uuid(), url, platform: detectClipPlatform(url), title }));
    backdrop.remove();
    showToast('Clip added');
    onDone();
  });
  document.body.appendChild(backdrop);
}
