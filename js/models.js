// Plain factory functions standing in for the Swift structs (User, Organization,
// Workout, Exercise, ExerciseLog). No classes needed — these are just typed
// shapes; the "type safety" lives in how consistently we call these factories.

// A single-use, personally issued code for attaching an ADDITIONAL team to
// an existing athlete account — distinct from the blanket team join codes
// used at signup. Only a coach/admin who manages that team, or the
// athlete's own linked parent (who has to already possess that team's
// blanket join code as proof of legitimate association), can mint one.
export function makeTeamInviteCode({ id, code, organizationId, issuedByUserId, issuedByName, issuedByRole, createdAt = new Date().toISOString(), redeemedByUserId = null, redeemedAt = null }) {
  return { id, code, organizationId, issuedByUserId, issuedByName, issuedByRole, createdAt, redeemedByUserId, redeemedAt };
}

// Deliberately shaped differently from the plain "RIVERSIDE24"-style team
// codes (dash, no vowel-heavy word), so it visually reads as a one-time
// personal invite rather than a roster-wide code someone might casually
// pass around.
export function randomInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let raw = '';
  for (let i = 0; i < 8; i++) raw += chars[Math.floor(Math.random() * chars.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function makeUser({ id, fullName, email, phone = '', dateOfBirth, role, organizationId = null, socialLinks = {}, bio = '' }) {
  return {
    id, fullName, email, phone, dateOfBirth, role, organizationId, bio,
    // Social handles/links shown on the profile. youtube is specifically
    // called out since athletes commonly post skill/progress videos there.
    socialLinks: {
      instagram: socialLinks.instagram || '',
      tiktok: socialLinks.tiktok || '',
      x: socialLinks.x || '',
      youtube: socialLinks.youtube || '',
      ...socialLinks,
    },
  };
}

// A parent/guardian's link to one athlete they follow. Kept as its own
// record (rather than a field on the parent user) so the athlete side of
// the relationship — whether they've opted to share message activity with
// this parent — can be looked up and changed independently.
export function makeFamilyLink({ id, parentId, athleteId, createdAt = new Date().toISOString(), shareMessages = false }) {
  return { id, parentId, athleteId, createdAt, shareMessages };
}

// A block or report action. Reports are stored locally since there's no
// backend/moderation server yet — a coach who manages the reported
// person's team can see and act on them (see reportsVisibleToModerator in
// store.js), which at least gets it in front of a responsible adult rather
// than disappearing into the void.
export function makeReport({ id, reporterId, targetType, targetOwnerId, targetId, reason, note = '', contentSnapshot = '', createdAt = new Date().toISOString(), status = 'open' }) {
  // targetType: 'message' | 'clip' | 'comment' | 'user'
  return { id, reporterId, targetType, targetOwnerId, targetId, reason, note, contentSnapshot, createdAt, status };
}

export const REPORT_REASONS = [
  'Harassment or bullying',
  'Inappropriate or unsafe content',
  'Spam or scam',
  'Impersonation',
  'Something else',
];

// A coach/admin's submission of identity/affiliation info for review.
// Nothing here actually approves anyone — there's no backend yet to hold
// a decision the applicant can't edit themselves, so this only ever
// collects the intake data. See store.js's isAdminVerified /
// setAdminVerifiedForTesting for exactly what that limitation means today.
export function makeVerificationRequest({ id, adminId, clubName, league = '', websiteUrl = '', note = '', submittedAt = new Date().toISOString() }) {
  return { id, adminId, clubName, league, websiteUrl, note, submittedAt };
}

// A single highlight/review clip an athlete has linked into their profile.
// Sourced from YouTube (embeddable) or game-camera systems like Veo/Trace
// (share-link only — those platforms don't support third-party embedding).
export function makeClip({ id, url, platform, title = '', addedAt = new Date().toISOString(), likes = [], reactions = {}, visibility = 'team' }) {
  // visibility: 'team' (default — only the athlete's own roster/coaches/
  // linked parent can see it) or 'shareable' (explicitly opted in to be
  // used in the not-yet-built share-to-social feature). Nothing is public
  // by default.
  return { id, url, platform, title, addedAt, likes, reactions, visibility };
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/i,
];

export function detectClipPlatform(url) {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('veo.co') || lower.includes('veoapp') || lower.includes('veocam')) return 'veo';
  if (lower.includes('trace') && (lower.includes('trace.gg') || lower.includes('tracecam') || lower.includes('sporttrace'))) return 'trace';
  if (lower.includes('hudl.com')) return 'hudl';
  return 'other';
}

export function youtubeVideoId(url) {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function userAge(user) {
  const dob = new Date(user.dateOfBirth);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export function makeOrganization({ id, name, sport, joinCode, memberIds = [], teamName = '' }) {
  return { id, name, sport, joinCode, memberIds, teamName };
}

// Readable auto-generated join code for a newly created team — based on
// the team name rather than fully random, so it's still easy for a coach
// to read aloud or type from memory, same spirit as the seeded demo codes
// (RIVERSIDE24, etc). Retries on an unlikely collision with an existing code.
export function generateJoinCode(baseName, existingCodes = []) {
  const base = (baseName || 'TEAM').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) || 'TEAM';
  const taken = new Set(existingCodes.map((c) => c.toUpperCase()));
  let code = `${base}${Math.floor(10 + Math.random() * 90)}`;
  let attempts = 0;
  while (taken.has(code) && attempts < 20) {
    code = `${base}${Math.floor(100 + Math.random() * 900)}`;
    attempts += 1;
  }
  return code;
}

export function organizationDisplayName(org) {
  if (!org) return '';
  return org.teamName ? `${org.name} — ${org.teamName}` : org.name;
}

// A practice/attendance event, typically synced from a 3rd-party team
// management tool (e.g. PlayMetrics, TeamSnap). Shown alongside workouts
// on the calendar so an athlete sees training + practice in one place.
export function makePracticeEvent({ id, title, date, durationMinutes = 90, location = '', organizationId = null, source = 'Team Schedule', rsvp = null }) {
  return { id, title, date, durationMinutes, location, organizationId, source, rsvp };
}

export function makeExercise({ id, name, block, prescribed, tutorialUrl = null }) {
  return { id, name, block, prescribed, tutorialUrl };
}

export function makeWorkout({ id, title, date, weekNumber, dayLabel, sessionLength, exercises, organizationId = null, assignedTo = 'all', createdBy = null, createdByVerified = true }) {
  // assignedTo: 'all' (everyone in the org) or an array of specific user IDs.
  // createdByVerified is a snapshot of the coach's verification status at
  // the moment this was posted — see isAdminVerified in store.js. It's a
  // snapshot rather than a live lookup because there's no real user
  // directory yet (only the current session's own account is ever fully
  // known); once a backend exists this should become a live lookup instead
  // so a workout's tag updates if the coach is later approved.
  return { id, title, date, weekNumber, dayLabel, sessionLength, exercises, organizationId, assignedTo, createdBy, createdByVerified };
}

export function isWorkoutVisibleToUser(workout, userId) {
  if (workout.assignedTo === 'all') return true;
  return Array.isArray(workout.assignedTo) && workout.assignedTo.includes(userId);
}

export const ROLES = {
  athlete: { label: 'Athlete', isAdmin: false },
  admin: { label: 'Coach / Club Admin', isAdmin: true },
  parent: { label: 'Parent / Guardian', isAdmin: false },
};

export function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function makeExerciseLog({ id, exerciseId, workoutId, userId, exerciseName = '', block = '', weightUsed = null, rpe = null, timeOrRecord = null, notes = '', isShared = false, completedAt = new Date().toISOString() }) {
  return { id, exerciseId, workoutId, userId, exerciseName, block, weightUsed, rpe, timeOrRecord, notes, isShared, completedAt };
}

// Which data fields make sense to collect for a given exercise category —
// mirrors the original tracker spreadsheet: Strength gets weight + RPE,
// Agility/Ball Skills/Technical get a time or record instead of weight.
// Warm-up/Recovery collect no performance metric, just optional notes.
export const BLOCK_LOG_FIELDS = {
  'Warm-up': [],
  'Strength': ['weight', 'rpe'],
  'Agility': ['record', 'rpe'],
  'Ball Skills': ['record', 'rpe'],
  'Technical': ['record', 'rpe'],
  'Recovery': [],
};

export const BLOCKS = ['Warm-up', 'Strength', 'Agility', 'Ball Skills', 'Technical', 'Recovery'];

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now();
}
