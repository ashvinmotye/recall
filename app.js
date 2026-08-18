(() => {
  const MODES = ['flash', 'sequence', 'numbers', 'pairs', 'change'];
  const MODE_INFO = {
    flash: { name: 'Flash', title: 'Memory Grid', icon: '✦' },
    sequence: { name: 'Sequence', title: 'Follow the Pulse', icon: '↝' },
    numbers: { name: 'Numbers', title: 'Digit Hold', icon: '#' },
    pairs: { name: 'Pairs', title: 'Pair Sprint', icon: '◫' },
    change: { name: 'Change', title: 'What Changed?', icon: '△' }
  };

  const els = {
    homeView: byId('homeView'), gameView: byId('gameView'), resultView: byId('resultView'),
    heroScore: byId('heroScore'), bestScore: byId('bestScore'), bestStreak: byId('bestStreak'), gamesPlayed: byId('gamesPlayed'),
    playAgainButton: byId('playAgainButton'), homeButton: byId('homeButton'), quitButton: byId('quitButton'),
    soundToggle: byId('soundToggle'), soundIcon: byId('soundIcon'), themeToggle: byId('themeToggle'), themeIcon: byId('themeIcon'), themeColorMeta: byId('themeColorMeta'), phaseLabel: byId('phaseLabel'), roundTitle: byId('roundTitle'),
    liveScore: byId('liveScore'), hudLabel1: byId('hudLabel1'), hudValue1: byId('hudValue1'), hudLabel2: byId('hudLabel2'), hudValue2: byId('hudValue2'),
    countdown: byId('countdown'), grid: byId('grid'), gameHint: byId('gameHint'), roundProgress: byId('roundProgress'),
    numberGame: byId('numberGame'), numberDisplay: byId('numberDisplay'), digitEntry: byId('digitEntry'), keypad: byId('keypad'),
    resultKicker: byId('resultKicker'), resultTitle: byId('resultTitle'), resultScore: byId('resultScore'), resultMessage: byId('resultMessage'), resultMark: byId('resultMark'),
    resultLabel1: byId('resultLabel1'), resultValue1: byId('resultValue1'), resultLabel2: byId('resultLabel2'), resultValue2: byId('resultValue2'), resultLabel3: byId('resultLabel3'), resultValue3: byId('resultValue3'),
    toast: byId('toast')
  };

  const STORAGE_KEY = 'recall-v2-stats';
  const LEGACY_KEY = 'recall-v1-stats';
  const SETTINGS_KEY = 'recall-v1-settings';
  const defaultStats = {
    bestByMode: { flash: 0, sequence: 0, numbers: 0, pairs: 0, change: 0 },
    playsByMode: { flash: 0, sequence: 0, numbers: 0, pairs: 0, change: 0 },
    bestStreak: 0,
    gamesPlayed: 0
  };

  const stats = loadStats();
  const settings = loadJSON(SETTINGS_KEY, { sound: true, theme: 'light' });
  let state = freshState('flash');
  let timers = [];
  let audioCtx = null;

  function byId(id) { return document.getElementById(id); }
  function freshState(mode) {
    return {
      mode, round: 1, score: 0, streak: 0, runBestStreak: 0, completedRounds: 0, peak: '', ended: false, acceptingInput: false,
      gridSize: 3, targets: [], selected: new Set(), sequence: [], sequenceInput: [], numberTarget: '', numberInput: '',
      pairCards: [], pairFirst: null, pairSecond: null, pairLock: false, pairMatches: 0, pairMoves: 0, pairTotalMoves: 0, pairBoard: 1,
      changeBefore: [], changeAfter: [], changedIndex: -1
    };
  }

  function loadJSON(key, fallback) {
    try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) }; }
    catch { return { ...fallback }; }
  }

  function loadStats() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) {}
    const merged = JSON.parse(JSON.stringify(defaultStats));
    if (stored) {
      merged.bestByMode = { ...merged.bestByMode, ...(stored.bestByMode || {}) };
      merged.playsByMode = { ...merged.playsByMode, ...(stored.playsByMode || {}) };
      merged.bestStreak = Number(stored.bestStreak || 0);
      merged.gamesPlayed = Number(stored.gamesPlayed || 0);
      return merged;
    }
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (legacy) {
        merged.bestByMode.flash = Number(legacy.bestScore || 0);
        merged.bestStreak = Number(legacy.bestStreak || 0);
        merged.gamesPlayed = Number(legacy.gamesPlayed || 0);
        merged.playsByMode.flash = Number(legacy.gamesPlayed || 0);
      }
    } catch (_) {}
    return merged;
  }

  function persistStats() { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); }
  function persistSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  function overallBest() { return Math.max(...Object.values(stats.bestByMode)); }

  function applyTheme() {
    const dark = settings.theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    els.themeIcon.textContent = dark ? '☀' : '☾';
    els.themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to Twilight mode');
    els.themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
    els.themeColorMeta.setAttribute('content', dark ? '#322f42' : '#f6f3ff');
  }

  function refreshHome() {
    const best = overallBest();
    els.bestScore.textContent = best;
    els.bestStreak.textContent = stats.bestStreak;
    els.gamesPlayed.textContent = stats.gamesPlayed;
    els.heroScore.textContent = best;
    document.querySelectorAll('[data-best]').forEach(el => { el.textContent = stats.bestByMode[el.dataset.best] || 0; });
    els.soundIcon.textContent = settings.sound ? '◉' : '○';
    els.soundToggle.setAttribute('aria-pressed', settings.sound ? 'true' : 'false');
    applyTheme();
  }

  function showView(view) {
    [els.homeView, els.gameView, els.resultView].forEach(v => v.classList.remove('active'));
    view.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function clearTimers() { timers.forEach(id => clearTimeout(id)); timers = []; }
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function wait(ms) { return new Promise(resolve => later(resolve, ms)); }
  function haptic(pattern = 18) { if ('vibrate' in navigator) navigator.vibrate(pattern); }

  function beep(freq = 520, duration = 0.05, volume = 0.025) {
    if (!settings.sound) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq; gain.gain.value = volume;
      osc.connect(gain); gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now); osc.stop(now + duration);
    } catch (_) {}
  }

  function setPhase(label, hint) { els.phaseLabel.textContent = label; els.gameHint.textContent = hint; }
  function tileAt(index) { return els.grid.querySelector(`[data-index="${index}"]`); }
  function chooseTargets(total, count) { return shuffled(Array.from({ length: total }, (_, i) => i)).slice(0, count); }
  function shuffled(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }

  function prepareStage() {
    els.grid.innerHTML = '';
    els.grid.classList.remove('hidden');
    els.numberGame.classList.add('hidden');
    els.numberDisplay.textContent = '';
    els.digitEntry.textContent = '';
    els.keypad.innerHTML = '';
    els.countdown.textContent = '';
    els.roundProgress.style.width = '0%';
  }

  async function startGame(mode = state.mode) {
    clearTimers();
    state = freshState(mode);
    prepareStage();
    showView(els.gameView);
    updateHUD();
    await countdownIntoRun();
    if (!state.ended) startRound();
  }

  async function countdownIntoRun() {
    setPhase(MODE_INFO[state.mode].name.toUpperCase(), MODE_INFO[state.mode].title);
    els.grid.innerHTML = '';
    for (const n of ['3', '2', '1']) {
      els.countdown.textContent = n;
      beep(360 + (4 - Number(n)) * 70, .045);
      await wait(470);
      if (state.ended) return;
    }
    els.countdown.textContent = '';
  }

  function startRound() {
    if (state.ended) return;
    prepareStage();
    updateHUD();
    if (state.mode === 'flash') startFlashRound();
    else if (state.mode === 'sequence') startSequenceRound();
    else if (state.mode === 'numbers') startNumbersRound();
    else if (state.mode === 'pairs') startPairsRound();
    else if (state.mode === 'change') startChangeRound();
  }

  function gridSizeForRound(round) { if (round >= 15) return 6; if (round >= 10) return 5; if (round >= 6) return 4; return 3; }
  function flashCount(round, size) { return Math.min(size * size - 1, 2 + Math.floor((round - 1) / 2)); }
  function previewMs(round) { return Math.max(760, 1500 - ((round - 1) * 55)); }

  function renderPlainGrid(size, clickHandler, labels = null) {
    els.grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    const total = size * size;
    for (let i = 0; i < total; i++) {
      const tile = document.createElement('button');
      tile.className = 'memory-tile'; tile.type = 'button'; tile.dataset.index = i;
      if (labels) { tile.textContent = labels[i]; tile.classList.add('changed-symbol'); }
      tile.setAttribute('role', 'gridcell'); tile.setAttribute('aria-label', `Tile ${i + 1}`);
      tile.disabled = true; tile.addEventListener('click', clickHandler); els.grid.appendChild(tile);
    }
  }

  async function startFlashRound() {
    state.acceptingInput = false; state.selected.clear(); state.gridSize = gridSizeForRound(state.round);
    state.peak = `${state.gridSize} × ${state.gridSize}`;
    const count = flashCount(state.round, state.gridSize);
    state.targets = chooseTargets(state.gridSize * state.gridSize, count);
    renderPlainGrid(state.gridSize, onFlashTileClick);
    updateHUD(); setPhase('WATCH', 'Memorise the glowing tiles.');
    await wait(240); if (state.ended) return;
    state.targets.forEach(i => tileAt(i)?.classList.add('flash'));
    beep(580, .08, .02);
    await wait(previewMs(state.round)); if (state.ended) return;
    state.targets.forEach(i => tileAt(i)?.classList.remove('flash'));
    await wait(100); if (state.ended) return;
    state.acceptingInput = true; [...els.grid.children].forEach(tile => tile.disabled = false);
    setPhase('RECALL', `Tap the ${count} tiles you remember.`);
  }

  function onFlashTileClick(event) {
    if (!state.acceptingInput || state.ended) return;
    const tile = event.currentTarget; const index = Number(tile.dataset.index);
    if (state.selected.has(index)) return;
    state.selected.add(index); tile.classList.add('selected'); beep(500 + state.selected.size * 35, .035, .018); haptic(10);
    els.roundProgress.style.width = `${Math.min(100, (state.selected.size / state.targets.length) * 100)}%`;
    if (state.selected.size >= state.targets.length) { state.acceptingInput = false; [...els.grid.children].forEach(t => t.disabled = true); evaluateFlash(); }
  }

  async function evaluateFlash() {
    const targetSet = new Set(state.targets);
    const correct = [...state.selected].every(i => targetSet.has(i)) && state.selected.size === targetSet.size;
    [...state.selected].forEach(i => { const t = tileAt(i); t?.classList.remove('selected'); t?.classList.add(targetSet.has(i) ? 'correct' : 'wrong'); });
    state.targets.filter(i => !state.selected.has(i)).forEach(i => tileAt(i)?.classList.add('missed'));
    if (correct) {
      const gained = 70 + state.targets.length * 25 + state.gridSize * 12 + Math.min(state.round, 20) * 4 + Math.min(100, (state.streak + 1) * 5);
      await successRound(Math.round(gained), 'Perfect pattern.');
    } else await failRound('That pattern slipped away.');
  }

  function sequenceLength(round) { return Math.min(12, 2 + round); }
  async function startSequenceRound() {
    state.acceptingInput = false; state.sequenceInput = [];
    state.gridSize = state.round >= 8 ? 4 : 3; state.peak = `${state.gridSize} × ${state.gridSize}`;
    state.sequence = Array.from({ length: sequenceLength(state.round) }, () => Math.floor(Math.random() * (state.gridSize * state.gridSize)));
    renderPlainGrid(state.gridSize, onSequenceTileClick); updateHUD(); setPhase('WATCH', 'Follow the pulse in order.');
    await wait(260); if (state.ended) return;
    for (let i = 0; i < state.sequence.length; i++) {
      const index = state.sequence[i]; const tile = tileAt(index);
      tile?.classList.add('flash'); beep(460 + (index % state.gridSize) * 60, .07, .018);
      await wait(Math.max(260, 480 - state.round * 12)); if (state.ended) return;
      tile?.classList.remove('flash'); await wait(90); if (state.ended) return;
    }
    state.acceptingInput = true; [...els.grid.children].forEach(tile => tile.disabled = false);
    setPhase('REPEAT', `Repeat all ${state.sequence.length} pulses in order.`);
  }

  function onSequenceTileClick(event) {
    if (!state.acceptingInput || state.ended) return;
    const tile = event.currentTarget; const index = Number(tile.dataset.index); const pos = state.sequenceInput.length;
    state.sequenceInput.push(index); tile.classList.add('selected'); later(() => tile.classList.remove('selected'), 130);
    beep(500 + (index % state.gridSize) * 55, .04, .018); haptic(9);
    if (index !== state.sequence[pos]) { state.acceptingInput = false; tile.classList.add('wrong'); tileAt(state.sequence[pos])?.classList.add('missed'); failRound('The order broke there.'); return; }
    els.roundProgress.style.width = `${(state.sequenceInput.length / state.sequence.length) * 100}%`;
    if (state.sequenceInput.length === state.sequence.length) { state.acceptingInput = false; [...els.grid.children].forEach(t => t.disabled = true); successRound(90 + state.sequence.length * 34 + state.round * 8, 'Sequence locked in.'); }
  }

  function digitLength(round) { return Math.min(12, 2 + round); }
  function randomDigits(length) { let s = ''; for (let i = 0; i < length; i++) s += Math.floor(Math.random() * 10); return s; }
  async function startNumbersRound() {
    state.acceptingInput = false; state.numberInput = ''; state.numberTarget = randomDigits(digitLength(state.round)); state.peak = `${state.numberTarget.length} digits`;
    els.grid.classList.add('hidden'); els.numberGame.classList.remove('hidden'); renderKeypad(false); updateHUD();
    setPhase('WATCH', `Hold ${state.numberTarget.length} digits.`); els.numberDisplay.textContent = state.numberTarget; els.digitEntry.textContent = '';
    beep(560, .07, .018);
    await wait(Math.max(1150, 1950 - state.round * 45)); if (state.ended) return;
    els.numberDisplay.textContent = '•••'; state.acceptingInput = true; renderKeypad(true); setPhase('RECALL', 'Type the number back exactly.');
  }

  function renderKeypad(enabled) {
    els.keypad.innerHTML = '';
    ['1','2','3','4','5','6','7','8','9','⌫','0','Clear'].forEach(key => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = key; b.disabled = !enabled;
      if (key === '⌫' || key === 'Clear') b.className = 'key-action';
      b.addEventListener('click', () => onKeypad(key)); els.keypad.appendChild(b);
    });
  }

  function onKeypad(key) {
    if (!state.acceptingInput || state.ended) return;
    if (key === '⌫') state.numberInput = state.numberInput.slice(0, -1);
    else if (key === 'Clear') state.numberInput = '';
    else if (state.numberInput.length < state.numberTarget.length) state.numberInput += key;
    els.digitEntry.textContent = state.numberInput; beep(450 + state.numberInput.length * 18, .03, .015); haptic(7);
    els.roundProgress.style.width = `${(state.numberInput.length / state.numberTarget.length) * 100}%`;
    if (state.numberInput.length === state.numberTarget.length) {
      state.acceptingInput = false; renderKeypad(false);
      if (state.numberInput === state.numberTarget) successRound(100 + state.numberTarget.length * 42 + state.round * 6, 'Digits held perfectly.');
      else { els.numberDisplay.textContent = state.numberTarget; failRound('The number was just off.'); }
    }
  }

  const PAIR_SYMBOLS = ['✦','◆','●','▲','■','✚','☾','☀','✿','⬢','◈','✧'];
  const PAIR_BOARDS = [ { cols: 3, pairs: 6 }, { cols: 4, pairs: 8 }, { cols: 4, pairs: 10 } ];
  function startPairsRound() {
    const config = PAIR_BOARDS[state.pairBoard - 1] || PAIR_BOARDS[2];
    const values = shuffled(PAIR_SYMBOLS).slice(0, config.pairs); state.pairCards = shuffled([...values, ...values]);
    state.pairFirst = null; state.pairSecond = null; state.pairLock = false; state.pairMatches = 0; state.pairMoves = 0; state.acceptingInput = true;
    state.peak = `Board ${state.pairBoard}/3`; els.grid.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
    state.pairCards.forEach((value, i) => {
      const tile = document.createElement('button'); tile.type='button'; tile.className='memory-tile pair-card pair-hidden'; tile.dataset.index=i; tile.dataset.value=value; tile.textContent=value; tile.setAttribute('aria-label', `Card ${i + 1}`); tile.addEventListener('click', onPairClick); els.grid.appendChild(tile);
    });
    updateHUD(); setPhase('MATCH', `Clear board ${state.pairBoard} of 3.`);
  }

  function onPairClick(event) {
    if (!state.acceptingInput || state.pairLock || state.ended) return;
    const tile = event.currentTarget; if (tile.classList.contains('matched') || tile === state.pairFirst) return;
    tile.classList.remove('pair-hidden'); tile.classList.add('pair-revealed'); beep(500, .035, .015); haptic(7);
    if (!state.pairFirst) { state.pairFirst = tile; return; }
    state.pairSecond = tile; state.pairMoves += 1; state.pairTotalMoves += 1; updateHUD();
    if (state.pairFirst.dataset.value === state.pairSecond.dataset.value) {
      state.pairFirst.classList.add('matched'); state.pairSecond.classList.add('matched');
      state.pairFirst.classList.remove('pair-revealed'); state.pairSecond.classList.remove('pair-revealed');
      state.pairMatches += 1; beep(760,.07,.02); state.pairFirst = null; state.pairSecond = null;
      els.roundProgress.style.width = `${(state.pairMatches / (state.pairCards.length / 2)) * 100}%`;
      if (state.pairMatches === state.pairCards.length / 2) completePairBoard();
    } else {
      state.pairLock = true; const a = state.pairFirst; const b = state.pairSecond;
      a.classList.add('wrong'); b.classList.add('wrong');
      later(() => {
        a.classList.remove('wrong','pair-revealed'); b.classList.remove('wrong','pair-revealed'); a.classList.add('pair-hidden'); b.classList.add('pair-hidden');
        state.pairFirst = null; state.pairSecond = null; state.pairLock = false;
      }, 520);
    }
  }

  async function completePairBoard() {
    state.acceptingInput = false; const pairs = state.pairCards.length / 2;
    const boardScore = Math.max(120, 650 + pairs * 55 - Math.max(0, state.pairMoves - pairs) * 28);
    state.score += Math.round(boardScore); state.completedRounds += 1; updateHUD(); setPhase('CLEARED', `Board ${state.pairBoard} cleared in ${state.pairMoves} moves.`);
    beep(820,.09,.025); later(() => beep(980,.08,.02),90); haptic([12,30,12]);
    await wait(850); if (state.ended) return;
    if (state.pairBoard >= 3) finishGame();
    else { state.pairBoard += 1; state.round = state.pairBoard; startRound(); }
  }

  const CHANGE_SYMBOLS = ['●','▲','■','◆','✦','✚','☾','☀','◈','⬢','✿','✧'];
  async function startChangeRound() {
    state.acceptingInput = false; state.gridSize = state.round >= 7 ? 4 : 3; const total = state.gridSize * state.gridSize;
    state.changeBefore = Array.from({ length: total }, () => CHANGE_SYMBOLS[Math.floor(Math.random() * CHANGE_SYMBOLS.length)]);
    state.changeAfter = [...state.changeBefore]; state.changedIndex = Math.floor(Math.random() * total);
    let replacement = state.changeBefore[state.changedIndex]; while (replacement === state.changeBefore[state.changedIndex]) replacement = CHANGE_SYMBOLS[Math.floor(Math.random() * CHANGE_SYMBOLS.length)];
    state.changeAfter[state.changedIndex] = replacement; state.peak = `${state.gridSize} × ${state.gridSize}`;
    renderPlainGrid(state.gridSize, onChangeClick, state.changeBefore); updateHUD(); setPhase('STUDY', 'Study every symbol.');
    await wait(Math.max(1200, 2100 - state.round * 75)); if (state.ended) return;
    els.grid.style.opacity = '0'; await wait(260); if (state.ended) return;
    [...els.grid.children].forEach((tile, i) => { tile.textContent = state.changeAfter[i]; tile.disabled = false; });
    els.grid.style.opacity = '1'; state.acceptingInput = true; setPhase('WHAT CHANGED?', 'Tap the one tile that changed.');
  }

  function onChangeClick(event) {
    if (!state.acceptingInput || state.ended) return;
    state.acceptingInput = false; const index = Number(event.currentTarget.dataset.index); [...els.grid.children].forEach(t => t.disabled = true);
    if (index === state.changedIndex) { event.currentTarget.classList.add('correct'); successRound(120 + state.gridSize * 35 + state.round * 22, 'You caught the change.'); }
    else { event.currentTarget.classList.add('wrong'); tileAt(state.changedIndex)?.classList.add('missed'); failRound('That was not the changed tile.'); }
  }

  async function successRound(points, message) {
    state.streak += 1; state.runBestStreak = Math.max(state.runBestStreak, state.streak); state.completedRounds += 1; state.score += Math.round(points + Math.min(100, state.streak * 5));
    updateHUD(); setPhase('PERFECT', `${message} +${Math.round(points + Math.min(100, state.streak * 5))}`);
    beep(760,.09,.03); later(() => beep(920,.08,.02),90); haptic([14,35,14]);
    await wait(760); if (state.ended) return; state.round += 1; startRound();
  }

  async function failRound(message) {
    state.streak = 0; updateHUD(); setPhase('MISSED', message); beep(230,.14,.03); haptic([35,35,55]);
    await wait(900); if (!state.ended) finishGame();
  }

  function updateHUD() {
    els.roundTitle.textContent = state.mode === 'pairs' ? `Board ${state.pairBoard}` : `Round ${state.round}`;
    els.liveScore.textContent = state.score;
    if (state.mode === 'flash') {
      const size = gridSizeForRound(state.round); els.hudLabel1.textContent='Perfect Recall'; els.hudValue1.textContent=state.streak; els.hudLabel2.textContent='Remember'; els.hudValue2.textContent=`${flashCount(state.round,size)} tiles`;
    } else if (state.mode === 'sequence') {
      els.hudLabel1.textContent='Perfect Recall'; els.hudValue1.textContent=state.streak; els.hudLabel2.textContent='Sequence'; els.hudValue2.textContent=`${sequenceLength(state.round)} steps`;
    } else if (state.mode === 'numbers') {
      els.hudLabel1.textContent='Perfect Recall'; els.hudValue1.textContent=state.streak; els.hudLabel2.textContent='Memory span'; els.hudValue2.textContent=`${digitLength(state.round)} digits`;
    } else if (state.mode === 'pairs') {
      els.hudLabel1.textContent='Moves'; els.hudValue1.textContent=state.pairMoves; els.hudLabel2.textContent='Pairs found'; els.hudValue2.textContent=`${state.pairMatches}/${state.pairCards.length ? state.pairCards.length/2 : PAIR_BOARDS[state.pairBoard-1].pairs}`;
    } else if (state.mode === 'change') {
      els.hudLabel1.textContent='Perfect Recall'; els.hudValue1.textContent=state.streak; els.hudLabel2.textContent='Grid'; els.hudValue2.textContent=state.round >= 7 ? '4 × 4' : '3 × 3';
    }
  }

  function finishGame() {
    if (state.ended) return; state.ended = true; clearTimers();
    stats.gamesPlayed += 1; stats.playsByMode[state.mode] = (stats.playsByMode[state.mode] || 0) + 1;
    const previousBest = stats.bestByMode[state.mode] || 0; const isNewBest = state.score > previousBest;
    stats.bestByMode[state.mode] = Math.max(previousBest, state.score); stats.bestStreak = Math.max(stats.bestStreak, state.runBestStreak); persistStats(); refreshHome();

    const info = MODE_INFO[state.mode]; els.resultKicker.textContent = `${info.name.toUpperCase()} COMPLETE`; els.resultTitle.textContent = `${info.title} Score`; els.resultScore.textContent = state.score; els.resultMark.textContent = isNewBest && state.score > 0 ? '✦' : info.icon;
    if (isNewBest && state.score > 0) els.resultMessage.textContent = `New ${info.name} personal best.`;
    else if (state.mode === 'pairs') els.resultMessage.textContent = 'Three boards cleared. Try to shave off more moves.';
    else if (state.completedRounds >= 8) els.resultMessage.textContent = 'Excellent run. Your memory span held deep into the curve.';
    else if (state.completedRounds >= 4) els.resultMessage.textContent = 'Strong recall. The difficulty was starting to climb.';
    else els.resultMessage.textContent = 'Good run. Another attempt can move the score quickly.';

    if (state.mode === 'pairs') {
      setResultStat(1,'Boards',state.completedRounds); setResultStat(2,'Total moves',state.pairTotalMoves); setResultStat(3,'Best',stats.bestByMode.pairs);
    } else if (state.mode === 'numbers') {
      setResultStat(1,'Rounds',state.completedRounds); setResultStat(2,'Best streak',state.runBestStreak); setResultStat(3,'Peak span',state.peak || `${digitLength(state.round)} digits`);
    } else {
      setResultStat(1,'Rounds',state.completedRounds); setResultStat(2,'Best streak',state.runBestStreak); setResultStat(3,state.mode === 'sequence' ? 'Peak grid' : 'Peak grid',state.peak || '3 × 3');
    }
    showView(els.resultView);
  }

  function setResultStat(n,label,value) { els[`resultLabel${n}`].textContent=label; els[`resultValue${n}`].textContent=value; }
  function quitGame() { if (state.ended) return; state.ended=true; clearTimers(); showView(els.homeView); refreshHome(); toast('Run ended'); }
  function toast(message) { els.toast.textContent=message; els.toast.classList.add('show'); later(() => els.toast.classList.remove('show'),1400); }

  document.querySelectorAll('.mode-start').forEach(button => button.addEventListener('click', () => startGame(button.dataset.mode)));
  els.playAgainButton.addEventListener('click', () => startGame(state.mode));
  els.homeButton.addEventListener('click', () => { clearTimers(); showView(els.homeView); refreshHome(); });
  els.quitButton.addEventListener('click', quitGame);
  els.themeToggle.addEventListener('click', () => { settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; persistSettings(); applyTheme(); toast(settings.theme === 'dark' ? 'Twilight mode' : 'Light mode'); });
  els.soundToggle.addEventListener('click', () => { settings.sound=!settings.sound; persistSettings(); refreshHome(); if(settings.sound) beep(620,.05); toast(settings.sound?'Sound on':'Sound off'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && els.gameView.classList.contains('active') && !state.ended) quitGame(); });

  refreshHome();
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
