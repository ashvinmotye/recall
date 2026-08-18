(() => {
  const els = {
    homeView: document.getElementById('homeView'),
    gameView: document.getElementById('gameView'),
    resultView: document.getElementById('resultView'),
    heroScore: document.getElementById('heroScore'),
    bestScore: document.getElementById('bestScore'),
    bestStreak: document.getElementById('bestStreak'),
    gamesPlayed: document.getElementById('gamesPlayed'),
    startButton: document.getElementById('startButton'),
    playAgainButton: document.getElementById('playAgainButton'),
    homeButton: document.getElementById('homeButton'),
    quitButton: document.getElementById('quitButton'),
    soundToggle: document.getElementById('soundToggle'),
    soundIcon: document.getElementById('soundIcon'),
    phaseLabel: document.getElementById('phaseLabel'),
    roundTitle: document.getElementById('roundTitle'),
    liveScore: document.getElementById('liveScore'),
    liveStreak: document.getElementById('liveStreak'),
    targetCount: document.getElementById('targetCount'),
    countdown: document.getElementById('countdown'),
    grid: document.getElementById('grid'),
    gameHint: document.getElementById('gameHint'),
    roundProgress: document.getElementById('roundProgress'),
    resultScore: document.getElementById('resultScore'),
    resultRounds: document.getElementById('resultRounds'),
    resultStreak: document.getElementById('resultStreak'),
    resultGrid: document.getElementById('resultGrid'),
    resultMessage: document.getElementById('resultMessage'),
    resultMark: document.getElementById('resultMark'),
    toast: document.getElementById('toast')
  };

  const STORAGE_KEY = 'recall-v1-stats';
  const SETTINGS_KEY = 'recall-v1-settings';

  const stats = loadJSON(STORAGE_KEY, { bestScore: 0, bestStreak: 0, gamesPlayed: 0 });
  const settings = loadJSON(SETTINGS_KEY, { sound: true });

  let state = freshState();
  let timers = [];
  let audioCtx = null;

  function freshState() {
    return {
      round: 1,
      score: 0,
      streak: 0,
      runBestStreak: 0,
      gridSize: 3,
      targets: [],
      selected: new Set(),
      acceptingInput: false,
      completedRounds: 0,
      peakGrid: 3,
      ended: false
    };
  }

  function loadJSON(key, fallback) {
    try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) }; }
    catch { return { ...fallback }; }
  }

  function persistStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }

  function persistSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function refreshHome() {
    els.bestScore.textContent = stats.bestScore;
    els.bestStreak.textContent = stats.bestStreak;
    els.gamesPlayed.textContent = stats.gamesPlayed;
    els.heroScore.textContent = stats.bestScore;
    els.soundIcon.textContent = settings.sound ? '◉' : '○';
    els.soundToggle.setAttribute('aria-pressed', settings.sound ? 'true' : 'false');
  }

  function showView(view) {
    [els.homeView, els.gameView, els.resultView].forEach(v => v.classList.remove('active'));
    view.classList.add('active');
  }

  function clearTimers() {
    timers.forEach(id => clearTimeout(id));
    timers = [];
  }

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function wait(ms) {
    return new Promise(resolve => later(resolve, ms));
  }

  function haptic(pattern = 18) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  function beep(freq = 520, duration = 0.05, volume = 0.025) {
    if (!settings.sound) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration);
    } catch (_) {}
  }

  function targetCountForRound(round, size) {
    const cells = size * size;
    return Math.min(cells - 1, 2 + Math.floor((round - 1) / 2));
  }

  function gridSizeForRound(round) {
    if (round >= 15) return 6;
    if (round >= 10) return 5;
    if (round >= 6) return 4;
    return 3;
  }

  function previewMsForRound(round) {
    return Math.max(780, 1500 - ((round - 1) * 55));
  }

  function scoreForRound(round, count, size) {
    return Math.round(70 + count * 25 + size * 12 + Math.min(round, 20) * 4);
  }

  function chooseTargets(total, count) {
    const pool = Array.from({ length: total }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  function renderGrid() {
    els.grid.innerHTML = '';
    els.grid.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;
    const total = state.gridSize * state.gridSize;
    for (let i = 0; i < total; i++) {
      const tile = document.createElement('button');
      tile.className = 'memory-tile';
      tile.type = 'button';
      tile.dataset.index = i;
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-label', `Tile ${i + 1}`);
      tile.disabled = true;
      tile.addEventListener('click', onTileClick);
      els.grid.appendChild(tile);
    }
  }

  function setPhase(label, hint) {
    els.phaseLabel.textContent = label;
    els.gameHint.textContent = hint;
  }

  async function startGame() {
    clearTimers();
    state = freshState();
    showView(els.gameView);
    updateGameHUD();
    await countdownIntoRun();
    if (!state.ended) startRound();
  }

  async function countdownIntoRun() {
    setPhase('GET READY', 'Focus on the grid.');
    els.grid.innerHTML = '';
    for (const n of ['3', '2', '1']) {
      els.countdown.textContent = n;
      beep(360 + (4 - Number(n)) * 70, .045);
      await wait(520);
      if (state.ended) return;
    }
    els.countdown.textContent = '';
  }

  async function startRound() {
    if (state.ended) return;
    state.acceptingInput = false;
    state.selected.clear();
    state.gridSize = gridSizeForRound(state.round);
    state.peakGrid = Math.max(state.peakGrid, state.gridSize);
    const count = targetCountForRound(state.round, state.gridSize);
    state.targets = chooseTargets(state.gridSize * state.gridSize, count);
    renderGrid();
    updateGameHUD();
    els.roundProgress.style.width = '0%';
    setPhase('WATCH', 'Memorise the glowing tiles.');

    await wait(250);
    if (state.ended) return;

    state.targets.forEach(i => tileAt(i)?.classList.add('flash'));
    beep(580, .08, .02);
    await wait(previewMsForRound(state.round));
    if (state.ended) return;

    state.targets.forEach(i => tileAt(i)?.classList.remove('flash'));
    await wait(120);
    if (state.ended) return;

    state.acceptingInput = true;
    [...els.grid.children].forEach(tile => tile.disabled = false);
    setPhase('RECALL', `Tap the ${count} tiles you remember.`);
  }

  function onTileClick(event) {
    if (!state.acceptingInput || state.ended) return;
    const tile = event.currentTarget;
    const index = Number(tile.dataset.index);
    if (state.selected.has(index)) return;

    state.selected.add(index);
    tile.classList.add('selected');
    beep(500 + state.selected.size * 35, .035, .018);
    haptic(10);

    const count = state.targets.length;
    els.roundProgress.style.width = `${Math.min(100, (state.selected.size / count) * 100)}%`;

    if (state.selected.size >= count) {
      state.acceptingInput = false;
      [...els.grid.children].forEach(t => t.disabled = true);
      evaluateRound();
    }
  }

  async function evaluateRound() {
    const targetSet = new Set(state.targets);
    const correct = [...state.selected].every(i => targetSet.has(i)) && state.selected.size === targetSet.size;

    [...state.selected].forEach(i => {
      const tile = tileAt(i);
      tile?.classList.remove('selected');
      tile?.classList.add(targetSet.has(i) ? 'correct' : 'wrong');
    });
    state.targets.filter(i => !state.selected.has(i)).forEach(i => tileAt(i)?.classList.add('missed'));

    if (correct) {
      state.streak += 1;
      state.runBestStreak = Math.max(state.runBestStreak, state.streak);
      state.completedRounds += 1;
      const gained = scoreForRound(state.round, state.targets.length, state.gridSize) + Math.min(100, state.streak * 5);
      state.score += gained;
      updateGameHUD();
      setPhase('PERFECT', `+${gained} · Next round incoming.`);
      beep(760, .09, .03);
      later(() => beep(920, .08, .02), 90);
      haptic([14, 35, 14]);
      await wait(780);
      if (state.ended) return;
      state.round += 1;
      startRound();
    } else {
      state.streak = 0;
      updateGameHUD();
      setPhase('MISSED', 'That pattern slipped away.');
      beep(230, .14, .03);
      haptic([35, 35, 55]);
      await wait(900);
      if (!state.ended) finishGame();
    }
  }

  function tileAt(index) {
    return els.grid.querySelector(`[data-index="${index}"]`);
  }

  function updateGameHUD() {
    els.roundTitle.textContent = `Round ${state.round}`;
    els.liveScore.textContent = state.score;
    els.liveStreak.textContent = state.streak;
    const count = targetCountForRound(state.round, state.gridSize);
    els.targetCount.textContent = `${count} tile${count === 1 ? '' : 's'}`;
  }

  function finishGame() {
    if (state.ended) return;
    state.ended = true;
    clearTimers();

    stats.gamesPlayed += 1;
    const isNewBest = state.score > stats.bestScore;
    stats.bestScore = Math.max(stats.bestScore, state.score);
    stats.bestStreak = Math.max(stats.bestStreak, state.runBestStreak);
    persistStats();
    refreshHome();

    els.resultScore.textContent = state.score;
    els.resultRounds.textContent = state.completedRounds;
    els.resultStreak.textContent = state.runBestStreak;
    els.resultGrid.textContent = `${state.peakGrid} × ${state.peakGrid}`;
    els.resultMark.textContent = isNewBest ? '✦' : '◇';

    if (isNewBest && state.score > 0) {
      els.resultMessage.textContent = 'New personal best. Your recall just moved up.';
    } else if (state.completedRounds >= 10) {
      els.resultMessage.textContent = 'Excellent run. You held a long chain of patterns.';
    } else if (state.completedRounds >= 5) {
      els.resultMessage.textContent = 'Strong recall. The grid was starting to fight back.';
    } else {
      els.resultMessage.textContent = 'Good start. One more run can change the score quickly.';
    }

    showView(els.resultView);
  }

  function quitGame() {
    if (state.ended) return;
    state.ended = true;
    clearTimers();
    showView(els.homeView);
    refreshHome();
    toast('Run ended');
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    later(() => els.toast.classList.remove('show'), 1400);
  }

  els.startButton.addEventListener('click', startGame);
  els.playAgainButton.addEventListener('click', startGame);
  els.homeButton.addEventListener('click', () => { clearTimers(); showView(els.homeView); refreshHome(); });
  els.quitButton.addEventListener('click', quitGame);
  els.soundToggle.addEventListener('click', () => {
    settings.sound = !settings.sound;
    persistSettings();
    refreshHome();
    if (settings.sound) beep(620, .05);
    toast(settings.sound ? 'Sound on' : 'Sound off');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && els.gameView.classList.contains('active') && !state.ended) {
      // Avoid silently progressing the memory phase while the app is backgrounded.
      quitGame();
    }
  });

  refreshHome();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
