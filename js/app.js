import { subscribe, getState, navigate, isAdmin, isParent, signUp, clearError } from './store.js';
import { renderOnboarding } from './views/onboarding.js';
import { renderAgeVerification } from './views/ageVerification.js';
import { renderSignUp } from './views/signup.js';
import { renderVerifyCode } from './views/verifyCode.js';
import { renderAthletePicker } from './views/athletePicker.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderParentHome } from './views/parentHome.js';
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
import { renderAddTeam } from './views/addTeam.js';
import { renderGenerateInvite } from './views/generateInvite.js';
import { renderBulkUpload } from './views/bulkUpload.js';
import { renderCreateTeam } from './views/createTeam.js';

const appEl = document.getElementById('app');
const tabBar = document.getElementById('tab-bar');
const teamTabBtn = document.getElementById('tab-team');
const calendarTabBtn = tabBar.querySelector('[data-route="calendar"]');

// `authScreen` tracks where we are in the unauthenticated flow:
// onboarding -> signup (details + team code) -> ageVerify (athletes only)
// -> verifyCode (everyone) -> account created. Once store.isAuthenticated
// flips true, we stop consulting this and render the tab-based app.
let authScreen = 'onboarding';
// Holds { fullName, email, phone, role, organizationId } between the
// signup details step and the screens that follow it — cleared once the
// account is actually created (or if the person backs all the way out).
let pendingSignup = null;

function renderAuthedApp() {
  const state = getState();
  document.body.dataset.authed = 'true';

  // The Team tab only exists for admins — athletes/parents never see it.
  teamTabBtn.style.display = isAdmin() ? 'flex' : 'none';
  if (!isAdmin() && state.route === 'team') navigate('dashboard');

  // Parents get a read-only Family view instead of a real calendar — there's
  // no meaningful "assigned to me" schedule for a parent account.
  calendarTabBtn.style.display = isParent() ? 'none' : 'flex';
  if (isParent() && state.route === 'calendar') navigate('dashboard');

  [...tabBar.querySelectorAll('.tab-btn')].forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === state.route);
  });

  if (state.route === 'dashboard') {
    if (isParent()) renderParentHome(appEl);
    else renderDashboard(appEl, { onOpenWorkout: openWorkout });
  } else if (state.route === 'calendar') {
    renderCalendar(appEl, { onOpenWorkout: openWorkout });
  } else if (state.route === 'clips') {
    renderClips(appEl);
  } else if (state.route === 'team') {
    renderTeam(appEl, { onNewWorkout: openWorkoutForm, onOpenAthlete: openAthleteProgress, onGenerateInvite: openGenerateInvite, onBulkUpload: openBulkUpload, onCreateTeam: openCreateTeam });
  } else if (state.route === 'messages') {
    renderMessages(appEl);
  } else if (state.route === 'profile') {
    renderProfile(appEl, {
      onJoinOrg: openOrgJoin, onEditProfile: openEditProfile, onViewHistory: openProgressHistory,
      onAddTeam: openAddTeam, onGenerateInvite: openGenerateInvite, onCreateTeam: openCreateTeam,
    });
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

function openAddTeam() {
  const wrapper = document.body.appendChild(document.createElement('div'));
  const cleanup = () => { wrapper.remove(); render(); };
  renderAddTeam(wrapper, { onDone: cleanup, onClose: cleanup });
}

function openGenerateInvite() {
  const wrapper = document.body.appendChild(document.createElement('div'));
  const cleanup = () => { wrapper.remove(); render(); };
  renderGenerateInvite(wrapper, { onClose: cleanup });
}

function openBulkUpload() {
  const wrapper = document.body.appendChild(document.createElement('div'));
  const cleanup = () => { wrapper.remove(); render(); };
  renderBulkUpload(wrapper, { onDone: cleanup, onClose: cleanup });
}

function openCreateTeam() {
  const wrapper = document.body.appendChild(document.createElement('div'));
  const cleanup = () => { wrapper.remove(); render(); };
  renderCreateTeam(wrapper, { onDone: cleanup, onClose: cleanup });
}

// Shown once, right after a brand-new parent account is created — the
// team was already validated by join code at signup, so this just needs
// picking which athlete on that roster is theirs, with no way to dismiss
// it into a half-set-up account (no onClose — closing lands them on their
// empty Family tab, where "+ Link Your Athlete" reopens this same step).
function openAthletePickerAfterSignup() {
  const wrapper = document.body.appendChild(document.createElement('div'));
  renderAthletePicker(wrapper, { onDone: () => { wrapper.remove(); render(); } });
}

function renderUnauthedApp() {
  document.body.dataset.authed = 'false';
  if (authScreen === 'onboarding') {
    renderOnboarding(appEl, {
      onSignUp: () => { authScreen = 'signup'; render(); },
      onLogIn: () => { authScreen = 'login'; render(); },
    });
  } else if (authScreen === 'signup') {
    renderSignUp(appEl, {
      onDetailsReady: (details) => {
        clearError();
        pendingSignup = details;
        authScreen = details.role === 'athlete' ? 'ageVerify' : 'verifyCode';
        render();
      },
    });
  } else if (authScreen === 'ageVerify') {
    renderAgeVerification(appEl, {
      onVerified: () => { authScreen = 'verifyCode'; render(); },
      onBack: () => { authScreen = 'signup'; render(); },
    });
  } else if (authScreen === 'verifyCode') {
    renderVerifyCode(appEl, {
      ...pendingSignup,
      onVerified: async (result) => {
        await signUp(result);
        const wasParent = result.role === 'parent';
        pendingSignup = null;
        authScreen = 'onboarding';
        // signUp()'s own notify() flips isAuthenticated and re-renders via
        // the store subscription into the authed app; for a brand-new
        // parent we then layer the athlete-picker sheet on top of that.
        if (wasParent) openAthletePickerAfterSignup();
      },
      onBack: () => {
        authScreen = pendingSignup?.role === 'athlete' ? 'ageVerify' : 'signup';
        render();
      },
    });
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
