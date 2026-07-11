import { h, mount, showToast } from '../components/dom.js';
import { getState, updateProfile, addClip, removeClip, clipsForUser } from '../store.js';
import { detectClipPlatform, uuid, makeClip } from '../models.js';
import { PLATFORM_LABEL, ICONS } from '../components/icons.js';

export function renderEditProfile(container, { onDone, onClose, initialTab = 'profile' }) {
  const user = getState().currentUser;
  const social = user.socialLinks || {};

  function clipRow(clip) {
    return `
      <div class="card row-between" data-clip-row="${clip.id}">
        <div class="stack gap-xs" style="min-width:0;">
          <div class="body-text" style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${clip.title || 'Untitled clip'}</div>
          <div class="caption">${PLATFORM_LABEL[clip.platform] || 'Clip'} · <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${clip.url}</span></div>
        </div>
        <button class="icon-btn icon-btn-sm danger" style="flex-shrink:0;" data-remove-clip="${clip.id}">${ICONS.trash}</button>
      </div>`;
  }

  function draw() {
    const clips = clipsForUser(user.id);

    const node = h(`
      <div class="sheet-backdrop" id="backdrop">
        <div class="sheet stack gap-lg">
          <div class="sheet-grabber"></div>
          <div class="sheet-header">
            <h2 class="h-title">Edit Profile</h2>
            <button class="icon-btn" id="btn-close">${ICONS.close}</button>
          </div>

          <div class="segmented" id="tab-picker">
            <button data-tab="profile" class="${initialTab === 'profile' ? 'active' : ''}">Profile</button>
            <button data-tab="clips" class="${initialTab === 'clips' ? 'active' : ''}">Clips</button>
          </div>

          <div id="tab-profile" style="display:${initialTab === 'profile' ? 'flex' : 'none'}; flex-direction:column; gap:16px;">
            <div class="stack gap-sm center">
              <div style="position:relative; width:88px; height:88px; margin:0 auto;">
                <div class="avatar-ring" style="width:100%; height:100%;">
                  <div class="avatar-inner">
                    ${user.avatarDataUrl
                      ? `<img src="${user.avatarDataUrl}" alt="Profile photo" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />`
                      : `<div class="avatar" style="width:100%; height:100%;">${user.fullName.split(' ').map((s) => s[0]).join('').toUpperCase()}</div>`}
                  </div>
                </div>
                <button class="icon-btn icon-btn-sm primary" id="btn-upload-photo" style="position:absolute; bottom:0; right:0;">${ICONS.camera}</button>
                <input type="file" id="photo-input" accept="image/*" style="display:none;" />
              </div>
              <div class="caption">Tap the camera to change your photo</div>
            </div>

            <div class="field">
              <label for="name">Name</label>
              <input id="name" type="text" value="${user.fullName}" />
            </div>
            <div class="field">
              <label for="bio">Bio</label>
              <textarea id="bio" rows="2" placeholder="Position, class year, anything you want coaches to know">${user.bio || ''}</textarea>
            </div>
            <div class="h-headline">Social Links</div>
            <div class="field">
              <label for="instagram">Instagram</label>
              <input id="instagram" type="text" placeholder="instagram.com/yourname" value="${social.instagram || ''}" />
            </div>
            <div class="field">
              <label for="tiktok">TikTok</label>
              <input id="tiktok" type="text" placeholder="tiktok.com/@yourname" value="${social.tiktok || ''}" />
            </div>
            <div class="field">
              <label for="x">X / Twitter</label>
              <input id="x" type="text" placeholder="x.com/yourname" value="${social.x || ''}" />
            </div>
            <div class="field">
              <label for="youtube">YouTube channel</label>
              <input id="youtube" type="text" placeholder="youtube.com/@yourchannel" value="${social.youtube || ''}" />
            </div>
            <button class="btn btn-primary" id="btn-save-profile">Save</button>
          </div>

          <div id="tab-clips" style="display:${initialTab === 'clips' ? 'flex' : 'none'}; flex-direction:column; gap:16px;">
            <div class="card stack gap-sm">
              <div class="caption">Paste a link from YouTube, Veo, Trace, or Hudl. YouTube clips play right in your profile; Veo/Trace/Hudl links open in their own viewer since those platforms don't support embedding elsewhere.</div>
              <div class="field">
                <label for="clip-url">Clip link</label>
                <input id="clip-url" type="url" placeholder="https://..." />
              </div>
              <div class="field">
                <label for="clip-title">Title (optional)</label>
                <input id="clip-title" type="text" placeholder="e.g. Game-winning goal vs. Central" />
              </div>
              <button class="btn btn-secondary" id="btn-add-clip">+ Add Clip</button>
            </div>

            <div class="stack gap-sm">
              ${clips.length ? clips.map(clipRow).join('') : `<div class="subheadline">No clips added yet.</div>`}
            </div>
          </div>
        </div>
      </div>
    `);

    node.querySelector('#backdrop').addEventListener('click', (e) => { if (e.target.id === 'backdrop') onClose(); });
    node.querySelector('#btn-close').addEventListener('click', onClose);

    node.querySelector('#btn-upload-photo').addEventListener('click', () => {
      node.querySelector('#photo-input').click();
    });
    node.querySelector('#photo-input').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await resizeImageToDataUrl(file, 320);
        updateProfile({ avatarDataUrl: dataUrl });
        showToast('Photo updated');
        draw();
      } catch {
        showToast("Couldn't load that image");
      }
    });

    node.querySelector('#tab-picker').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      [...node.querySelectorAll('#tab-picker button')].forEach((b) => b.classList.toggle('active', b === btn));
      node.querySelector('#tab-profile').style.display = btn.dataset.tab === 'profile' ? 'flex' : 'none';
      node.querySelector('#tab-clips').style.display = btn.dataset.tab === 'clips' ? 'flex' : 'none';
    });

    node.querySelector('#btn-save-profile').addEventListener('click', () => {
      updateProfile({
        fullName: node.querySelector('#name').value.trim() || user.fullName,
        bio: node.querySelector('#bio').value.trim(),
        socialLinks: {
          instagram: node.querySelector('#instagram').value.trim(),
          tiktok: node.querySelector('#tiktok').value.trim(),
          x: node.querySelector('#x').value.trim(),
          youtube: node.querySelector('#youtube').value.trim(),
        },
      });
      showToast('Profile updated');
      onDone();
    });

    node.querySelector('#btn-add-clip').addEventListener('click', () => {
      const url = node.querySelector('#clip-url').value.trim();
      const title = node.querySelector('#clip-title').value.trim();
      if (!url) return;
      const platform = detectClipPlatform(url);
      addClip(user.id, makeClip({ id: uuid(), url, platform, title }));
      showToast('Clip added');
      draw(); // redraw list within the same sheet
    });

    node.querySelectorAll('[data-remove-clip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        removeClip(user.id, btn.dataset.removeClip);
        draw();
      });
    });

    mount(container, node);
  }

  draw();
}

// Resizes/compresses an uploaded photo client-side before storing it as a
// data URL — keeps it well under localStorage's per-key size limits and
// avoids uploading a multi-megabyte phone photo untouched.
function resizeImageToDataUrl(file, maxDimension) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
