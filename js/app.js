(function () {
  'use strict';

  const STORAGE_KEY = 'wcagSwipeSession';
  const VERSION_ORDER = ['2.0', '2.1', '2.2'];

  // How far the card has to travel before a drag counts as an answer.
  // Up (N/A) needs a longer pull — "all the way" — so a sloppy swipe doesn't trigger it.
  const SWIPE = { x: 120, up: 180, down: 120 };
  const DIR_TO_CHOICE = { left: 'no', right: 'yes', up: 'na', down: 'unsure' };
  const KEY_TO_CHOICE = { ArrowLeft: 'no', ArrowRight: 'yes', ArrowUp: 'na', ArrowDown: 'unsure' };
  const FLY_MS = 420;
  const TRAY_VISIBLE_MAX = 10;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const el = (id) => document.getElementById(id);
  const screens = {
    setup: el('screen-setup'),
    deck: el('screen-deck'),
    results: el('screen-results'),
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([key, node]) => { node.hidden = key !== name; });
    document.body.dataset.screen = name;
  }

  function announce(msg) {
    el('liveRegion').textContent = msg;
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function versionIndex(v) { return VERSION_ORDER.indexOf(v); }

  function matchesFilter(criterion, versionTarget, levels) {
    if (!levels.has(criterion.level)) return false;
    if (versionIndex(criterion.version) > versionIndex(versionTarget)) return false;
    if (criterion.removedIn && versionIndex(criterion.removedIn) <= versionIndex(versionTarget)) return false;
    return true;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function countDeck(versionTarget, levels) {
    return WCAG_CRITERIA.filter(c => matchesFilter(c, versionTarget, levels)).length;
  }

  // ---------------- state ----------------
  // session: { versionTarget, levels: [], order: [ids], index, answers: {id: verdict}, completed }
  // verdict is one of: 'meets' | 'fails' | 'na' | 'unsure'
  let session = null;
  let historyStack = []; // ids in swipe order, for undo
  let finishTimer = null;

  function saveSession() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    session = null;
    historyStack = [];
  }

  function criterionById(id) {
    return WCAG_CRITERIA.find(c => c.id === id);
  }

  function confirmErase(sessionObj, message) {
    const hasProgress = sessionObj && sessionObj.answers && Object.keys(sessionObj.answers).length > 0;
    if (!hasProgress) return true;
    return window.confirm(message);
  }

  // W3C "Understanding" pages use a slug of the SC name. The WCAG 2.2 set
  // covers every 2.0/2.1 criterion too (4.1.1 Parsing is kept as an obsolete page).
  function understandingUrl(c) {
    const slug = c.name.toLowerCase().replace(/[(),]/g, '').trim().replace(/\s+/g, '-');
    return `https://www.w3.org/WAI/WCAG22/Understanding/${slug}`;
  }

  function howToCheckList(c) {
    const ol = make('ol', 'how-steps');
    const steps = c.how && c.how.length ? c.how : ['See the W3C guidance below for how to test this one.'];
    steps.forEach(step => ol.appendChild(make('li', null, step)));
    return ol;
  }

  function guidanceLink(c) {
    const a = make('a', 'guidance-link', `W3C guidance for ${c.id}`);
    a.href = understandingUrl(c);
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(make('span', 'visually-hidden', ' (opens in a new tab)'));
    return a;
  }

  // ---------------- setup screen ----------------
  function currentSetupSelection() {
    const versionTarget = document.querySelector('input[name="version"]:checked').value;
    const levels = new Set(
      Array.from(document.querySelectorAll('input[name="level"]:checked')).map(i => i.value)
    );
    const shuffleOn = el('shuffleToggle').checked;
    return { versionTarget, levels, shuffleOn };
  }

  function refreshDeckCount() {
    const { versionTarget, levels } = currentSetupSelection();
    const n = countDeck(versionTarget, levels);
    const countInput = el('cardCountInput');

    el('deckCount').textContent = n === 0
      ? 'No criteria match that selection — pick at least one level.'
      : `${n} card${n === 1 ? '' : 's'} available`;

    countInput.disabled = n === 0;
    if (n === 0) return;
    countInput.max = n;
    countInput.min = 1;
    const current = parseInt(countInput.value, 10);
    if (!current || current < 1 || current > n) {
      countInput.value = n;
    }
  }

  function refreshResumeBanner() {
    const existing = loadSession();
    el('btnResume').textContent = 'Resume session';

    if (existing && !existing.completed && existing.order && existing.index < existing.order.length) {
      el('resumeBanner').hidden = false;
      el('resumeText').textContent =
        `You have a session in progress: ${existing.index} of ${existing.order.length} cards done (WCAG ${existing.versionTarget}, ${existing.levels.join('/')}).`;
      el('btnResume').onclick = () => {
        session = existing;
        historyStack = [];
        startDeckScreen();
      };
      el('btnDiscard').onclick = () => {
        if (!confirmErase(existing, 'This will permanently erase your in-progress answers. Continue?')) return;
        clearSession();
        refreshResumeBanner();
      };
    } else if (existing && existing.completed) {
      el('resumeBanner').hidden = false;
      el('resumeText').textContent = 'You have a finished scorecard saved. Resume to view it, or start a new deck.';
      el('btnResume').textContent = 'View last scorecard';
      el('btnResume').onclick = () => {
        session = existing;
        renderResults();
        showScreen('results');
      };
      el('btnDiscard').onclick = () => {
        if (!confirmErase(existing, 'This will permanently erase your saved scorecard. Continue?')) return;
        clearSession();
        refreshResumeBanner();
      };
    } else {
      el('resumeBanner').hidden = true;
    }
  }

  function initSetupScreen() {
    document.querySelectorAll('#setupForm input').forEach(input => {
      input.addEventListener('change', refreshDeckCount);
      // The count box only gets tidied on `change` (blur or Enter). Re-running
      // on every keystroke refilled it the moment it was cleared, so you
      // couldn't delete the number and type your own.
      if (input.id !== 'cardCountInput') input.addEventListener('input', refreshDeckCount);
    });
    refreshDeckCount();
    refreshResumeBanner();

    el('setupForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const { versionTarget, levels, shuffleOn } = currentSetupSelection();
      if (levels.size === 0) return;
      let pool = WCAG_CRITERIA.filter(c => matchesFilter(c, versionTarget, levels)).map(c => c.id);
      if (shuffleOn) pool = shuffle(pool);
      const requested = parseInt(el('cardCountInput').value, 10);
      const count = Math.min(Math.max(requested || pool.length, 1), pool.length);
      pool = pool.slice(0, count);
      session = {
        versionTarget,
        levels: Array.from(levels),
        order: pool,
        index: 0,
        answers: {},
        completed: false,
      };
      historyStack = [];
      saveSession();
      startDeckScreen();
    });
  }

  // ---------------- deck screen ----------------
  function startDeckScreen() {
    showScreen('deck');
    renderCard();
  }

  function currentCriterion() {
    if (!session || session.index >= session.order.length) return null;
    return criterionById(session.order[session.index]);
  }

  // Drag direction answers the literal question (right = yes, left = no);
  // `bad` flips which literal answer counts as passing.
  function verdictFromAnswer(answer, bad) {
    const yes = answer === 'yes';
    const passes = bad ? !yes : yes;
    return passes ? 'meets' : 'fails';
  }

  // Inverse of verdictFromAnswer: which tray a meets/fails card landed in.
  function literalAnswer(c, verdict) {
    if (verdict !== 'meets' && verdict !== 'fails') return null;
    const passes = verdict === 'meets';
    return (c.bad ? !passes : passes) ? 'yes' : 'no';
  }

  // `newlyAnsweredId` is set when called right after an answer, so the tray
  // can animate that card dropping in.
  function renderCard(newlyAnsweredId) {
    clearTimeout(finishTimer);
    const stack = el('cardStack');
    stack.innerHTML = '';
    const c = currentCriterion();

    el('progressText').textContent = `${session.index} / ${session.order.length}`;
    el('btnUndo').disabled = historyStack.length === 0;
    renderTrays(newlyAnsweredId);

    if (!c) {
      // Let the last card land in its tray before switching screens.
      const delay = newlyAnsweredId && !reducedMotion.matches ? FLY_MS + 500 : 0;
      finishTimer = setTimeout(finishDeck, delay);
      return;
    }

    const card = buildCard(c);
    stack.appendChild(card);
    attachDrag(card);
    card.querySelector('.card-front').focus();
  }

  function buildCard(c) {
    const card = make('div', 'card');
    card.id = 'activeCard';
    const inner = make('div', 'card-inner');

    // ----- front: the question -----
    const front = make('div', 'card-face card-front');
    front.tabIndex = 0;
    front.setAttribute('role', 'group');
    front.setAttribute('aria-roledescription', 'question card');

    const badges = make('div', 'card-badges');
    badges.innerHTML = `
      <span class="badge badge-level-${c.level}">${c.level}</span>
      <span class="badge">WCAG ${c.version}</span>
      <span class="badge">${c.principle}</span>
      ${c.removedIn ? `<span class="badge badge-removed">removed in ${c.removedIn}</span>` : ''}
    `;

    const senseLabel = c.bad ? 'If the answer is yes, this fails.' : 'If the answer is yes, this passes.';
    front.append(
      badges,
      make('p', 'card-id', `Success Criterion ${c.id}`),
      make('p', 'card-name', c.name),
      make('p', 'card-question', c.q),
      make('p', 'card-sense' + (c.bad ? ' is-bad' : ''), (c.bad ? '⚠️ ' : '') + senseLabel)
    );
    if (c.note) front.appendChild(make('p', 'card-note', c.note));

    const hintBtn = make('button', 'btn btn-ghost btn-small card-flip-btn');
    hintBtn.type = 'button';
    hintBtn.innerHTML = '<span aria-hidden="true">💡</span> How do I check this?';
    hintBtn.addEventListener('click', () => toggleHint(true));
    front.appendChild(hintBtn);

    // aria-label carries the full question + sense + note so screen reader users
    // get everything on focus, not just what's reachable via a separate browse pass.
    front.setAttribute('aria-label',
      `${c.id} ${c.name}. ${c.q} ${senseLabel}${c.note ? ' ' + c.note : ''}`);

    [['left', 'No'], ['right', 'Yes'], ['up', 'N/A'], ['down', 'Don’t know']].forEach(([dir, label]) => {
      const stamp = make('div', `card-stamp stamp-${dir}`, label);
      stamp.dataset.dir = dir;
      stamp.setAttribute('aria-hidden', 'true');
      front.appendChild(stamp);
    });

    // ----- back: how to check -----
    const back = make('div', 'card-face card-back');
    back.tabIndex = -1;
    back.setAttribute('role', 'group');
    back.setAttribute('aria-label', `How to check ${c.id} ${c.name}`);
    back.inert = true;

    const backBtn = make('button', 'btn btn-ghost btn-small card-flip-btn');
    backBtn.type = 'button';
    backBtn.innerHTML = '<span aria-hidden="true">↩</span> Back to the question';
    backBtn.addEventListener('click', () => toggleHint(false));

    back.append(
      make('p', 'card-id', '💡 How to check'),
      make('p', 'card-name', `${c.id} ${c.name}`),
      howToCheckList(c),
      guidanceLink(c),
      backBtn
    );

    inner.append(front, back);
    card.appendChild(inner);
    return card;
  }

  function toggleHint(force) {
    const card = el('activeCard');
    if (!card) return;
    const flipped = typeof force === 'boolean' ? force : !card.classList.contains('is-flipped');
    card.classList.toggle('is-flipped', flipped);
    const front = card.querySelector('.card-front');
    const back = card.querySelector('.card-back');
    front.inert = flipped;
    back.inert = !flipped;
    if (flipped) back.scrollTop = 0;
    (flipped ? back : front).focus();
  }

  // Which way the card is being pulled, and how close it is (0–1) to committing.
  function dragIntent(dx, dy) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return null;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { dir: dx > 0 ? 'right' : 'left', ratio: Math.min(Math.abs(dx) / SWIPE.x, 1) };
    }
    return dy < 0
      ? { dir: 'up', ratio: Math.min(-dy / SWIPE.up, 1) }
      : { dir: 'down', ratio: Math.min(dy / SWIPE.down, 1) };
  }

  function highlightTray(dir) {
    el('trayNo').classList.toggle('is-target', dir === 'left');
    el('trayYes').classList.toggle('is-target', dir === 'right');
  }

  function attachDrag(card) {
    const stamps = {};
    card.querySelectorAll('.card-stamp').forEach(s => { stamps[s.dataset.dir] = s; });
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;

    function reset() {
      card.classList.remove('is-dragging');
      card.style.transform = '';
      Object.values(stamps).forEach(s => { s.style.opacity = 0; });
      highlightTray(null);
    }
    function onPointerDown(ev) {
      if (ev.button !== 0 || card.classList.contains('is-flipped')) return;
      if (ev.target.closest('button, a')) return;
      dragging = true;
      dx = dy = 0;
      startX = ev.clientX;
      startY = ev.clientY;
      card.setPointerCapture(ev.pointerId);
      card.classList.add('is-dragging');
    }
    function onPointerMove(ev) {
      if (!dragging) return;
      dx = ev.clientX - startX;
      dy = ev.clientY - startY;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 20}deg)`;
      const intent = dragIntent(dx, dy);
      Object.entries(stamps).forEach(([dir, s]) => {
        s.style.opacity = intent && intent.dir === dir ? intent.ratio : 0;
      });
      highlightTray(intent && intent.ratio >= 1 ? intent.dir : null);
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      const intent = dragIntent(dx, dy);
      if (intent && intent.ratio >= 1) {
        answer(DIR_TO_CHOICE[intent.dir]);
      } else {
        reset();
      }
    }

    card.addEventListener('pointerdown', onPointerDown);
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerup', onPointerUp);
    card.addEventListener('pointercancel', onPointerUp);
  }

  // Lifts the current card out of the stack and animates it into a tray
  // (yes/no) or off the top (N/A) / bottom (don't know) of the screen.
  function flyAway(choice) {
    highlightTray(null);
    const card = el('activeCard');
    if (!card || reducedMotion.matches) return;

    const from = el('cardStack').getBoundingClientRect();
    card.removeAttribute('id');
    card.setAttribute('aria-hidden', 'true');
    card.inert = true;
    card.classList.add('is-flying');
    Object.assign(card.style, {
      position: 'fixed',
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    });
    document.body.appendChild(card);

    let target;
    if (choice === 'yes' || choice === 'no') {
      const box = el(choice === 'yes' ? 'trayYes' : 'trayNo').querySelector('.tray-box').getBoundingClientRect();
      const tx = box.left + box.width / 2 - (from.left + from.width / 2);
      const ty = box.top + box.height * 0.4 - (from.top + from.height / 2);
      target = `translate(${tx}px, ${ty}px) rotate(${choice === 'yes' ? 20 : -20}deg) scale(0.1)`;
    } else if (choice === 'na') {
      target = `translate(0, ${-(from.bottom + 60)}px) rotate(-4deg)`;
    } else {
      target = `translate(0, ${window.innerHeight - from.top + 60}px) rotate(4deg)`;
    }

    card.getBoundingClientRect(); // lock in the start position before transitioning
    card.style.transition = `transform ${FLY_MS}ms cubic-bezier(.5,0,.6,1), opacity ${FLY_MS}ms ease-in`;
    card.style.transform = target;
    card.style.opacity = (choice === 'yes' || choice === 'no') ? '0.4' : '0';
    setTimeout(() => card.remove(), FLY_MS + 60);
  }

  function answerLabel(choice, verdict) {
    if (choice === 'na') return 'marked not applicable';
    if (choice === 'unsure') return 'marked I don’t know. It’s listed on your scorecard with how to check it';
    return `answered ${choice}, so it ${verdict === 'meets' ? 'meets' : 'doesn’t meet'} the criterion`;
  }

  function answer(choice) {
    const c = currentCriterion();
    if (!c) return;
    const verdict = (choice === 'yes' || choice === 'no') ? verdictFromAnswer(choice, c.bad) : choice;
    flyAway(choice);
    session.answers[c.id] = verdict;
    historyStack.push(c.id);
    session.index += 1;
    saveSession();
    announce(`${c.id} ${answerLabel(choice, verdict)}. ${session.index} of ${session.order.length} done.`);
    renderCard(c.id);
  }

  function undoLast() {
    if (historyStack.length === 0) return;
    const lastId = historyStack.pop();
    delete session.answers[lastId];
    session.index -= 1;
    saveSession();
    announce(`Undid last answer for ${lastId}.`);
    renderCard();
  }

  // ---------------- trays ----------------
  function renderTrays(newId) {
    const piles = { yes: [], no: [] };
    session.order.slice(0, session.index).forEach(id => {
      const c = criterionById(id);
      const side = literalAnswer(c, session.answers[id]);
      if (side) piles[side].push({ c, verdict: session.answers[id] });
    });

    [['yes', 'trayYes'], ['no', 'trayNo']].forEach(([side, trayId]) => {
      const tray = el(trayId);
      const pile = piles[side];
      tray.querySelector('.tray-count-num').textContent = pile.length;

      const holder = tray.querySelector('.tray-cards');
      holder.innerHTML = '';
      pile.slice(-TRAY_VISIBLE_MAX).forEach((item, i) => {
        const mini = make('div', `mini-card is-${item.verdict}`, item.c.id);
        // Stable, slightly messy tilt per card so the pile looks hand-tossed.
        const seed = item.c.id.split('').reduce((n, ch) => n + ch.charCodeAt(0), 0);
        mini.style.setProperty('--i', i);
        mini.style.setProperty('--r', `${(seed % 11) - 5}deg`);
        if (item.c.id === newId) mini.classList.add('is-new');
        holder.appendChild(mini);
      });

      const box = tray.querySelector('.tray-box');
      box.classList.remove('is-bumping');
      if (newId && pile.some(item => item.c.id === newId)) {
        void box.offsetWidth; // restart the bump animation
        box.classList.add('is-bumping');
      }
    });
  }

  function finishDeck() {
    if (!session || session.index < session.order.length || screens.deck.hidden) return;
    session.completed = true;
    saveSession();
    renderResults();
    showScreen('results');
    if (window.confettiBurst) window.confettiBurst();
  }

  function handleDeckKeydown(ev) {
    if (screens.deck.hidden || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const choice = KEY_TO_CHOICE[ev.key];
    if (choice) {
      ev.preventDefault();
      if (!ev.repeat) answer(choice);
      return;
    }
    const card = el('activeCard');
    if (ev.key === 'Escape' && card && card.classList.contains('is-flipped')) {
      ev.preventDefault();
      toggleHint(false);
    } else if (ev.key.toLowerCase() === 'h') {
      ev.preventDefault();
      toggleHint();
    } else if (ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      undoLast();
    }
  }

  // ---------------- results screen ----------------
  function emptyTally() { return { meets: 0, fails: 0, na: 0, unsure: 0 }; }

  function computeScore() {
    const breakdown = {
      Perceivable: emptyTally(),
      Operable: emptyTally(),
      Understandable: emptyTally(),
      Robust: emptyTally(),
    };
    const gaps = [];
    const unsureList = [];
    const totals = emptyTally();

    session.order.forEach(id => {
      const c = criterionById(id);
      const verdict = session.answers[id];
      if (!verdict || !(verdict in totals)) return;
      totals[verdict]++;
      if (breakdown[c.principle]) breakdown[c.principle][verdict]++;
      if (verdict === 'fails') gaps.push(c);
      if (verdict === 'unsure') unsureList.push(c);
    });

    const scored = totals.meets + totals.fails;
    const pct = scored === 0 ? 0 : Math.round((totals.meets / scored) * 100);
    return { ...totals, pct, breakdown, gaps, unsureList };
  }

  function playUrl() {
    return `${location.origin}${location.pathname}`;
  }

  function buildShareText(score) {
    const b = score.breakdown;
    const pctOf = (x) => (x.meets + x.fails) === 0 ? '—' : `${Math.round((x.meets / (x.meets + x.fails)) * 100)}%`;
    const lines = [
      `🏁 ACCESSI-SWIPE — tested against WCAG ${session.versionTarget} (${session.levels.join('/')})`,
      `✅ ${score.pct}% passing (${score.meets}/${score.meets + score.fails})`,
      `👁️ Perceivable ${pctOf(b.Perceivable)} · 🕹️ Operable ${pctOf(b.Operable)} · 🧠 Understandable ${pctOf(b.Understandable)} · 🤖 Robust ${pctOf(b.Robust)}`,
      `⚠️ ${score.fails} gap${score.fails === 1 ? '' : 's'} found`,
    ];
    if (score.unsure) lines.push(`❓ ${score.unsure} still to look into`);
    lines.push(`Play: ${playUrl()}`);
    return lines.join('\n');
  }

  function renderResults() {
    const score = computeScore();

    el('scoreBig').textContent = `${score.pct}%`;
    el('scoreSub').textContent =
      `${score.meets} met · ${score.fails} didn't meet · ${score.na} N/A` +
      (score.unsure ? ` · ${score.unsure} not sure` : '') +
      ` (WCAG ${session.versionTarget}, ${session.levels.join('/')})`;

    const principleEl = el('principleBreakdown');
    principleEl.innerHTML = '';
    Object.entries(score.breakdown).forEach(([name, b]) => {
      const total = b.meets + b.fails + b.na + b.unsure;
      const row = document.createElement('div');
      row.className = 'principle-row';
      const pct = (b.meets + b.fails) === 0 ? '—' : `${Math.round((b.meets / (b.meets + b.fails)) * 100)}%`;
      row.innerHTML = `
        <div class="principle-row-head"><span>${name}</span><span>${pct}</span></div>
        <div class="principle-bar">
          ${total === 0 ? '' : `
            <div class="pb-meet" style="width:${(b.meets / total) * 100}%"></div>
            <div class="pb-fail" style="width:${(b.fails / total) * 100}%"></div>
            <div class="pb-na" style="width:${(b.na / total) * 100}%"></div>
            <div class="pb-unsure" style="width:${(b.unsure / total) * 100}%"></div>
          `}
        </div>
      `;
      principleEl.appendChild(row);
    });

    const gapList = el('gapList');
    gapList.innerHTML = '';
    if (score.gaps.length === 0) {
      el('noGaps').hidden = false;
    } else {
      el('noGaps').hidden = true;
      score.gaps.forEach(c => {
        gapList.appendChild(make('li', null, `${c.id} — ${c.name} (Level ${c.level}, WCAG ${c.version})`));
      });
    }

    const unsureList = el('unsureList');
    unsureList.innerHTML = '';
    el('unsureSection').hidden = score.unsureList.length === 0;
    score.unsureList.forEach(c => {
      const li = make('li');
      const details = make('details');
      details.append(
        make('summary', null, `${c.id} — ${c.name} (Level ${c.level}, WCAG ${c.version})`),
        make('p', 'unsure-question', c.q),
        howToCheckList(c),
        guidanceLink(c)
      );
      li.appendChild(details);
      unsureList.appendChild(li);
    });

    el('shareText').value = buildShareText(score);
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const LEVEL_ORDER = ['A', 'AA', 'AAA'];
  const PRINCIPLES = ['Perceivable', 'Operable', 'Understandable', 'Robust'];
  const VERDICT_LABEL = { meets: '✅ Meets', fails: '❌ Doesn\'t meet', na: '➖ N/A', unsure: '❓ Not sure' };

  function compareCriteria(a, b) {
    const lv = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
    if (lv !== 0) return lv;
    const pa = a.id.split('.').map(Number), pb = b.id.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  }

  function localDateStamp(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // e.g. accessi-swipe-wcag2.2-A-AA-2026-11-11.md
  function exportFilename(ext, date) {
    const levels = LEVEL_ORDER.filter(l => session.levels.includes(l)).join('-');
    return `accessi-swipe-wcag${session.versionTarget}-${levels}-${localDateStamp(date)}.${ext}`;
  }

  function pctText(meets, fails) {
    return (meets + fails) === 0 ? '—' : `${Math.round((meets / (meets + fails)) * 100)}%`;
  }

  function exportJson() {
    const score = computeScore();
    const now = new Date();
    const payload = {
      generatedAt: now.toISOString(),
      wcagVersion: session.versionTarget,
      levels: session.levels,
      summary: { pct: score.pct, meets: score.meets, fails: score.fails, na: score.na, unsure: score.unsure },
      principleBreakdown: score.breakdown,
      answers: session.order.map(id => {
        const c = criterionById(id);
        return {
          id: c.id, name: c.name, level: c.level, version: c.version,
          principle: c.principle, verdict: session.answers[id] || null,
          howToCheck: c.how || [],
          understandingUrl: understandingUrl(c),
        };
      }),
    };
    downloadFile(exportFilename('json', now), JSON.stringify(payload, null, 2), 'application/json');
  }

  function exportMarkdown() {
    const score = computeScore();
    const now = new Date();
    const levels = LEVEL_ORDER.filter(l => session.levels.includes(l));
    const answered = Object.keys(session.answers).length;
    const naList = session.order.map(criterionById)
      .filter(c => session.answers[c.id] === 'na').sort(compareCriteria);
    const lines = [];
    const push = (...xs) => lines.push(...xs);

    push(`# ACCESSI-SWIPE accessibility report`, '');
    push(`| | |`, `|---|---|`);
    push(`| **Standard** | WCAG ${session.versionTarget}, Level ${levels.join(' + ')} |`);
    push(`| **Date** | ${now.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })} |`);
    push(`| **Criteria checked** | ${answered} of ${session.order.length} |`, '');

    push(`## Summary`, '');
    push(`**${score.pct}% passing** — ${score.meets} met, ${score.fails} didn't meet, ${score.na} not applicable, ${score.unsure} not sure yet.`, '');
    push(`| Principle | Passing | Met | Didn't meet | N/A | Not sure |`, `|---|---:|---:|---:|---:|---:|`);
    PRINCIPLES.forEach(p => {
      const b = score.breakdown[p];
      push(`| ${p} | ${pctText(b.meets, b.fails)} | ${b.meets} | ${b.fails} | ${b.na} | ${b.unsure} |`);
    });
    push('');

    push(`## Gaps to fix (${score.fails})`, '');
    if (score.gaps.length === 0) {
      push('No gaps found — everything checked either met the criterion or was not applicable. 🎉', '');
    } else {
      push('Grouped by principle, Level A first (the most fundamental) within each group.', '');
      PRINCIPLES.forEach(p => {
        const gaps = score.gaps.filter(c => c.principle === p).sort(compareCriteria);
        if (gaps.length === 0) return;
        push(`### ${p} (${gaps.length})`, '');
        gaps.forEach(c => {
          push(`- [ ] **${c.id} ${c.name}** — Level ${c.level}, WCAG ${c.version}`);
          push(`  - Check: ${c.q}`);
          push(`  - Answer that fails: ${c.bad ? 'Yes' : 'No'}`);
          if (c.note) push(`  - Note: ${c.note}`);
          push(`  - Guidance: [Understanding ${c.id}](${understandingUrl(c)})`);
        });
        push('');
      });
    }

    if (score.unsureList.length) {
      push(`## Not sure yet (${score.unsureList.length})`, '');
      push('These were marked "I don\'t know". Here\'s how to check each one.', '');
      score.unsureList.slice().sort(compareCriteria).forEach(c => {
        push(`- [ ] **${c.id} ${c.name}** — Level ${c.level}, WCAG ${c.version}`);
        push(`  - Check: ${c.q}`);
        (c.how || []).forEach((step, i) => push(`  ${i + 1}. ${step}`));
        push(`  - Guidance: [Understanding ${c.id}](${understandingUrl(c)})`);
      });
      push('');
    }

    if (naList.length) {
      push(`## Marked not applicable (${naList.length})`, '');
      push('Worth a second look to confirm the content really doesn\'t apply.', '');
      naList.forEach(c => push(`- ${c.id} ${c.name} (Level ${c.level})`));
      push('');
    }

    push(`## All results`, '');
    push(`| SC | Name | Level | Result |`, `|---|---|---|---|`);
    session.order.map(criterionById).sort(compareCriteria).forEach(c => {
      const v = session.answers[c.id];
      push(`| [${c.id}](${understandingUrl(c)}) | ${c.name} | ${c.level} | ${v ? VERDICT_LABEL[v] : 'Skipped'} |`);
    });
    push('');

    push('---', '');
    push(`_This is a self-assessment from [ACCESSI-SWIPE](${playUrl()}), not a formal conformance audit._`);
    downloadFile(exportFilename('md', now), lines.join('\n'), 'text/markdown');
  }

  let copyStatusTimer = null;
  function showCopyStatus() {
    const status = el('copyStatus');
    status.textContent = '✓ Copied!';
    status.classList.add('is-visible');
    clearTimeout(copyStatusTimer);
    copyStatusTimer = setTimeout(() => {
      status.classList.remove('is-visible');
    }, 2500);
  }

  async function copyShareText() {
    const text = el('shareText').value;
    try {
      await navigator.clipboard.writeText(text);
      announce('Summary copied to clipboard.');
    } catch (e) {
      el('shareText').select();
      document.execCommand('copy');
      announce('Summary copied to clipboard.');
    }
    showCopyStatus();
  }

  // ---------------- wiring ----------------
  function init() {
    document.body.dataset.screen = 'setup';
    initSetupScreen();

    el('btnYes').addEventListener('click', () => answer('yes'));
    el('btnNo').addEventListener('click', () => answer('no'));
    el('btnNA').addEventListener('click', () => answer('na'));
    el('btnUnsure').addEventListener('click', () => answer('unsure'));
    el('btnUndo').addEventListener('click', undoLast);
    document.addEventListener('keydown', handleDeckKeydown);

    el('btnExit').addEventListener('click', () => {
      clearTimeout(finishTimer);
      announce('Exited to home. Your progress is saved — resume anytime.');
      showScreen('setup');
      refreshDeckCount();
      refreshResumeBanner();
    });

    el('btnExportJson').addEventListener('click', exportJson);
    el('btnExportMd').addEventListener('click', exportMarkdown);
    el('btnCopyShare').addEventListener('click', copyShareText);
    el('btnStartOver').addEventListener('click', () => {
      if (!confirmErase(session, 'This will permanently erase your current results. Continue?')) return;
      clearSession();
      showScreen('setup');
      refreshDeckCount();
      refreshResumeBanner();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
