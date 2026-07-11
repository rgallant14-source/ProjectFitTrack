import {
  seedWorkouts, seedRosterByOrg, seedRosterLogs, seedRosterClips, seedClipComments,
  seedPractices, seedDemoAthleteHistory, ORGANIZATIONS, ORG_ADMIN_DIRECTORY, sampleOrg,
} from './mockData.js';
import { makeUser, makeWorkout, makeClip, userAge, uuid, isWorkoutVisibleToUser } from './models.js';

const STORAGE_KEY = 'fittrack_state_v6';

/**
 * This store is the web equivalent of the SwiftUI ViewModels: it holds
 * @Published-style state, exposes action methods that mutate it, and
 * notifies subscribers (views) so they re-render. Views never mutate
 * `state` directly — they always go through an action method, same
 * discipline as calling a ViewModel function from a View.
 */
function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(state) {
  const {
    currentUser, currentOrganization, logs, notificationsEnabled, workouts, clips,
    clipComments, practices, practiceRsvps, conversations, messages,
  } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    currentUser, currentOrganization, logs, notificationsEnabled, workouts, clips,
    clipComments, practices, practiceRsvps, conversations, messages,
  }));
}

const persisted = loadPersisted();
const seededWorkouts = seedWorkouts();

const state = {
  // Auth / session
  currentUser: persisted?.currentUser ?? null,
  currentOrganization: persisted?.currentOrganization ?? null,
  isAuthenticated: !!persisted?.currentUser,
  errorMessage: null,
  isLoading: false,
  verifiedDateOfBirth: null,

  // All known organizations (directory) and their per-org rosters. An
  // admin can manage more than one of these — see currentUser.adminOrgIds.
  organizations: ORGANIZATIONS,
  rosterByOrg: seedRosterByOrg(),

  // Workouts / logs
  workouts: persisted?.workouts ?? seededWorkouts,
  logs: persisted?.logs ?? [...seedRosterLogs(seededWorkouts), ...seedDemoAthleteHistory()],
  notificationsEnabled: persisted?.notificationsEnabled ?? false,

  // Profile clips (skill/progress videos + game-camera highlights), keyed
  // by user ID so multiple accounts in the same browser don't collide.
  clips: persisted?.clips ?? seedRosterClips(),
  clipComments: persisted?.clipComments ?? seedClipComments(persisted?.clips ?? seedRosterClips()),
  clipsFilterAthleteId: null,

  // Simulated 3rd-party practice schedule (see mockData.js note on why this
  // isn't a live PlayMetrics integration) + per-user RSVP status.
  practices: persisted?.practices ?? seedPractices(),
  practiceRsvps: persisted?.practiceRsvps ?? {}, // `${userId}:${practiceId}` -> 'going' | 'not_going'

  // Direct messages. Shared local storage means two demo accounts in the
  // SAME browser can actually message each other for testing purposes —
  // true cross-device messaging needs a real backend.
  conversations: persisted?.conversations ?? [],
  messages: persisted?.messages ?? {}, // conversationId -> Message[]

  // Navigation
  route: 'dashboard', // dashboard | calendar | clips | team | messages | profile
  selectedDate: new Date().toISOString(),
};

const subscribers = new Set();

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify() {
  persist(state);
  subscribers.forEach((fn) => fn(state));
}

export function getState() {
  return state;
}

export function isAdmin() {
  return state.currentUser?.role === 'admin';
}

// ---------- Auth actions ----------

export function verifyAge(dateOfBirthStr) {
  const dob = new Date(dateOfBirthStr);
  const age = userAge({ dateOfBirth: dob });
  if (age < 13) {
    state.errorMessage = 'You must be at least 13 years old to create an account.';
    notify();
    return false;
  }
  state.verifiedDateOfBirth = dob.toISOString();
  state.errorMessage = null;
  notify();
  return true;
}

export async function signUp({ fullName, email, role }) {
  if (!state.verifiedDateOfBirth) {
    state.errorMessage = 'Please verify your date of birth first.';
    notify();
    return;
  }
  state.isLoading = true;
  notify();
  await delay(400);
  const user = makeUser({ id: uuid(), fullName, email, dateOfBirth: state.verifiedDateOfBirth, role });
  user.adminOrgIds = role === 'admin' ? [] : undefined;
  state.currentUser = user;
  state.isAuthenticated = true;
  state.isLoading = false;
  state.errorMessage = null;
  state.route = 'dashboard';
  notify();
}

