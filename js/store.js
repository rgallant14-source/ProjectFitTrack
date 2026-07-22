import {
  seedWorkouts, seedRosterByOrg, seedRosterLogs, seedRosterClips, seedClipComments,
  seedPractices, seedDemoAthleteHistory, ORGANIZATIONS, ORG_ADMIN_DIRECTORY, sampleOrg,
} from './mockData.js';
import {
  makeUser, makeWorkout, makeClip, userAge, uuid, isWorkoutVisibleToUser,
  makeFamilyLink, makeReport, makeTeamInviteCode, randomInviteCode, makeExercise,
  makeOrganization, generateJoinCode, makeVerificationRequest,
} from './models.js';

const STORAGE_KEY = 'fittrack_state_v13';

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
    blockedByUser, reports, familyLinks, teamInviteCodes, rosterByOrg, organizations,
    verificationRequests, adminVerificationByUserId, lastReadAt,
  } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    currentUser, currentOrganization, logs, notificationsEnabled, workouts, clips,
    clipComments, practices, practiceRsvps, conversations, messages,
    blockedByUser, reports, familyLinks, teamInviteCodes, rosterByOrg, organizations,
    verificationRequests, adminVerificationByUserId, lastReadAt,
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
  // Signup-in-progress verification code — deliberately NOT read from or
  // written to persisted storage (see the Signup verification section).
  pendingVerification: null,

  // All known organizations (directory) and their per-org rosters. An
  // admin can manage more than one of these — see currentUser.adminOrgIds.
  // Both are persisted (not just re-derived from the seed each load):
  // rosters change when an athlete redeems an additional-team invite code,
  // and the organizations list itself grows when a coach creates a new
  // team at runtime (see createOrganization below).
  organizations: persisted?.organizations ?? ORGANIZATIONS,
  rosterByOrg: persisted?.rosterByOrg ?? seedRosterByOrg(),

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
  // Conversations also carry `status` ('accepted' | 'pending') and
  // `initiatorId` — see the Trust & Safety section below for the
  // message-request flow this powers.
  conversations: persisted?.conversations ?? [],
  messages: persisted?.messages ?? {}, // conversationId -> Message[]

  // ---------- Trust & safety ----------
  // Per-user block lists: userId -> array of blocked userIds. Blocking is
  // mutual in effect (see isBlockedPair) even though it's stored one-way,
  // so a blocked person can't just start a fresh conversation either.
  blockedByUser: persisted?.blockedByUser ?? {},

  // Reports of messages/clips/comments/users. No backend to send these to
  // yet, so they surface directly to the coach(es) who manage the
  // reported person's team — see reportsVisibleToModerator().
  reports: persisted?.reports ?? [],

  // Parent <-> athlete links. One athlete can have more than one linked
  // parent/guardian; `shareMessages` is the athlete's own opt-in toggle
  // for whether that specific parent can see their message activity.
  familyLinks: persisted?.familyLinks ?? [],

  // Coach identity/affiliation intake submissions — see
  // makeVerificationRequest in models.js and isAdminVerified below for
  // what this can and can't actually enforce without a backend yet.
  verificationRequests: persisted?.verificationRequests ?? [],

  // The actual verification status registry: userId -> 'pending' |
  // 'approved'. Deliberately keyed by id and stored separately from the
  // user object itself (rather than a field on currentUser) so anything
  // that needs to check ANOTHER user's status live (e.g. "is the coach who
  // posted this workout verified NOW") has one shared place to look,
  // instead of only ever knowing the current session's own status. This
  // is also the shape a real backend's users-table verification column
  // would naturally take, so the swap-over later is direct.
  adminVerificationByUserId: persisted?.adminVerificationByUserId ?? {},

  // Per-conversation "I've seen up to here" timestamps, keyed by
  // `${userId}:${conversationId}` (same pattern as practiceRsvps) since
  // more than one account can share a browser here. Powers the unread
  // badges on the tab bar.
  lastReadAt: persisted?.lastReadAt ?? {},

  // Single-use codes for attaching an ADDITIONAL team to an existing
  // athlete account after signup — see makeTeamInviteCode in models.js.
  teamInviteCodes: persisted?.teamInviteCodes ?? [],

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

export function isParent() {
  return state.currentUser?.role === 'parent';
}

// Whether the current admin can message anyone at all. Athletes/parents
// are never subject to this — it's specifically about the "anyone can
// spin up a fake coach account" risk. NOTE: this only reads a field on
// the user's OWN client-side record. With no backend yet, "verified" is
// not a real trust boundary — see setAdminVerifiedForTesting below for
// exactly what that means and how to test this locally in the meantime.
export function isAdminVerified() {
  if (!isAdmin()) return true; // the gate only applies to admin accounts
  return state.adminVerificationByUserId[state.currentUser?.id] === 'approved';
}

// Live lookup for ANY user id — used to tag a workout with the CURRENT
// verification status of whoever created it, rather than freezing it at
// post time. Workouts with no createdBy (the seeded demo content) are
// treated as trusted, since they aren't real user-generated content.
export function isWorkoutCreatorVerified(workout) {
  if (!workout.createdBy) return true;
  return state.adminVerificationByUserId[workout.createdBy] === 'approved';
}

