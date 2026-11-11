(function () {
  'use strict';

  const STORAGE_KEY = 'wcagSwipeSession';
  const VERSION_ORDER = ['2.0', '2.1', '2.2'];

  const el = (id) => document.getElementById(id);
  const screens = {
    setup: el('screen-setup'),
    deck: el('screen-deck'),
    results: el('screen-results'),
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([key, node]) => { node.hidden = key !== name; });
  }

  function announce(msg) {
    el('liveRegion').textContent = msg;
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
  let session = null; // { versionTarget, levels: [], order: [ids], index, answers: {id: verdict}, completed }
  let historyStack = []; // ids in swipe order, for undo
  let dragState = null;

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
      input.addEventListener('input', refreshDeckCount);
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

  function renderCard() {
    const stack = el('cardStack');
    stack.innerHTML = '';
    const c = currentCriterion();

    el('progressText').textContent = `${session.index} / ${session.order.length}`;
    el('btnUndo').disabled = historyStack.length === 0;

    if (!c) {
      finishDeck();
      return;
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'activeCard';
    card.tabIndex = 0;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'question card');

    const badges = document.createElement('div');
    badges.className = 'card-badges';
    badges.innerHTML = `
      <span class="badge badge-level-${c.level}">${c.level}</span>
      <span class="badge">WCAG ${c.version}</span>
      <span class="badge">${c.principle}</span>
      ${c.removedIn ? `<span class="badge badge-removed">removed in ${c.removedIn}</span>` : ''}
    `;

    const idLine = document.createElement('p');
    idLine.className = 'card-id';
    idLine.textContent = `Success Criterion ${c.id}`;

    const nameLine = document.createElement('p');
    nameLine.className = 'card-name';
    nameLine.textContent = c.name;

    const question = document.createElement('p');
    question.className = 'card-question';
    question.textContent = c.q;

    const senseLabel = c.bad ? 'If the answer is yes, this fails.' : 'If the answer is yes, this passes.';
    const sense = document.createElement('p');
    sense.className = 'card-sense' + (c.bad ? ' is-bad' : '');
    sense.textContent = (c.bad ? '⚠️ ' : '') + senseLabel;

    card.appendChild(badges);
    card.appendChild(idLine);
    card.appendChild(nameLine);
    card.appendChild(question);
    card.appendChild(sense);

    if (c.note) {
      const note = document.createElement('p');
      note.className = 'card-note';
      note.textContent = c.note;
      card.appendChild(note);
    }

    // aria-label carries the full question + hint + note so screen reader users
    // get everything on focus, not just what's reachable via a separate browse pass.
    card.setAttribute('aria-label',
      `${c.id} ${c.name}. ${c.q} ${senseLabel}${c.note ? ' ' + c.note : ''}`);

    const stampLeft = document.createElement('div');
    stampLeft.className = 'card-stamp stamp-left';
    stampLeft.textContent = 'NO';
    stampLeft.setAttribute('aria-hidden', 'true');
    const stampRight = document.createElement('div');
    stampRight.className = 'card-stamp stamp-right';
    stampRight.textContent = 'YES';
    stampRight.setAttribute('aria-hidden', 'true');
    card.appendChild(stampLeft);
    card.appendChild(stampRight);

    stack.appendChild(card);
    attachDrag(card, stampLeft, stampRight, c);
    card.focus();
  }

  // Drag direction answers the literal question (right = yes, left = no);
  // `bad` flips which literal answer counts as passing.
  function verdictFromAnswer(answer, bad) {
    const yes = answer === 'yes';
    const passes = bad ? !yes : yes;
    return passes ? 'meets' : 'fails';
  }

  function attachDrag(card, stampLeft, stampRight, criterion) {
    let startX = 0, startY = 0, dx = 0, dragging = false;

    function onPointerDown(ev) {
      dragging = true;
      startX = ev.clientX;
      startY = ev.clientY;
      card.setPointerCapture(ev.pointerId);
    }
    function onPointerMove(ev) {
      if (!dragging) return;
      dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const rotate = dx / 20;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;
      const ratio = Math.min(Math.abs(dx) / 140, 1);
      if (dx > 0) {
        stampRight.style.opacity = ratio;
        stampLeft.style.opacity = 0;
      } else {
        stampLeft.style.opacity = ratio;
        stampRight.style.opacity = 0;
      }
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      if (dx > 120) {
        applyVerdict(verdictFromAnswer('yes', criterion.bad));
      } else if (dx < -120) {
        applyVerdict(verdictFromAnswer('no', criterion.bad));
      } else {
        card.style.transform = '';
        stampLeft.style.opacity = 0;
        stampRight.style.opacity = 0;
      }
      dx = 0;
    }

    card.addEventListener('pointerdown', onPointerDown);
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerup', onPointerUp);
    card.addEventListener('pointercancel', onPointerUp);
  }

  function applyVerdict(verdict) {
    const c = currentCriterion();
    if (!c) return;
    session.answers[c.id] = verdict;
    historyStack.push(c.id);
    session.index += 1;
    saveSession();
    const label = { meets: 'Meets', fails: 'Fails', na: 'Not applicable' }[verdict];
    announce(`${c.id} marked: ${label}. ${session.index} of ${session.order.length} done.`);
    renderCard();
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

  function finishDeck() {
    session.completed = true;
    saveSession();
    renderResults();
    showScreen('results');
  }

  function handleDeckKeydown(ev) {
    if (screens.deck.hidden) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); applyVerdict('meets'); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); applyVerdict('fails'); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); applyVerdict('na'); }
    else if (ev.key.toLowerCase() === 'z') { ev.preventDefault(); undoLast(); }
  }

  // ---------------- results screen ----------------
  function computeScore() {
    const breakdown = {
      Perceivable: { meets: 0, fails: 0, na: 0 },
      Operable: { meets: 0, fails: 0, na: 0 },
      Understandable: { meets: 0, fails: 0, na: 0 },
      Robust: { meets: 0, fails: 0, na: 0 },
    };
    const gaps = [];
    let meets = 0, fails = 0, na = 0;

    session.order.forEach(id => {
      const c = criterionById(id);
      const verdict = session.answers[id];
      if (!verdict) return;
      const b = breakdown[c.principle];
      if (verdict === 'meets') { meets++; if (b) b.meets++; }
      else if (verdict === 'fails') { fails++; if (b) b.fails++; gaps.push(c); }
      else { na++; if (b) b.na++; }
    });

    const scored = meets + fails;
    const pct = scored === 0 ? 0 : Math.round((meets / scored) * 100);
    return { meets, fails, na, pct, breakdown, gaps };
  }

  function playUrl() {
    return `${location.origin}${location.pathname}`;
  }

  function buildShareText(score) {
    const b = score.breakdown;
    const pctOf = (x) => (x.meets + x.fails) === 0 ? '—' : `${Math.round((x.meets / (x.meets + x.fails)) * 100)}%`;
    return [
      `🏁 ACCESSI-SWIPE — tested against WCAG ${session.versionTarget} (${session.levels.join('/')})`,
      `✅ ${score.pct}% passing (${score.meets}/${score.meets + score.fails})`,
      `👁️ Perceivable ${pctOf(b.Perceivable)} · 🕹️ Operable ${pctOf(b.Operable)} · 🧠 Understandable ${pctOf(b.Understandable)} · 🤖 Robust ${pctOf(b.Robust)}`,
      `⚠️ ${score.fails} gap${score.fails === 1 ? '' : 's'} found`,
      `Play: ${playUrl()}`,
    ].join('\n');
  }

  function renderResults() {
    const score = computeScore();

    el('scoreBig').textContent = `${score.pct}%`;
    el('scoreSub').textContent =
      `${score.meets} met · ${score.fails} didn't meet · ${score.na} N/A (WCAG ${session.versionTarget}, ${session.levels.join('/')})`;

    const principleEl = el('principleBreakdown');
    principleEl.innerHTML = '';
    Object.entries(score.breakdown).forEach(([name, b]) => {
      const total = b.meets + b.fails + b.na;
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
        const li = document.createElement('li');
        li.textContent = `${c.id} — ${c.name} (Level ${c.level}, WCAG ${c.version})`;
        gapList.appendChild(li);
      });
    }

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

  function exportJson() {
    const score = computeScore();
    const payload = {
      generatedAt: new Date().toISOString(),
      wcagVersion: session.versionTarget,
      levels: session.levels,
      summary: { pct: score.pct, meets: score.meets, fails: score.fails, na: score.na },
      principleBreakdown: score.breakdown,
      answers: session.order.map(id => {
        const c = criterionById(id);
        return {
          id: c.id, name: c.name, level: c.level, version: c.version,
          principle: c.principle, verdict: session.answers[id] || null,
        };
      }),
    };
    downloadFile('accessi-swipe-results.json', JSON.stringify(payload, null, 2), 'application/json');
  }

  function exportMarkdown() {
    const score = computeScore();
    const lines = [];
    lines.push(`# ACCESSI-SWIPE Results`);
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Tested against: WCAG ${session.versionTarget}, levels ${session.levels.join(', ')}`);
    lines.push('');
    lines.push(`**Score: ${score.pct}%** (${score.meets} met / ${score.fails} didn't meet / ${score.na} N/A)`);
    lines.push('');
    lines.push('## Breakdown by principle');
    Object.entries(score.breakdown).forEach(([name, b]) => {
      lines.push(`- **${name}**: ${b.meets} met, ${b.fails} didn't meet, ${b.na} N/A`);
    });
    lines.push('');
    lines.push('## Gaps');
    if (score.gaps.length === 0) {
      lines.push('No gaps found.');
    } else {
      score.gaps.forEach(c => {
        lines.push(`- [ ] **${c.id} ${c.name}** (Level ${c.level}, WCAG ${c.version})`);
      });
    }
    lines.push('');
    lines.push('## Full results');
    session.order.forEach(id => {
      const c = criterionById(id);
      const v = session.answers[id] || 'skipped';
      lines.push(`- ${c.id} ${c.name} — ${v}`);
    });
    downloadFile('accessi-swipe-results.md', lines.join('\n'), 'text/markdown');
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
    initSetupScreen();

    el('btnMeet').addEventListener('click', () => applyVerdict('meets'));
    el('btnFail').addEventListener('click', () => applyVerdict('fails'));
    el('btnNA').addEventListener('click', () => applyVerdict('na'));
    el('btnUndo').addEventListener('click', undoLast);
    document.addEventListener('keydown', handleDeckKeydown);

    el('btnExit').addEventListener('click', () => {
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
