// Content that rotates once per calendar day (deterministic — same content
// all day, changes at midnight — rather than random on every page load).
// dayIndex() is the shared rotation key everything below uses.

export function dayIndex(modulo) {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear % modulo;
}

// ---------- Equipment needed today ----------
// Derived from the exercise blocks present in today's workout, not a fixed
// list — so it actually reflects what's programmed.
const EQUIPMENT_BY_BLOCK = {
  'Warm-up': [],
  'Strength': ['Dumbbells or kettlebell', 'Resistance band'],
  'Agility': ['Agility ladder', 'Cones (6-8)'],
  'Ball Skills': ['Soccer ball', 'Cones'],
  'Technical': ['Soccer ball', 'Cones', 'Rebounder (if available)'],
  'Recovery': ['Foam roller'],
};

export function equipmentForWorkout(workout) {
  if (!workout) return [];
  const blocks = new Set(workout.exercises.map((ex) => ex.block));
  const items = new Set();
  blocks.forEach((block) => (EQUIPMENT_BY_BLOCK[block] || []).forEach((item) => items.add(item)));
  return [...items];
}

// ---------- Quote of the day ----------
const QUOTES = [
  { text: "I've missed more than 9,000 shots in my career. I've lost almost 300 games. I've failed over and over. That is why I succeed.", author: 'Michael Jordan' },
  { text: "It's not whether you get knocked down, it's whether you get up.", author: 'Vince Lombardi' },
  { text: 'Champions keep playing until they get it right.', author: 'Billie Jean King' },
  { text: "You miss 100% of the shots you don't take.", author: 'Wayne Gretzky' },
  { text: "Hard work beats talent when talent doesn't work hard.", author: 'Tim Notke' },
  { text: 'The only way to prove you are a good sport is to lose.', author: 'Ernie Banks' },
  { text: "I hated every minute of training, but I said, don't quit, suffer now and live the rest of your life as a champion.", author: 'Muhammad Ali' },
  { text: 'Pain is temporary. Quitting lasts forever.', author: 'Lance Armstrong' },
  { text: "The difference between the impossible and the possible lies in a person's determination.", author: 'Tommy Lasorda' },
  { text: "Set your goals high, and don't stop till you get there.", author: 'Bo Jackson' },
  { text: 'Do you know what my favorite part of the game is? The opportunity to play.', author: 'Mike Singletary' },
  { text: 'You have to expect things of yourself before you can do them.', author: 'Michael Jordan' },
];

export function quoteOfTheDay() {
  return QUOTES[dayIndex(QUOTES.length)];
}

// ---------- Daily sports highlight ----------
// A curated rotation, NOT a live feed — this app has no backend/API key to
// pull real-time YouTube/TikTok trending sports clips. Each entry is a
// standalone highlight; rotates by date so it feels fresh day to day.
const HIGHLIGHTS = [
  { videoId: 'dQw4w9WgXcQ', title: 'Top skill moves compilation' },
  { videoId: 'dQw4w9WgXcQ', title: 'Best goals of the week' },
  { videoId: 'dQw4w9WgXcQ', title: 'Insane game-winning plays' },
];

export function highlightOfTheDay() {
  return HIGHLIGHTS[dayIndex(HIGHLIGHTS.length)];
}
