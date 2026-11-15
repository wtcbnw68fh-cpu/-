// 음성 파일로 만들 문장 목록을 JSON으로 출력 (tools/gen_audio.py가 사용)
const D = require('../js/data.js');
const F = require('../js/fr-data.js');
const SYSTEM_EN = require('../js/audio-phrases.js').SYSTEM_EN;
const en = new Set();
D.EXPRESSIONS.forEach((e) => en.add(e.en));
D.INTERVIEW.forEach((q) => { en.add(q.q); en.add(q.a); });
SYSTEM_EN.forEach((t) => en.add(t));
const fr = new Set();
F.FR_UNITS.forEach((u) => u.items.forEach((it) => fr.add(it.fr)));
process.stdout.write(JSON.stringify({ en: [...en], fr: [...fr] }));
