/* BizTalk — 변리사 비즈니스 영어 PWA */
(function () {
  'use strict';
  const { CATS, EXPRESSIONS, DICTATION_EXTRA, INTERVIEW } = window.APP_DATA;
  const C = window.CORE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#view');
  const ALL_DICT = EXPRESSIONS.concat(DICTATION_EXTRA);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ═════════ 저장소 ═════════ */
  const KEY = 'bizeng.v1';
  const DEF = {
    v: 1, level: 1, maxLv: 1, xp: 0, daily: {}, attempts: [], srs: {}, dsrs: {}, iv: {}, badges: {},
    bestStreak: 0, audio: 0, hist: {}, goalDays: {}, onboarded: false,
    settings: { voice: '', rate: 0.95, goal: 50, koPrompt: true },
  };
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw) return JSON.parse(JSON.stringify(DEF));
      const s = Object.assign(JSON.parse(JSON.stringify(DEF)), raw);
      s.settings = Object.assign({}, DEF.settings, raw.settings || {});
      return s;
    } catch (e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('⚠️ 저장 공간이 부족해요. 설정에서 백업 후 짤 이미지를 정리하세요.'); }
  }

  /* ═════════ UI 유틸 ═════════ */
  let toastT;
  function toast(msg, ms = 2400) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
  }
  function confetti(n = 28) {
    const em = ['🎉', '✨', '🏆', '💯', '⭐', '📜'];
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'confetti'; d.textContent = em[i % em.length];
      d.style.left = Math.random() * 100 + 'vw';
      d.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
      d.style.animationDelay = Math.random() * 0.4 + 's';
      document.body.appendChild(d); setTimeout(() => d.remove(), 3800);
    }
  }
  function bind(map) { // data-act="name" 클릭 바인딩
    $$('[data-act]', view).forEach((el) => {
      const fn = map[el.dataset.act];
      if (fn) el.onclick = (ev) => { try { fn(el, ev); } catch (e) { reportErr(e); } };
    });
  }
  function reportErr(e) { console.error(e); toast('⚠️ 문제가 생겼어요. 다시 시도해 주세요.'); }
  window.addEventListener('error', (e) => reportErr(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => reportErr(e.reason));

  function reaction(score) {
    if (score === 100) return ['😎', '완벽. 심사관도 반박 못 함'];
    if (score >= 85) return ['🔥', '특허 등록 각! 클라이언트 만족도 📈'];
    if (score >= 70) return ['👍', '거의 다 왔어요. 살짝만 보정 ✂️'];
    if (score >= 50) return ['🤏', '보정서 제출 필요. 한 번 더!'];
    return ['📬', '거절이유통지 도착… 재도전으로 극복!'];
  }

  /* ═════════ 음성 (TTS / 인식) ═════════ */
  const Speech = (function () {
    const synth = window.speechSynthesis;
    let voices = [];
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let currentRec = null, actx = null, srFails = 0;

    function loadVoices() { try { voices = synth ? synth.getVoices() : []; } catch (e) { voices = []; } }
    if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }

    const GOOD = /(premium|enhanced|향상|samantha|ava|zoe|evan|nathan|allison|susan|tom|daniel|karen|serena|google us english|natural)/i;
    function enVoices() { return voices.filter((v) => /^en[-_]/i.test(v.lang)); }
    function pick(lang) {
      if (lang.startsWith('ko')) return voices.find((v) => /^ko/i.test(v.lang)) || null;
      if (S.settings.voice) { const v = voices.find((x) => x.voiceURI === S.settings.voice); if (v) return v; }
      const en = enVoices();
      const us = en.filter((v) => /en[-_]US/i.test(v.lang));
      return us.find((v) => /(premium|enhanced|향상)/i.test(v.name)) || us.find((v) => GOOD.test(v.name)) || us[0] || en[0] || null;
    }
    function speak(text, opt = {}) {
      return new Promise((resolve) => {
        if (!synth) { resolve(); return; }
        const lang = opt.lang || 'en-US';
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        const v = pick(lang); if (v) u.voice = v;
        u.rate = (opt.rate || 1) * (lang.startsWith('en') ? S.settings.rate : 1.05);
        let done = false;
        const fin = () => { if (!done) { done = true; clearTimeout(tm); resolve(); } };
        // iOS에서 onend가 누락되는 경우 대비 안전 타이머
        const est = (text.length * 75) / u.rate + 2500;
        const tm = setTimeout(fin, est);
        u.onend = fin; u.onerror = fin;
        try { synth.speak(u); } catch (e) { fin(); }
      });
    }
    function stop() {
      try { synth && synth.cancel(); } catch (e) { /* noop */ }
      if (currentRec) { try { currentRec.abort(); } catch (e) { /* noop */ } currentRec = null; }
    }
    function beep(freq = 880, ms = 140) {
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = freq; g.gain.value = 0.12;
        o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + ms / 1000);
      } catch (e) { /* noop */ }
      return sleep(ms + 60);
    }
    /** 음성 인식. {promise, stop}. 실패 시 promise reject(errorCode) */
    function listen(opt = {}) {
      if (!SR) return { promise: Promise.reject('unsupported'), stop() {} };
      stop();
      const rec = new SR();
      currentRec = rec;
      rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = !!opt.continuous; rec.maxAlternatives = 1;
      let latest = '', lastChange = Date.now(), started = Date.now(), ended = false;
      let silenceT, maxT;
      const promise = new Promise((resolve, reject) => {
        rec.onresult = (e) => {
          let s = '';
          for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript + ' ';
          s = s.replace(/\s+/g, ' ').trim();
          if (s !== latest) { latest = s; lastChange = Date.now(); opt.onInterim && opt.onInterim(s); }
        };
        rec.onerror = (e) => {
          ended = true; cleanup();
          if (e.error === 'no-speech' || e.error === 'aborted') resolve(latest);
          else { srFails++; reject(e.error || 'error'); }
        };
        rec.onend = () => { ended = true; cleanup(); srFails = 0; resolve(latest); };
        function cleanup() { clearInterval(silenceT); clearTimeout(maxT); if (currentRec === rec) currentRec = null; }
        // 침묵 감지: 말이 끝나고 일정 시간 변화 없으면 자동 종료 (iOS는 자동 종료가 늦을 때가 있음)
        const silence = opt.silenceMs || (opt.continuous ? 0 : 1600);
        if (silence) silenceT = setInterval(() => {
          const quiet = Date.now() - lastChange;
          if (!ended && ((latest && quiet > silence) || (!latest && Date.now() - started > (opt.noSpeechMs || 7000)))) { try { rec.stop(); } catch (e) { /* noop */ } }
        }, 250);
        maxT = setTimeout(() => { try { rec.stop(); } catch (e) { /* noop */ } }, opt.maxMs || 15000);
        try { rec.start(); } catch (e) { cleanup(); reject('start-failed'); }
      });
      return { promise, stop() { try { rec.stop(); } catch (e) { /* noop */ } } };
    }
    return { speak, stop, beep, listen, get srOK() { return !!SR; }, get srFails() { return srFails; }, enVoices, voices: () => voices, pick };
  })();

  function srErrorMsg(code) {
    if (code === 'not-allowed' || code === 'service-not-allowed')
      return '마이크/음성인식 권한이 없어요. 설정 > 앱(Safari) > 마이크 허용, 설정 > 일반 > 키보드 > 받아쓰기 켜기를 확인하세요. 지금은 입력 모드로 진행합니다.';
    if (code === 'unsupported') return '이 브라우저는 음성인식을 지원하지 않아요. 입력 모드로 진행합니다.';
    if (code === 'network') return '음성인식에 네트워크가 필요해요. 연결 확인 후 다시 시도하세요.';
    return '음성인식이 실패했어요(' + code + '). 다시 시도하거나 입력 모드를 사용하세요.';
  }

  /* 화면 꺼짐 방지 (오디오 모드) */
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); }
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* 지원 안 함 */ }
  }

  /* ═════════ 기록 · 보상 ═════════ */
  function today() { return C.dayKey(Date.now()); }
  function record(m, s, lv, opts = {}) {
    const now = Date.now(), k = C.dayKey(now);
    if (!opts.xpOnly) {
      S.attempts.push({ t: now, m, s, lv: lv || S.level });
      if (S.attempts.length > 3000) S.attempts = S.attempts.slice(-3000);
    }
    const xp = opts.xp != null ? opts.xp : C.xpFor(s);
    const before = S.daily[k] || 0;
    S.xp += xp; S.daily[k] = before + xp;
    S.hist[k] = C.bizScore(S.attempts, S.level);
    if (before < S.settings.goal && S.daily[k] >= S.settings.goal) {
      S.goalDays[k] = 1;
      setTimeout(() => { confetti(); toast('🎯 오늘의 목표 달성! 연속 ' + C.streak(S.daily, S.settings.goal, now) + '일째', 3200); }, 400);
    }
    S.bestStreak = Math.max(S.bestStreak, C.streak(S.daily, S.settings.goal, now));
    save(); checkBadges();
    return xp;
  }
  function statsForBadges() {
    const a = S.attempts;
    return {
      attempts: a.length, bestStreak: S.bestStreak, perfect: a.filter((x) => x.s === 100).length,
      learned: Object.keys(S.srs).filter((id) => S.srs[id].best >= 70).length, totalExpr: EXPRESSIONS.length,
      dict: a.filter((x) => x.m === 'dict').length, iv: a.filter((x) => x.m === 'iv').length, audio: S.audio, maxLv: S.maxLv,
    };
  }
  function checkBadges() {
    const st = statsForBadges();
    for (const [id, e, name, , fn] of C.BADGES) {
      if (!S.badges[id] && fn(st)) {
        S.badges[id] = Date.now(); save();
        setTimeout(() => { confetti(16); toast(e + ' 배지 획득: ' + name, 3000); }, 900);
      }
    }
  }
  /** 세션 종료 시 레벨 점검 */
  function levelReview() {
    const r = C.levelCheck(S.attempts, S.level);
    if (r.up) {
      S.level++; S.maxLv = Math.max(S.maxLv, S.level); save(); checkBadges();
      setTimeout(confetti, 300);
      return `<div class="card" style="border:2px solid var(--acc)"><b>⬆️ 난이도 상승! Level ${S.level} · ${C.LEVELS[S.level]}</b><p class="muted">최근 정확도 85% 이상을 유지해서 더 어려운 표현이 열렸어요.</p></div>`;
    }
    if (r.down) return `<div class="card"><b>🧭 지금 레벨이 조금 버거워 보여요</b><p class="muted">최근 평균 50점 미만. 기초를 다지면 더 빨리 늘어요.</p><button class="ghost block" data-act="lvdown">Level ${S.level - 1}로 낮추기</button></div>`;
    return '';
  }

  /* ═════════ 공통 컴포넌트 ═════════ */
  function imgKey(id) { return 'bizeng.img.' + id; }
  function getImg(id) { try { return localStorage.getItem(imgKey(id)); } catch (e) { return null; } }
  function memeCard(e, opt = {}) {
    const img = getImg(e.id);
    const style = img ? ` style="background-image:url('${img}')"` : '';
    const bottom = opt.mask ? '<div class="cap bot masked"></div>' : `<div class="cap bot">${esc(e.en)}</div>`;
    return `<div class="meme${img ? ' img' : ''}"${style}>
      <span class="pill lvtag">Lv${e.lv} · ${esc(CATS[e.cat] || '')}</span>
      <div class="cap">${esc(e.m[1])}</div>
      <div class="emo">${e.m[0]}</div>
      ${bottom}
      ${opt.imgBtn !== false ? `<button class="imgbtn" data-act="setimg" data-id="${e.id}">🖼️ ${img ? '짤 변경' : '내 짤 넣기'}</button>` : ''}
    </div>`;
  }
  function diffHtml(r) {
    // 원문 단어 단위 표시 (정규화된 토큰 기준)
    return r.target.map((w, i) => `<span class="${r.status[i]}">${esc(w)}</span>`).join(' ');
  }
  function setImageFor(id, after) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = () => {
        const max = 520, sc = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        try { localStorage.setItem(imgKey(id), cv.toDataURL('image/jpeg', 0.72)); toast('🖼️ 짤 저장 완료'); }
        catch (e) { toast('⚠️ 저장 공간 부족 — 다른 짤을 삭제해 주세요.'); }
        after && after();
      };
      im.onerror = () => toast('이미지를 읽을 수 없어요.');
      im.src = url;
    };
    inp.click();
  }
  function imgMenu(id, after) {
    if (getImg(id) && confirm('현재 짤을 삭제할까요?\n(취소 = 새 이미지로 교체)')) {
      localStorage.removeItem(imgKey(id)); toast('기본 카드로 복원'); after && after(); return;
    }
    setImageFor(id, after);
  }
  function progress(i, n) { return `<div class="prog"><i style="width:${(i / n) * 100}%"></i></div>`; }

  /* ═════════ 라우터 ═════════ */
  let cleanupFns = [];
  function go(tab, arg) {
    Speech.stop(); keepAwake(false);
    cleanupFns.forEach((f) => { try { f(); } catch (e) { /* noop */ } }); cleanupFns = [];
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    window.scrollTo(0, 0);
    try { (ROUTES[tab] || ROUTES.home)(arg); } catch (e) { reportErr(e); if (tab !== 'home') ROUTES.home(); }
  }
  $$('#tabs button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));

  /* ═════════ 홈 ═════════ */
  function avgOf(m, n = 20) { const a = S.attempts.filter((x) => x.m === m).slice(-n); return a.length ? Math.round(C.avg(a.map((x) => x.s))) : null; }
  function chartSvg() {
    const days = Object.keys(S.hist).sort().slice(-30);
    if (days.length < 2) return '<p class="muted small">연습을 이틀 이상 하면 점수 변화 그래프가 나타나요.</p>';
    const vals = days.map((d) => S.hist[d]);
    const W = 320, H = 150, P = 22;
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 30) / 50) * 50), hi = Math.min(1000, Math.ceil((Math.max(...vals) + 30) / 50) * 50);
    const x = (i) => P + (i * (W - P * 2)) / (days.length - 1);
    const y = (v) => H - P - ((v - lo) / (hi - lo || 1)) * (H - P * 2);
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const last = vals.length - 1;
    return `<div class="chart" id="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="${P}" x2="${W - P}" y1="${y(lo)}" y2="${y(lo)}" stroke="#334155" stroke-width="1"/>
      <line x1="${P}" x2="${W - P}" y1="${y(hi)}" y2="${y(hi)}" stroke="#1e293b" stroke-width="1"/>
      <text x="2" y="${y(hi) + 4}" fill="#94a3b8" font-size="10">${hi}</text><text x="2" y="${y(lo) + 4}" fill="#94a3b8" font-size="10">${lo}</text>
      <polyline points="${pts}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(last)}" cy="${y(vals[last])}" r="4" fill="#38bdf8" stroke="#1e293b" stroke-width="2"/>
      <text x="${x(last)}" y="${y(vals[last]) - 9}" fill="#f1f5f9" font-size="11" font-weight="700" text-anchor="end">${vals[last]}</text>
    </svg><div class="tip hidden"></div></div>
    <div class="row muted small"><span>${days[0].slice(5)}</span><span class="grow"></span><span>${days[last].slice(5)}</span></div>`;
  }
  function bindChart() {
    const el = $('#chart'); if (!el) return;
    const days = Object.keys(S.hist).sort().slice(-30);
    const tip = $('.tip', el);
    const show = (ev) => {
      const r = el.getBoundingClientRect();
      const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const P = (22 / 320) * r.width;
      const i = Math.max(0, Math.min(days.length - 1, Math.round(((cx - P) / (r.width - 2 * P)) * (days.length - 1))));
      tip.textContent = days[i].slice(5).replace('-', '/') + ' · ' + S.hist[days[i]] + '점';
      tip.style.left = Math.max(40, Math.min(r.width - 40, P + (i * (r.width - 2 * P)) / (days.length - 1))) + 'px';
      tip.classList.remove('hidden');
    };
    el.addEventListener('touchstart', show, { passive: true }); el.addEventListener('touchmove', show, { passive: true });
    el.addEventListener('mousemove', show); el.addEventListener('mouseleave', () => tip.classList.add('hidden'));
    el.addEventListener('touchend', () => setTimeout(() => tip.classList.add('hidden'), 1500));
  }

  const ROUTES = {};
  ROUTES.home = function () {
    const now = Date.now();
    const score = C.bizScore(S.attempts, S.level);
    const days = Object.keys(S.hist).sort();
    const weekAgoKey = C.dayKey(now - 7 * C.DAY);
    const prev = days.filter((d) => d <= weekAgoKey).pop();
    const delta = prev != null ? score - S.hist[prev] : null;
    const rk = C.rankOf(S.xp);
    const tXp = S.daily[today()] || 0, goal = S.settings.goal;
    const stk = C.streak(S.daily, goal, now);
    const due = EXPRESSIONS.filter((e) => e.lv <= S.level && S.srs[e.id] && S.srs[e.id].due <= now).length;
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    const sp = avgOf('speak'), dc = avgOf('dict'), iv = avgOf('iv');

    view.innerHTML = `
      ${!standalone ? `<div class="card" style="border:1px dashed var(--acc)"><b>📲 홈 화면에 추가하세요</b><p class="muted small">Safari 하단 공유 버튼 <b>⬆︎</b> → <b>홈 화면에 추가</b>. 앱처럼 바로 실행되고 오프라인(지하철)에서도 동작해요.</p></div>` : ''}
      ${!S.onboarded ? `<div class="card"><b>👋 처음이시네요!</b><p class="muted small">3분짜리 <b>실력 점검</b>으로 시작 레벨을 정해 드릴게요. (건너뛰면 Level 1부터)</p><div class="row"><button class="primary grow" data-act="test">실력 점검 시작</button><button class="ghost" data-act="skipOnb">건너뛰기</button></div></div>` : ''}
      <div class="hero">
        <div class="row"><span class="pill">${rk.icon} ${rk.name}</span><span class="pill">Lv${S.level} ${C.LEVELS[S.level]}</span><span class="grow"></span><button class="ghost" style="min-height:36px;padding:6px 10px" data-act="settings">⚙️</button></div>
        <div style="margin:14px 0 4px" class="muted small">BizTalk Score</div>
        <div class="row" style="align-items:flex-end"><div class="score">${score}</div><div class="muted">/1000</div><span class="grow"></span>
          ${delta != null ? `<div class="delta" style="color:${delta >= 0 ? 'var(--ok)' : 'var(--bad)'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} <span class="muted small">(7일 전 대비)</span></div>` : ''}</div>
        <div style="margin-top:14px" class="row small"><span>오늘 목표 ${tXp}/${goal} XP</span><span class="grow"></span><span>🔥 ${stk}일 연속</span></div>
        <div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, (tXp / goal) * 100)}%"></i></div>
        ${rk.next ? `<div class="muted small" style="margin-top:8px">다음 직급 ${rk.nextName}까지 ${rk.next - S.xp} XP</div>` : ''}
      </div>
      <div class="grid2">
        <button class="tile primary" data-act="speak"><span class="ic">🎤</span>스피킹 10문장<span class="sub" style="color:#e0e7ff">${due ? '복습 ' + due + '개 대기 중' : '새 표현 + 복습'}</span></button>
        <button class="tile" data-act="dict"><span class="ic">🎧</span>딕테이션<span class="sub">듣고 받아쓰기</span></button>
        <button class="tile" data-act="audio"><span class="ic">🚗</span>운전/지하철 모드<span class="sub">핸즈프리 반복</span></button>
        <button class="tile" data-act="iv"><span class="ic">💼</span>영어 면접<span class="sub">답변 피드백</span></button>
      </div>
      <h2>📈 점수 변화</h2>
      <div class="card">${chartSvg()}</div>
      <div class="grid3">
        <div class="stat"><b>${sp ?? '–'}</b><span>스피킹 정확도</span></div>
        <div class="stat"><b>${dc ?? '–'}</b><span>리스닝 정확도</span></div>
        <div class="stat"><b>${iv ?? '–'}</b><span>면접 점수</span></div>
      </div>
      <p class="muted small">최근 20회 평균. Score = 레벨 기본점(0/300/600) + 최근 30회 평균×4</p>
      <h2>🏅 배지</h2>
      <div class="badges">${C.BADGES.map(([id, e, name, desc]) => `<div class="badge ${S.badges[id] ? 'got' : ''}" title="${esc(desc)}"><span class="e">${e}</span>${esc(name)}</div>`).join('')}</div>
      <h2>📚 더보기</h2>
      <button class="list-item" data-act="lib"><span class="em">🗂️</span><span class="grow">표현 사전 <span class="muted small">· ${EXPRESSIONS.length}개 · 짤 넣기</span></span>›</button>
      <button class="list-item" data-act="test"><span class="em">🩺</span><span class="grow">실력 점검 다시 하기</span>›</button>
      <button class="list-item" data-act="settings"><span class="em">⚙️</span><span class="grow">설정 · 음성 · 백업</span>›</button>
    `;
    bind({
      speak: () => go('speak'), dict: () => go('dict'), audio: () => go('audio'), iv: () => go('iv'),
      lib: () => go('lib'), test: () => go('test'), settings: () => go('settings'),
      skipOnb: () => { S.onboarded = true; save(); go('home'); },
    });
    bindChart();
  };

  /* ═════════ 스피킹 세션 ═════════ */
  ROUTES.speak = function () {
    const items = C.pickSession(EXPRESSIONS, S.srs, S.level, 10, Date.now());
    const results = [];
    let idx = 0, typing = !Speech.srOK, hinted = 0, recHandle = null;

    function card() {
      const e = items[idx];
      hinted = 0;
      view.innerHTML = `
        ${progress(idx, items.length)}
        <div class="row muted small"><span>🎤 스피킹 ${idx + 1}/${items.length}</span><span class="grow"></span><span>${S.srs[e.id] ? '🔁 복습' : '🆕 새 표현'}</span></div>
        ${memeCard(e, { mask: true })}
        <div class="card"><h3>이 말을 영어로?</h3><div class="ko">${esc(e.ko)}</div><div id="hint" class="muted" style="margin-top:8px"></div></div>
        <div id="live" class="live hidden"></div>
        <div id="typebox" class="${typing ? '' : 'hidden'}"><textarea id="typed" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="영어로 입력 (키보드의 🎙️ 받아쓰기도 가능)"></textarea><button class="primary block big" style="margin-top:8px" data-act="submitTyped">제출</button></div>
        <button id="mic" class="primary block huge ${typing ? 'hidden' : ''}" data-act="mic">🎤 탭하고 말하기</button>
        <div class="grid3" style="margin-top:10px">
          <button data-act="hint">💡 힌트</button>
          <button data-act="reveal">👀 정답</button>
          <button data-act="toggleType">${typing ? '🎤 음성' : '⌨️ 입력'}</button>
        </div>
        <p class="muted small">힌트/정답을 보면 최대 80점으로 기록돼요.</p>`;
      bind({
        mic: startMic, hint: showHint, reveal: () => { hinted = 2; showAnswerThen(); },
        toggleType: () => { typing = !typing; card(); },
        submitTyped: () => { const v = $('#typed').value.trim(); if (!v) return toast('입력해 주세요'); evaluate(v); },
      });
    }
    function showHint() {
      const e = items[idx], w = e.en.split(' ');
      hinted = Math.max(hinted, 1);
      $('#hint').textContent = '💡 ' + w.slice(0, Math.ceil(w.length / 2)).join(' ') + ' …';
    }
    async function showAnswerThen() {
      const e = items[idx];
      $('#hint').innerHTML = '👀 <b style="color:var(--text)">' + esc(e.en) + '</b><br><span class="small">듣고 따라 말해보세요.</span>';
      await Speech.speak(e.en);
    }
    async function startMic(btn) {
      if (recHandle) { recHandle.stop(); return; }
      Speech.stop();
      const live = $('#live'); live.classList.remove('hidden'); live.textContent = '듣는 중… 말씀하세요';
      btn.classList.add('mic-on'); btn.textContent = '⏹ 말하기 끝내기';
      recHandle = Speech.listen({ onInterim: (s) => (live.textContent = s) });
      try {
        const said = await recHandle.promise;
        recHandle = null;
        if (!said) { btn.classList.remove('mic-on'); btn.textContent = '🎤 탭하고 말하기'; live.textContent = '음성이 들리지 않았어요. 다시 탭해서 말해보세요.'; return; }
        evaluate(said);
      } catch (code) {
        recHandle = null;
        toast(srErrorMsg(code), 5000);
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'unsupported' || Speech.srFails >= 2) { typing = true; }
        card();
      }
    }
    function evaluate(said) {
      const e = items[idx];
      const r = C.compare(e.en, said);
      let s = r.score;
      if (hinted) s = Math.min(s, 80);
      S.srs[e.id] = C.srsUpdate(S.srs[e.id], s, Date.now());
      const xp = record('speak', s, e.lv);
      results.push(s);
      showResult(e, r, s, said, xp);
    }
    function showResult(e, r, s, said, xp, retry) {
      const [em, msg] = reaction(r.score);
      view.innerHTML = `
        ${progress(idx + 1, items.length)}
        ${memeCard(e, { imgBtn: false })}
        <div class="card">
          <div class="result-head"><div class="react">${em}</div><div><div class="num">${r.score}<span class="muted small">점${s !== r.score ? ' (기록 ' + s + ')' : ''}</span></div><div class="muted small">${esc(msg)} ${retry ? '' : '· +' + xp + ' XP'}</div></div></div>
          <h3 style="margin-top:14px">정답과 비교</h3>
          <div class="diff">${diffHtml(r)}</div>
          <div class="legend"><b style="color:var(--ok)">초록</b> 맞음 · <b style="color:var(--near)">노랑</b> 비슷함 · <b style="color:var(--bad)">빨강</b> 빠짐 ${r.extra ? '· 불필요한 단어 ' + r.extra + '개' : ''}</div>
          <h3 style="margin-top:12px">내가 말한 것</h3><div class="muted">${esc(said)}</div>
          <h3 style="margin-top:12px">정답</h3><div class="en">${esc(e.en)}</div><div class="muted">${esc(e.ko)}</div>
          ${e.tip ? `<div class="tipbox">📝 ${esc(e.tip)}</div>` : ''}
        </div>
        <div class="grid2"><button data-act="listen">🔊 정답 듣기</button><button data-act="retry">🔁 다시 말하기</button></div>
        <button class="primary block big" style="margin-top:10px" data-act="next">${idx + 1 < items.length ? '다음 →' : '결과 보기'}</button>
        <p class="muted small">다시 말하기는 연습용(기록에 반영 안 됨)이에요.</p>`;
      bind({
        listen: () => Speech.speak(e.en),
        retry: async (btn) => {
          if (!Speech.srOK || typing) {
            const v = prompt('영어로 입력하세요'); if (v) showResult(e, C.compare(e.en, v), s, v, 0, true); return;
          }
          btn.classList.add('mic-on'); btn.textContent = '듣는 중…';
          try { const v = await Speech.listen().promise; if (v) showResult(e, C.compare(e.en, v), s, v, 0, true); else { btn.classList.remove('mic-on'); btn.textContent = '🔁 다시 말하기'; toast('음성이 들리지 않았어요'); } }
          catch (c) { toast(srErrorMsg(c), 4000); btn.classList.remove('mic-on'); btn.textContent = '🔁 다시 말하기'; }
        },
        next: () => { idx++; if (idx < items.length) card(); else summary(); },
      });
      if (r.score < 100) Speech.speak(e.en);
    }
    function summary() { sessionSummary('🎤 스피킹 세션 완료', results, () => go('speak')); }
    cleanupFns.push(() => { if (recHandle) recHandle.stop(); });
    card();
  };

  function sessionSummary(title, results, again) {
    const a = Math.round(C.avg(results));
    const [em, msg] = reaction(a);
    view.innerHTML = `
      <h1>${title}</h1>
      <div class="card" style="text-align:center"><div style="font-size:64px">${em}</div><div style="font-size:44px;font-weight:800">${a}<span class="muted small">점 평균</span></div><p class="muted">${esc(msg)}</p>
      <div class="row" style="justify-content:center;gap:6px;flex-wrap:wrap">${results.map((s) => `<span class="pill" style="background:${s >= 85 ? 'rgba(74,222,128,.2)' : s >= 60 ? 'rgba(251,191,36,.2)' : 'rgba(248,113,113,.2)'}">${s}</span>`).join('')}</div></div>
      ${levelReview()}
      <div class="grid2"><button class="primary big" data-act="again">한 세트 더</button><button class="big" data-act="home">홈으로</button></div>`;
    bind({ again, home: () => go('home'), lvdown: () => { S.level = Math.max(1, S.level - 1); save(); toast('Level ' + S.level + '로 조정했어요'); go('home'); } });
  }

  /* ═════════ 딕테이션 ═════════ */
  ROUTES.dict = function () {
    const items = C.pickSession(ALL_DICT, S.dsrs, S.level, 10, Date.now());
    const results = [];
    let idx = 0;
    function card() {
      const e = items[idx];
      view.innerHTML = `
        ${progress(idx, items.length)}
        <div class="row muted small"><span>🎧 딕테이션 ${idx + 1}/${items.length}</span><span class="grow"></span><span class="pill">Lv${e.lv}</span></div>
        <div class="card" style="text-align:center">
          <div style="font-size:56px">🎧</div>
          <div class="grid2" style="margin-top:10px"><button class="primary big" data-act="play">▶︎ 듣기</button><button class="big" data-act="slow">🐢 느리게</button></div>
          <button class="ghost block" style="margin-top:10px" data-act="meaning">뜻 보기</button>
          <div id="meaning" class="muted hidden" style="margin-top:8px">${esc(e.ko)}</div>
        </div>
        <textarea id="ans" autocapitalize="sentences" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="들은 문장을 입력하세요"></textarea>
        <button class="primary block big" style="margin-top:10px" data-act="check">채점</button>
        <p class="muted small">대소문자·문장부호는 채점에 영향 없음. 축약형(I'll ↔ I will)은 같은 답으로 인정.</p>`;
      bind({
        play: () => Speech.speak(e.en), slow: () => Speech.speak(e.en, { rate: 0.7 }),
        meaning: () => $('#meaning').classList.toggle('hidden'),
        check: () => {
          const v = $('#ans').value.trim(); if (!v) return toast('입력해 주세요');
          const r = C.compare(e.en, v);
          S.dsrs[e.id] = C.srsUpdate(S.dsrs[e.id], r.score, Date.now());
          const xp = record('dict', r.score, e.lv); results.push(r.score);
          const [em, msg] = reaction(r.score);
          view.innerHTML = `
            ${progress(idx + 1, items.length)}
            <div class="card">
              <div class="result-head"><div class="react">${em}</div><div><div class="num">${r.score}<span class="muted small">점</span></div><div class="muted small">${esc(msg)} · +${xp} XP</div></div></div>
              <h3 style="margin-top:14px">채점</h3><div class="diff">${diffHtml(r)}</div>
              <div class="legend"><b style="color:var(--ok)">초록</b> 맞음 · <b style="color:var(--near)">노랑</b> 철자 근접 · <b style="color:var(--bad)">빨강</b> 놓침</div>
              <h3 style="margin-top:12px">정답</h3><div class="en">${esc(e.en)}</div><div class="muted">${esc(e.ko)}</div>
              <h3 style="margin-top:12px">내 답</h3><div class="muted">${esc(v)}</div>
            </div>
            <div class="grid2"><button data-act="play">🔊 다시 듣기</button><button data-act="slow">🐢 느리게</button></div>
            <button class="primary block big" style="margin-top:10px" data-act="next">${idx + 1 < items.length ? '다음 →' : '결과 보기'}</button>`;
          bind({
            play: () => Speech.speak(e.en), slow: () => Speech.speak(e.en, { rate: 0.7 }),
            next: () => { idx++; if (idx < items.length) card(); else sessionSummary('🎧 딕테이션 완료', results, () => go('dict')); },
          });
        },
      });
      Speech.speak(e.en);
    }
    view.innerHTML = `<h1>🎧 딕테이션</h1><div class="card"><p>문장을 듣고 그대로 받아 적어요. 자주 쓰는 표현부터, 틀린 문장은 다시 출제됩니다.</p><p class="muted small">🔇 무음 모드에서는 소리가 안 날 수 있어요. 측면 스위치를 확인하세요.</p></div><button class="primary block huge" data-act="start">▶︎ 시작 (10문장)</button>`;
    bind({ start: card });
  };

  /* ═════════ 면접 ═════════ */
  ROUTES.iv = function () {
    view.innerHTML = `<h1>💼 영어 면접 대비</h1>
      <div class="card"><p class="small">질문을 듣고 <b>60~90초</b> 답변 → 핵심 포인트·길이·말하기 속도·군말 피드백 → 모범답안 쉐도잉.</p><p class="muted small">모범답안의 <b>[ ]</b> 부분은 본인 정보로 바꿔 말하세요.</p></div>
      <button class="primary block big" data-act="rand">🎲 랜덤 질문</button>
      <h2>질문 목록</h2>
      ${INTERVIEW.map((q) => `<button class="list-item" data-act="q" data-id="${q.id}"><span class="em">${S.iv[q.id] != null ? (S.iv[q.id] >= 80 ? '✅' : '🟡') : '⬜'}</span><span class="grow">${esc(q.q)}<br><span class="muted small">${esc(q.ko)}${S.iv[q.id] != null ? ' · 최고 ' + S.iv[q.id] + '점' : ''}</span></span>›</button>`).join('')}`;
    bind({
      rand: () => { const pool = INTERVIEW.filter((q) => (S.iv[q.id] || 0) < 80); ivQuestion(shuffle(pool.length ? pool : INTERVIEW)[0]); },
      q: (el) => ivQuestion(INTERVIEW.find((q) => q.id === el.dataset.id)),
    });
  };
  function ivQuestion(q) {
    let rec = null, t0 = 0, text = '';
    Speech.stop();
    view.innerHTML = `
      <button class="ghost" data-act="back">‹ 목록</button>
      <div class="card" style="margin-top:10px"><h3>Interviewer</h3><div class="en" style="font-size:22px">${esc(q.q)}</div><div class="muted">${esc(q.ko)}</div>
      <button style="margin-top:10px" data-act="hear">🔊 질문 다시 듣기</button></div>
      <div id="live" class="live">${Speech.srOK ? '🎤 버튼을 누르고 답변하세요. 끝나면 다시 눌러 종료.' : '아래에 답변을 입력하세요 (키보드 🎙️ 받아쓰기 가능).'}</div>
      ${Speech.srOK ? '<button id="mic" class="primary block huge" data-act="mic">🎤 답변 시작</button>' : ''}
      <details style="margin-top:10px"${Speech.srOK ? '' : ' open'}><summary class="muted">⌨️ 입력으로 답변</summary><textarea id="typed" placeholder="Type your answer…"></textarea><button class="block" style="margin-top:8px" data-act="submitTyped">제출</button></details>
      ${q.tip ? `<div class="tipbox">💡 ${esc(q.tip)}</div>` : ''}`;
    bind({
      back: () => go('iv'), hear: () => Speech.speak(q.q),
      submitTyped: () => { const v = $('#typed').value.trim(); if (!v) return toast('답변을 입력하세요'); ivResult(q, v, 0); },
      mic: async (btn) => {
        if (rec) { rec.stop(); return; }
        Speech.stop();
        await Speech.beep();
        btn.classList.add('mic-on'); btn.textContent = '⏹ 답변 끝내기';
        t0 = Date.now(); text = '';
        rec = Speech.listen({ continuous: true, maxMs: 180000, onInterim: (s) => { text = s; $('#live').textContent = s; } });
        try {
          const said = await rec.promise; rec = null;
          const sec = (Date.now() - t0) / 1000;
          if (!said.trim()) { btn.classList.remove('mic-on'); btn.textContent = '🎤 답변 시작'; toast('음성이 인식되지 않았어요'); return; }
          ivResult(q, said, sec);
        } catch (c) {
          rec = null; btn.classList.remove('mic-on'); btn.textContent = '🎤 답변 시작';
          if (text) ivResult(q, text, (Date.now() - t0) / 1000); else toast(srErrorMsg(c), 5000);
        }
      },
    });
    cleanupFns.push(() => { if (rec) rec.stop(); });
    Speech.speak(q.q);
  }
  function ivResult(q, said, sec) {
    const r = C.evalInterview(q, said, sec);
    const xp = record('iv', r.score, S.level);
    S.iv[q.id] = Math.max(S.iv[q.id] || 0, r.score); save();
    const [em] = reaction(r.score);
    view.innerHTML = `
      <div class="card">
        <div class="result-head"><div class="react">${em}</div><div><div class="num">${r.score}<span class="muted small">점</span></div><div class="muted small">${r.n}단어${r.wpm ? ' · ' + r.wpm + ' WPM' : ''} · +${xp} XP</div></div></div>
        <h3 style="margin-top:14px">피드백</h3><ul class="fb">${r.fb.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <h3 style="margin-top:10px">핵심 포인트 (${r.hits.filter(Boolean).length}/${q.kw.length})</h3>
        <div>${q.kw.map((k, i) => `<span class="kw ${r.hits[i] ? 'hit' : 'no'}">${r.hits[i] ? '✓' : '✗'} ${esc(k.split('|')[0])}</span>`).join('')}</div>
        <h3 style="margin-top:12px">내 답변</h3><div class="muted small">${esc(said)}</div>
      </div>
      <div class="card"><h3>⭐ 모범 답안</h3><div class="en" style="font-size:17px">${esc(q.a)}</div>
        <div class="grid2" style="margin-top:10px"><button data-act="model">🔊 듣기</button><button data-act="modelSlow">🐢 느리게</button></div></div>
      <div class="grid2"><button class="primary big" data-act="again">🔁 다시 답변</button><button class="big" data-act="list">목록</button></div>`;
    bind({ model: () => Speech.speak(q.a), modelSlow: () => Speech.speak(q.a, { rate: 0.75 }), again: () => ivQuestion(q), list: () => go('iv') });
  }

  /* ═════════ 오디오 모드 (운전 / 지하철) ═════════ */
  const AUDIO_MODES = {
    drive: ['🚗', '드라이브 회화', '한국어 → 내가 영어로 말하기 → 채점 → 정답. 마이크 사용.'],
    shadow: ['🗣️', '쉐도잉', '한국어 → 3초 생각 → 영어 2회(느리게). 마이크 없이 따라 말하기.'],
    listen: ['🚇', '리스닝 루프', '영어만 2회 반복 + 화면에 뜻. 지하철용.'],
    iv: ['💼', '면접 리스닝', '면접 질문 → 모범답안. 이동 중 답변 흡수.'],
  };
  ROUTES.audio = function () {
    let mode = S.settings.audioMode || 'shadow', count = S.settings.audioCount || 10;
    function render() {
      view.innerHTML = `<h1>🚗 오디오 모드</h1>
        <div class="card"><p class="small">⚠️ <b>운전 중에는 화면을 보지 마세요.</b> 시작 전에 거치대에 두고 시작 버튼만 누르면 끝까지 자동 진행돼요.</p>
        <p class="muted small">iOS는 화면이 잠기면 음성이 멈춰요. 진행 중 화면 꺼짐을 자동으로 막습니다(iOS 16.4+). 안 되면 설정 > 디스플레이 > 자동 잠금 시간을 늘려주세요.</p></div>
        ${Object.entries(AUDIO_MODES).map(([k, [e, n, d]]) => `<button class="list-item" data-act="mode" data-k="${k}" style="${mode === k ? 'outline:2px solid var(--acc)' : ''}"><span class="em">${e}</span><span class="grow"><b>${n}</b><br><span class="muted small">${d}</span></span>${mode === k ? '✓' : ''}</button>`).join('')}
        ${mode === 'drive' && !Speech.srOK ? '<p class="small" style="color:var(--near)">이 기기는 음성인식이 안 돼서 쉐도잉으로 진행됩니다.</p>' : ''}
        <label>문장 수</label>
        <div class="chips">${[10, 20, 30, 0].map((n) => `<button data-act="cnt" data-n="${n}" class="${count === n ? 'on' : ''}">${n || '무한 반복'}</button>`).join('')}</div>
        <button class="primary block huge" data-act="start">▶︎ 시작</button>`;
      bind({
        mode: (el) => { mode = el.dataset.k; S.settings.audioMode = mode; save(); render(); },
        cnt: (el) => { count = +el.dataset.n; S.settings.audioCount = count; save(); render(); },
        start: () => runAudio(mode, count),
      });
    }
    render();
  };

  function runAudio(mode, count) {
    let alive = true, paused = false, skip = false, done = 0, srStreakFail = 0;
    if (mode === 'drive' && !Speech.srOK) mode = 'shadow';
    keepAwake(true);
    const onVis = () => { if (document.visibilityState === 'visible' && alive) keepAwake(true); };
    document.addEventListener('visibilitychange', onVis);
    cleanupFns.push(() => { alive = false; document.removeEventListener('visibilitychange', onVis); keepAwake(false); });

    view.innerHTML = `<div class="audio-stage">
        <div class="phase" id="ph">READY</div>
        <div class="emo" id="em">${AUDIO_MODES[mode][0]}</div>
        <div class="main" id="mn"></div>
        <div class="sub" id="sb"></div>
        <div class="muted small" id="ct"></div>
      </div>
      <div class="grid2"><button class="big" data-act="pause" id="pz">⏸ 일시정지</button><button class="big" data-act="skip">⏭ 다음</button></div>
      <button class="danger block huge" style="margin-top:12px" data-act="stop">⏹ 종료</button>`;
    const set = (ph, em, mn, sb) => { if (!alive) return; $('#ph').textContent = ph; if (em != null) $('#em').textContent = em; $('#mn').textContent = mn || ''; $('#sb').textContent = sb || ''; $('#ct').textContent = (done + 1) + (count ? ' / ' + count : '') + ' · ' + AUDIO_MODES[mode][1]; };
    bind({
      stop: () => { alive = false; Speech.stop(); finish(); },
      skip: () => { skip = true; Speech.stop(); },
      pause: (b) => { paused = !paused; b.textContent = paused ? '▶︎ 계속' : '⏸ 일시정지'; if (paused) Speech.stop(); },
    });
    const gate = async () => { while (alive && paused) await sleep(300); return alive && !skip; };
    const say = async (t, o) => { if (!(await gate())) return; await Speech.speak(t, o); };
    const wait = async (ms) => { const end = Date.now() + ms; while (alive && !skip && Date.now() < end) { await sleep(150); if (paused) await gate(); } };

    async function loop() {
      let queue = [];
      while (alive && (!count || done < count)) {
        if (!queue.length) {
          queue = mode === 'iv' ? shuffle(INTERVIEW) : C.pickSession(mode === 'listen' ? ALL_DICT : EXPRESSIONS, mode === 'listen' ? S.dsrs : S.srs, S.level, 10, Date.now());
          if (mode !== 'iv') queue = shuffle(queue);
        }
        const e = queue.shift();
        skip = false;
        try {
          if (mode === 'iv') {
            set('QUESTION', '💼', e.q, e.ko); await say(e.q); await wait(4000);
            set('MODEL ANSWER', '⭐', e.q, e.a); await say(e.a); await wait(2000);
          } else if (mode === 'listen') {
            set('LISTEN', '🎧', e.en, e.ko); await say(e.en); await wait(1500); await say(e.en, { rate: 0.85 }); await wait(2000);
          } else if (mode === 'shadow') {
            set('한국어', e.m ? e.m[0] : '🗣️', e.ko, '영어로 떠올려 보세요'); if (S.settings.koPrompt) await say(e.ko, { lang: 'ko-KR' }); await wait(3500);
            set('ENGLISH', null, e.en, e.ko); await say(e.en); await wait(2500);
            set('REPEAT', null, e.en, '따라 말하세요'); await say(e.en, { rate: 0.85 }); await wait(Math.max(2500, e.en.length * 70));
          } else { // drive
            set('한국어', e.m[0], e.ko, '삐 소리 후 영어로 말하세요'); await say(e.ko, { lang: 'ko-KR' });
            if (await gate()) {
              await Speech.beep();
              set('🎤 LISTENING', '🎤', e.ko, '말씀하세요…');
              let said = '';
              try { said = await Speech.listen({ noSpeechMs: 6000, onInterim: (s) => alive && ($('#sb').textContent = s) }).promise; srStreakFail = 0; }
              catch (c) {
                srStreakFail++;
                if (srStreakFail >= 2) { mode = 'shadow'; await say('Voice recognition is not working. Switching to shadowing mode.'); toast(srErrorMsg(c), 5000); continue; }
              }
              if (alive && !skip) {
                if (said) {
                  const r = C.compare(e.en, said);
                  S.srs[e.id] = C.srsUpdate(S.srs[e.id], r.score, Date.now()); record('speak', r.score, e.lv);
                  const [em, msg] = reaction(r.score);
                  set('SCORE ' + r.score, em, e.en, msg);
                  await say(r.score >= 85 ? 'Great!' : r.score >= 60 ? 'Almost. Listen.' : 'Here is the answer.');
                } else { set('ANSWER', '👂', e.en, e.ko); }
                await say(e.en); await wait(1200);
                if (said && C.compare(e.en, said).score < 85) { await say(e.en, { rate: 0.85 }); await wait(2500); }
              }
            }
          }
        } catch (err) { console.error(err); }
        if (!alive) break;
        done++;
        S.audio++; save();
        if (done === 10) checkBadges();
        await sleep(400);
      }
      if (alive) { alive = false; await Speech.speak('Session complete. Great job!'); finish(); }
    }
    function finish() {
      keepAwake(false);
      if (done >= 3) record('audio', 0, S.level, { xp: done * 2, xpOnly: true });
      view.innerHTML = `<h1>✅ 오디오 세션 종료</h1><div class="card" style="text-align:center"><div style="font-size:60px">🎧</div><p><b>${done}</b>문장 진행 · +${done >= 3 ? done * 2 : 0} XP</p><p class="muted small">3문장 이상 진행 시 XP 지급</p></div>${levelReview()}<div class="grid2"><button class="primary big" data-act="again">다시</button><button class="big" data-act="home">홈</button></div>`;
      bind({ again: () => go('audio'), home: () => go('home'), lvdown: () => { S.level = Math.max(1, S.level - 1); save(); go('home'); } });
    }
    loop();
  }

  /* ═════════ 실력 점검 ═════════ */
  ROUTES.test = function () {
    const useMic = Speech.srOK;
    const plan = [];
    for (const lv of [1, 2, 3]) {
      const ex = shuffle(EXPRESSIONS.filter((e) => e.lv === lv));
      const dx = shuffle(ALL_DICT.filter((e) => e.lv === lv && !ex.slice(0, 1).includes(e)));
      plan.push({ type: 'dict', e: dx[0], lv }, { type: useMic ? 'speak' : 'dict', e: ex[0], lv }, { type: 'dict', e: dx[1], lv });
    }
    const res = [];
    let idx = 0;
    view.innerHTML = `<h1>🩺 실력 점검</h1><div class="card"><p>레벨별 3문항씩 총 9문항 (딕테이션${useMic ? ' + 스피킹' : ''}). 약 3분.</p><p class="muted small">결과에 따라 시작 레벨이 자동 설정되고, 점수 그래프의 기준점이 됩니다.</p></div><button class="primary block huge" data-act="go">시작</button>`;
    bind({ go: step });
    function step() {
      if (idx >= plan.length) return done();
      const it = plan[idx], e = it.e;
      if (it.type === 'dict') {
        view.innerHTML = `${progress(idx, plan.length)}<div class="muted small">🩺 ${idx + 1}/${plan.length} · 듣고 받아쓰기</div>
          <div class="card" style="text-align:center"><div class="grid2"><button class="primary big" data-act="play">▶︎ 듣기</button><button class="big" data-act="slow">🐢 느리게</button></div></div>
          <textarea id="ans" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="들은 문장 입력"></textarea>
          <div class="grid2" style="margin-top:10px"><button data-act="pass">모르겠음</button><button class="primary" data-act="ok">제출</button></div>`;
        bind({
          play: () => Speech.speak(e.en), slow: () => Speech.speak(e.en, { rate: 0.7 }),
          pass: () => finishItem(0), ok: () => finishItem(C.compare(e.en, $('#ans').value).score),
        });
        Speech.speak(e.en);
      } else {
        view.innerHTML = `${progress(idx, plan.length)}<div class="muted small">🩺 ${idx + 1}/${plan.length} · 영어로 말하기</div>
          <div class="card"><div class="ko">${esc(e.ko)}</div></div><div id="live" class="live"></div>
          <button class="primary block huge" data-act="mic" id="mic">🎤 탭하고 말하기</button>
          <button class="ghost block" style="margin-top:10px" data-act="pass">모르겠음</button>`;
        let h = null;
        bind({
          pass: () => { if (h) h.stop(); finishItem(0); },
          mic: async (b) => {
            if (h) { h.stop(); return; }
            b.classList.add('mic-on'); b.textContent = '⏹ 끝내기';
            h = Speech.listen({ onInterim: (s) => ($('#live').textContent = s) });
            try { const s = await h.promise; h = null; if (!s) { b.classList.remove('mic-on'); b.textContent = '🎤 다시 말하기'; return; } finishItem(C.compare(e.en, s).score); }
            catch (c) { h = null; toast(srErrorMsg(c), 4000); plan[idx] = { type: 'dict', e, lv: it.lv }; step(); }
          },
        });
      }
    }
    function finishItem(score) {
      Speech.stop();
      res.push({ lv: plan[idx].lv, s: score });
      record(plan[idx].type === 'speak' ? 'speak' : 'dict', score, plan[idx].lv);
      idx++; step();
    }
    function done() {
      const by = (lv) => Math.round(C.avg(res.filter((r) => r.lv === lv).map((r) => r.s)));
      let lv = 1;
      if (by(1) >= 75) lv = 2;
      if (lv === 2 && by(2) >= 75) lv = 3;
      S.level = lv; S.maxLv = Math.max(S.maxLv, lv); S.onboarded = true;
      S.hist[today()] = C.bizScore(S.attempts, S.level);
      save(); checkBadges(); confetti();
      view.innerHTML = `<h1>🩺 점검 결과</h1>
        <div class="card">${[1, 2, 3].map((l) => `<div class="row" style="margin:8px 0"><span style="width:110px">Lv${l} ${C.LEVELS[l]}</span><div class="bar grow"><i style="width:${by(l)}%"></i></div><b style="width:40px;text-align:right">${by(l)}</b></div>`).join('')}</div>
        <div class="card" style="text-align:center"><p class="muted">추천 시작 레벨</p><div style="font-size:40px;font-weight:800">Level ${lv}</div><p>${C.LEVELS[lv]}</p><p class="muted small">각 레벨 75점 이상이면 다음 레벨로 배정. 연습 중 정확도 85% 이상을 유지하면 자동 승급돼요.</p></div>
        <button class="primary block big" data-act="home">홈으로</button>`;
      bind({ home: () => go('home') });
    }
  };

  /* ═════════ 표현 사전 ═════════ */
  ROUTES.lib = function (state) {
    state = state || { lv: 0, cat: '' };
    const list = EXPRESSIONS.filter((e) => (!state.lv || e.lv === state.lv) && (!state.cat || e.cat === state.cat));
    view.innerHTML = `<div class="row"><button class="ghost" data-act="home">‹ 홈</button><h1 class="grow" style="margin:0 0 0 8px">🗂️ 표현 사전</h1></div>
      <div class="chips" style="margin-top:12px">${[0, 1, 2, 3].map((l) => `<button data-act="lv" data-v="${l}" class="${state.lv === l ? 'on' : ''}">${l ? 'Lv' + l : '전체'}</button>`).join('')}</div>
      <div class="chips">${[['', '전체 분야']].concat(Object.entries(CATS)).map(([k, v]) => `<button data-act="cat" data-v="${k}" class="${state.cat === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      <p class="muted small">${list.length}개 · 위에 있을수록 자주 쓰는 표현 · ⭐ = 숙련도</p>
      ${list.map((e) => { const st = S.srs[e.id]; const stars = st ? '⭐'.repeat(Math.min(5, st.b)) || '·' : ''; return `<button class="list-item" data-act="open" data-id="${e.id}"><span class="em">${e.m[0]}</span><span class="grow"><b>${esc(e.en)}</b><br><span class="muted small">${esc(e.ko)}</span></span><span class="small">${stars}</span></button>`; }).join('')}`;
    bind({
      home: () => go('home'),
      lv: (el) => ROUTES.lib({ ...state, lv: +el.dataset.v }), cat: (el) => ROUTES.lib({ ...state, cat: el.dataset.v }),
      open: (el) => openExpr(EXPRESSIONS.find((x) => x.id === el.dataset.id), state),
    });
  };
  function openExpr(e, state) {
    view.innerHTML = `<button class="ghost" data-act="back">‹ 목록</button><div style="height:10px"></div>
      ${memeCard(e)}
      <div class="card"><div class="en">${esc(e.en)}</div><div class="muted">${esc(e.ko)}</div>${e.tip ? `<div class="tipbox">📝 ${esc(e.tip)}</div>` : ''}</div>
      <div class="grid2"><button class="primary big" data-act="play">🔊 듣기</button><button class="big" data-act="slow">🐢 느리게</button></div>
      <p class="muted small">🖼️ 좋아하는 밈/짤 이미지를 사진첩에서 골라 이 카드에 붙일 수 있어요. 기기 안에만 저장됩니다.</p>`;
    bind({
      back: () => ROUTES.lib(state), play: () => Speech.speak(e.en), slow: () => Speech.speak(e.en, { rate: 0.7 }),
      setimg: () => imgMenu(e.id, () => openExpr(e, state)),
    });
  }
  // 세션 화면의 '내 짤 넣기' 버튼 (이벤트 위임)
  view.addEventListener('click', (ev) => {
    const b = ev.target.closest('.imgbtn');
    if (!b || b.onclick) return;
    imgMenu(b.dataset.id, () => {
      const card = b.closest('.meme'); const img = getImg(b.dataset.id);
      if (card) { card.classList.toggle('img', !!img); card.style.backgroundImage = img ? `url('${img}')` : ''; b.textContent = img ? '🖼️ 짤 변경' : '🖼️ 내 짤 넣기'; }
    });
  });

  /* ═════════ 설정 ═════════ */
  ROUTES.settings = function () {
    const vs = Speech.enVoices();
    const cur = (Speech.pick('en-US') || {}).voiceURI || '';
    view.innerHTML = `<div class="row"><button class="ghost" data-act="home">‹ 홈</button><h1 class="grow" style="margin:0 0 0 8px">⚙️ 설정</h1></div>
      <div class="card">
        <label>영어 음성</label>
        <select id="voice">${vs.length ? vs.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === cur ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})${/(premium|enhanced|향상)/i.test(v.name) ? ' ★' : ''}</option>`).join('') : '<option>기본 음성</option>'}</select>
        <button style="margin-top:8px" data-act="test">🔊 미리 듣기</button>
        <div class="tipbox">🎙️ <b>더 자연스러운 음성 받기</b><br>iPhone 설정 → 손쉬운 사용 → 콘텐츠 읽어주기(읽기 및 말하기) → 음성 → 영어 → <b>Ava / Zoe / Evan (프리미엄·향상됨)</b> 다운로드 후 이 앱을 다시 열면 목록에 ★로 표시돼요 (iOS 버전에 따라 웹에 노출되지 않을 수 있음).</div>
        <label>말하기 속도: <span id="rv">${S.settings.rate.toFixed(2)}</span>×</label>
        <input type="range" id="rate" min="0.6" max="1.3" step="0.05" value="${S.settings.rate}" style="width:100%">
        <label><input type="checkbox" id="ko" ${S.settings.koPrompt ? 'checked' : ''}> 쉐도잉 모드에서 한국어 뜻 읽어주기</label>
      </div>
      <div class="card">
        <label>하루 목표</label>
        <div class="chips">${[30, 50, 100, 150].map((g) => `<button data-act="goal" data-g="${g}" class="${S.settings.goal === g ? 'on' : ''}">${g} XP${g === 50 ? ' (약 10분)' : ''}</button>`).join('')}</div>
        <label>난이도 직접 선택 (현재 Lv${S.level})</label>
        <div class="chips">${[1, 2, 3].map((l) => `<button data-act="lv" data-l="${l}" class="${S.level === l ? 'on' : ''}">Lv${l} ${C.LEVELS[l]}</button>`).join('')}</div>
      </div>
      <div class="card">
        <h3>데이터 (이 기기에만 저장)</h3>
        <p class="muted small">Safari 방문 기록·웹사이트 데이터 삭제 시 기록이 사라질 수 있어요. 가끔 백업하세요.</p>
        <div class="grid2"><button data-act="exp">📤 백업 내보내기</button><button data-act="imp">📥 백업 불러오기</button></div>
        <button class="danger block" style="margin-top:10px" data-act="reset">모든 기록 초기화</button>
      </div>
      <p class="muted small" style="text-align:center">BizTalk v1 · 오프라인 동작 · 서버 전송 없음</p>`;
    bind({
      home: () => go('home'),
      test: () => { S.settings.voice = $('#voice').value; save(); Speech.speak("Thank you for your patience. I'll keep you posted."); },
      goal: (el) => { S.settings.goal = +el.dataset.g; save(); ROUTES.settings(); },
      lv: (el) => { S.level = +el.dataset.l; S.maxLv = Math.max(S.maxLv, S.level); save(); checkBadges(); ROUTES.settings(); toast('Level ' + S.level + ' 적용'); },
      exp: () => {
        const imgs = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('bizeng.img.')) imgs[k] = localStorage.getItem(k); }
        const blob = new Blob([JSON.stringify({ state: S, imgs })], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'biztalk-backup-' + today() + '.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      },
      imp: () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = async () => {
          try {
            const d = JSON.parse(await inp.files[0].text());
            if (!d.state || !Array.isArray(d.state.attempts)) throw new Error('bad');
            localStorage.setItem(KEY, JSON.stringify(d.state));
            for (const [k, v] of Object.entries(d.imgs || {})) if (k.startsWith('bizeng.img.')) localStorage.setItem(k, v);
            S = load(); toast('✅ 복원 완료'); go('home');
          } catch (e) { toast('⚠️ 올바른 백업 파일이 아니에요'); }
        };
        inp.click();
      },
      reset: () => { if (confirm('정말 모든 기록을 지울까요? (되돌릴 수 없음)')) { localStorage.removeItem(KEY); S = load(); go('home'); } },
    });
    $('#voice').onchange = (ev) => { S.settings.voice = ev.target.value; save(); };
    $('#rate').oninput = (ev) => { S.settings.rate = +ev.target.value; $('#rv').textContent = S.settings.rate.toFixed(2); save(); };
    $('#ko').onchange = (ev) => { S.settings.koPrompt = ev.target.checked; save(); };
  };

  /* ═════════ 시작 ═════════ */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 캐시 실패해도 앱은 동작 */ });
  }
  const startTab = (location.hash || '').replace('#', '');
  go(ROUTES[startTab] ? startTab : 'home');
})();
