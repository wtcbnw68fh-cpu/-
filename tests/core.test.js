const assert = require('assert');
const C = require('../js/core.js');
const D = require('../js/data.js');
let pass = 0;
const t = (name, fn) => { fn(); pass++; };

t('normalize contractions', () => {
  assert.deepStrictEqual(C.normalize("I'll keep you posted."), ['i','will','keep','you','posted']);
  assert.deepStrictEqual(C.normalize("I will keep you posted"), ['i','will','keep','you','posted']);
  assert.deepStrictEqual(C.normalize("Let’s touch base"), ['let','us','touch','base']);
  assert.deepStrictEqual(C.normalize("can't"), ['cannot']);
  assert.deepStrictEqual(C.normalize("doesn't"), ['does','not']);
  assert.deepStrictEqual(C.normalize("U.S.P.T.O."), ['uspto']);
  assert.deepStrictEqual(C.normalize("3:00"), ['3','oclock']);
  assert.deepStrictEqual(C.normalize("three o'clock"), ['3','oclock']);
  assert.deepStrictEqual(C.normalize("freedom-to-operate"), ['freedom','to','operate']);
  assert.deepStrictEqual(C.normalize("examiner's"), ['examiners']);
});
t('compare perfect / partial', () => {
  assert.strictEqual(C.compare("Let me get back to you on that.", "let me get back to you on that").score, 100);
  assert.strictEqual(C.compare("Can we push the call back to three o'clock?", "can we push the call back to 3:00").score, 100);
  const r = C.compare("Let me share my screen.", "let me share screen");
  assert.ok(r.score >= 70 && r.score < 100, r.score);
  assert.deepStrictEqual(r.status, ['ok','ok','ok','miss','ok']);
  assert.strictEqual(C.compare("Thank you", "").score, 0);
  const n = C.compare("The cited references", "the cited reference");
  assert.strictEqual(n.status[2], 'near');
  assert.ok(C.compare("Let me share my screen.", "let me share my screen um okay yeah sure").score < 100);
});
t('every expression self-matches 100', () => {
  for (const e of [...D.EXPRESSIONS, ...D.DICTATION_EXTRA]) assert.strictEqual(C.compare(e.en, e.en).score, 100, e.en);
});
t('data integrity', () => {
  const ids = new Set();
  for (const e of D.EXPRESSIONS) {
    assert.ok(!ids.has(e.id), 'dup ' + e.id); ids.add(e.id);
    assert.ok(e.en && e.ko && [1,2,3].includes(e.lv) && D.CATS[e.cat] && e.m.length === 2, e.id);
  }
  for (const q of D.INTERVIEW) assert.ok(q.q && q.a && q.kw.length >= 3, q.id);
});
t('interview model answers score well', () => {
  for (const q of D.INTERVIEW) {
    const r = C.evalInterview(q, q.a, 40);
    assert.ok(r.cov >= 0.75, q.id + ' cov ' + r.cov);
  }
  assert.ok(C.evalInterview(D.INTERVIEW[0], 'hello', 3).score < 30);
});
t('srs + session', () => {
  const now = Date.now();
  let s = C.srsUpdate(null, 100, now); assert.strictEqual(s.b, 1); assert.ok(s.due > now);
  s = C.srsUpdate(s, 40, now); assert.strictEqual(s.b, 0);
  const sess = C.pickSession(D.EXPRESSIONS, {}, 1, 10, now);
  assert.strictEqual(sess.length, 10); assert.ok(sess.every(x => x.lv === 1));
  assert.strictEqual(sess[0].id, 'e001');
  const srs = {}; for (const e of D.EXPRESSIONS) srs[e.id] = { b: 3, due: now + 1e9 };
  srs.e010 = { b: 0, due: now - 1 };
  const s2 = C.pickSession(D.EXPRESSIONS, srs, 3, 5, now);
  assert.strictEqual(s2[0].id, 'e010'); assert.strictEqual(s2.length, 5);
});
t('level, streak, rank', () => {
  const a = Array.from({length: 20}, () => ({ m: 'speak', s: 90, lv: 1 }));
  assert.ok(C.levelCheck(a, 1).up);
  assert.ok(!C.levelCheck(a.slice(0, 10), 1).up);
  const now = new Date(2026, 10, 15, 9).getTime();
  const dx = { '2026-11-14': 60, '2026-11-13': 50, '2026-11-12': 10 };
  assert.strictEqual(C.streak(dx, 50, now), 2);
  dx['2026-11-15'] = 55; assert.strictEqual(C.streak(dx, 50, now), 3);
  assert.strictEqual(C.rankOf(0).name, 'Intern'); assert.strictEqual(C.rankOf(1200).name, 'Associate');
});
console.log('OK', pass, 'test groups passed');