// ---------- Coach identity/affiliation intake ----------
// Collects club/league info for a future real review queue. Submitting
// does NOT change verificationStatus — there's nowhere trustworthy for
// that decision to be made yet (see isAdminVerified's note). One
// submission per admin — resubmitting replaces it rather than stacking,
// since there's no queue yet to process duplicates anyway.

export function submitVerificationRequest({ clubName, league = '', websiteUrl = '', note = '' }) {
  const user = state.currentUser;
  if (!user || !isAdmin()) return null;
  if (!clubName?.trim()) {
    state.errorMessage = 'Club or organization name is required.';
    notify();
    return null;
  }
  state.verificationRequests = state.verificationRequests.filter((r) => r.adminId !== user.id);
  const request = makeVerificationRequest({
    id: uuid(), adminId: user.id, clubName: clubName.trim(), league: league.trim(), websiteUrl: websiteUrl.trim(), note: note.trim(),
  });
  state.verificationRequests.push(request);
  state.errorMessage = null;
  notify();
  return request;
}

export function verificationRequestForCurrentUser() {
  const user = state.currentUser;
  if (!user) return null;
  return state.verificationRequests.find((r) => r.adminId === user.id) ?? null;
}

// TEST-MODE ONLY. There is no real approval mechanism yet — this exists
// purely so the restricted-state behavior (blocked messaging, "pending
// verification" tags on workouts, etc.) can actually be exercised and
// tested locally before a backend exists to make this decision for real.
// It flips a field on the CURRENT device's own local copy of the account,
// which anyone could do to themselves in DevTools — so it must never be
// treated as, or presented to real users as, a genuine approval flow.
// Delete this function once real backend-issued approval exists.
export function setAdminVerifiedForTesting(verified) {
  if (!isAdmin() || !state.currentUser) return;
  state.adminVerificationByUserId[state.currentUser.id] = verified ? 'approved' : 'pending';
  notify();
}

// Every team org id an athlete belongs to. Falls back to the older
// single `organizationId` field for any account created before
// multi-team support existed, so nothing already in localStorage breaks.
function athleteOrgIds(user) {
  if (!user) return [];
  if (Array.isArray(user.organizationIds) && user.organizationIds.length) return user.organizationIds;
  return user.organizationId ? [user.organizationId] : [];
}

