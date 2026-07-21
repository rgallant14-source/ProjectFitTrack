import { h, mount, avatarColorClass, emptyState, escapeHtml, showToast } from '../components/dom.js';
import {
  getState, isParent, isAdmin, isAdminVerified, navigate, conversationsForCurrentUser, messagesForConversation, sendMessage,
  messageableContacts, getOrCreateConversation, requestableProspects, sendMessageRequest,
  pendingMessageRequestsForCurrentUser, acceptMessageRequest, declineMessageRequest,
  blockUser, conversationsForLinkedAthlete, linkedAthleteForCurrentParent,
} from '../store.js';
import { ICONS } from '../components/icons.js';
import { openActionMenu, openReportSheet } from '../components/moderation.js';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function initialsOf(name) {
  return name.split(' ').map((s) => s[0]).join('').toUpperCase();
}

export function renderMessages(container) {
  // Parents get a distinct, read-only experience: they never have their
  // own conversations, only (optionally) visibility into their linked
  // athlete's — and a shot at approving that athlete's message requests.
  if (isParent()) return renderParentMessages(container);

  // Unverified coach accounts can't message anyone at all — see
  // isAdminVerified in store.js for what "unverified" means today.
  if (isAdmin() && !isAdminVerified()) return renderUnverifiedAdminBlock(container);

  // 'list' | 'thread' | 'newMessage' | 'newRequest' — kept as local
  // view-state since it's purely navigational within this one tab.
  let mode = 'list';
  let activeConversationId = null;

  function draw() {
    if (mode === 'thread') drawThread();
    else if (mode === 'newMessage') drawNewMessage();
    else if (mode === 'newRequest') drawNewRequest();
    else drawList();
  }

  function drawList() {
    const entries = conversationsForCurrentUser();
    const requests = pendingMessageRequestsForCurrentUser();
    const prospects = requestableProspects();

    const node = h(`
      <div class="screen stack gap-lg">
        <div class="row-between">
          <h1 class="h-hero">Messages</h1>
          <button class="pill-action-btn primary" id="btn-new">${ICONS.plus} New</button>
        </div>

        ${requests.length ? `
          <div class="stack gap-sm">
            <div class="h-headline">Message Requests</div>
            ${requests.map((r) => `
              <div class="card stack gap-sm" data-request-id="${r.conversation.id}">
                <div class="row gap-md">
                  <div class="avatar ${avatarColorClass(r.otherId)}" style="width:40px;height:40px;font-size:14px;flex-shrink:0;">${initialsOf(r.otherName)}</div>
                  <div class="stack gap-xs" style="flex:1; min-width:0;">
                    <div class="body-text" style="font-weight:600;">${r.otherName}</div>
                    <div class="caption" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(r.firstMessage?.text ?? '')}</div>
                  </div>
                </div>
                <div class="row gap-sm">
                  <button class="btn btn-secondary" style="flex:1;" data-decline-request="${r.conversation.id}">Decline</button>
                  <button class="btn btn-primary" style="flex:1;" data-accept-request="${r.conversation.id}">Accept</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${entries.length ? entries.map((entry) => `
          <button class="card card-tappable row gap-md" data-conversation-id="${entry.conversation.id}" style="margin-bottom:8px;">
            <div class="avatar ${avatarColorClass(entry.otherId)}" style="width:44px;height:44px;font-size:15px;flex-shrink:0;">${initialsOf(entry.otherName)}</div>
            <div class="stack gap-xs" style="flex:1; min-width:0;">
              <div class="body-text" style="font-weight:600;">${entry.otherName}</div>
              <div class="caption" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${entry.lastMessage ? escapeHtml(entry.lastMessage.text) : 'Say hello!'}</div>
            </div>
            ${entry.lastMessage ? `<div class="caption" style="flex-shrink:0;">${timeAgo(entry.lastMessage.createdAt)}</div>` : ''}
          </button>
        `).join('') : (requests.length ? '' : `<div class="card">${emptyState({ icon: ICONS.mail, title: 'No messages yet', subtitle: 'Tap New to message a teammate or coach.' })}</div>`)}

        ${prospects.length ? `
          <button class="card card-tappable row gap-md" id="btn-new-request" style="border:1px dashed var(--divider);">
            <span class="card-icon">${ICONS.people}</span>
            <div class="stack gap-xs" style="flex:1;">
              <div class="body-text" style="font-weight:600;">Message an athlete outside your team</div>
              <div class="caption">Sends a request they (or a parent) have to accept first</div>
            </div>
          </button>
        ` : ''}
      </div>
    `);

    node.querySelector('#btn-new').addEventListener('click', () => { mode = 'newMessage'; draw(); });
    node.querySelector('#btn-new-request')?.addEventListener('click', () => { mode = 'newRequest'; draw(); });

    node.querySelectorAll('[data-conversation-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeConversationId = btn.dataset.conversationId;
        mode = 'thread';
        draw();
      });
    });

    node.querySelectorAll('[data-accept-request]').forEach((btn) => {
      btn.addEventListener('click', () => {
        acceptMessageRequest(btn.dataset.acceptRequest);
        showToast('Request accepted');
        draw();
      });
    });
    node.querySelectorAll('[data-decline-request]').forEach((btn) => {
      btn.addEventListener('click', () => {
        declineMessageRequest(btn.dataset.declineRequest);
        showToast('Request declined and sender blocked');
        draw();
      });
    });

    mount(container, node);
  }

  function drawNewMessage() {
    const contacts = messageableContacts();

    const node = h(`
      <div class="screen stack gap-lg">
        <div class="screen-header">
          <button class="icon-btn" id="btn-back">${ICONS.back}</button>
          <div class="h-headline screen-title">New Message</div>
          <span style="width:40px;"></span>
        </div>

        ${contacts.length ? contacts.map((c) => `
          <button class="card card-tappable row gap-md" data-contact-id="${c.id}" data-contact-name="${c.fullName}" style="margin-bottom:8px;">
            <div class="avatar ${avatarColorClass(c.id)}" style="width:40px;height:40px;font-size:14px;">${initialsOf(c.fullName)}</div>
            <div class="body-text" style="font-weight:600;">${c.fullName}</div>
          </button>
        `).join('') : `<div class="card">${emptyState({ icon: ICONS.people, title: 'No contacts yet', subtitle: 'Join a team to message your coach or teammates.' })}</div>`}
      </div>
    `);

    node.querySelector('#btn-back').addEventListener('click', () => { mode = 'list'; draw(); });
    node.querySelectorAll('[data-contact-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const conversation = getOrCreateConversation(btn.dataset.contactId, btn.dataset.contactName);
        activeConversationId = conversation.id;
        mode = 'thread';
        draw();
      });
    });

    mount(container, node);
  }

  // A coach/admin reaching out to an athlete outside every team they
  // manage — always starts as a request, never an open thread.
  function drawNewRequest() {
    const prospects = requestableProspects();
    let selected = null;

    const node = h(`
      <div class="screen stack gap-lg">
        <div class="screen-header">
          <button class="icon-btn" id="btn-back">${ICONS.back}</button>
          <div class="h-headline screen-title">Message a Prospect</div>
          <span style="width:40px;"></span>
        </div>
        <div class="caption">This isn't your athlete — they (or a parent, if they're a minor) will see this as a request and have to accept it before you can keep chatting.</div>

        <div class="stack gap-sm" id="prospect-list">
          ${prospects.map((c) => `
            <button class="card card-tappable row gap-md" data-contact-id="${c.id}" data-contact-name="${c.fullName}" style="margin-bottom:8px;">
              <div class="avatar ${avatarColorClass(c.id)}" style="width:40px;height:40px;font-size:14px;">${initialsOf(c.fullName)}</div>
              <div class="body-text" style="font-weight:600;">${c.fullName}</div>
            </button>
          `).join('')}
        </div>

        <div class="card stack gap-md" id="compose-request" style="display:none;">
          <div class="field">
            <label for="request-text">Your message</label>
            <textarea id="request-text" rows="3" placeholder="Introduce yourself and why you're reaching out"></textarea>
          </div>
          <button class="btn btn-primary" id="btn-send-request">Send Request</button>
        </div>
      </div>
    `);

    node.querySelector('#btn-back').addEventListener('click', () => { mode = 'list'; draw(); });
    node.querySelectorAll('[data-contact-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selected = { id: btn.dataset.contactId, name: btn.dataset.contactName };
        node.querySelectorAll('[data-contact-id]').forEach((b) => b.classList.toggle('active', b === btn));
        node.querySelector('#compose-request').style.display = 'flex';
      });
    });
    node.querySelector('#btn-send-request').addEventListener('click', () => {
      const text = node.querySelector('#request-text').value;
      if (!selected || !text.trim()) return;
      const conversation = sendMessageRequest(selected.id, selected.name, text);
      showToast('Request sent');
      mode = 'list';
      activeConversationId = conversation?.id ?? null;
      draw();
    });

    mount(container, node);
  }

  function drawThread() {
    const currentUserId = getState().currentUser.id;
    const entry = conversationsForCurrentUser().find((e) => e.conversation.id === activeConversationId);
    const otherId = entry?.otherId;
    const otherName = entry?.otherName ?? 'Conversation';
    const thread = messagesForConversation(activeConversationId);

    const node = h(`
      <div class="screen stack gap-md" style="height:calc(100vh - 200px); display:flex;">
        <div class="screen-header">
          <button class="icon-btn" id="btn-back">${ICONS.back}</button>
          <div class="h-headline screen-title">${otherName}</div>
          <button class="icon-btn" id="btn-menu">${ICONS.moreVertical}</button>
        </div>

        <div class="stack gap-sm" id="thread-scroll" style="flex:1; overflow-y:auto; padding:4px;">
          ${thread.length ? thread.map((m) => {
            const mine = m.senderId === currentUserId;
            return `
              <div style="display:flex; justify-content:${mine ? 'flex-end' : 'flex-start'};">
                <div style="max-width:75%; background:${mine ? 'var(--gradient-primary)' : 'var(--surface-elevated)'}; color:${mine ? '#fff' : 'var(--text-primary)'}; padding:10px 14px; border-radius:16px; ${mine ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'}">
                  <div class="body-text" style="color:inherit;">${escapeHtml(m.text)}</div>
                </div>
              </div>`;
          }).join('') : `<div class="caption center" style="margin-top:24px;">This is the start of your conversation with ${otherName}.</div>`}
        </div>

        <div class="row gap-sm">
          <input type="text" id="message-input" placeholder="Message..." style="flex:1; background:var(--surface-elevated); border:none; border-radius:var(--radius-pill); padding:12px 16px; color:var(--text-primary); font-size:15px; outline:none;" />
          <button class="icon-btn primary" id="btn-send">${ICONS.send}</button>
        </div>
      </div>
    `);

    node.querySelector('#btn-back').addEventListener('click', () => { mode = 'list'; draw(); });

    node.querySelector('#btn-menu').addEventListener('click', () => {
      openActionMenu([
        {
          label: `Block ${otherName}`,
          icon: ICONS.ban,
          danger: true,
          onSelect: () => {
            blockUser(otherId);
            showToast(`${otherName} is blocked`);
            mode = 'list';
            draw();
          },
        },
        {
          label: 'Report conversation',
          icon: ICONS.flag,
          onSelect: () => openReportSheet({
            targetType: 'message',
            targetOwnerId: otherId,
            targetId: activeConversationId,
            contentSnapshot: thread.map((m) => m.text).slice(-5).join(' | '),
          }),
        },
      ]);
    });

    const input = node.querySelector('#message-input');
    const send = () => {
      if (!input.value.trim()) return;
      sendMessage(activeConversationId, input.value);
      draw();
    };
    node.querySelector('#btn-send').addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

    mount(container, node);
    const scrollEl = node.querySelector('#thread-scroll');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    input.focus();
  }

  draw();
}

