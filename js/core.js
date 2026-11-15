/* 순수 로직 (채점·복습 스케줄·레벨·보상) — DOM 의존 없음, Node 테스트 가능 */
(function (root) {
  const NUM = {
    zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
    eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14',
    fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
    thirty: '30', forty: '40', fifty: '50', sixty: '60', hundred: '100',
  };
  const PRON_S = new Set(['it', 'that', 'what', 'there', 'he', 'she', 'here', 'who', 'where', 'how', 'let']);
  const SPECIAL = {
    "can't": 'cannot', "won't": 'will not', "shan't": 'shall not', "let's": 'let us',
    'ok': 'okay', 'e-mail': 'email', 'gonna': 'going to', 'wanna': 'want to',
  };

  const NUM_FR = { un: '1', une: '1', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9', dix: '10' };
  const SPECIAL_FR = { weekend: 'week end', ok: 'd accord' };
  /** 프랑스어: 악센트 무시(é→e), 엘리지옹 분리(l'eau → l eau), 숫자 통일(deux → 2) */
  function normalizeFr(text) {
    const s = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0153/g, 'oe').replace(/\u00e6/g, 'ae')
      .replace(/[\u2018\u2019\u02bc`´']/g, ' ').replace(/-/g, ' ').replace(/[^a-z0-9\s]/g, ' ');
    const out = [];
    for (let w of s.split(/\s+/)) {
      if (!w) continue;
      if (SPECIAL_FR[w]) { out.push(...SPECIAL_FR[w].split(' ')); continue; }
      out.push(NUM_FR[w] || w);
    }
    return out;
  }

  function normalize(text, lang) {
    if (lang === 'fr') return normalizeFr(text);
    let s = String(text || '').toLowerCase()
      .replace(/[‘’ʼ`´]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/(\d+):00\b/g, "$1 o'clock")
      .replace(/&/g, ' and ')
      .replace(/(\d),(\d)/g, '$1$2');
    s = s.replace(/\b([a-z])\.(?=[a-z]\.)/g, '$1').replace(/\b([a-z])\.(?=\s|$)/g, '$1'); // U.S.P.T.O. → uspto
    s = s.replace(/[^a-z0-9'\s-]/g, ' ').replace(/-/g, ' ');
    const out = [];
    for (let w of s.split(/\s+/)) {
      if (!w) continue;
      w = w.replace(/^'+|'+$/g, '');
      if (!w) continue;
      if (w === "o'clock" || w === 'oclock') { out.push('oclock'); continue; }
      if (SPECIAL[w]) { out.push(...SPECIAL[w].split(' ')); continue; }
      let m;
      if ((m = w.match(/^(\w+)n't$/))) { out.push(m[1], 'not'); continue; }
      if ((m = w.match(/^(\w+)'(ll|re|ve|m|d)$/))) {
        out.push(m[1], { ll: 'will', re: 'are', ve: 'have', m: 'am', d: 'would' }[m[2]]);
        continue;
      }
      if ((m = w.match(/^(\w+)'s$/)) && PRON_S.has(m[1])) { out.push(m[1], 'is'); continue; }
      w = w.replace(/'/g, ''); // 소유격 등: examiner's → examiners
      if (NUM[w]) w = NUM[w];
      out.push(w);
    }
    return out;
  }

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  function wordWeight(t, s) {
    if (t === s) return 1;
    // 단수/복수, 오타 1글자 등은 부분 점수
    const L = Math.max(t.length, s.length);
    if (L >= 4) {
      const d = lev(t, s);
      if (d === 1 || (L >= 8 && d === 2)) return 0.5;
    }
    return 0;
  }

  /** target 문장과 사용자가 말/입력한 문장을 비교. */
  function compare(target, said, lang) {
    const T = normalize(target, lang), S = normalize(said, lang);
    const m = T.length, n = S.length;
    const dp = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const w = wordWeight(T[i - 1], S[j - 1]);
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], w ? dp[i - 1][j - 1] + w : -1);
      }
    }
    // backtrack
    const tStat = new Array(m).fill('miss');
    let i = m, j = n, matchedSaid = 0;
    while (i > 0 && j > 0) {
      const w = wordWeight(T[i - 1], S[j - 1]);
      if (w && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + w)) < 1e-9) {
        tStat[i - 1] = w === 1 ? 'ok' : 'near'; matchedSaid++; i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
    }
    const W = dp[m][n];
    const extra = n - matchedSaid;
    const score = m ? Math.max(0, Math.min(100, Math.round((100 * W) / (m + 0.5 * extra)))) : 0;
    // 화면 표시용: 원문 단어(대소문자·축약형·문장부호 그대로)에 채점 결과를 매핑
    const words = [];
    let k = 0;
    for (const w of String(target).trim().split(/\s+/)) {
      if (!w) continue;
      const toks = normalize(w, lang).length;
      const st = tStat.slice(k, k + toks);
      k += toks;
      words.push({ w, st: !st.length || st.every((x) => x === 'ok') ? 'ok' : st.every((x) => x === 'miss') ? 'miss' : 'near' });
    }
    return { score, target: T, said: S, status: tStat, extra, words };
  }

  /* ───── 간격 반복(Leitner) ───── */
  const DAY = 86400000;
  const INTERVALS = [0, 1, 3, 7, 14, 30, 60]; // days
  function srsUpdate(st, score, now) {
    st = Object.assign({ b: 0, n: 0, best: 0 }, st || {});
    st.n++; st.last = now; st.best = Math.max(st.best, score);
    if (score >= 85) st.b = Math.min(INTERVALS.length - 1, st.b + 1);
    else if (score < 60) st.b = 0;
    else st.b = Math.max(0, st.b - 1);
    st.due = now + (st.b === 0 ? 10 * 60000 : INTERVALS[st.b] * DAY);
    return st;
  }

  /** 세션 출제: 복습 대상 먼저, 그 다음 새 표현(낮은 레벨·빈도순), 그래도 부족하면 덜 익힌 순 */
  function pickSession(items, srs, level, n, now) {
    const elig = items.filter((x) => x.lv <= level);
    const due = elig.filter((x) => srs[x.id] && srs[x.id].due <= now).sort((a, b) => srs[a.id].due - srs[b.id].due);
    const fresh = elig.filter((x) => !srs[x.id]).sort((a, b) => a.lv - b.lv);
    const maxDue = fresh.length ? Math.ceil(n * 0.6) : n;
    const out = due.slice(0, maxDue);
    for (const x of fresh) { if (out.length >= n) break; out.push(x); }
    for (const x of due.slice(maxDue)) { if (out.length >= n) break; out.push(x); }
    if (out.length < n) {
      const rest = elig.filter((x) => !out.includes(x))
        .sort((a, b) => (srs[a.id] ? srs[a.id].b : 0) - (srs[b.id] ? srs[b.id].b : 0) || (srs[a.id] ? srs[a.id].due : 0) - (srs[b.id] ? srs[b.id].due : 0));
      for (const x of rest) { if (out.length >= n) break; out.push(x); }
    }
    return out;
  }

  /* ───── 레벨 · 점수 · 보상 ───── */
  const LEVELS = { 1: 'Basic', 2: 'Intermediate', 3: 'Advanced' };
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  function levelCheck(attempts, level) {
    const rec = attempts.filter((a) => a.lv === level && (a.m === 'speak' || a.m === 'dict')).slice(-20);
    if (level < 3 && rec.length >= 15 && avg(rec.map((a) => a.s)) >= 85) return { up: true };
    if (level > 1 && rec.length >= 15 && avg(rec.map((a) => a.s)) < 50) return { down: true };
    return {};
  }

  /** 비즈 영어 점수 (0~1000): 레벨 기반점 + 최근 30회 평균 */
  function bizScore(attempts, level) {
    const base = { 1: 0, 2: 300, 3: 600 }[level] || 0;
    const rec = attempts.slice(-30).map((a) => a.s);
    return Math.round(base + 4 * avg(rec));
  }

  const RANKS = [
    [0, 'Intern', '🐣'], [300, 'Junior Associate', '📎'], [1000, 'Associate', '💼'],
    [2500, 'Senior Associate', '📚'], [5000, 'Partner', '🏛️'], [10000, 'Managing Partner', '👑'],
  ];
  function rankOf(xp) {
    let r = 0;
    for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i][0]) r = i;
    const next = RANKS[r + 1];
    return { name: RANKS[r][1], icon: RANKS[r][2], next: next ? next[0] : null, nextName: next ? next[1] : null, floor: RANKS[r][0] };
  }

  function xpFor(score) { return Math.round(score / 10) + (score === 100 ? 5 : 0); }

  function dayKey(t) {
    const d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function streak(dailyXp, goal, now) {
    let s = 0;
    const d = new Date(now); d.setHours(12, 0, 0, 0);
    if ((dailyXp[dayKey(d)] || 0) < goal) d.setDate(d.getDate() - 1); // 오늘 미달이면 어제부터
    while ((dailyXp[dayKey(d)] || 0) >= goal) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }

  const BADGES = [
    ['first', '🌱', '첫 걸음', '첫 연습 완료', (st) => st.attempts >= 1],
    ['s3', '🔥', '3일 연속', '3일 연속 목표 달성', (st) => st.bestStreak >= 3],
    ['s7', '🚀', '일주일 개근', '7일 연속 목표 달성', (st) => st.bestStreak >= 7],
    ['s30', '🏆', '한 달 개근', '30일 연속 목표 달성', (st) => st.bestStreak >= 30],
    ['p10', '💯', '퍼펙트 10', '100점 10회', (st) => st.perfect >= 10],
    ['w30', '📗', '표현 30개', '표현 30개 학습', (st) => st.learned >= 30],
    ['wall', '📚', '표현 마스터', '모든 표현 학습', (st) => st.learned >= st.totalExpr],
    ['d50', '🎧', '받아쓰기 50', '딕테이션 50회', (st) => st.dict >= 50],
    ['i5', '🎤', '면접 준비생', '면접 답변 5회', (st) => st.iv >= 5],
    ['drive', '🚗', '드라이브 러너', '오디오 모드 10문장 완주', (st) => st.audio >= 10],
    ['lv2', '⬆️', 'Intermediate', '레벨 2 도달', (st) => st.maxLv >= 2],
    ['lv3', '🎓', 'Advanced', '레벨 3 도달', (st) => st.maxLv >= 3],
    ['fr1', '🥐', 'Bonjour!', '프랑스어 첫 연습', (st) => st.frAtt >= 1],
    ['fr30', '🗼', '파리지앵', '프랑스어 30개 익히기', (st) => st.frLearned >= 30],
  ];

  /* ───── 면접 답변 평가 ───── */
  const FILLERS = /\b(um+|uh+|uhm|erm|er|ah+|you know|kind of|sort of)\b/g;
  const LINKERS = ['first', 'then', 'finally', 'for example', 'for instance', 'as a result', 'in the end', 'because', 'however', 'so'];

  function kwHit(text, alts) {
    return alts.split('|').some((alt) => {
      const a = normalize(alt).join(' ');
      if (!a) return false;
      if (a.includes(' ')) return (' ' + text + ' ').includes(' ' + a + ' ');
      const re = new RegExp('\\b' + a + (a.length >= 4 ? '\\w*' : '') + '\\b');
      return re.test(text);
    });
  }

  function evalInterview(q, transcript, sec) {
    const words = normalize(transcript);
    const text = words.join(' ');
    const n = words.length;
    const hits = q.kw.map((k) => kwHit(text, k));
    const cov = hits.filter(Boolean).length / q.kw.length;
    const fillers = (String(transcript).toLowerCase().match(FILLERS) || []).length;
    const linkers = LINKERS.filter((l) => (' ' + text + ' ').includes(' ' + l + ' ')).length;
    const wpm = sec > 3 ? Math.round((n / sec) * 60) : null;
    const minW = q.min || 40;
    const lenScore = n < minW ? (n / minW) * 0.6 : n <= 180 ? 1 : 0.8;
    const flu = Math.max(0, 1 - fillers * 0.1) * (wpm && (wpm < 80 || wpm > 190) ? 0.8 : 1);
    let score = Math.round(100 * (0.55 * cov + 0.3 * lenScore + 0.15 * flu));
    if (n < minW) score = Math.min(score, 85);
    const fb = [];
    if (n < minW) fb.push(`답변이 짧아요. ${minW}단어 이상, 구체적인 예시 하나를 붙여보세요.`);
    if (n > 180) fb.push('답변이 길어요. 핵심만 60~90초로 줄이는 연습을 해보세요.');
    if (cov < 0.6) fb.push('핵심 포인트가 부족해요. 아래 빠진 키워드를 확인하세요.');
    if (fillers >= 3) fb.push(`군말(um/uh 등)이 ${fillers}회 감지됐어요. 말 대신 잠깐 멈추는 게 더 프로페셔널해요.`);
    if (linkers < 2 && n >= 30) fb.push('연결어(First, Then, For example, As a result)를 쓰면 구조가 명확해져요.');
    if (wpm && wpm < 80) fb.push(`말하기 속도 ${wpm} WPM — 조금 더 자신 있게 이어서 말해보세요.`);
    if (wpm && wpm > 190) fb.push(`말하기 속도 ${wpm} WPM — 조금 천천히, 또박또박!`);
    if (!fb.length) fb.push('구조·길이·핵심 모두 좋아요. 이제 모범답안보다 내 경험을 더 구체적으로!');
    return { score, n, cov, hits, fillers, wpm, fb };
  }

  const api = { normalize, compare, lev, srsUpdate, pickSession, levelCheck, bizScore, rankOf, xpFor, dayKey, streak, evalInterview, BADGES, LEVELS, RANKS, DAY, avg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CORE = api;
})(typeof window !== 'undefined' ? window : globalThis);
