/* BizTalk — 변리사 비즈니스 영어 PWA */
(function () {
  'use strict';
  const { CATS, EXPRESSIONS, INTERVIEW } = window.APP_DATA;
  const { FR_UNITS } = window.FR_DATA;
  const { DAILY_TOPICS } = window.DAILY_DATA;
  CATS.daily = '일상회화';
  const DAILY = DAILY_TOPICS.flatMap((t) => t.items.map(([en, ko], i) => ({ id: t.id + '-' + String(i + 1).padStart(2, '0'), lv: 1, cat: 'daily', topic: t.id, en, ko, m: [t.e, t.title] })));
  const storeOf = (e) => (e.cat === 'daily' ? S.csrs : S.srs);
  const FR_ITEMS = FR_UNITS.flatMap((u) => u.items.map((it) => Object.assign({ unit: u.id }, it)));
  const C = window.CORE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#view');
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ═════════ 저장소 ═════════ */
  const APP_VERSION = '2.1 (11/15) · 테마 · 다시 말하기';
  const KEY = 'bizeng.v1';
  const DEF = {
    v: 1, level: 1, maxLv: 1, xp: 0, daily: {}, attempts: [], srs: {}, csrs: {}, dsrs: {}, iv: {}, badges: {},
    bestStreak: 0, audio: 0, hist: {}, goalDays: {}, onboarded: false, fr: { srs: {}, att: [] },
    settings: { voice: '', rate: 0.95, goal: 50, koPrompt: true, natural: true },
  };
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw) return JSON.parse(JSON.stringify(DEF));
      const s = Object.assign(JSON.parse(JSON.stringify(DEF)), raw);
      s.settings = Object.assign({}, DEF.settings, raw.settings || {});
      s.fr = Object.assign({ srs: {}, att: [] }, raw.fr || {});
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
    let current = null, actx = null, srFails = 0;

    function loadVoices() { try { voices = synth ? synth.getVoices() : []; } catch (e) { voices = []; } }
    if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }

    const GOOD = /(premium|enhanced|향상|samantha|ava|zoe|evan|nathan|allison|susan|tom|daniel|karen|serena|google us english|natural)/i;
    function enVoices() { return voices.filter((v) => /^en[-_]/i.test(v.lang)); }
    function pick(lang) {
      if (lang.startsWith('ko')) return voices.find((v) => /^ko/i.test(v.lang)) || null;
      if (lang.startsWith('fr')) {
        const fr = voices.filter((v) => /^fr/i.test(v.lang)), ff = fr.filter((v) => /fr[-_]FR/i.test(v.lang));
        return ff.find((v) => /(premium|enhanced|향상)/i.test(v.name)) || ff.find((v) => /(thomas|audrey|aurelie|aurélie|google)/i.test(v.name)) || ff[0] || fr[0] || null;
      }
      if (S.settings.voice) { const v = voices.find((x) => x.voiceURI === S.settings.voice); if (v) return v; }
      const en = enVoices();
      const us = en.filter((v) => /en[-_]US/i.test(v.lang));
      return us.find((v) => /(premium|enhanced|향상)/i.test(v.name)) || us.find((v) => GOOD.test(v.name)) || us[0] || en[0] || null;
    }
    /* ── 자연스러운 AI 음성 파일 (audio/<lang>/<hash>.mp3), 없으면 기기 음성으로 대체 ── */
    const AUD = new Audio();
    AUD.preload = 'auto';
    const FILES = {};
    for (const [l, arr] of Object.entries(window.AUDIO_FILES || {})) FILES[l] = new Set(arr);
    function fnv(str) {
      let h = 0x811c9dc5;
      for (const b of new TextEncoder().encode(str)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
      return h.toString(16).padStart(8, '0');
    }
    function fileFor(text, lang) {
      const l = lang.slice(0, 2);
      if (S.settings.natural === false || !FILES[l]) return null;
      const h = fnv(l + '|' + text);
      return FILES[l].has(h) ? 'audio/' + l + '/' + h + '.mp3' : null;
    }
    // iOS: 첫 터치 때 오디오 재생 권한 확보 (운전 모드 등 연속 재생용)
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return; unlocked = true;
      try { AUD.src = 'audio/silence.mp3'; const p = AUD.play(); if (p) p.catch(() => { unlocked = false; }); } catch (e) { unlocked = false; }
    };
    document.addEventListener('touchend', unlock, { capture: true });
    document.addEventListener('click', unlock, { capture: true });
    let audFin = null;
    function playFile(url, rate) {
      return new Promise((resolve) => {
        let done = false, tm;
        const end = (ok) => { if (done) return; done = true; clearTimeout(tm); AUD.onended = AUD.onerror = AUD.onplaying = null; audFin = null; resolve(ok); };
        audFin = () => { try { AUD.pause(); } catch (e) { /* noop */ } end(true); };
        AUD.onended = () => end(true);
        AUD.onerror = () => end(false);
        AUD.onplaying = () => {
          clearTimeout(tm);
          const d = isFinite(AUD.duration) ? AUD.duration : 30;
          tm = setTimeout(() => end(true), (d / rate) * 1000 + 2500);
        };
        tm = setTimeout(() => end(false), 8000); // 로딩 실패 대비
        try {
          AUD.defaultPlaybackRate = rate; AUD.preservesPitch = true; AUD.webkitPreservesPitch = true;
          AUD.src = url; AUD.playbackRate = rate;
          const p = AUD.play(); if (p) p.catch(() => end(false));
        } catch (e) { end(false); }
      });
    }
    function rateFor(lang, r) { return (r || 1) * (lang.startsWith('en') ? S.settings.rate : lang.startsWith('fr') ? S.settings.rate * 0.9 : 1.05); }
    async function speak(text, opt = {}) {
      const lang = opt.lang || 'en-US';
      const url = fileFor(text, lang);
      if (url) {
        try { synth && synth.cancel(); } catch (e) { /* noop */ }
        if (await playFile(url, Math.max(0.5, Math.min(2, rateFor(lang, opt.rate))))) return;
      }
      return speakSynth(text, opt);
    }
    function speakSynth(text, opt = {}) {
      return new Promise((resolve) => {
        if (!synth) { resolve(); return; }
        const lang = opt.lang || 'en-US';
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        const v = pick(lang); if (v) u.voice = v;
        u.rate = rateFor(lang, opt.rate);
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
      if (audFin) audFin();
      if (current) { const c = current; current = null; c.abort(); }
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
    /** 음성 인식. {promise, stop}. 실패 시 promise reject(errorCode)
     * - iPhone 인식기가 문장 중간 쉼에서 스스로 끝나도, 사용자가 아직 말하는 중이면 자동으로 이어서 듣는다.
     * - 종료 조건: ⏹ 버튼 / 마지막 말 이후 침묵(silenceMs, 문장이 덜 끝났으면 +1.5초) / 최대 시간
     * - manual: 침묵 감지 없이 ⏹ 버튼으로만 종료 */
    function listen(opt = {}) {
      if (!SR) return { promise: Promise.reject('unsupported'), stop() {} };
      stop();
      const manual = !!opt.manual;
      const silence = opt.silenceMs || 2500;
      const noSpeech = opt.noSpeechMs || 8000;
      const expect = opt.expectWords || 0;
      let committed = '', seg = '', lastChange = Date.now(), started = Date.now();
      let finished = false, userStop = false, errCode = null, rec = null, fastEnds = 0, segStart = 0;
      let resolveP, rejectP, timer, maxT, failsafe;
      const promise = new Promise((res, rej) => { resolveP = res; rejectP = rej; });
      const text = () => (committed + ' ' + seg).replace(/\s+/g, ' ').trim();
      function finish(err) {
        if (finished) return;
        finished = true; clearInterval(timer); clearTimeout(maxT); clearTimeout(failsafe);
        try { rec && rec.abort(); } catch (e) { /* noop */ }
        if (current === handle) current = null;
        const t = text();
        if (err && !t) { srFails++; rejectP(err); } else { srFails = 0; resolveP(t); }
      }
      function shouldEnd() {
        if (manual) return false;
        const t = text();
        if (!t) return Date.now() - started > noSpeech;
        const words = t.split(' ').length;
        const need = expect && words < expect * 0.7 ? silence + 1500 : silence;
        return Date.now() - lastChange > need;
      }
      function requestEnd() {
        userStop = true;
        try { rec && rec.stop(); } catch (e) { finish(); }
        clearTimeout(failsafe); failsafe = setTimeout(() => finish(), 1500); // onend가 안 오는 iOS 대비
      }
      function startSeg() {
        rec = new SR();
        rec.lang = opt.lang || 'en-US'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
        seg = ''; segStart = Date.now();
        rec.onresult = (e) => {
          let s2 = '';
          for (let i = 0; i < e.results.length; i++) s2 += e.results[i][0].transcript + ' ';
          s2 = s2.trim();
          if (s2 !== seg) { seg = s2; lastChange = Date.now(); opt.onInterim && opt.onInterim(text()); }
        };
        rec.onerror = (e) => {
          if (e.error === 'no-speech' || e.error === 'aborted') return;
          errCode = e.error || 'error';
          if (/not-allowed|service-not-allowed|audio-capture/.test(errCode)) finish(errCode); // 권한 문제는 즉시 종료
        };
        rec.onend = () => {
          committed = text(); seg = '';
          if (finished) return;
          if (errCode) return finish(errCode);
          if (userStop || shouldEnd()) return finish();
          // 아직 말하는 중 → 이어서 듣기 (즉시 끝나는 상황이 반복되면 중단)
          fastEnds = Date.now() - segStart < 400 ? fastEnds + 1 : 0;
          if (fastEnds > 3) return finish();
          try { startSeg(); } catch (e) { finish(); }
        };
        rec.start();
      }
      const handle = { promise, stop: requestEnd, abort: () => finish() };
      current = handle;
      timer = setInterval(() => { if (!finished && !userStop && shouldEnd()) requestEnd(); }, 250);
      maxT = setTimeout(requestEnd, opt.maxMs || (manual ? 60000 : 30000));
      try { startSeg(); } catch (e) { finish('start-failed'); }
      return handle;
    }
    return { speak, speakSynth, fileFor, stop, beep, listen, get srOK() { return !!SR; }, get srFails() { return srFails; }, enVoices, voices: () => voices, pick };
  })();

  /** 설정의 '말 끝 감지' 값 → listen 옵션 */
  function endOpts(extra) {
    const m = S.settings.endMode || 'normal';
    const o = m === 'manual' ? { manual: true } : { silenceMs: { fast: 1500, normal: 2500, relaxed: 4000 }[m] || 2500 };
    return Object.assign(o, extra || {});
  }
  const listenHint = () => (S.settings.endMode === 'manual' ? '듣는 중… 말을 마치면 ⏹ 버튼을 누르세요' : '듣는 중… 말씀하세요 (끝나면 잠시 멈추면 자동 종료)');
  const wc = (t) => String(t).trim().split(/\s+/).length;

  let viewGen = 0; // 화면이 바뀌었는지 확인용 (자동 마이크가 엉뚱한 화면에서 켜지지 않게)
  const autoMicOn = () => S.settings.autoMic !== false && Speech.srOK;

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

  /* ═════════ 테마 ═════════ */
  const THEMES = [
    ['flag', '🇬🇧🇫🇷 특허청 (기본)', 'linear-gradient(90deg,#012169 50%,#0055A4 50% 66%,#fff 66% 83%,#EF4135 83%)'],
    ['classic', '🌑 클래식 (이전 버전)', 'linear-gradient(135deg,#0ea5e9,#6366f1)'],
    ['mono', '⚪ 모노 라이트', 'linear-gradient(135deg,#ffffff 50%,#18181b 50%)'],
    ['burgundy', '🍷 버건디 & 골드', 'linear-gradient(135deg,#7a1f33 60%,#d4a64a 60%)'],
    ['forest', '🌲 포레스트', 'linear-gradient(135deg,#1f6f4a 60%,#e9e4d4 60%)'],
  ];
  function applyTheme() {
    const t = THEMES.some(([k]) => k === S.settings.theme) ? S.settings.theme : 'flag';
    document.body.dataset.theme = t;
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    const meta = document.querySelector('meta[name=theme-color]'); if (meta && bg) meta.setAttribute('content', bg);
  }
  applyTheme();

  /* ═════════ 기록 · 보상 ═════════ */
  /** '잘못 인식됐어요 · 다시 말하기' 용: 채점 직전 상태를 저장해 두고 되돌림 */
  function snapshot(store, id) {
    const k = today();
    return { t: Date.now(), store, id, prev: store[id] ? Object.assign({}, store[id]) : undefined, xp0: S.xp, day: k,
      d0: S.daily[k], h0: S.hist[k], g0: S.goalDays[k], b0: S.bestStreak, fr0: S.fr.att.length };
  }
  function undoSnapshot(sn) {
    if (!sn) return;
    if (sn.prev) sn.store[sn.id] = sn.prev; else delete sn.store[sn.id];
    while (S.attempts.length && S.attempts[S.attempts.length - 1].t >= sn.t) S.attempts.pop();
    if (S.fr.att.length > sn.fr0) S.fr.att.length = sn.fr0;
    S.xp = sn.xp0; S.bestStreak = sn.b0;
    const restore = (obj, v) => { if (v === undefined) delete obj[sn.day]; else obj[sn.day] = v; };
    restore(S.daily, sn.d0); restore(S.hist, sn.h0); restore(S.goalDays, sn.g0);
    save();
  }
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
      speak: a.filter((x) => x.m === 'speak').length, iv: a.filter((x) => x.m === 'iv').length, audio: S.audio, maxLv: S.maxLv,
      daily: Object.values(S.csrs).filter((x) => x.best >= 70).length,
      frAtt: S.fr.att.length, frLearned: Object.values(S.fr.srs).filter((x) => x.best >= 70).length,
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
  /** 영국 국기(왼쪽) + 프랑스 국기(오른쪽)를 사선으로 이어 붙인 엠블럼 */
  function flagPair(id, cls, aspect) {
    return `<svg class="${cls || ''}" viewBox="0 0 105 30" preserveAspectRatio="${aspect || 'xMidYMid meet'}" aria-hidden="true">
      <defs><clipPath id="uj${id}"><rect width="62" height="30"/></clipPath>
      <clipPath id="ut${id}"><path d="M31,15 h31 v15 z v15 h-31 z h-31 v-15 z v-15 h31 z"/></clipPath>
      <clipPath id="fr${id}"><path d="M60,0 L105,0 L105,30 L50,30 Z"/></clipPath></defs>
      <g clip-path="url(#uj${id})"><rect width="62" height="30" fill="#012169"/>
        <path d="M0,0 L62,30 M62,0 L0,30" stroke="#fff" stroke-width="6"/>
        <path d="M0,0 L62,30 M62,0 L0,30" clip-path="url(#ut${id})" stroke="#C8102E" stroke-width="4"/>
        <path d="M31,0 v30 M0,15 h62" stroke="#fff" stroke-width="10"/><path d="M31,0 v30 M0,15 h62" stroke="#C8102E" stroke-width="6"/></g>
      <g clip-path="url(#fr${id})"><rect x="50" width="22" height="30" fill="#0055A4"/><rect x="72" width="16" height="30" fill="#fff"/><rect x="88" width="17" height="30" fill="#EF4135"/></g>
      <path d="M60,0 L50,30" stroke="#fff" stroke-width="1.6"/></svg>`;
  }
  document.body.insertAdjacentHTML('afterbegin', `<header id="brand">${flagPair('b', 'flag')}<div class="grow"><div class="t">BizTalk</div><div class="s">Patent English · Français</div></div><button id="gear" aria-label="설정">⚙️</button></header>`);
  function stampHtml(score) {
    if (score >= 85) return '<div class="stamp granted">등록결정<small>GRANTED</small></div>';
    if (score >= 50) return '<div class="stamp amend">보정요구<small>AMEND</small></div>';
    return '<div class="stamp rejected">거절결정<small>REJECTED</small></div>';
  }
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
    // 원문 그대로 표시 (채점은 축약형·숫자·대소문자 차이를 허용하지만 화면엔 정답 원문을 보여줌)
    return r.words.map((x) => `<span class="${x.st}">${esc(x.w)}</span>`).join(' ');
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
    viewGen++;
    Speech.stop(); keepAwake(false);
    cleanupFns.forEach((f) => { try { f(); } catch (e) { /* noop */ } }); cleanupFns = [];
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    window.scrollTo(0, 0);
    try { (ROUTES[tab] || ROUTES.home)(arg); } catch (e) { reportErr(e); if (tab !== 'home') ROUTES.home(); }
  }
  $$('#tabs button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
  $('#gear').onclick = () => go('settings');

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
      <line x1="${P}" x2="${W - P}" y1="${y(lo)}" y2="${y(lo)}" class="grid" stroke-width="1"/>
      <line x1="${P}" x2="${W - P}" y1="${y(hi)}" y2="${y(hi)}" class="grid" stroke-width="1" opacity=".5"/>
      <text x="2" y="${y(hi) + 4}" class="lbl" font-size="10">${hi}</text><text x="2" y="${y(lo) + 4}" class="lbl" font-size="10">${lo}</text>
      <polyline points="${pts}" fill="none" class="line" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(last)}" cy="${y(vals[last])}" r="4" class="dot" stroke-width="2"/>
      <text x="${x(last)}" y="${y(vals[last]) - 9}" class="val" font-size="11" font-weight="700" text-anchor="end">${vals[last]}</text>
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
    const sp = avgOf('speak'), iv = avgOf('iv');
    const frRec = S.fr.att.slice(-20), frAcc = frRec.length ? Math.round(C.avg(frRec.map((a) => a.s))) : null;

    view.innerHTML = `
      ${!standalone ? `<div class="card" style="border:1px dashed var(--acc)"><b>📲 홈 화면에 추가하세요</b><p class="muted small">Safari 하단 공유 버튼 <b>⬆︎</b> → <b>홈 화면에 추가</b>. 앱처럼 바로 실행되고 오프라인(지하철)에서도 동작해요.</p></div>` : ''}
      ${!S.onboarded ? `<div class="card"><b>👋 처음이시네요!</b><p class="muted small">3분짜리 <b>실력 점검</b>으로 시작 레벨을 정해 드릴게요. (건너뛰면 Level 1부터)</p><div class="row"><button class="primary grow" data-act="test">실력 점검 시작</button><button class="ghost" data-act="skipOnb">건너뛰기</button></div></div>` : ''}
      <div class="cert">
        <div class="ribbon"><i class="uk"></i><i class="fr"></i></div>
        <div class="frame">
          <div class="head">CERTIFICATE OF PROFICIENCY<span>비즈니스 영어 · 프랑스어 실력 등록증</span></div>
          <div class="no">등록번호 제 10-${new Date().getFullYear()}-${String(score).padStart(7, '0')} 호</div>
          <div class="small muted">BizTalk Score</div>
          <div class="row" style="align-items:flex-end;gap:6px"><div class="score">${score}</div><div class="muted" style="margin-bottom:6px">/1000</div></div>
          ${delta != null ? `<div class="small" style="font-weight:700;color:${delta >= 0 ? 'var(--cert-up)' : 'var(--cert-down)'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} <span class="muted">(7일 전 대비)</span></div>` : ''}
          <div class="kv">권리자 등급 <b>${rk.icon} ${rk.name}</b> · 심사 단계 <b>Lv${S.level} ${C.LEVELS[S.level]}</b></div>
          <div class="row small" style="margin-top:12px"><span>오늘 목표 ${tXp}/${goal} XP</span><span class="grow"></span><span>🔥 ${stk}일 연속</span></div>
          <div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, (tXp / goal) * 100)}%"></i></div>
          ${rk.next ? `<div class="muted small" style="margin-top:8px">다음 직급 ${rk.nextName}까지 ${rk.next - S.xp} XP</div>` : ''}
          <div class="seal">BIZTALK<b>${rk.icon}</b>IP OFFICE</div>
        </div>
      </div>
      <div class="grid2">
        <button class="tile primary" data-act="speak"><span class="ic">🎤</span>스피킹<span class="sub" style="color:#e0e7ff">비즈니스 ${EXPRESSIONS.length} · 일상 ${DAILY.length}${due ? ' · 복습 ' + due : ''}</span></button>
        <button class="tile" data-act="fr"><span class="ic">🇫🇷</span>프랑스어<span class="sub">왕초보 말하기</span></button>
        <button class="tile" data-act="audio"><span class="ic">🚗</span>운전/지하철 모드<span class="sub">핸즈프리 반복</span></button>
        <button class="tile" data-act="iv"><span class="ic">💼</span>영어 면접<span class="sub">답변 피드백</span></button>
      </div>
      <h2>§1 점수 변화 · 심사 경과</h2>
      <div class="card">${chartSvg()}</div>
      <div class="grid3">
        <div class="stat"><b>${sp ?? '–'}</b><span>스피킹 정확도</span></div>
        <div class="stat"><b>${frAcc ?? '–'}</b><span>프랑스어 정확도</span></div>
        <div class="stat"><b>${iv ?? '–'}</b><span>면접 점수</span></div>
      </div>
      <p class="muted small">최근 20회 평균. Score = 레벨 기본점(0/300/600) + 최근 30회 평균×4</p>
      <h2>§2 배지 · 등록 특허</h2>
      <div class="badges">${C.BADGES.map(([id, e, name, desc]) => `<div class="badge ${S.badges[id] ? 'got' : ''}" title="${esc(desc)}"><span class="e">${e}</span>${esc(name)}</div>`).join('')}</div>
      <h2>§3 부속 서류</h2>
      <button class="list-item" data-act="lib"><span class="em">🗂️</span><span class="grow">표현 사전 <span class="muted small">· ${EXPRESSIONS.length}개 · 짤 넣기</span></span>›</button>
      <button class="list-item" data-act="test"><span class="em">🩺</span><span class="grow">실력 점검 다시 하기</span>›</button>
      <button class="list-item" data-act="settings"><span class="em">⚙️</span><span class="grow">설정 · 음성 · 백업</span>›</button>
    `;
    bind({
      speak: () => go('speak'), fr: () => go('fr'), audio: () => go('audio'), iv: () => go('iv'),
      lib: () => go('lib'), test: () => go('test'), settings: () => go('settings'),
      skipOnb: () => { S.onboarded = true; save(); go('home'); },
    });
    bindChart();
  };

  /* ═════════ 스피킹 세션 ═════════ */
  ROUTES.speak = function () {
    const now = Date.now();
    const dueBiz = EXPRESSIONS.filter((e) => e.lv <= S.level && S.srs[e.id] && S.srs[e.id].due <= now).length;
    const dueDaily = DAILY.filter((e) => S.csrs[e.id] && S.csrs[e.id].due <= now).length;
    const learned = (store, list) => list.filter((e) => store[e.id] && store[e.id].best >= 70).length;
    view.innerHTML = `<h1>🎤 스피킹</h1>
      <button class="tile primary block" data-act="biz" style="margin-bottom:10px"><span class="ic">💼</span>비즈니스 · 특허 실무 10문장<span class="sub" style="color:#dbe6ff">익힘 ${learned(S.srs, EXPRESSIONS)}/${EXPRESSIONS.length}${dueBiz ? ' · 복습 ' + dueBiz + '개 대기' : ''} · Lv${S.level}</span></button>
      <button class="tile block" data-act="daily" style="margin-bottom:10px"><span class="ic">☕</span>일상 회화 10문장<span class="sub">익힘 ${learned(S.csrs, DAILY)}/${DAILY.length}${dueDaily ? ' · 복습 ' + dueDaily + '개 대기' : ''} · 자주 쓰는 순서</span></button>
      <h2>☕ 일상 회화 주제별 (${DAILY_TOPICS.length}개 주제)</h2>
      ${DAILY_TOPICS.map((t) => { const list = DAILY.filter((e) => e.topic === t.id); const n = learned(S.csrs, list); return `<button class="list-item" data-act="topic" data-t="${t.id}"><span class="em">${t.e}</span><span class="grow"><b>${esc(t.title)}</b><div class="bar" style="margin-top:6px;height:6px"><i style="width:${(n / list.length) * 100}%"></i></div></span><span class="small muted">${n}/${list.length}</span></button>`; }).join('')}`;
    const runBiz = () => speakSession(C.pickSession(EXPRESSIONS, S.srs, S.level, 10, Date.now()), '💼 비즈니스 스피킹', runBiz);
    const runDaily = () => speakSession(C.pickSession(DAILY, S.csrs, 3, 10, Date.now()), '☕ 일상 회화', runDaily);
    const runTopic = (id) => { const t = DAILY_TOPICS.find((x) => x.id === id); const list = DAILY.filter((e) => e.topic === id); speakSession(C.pickSession(list, S.csrs, 3, 10, Date.now()), t.e + ' ' + t.title, () => runTopic(id)); };
    bind({ biz: runBiz, daily: runDaily, topic: (el) => runTopic(el.dataset.t) });
  };

  function speakSession(items, title, again) {
    const results = [];
    let idx = 0, typing = !Speech.srOK, hinted = 0, recHandle = null;

    function card() {
      viewGen++;
      const e = items[idx];
      hinted = 0;
      view.innerHTML = `
        ${progress(idx, items.length)}
        <div class="row muted small"><span>${esc(title)} ${idx + 1}/${items.length}</span><span class="grow"></span><span>${storeOf(e)[e.id] ? '🔁 복습' : '🆕 새 표현'}</span></div>
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
        mic: (b) => startMic(b), hint: showHint, reveal: () => { hinted = 2; showAnswerThen(); },
        toggleType: () => { typing = !typing; card(); },
        submitTyped: () => { const v = $('#typed').value.trim(); if (!v) return toast('입력해 주세요'); evaluate(v); },
      });
      if (autoMicOn() && !typing) startMic($('#mic'), true); // 카드가 뜨면 바로 듣기 시작
    }
    function showHint() {
      const e = items[idx], w = e.en.split(' ');
      hinted = Math.max(hinted, 1);
      $('#hint').textContent = '💡 ' + w.slice(0, Math.ceil(w.length / 2)).join(' ') + ' …';
    }
    async function showAnswerThen() {
      const e = items[idx];
      $('#hint').innerHTML = '👀 <b style="color:var(--text)">' + esc(e.en) + '</b><br><span class="small">듣고 따라 말해보세요.</span>';
      const g = viewGen;
      await Speech.speak(e.en);
      if (g === viewGen && !typing && !recHandle && $('#mic')) startMic($('#mic'), true); // 듣고 나면 바로 따라 말하기
    }
    async function startMic(btn, auto) {
      if (recHandle) { recHandle.stop(); return; }
      Speech.stop();
      const live = $('#live'); live.classList.remove('hidden'); live.textContent = listenHint();
      btn.classList.add('mic-on'); btn.textContent = '⏹ 말하기 끝내기';
      recHandle = Speech.listen(endOpts({ expectWords: wc(items[idx].en), noSpeechMs: auto ? 12000 : 8000, onInterim: (s) => (live.textContent = s) }));
      try {
        const said = await recHandle.promise;
        recHandle = null;
        if (!said) { btn.classList.remove('mic-on'); btn.textContent = '🔁 다시 말하기'; live.textContent = '음성이 들리지 않았어요. 버튼을 눌러 다시 말해보세요.'; return; }
        evaluate(said);
      } catch (code) {
        recHandle = null;
        if (auto) { btn.classList.remove('mic-on'); btn.textContent = '🎤 탭하고 말하기'; live.classList.add('hidden'); return; } // 자동 시작 실패는 조용히
        toast(srErrorMsg(code), 5000);
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'unsupported' || Speech.srFails >= 2) { typing = true; }
        card();
      }
    }
    let lastSnap = null;
    function evaluate(said) {
      const e = items[idx];
      const r = C.compare(e.en, said);
      let s = r.score;
      if (hinted) s = Math.min(s, 80);
      lastSnap = snapshot(storeOf(e), e.id);
      storeOf(e)[e.id] = C.srsUpdate(storeOf(e)[e.id], s, Date.now());
      const xp = record('speak', s, e.lv);
      results.push(s);
      showResult(e, r, s, said, xp);
    }
    function showResult(e, r, s, said, xp, retry) {
      viewGen++;
      const [em, msg] = reaction(r.score);
      view.innerHTML = `
        ${progress(idx + 1, items.length)}
        ${memeCard(e, { imgBtn: false })}
        <div class="card">
          <div class="result-head"><div class="react">${em}</div><div><div class="num">${r.score}<span class="muted small">점${s !== r.score ? ' (기록 ' + s + ')' : ''}</span></div><div class="muted small">${esc(msg)} ${retry ? '' : '· +' + xp + ' XP'}</div></div>${stampHtml(r.score)}</div>
          <h3 style="margin-top:14px">정답과 비교</h3>
          <div class="diff">${diffHtml(r)}</div>
          <div class="legend"><b style="color:var(--ok)">초록</b> 맞음 · <b style="color:var(--near)">노랑</b> 비슷함 · <b style="color:var(--bad)">빨강</b> 빠짐 ${r.extra ? '· 불필요한 단어 ' + r.extra + '개' : ''}</div>
          <h3 style="margin-top:12px">내가 말한 것 (인식 결과)</h3><div class="muted">${esc(said)}</div>
          ${lastSnap ? '<button class="redo" data-act="redo">🎙️ 잘못 인식됐어요 · 다시 말하기 <span class="small muted">(이번 점수 취소)</span></button>' : ''}
          <h3 style="margin-top:12px">정답</h3><div class="en">${esc(e.en)}</div><div class="muted">${esc(e.ko)}</div>
          ${e.tip ? `<div class="tipbox">📝 ${esc(e.tip)}</div>` : ''}
        </div>
        <div id="live" class="live hidden"></div>
        ${r.score < 85
          ? `<button class="primary block huge" data-act="retry" id="retry">🔁 다시 말하기</button>
             <div class="grid2" style="margin-top:10px"><button data-act="listen">🔊 정답 듣기</button><button data-act="next">${idx + 1 < items.length ? '다음 →' : '결과 보기'}</button></div>`
          : `<div class="grid2"><button data-act="listen">🔊 정답 듣기</button><button data-act="retry" id="retry">🔁 다시 말하기</button></div>
             <button class="primary block big" style="margin-top:10px" data-act="next">${idx + 1 < items.length ? '다음 →' : '결과 보기'}</button>`}
        <p class="muted small">${r.score < 85 ? '정답을 듣고 나면 마이크가 자동으로 켜져요. 따라 말해보세요! (연습용, 기록 반영 안 됨)' : '다시 말하기는 연습용(기록에 반영 안 됨)이에요.'}</p>`;
      bind({
        listen: () => Speech.speak(e.en),
        retry: (btn) => retryMic(btn, false),
        redo: () => { Speech.stop(); if (recHandle) { recHandle.stop(); recHandle = null; } undoSnapshot(lastSnap); lastSnap = null; results.pop(); toast('이번 점수를 취소했어요. 다시 말해보세요!'); card(); },
        next: () => { lastSnap = null; idx++; if (idx < items.length) card(); else summary(); },
      });
      async function retryMic(btn, auto) {
        if (recHandle) { recHandle.stop(); return; }
        if (!Speech.srOK || typing) {
          if (auto) return;
          const v = prompt('영어로 입력하세요'); if (v) showResult(e, C.compare(e.en, v), s, v, 0, true); return;
        }
        Speech.stop();
        const live = $('#live'); live.classList.remove('hidden'); live.textContent = auto ? '🗣️ 따라 말해보세요…' : listenHint();
        btn.classList.add('mic-on'); btn.textContent = '⏹ 말하기 끝내기';
        const reset = () => { btn.classList.remove('mic-on'); btn.textContent = '🔁 다시 말하기'; };
        recHandle = Speech.listen(endOpts({ expectWords: wc(e.en), onInterim: (t) => (live.textContent = t) }));
        try { const v = await recHandle.promise; recHandle = null; if (v) showResult(e, C.compare(e.en, v), s, v, 0, true); else { reset(); live.textContent = '음성이 들리지 않았어요. 버튼을 눌러 다시 말해보세요.'; } }
        catch (c) { recHandle = null; reset(); live.classList.add('hidden'); if (!auto) toast(srErrorMsg(c), 4000); }
      }
      if (r.score < 100) {
        const g = viewGen;
        Speech.speak(e.en).then(() => { if (r.score < 85 && g === viewGen && autoMicOn()) retryMic($('#retry'), true); });
      }
    }
    function summary() { sessionSummary(title + ' 완료', results, again, { home: 'speak', homeLabel: '스피킹 메뉴' }); }
    cleanupFns.push(() => { if (recHandle) recHandle.stop(); });
    card();
  }

  function sessionSummary(title, results, again, opts = {}) {
    const a = Math.round(C.avg(results));
    const [em, msg] = reaction(a);
    view.innerHTML = `
      <h1>${title}</h1>
      <div class="card" style="text-align:center"><div style="font-size:64px">${em}</div><div style="font-size:44px;font-weight:800">${a}<span class="muted small">점 평균</span></div><p class="muted">${esc(msg)}</p>
      <div class="row" style="justify-content:center;gap:6px;flex-wrap:wrap">${results.map((s) => `<span class="pill" style="background:${s >= 85 ? 'rgba(74,222,128,.2)' : s >= 60 ? 'rgba(251,191,36,.2)' : 'rgba(248,113,113,.2)'}">${s}</span>`).join('')}</div></div>
      ${opts.noLevel ? '' : levelReview()}
      <div class="grid2"><button class="primary big" data-act="again">한 세트 더</button><button class="big" data-act="home">${opts.homeLabel || '홈으로'}</button></div>`;
    bind({ again, home: () => go(opts.home || 'home'), lvdown: () => { S.level = Math.max(1, S.level - 1); save(); toast('Level ' + S.level + '로 조정했어요'); go('home'); } });
  }

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
        rec = Speech.listen({ manual: true, maxMs: 180000, onInterim: (s) => { text = s; $('#live').textContent = s; } });
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
        <div class="result-head"><div class="react">${em}</div><div><div class="num">${r.score}<span class="muted small">점</span></div><div class="muted small">${r.n}단어${r.wpm ? ' · ' + r.wpm + ' WPM' : ''} · +${xp} XP</div></div>${stampHtml(r.score)}</div>
        <h3 style="margin-top:14px">피드백</h3><ul class="fb">${r.fb.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <h3 style="margin-top:10px">핵심 포인트 (${r.hits.filter(Boolean).length}/${q.kw.length})</h3>
        <div>${q.kw.map((k, i) => `<span class="kw ${r.hits[i] ? 'hit' : 'no'}">${r.hits[i] ? '✓' : '✗'} ${esc(k.split('|')[0])}</span>`).join('')}</div>
        <h3 style="margin-top:12px">내 답변</h3><div class="muted small">${esc(said)}</div>
      </div>
      <div class="card"><h3>⭐ 모범 답안</h3><p class="muted small" style="margin-top:0">🔊 음성은 [ ] 부분을 예시(five years, semiconductors 등)로 읽어요.</p><div class="en" style="font-size:17px">${esc(q.a)}</div>
        <div class="grid2" style="margin-top:10px"><button data-act="model">🔊 듣기</button><button data-act="modelSlow">🐢 느리게</button></div></div>
      <div class="grid2"><button class="primary big" data-act="again">🔁 다시 답변</button><button class="big" data-act="list">목록</button></div>`;
    bind({ model: () => Speech.speak(q.a), modelSlow: () => Speech.speak(q.a, { rate: 0.75 }), again: () => ivQuestion(q), list: () => go('iv') });
  }

  /* ═════════ 오디오 모드 (운전 / 지하철) ═════════ */
  const AUDIO_MODES = {
    drive: ['🚗', '드라이브 회화', '한국어 → 내가 영어로 말하기 → 채점 → 정답. 마이크 사용.'],
    shadow: ['🗣️', '쉐도잉', '한국어 → 3초 생각 → 영어 2회(느리게). 마이크 없이 따라 말하기.'],
    daily: ['☕', '일상 회화 드라이브', '한국어 → 내가 영어로 말하기 → 채점 → 정답. 일상 회화 1000문장.'],
    fr: ['🇫🇷', '프랑스어 따라 말하기', '한국어 → 프랑스어 2회(느리게). 소리 내어 따라 하기.'],
    iv: ['💼', '면접 실전', '면접 질문 → 25초 동안 소리 내어 답변 → 모범답안 → 따라 말하기.'],
  };
  ROUTES.audio = function () {
    let mode = AUDIO_MODES[S.settings.audioMode] ? S.settings.audioMode : 'drive', count = S.settings.audioCount || 10;
    function render() {
      view.innerHTML = `<h1>🚗 오디오 모드</h1>
        <div class="card"><p class="small">⚠️ <b>운전 중에는 화면을 보지 마세요.</b> 시작 전에 거치대에 두고 시작 버튼만 누르면 끝까지 자동 진행돼요.</p>
        <p class="muted small">iOS는 화면이 잠기면 음성이 멈춰요. 진행 중 화면 꺼짐을 자동으로 막습니다(iOS 16.4+). 안 되면 설정 > 디스플레이 > 자동 잠금 시간을 늘려주세요.</p></div>
        ${Object.entries(AUDIO_MODES).map(([k, [e, n, d]]) => `<button class="list-item" data-act="mode" data-k="${k}" style="${mode === k ? 'outline:2px solid var(--acc)' : ''}"><span class="em">${e}</span><span class="grow"><b>${n}</b><br><span class="muted small">${d}</span></span>${mode === k ? '✓' : ''}</button>`).join('')}
        ${(mode === 'drive' || mode === 'daily') && !Speech.srOK ? '<p class="small" style="color:var(--near)">이 기기는 음성인식이 안 돼서 쉐도잉으로 진행됩니다.</p>' : ''}
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
    const daily = mode === 'daily';
    if (daily) mode = 'drive';
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
    const set = (ph, em, mn, sb) => { if (!alive) return; $('#ph').textContent = ph; if (em != null) $('#em').textContent = em; $('#mn').textContent = mn || ''; $('#sb').textContent = sb || ''; $('#ct').textContent = (done + 1) + (count ? ' / ' + count : '') + ' · ' + (daily ? '일상 회화 · ' : '') + AUDIO_MODES[mode][1]; };
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
          queue = mode === 'fr' ? shuffle(frPool()) : mode === 'iv' ? shuffle(INTERVIEW) : (daily ? C.pickSession(DAILY, S.csrs, 3, 10, Date.now()) : C.pickSession(EXPRESSIONS, S.srs, S.level, 10, Date.now()));
          if (mode !== 'iv' && mode !== 'fr') queue = shuffle(queue);
        }
        const e = queue.shift();
        skip = false;
        try {
          if (mode === 'fr') {
            set('한국어', e.e, e.ko, '프랑스어로 떠올려 보세요'); if (S.settings.koPrompt) await say(e.ko, { lang: 'ko-KR' }); await wait(2500);
            set('FRANÇAIS', null, e.fr, '[' + e.pr + '] ' + e.ko); await say(e.fr, { lang: 'fr-FR' }); await wait(2000);
            set('RÉPÉTEZ', null, e.fr, '따라 말하세요 [' + e.pr + ']'); await say(e.fr, { lang: 'fr-FR', rate: 0.75 }); await wait(Math.max(2500, e.fr.length * 90));
          } else if (mode === 'iv') {
            set('QUESTION', '💼', e.q, e.ko); await say(e.q);
            if (await gate()) { await Speech.beep(); }
            for (let t = 25; t > 0 && alive && !skip; t--) { set('🗣️ 답변하세요 ' + t + '초', '🎤', e.q, '소리 내어 영어로 답변해 보세요'); await wait(1000); }
            set('MODEL ANSWER', '⭐', e.q, e.a); await say(e.a); await wait(1500);
            const first = e.a.split(/(?<=[.!?])\s+/)[0];
            set('REPEAT', '🗣️', first, '첫 문장을 따라 말하세요'); await say(first, { rate: 0.9 }); await wait(Math.max(3000, first.length * 75));
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
              try { said = await Speech.listen({ silenceMs: S.settings.endMode === 'relaxed' || S.settings.endMode === 'manual' ? 4000 : 2500, expectWords: wc(e.en), noSpeechMs: 6000, onInterim: (s) => alive && ($('#sb').textContent = s) }).promise; srStreakFail = 0; }
              catch (c) {
                srStreakFail++;
                if (srStreakFail >= 2) { mode = 'shadow'; await say('Voice recognition is not working. Switching to shadowing mode.'); toast(srErrorMsg(c), 5000); continue; }
              }
              if (alive && !skip) {
                if (said) {
                  const r = C.compare(e.en, said);
                  storeOf(e)[e.id] = C.srsUpdate(storeOf(e)[e.id], r.score, Date.now()); record('speak', r.score, e.lv);
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
    const plan = [];
    for (const lv of [1, 2, 3]) for (const e of shuffle(EXPRESSIONS.filter((x) => x.lv === lv)).slice(0, 3)) plan.push({ type: Speech.srOK ? 'speak' : 'type', e, lv });
    const res = [];
    let idx = 0;
    view.innerHTML = `<h1>🩺 실력 점검</h1><div class="card"><p>한국어를 보고 <b>영어로 말하기</b> 9문항 (레벨별 3문항). 약 3분.</p><p class="muted small">결과에 따라 시작 레벨이 자동 설정되고, 점수 그래프의 기준점이 됩니다.</p></div><button class="primary block huge" data-act="go">시작</button>`;
    bind({ go: step });
    function step() {
      viewGen++;
      if (idx >= plan.length) return done();
      const it = plan[idx], e = it.e;
      if (it.type === 'type') {
        view.innerHTML = `${progress(idx, plan.length)}<div class="muted small">🩺 ${idx + 1}/${plan.length} · 영어로 옮기기</div>
          <div class="card"><div class="ko">${esc(e.ko)}</div></div>
          <textarea id="ans" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="영어로 입력 (키보드 🎙️ 받아쓰기 가능)"></textarea>
          <div class="grid2" style="margin-top:10px"><button data-act="pass">모르겠음</button><button class="primary" data-act="ok">제출</button></div>`;
        bind({ pass: () => finishItem(0), ok: () => finishItem(C.compare(e.en, $('#ans').value).score) });
      } else {
        view.innerHTML = `${progress(idx, plan.length)}<div class="muted small">🩺 ${idx + 1}/${plan.length} · 영어로 말하기</div>
          <div class="card"><div class="ko">${esc(e.ko)}</div></div><div id="live" class="live"></div>
          <button class="primary block huge" data-act="mic" id="mic">🎤 탭하고 말하기</button>
          <button class="ghost block" style="margin-top:10px" data-act="pass">모르겠음</button>`;
        let h = null;
        const mic = async (b, auto) => {
          if (h) { h.stop(); return; }
          b.classList.add('mic-on'); b.textContent = '⏹ 끝내기';
          $('#live').textContent = listenHint();
          h = Speech.listen(endOpts({ expectWords: wc(e.en), noSpeechMs: auto ? 12000 : 8000, onInterim: (t) => ($('#live').textContent = t) }));
          try { const t = await h.promise; h = null; if (!t) { b.classList.remove('mic-on'); b.textContent = '🎤 다시 말하기'; $('#live').textContent = '음성이 들리지 않았어요. 다시 탭하세요.'; return; } finishItem(C.compare(e.en, t).score); }
          catch (c) { h = null; b.classList.remove('mic-on'); b.textContent = '🎤 탭하고 말하기'; if (auto) return; toast(srErrorMsg(c), 4000); plan[idx] = { type: 'type', e, lv: it.lv }; step(); }
        };
        bind({ pass: () => { if (h) h.stop(); finishItem(0); }, mic: (b) => mic(b) });
        if (autoMicOn()) mic($('#mic'), true);
      }
    }
    function finishItem(score) {
      Speech.stop();
      res.push({ lv: plan[idx].lv, s: score });
      record('speak', score, plan[idx].lv);
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

  /* ═════════ 프랑스어 쌩기초 ═════════ */
  const frLearned = (id) => S.fr.srs[id] && S.fr.srs[id].best >= 70;
  function frRecUnitIdx() { const i = FR_UNITS.findIndex((u) => !u.items.every((it) => frLearned(it.id))); return i < 0 ? FR_UNITS.length - 1 : i; }
  function frPool() { return FR_ITEMS.filter((it) => FR_UNITS.findIndex((u) => u.id === it.unit) <= frRecUnitIdx()); }
  function frRecord(it, s) {
    S.fr.srs[it.id] = C.srsUpdate(S.fr.srs[it.id], s, Date.now());
    S.fr.att.push({ t: Date.now(), s });
    if (S.fr.att.length > 2000) S.fr.att = S.fr.att.slice(-2000);
    return record('fr', s, 0, { xpOnly: true });
  }

  ROUTES.fr = function () {
    const total = FR_ITEMS.length, learned = FR_ITEMS.filter((it) => frLearned(it.id)).length;
    const rec = S.fr.att.slice(-20), acc = rec.length ? Math.round(C.avg(rec.map((a) => a.s))) : null;
    const now = Date.now(), due = FR_ITEMS.filter((it) => S.fr.srs[it.id] && S.fr.srs[it.id].due <= now).length;
    const ri = frRecUnitIdx(), ru = FR_UNITS[ri];
    view.innerHTML = `<h1>🇫🇷 프랑스어 쌩기초</h1>
      <div class="hero">
        <div class="row small"><span>익힌 단어·문장 ${learned}/${total}</span><span class="grow"></span><span>정확도 ${acc ?? '–'}</span></div>
        <div class="bar" style="margin-top:8px"><i style="width:${(learned / total) * 100}%"></i></div>
        <button class="primary block big" style="margin-top:14px" data-act="cont">▶︎ 이어서: ${ru.emoji} ${esc(ru.title)} 배우기</button>
        ${learned ? `<button class="block" style="margin-top:8px" data-act="review">🔁 말하기 복습${due ? ' (' + due + '개 대기)' : ''}</button>` : ''}
      </div>
      <div class="card small"><b>공부 순서</b><p class="muted" style="margin:6px 0 0">각 단원 <b>① 배우기</b>(듣고 따라 말하기) → <b>② 퀴즈</b>(한국어 보고 프랑스어로 말하기). 70점 이상이면 ‘익힘’✓. 악센트(é, ç)와 대소문자는 채점에 영향 없어요. 발음 힌트는 근사치니까 꼭 소리를 듣고 따라 하세요.</p></div>
      ${FR_UNITS.map((u, i) => { const n = u.items.filter((it) => frLearned(it.id)).length; return `<div class="card" style="${i === ri ? 'outline:2px solid var(--acc)' : ''}">
        <div class="row"><span style="font-size:28px">${u.emoji}</span><div class="grow"><b>Unit ${i + 1}. ${esc(u.title)}</b><div class="muted small">단어 ${u.items.filter((x) => x.t === 'w').length} · 문장 ${u.items.filter((x) => x.t === 's').length}${n === u.items.length ? ' · ✅ 완료' : ''}</div></div><span class="small">${n}/${u.items.length}</span></div>
        <div class="bar" style="margin:10px 0"><i style="width:${(n / u.items.length) * 100}%"></i></div>
        <div class="grid2"><button data-act="learn" data-u="${u.id}">① 배우기</button><button data-act="quiz" data-u="${u.id}">② 퀴즈</button></div></div>`; }).join('')}
      <p class="muted small">🚗 오디오 탭 → ‘프랑스어 따라 말하기’로 운전 중에도 반복할 수 있어요.</p>`;
    const unitItems = (id) => FR_ITEMS.filter((it) => it.unit === id);
    bind({
      cont: () => frSession(unitItems(ru.id), 'learn', ru.title),
      learn: (el) => frSession(unitItems(el.dataset.u), 'learn', FR_UNITS.find((u) => u.id === el.dataset.u).title),
      quiz: (el) => frSession(shuffle(unitItems(el.dataset.u)), 'quiz', FR_UNITS.find((u) => u.id === el.dataset.u).title),
      review: () => {
        const seen = FR_ITEMS.filter((it) => S.fr.srs[it.id]);
        const list = seen.slice().sort((a, b) => S.fr.srs[a.id].due - S.fr.srs[b.id].due || S.fr.srs[a.id].b - S.fr.srs[b.id].b).slice(0, 10);
        frSession(shuffle(list), 'quiz', '복습');
      },
    });
  };

  function frSession(items, mode, title) {
    const results = [];
    let idx = 0, typing = !Speech.srOK, hinted = false, rec = null;
    const sayFr = (t, rate) => Speech.speak(t, { lang: 'fr-FR', rate });
    cleanupFns.push(() => { if (rec) rec.stop(); });

    function card() {
      viewGen++;
      const it = items[idx];
      hinted = mode === 'learn';
      const learn = mode === 'learn';
      view.innerHTML = `${progress(idx, items.length)}
        <div class="row muted small"><span>🇫🇷 ${esc(title)} · ${learn ? '① 배우기' : '② 퀴즈'} ${idx + 1}/${items.length}</span><span class="grow"></span><span class="pill">${it.t === 'w' ? '단어' : '문장'}</span></div>
        <div class="card" style="text-align:center">
          <div style="font-size:72px;line-height:1.1">${it.e}</div>
          ${learn ? `<div style="font-size:30px;font-weight:800;margin-top:8px">${esc(it.fr)}</div><div style="color:var(--acc);margin-top:4px">[${esc(it.pr)}]</div>` : '<div class="muted small" style="margin-top:8px">프랑스어로 말해보세요</div>'}
          <div class="ko" style="margin-top:8px">${esc(it.ko)}</div>
          <div id="hint" style="color:var(--acc);margin-top:6px"></div>
          ${learn && it.note ? `<div class="tipbox" style="text-align:left">📝 ${esc(it.note)}</div>` : ''}
        </div>
        <div class="grid2">${learn ? '<button data-act="play">🔊 듣기</button><button data-act="slow">🐢 느리게</button>' : '<button data-act="hint">💡 발음 힌트</button><button data-act="reveal">👀 정답 듣기</button>'}</div>
        <div id="live" class="live hidden"></div>
        <div id="typebox" class="${typing ? '' : 'hidden'}" style="margin-top:10px"><input type="text" id="typed" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="프랑스어 입력 (악센트 생략 OK)"><button class="primary block big" style="margin-top:8px" data-act="submitTyped">제출</button></div>
        <button id="mic" class="primary block huge ${typing ? 'hidden' : ''}" style="margin-top:10px" data-act="mic">🎤 ${learn ? '따라 말하기' : '탭하고 말하기'}</button>
        <div class="grid2" style="margin-top:10px"><button class="ghost" data-act="toggleType">${typing ? '🎤 음성으로' : '⌨️ 입력으로'}</button><button class="ghost" data-act="skip">건너뛰기 →</button></div>
        ${learn ? '' : '<p class="muted small">힌트/정답을 보면 최대 80점으로 기록돼요.</p>'}`;
      bind({
        play: () => sayFr(it.fr), slow: () => sayFr(it.fr, 0.7),
        hint: () => { hinted = true; $('#hint').textContent = '[' + it.pr + ']'; },
        reveal: () => { hinted = true; $('#hint').innerHTML = '<b style="font-size:22px;color:var(--text)">' + esc(it.fr) + '</b> [' + esc(it.pr) + ']'; sayFr(it.fr); },
        toggleType: () => { typing = !typing; card(); },
        skip: next,
        submitTyped: () => { const v = $('#typed').value.trim(); if (!v) return toast('입력해 주세요'); evaluate(v); },
        mic: (b) => startMic(b),
      });
      const g = viewGen;
      if (learn) sayFr(it.fr).then(() => { if (g === viewGen && autoMicOn() && !typing && !rec) startMic($('#mic'), true); }); // 듣고 → 바로 따라 말하기
      else if (autoMicOn() && !typing) startMic($('#mic'), true);
    }
    async function startMic(btn, auto) {
      if (rec) { rec.stop(); return; }
      Speech.stop();
      const live = $('#live'); live.classList.remove('hidden'); live.textContent = listenHint();
      btn.classList.add('mic-on'); btn.textContent = '⏹ 말하기 끝내기';
      rec = Speech.listen(endOpts({ lang: 'fr-FR', expectWords: wc(items[idx].fr), noSpeechMs: auto ? 12000 : 8000, onInterim: (s) => (live.textContent = s) }));
      try {
        const said = await rec.promise; rec = null;
        if (!said) { btn.classList.remove('mic-on'); btn.textContent = '🎤 다시 말하기'; live.textContent = '음성이 들리지 않았어요. 다시 탭해서 말해보세요.'; return; }
        evaluate(said);
      } catch (code) {
        rec = null;
        if (auto) { btn.classList.remove('mic-on'); btn.textContent = '🎤 탭하고 말하기'; live.classList.add('hidden'); return; }
        toast(srErrorMsg(code), 5000);
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'unsupported' || Speech.srFails >= 2) typing = true;
        card();
      }
    }
    let frSnap = null;
    function evaluate(said) {
      const it = items[idx];
      const r = C.compare(it.fr, said, 'fr');
      // 배우기(보고 따라 말하기)는 퀴즈보다 쉬우므로 숙련도 반영을 80점까지로 제한
      const s = hinted ? Math.min(r.score, 80) : r.score;
      frSnap = snapshot(S.fr.srs, it.id);
      const xp = frRecord(it, s); results.push(s);
      showResult(it, r, s, said, xp);
    }
    function showResult(it, r, s, said, xp, retry) {
      viewGen++;
      const [em, msg] = r.score === 100 ? ['😎', 'Parfait ! 완벽해요'] : r.score >= 85 ? ['🥐', 'Très bien ! 아주 좋아요'] : r.score >= 70 ? ['👍', 'Bien ! 거의 다 왔어요'] : r.score >= 50 ? ['🤏', 'Presque… 한 번 더!'] : ['🫣', 'Courage ! 천천히 다시 들어봐요'];
      view.innerHTML = `${progress(idx + 1, items.length)}
        <div class="card">
          <div class="result-head"><div class="react">${em}</div><div><div class="num">${r.score}<span class="muted small">점</span></div><div class="muted small">${esc(msg)}${retry ? '' : ' · +' + xp + ' XP'}</div>${s !== r.score ? `<div class="muted small">${mode === 'learn' ? '보고 따라 말하기는 최대 80점 기록 → 퀴즈에서 100점 도전!' : '힌트 사용 → ' + s + '점 기록'}</div>` : ''}</div>${stampHtml(r.score)}</div>
          <h3 style="margin-top:14px">정답과 비교</h3><div class="diff">${r.words.map((x) => `<span class="${x.st}">${esc(x.w)}</span>`).join(' ')}</div>
          <div style="color:var(--acc);margin-top:4px">[${esc(it.pr)}] · ${esc(it.ko)}</div>
          <h3 style="margin-top:12px">내 답 (인식 결과)</h3><div class="muted">${esc(said)}</div>
          ${frSnap ? '<button class="redo" data-act="redo">🎙️ 잘못 인식됐어요 · 다시 말하기 <span class="small muted">(이번 점수 취소)</span></button>' : ''}
          ${it.note ? `<div class="tipbox">📝 ${esc(it.note)}</div>` : ''}
          ${r.score < 70 ? '<p class="muted small">💡 짧은 단어는 인식이 까다로워요. 또박또박, 조금 크게 말해보세요.</p>' : ''}
        </div>
        <div class="grid3"><button data-act="play">🔊</button><button data-act="slow">🐢</button><button data-act="retry">🔁 다시</button></div>
        <button class="primary block big" style="margin-top:10px" data-act="next">${idx + 1 < items.length ? '다음 →' : '결과 보기'}</button>`;
      bind({
        play: () => sayFr(it.fr), slow: () => sayFr(it.fr, 0.7),
        next: () => { frSnap = null; next(); },
        redo: () => { Speech.stop(); if (rec) { rec.stop(); rec = null; } undoSnapshot(frSnap); frSnap = null; results.pop(); toast('이번 점수를 취소했어요. 다시 말해보세요!'); card(); },
        retry: async (btn) => {
          if (!Speech.srOK || typing) { const v = prompt('프랑스어로 입력하세요'); if (v) showResult(it, C.compare(it.fr, v, 'fr'), s, v, 0, true); return; }
          btn.classList.add('mic-on'); btn.textContent = '듣는 중…';
          try { const v = await Speech.listen(endOpts({ lang: 'fr-FR', expectWords: wc(it.fr) })).promise; if (v) showResult(it, C.compare(it.fr, v, 'fr'), s, v, 0, true); else { btn.classList.remove('mic-on'); btn.textContent = '🔁 다시'; toast('음성이 들리지 않았어요'); } }
          catch (c) { toast(srErrorMsg(c), 4000); btn.classList.remove('mic-on'); btn.textContent = '🔁 다시'; }
        },
      });
      if (r.score < 100) sayFr(it.fr);
    }
    function next() {
      idx++;
      if (idx < items.length) return card();
      if (!results.length) return go('fr');
      sessionSummary('🇫🇷 ' + title + (mode === 'learn' ? ' · 배우기 완료' : ' · 퀴즈 완료'), results,
        () => frSession(mode === 'quiz' ? shuffle(items) : items, mode, title),
        { noLevel: true, home: 'fr', homeLabel: '단원 목록' });
    }
    card();
  }

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
        <label><input type="checkbox" id="natural" ${S.settings.natural !== false ? 'checked' : ''}> 🎧 자연스러운 AI 음성 사용 (권장)</label>
        <p class="muted small" style="margin:4px 0 0">앱 안 모든 영어·프랑스어 문장을 미리 녹음된 AI 음성으로 재생해요. 무음 스위치가 켜져 있어도 소리가 나요.</p>
        <div class="row small" style="margin-top:8px"><span id="offl" class="grow muted">오프라인 음성 확인 중…</span><button style="min-height:38px;padding:6px 12px" data-act="dlaudio">⬇️ 모두 저장</button></div>
        <button style="margin-top:8px" data-act="test">🔊 미리 듣기</button>
        <label>기기 음성 (AI 음성이 없는 문장·한국어용)</label>
        <select id="voice">${vs.length ? vs.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === cur ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})${/(premium|enhanced|향상)/i.test(v.name) ? ' ★' : ''}</option>`).join('') : '<option>기본 음성</option>'}</select>
        <button style="margin-top:8px" data-act="test">🔊 미리 듣기</button>
        <label>말하기 속도: <span id="rv">${S.settings.rate.toFixed(2)}</span>×</label>
        <input type="range" id="rate" min="0.6" max="1.3" step="0.05" value="${S.settings.rate}" style="width:100%">
 <label>🎤 말 끝 감지 (마이크가 너무 빨리 꺼지면 '여유' 또는 '수동')</label>
        <div class="chips">${[['fast', '빠름 1.5초'], ['normal', '보통 2.5초'], ['relaxed', '여유 4초'], ['manual', '수동 (⏹ 눌러 종료)']].map(([k, v]) => `<button data-act="endm" data-k="${k}" class="${(S.settings.endMode || 'normal') === k ? 'on' : ''}">${v}</button>`).join('')}</div>
        <p class="muted small">수동이어도 운전 모드는 핸즈프리라 4초 침묵 시 자동 종료돼요.</p>
        <label><input type="checkbox" id="automic" ${S.settings.autoMic !== false ? 'checked' : ''}> 🎤 자동 마이크 (문제가 나오면 바로 듣기 시작)</label>
        <label><input type="checkbox" id="ko" ${S.settings.koPrompt ? 'checked' : ''}> 쉐도잉 모드에서 한국어 뜻 읽어주기</label>
      </div>
      <div class="card">
        <h3>🎨 테마</h3>
        <div class="themes">${THEMES.map(([k, name, sw]) => `<button data-act="theme" data-k="${k}" class="${(S.settings.theme || 'flag') === k ? 'on' : ''}"><span class="sw" style="background:${sw}"></span>${name}</button>`).join('')}</div>
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
      <div class="card"><h3>앱 버전: ${APP_VERSION}</h3><p class="muted small">수정사항이 안 보이면 눌러주세요. 학습 기록은 그대로 유지됩니다.</p><button class="block" data-act="update">🔄 최신 버전으로 업데이트</button></div>
      <p class="muted small" style="text-align:center">오프라인 동작 · 서버 전송 없음</p>`;
    bind({
      home: () => go('home'),
      update: forceUpdate,
      theme: (el) => { S.settings.theme = el.dataset.k; save(); applyTheme(); ROUTES.settings(); },
      dlaudio: (b) => { b.disabled = true; prefetchAudio(true).then(() => { b.disabled = false; }); },
      endm: (el) => { S.settings.endMode = el.dataset.k; save(); ROUTES.settings(); toast('말 끝 감지: ' + el.textContent); },
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
            S = load(); applyTheme(); toast('✅ 복원 완료'); go('home');
          } catch (e) { toast('⚠️ 올바른 백업 파일이 아니에요'); }
        };
        inp.click();
      },
      reset: () => { if (confirm('정말 모든 기록을 지울까요? (되돌릴 수 없음)')) { localStorage.removeItem(KEY); S = load(); applyTheme(); go('home'); } },
    });
    $('#voice').onchange = (ev) => { S.settings.voice = ev.target.value; save(); };
    $('#rate').oninput = (ev) => { S.settings.rate = +ev.target.value; $('#rv').textContent = S.settings.rate.toFixed(2); save(); };
    $('#ko').onchange = (ev) => { S.settings.koPrompt = ev.target.checked; save(); };
    $('#automic').onchange = (ev) => { S.settings.autoMic = ev.target.checked; save(); };
    $('#natural').onchange = (ev) => { S.settings.natural = ev.target.checked; save(); };
    audioStatus();
  };

  /* 저장된 앱 파일(캐시)만 지우고 새로 받기 — 학습 기록(localStorage)은 건드리지 않음 */
  async function forceUpdate() {
    if (!navigator.onLine) return toast('인터넷 연결 후 다시 시도하세요');
    toast('업데이트 중…', 5000);
    try {
      if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      if (window.caches) for (const k of await caches.keys()) if (k !== AUDIO_CACHE) await caches.delete(k);
    } catch (e) { /* noop */ }
    location.replace(location.pathname + '?v=' + Date.now());
  }

  /* ═════════ 오프라인 음성 저장 (지하철용) ═════════ */
  const AUDIO_CACHE = 'biztalk-audio-v1';
  function allAudioUrls() {
    const out = [];
    for (const [l, arr] of Object.entries(window.AUDIO_FILES || {})) for (const h of arr) out.push(new URL('audio/' + l + '/' + h + '.mp3', location.href).href);
    return out;
  }
  async function audioStatus() {
    const el = $('#offl'); if (!el || !window.caches) return;
    try {
      const have = new Set((await (await caches.open(AUDIO_CACHE)).keys()).map((r) => r.url));
      const all = allAudioUrls();
      const n = all.filter((u) => have.has(u)).length;
      el.textContent = n >= all.length ? '✅ 오프라인 음성 ' + n + '개 모두 저장됨' : '오프라인 음성 ' + n + '/' + all.length + ' 저장됨';
    } catch (e) { el.textContent = ''; }
  }
  let prefetching = false;
  async function prefetchAudio(verbose) {
    if (prefetching || !window.caches || !navigator.onLine) { if (verbose && !navigator.onLine) toast('인터넷 연결 후 다시 시도하세요'); return; }
    prefetching = true;
    try {
      const c = await caches.open(AUDIO_CACHE);
      const have = new Set((await c.keys()).map((r) => r.url));
      const todo = allAudioUrls().filter((u) => !have.has(u));
      let i = 0;
      for (const u of todo) {
        try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (e) { break; }
        if (verbose && ++i % 10 === 0) { const el = $('#offl'); if (el) el.textContent = '저장 중… ' + i + '/' + todo.length; }
      }
      if (verbose) toast('✅ 오프라인 음성 저장 완료');
    } finally { prefetching = false; audioStatus(); }
  }

  /* ═════════ 시작 ═════════ */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 캐시 실패해도 앱은 동작 */ });
  }
  setTimeout(() => prefetchAudio(false), 6000); // 백그라운드로 음성 파일 저장
  const startTab = (location.hash || '').replace('#', '');
  go(ROUTES[startTab] ? startTab : 'home');
})();
