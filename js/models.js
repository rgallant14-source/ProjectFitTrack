// Plain factory functions standing in for the Swift structs (User, Organization,
// Workout, Exercise, ExerciseLog). No classes needed — these are just typed
// shapes; the "type safety" lives in how consistently we call these factories.

export function makeUser({ id, fullName, email, dateOfBirth, role, organizationId = null, socialLinks = {}, bio = '' }) {
  return {
    id, fullName, email, dateOfBirth, role, organizationId, bio,
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

// A single highlight/review clip an athlete has linked into their profile.
// Sourced from YouTube (embeddable) or game-camera systems like Veo/Trace
// (share-link only — those platforms don't support third-party embedding).
export function makeClip({ id, url, platform, title = '', addedAt = new Date().toISOString(), likes = [], reactions = {} }) {
  return { id, url, platform, title, addedAt, likes, reactions };
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

export function makeWorkout({ id, title, date, weekNumber, dayLabel, sessionLength, exercises, organizationId = null, assignedTo = 'all', createdBy = null }) {
  // assignedTo: 'all' (everyone in the org) or an array of specific user IDs.
  return { id, title, date, weekNumber, dayLabel, sessionLength, exercises, organizationId, assignedTo, createdBy };
}

export function isWorkoutVisibleToUser(workout, userId) {
  if (workout.assignedTo === 'all') return true;
  return Array.isArray(workout.assignedTo) && workout.assignedTo.includes(userId);
}

export const ROLES = {
  athlete: { label: 'Athlete', isAdmin: false },
  admin: { label: 'Coach / Club / Parent Admin', isAdmin: true },
};

export function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function makeExerciseLog({ id, exerciseId, workoutId, userId, weightUsed = null, rpe = null, timeOrRecord = null, notes = '', isShared = false, completedAt = new Date().toISOString() }) {
  return { id, exerciseId, workoutId, userId, weightUsed, rpe, timeOrRecord, notes, isShared, completedAt };
}

export const BLOCKS = ['Warm-up', 'Strength', 'Agility', 'Ball Skills', 'Technical', 'Recovery'];

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now();
}
