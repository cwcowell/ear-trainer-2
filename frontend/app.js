// State
const state = {
  currentInterval: null,
  score: { correct: 0, total: 0 },
  audioCtx: null,
  answered: false,
  waveform: 'square',
};

const keySigState = {
  currentKey: null,
  score: { correct: 0, total: 0 },
  answered: false,
};

const INTERVALS = [
  { name: 'm2', semitones: 1 },
  { name: 'M2', semitones: 2 },
  { name: 'm3', semitones: 3 },
  { name: 'M3', semitones: 4 },
  { name: 'P4', semitones: 5 },
  { name: 'TT', semitones: 6 },
  { name: 'P5', semitones: 7 },
  { name: 'm6', semitones: 8 },
  { name: 'M6', semitones: 9 },
  { name: 'm7', semitones: 10 },
  { name: 'M7', semitones: 11 },
  { name: 'P8', semitones: 12 },
];

const KEY_SIGNATURES = [
  'Ab', 'A', 'Bb', 'B', 'Cb', 'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G'
];

// Chromatic C3–C5; keeps second notes below ~4 kHz
const ROOT_NOTES_HZ = [
  130.81, 138.59, 146.83, 155.56, 164.81, 174.61,
  185.00, 196.00, 207.65, 220.00, 233.08, 246.94,
  261.63, 277.18, 293.66, 311.13, 329.63, 349.23,
  369.99, 392.00, 415.30, 440.00, 466.16, 493.88,
  523.25,
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickInterval() {
  const root = randomChoice(ROOT_NOTES_HZ);
  const { name, semitones } = randomChoice(INTERVALS);
  let first = root;
  let second = root * Math.pow(2, semitones / 12);
  if (Math.random() < 0.5) [first, second] = [second, first];
  return { firstFreq: first, secondFreq: second, name };
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

  osc.type = state.waveform;
  osc.frequency.setValueAtTime(frequency, startTime);

  // Envelope: short attack, sustain, short release to avoid clicks
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
  gain.gain.setValueAtTime(0.4, startTime + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playInterval(firstFreq, secondFreq) {
  const ctx = state.audioCtx || (state.audioCtx = new AudioContext());
  const now = ctx.currentTime;
  playTone(firstFreq, now, 0.8);
  playTone(secondFreq, now + 1.0, 0.8);
}

function buildIntervalButtons() {
  const container = document.getElementById('interval-buttons');
  INTERVALS.forEach(({ name }) => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.className = 'interval-btn';
    btn.dataset.interval = name;
    btn.addEventListener('click', () => handleAnswer(name));
    container.appendChild(btn);
  });
}

function startSession() {
  state.score = { correct: 0, total: 0 };
  updateScoreDisplay();
  loadNextInterval();
}

function loadNextInterval() {
  state.answered = false;
  setIntervalButtonsEnabled(false);
  state.currentInterval = pickInterval();
  document.getElementById('btn-play').disabled = false;
  triggerPlay();
}

function triggerPlay() {
  if (!state.currentInterval) return;
  document.getElementById('btn-play').disabled = true;
  playInterval(state.currentInterval.firstFreq, state.currentInterval.secondFreq);
  setTimeout(() => {
    setIntervalButtonsEnabled(true);
    document.getElementById('btn-play').disabled = false;
  }, 1900);
}

function handleAnswer(userAnswer) {
  if (state.answered) return;
  state.answered = true;
  setIntervalButtonsEnabled(false);
  document.getElementById('btn-play').disabled = true;

  const correct = userAnswer === state.currentInterval.name;
  if (correct) state.score.correct++;
  state.score.total++;
  updateScoreDisplay();

  if (correct) {
    const btn = document.querySelector(`.interval-btn[data-interval="${userAnswer}"]`);
    if (btn) btn.classList.add('flash-correct');
    setTimeout(() => {
      if (btn) btn.classList.remove('flash-correct');
      loadNextInterval();
    }, 900);
  } else {
    const wrongBtn = document.querySelector(`.interval-btn[data-interval="${userAnswer}"]`);
    const correctBtn = document.querySelector(`.interval-btn[data-interval="${state.currentInterval.name}"]`);
    if (wrongBtn) wrongBtn.classList.add('flash-wrong');
    if (correctBtn) correctBtn.classList.add('flash-correct');
    setTimeout(() => {
      if (wrongBtn) wrongBtn.classList.remove('flash-wrong');
      if (correctBtn) correctBtn.classList.remove('flash-correct');
    }, 2000);
    setTimeout(loadNextInterval, 2700);
  }
}

function quit() {
  state.currentInterval = null;
  showScreen('menu');
}

function updateScoreDisplay() {
  document.getElementById('score-display').textContent =
    `${state.score.correct} / ${state.score.total}`;
}

function setIntervalButtonsEnabled(enabled) {
  document.querySelectorAll('.interval-btn').forEach(btn => {
    btn.disabled = !enabled;
  });
}

// Key Signatures

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

function startKeySigSession() {
  keySigState.score = { correct: 0, total: 0 };
  updateKeySigScoreDisplay();
  loadNextKey();
}

function loadNextKey() {
  let key;
  do {
    key = randomChoice(KEY_SIGNATURES);
  } while (key === keySigState.currentKey);
  keySigState.currentKey = key;
  renderKeySignature(key);
  keySigState.answered = false;
}

function handleKeySigAnswer(userAnswer) {
  if (keySigState.answered) return;
  keySigState.answered = true;

  const correct = userAnswer === keySigState.currentKey;
  if (correct) keySigState.score.correct++;
  keySigState.score.total++;
  updateKeySigScoreDisplay();

  if (correct) {
    const btn = document.querySelector(`.keysig-btn[data-key="${userAnswer}"]`);
    if (btn) btn.classList.add('flash-correct');
    setTimeout(() => {
      if (btn) btn.classList.remove('flash-correct');
      loadNextKey();
    }, 900);
  } else {
    const wrongBtn = document.querySelector(`.keysig-btn[data-key="${userAnswer}"]`);
    const correctBtn = document.querySelector(`.keysig-btn[data-key="${keySigState.currentKey}"]`);
    if (wrongBtn) wrongBtn.classList.add('flash-wrong');
    if (correctBtn) correctBtn.classList.add('flash-correct');
    setTimeout(() => {
      if (wrongBtn) wrongBtn.classList.remove('flash-wrong');
      if (correctBtn) correctBtn.classList.remove('flash-correct');
    }, 2000);
    setTimeout(loadNextKey, 2700);
  }
}

function quitKeySig() {
  keySigState.currentKey = null;
  showScreen('menu');
}

function updateKeySigScoreDisplay() {
  document.getElementById('keysig-score-display').textContent =
    `${keySigState.score.correct} / ${keySigState.score.total}`;
}

// Event wiring
document.addEventListener('DOMContentLoaded', () => {
  buildIntervalButtons();
  buildKeySigButtons();

  document.querySelector('[data-screen="interval"]').addEventListener('click', () => {
    showScreen('interval');
    startSession();
  });

  document.querySelector('[data-screen="keysig"]').addEventListener('click', () => {
    showScreen('keysig');
    startKeySigSession();
  });

  document.getElementById('btn-play').addEventListener('click', triggerPlay);
  document.getElementById('btn-quit').addEventListener('click', quit);
  document.getElementById('btn-waveform').addEventListener('click', () => {
    const waveforms = ['sine', 'sawtooth', 'square'];
    const labels = ['Sine', 'Sawtooth', 'Square'];
    const next = (waveforms.indexOf(state.waveform) + 1) % waveforms.length;
    state.waveform = waveforms[next];
    document.getElementById('btn-waveform').textContent = labels[next];
    if (state.currentInterval) {
      playInterval(state.currentInterval.firstFreq, state.currentInterval.secondFreq);
    }
  });
  document.getElementById('btn-keysig-quit').addEventListener('click', quitKeySig);
});
