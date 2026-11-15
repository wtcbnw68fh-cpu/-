#!/usr/bin/env python3
"""앱 문장을 자연스러운 AI 음성(Kokoro TTS) mp3로 생성.

사용법 (저장소 루트에서):
  pip install kokoro-onnx soundfile   # + ffmpeg 필요
  # 모델: github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
  python3 tools/gen_audio.py --model /path/kokoro-v1.0.onnx --voices /path/voices-v1.0.bin

이미 있는 파일은 건너뜀. 파일명 = FNV-1a("en|문장") → js/app.js 와 동일한 규칙.
"""
import argparse, json, os, re, subprocess, sys, tempfile
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = {'en': ('af_heart', 'en-us'), 'fr': ('ff_siwis', 'fr-fr')}

def fnv(s):
    h = 0x811c9dc5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

# 음성 전용 읽기 보정 (화면 표시 문장은 그대로)
EN_FIX = [
    (r'\bUSPTO\b', 'U S P T O'), (r'\bEPO\b', 'E P O'), (r'\bIPR\b', 'I P R'),
    (r'\[number\]', 'five'), (r'\[technical field\]', 'semiconductors'),
    (r'\[major\]', 'electrical engineering'), (r'\[field\]', 'semiconductors'),
]
def spoken(text, lang):
    if lang == 'en':
        for a, b in EN_FIX:
            text = re.sub(a, b, text)
    return text

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True)
    args = ap.parse_args()
    texts = json.loads(subprocess.check_output(['node', os.path.join(ROOT, 'tools', 'dump-texts.js')]))
    k = Kokoro(args.model, args.voices)
    manifest = {}
    for lang, items in texts.items():
        voice, code = VOICE[lang]
        outdir = os.path.join(ROOT, 'audio', lang)
        os.makedirs(outdir, exist_ok=True)
        manifest[lang] = []
        for t in items:
            h = fnv(lang + '|' + t)
            out = os.path.join(outdir, h + '.mp3')
            manifest[lang].append(h)
            if os.path.exists(out):
                continue
            samples, sr = k.create(spoken(t, lang), voice=voice, speed=1.0, lang=code)
            with tempfile.NamedTemporaryFile(suffix='.wav') as w:
                sf.write(w.name, samples, sr)
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', w.name,
                                '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.15',
                                '-ac', '1', '-ar', '24000', '-b:a', '48k', out], check=True)
            print(lang, h, t[:60])
    # 사용하지 않는 옛 파일 정리
    for lang in manifest:
        keep = set(manifest[lang])
        for f in os.listdir(os.path.join(ROOT, 'audio', lang)):
            if f.endswith('.mp3') and f[:-4] not in keep:
                os.remove(os.path.join(ROOT, 'audio', lang, f))
    with open(os.path.join(ROOT, 'js', 'audio-manifest.js'), 'w') as f:
        f.write('/* 자동 생성: tools/gen_audio.py */\nwindow.AUDIO_FILES = ' + json.dumps(manifest) + ';\n')
    print('done', {l: len(v) for l, v in manifest.items()})

if __name__ == '__main__':
    main()
