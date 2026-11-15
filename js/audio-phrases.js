/* 앱이 직접 읽어주는 고정 영어 문구 (AI 음성 파일로 미리 생성됨) */
(function (root) {
  const SYSTEM_EN = [
    'Great!', 'Almost. Listen.', 'Here is the answer.', 'Session complete. Great job!',
    'Voice recognition is not working. Switching to shadowing mode.',
    "Thank you for your patience. I'll keep you posted.",
  ];
  const data = { SYSTEM_EN };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.AUDIO_PHRASES = data;
})(typeof window !== 'undefined' ? window : globalThis);
