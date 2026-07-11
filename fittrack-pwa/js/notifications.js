// Native browser Notifications API — no third-party push service required
// for local/scheduled reminders. For true push (server-initiated) you'd add
// a Push subscription + backend later; this covers on-device reminders.

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function notifyWorkoutReminder(workout) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification('Workout starting soon', {
    body: `${workout.title} — ${workout.sessionLength}`,
    icon: 'icons/icon-192.png',
  });
}
