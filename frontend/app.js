// State object
const state = {
  sessionId: null,
  currentInterval: null,
  score: { correct: 0, total: 0 },
  audioCtx: null,
  answered: false,
  intervalStats: {},
};

// Key Signatures state object
const keySigState = {
  sessionId: null,
  currentKey: null,
  score: { correct: 0, total: 0 },
  answered: false,
  keyStats: {},
};

// Interval names in order
const INTERVALS = [
  'P1', 'm2', 'M2', 'm3', 'M3', 'P4',
  'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'
];

// Key signatures (all 15 major keys)
const KEY_SIGNATURES = [
  'Ab', 'A', 'Bb', 'B', 'Cb', 'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G'
];

// Fetch wrapper with error checking
async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

// Screen navigation
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

// Web Audio tone generation with envelope
function playTone(frequency, startTime, duration = 0.8) {
  const ctx = state.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, startTime);

  // Envelope: short attack, sustain, short release to avoid clicks
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
  gain.gain.setValueAtTime(0.4, startTime + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Play two notes sequentially (0.2s gap between them)
function playInterval(rootFreq, secondFreq) {
  const ctx = state.audioCtx || (state.audioCtx = new AudioContext());
  const now = ctx.currentTime;
  playTone(rootFreq, now, 0.8);
  playTone(secondFreq, now + 1.0, 0.8);
}

// Build the 13 interval buttons
function buildIntervalButtons() {
  const container = document.getElementById('interval-buttons');
  INTERVALS.forEach(name => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.className = 'interval-btn';
    btn.dataset.interval = name;
    btn.addEventListener('click', () => handleAnswer(name));
    container.appendChild(btn);
  });
}

// Start a new session
async function startSession() {
  try {
    const data = await apiFetch('/api/session', { method: 'POST' });
    state.sessionId = data.session_id;
    state.score = { correct: 0, total: 0 };
    updateScoreDisplay();
    await loadNextInterval();
  } catch {
    alert('Failed to start session. Check your connection.');
    showScreen('menu');
  }
}

// Load the next interval and auto-play
async function loadNextInterval() {
  state.answered = false;
  clearFeedback();
  setIntervalButtonsEnabled(false);

  try {
    state.currentInterval = await apiFetch('/api/interval');
    document.getElementById('btn-play').disabled = false;
    // Auto-play on load for smooth flow
    await triggerPlay();
  } catch {
    document.getElementById('btn-play').disabled = false;
  }
}

// Play the current interval
async function triggerPlay() {
  if (!state.currentInterval) return;
  document.getElementById('btn-play').disabled = true;
  playInterval(state.currentInterval.root_freq, state.currentInterval.second_freq);
  // Enable answer buttons and replay button after both notes have played (~1.8s)
  setTimeout(() => {
    setIntervalButtonsEnabled(true);
    document.getElementById('btn-play').disabled = false;
  }, 1900);
}

// Handle user's interval guess
async function handleAnswer(userAnswer) {
  if (state.answered) return;
  state.answered = true;
  setIntervalButtonsEnabled(false);
  document.getElementById('btn-play').disabled = true;

  try {
    const data = await apiFetch(`/api/session/${state.sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interval_name: state.currentInterval.interval_name,
        user_answer: userAnswer,
      }),
    });

    state.score.correct = data.correct_count;
    state.score.total = data.total;
    const stats = state.intervalStats[state.currentInterval.interval_name];
    stats.attempted++;
    if (data.correct) stats.correct++;
    updateScoreDisplay();
    showFeedback(data.correct, state.currentInterval.interval_name);

    // Auto-advance after 1.5s
    setTimeout(loadNextInterval, 1500);
  } catch {
    state.answered = false;
    setIntervalButtonsEnabled(true);
    document.getElementById('btn-play').disabled = false;
  }
}

// Quit and return to menu
function quit() {
  state.sessionId = null;
  state.currentInterval = null;
  showScreen('menu');
}

// Helper functions
function updateScoreDisplay() {
  document.getElementById('score-display').textContent =
    `${state.score.correct} / ${state.score.total}`;
}

function showFeedback(correct, correctName) {
  const el = document.getElementById('feedback');
  el.className = 'feedback ' + (correct ? 'correct' : 'wrong');
  el.textContent = correct ? 'Correct!' : `Wrong — it was ${correctName}`;
}

function clearFeedback() {
  const el = document.getElementById('feedback');
  el.className = 'feedback hidden';
  el.textContent = '';
}

function setIntervalButtonsEnabled(enabled) {
  document.querySelectorAll('.interval-btn').forEach(btn => {
    btn.disabled = !enabled;
  });
}

function showStatsScreen() {
  function renderStats(containerId, keys, statsMap) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    keys.forEach(name => {
      const s = statsMap[name] || { correct: 0, attempted: 0 };
      const pct = s.attempted === 0 ? '—' : Math.round(s.correct / s.attempted * 100) + '%';
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span class="stat-label">${name}</span><span class="stat-value">${s.correct} / ${s.attempted} = ${pct}</span>`;
      container.appendChild(row);
    });
  }
  renderStats('interval-stats', INTERVALS, state.intervalStats);
  renderStats('keysig-stats', KEY_SIGNATURES, keySigState.keyStats);
  showScreen('stats');
}

// ============================================
// Key Signatures Game Functions
// ============================================

