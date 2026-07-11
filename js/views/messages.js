import { h, mount, avatarColorClass } from '../components/dom.js';
import {
  getState, conversationsForCurrentUser, messagesForConversation, sendMessage,
  messageableContacts, getOrCreateConversation,
} from '../store.js';
import { ICONS } from '../components/icons.js';

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
  // 'list' | 'thread' | 'newMessage' — kept as local view-state since it's
  // purely navigational within this one tab, not app-wide routing.
  let mode = 'list';
  let activeConversationId = null;

  function draw() {
    if (mode === 'thread') {
      drawThread();
    } else if (mode === 'newMessage') {
      drawNewMessage();
    } else {
      drawList();
    }
  }

  function drawList() {
    const entries = conversationsForCurrentUser();

    const node = h(`
      <div class="screen stack gap-lg">
        <div class="row-between">
          <h1 class="h-hero">Messages</h1>
          <button class="pill-action-btn primary" id="btn-new">${ICONS.plus} New</button>
        </div>

        ${entries.length ? entries.map((entry) => `
          <button class="card card-tappable row gap-md" data-conversation-id="${entry.conversation.id}" style="margin-bottom:8px;">
            <div class="avatar ${avatarColorClass(entry.otherId)}" style="width:44px;height:44px;font-size:15px;flex-shrink:0;">${initialsOf(entry.otherName)}</div>
            <div class="stack gap-xs" style="flex:1; min-width:0;">
              <div class="body-text" style="font-weight:600;">${entry.otherName}</div>
              <div class="caption" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${entry.lastMessage ? entry.lastMessage.text : 'Say hello!'}</div>
            </div>
            ${entry.lastMessage ? `<div class="caption" style="flex-shrink:0;">${timeAgo(entry.lastMessage.createdAt)}</div>` : ''}
          </button>
        `).join('') : `<div class="card subheadline">No conversations yet. Tap New to message a teammate or coach.</div>`}
      </div>
    `);

    node.querySelector('#btn-new').addEventListener('click', () => { mode = 'newMessage'; draw(); });
    node.querySelectorAll('[data-conversation-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeConversationId = btn.dataset.conversationId;
        mode = 'thread';
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
        `).join('') : `<div class="card subheadline">No contacts available yet — join a team first.</div>`}
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

  function drawThread() {
    const currentUserId = getState().currentUser.id;
    const entry = conversationsForCurrentUser().find((e) => e.conversation.id === activeConversationId);
    const otherName = entry?.otherName ?? 'Conversation';
    const thread = messagesForConversation(activeConversationId);

    const node = h(`
      <div class="screen stack gap-md" style="height:calc(100vh - 200px); display:flex;">
        <div class="screen-header">
          <button class="icon-btn" id="btn-back">${ICONS.back}</button>
          <div class="h-headline screen-title">${otherName}</div>
          <span style="width:40px;"></span>
        </div>

        <div class="stack gap-sm" id="thread-scroll" style="flex:1; overflow-y:auto; padding:4px;">
          ${thread.length ? thread.map((m) => {
            const mine = m.senderId === currentUserId;
            return `
              <div style="display:flex; justify-content:${mine ? 'flex-end' : 'flex-start'};">
                <div style="max-width:75%; background:${mine ? 'var(--gradient-primary)' : 'var(--surface-elevated)'}; color:${mine ? '#fff' : 'var(--text-primary)'}; padding:10px 14px; border-radius:16px; ${mine ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'}">
                  <div class="body-text" style="color:inherit;">${m.text}</div>
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