// Read-only view for a linked parent: their own pending-request approvals
// (for their athlete's incoming requests), plus — only if the athlete has
// turned message-sharing on — a read-only look at the athlete's threads.
function renderParentMessages(container) {
  let mode = 'list';
  let activeConversationId = null;

  function draw() {
    if (mode === 'thread') drawThread();
    else drawList();
  }

  function drawList() {
    const athlete = linkedAthleteForCurrentParent();
    const requests = pendingMessageRequestsForCurrentUser();
    const entries = conversationsForLinkedAthlete();

    const node = h(`
      <div class="screen stack gap-lg">
        <h1 class="h-hero">Messages</h1>
        <div class="caption">Read-only — you're viewing this as ${athlete ? athlete.fullName + '\u2019s' : 'your athlete\u2019s'} parent/guardian.</div>

        ${requests.length ? `
          <div class="stack gap-sm">
            <div class="h-headline">Message Requests for ${athlete?.fullName ?? 'your athlete'}</div>
            ${requests.map((r) => `
              <div class="card stack gap-sm" data-request-id="${r.conversation.id}">
                <div class="row gap-md">
                  <div class="avatar ${avatarColorClass(r.otherId)}" style="width:40px;height:40px;font-size:14px;flex-shrink:0;">${initialsOf(r.otherName)}</div>
                  <div class="stack gap-xs" style="flex:1; min-width:0;">
                    <div class="body-text" style="font-weight:600;">${r.otherName}</div>
                    <div class="caption">${escapeHtml(r.firstMessage?.text ?? '')}</div>
                  </div>
                </div>
                <div class="row gap-sm">
                  <button class="btn btn-secondary" style="flex:1;" data-decline-request="${r.conversation.id}">Decline</button>
                  <button class="btn btn-primary" style="flex:1;" data-accept-request="${r.conversation.id}">Accept</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="stack gap-sm">
          <div class="h-headline">Conversations</div>
          ${!athlete ? `<div class="card">${emptyState({ icon: ICONS.familyLink, title: 'No athlete linked yet', subtitle: 'Link your athlete from your Profile tab to see this.' })}</div>`
            : !entries.length ? `<div class="card">${emptyState({ icon: ICONS.eyeOff, title: 'Message sharing is off', subtitle: `${athlete.fullName} hasn't turned on sharing their messages with you. You'll still see and approve any new message requests above.` })}</div>`
            : entries.map((entry) => `
              <button class="card card-tappable row gap-md" data-conversation-id="${entry.conversation.id}" style="margin-bottom:8px;">
                <div class="avatar ${avatarColorClass(entry.otherId)}" style="width:44px;height:44px;font-size:15px;flex-shrink:0;">${initialsOf(entry.otherName)}</div>
                <div class="stack gap-xs" style="flex:1; min-width:0;">
                  <div class="body-text" style="font-weight:600;">${entry.otherName}</div>
                  <div class="caption" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${entry.lastMessage ? escapeHtml(entry.lastMessage.text) : 'No messages yet'}</div>
                </div>
                ${entry.lastMessage ? `<div class="caption" style="flex-shrink:0;">${timeAgo(entry.lastMessage.createdAt)}</div>` : ''}
              </button>
            `).join('')}
        </div>
      </div>
    `);

    node.querySelectorAll('[data-conversation-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeConversationId = btn.dataset.conversationId;
        mode = 'thread';
        draw();
      });
    });
    node.querySelectorAll('[data-accept-request]').forEach((btn) => {
      btn.addEventListener('click', () => {
        acceptMessageRequest(btn.dataset.acceptRequest);
        showToast('Request accepted');
        draw();
      });
    });
    node.querySelectorAll('[data-decline-request]').forEach((btn) => {
      btn.addEventListener('click', () => {
        declineMessageRequest(btn.dataset.declineRequest);
        showToast('Request declined and sender blocked');
        draw();
      });
    });

    mount(container, node);
  }

  function drawThread() {
    const athlete = linkedAthleteForCurrentParent();
    const entry = conversationsForLinkedAthlete().find((e) => e.conversation.id === activeConversationId);
    const otherName = entry?.otherName ?? 'Conversation';
    const thread = messagesForConversation(activeConversationId);

    const node = h(`
      <div class="screen stack gap-md" style="height:calc(100vh - 200px); display:flex;">
        <div class="screen-header">
          <button class="icon-btn" id="btn-back">${ICONS.back}</button>
          <div class="h-headline screen-title">${otherName}</div>
          <span style="width:40px;"></span>
        </div>
        <div class="caption">Viewing ${athlete?.fullName ?? 'your athlete'}\u2019s conversation \u2014 read only.</div>

        <div class="stack gap-sm" id="thread-scroll" style="flex:1; overflow-y:auto; padding:4px;">
          ${thread.length ? thread.map((m) => {
            const mine = m.senderId === athlete?.id;
            return `
              <div style="display:flex; justify-content:${mine ? 'flex-end' : 'flex-start'};">
                <div style="max-width:75%; background:${mine ? 'var(--gradient-primary)' : 'var(--surface-elevated)'}; color:${mine ? '#fff' : 'var(--text-primary)'}; padding:10px 14px; border-radius:16px; ${mine ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'}">
                  <div class="body-text" style="color:inherit;">${escapeHtml(m.text)}</div>
                </div>
              </div>`;
          }).join('') : `<div class="caption center" style="margin-top:24px;">No messages yet.</div>`}
        </div>
      </div>
    `);

    node.querySelector('#btn-back').addEventListener('click', () => { mode = 'list'; draw(); });

    mount(container, node);
    const scrollEl = node.querySelector('#thread-scroll');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  draw();
}

// Shown instead of the normal Messages tab for a coach account that
// hasn't been verified yet — see isAdminVerified in store.js.
function renderUnverifiedAdminBlock(container) {
  const node = h(`
    <div class="screen stack gap-lg">
      <h1 class="h-hero">Messages</h1>
      <div class="card">
        ${emptyState({
          icon: ICONS.shield,
          title: 'Messaging is unavailable',
          subtitle: "Your coaching account isn't verified yet, so you can't message athletes or parents. Everything else \u2014 creating a team, posting workouts \u2014 still works.",
        })}
        <button class="btn btn-primary" id="btn-go-verify" style="margin-top:16px; width:100%;">Verify Your Account</button>
      </div>
    </div>
  `);
  node.querySelector('#btn-go-verify').addEventListener('click', () => navigate('profile'));
  mount(container, node);
}