// Render a key signature on a treble clef staff using VexFlow
function renderKeySignature(keyName) {
  const container = document.getElementById('keysig-staff');
  container.innerHTML = '';

  const { Renderer, Stave } = Vex.Flow;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(320, 120);
  const context = renderer.getContext();

  const stave = new Stave(10, 20, 290);
  stave.addClef('treble').addKeySignature(keyName);
  stave.setContext(context).draw();
}

// Build the 15 key signature buttons
function buildKeySigButtons() {
  const container = document.getElementById('keysig-buttons');
  KEY_SIGNATURES.forEach(name => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.className = 'keysig-btn';
    btn.dataset.key = name;
    btn.addEventListener('click', () => handleKeySigAnswer(name));
    container.appendChild(btn);
  });
}

// Start a new key signature session
async function startKeySigSession() {
  try {
    const data = await apiFetch('/api/keysig-session', { method: 'POST' });
    keySigState.sessionId = data.session_id;
    keySigState.score = { correct: 0, total: 0 };
    updateKeySigScoreDisplay();
    await loadNextKey();
  } catch {
    alert('Failed to start session. Check your connection.');
    showScreen('menu');
  }
}

// Load the next key signature
async function loadNextKey() {
  keySigState.answered = false;
  clearKeySigFeedback();
  setKeySigButtonsEnabled(false);

  try {
    let key;
    do {
      const data = await apiFetch('/api/keysig');
      key = data.key_name;
    } while (key === keySigState.currentKey);
    keySigState.currentKey = key;

    renderKeySignature(keySigState.currentKey);
    setKeySigButtonsEnabled(true);
  } catch {
    setKeySigButtonsEnabled(true);
  }
}

// Handle user's key signature guess
async function handleKeySigAnswer(userAnswer) {
  if (keySigState.answered) return;
  keySigState.answered = true;
  setKeySigButtonsEnabled(false);

  try {
    const data = await apiFetch(`/api/keysig-session/${keySigState.sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key_name: keySigState.currentKey,
        user_answer: userAnswer,
      }),
    });

    keySigState.score.correct = data.correct_count;
    keySigState.score.total = data.total;
    const stats = keySigState.keyStats[keySigState.currentKey];
    stats.attempted++;
    if (data.correct) stats.correct++;
    updateKeySigScoreDisplay();
    showKeySigFeedback(data.correct, keySigState.currentKey);

    // Auto-advance after 1.5s
    setTimeout(loadNextKey, 1500);
  } catch {
    keySigState.answered = false;
    setKeySigButtonsEnabled(true);
  }
}

// Quit key signatures and return to menu
function quitKeySig() {
  keySigState.sessionId = null;
  keySigState.currentKey = null;
  showScreen('menu');
}

// Helper functions for key signatures
function updateKeySigScoreDisplay() {
  document.getElementById('keysig-score-display').textContent =
    `${keySigState.score.correct} / ${keySigState.score.total}`;
}

function showKeySigFeedback(correct, correctName) {
  const el = document.getElementById('keysig-feedback');
  el.className = 'feedback ' + (correct ? 'correct' : 'wrong');
  el.textContent = correct ? 'Correct!' : `Wrong — it was ${correctName}`;
}

function clearKeySigFeedback() {
  const el = document.getElementById('keysig-feedback');
  el.className = 'feedback hidden';
  el.textContent = '';
}

function setKeySigButtonsEnabled(enabled) {
  document.querySelectorAll('.keysig-btn').forEach(btn => {
    btn.disabled = !enabled;
  });
}


// Load all-time stats from DB and seed in-memory stats objects
async function loadAllTimeStats() {
  try {
    const data = await apiFetch('/api/stats');
    INTERVALS.forEach(name => {
      state.intervalStats[name] = data.intervals[name] || { correct: 0, attempted: 0 };
    });
    KEY_SIGNATURES.forEach(name => {
      keySigState.keyStats[name] = data.key_signatures[name] || { correct: 0, attempted: 0 };
    });
  } catch {
    INTERVALS.forEach(name => {
      state.intervalStats[name] = { correct: 0, attempted: 0 };
    });
    KEY_SIGNATURES.forEach(name => {
      keySigState.keyStats[name] = { correct: 0, attempted: 0 };
    });
  }
}

// Event wiring and initialization
document.addEventListener('DOMContentLoaded', async () => {
  buildIntervalButtons();
  buildKeySigButtons();
  await loadAllTimeStats();

  // Menu button to start interval training
  document.querySelector('[data-screen="interval"]').addEventListener('click', async () => {
    showScreen('interval');
    await startSession();
  });

  // Menu button to start key signatures training
  document.querySelector('[data-screen="keysig"]').addEventListener('click', async () => {
    showScreen('keysig');
    await startKeySigSession();
  });

  document.getElementById('btn-show-stats').addEventListener('click', showStatsScreen);
  document.getElementById('btn-stats-back').addEventListener('click', () => showScreen('menu'));
  document.getElementById('btn-stats-reset').addEventListener('click', async () => {
    if (!confirm('Reset all stats? This cannot be undone.')) return;
    try {
      await apiFetch('/api/stats', { method: 'DELETE' });
      await loadAllTimeStats();
      showStatsScreen();
    } catch {
      alert('Failed to reset stats.');
    }
  });
  document.getElementById('btn-play').addEventListener('click', triggerPlay);
  document.getElementById('btn-quit').addEventListener('click', quit);
  document.getElementById('btn-keysig-quit').addEventListener('click', quitKeySig);
});
