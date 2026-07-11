import { subscribe, getState, navigate, isAdmin } from './store.js';
import { renderOnboarding } from './views/onboarding.js';
import { renderAgeVerification } from './views/ageVerification.js';
import { renderSignUp } from './views/signup.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCalendar } from './views/calendar.js';
import { renderProfile } from './views/profile.js';
import { renderWorkoutDetail } from './views/workoutDetail.js';
import { renderOrgJoin } from './views/orgJoin.js';
import { renderTeam } from './views/team.js';
import { renderWorkoutForm } from './views/workoutForm.js';
import { renderAthleteProgress } from './views/athleteProgress.js';
import { renderEditProfile } from './views/editProfile.js';
import { renderClips } from './views/clips.js';
import { renderMessages } from './views/messages.js';
import { renderProgressHistory } from './views/progressHistory.js';

const appEl = document.getElementById('app');
const tabBar = document.getElementById('tab-bar');
const teamTabBtn = document.getElementById('tab-team');

// `authScreen` tracks where we are in the unauthenticated flow (onboarding
// -> age verification -> sign up, or -> log in). Once store.isAuthenticated
// flips true, we stop consulting this and render the tab-based app instead.
let authScreen = 'onboarding';

function renderAuthedApp() {
  const state = getState();
  document.body.dataset.authed = 'true';

  // The Team tab only exists for admins — athletes never see it.
  teamTabBtn.style.display = isAdmin() ? 'flex' : 'none';
  if (!isAdmin() && state.route === 'team') navigate('dashboard');

  [...tabBar.querySelectorAll('.tab-btn')].forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === state.route);
  });

  if (state.route === 'dashboard') {
    renderDashboard(appEl, { onOpenWorkout: openWorkout });
  } else if (state.route === 'calendar') {
    renderCalendar(appEl, { onOpenWorkout: openWorkout });
  } else if (state.route === 'clips') {
    renderClips(appEl);
  } else if (state.route === 'team') {
    renderTeam(appEl, { onNewWorkout: openWorkoutForm, onOpenAthlete: openAthleteProgress });
  } else if (state.route === 'messages') {
    renderMessages(appEl);
  } else if (state.route === 'profile') {
    renderProfile(appEl, { onJoinOrg: openOrgJoin, onEditProfile: openEditProfile, onViewHistory: openProgressHistory });
  }
}

function openWorkout(workout) {
  renderWorkoutDetail(appEl, workout, {
    onClose: () => render(), // re-render current tab underneath
  });
}

function openWorkoutForm() {
  renderWorkoutForm(appEl, {
    onDone: () => render(),
    onCancel: () => render(),
  });
}

function openAthleteProgress(member) {
  renderAthleteProgress(appEl, member, {
    onClose: () => render(),
  });
}

function openProgressHistory() {
  renderProgressHistory(appEl, { onClose: () => render() });
}

function openEditProfile(initialTab = 'profile') {
  const wrapper = document.body.appendChild(document.createElement('div'));
  const cleanup = () => { wrapper.remove(); render(); };
  renderEditProfile(wrapper, { onDone: cleanup, onClose: cleanup, initialTab });
}

function openOrgJoin() {
  const wrapper = document.body.appendChild(document.createElement('div'));
  const cleanup = () => { wrapper.remove(); render(); };
  renderOrgJoin(wrapper, { onDone: cleanup, onClose: cleanup });
}

function renderUnauthedApp() {
  document.body.dataset.authed = 'false';
  if (authScreen === 'onboarding') {
    renderOnboarding(appEl, {
      onSignUp: () => { authScreen = 'ageVerify'; render(); },
      onLogIn: () => { authScreen = 'login'; render(); },
    });
  } else if (authScreen === 'ageVerify') {
    renderAgeVerification(appEl, {
      onVerified: () => { authScreen = 'signup'; render(); },
      onBack: () => { authScreen = 'onboarding'; render(); },
    });
  } else if (authScreen === 'signup') {
    renderSignUp(appEl, { onDone: () => render() }); // store flips isAuthenticated -> renderAuthedApp takes over
  } else if (authScreen === 'login') {
    renderLogin(appEl, {
      onDone: () => render(),
      onBack: () => { authScreen = 'onboarding'; render(); },
    });
  }
}

function render() {
  const state = getState();
  if (state.isAuthenticated) {
    renderAuthedApp();
  } else {
    renderUnauthedApp();
  }
}

// Tab bar wiring — bottom tab-based navigation per design spec.
tabBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  navigate(btn.dataset.route);
});

subscribe(render);
render();

// Register service worker for installability + offline app shell caching.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