export function organizationsForCurrentUser() {
  return athleteOrgIds(state.currentUser)
    .map((id) => state.organizations.find((o) => o.id === id))
    .filter(Boolean);
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

// ---------- Signup verification (simulated 2-step activation) ----------
// There's no real email/SMS provider wired up in this build, so "sending"
// a code just generates it and hands it back to the UI to display with a
// clear "this would normally arrive by email/text" note (same honesty
// convention as the "PlayMetrics (simulated)" label elsewhere) — the
// account itself isn't created until the code is confirmed. Kept off the
// persisted snapshot on purpose: refreshing mid-verification just means
// starting signup over, which is an acceptable, safe default.
function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function requestSignupVerification({ fullName, email, phone, role, organizationId, channel }) {
  const code = generateVerificationCode();
  state.pendingVerification = {
    code, fullName, email, phone, role, organizationId, channel, attempts: 0, createdAt: Date.now(),
  };
  // Deliberately no notify() here: this is signup-in-progress, local-view
  // state that the verifyCode screen already tracks and displays itself.
  // Calling notify() would trigger app.js's global render subscription and
  // re-invoke this same screen, which would call this function again —
  // the identical infinite-recursion shape the clearError() bug had.
  return code;
}

export function resendSignupVerification() {
  if (!state.pendingVerification) return null;
  const code = generateVerificationCode();
  state.pendingVerification = { ...state.pendingVerification, code, attempts: 0, createdAt: Date.now() };
  return code;
}

export function pendingVerification() {
  return state.pendingVerification;
}

const MAX_VERIFICATION_ATTEMPTS = 5;

export function confirmSignupVerification(inputCode) {
  const pending = state.pendingVerification;
  if (!pending) return { ok: false, error: 'Nothing to verify — please start signup again.' };
  if (inputCode.trim() === pending.code) {
    state.pendingVerification = null;
    return { ok: true, fullName: pending.fullName, email: pending.email, phone: pending.phone, role: pending.role, organizationId: pending.organizationId };
  }
  pending.attempts = (pending.attempts ?? 0) + 1;
  if (pending.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    state.pendingVerification = null;
    return { ok: false, error: 'Too many incorrect attempts. Please start signup again.', exhausted: true };
  }
  return { ok: false, error: `That code doesn't match (${MAX_VERIFICATION_ATTEMPTS - pending.attempts} attempts left).` };
}

export async function signUp({ fullName, email, phone = '', role, organizationId = null }) {
  // Only athletes go through the 13+ age gate — it's about the teen-athlete
  // signup specifically, not a general account age check.
  if (role === 'athlete' && !state.verifiedDateOfBirth) {
    state.errorMessage = 'Please verify your date of birth first.';
    notify();
    return;
  }
  state.isLoading = true;
  notify();
  await delay(400);
  const dob = role === 'athlete' ? state.verifiedDateOfBirth : new Date(new Date().setFullYear(new Date().getFullYear() - 35)).toISOString();
  const user = makeUser({ id: uuid(), fullName, email, phone, dateOfBirth: dob, role });
  user.adminOrgIds = role === 'admin' ? [] : undefined;
  user.organizationIds = role === 'athlete' ? [] : undefined;
  // Every real signup starts unverified — this is the actual gate: an
  // unverified admin can still explore the app and set up a team, but
  // can't message anyone (see isAdminVerified enforcement below), so a
  // scripted signup produces an inert account rather than one that can
  // reach real athletes.
  if (role === 'admin') state.adminVerificationByUserId[user.id] = 'pending';

  // A team code was already validated before verification even started
  // (see requestSignupVerification) — apply it now that the account is
  // actually being created. Athletes become a roster member of that org;
  // a parent just gets it as browsing context for the athlete-picker step
  // that follows signup, same as the existing Profile > Join flow.
  if (organizationId) {
    const org = state.organizations.find((o) => o.id === organizationId);
    if (org) {
      state.currentOrganization = org;
      if (role === 'athlete') {
        user.organizationId = org.id;
        user.organizationIds = [org.id];
      }
    }
  }

  state.currentUser = user;
  state.isAuthenticated = true;
  state.isLoading = false;
  state.errorMessage = null;
  // Parents land on Profile first (to link to their athlete) rather than
  // a Dashboard that has nothing to show yet.
  state.route = role === 'parent' ? 'profile' : 'dashboard';
  notify();
}

export async function logIn({ email, role = 'athlete' }) {
  state.isLoading = true;
  notify();
  await delay(400);
  const isAthlete = role === 'athlete';
  const isParentRole = role === 'parent';
  const idByRole = { admin: 'admin-1', parent: 'demo-parent-1', athlete: 'demo-athlete-1' };
  const nameByRole = { admin: 'Coach Alvarez', parent: 'Dana Casey', athlete: 'Jordan Casey' };
  const ageByRole = { admin: 34, parent: 42, athlete: 16 };

  const user = makeUser({
    id: idByRole[role],
    fullName: nameByRole[role],
    email,
    dateOfBirth: new Date(new Date().setFullYear(new Date().getFullYear() - ageByRole[role])).toISOString(),
    role,
    organizationId: isAthlete ? sampleOrg.id : null,
    bio: isAthlete ? 'Midfielder · Class of 2028 · Riverside FC Academy' : '',
    socialLinks: isAthlete ? { instagram: 'instagram.com/jordan.casey', youtube: 'youtube.com/@jordancasey' } : {},
  });
  // Demo admin manages two teams — this is what powers the team switcher.
  if (role === 'admin') {
    user.adminOrgIds = [ORGANIZATIONS[0].id, ORGANIZATIONS[1].id];
    // The quick-login demo account is a convenience path for testing, same
    // spirit as the demo parent auto-linking with sharing pre-enabled —
    // it's pre-verified so reviewers can see the full messaging experience
    // without also having to fake their way through a real signup.
    state.adminVerificationByUserId[user.id] = 'approved';
  }
  if (isAthlete) user.organizationIds = [sampleOrg.id];

  state.currentUser = user;
  state.currentOrganization = isAthlete ? sampleOrg : (role === 'admin' ? ORGANIZATIONS[0] : null);
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

  // Demo parent logs in already linked to the demo athlete (Jordan Casey),
  // with message-sharing pre-enabled so the reviewer can see the read-only
  // thread view without extra setup — a real parent would need the athlete
  // (or the athlete's own toggle) to opt in first.
  if (isParentRole && !state.familyLinks.some((l) => l.parentId === user.id)) {
    state.familyLinks.push(makeFamilyLink({
      id: uuid(), parentId: user.id, athleteId: 'demo-athlete-1', shareMessages: true,
    }));
  }

  notify();
}

// Pure lookup — no side effects — so signup can validate a team code
// belongs to a real org BEFORE an account (or a verification code) is
// created for it.
export function findOrganizationByJoinCode(code) {
  return state.organizations.find((o) => o.joinCode.toUpperCase() === (code ?? '').trim().toUpperCase()) ?? null;
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
    } else if (isParent()) {
      // A parent joining a team is just browsing that roster to find and
      // link their athlete — it doesn't make the parent a member of the
      // team the way an athlete or admin joining does.
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
  // Guard against no-op notifies: renderAgeVerification() calls this on
  // every render, and app.js subscribes its top-level render() to every
  // notify() — so an unconditional notify() here would recurse forever
  // (render -> renderAgeVerification -> clearError -> notify -> render...).
  // Only notify when there was actually an error to clear.
  if (state.errorMessage === null) return;
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

// ---------- Parent / family links ----------
// Fully many-to-many: one parent can be linked to multiple children (two
// kids playing different sports), and one child can have multiple linked
// parents/guardians (both parents, a step-parent, etc). familyLinks is
// already shaped as a plain list of {parentId, athleteId} pairs, so
// nothing about the data model needed to change for this — only the
// functions that used to assume "one link per parent."

function resolveAthleteById(athleteId) {
  const orgIds = Object.keys(state.rosterByOrg).filter((orgId) => state.rosterByOrg[orgId].some((m) => m.id === athleteId));
  for (const orgId of orgIds) {
    const member = state.rosterByOrg[orgId].find((m) => m.id === athleteId);
    if (member) return { ...member, orgId, orgIds };
  }
  // The demo athlete (logged in via the athlete quick-login, not seeded
  // in a roster) is a valid link target too.
  if (athleteId === 'demo-athlete-1') {
    return { id: 'demo-athlete-1', fullName: 'Jordan Casey', orgId: sampleOrg.id, orgIds: [sampleOrg.id] };
  }
  return null;
}

// Every athlete this parent is linked to — each entry carries its own
// familyLinkId so callers can act on ONE specific link (e.g. unlink just
// that child, or toggle message-sharing for just that child) without
// touching the parent's other links.
export function linkedAthletesForCurrentParent() {
  if (!isParent() || !state.currentUser) return [];
  return state.familyLinks
    .filter((l) => l.parentId === state.currentUser.id)
    .map((link) => {
      const athlete = resolveAthleteById(link.athleteId);
      return athlete ? { ...athlete, familyLinkId: link.id, shareMessages: link.shareMessages } : null;
    })
    .filter(Boolean);
}

export function linkParentToAthlete(athleteId) {
  if (!isParent() || !state.currentUser) return;
  // Adds a new link rather than replacing — a parent can have more than
  // one linked child. Guards only against linking the exact same child
  // twice.
  const already = state.familyLinks.some((l) => l.parentId === state.currentUser.id && l.athleteId === athleteId);
  if (already) return;
  state.familyLinks.push(makeFamilyLink({ id: uuid(), parentId: state.currentUser.id, athleteId }));
  notify();
}

// Unlinks ONE specific parent-child pair — not every link this parent has.
export function unlinkParentFromAthlete(familyLinkId) {
  state.familyLinks = state.familyLinks.filter((l) => l.id !== familyLinkId);
  notify();
}

// Every parent linked to a given athlete — shown on the athlete's own
// profile so they know who has (or could have) visibility into their
// activity, and can control the message-sharing toggle per parent.
export function parentLinksForAthlete(athleteId) {
  return state.familyLinks.filter((l) => l.athleteId === athleteId);
}

// The athlete's own opt-in control over whether a specific linked parent
// can see their message threads. Off by default — linking a parent always
// grants message-request co-approval (safety), but full content visibility
// is a separate, athlete-controlled choice (privacy/trust).
export function setShareMessagesWithParent(familyLinkId, shareMessages) {
  const link = state.familyLinks.find((l) => l.id === familyLinkId);
  if (!link) return;
  link.shareMessages = shareMessages;
  notify();
}

// ---------- Additional-team invite codes ----------
// For attaching a SECOND (or third...) team to an athlete's account after
// signup. Deliberately NOT the same as the blanket team join codes used at
// signup — those get shared around a whole roster informally, which is
// fine for "prove you belong to this team" but too loose for "attach a
// brand new team to an existing minor's account." These are single-use
// and can only be minted by someone with real standing: a coach who
// actually manages the team, or the athlete's own linked parent.

function issueInviteCode(organizationId, issuer) {
  const invite = makeTeamInviteCode({
    id: uuid(), code: randomInviteCode(), organizationId,
    issuedByUserId: issuer.id, issuedByName: issuer.fullName, issuedByRole: issuer.role,
  });
  state.teamInviteCodes.push(invite);
  notify();
  return invite;
}

// Admin path: they already manage the org directly, no extra proof needed.
export function generateTeamInviteCodeForManagedOrg(organizationId) {
  const user = state.currentUser;
  if (!user || !isAdmin()) return null;
  if (!(user.adminOrgIds ?? []).includes(organizationId)) return null;
  return issueInviteCode(organizationId, user);
}

// Parent path: parents don't manage any team themselves, so instead they
// have to supply that team's own blanket join code — the same code a real
// parent would only have from actually registering their kid there — as
// the stand-in proof of legitimate association.
export function generateTeamInviteCodeFromJoinCode(joinCode) {
  const user = state.currentUser;
  if (!user || !isParent()) return null;
  const org = findOrganizationByJoinCode(joinCode);
  if (!org) {
    state.errorMessage = "That team code wasn't recognized.";
    notify();
    return null;
  }
  state.errorMessage = null;
  return issueInviteCode(org.id, user);
}

// Unredeemed codes the current user has issued, so a coach/parent can see
// what's still outstanding (and who it was meant for, if they note that
// themselves — the code has no built-in recipient, it's just single-use).
export function activeInviteCodesIssuedByCurrentUser() {
  const user = state.currentUser;
  if (!user) return [];
  return state.teamInviteCodes
    .filter((i) => i.issuedByUserId === user.id && !i.redeemedByUserId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Athlete path: redeem a code to attach that team to their own account.
export function addAdditionalTeam(code) {
  const user = state.currentUser;
  if (!user || user.role !== 'athlete') {
    state.errorMessage = 'Only athlete accounts can add an additional team.';
    notify();
    return false;
  }
  const invite = state.teamInviteCodes.find((i) => i.code.toUpperCase() === code.trim().toUpperCase());
  if (!invite) {
    state.errorMessage = "That code wasn't recognized. Ask your coach or parent for a new one.";
    notify();
    return false;
  }
  if (invite.redeemedByUserId) {
    state.errorMessage = 'That code has already been used.';
    notify();
    return false;
  }
  const orgIds = athleteOrgIds(user);
  if (orgIds.includes(invite.organizationId)) {
    state.errorMessage = "You're already on that team.";
    notify();
    return false;
  }

  user.organizationIds = [...orgIds, invite.organizationId];
  if (!user.organizationId) user.organizationId = invite.organizationId;

  // Put the athlete on that org's actual roster too — otherwise the coach
  // who issued the code wouldn't see them show up on their Team tab even
  // though the athlete now sees that team's workouts.
  const orgRoster = state.rosterByOrg[invite.organizationId] ?? (state.rosterByOrg[invite.organizationId] = []);
  if (!orgRoster.some((m) => m.id === user.id)) orgRoster.push({ id: user.id, fullName: user.fullName });

  invite.redeemedByUserId = user.id;
  invite.redeemedAt = new Date().toISOString();
  state.errorMessage = null;
  notify();
  return true;
}

// ---------- Workouts / logs ----------

// Admins see every workout in their active org, regardless of assignment,
// so they can manage the full schedule. Athletes see workouts assigned to
// them specifically or to the whole team ("all") — across EVERY team
// they're on, not just one, since an athlete's personal training log
// should be the union of everything assigned to them, not a single
// switchable context the way an admin's roster view is.
export function workoutsForCurrentUser() {
  if (isAdmin()) {
    const orgId = state.currentOrganization?.id ?? null;
    return orgId ? state.workouts.filter((w) => w.organizationId === orgId) : [];
  }
  const orgIds = athleteOrgIds(state.currentUser);
  return state.workouts.filter((w) => orgIds.includes(w.organizationId) && isWorkoutVisibleToUser(w, state.currentUser?.id));
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

// Read-only stat rollup for a parent's Dashboard-equivalent screen — reuses
// the same underlying getters athletes/admins already rely on, just scoped
// to the linked athlete's id/org instead of the current user's.
// Read-only stat rollup for a parent's Dashboard-equivalent screen — one
// entry per linked child, since a parent can have more than one.
export function parentDashboardStatsList() {
  return linkedAthletesForCurrentParent().map((athlete) => {
    const orgIds = athlete.orgIds ?? [athlete.orgId];
    const orgWorkouts = state.workouts.filter((w) => orgIds.includes(w.organizationId) && isWorkoutVisibleToUser(w, athlete.id));
    const pastWorkouts = orgWorkouts.filter((w) => new Date(w.date) <= new Date());
    const logs = logsForUser(athlete.id);
    const completed = pastWorkouts.filter((w) => w.exercises.length && w.exercises.every((ex) => logs.some((l) => l.exerciseId === ex.id)));
    return {
      athlete,
      streak: currentStreakForUser(athlete.id),
      logsCount: logs.length,
      completedCount: completed.length,
      totalPastWorkouts: pastWorkouts.length,
      recentLogs: [...logs].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, 5),
    };
  });
}

// Lets a coach/admin create a brand new team rather than only ever being
// able to join one of the ones already seeded — without this, nobody
// running their own club could actually set it up in the app. The new
// team is immediately added to this admin's managed list and switched to,
// with an auto-generated join code they can hand out to athletes/parents.
export function createOrganization({ name, teamName, sport }) {
  const user = state.currentUser;
  if (!user || !isAdmin()) return null;
  const joinCode = generateJoinCode(teamName || name, state.organizations.map((o) => o.joinCode));
  const org = makeOrganization({ id: uuid(), name, teamName, sport, joinCode });
  state.organizations.push(org);
  state.rosterByOrg[org.id] = [];
  user.adminOrgIds = user.adminOrgIds ?? [];
  user.adminOrgIds.push(org.id);
  state.currentOrganization = org;
  notify();
  return org;
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

// Creates one real workout per validated draft from buildWorkoutDrafts()
// (see js/bulkWorkouts.js) — only ever called after the coach has seen and
// confirmed the preview, never straight off a raw upload.
export function commitBulkWorkouts(drafts) {
  const created = drafts.map((draft) => createWorkout({
    title: draft.title,
    date: draft.date,
    dayLabel: draft.dayLabel,
    sessionLength: draft.sessionLength,
    assignedTo: draft.assignedTo,
    exercises: draft.exercises.map((ex) => makeExercise({
      id: uuid(), name: ex.name, block: ex.block, prescribed: ex.prescribed || '-', tutorialUrl: ex.tutorialUrl,
    })),
  }));
  return created.length;
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

  if (isParent()) {
    const athletes = linkedAthletesForCurrentParent();
    return athletes.flatMap((athlete) =>
      clipsForUser(athlete.id).map((clip) => ({ athleteId: athlete.id, athleteName: athlete.fullName, clip }))
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
  if (isAdmin()) {
    const orgId = state.currentOrganization?.id ?? null;
    return orgId ? state.practices.filter((p) => p.organizationId === orgId) : [];
  }
  const orgIds = athleteOrgIds(state.currentUser);
  return state.practices.filter((p) => orgIds.includes(p.organizationId));
}

export function practiceRsvpStatus(practiceId, userId = state.currentUser?.id) {
  return state.practiceRsvps[`${userId}:${practiceId}`] ?? null;
}

export function setPracticeRsvp(practiceId, status) {
  if (!state.currentUser) return;
  state.practiceRsvps[`${state.currentUser.id}:${practiceId}`] = status;
  notify();
}

// ---------- Trust & safety: block / report ----------

function blockedIdsFor(userId) {
  return state.blockedByUser[userId] ?? [];
}

// Blocking is enforced as mutual even though it's stored one-directionally:
// if either person has blocked the other, they can't message, and neither
// shows up in the other's contact list. That matches how blocking actually
// needs to work — a blocked person shouldn't be able to just start a new
// thread to get around being blocked.
export function isBlockedPair(idA, idB) {
  return blockedIdsFor(idA).includes(idB) || blockedIdsFor(idB).includes(idA);
}

export function blockedUserIds(userId = state.currentUser?.id) {
  return blockedIdsFor(userId);
}

export function blockUser(otherUserId) {
  if (!state.currentUser) return;
  const mine = state.blockedByUser[state.currentUser.id] ?? [];
  if (!mine.includes(otherUserId)) state.blockedByUser[state.currentUser.id] = [...mine, otherUserId];
  notify();
}

export function unblockUser(otherUserId) {
  if (!state.currentUser) return;
  const mine = state.blockedByUser[state.currentUser.id] ?? [];
  state.blockedByUser[state.currentUser.id] = mine.filter((id) => id !== otherUserId);
  notify();
}

// Reports have nowhere to go without a backend — they surface directly to
// whichever coach(es) manage the reported person's team(s), and to a
// linked parent if the reported or reporting person is that parent's
// athlete, so a responsible adult actually sees them.
export function reportContent({ targetType, targetOwnerId, targetId, reason, note = '', contentSnapshot = '' }) {
  if (!state.currentUser) return;
  const report = makeReport({
    id: uuid(), reporterId: state.currentUser.id, targetType, targetOwnerId, targetId, reason, note, contentSnapshot,
  });
  state.reports.push(report);
  notify();
  return report;
}

// Reports a coach/admin should see: anything involving a member of a team
// they manage, either as the reported person or the reporter.
export function reportsVisibleToModerator() {
  if (!isAdmin() || !state.currentUser) return [];
  const managedOrgIds = state.currentUser.adminOrgIds ?? [];
  const managedMemberIds = new Set();
  managedOrgIds.forEach((orgId) => (state.rosterByOrg[orgId] ?? []).forEach((m) => managedMemberIds.add(m.id)));
  return state.reports
    .filter((r) => r.status === 'open' && (managedMemberIds.has(r.targetOwnerId) || managedMemberIds.has(r.reporterId)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function resolveReport(reportId) {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) return;
  report.status = 'resolved';
  notify();
}

// Best-effort display name for a user ID from whatever local directory
// data we have (roster seeds, org admin directory, the current session's
// own accounts). There's no real user directory without a backend, so a
// blocked person created in a different browser session may just show as
// "Member" — acceptable for a local-only demo, not something to overbuild.
export function directoryName(userId) {
  for (const orgId of Object.keys(state.rosterByOrg)) {
    const member = state.rosterByOrg[orgId].find((m) => m.id === userId);
    if (member) return member.fullName;
  }
  for (const orgId of Object.keys(ORG_ADMIN_DIRECTORY)) {
    const admin = ORG_ADMIN_DIRECTORY[orgId].find((a) => a.id === userId);
    if (admin) return admin.fullName;
  }
  if (state.currentUser?.id === userId) return state.currentUser.fullName;
  const conversation = state.conversations.find((c) => c.participantNames?.[userId]);
  if (conversation) return conversation.participantNames[userId];
  return 'Member';
}

// ---------- Direct messages ----------

// Who the current user is allowed to start a conversation with: athletes
// can message their teammates and the admin(s) who run their team; admins
// can message any athlete across every team they manage.
export function messageableContacts() {
  const user = state.currentUser;
  if (!user) return [];
  if (!isAdminVerified()) return []; // unverified admins can't message anyone at all

  let contacts;
  if (isAdmin()) {
    const ids = user.adminOrgIds ?? [];
    const seen = new Map();
    ids.forEach((orgId) => {
      (state.rosterByOrg[orgId] ?? []).forEach((m) => seen.set(m.id, m));
    });
    contacts = [...seen.values()];
  } else {
    const orgIds = athleteOrgIds(user);
    const seen = new Map();
    orgIds.forEach((orgId) => {
      (state.rosterByOrg[orgId] ?? []).forEach((m) => { if (m.id !== user.id) seen.set(m.id, m); });
      (ORG_ADMIN_DIRECTORY[orgId] ?? []).forEach((a) => seen.set(a.id, a));
    });
    contacts = [...seen.values()];
  }

  return contacts.filter((c) => !isBlockedPair(user.id, c.id));
}

// Athletes on OTHER teams than the ones this admin manages — e.g. a coach
// from a different club, or a recruiter-style contact. These are never an
// instant conversation: starting one always goes through sendMessageRequest
// and sits as a pending request until the athlete (or their linked parent)
// approves it. Blocked pairs are excluded here too.
export function requestableProspects() {
  const user = state.currentUser;
  if (!user || !isAdmin() || !isAdminVerified()) return [];
  const myOrgIds = new Set(user.adminOrgIds ?? []);
  const seen = new Map();
  Object.keys(state.rosterByOrg).forEach((orgId) => {
    if (myOrgIds.has(orgId)) return;
    (state.rosterByOrg[orgId] ?? []).forEach((m) => seen.set(m.id, m));
  });
  return [...seen.values()].filter((c) => !isBlockedPair(user.id, c.id));
}

function conversationKey(idA, idB) {
  return [idA, idB].sort().join('::');
}

export function getOrCreateConversation(otherUserId, otherUserName) {
  const user = state.currentUser;
  if (!user || !isAdminVerified()) return null;
  const existing = state.conversations.find((c) => conversationKey(...c.participantIds) === conversationKey(user.id, otherUserId));
  if (existing) return existing;
  const conversation = {
    id: uuid(),
    participantIds: [user.id, otherUserId],
    participantNames: { [user.id]: user.fullName, [otherUserId]: otherUserName },
    status: 'accepted',
    initiatorId: user.id,
  };
  state.conversations.push(conversation);
  state.messages[conversation.id] = [];
  notify();
  return conversation;
}

// Starts a conversation with someone outside the normal contact list (see
// requestableProspects) as a pending request rather than an open thread —
// the recipient (or their linked parent, for a minor) has to accept before
// either side can send anything further.
export function sendMessageRequest(otherUserId, otherUserName, initialText) {
  const user = state.currentUser;
  if (!user || !initialText.trim() || !isAdminVerified()) return null;
  const existing = state.conversations.find((c) => conversationKey(...c.participantIds) === conversationKey(user.id, otherUserId));
  if (existing) return existing;
  const conversation = {
    id: uuid(),
    participantIds: [user.id, otherUserId],
    participantNames: { [user.id]: user.fullName, [otherUserId]: otherUserName },
    status: 'pending',
    initiatorId: user.id,
  };
  state.conversations.push(conversation);
  state.messages[conversation.id] = [{
    id: uuid(), senderId: user.id, text: initialText.trim(), createdAt: new Date().toISOString(),
  }];
  notify();
  return conversation;
}

// Who's allowed to accept/decline a given pending request: the non-
// initiating participant, or — if that participant is a minor athlete —
// any parent linked to them. Request approval is always available to a
// linked parent regardless of the athlete's message-visibility toggle,
// since it's a safety control, not a content-visibility one.
function canModerateRequest(conversation, userId) {
  const otherId = conversation.participantIds.find((id) => id !== conversation.initiatorId);
  if (otherId === userId) return true;
  return state.familyLinks.some((l) => l.athleteId === otherId && l.parentId === userId);
}

export function pendingMessageRequestsForCurrentUser() {
  const user = state.currentUser;
  if (!user) return [];
  return state.conversations
    .filter((c) => c.status === 'pending' && c.initiatorId !== user.id && canModerateRequest(c, user.id))
    .map((c) => {
      const otherId = c.initiatorId;
      const subjectId = c.participantIds.find((id) => id !== c.initiatorId);
      const thread = state.messages[c.id] ?? [];
      return {
        conversation: c, otherId, otherName: c.participantNames?.[otherId] ?? 'Unknown',
        subjectId, subjectName: c.participantNames?.[subjectId] ?? 'Unknown',
        firstMessage: thread[0] ?? null,
      };
    })
    .sort((a, b) => new Date(b.firstMessage?.createdAt ?? 0) - new Date(a.firstMessage?.createdAt ?? 0));
}

export function acceptMessageRequest(conversationId) {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation || !canModerateRequest(conversation, state.currentUser?.id)) return;
  conversation.status = 'accepted';
  notify();
}

// Declining also blocks the initiator — a declined request means "I don't
// want to hear from this person," not just "not right now."
export function declineMessageRequest(conversationId) {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (!conversation || !canModerateRequest(conversation, state.currentUser?.id)) return;
  const recipientId = conversation.participantIds.find((id) => id !== conversation.initiatorId);
  const mine = state.blockedByUser[recipientId] ?? [];
  if (!mine.includes(conversation.initiatorId)) state.blockedByUser[recipientId] = [...mine, conversation.initiatorId];
  state.conversations = state.conversations.filter((c) => c.id !== conversationId);
  delete state.messages[conversationId];
  notify();
}

export function conversationsForCurrentUser() {
  const user = state.currentUser;
  if (!user) return [];
  return state.conversations
    .filter((c) => c.participantIds.includes(user.id) && c.status !== 'pending')
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
  if (!state.currentUser || !text.trim() || !isAdminVerified()) return;
  const conversation = state.conversations.find((c) => c.id === conversationId);
  // Can't message into a still-pending request (beyond the request itself)
  // or with someone either side has blocked.
  if (conversation?.status === 'pending') return;
  if (conversation && isBlockedPair(...conversation.participantIds)) return;
  const message = {
    id: uuid(),
    senderId: state.currentUser.id,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  const thread = state.messages[conversationId] ?? [];
  state.messages[conversationId] = [...thread, message];
  notify();
  // Sending into a thread implies you've seen everything in it up to now.
  markConversationRead(conversationId);
}

// ---------- Notifications / unread badges ----------
// There's no push here — this is all in-app state read on demand while the
// tab is open. See the comment block below for exactly which events a real
// backend-driven push system should hook into once one exists; this is the
// "would notify" list to build against, not a promise that push exists.

export function markConversationRead(conversationId) {
  if (!state.currentUser) return;
  state.lastReadAt[`${state.currentUser.id}:${conversationId}`] = new Date().toISOString();
  notify();
}

function isConversationUnread(entry) {
  if (!entry.lastMessage || entry.lastMessage.senderId === state.currentUser?.id) return false;
  const readAt = state.lastReadAt[`${state.currentUser?.id}:${entry.conversation.id}`];
  return !readAt || new Date(entry.lastMessage.createdAt) > new Date(readAt);
}

// Badge count for the Messages tab: unread conversations (for whichever
// role's own conversation list applies) plus any pending requests waiting
// on this user to accept/decline — a request always counts until acted on.
export function messagesBadgeCount() {
  if (!state.currentUser) return 0;
  if (isAdmin() && !isAdminVerified()) return 0; // nothing to surface if messaging is blocked anyway
  const requestCount = pendingMessageRequestsForCurrentUser().length;
  const ownEntries = isParent() ? conversationsForLinkedAthletes() : conversationsForCurrentUser();
  const unreadCount = ownEntries.filter(isConversationUnread).length;
  return requestCount + unreadCount;
}

// Badge count for the Team tab: open reports needing a coach's attention.
export function teamBadgeCount() {
  if (!isAdmin()) return 0;
  return reportsVisibleToModerator().length;
}

// PUSH NOTIFICATION HOOK POINTS (backend planning checklist)
// -----------------------------------------------------------
// None of these send anything today — this simply documents, at the one
// place notification-worthy events already funnel through (notify()),
// exactly which of them SHOULD trigger a real push once there's a backend
// to hold subscriptions and deliver them. When that exists, the natural
// approach is: server-side triggers on the same underlying events below
// (new message row inserted, new request row inserted, etc.), NOT a
// reimplementation of this client-side badge logic.
//
//   - New message received (sendMessage)               -> push to recipient
//   - New message request received (sendMessageRequest) -> push to recipient
//     (and to a linked parent, for a minor recipient)
//   - Message request accepted (acceptMessageRequest)    -> push to initiator
//   - Message request declined (declineMessageRequest)   -> push to initiator (optional — declining also blocks, so this one's arguably skippable)
//   - New report filed (reportContent)                   -> push to the relevant team's coach(es)
//   - Report resolved (resolveReport)                     -> optional, low priority
//   - Team invite code redeemed (addAdditionalTeam)        -> push to whoever issued the code
//   - Workout posted (createWorkout / commitBulkWorkouts)  -> push to assigned athletes (this one's arguably a digest/batched push, not instant, to avoid spamming a bulk upload of 20 workouts as 20 pushes)
//   - Verification submitted (submitVerificationRequest)   -> push to the (future) review team, not to any in-app user

// Read-only view for a linked parent who has message-sharing turned on by
// the athlete — never lets the parent send, only observe.
// Read-only view for a linked parent: conversations from every linked
// child who has message-sharing turned on — never lets the parent send,
// only observe. Each entry is tagged with which child it belongs to, since
// a parent can have more than one.
export function conversationsForLinkedAthletes() {
  const athletes = linkedAthletesForCurrentParent().filter((a) => a.shareMessages);
  return athletes.flatMap((athlete) =>
    state.conversations
      .filter((c) => c.participantIds.includes(athlete.id) && c.status !== 'pending')
      .map((c) => {
        const otherId = c.participantIds.find((id) => id !== athlete.id);
        const thread = state.messages[c.id] ?? [];
        const last = thread[thread.length - 1];
        return {
          conversation: c, otherId, otherName: c.participantNames?.[otherId] ?? 'Unknown',
          lastMessage: last ?? null, athleteId: athlete.id, athleteName: athlete.fullName,
        };
      })
  ).sort((a, b) => new Date(b.lastMessage?.createdAt ?? 0) - new Date(a.lastMessage?.createdAt ?? 0));
}