export async function logIn({ email, role = 'athlete' }) {
  state.isLoading = true;
  notify();
  await delay(400);
  const isAthlete = role !== 'admin';
  const user = makeUser({
    id: role === 'admin' ? 'admin-1' : 'demo-athlete-1',
    fullName: role === 'admin' ? 'Coach Alvarez' : 'Jordan Casey',
    email,
    dateOfBirth: new Date(new Date().setFullYear(new Date().getFullYear() - (role === 'admin' ? 34 : 16))).toISOString(),
    role,
    organizationId: sampleOrg.id,
    bio: isAthlete ? 'Midfielder · Class of 2028 · Riverside FC Academy' : '',
    socialLinks: isAthlete ? { instagram: 'instagram.com/jordan.casey', youtube: 'youtube.com/@jordancasey' } : {},
  });
  // Demo admin manages two teams — this is what powers the team switcher.
  if (!isAthlete) user.adminOrgIds = [ORGANIZATIONS[0].id, ORGANIZATIONS[1].id];

  state.currentUser = user;
  state.currentOrganization = isAthlete ? sampleOrg : ORGANIZATIONS[0];
  state.isAuthenticated = true;
  state.isLoading = false;
  state.errorMessage = null;
  state.route = 'dashboard';

  // Seed one demo clip the first time this demo athlete logs in, so the
  // Clips section isn't empty on first look.
  if (isAthlete && !state.clips[user.id]) {
    state.clips[user.id] = [
      makeClip({ id: uuid(), url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', platform: 'youtube', title: 'Ball mastery — week 3 progress' }),
    ];
  }

  notify();
}

export async function joinOrganization(code) {
  state.isLoading = true;
  notify();
  await delay(300);
  const org = state.organizations.find((o) => o.joinCode.toUpperCase() === code.trim().toUpperCase());
  if (!org) {
    state.errorMessage = "That join code wasn't recognized. Check with your coach and try again.";
    state.isLoading = false;
    notify();
    return false;
  }
  state.currentOrganization = org;
  if (state.currentUser) {
    if (isAdmin()) {
      state.currentUser.adminOrgIds = state.currentUser.adminOrgIds ?? [];
      if (!state.currentUser.adminOrgIds.includes(org.id)) state.currentUser.adminOrgIds.push(org.id);
    } else {
      state.currentUser.organizationId = org.id;
    }
  }
  state.isLoading = false;
  state.errorMessage = null;
  notify();
  return true;
}

export function logOut() {
  state.currentUser = null;
  state.currentOrganization = null;
  state.isAuthenticated = false;
  state.route = 'dashboard';
  notify();
}

export function clearError() {
  state.errorMessage = null;
  notify();
}

// ---------- Navigation ----------

export function navigate(route) {
  state.route = route;
  notify();
}

export function setSelectedDate(iso) {
  state.selectedDate = iso;
  notify();
}

// ---------- Multi-team admin support ----------

// Every org this admin manages — powers the team switcher in the Team tab.
// Athletes belong to exactly one org and never see a switcher.
export function adminOrganizations() {
  const ids = state.currentUser?.adminOrgIds ?? [];
  return state.organizations.filter((o) => ids.includes(o.id));
}

export function switchOrganization(orgId) {
  const org = state.organizations.find((o) => o.id === orgId);
  if (!org) return;
  state.currentOrganization = org;
  notify();
}

// ---------- Workouts / logs ----------

// Admins see every workout in their active org, regardless of assignment,
// so they can manage the full schedule. Athletes only see workouts assigned
// to them specifically or to the whole team ("all").
export function workoutsForCurrentUser() {
  const orgId = state.currentOrganization?.id ?? null;
  const orgWorkouts = state.workouts.filter((w) => !orgId || w.organizationId === orgId);
  if (isAdmin()) return orgWorkouts;
  return orgWorkouts.filter((w) => isWorkoutVisibleToUser(w, state.currentUser?.id));
}

export function findLog(exerciseId, workoutId, userId = state.currentUser?.id) {
  return state.logs.find((l) => l.exerciseId === exerciseId && l.workoutId === workoutId && l.userId === userId);
}

export function logsForUser(userId) {
  return state.logs.filter((l) => l.userId === userId);
}

// History of a specific movement, matched by name (not exerciseId) since a
// repeated weekly workout generates a fresh exercise id each time it's
// created — matching by name is what lets "did I lift more than last week"
// actually work across separate workout instances.
export function exerciseHistory(userId, exerciseName, { excludeLogId } = {}) {
  return state.logs
    .filter((l) => l.userId === userId && l.exerciseName === exerciseName && l.id !== excludeLogId)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

// Every distinct movement this user has ever logged, most-recently-logged
// first — powers the Progress History screen.
export function loggedExerciseNames(userId) {
  const seen = new Map(); // name -> most recent completedAt
  state.logs.filter((l) => l.userId === userId).forEach((l) => {
    const existing = seen.get(l.exerciseName);
    if (!existing || new Date(l.completedAt) > new Date(existing)) seen.set(l.exerciseName, l.completedAt);
  });
  return [...seen.entries()]
    .sort((a, b) => new Date(b[1]) - new Date(a[1]))
    .map(([name]) => name);
}

// Consecutive days (ending today or yesterday) this user has logged at
// least one exercise result — the "streak" stat used on Dashboard/Profile.
export function currentStreakForUser(userId) {
  const logDates = new Set(
    logsForUser(userId).map((l) => new Date(l.completedAt).toDateString())
  );
  let streak = 0;
  const cursor = new Date();
  // If nothing logged today yet, streak can still count from yesterday
  // backward so a morning check-in doesn't show "0" before today's workout.
  if (!logDates.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (logDates.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function saveLog(logDraft) {
  const idx = state.logs.findIndex((l) => l.id === logDraft.id);
  if (idx >= 0) state.logs[idx] = logDraft;
  else state.logs.push(logDraft);
  notify();
}

export function setNotificationsEnabled(enabled) {
  state.notificationsEnabled = enabled;
  notify();
}

// ---------- Admin actions ----------

export function rosterMembers() {
  const orgId = state.currentOrganization?.id;
  return orgId ? (state.rosterByOrg[orgId] ?? []) : [];
}

// Fraction of a given workout's exercises this user has logged.
export function completionFraction(userId, workout) {
  if (!workout.exercises.length) return 0;
  const logged = workout.exercises.filter((ex) => findLog(ex.id, workout.id, userId)).length;
  return logged / workout.exercises.length;
}

// Overall completion across every workout assigned to this athlete —
// powers the roster progress bars an admin sees.
export function overallCompletionForUser(userId) {
  const assigned = state.workouts.filter((w) => isWorkoutVisibleToUser(w, userId) && new Date(w.date) <= new Date());
  if (!assigned.length) return 0;
  const total = assigned.reduce((sum, w) => sum + completionFraction(userId, w), 0);
  return total / assigned.length;
}

export function createWorkout(draft) {
  const workout = makeWorkout({
    id: uuid(),
    title: draft.title,
    date: draft.date,
    weekNumber: draft.weekNumber || 1,
    dayLabel: draft.dayLabel,
    sessionLength: draft.sessionLength,
    exercises: draft.exercises,
    organizationId: state.currentOrganization?.id ?? null,
    assignedTo: draft.assignedTo, // 'all' or array of athlete IDs
    createdBy: state.currentUser?.id ?? null,
  });
  state.workouts.push(workout);
  notify();
  return workout;
}

export function deleteWorkout(workoutId) {
  state.workouts = state.workouts.filter((w) => w.id !== workoutId);
  notify();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Profile / social links / avatar ----------

export function updateProfile({ fullName, bio, socialLinks, avatarDataUrl }) {
  if (!state.currentUser) return;
  if (fullName !== undefined) state.currentUser.fullName = fullName;
  if (bio !== undefined) state.currentUser.bio = bio;
  if (socialLinks) state.currentUser.socialLinks = { ...state.currentUser.socialLinks, ...socialLinks };
  if (avatarDataUrl !== undefined) state.currentUser.avatarDataUrl = avatarDataUrl;
  notify();
}

// ---------- Clips (skill videos + game-camera highlights) ----------

export function clipsForUser(userId) {
  return state.clips[userId] ?? [];
}

export function addClip(userId, clip) {
  const list = state.clips[userId] ?? [];
  state.clips[userId] = [clip, ...list];
  notify();
}

export function removeClip(userId, clipId) {
  const list = state.clips[userId] ?? [];
  state.clips[userId] = list.filter((c) => c.id !== clipId);
  notify();
}

// ---------- Clips tab feed (visible to both roles) ----------

// Returns [{ athleteId, athleteName, clip }] across everyone the current
// user is allowed to see: admins see their active team's roster, athletes
// see only their own clips.
export function clipFeedEntries() {
  const currentUser = state.currentUser;
  if (!currentUser) return [];

  if (isAdmin()) {
    const filterId = state.clipsFilterAthleteId;
    const roster = rosterMembers();
    const sources = filterId ? roster.filter((m) => m.id === filterId) : roster;
    return sources.flatMap((member) =>
      clipsForUser(member.id).map((clip) => ({ athleteId: member.id, athleteName: member.fullName, clip }))
    ).sort((a, b) => new Date(b.clip.addedAt) - new Date(a.clip.addedAt));
  }

  return clipsForUser(currentUser.id)
    .map((clip) => ({ athleteId: currentUser.id, athleteName: currentUser.fullName, clip }))
    .sort((a, b) => new Date(b.clip.addedAt) - new Date(a.clip.addedAt));
}

export function setClipsFilterAthlete(athleteId) {
  state.clipsFilterAthleteId = athleteId;
  notify();
}

// ---------- Clip comments (critique threads) ----------

export function clipCommentsForClip(clipId) {
  return state.clipComments[clipId] ?? [];
}

export function addClipComment(clipId, text) {
  if (!state.currentUser || !text.trim()) return;
  const comment = {
    id: uuid(),
    authorId: state.currentUser.id,
    authorName: state.currentUser.fullName,
    authorRole: state.currentUser.role,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  const list = state.clipComments[clipId] ?? [];
  state.clipComments[clipId] = [...list, comment];
  notify();
}

// ---------- Clip likes / quick reactions ----------

function findClip(ownerId, clipId) {
  return (state.clips[ownerId] ?? []).find((c) => c.id === clipId);
}

export function toggleClipLike(ownerId, clipId) {
  const clip = findClip(ownerId, clipId);
  if (!clip || !state.currentUser) return;
  clip.likes = clip.likes ?? [];
  const uid = state.currentUser.id;
  const idx = clip.likes.indexOf(uid);
  if (idx >= 0) clip.likes.splice(idx, 1);
  else clip.likes.push(uid);
  notify();
}

export function toggleClipReaction(ownerId, clipId, emoji) {
  const clip = findClip(ownerId, clipId);
  if (!clip || !state.currentUser) return;
  clip.reactions = clip.reactions ?? {};
  clip.reactions[emoji] = clip.reactions[emoji] ?? [];
  const uid = state.currentUser.id;
  const idx = clip.reactions[emoji].indexOf(uid);
  if (idx >= 0) clip.reactions[emoji].splice(idx, 1);
  else clip.reactions[emoji].push(uid);
  notify();
}

// ---------- Practice schedule (simulated 3rd-party sync) ----------

export function practicesForCurrentUser() {
  const orgId = state.currentOrganization?.id ?? null;
  return state.practices.filter((p) => !orgId || p.organizationId === orgId);
}

export function practiceRsvpStatus(practiceId, userId = state.currentUser?.id) {
  return state.practiceRsvps[`${userId}:${practiceId}`] ?? null;
}

export function setPracticeRsvp(practiceId, status) {
  if (!state.currentUser) return;
  state.practiceRsvps[`${state.currentUser.id}:${practiceId}`] = status;
  notify();
}

// ---------- Direct messages ----------

// Who the current user is allowed to start a conversation with: athletes
// can message their teammates and the admin(s) who run their team; admins
// can message any athlete across every team they manage.
export function messageableContacts() {
  const user = state.currentUser;
  if (!user) return [];

  if (isAdmin()) {
    const ids = user.adminOrgIds ?? [];
    const seen = new Map();
    ids.forEach((orgId) => {
      (state.rosterByOrg[orgId] ?? []).forEach((m) => seen.set(m.id, m));
    });
    return [...seen.values()];
  }

  const orgId = user.organizationId;
  const teammates = (state.rosterByOrg[orgId] ?? []).filter((m) => m.id !== user.id);
  const admins = ORG_ADMIN_DIRECTORY[orgId] ?? [];
  return [...admins, ...teammates];
}

function conversationKey(idA, idB) {
  return [idA, idB].sort().join('::');
}

export function getOrCreateConversation(otherUserId, otherUserName) {
  const user = state.currentUser;
  const existing = state.conversations.find((c) => conversationKey(...c.participantIds) === conversationKey(user.id, otherUserId));
  if (existing) return existing;
  const conversation = {
    id: uuid(),
    participantIds: [user.id, otherUserId],
    participantNames: { [user.id]: user.fullName, [otherUserId]: otherUserName },
  };
  state.conversations.push(conversation);
  state.messages[conversation.id] = [];
  notify();
  return conversation;
}

export function conversationsForCurrentUser() {
  const user = state.currentUser;
  if (!user) return [];
  return state.conversations
    .filter((c) => c.participantIds.includes(user.id))
    .map((c) => {
      const otherId = c.participantIds.find((id) => id !== user.id);
      const thread = state.messages[c.id] ?? [];
      const last = thread[thread.length - 1];
      return {
        conversation: c,
        otherId,
        otherName: c.participantNames?.[otherId] ?? 'Unknown',
        lastMessage: last ?? null,
      };
    })
    .sort((a, b) => new Date(b.lastMessage?.createdAt ?? 0) - new Date(a.lastMessage?.createdAt ?? 0));
}

export function messagesForConversation(conversationId) {
  return state.messages[conversationId] ?? [];
}

export function sendMessage(conversationId, text) {
  if (!state.currentUser || !text.trim()) return;
  const message = {
    id: uuid(),
    senderId: state.currentUser.id,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  const thread = state.messages[conversationId] ?? [];
  state.messages[conversationId] = [...thread, message];
  notify();
}
