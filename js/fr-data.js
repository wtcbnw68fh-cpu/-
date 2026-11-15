/* 프랑스어 쌩기초 커리큘럼
 * t: 'w' 단어 / 's' 문장, pr: 한글 발음 참고(근사치), note: 팁
 * 명사는 관사(le/la/un/une)와 함께 외우는 게 기본 → 관사 포함 표기
 */
(function (root) {
  const FR_UNITS = [
    { id: 'u1', emoji: '👋', title: '인사', items: [
      { id: 'f101', t: 'w', e: '☀️', fr: 'Bonjour', ko: '안녕하세요 (낮 인사)', pr: '봉주흐', note: '가게·엘리베이터에서도 먼저 "Bonjour!" 하는 게 기본 예의.' },
      { id: 'f102', t: 'w', e: '🙏', fr: 'Merci', ko: '고맙습니다', pr: '메흐씨', note: 'r은 목 안쪽에서 가볍게 긁는 "흐" 소리.' },
      { id: 'f103', t: 'w', e: '👋', fr: 'Au revoir', ko: '안녕히 계세요/가세요', pr: '오 흐부아흐' },
      { id: 'f104', t: 'w', e: '✅', fr: 'Oui', ko: '네', pr: '위' },
      { id: 'f105', t: 'w', e: '❌', fr: 'Non', ko: '아니요', pr: '농', note: '끝의 n은 거의 안 들리는 콧소리.' },
      { id: 'f106', t: 'w', e: '🌙', fr: 'Bonsoir', ko: '안녕하세요 (저녁 인사)', pr: '봉수아흐' },
      { id: 'f107', t: 'w', e: '😊', fr: 'Salut', ko: '안녕 (친구끼리)', pr: '쌀뤼', note: '만날 때·헤어질 때 둘 다 사용. 끝의 t는 발음 안 함.' },
      { id: 'f108', t: 's', e: '🙂', fr: 'Ça va ?', ko: '잘 지내? / 괜찮아?', pr: '싸 바' },
      { id: 'f109', t: 's', e: '😄', fr: 'Ça va bien, merci.', ko: '잘 지내요, 고마워요.', pr: '싸 바 비앙, 메흐씨' },
      { id: 'f110', t: 's', e: '🤝', fr: 'Enchanté.', ko: '만나서 반가워요.', pr: '앙샹떼', note: '여성이 쓸 땐 철자가 Enchantée (발음은 같음).' },
      { id: 'f111', t: 's', e: '🌤️', fr: 'Bonne journée !', ko: '좋은 하루 보내세요!', pr: '본 주흐네' },
      { id: 'f112', t: 's', e: '🔜', fr: 'À bientôt !', ko: '곧 또 봐요!', pr: '아 비앙또' },
    ] },
    { id: 'u2', emoji: '🆘', title: '생존 표현', items: [
      { id: 'f201', t: 'w', e: '🙇', fr: "S'il vous plaît", ko: '부탁합니다 / ~주세요', pr: '씰 부 쁠레', note: '주문·부탁할 때 끝에 붙이면 끝.' },
      { id: 'f202', t: 'w', e: '😅', fr: 'Pardon', ko: '죄송해요 / 네? 뭐라고요?', pr: '빠흐동' },
      { id: 'f203', t: 'w', e: '✋', fr: 'Excusez-moi', ko: '실례합니다', pr: '엑스뀌제 무아', note: '모르는 사람에게 말 걸 때 첫마디.' },
      { id: 'f204', t: 'w', e: '😌', fr: 'De rien', ko: '천만에요', pr: '드 히앙' },
      { id: 'f205', t: 'w', e: '👌', fr: "D'accord", ko: '알겠어요 / 좋아요', pr: '다꼬흐' },
      { id: 'f206', t: 's', e: '🤯', fr: 'Je ne comprends pas.', ko: '이해가 안 돼요.', pr: '쥬 느 꽁프헝 빠' },
      { id: 'f207', t: 's', e: '🔁', fr: "Pouvez-vous répéter, s'il vous plaît ?", ko: '다시 말씀해 주시겠어요?', pr: '뿌베 부 헤뻬떼, 씰 부 쁠레' },
      { id: 'f208', t: 's', e: '🐢', fr: "Plus lentement, s'il vous plaît.", ko: '좀 더 천천히 부탁해요.', pr: '쁠뤼 렁뜨멍, 씰 부 쁠레' },
      { id: 'f209', t: 's', e: '🇬🇧', fr: 'Parlez-vous anglais ?', ko: '영어 하세요?', pr: '빠흘레 부 정글레' },
      { id: 'f210', t: 's', e: '🤏', fr: 'Je parle un peu français.', ko: '저는 프랑스어를 조금 해요.', pr: '쥬 빠흘 엉 뾔 프헝쎄' },
    ] },
    { id: 'u3', emoji: '🔢', title: '숫자 1–10', items: [
      { id: 'f301', t: 'w', e: '1️⃣', fr: 'un', ko: '1', pr: '엉' },
      { id: 'f302', t: 'w', e: '2️⃣', fr: 'deux', ko: '2', pr: '되' },
      { id: 'f303', t: 'w', e: '3️⃣', fr: 'trois', ko: '3', pr: '트후아' },
      { id: 'f304', t: 'w', e: '4️⃣', fr: 'quatre', ko: '4', pr: '꺄트흐' },
      { id: 'f305', t: 'w', e: '5️⃣', fr: 'cinq', ko: '5', pr: '쌩끄' },
      { id: 'f306', t: 'w', e: '6️⃣', fr: 'six', ko: '6', pr: '씨스' },
      { id: 'f307', t: 'w', e: '7️⃣', fr: 'sept', ko: '7', pr: '쎄뜨', note: 'p는 발음 안 함.' },
      { id: 'f308', t: 'w', e: '8️⃣', fr: 'huit', ko: '8', pr: '위뜨' },
      { id: 'f309', t: 'w', e: '9️⃣', fr: 'neuf', ko: '9', pr: '뇌프' },
      { id: 'f310', t: 'w', e: '🔟', fr: 'dix', ko: '10', pr: '디스' },
      { id: 'f311', t: 's', e: '💶', fr: 'Ça coûte combien ?', ko: '얼마예요?', pr: '싸 꾸뜨 꽁비앙' },
      { id: 'f312', t: 's', e: '🍽️', fr: "Une table pour deux, s'il vous plaît.", ko: '두 명 자리 부탁해요.', pr: '윈 따블 뿌흐 되, 씰 부 쁠레' },
    ] },
    { id: 'u4', emoji: '☕', title: '카페 · 식당', items: [
      { id: 'f401', t: 'w', e: '☕', fr: 'un café', ko: '커피 (한 잔)', pr: '엉 까페', note: '프랑스에서 그냥 café = 에스프레소.' },
      { id: 'f402', t: 'w', e: '💧', fr: "de l'eau", ko: '물', pr: '드 로' },
      { id: 'f403', t: 'w', e: '🥐', fr: 'un croissant', ko: '크루아상', pr: '엉 크후아썽' },
      { id: 'f404', t: 'w', e: '🥖', fr: 'le pain', ko: '빵', pr: '르 빵' },
      { id: 'f405', t: 'w', e: '🧀', fr: 'le fromage', ko: '치즈', pr: '르 프호마쥬' },
      { id: 'f406', t: 'w', e: '🍷', fr: 'le vin', ko: '와인', pr: '르 뱅' },
      { id: 'f407', t: 'w', e: '🧾', fr: "l'addition", ko: '계산서', pr: '라디씨옹' },
      { id: 'f408', t: 's', e: '☕', fr: "Un café, s'il vous plaît.", ko: '커피 한 잔 주세요.', pr: '엉 까페, 씰 부 쁠레' },
      { id: 'f409', t: 's', e: '🥐', fr: 'Je voudrais un croissant.', ko: '크루아상 하나 주세요. (원해요)', pr: '쥬 부드헤 엉 크후아썽', note: 'Je voudrais ~ = ~를 원합니다 (정중한 주문 표현).' },
      { id: 'f410', t: 's', e: '💧', fr: "De l'eau, s'il vous plaît.", ko: '물 좀 주세요.', pr: '드 로, 씰 부 쁠레' },
      { id: 'f411', t: 's', e: '😋', fr: "C'est délicieux !", ko: '정말 맛있어요!', pr: '쎄 델리씨외' },
      { id: 'f412', t: 's', e: '🧾', fr: "L'addition, s'il vous plaît.", ko: '계산서 주세요.', pr: '라디씨옹, 씰 부 쁠레' },
    ] },
    { id: 'u5', emoji: '🙋', title: '나 소개하기', items: [
      { id: 'f501', t: 'w', e: '🇰🇷', fr: 'la Corée', ko: '한국', pr: '라 꼬헤' },
      { id: 'f502', t: 'w', e: '🏙️', fr: 'Séoul', ko: '서울', pr: '쎄울' },
      { id: 'f503', t: 'w', e: '📅', fr: "aujourd'hui", ko: '오늘', pr: '오쥬흐뒤' },
      { id: 'f504', t: 'w', e: '➡️', fr: 'demain', ko: '내일', pr: '드망' },
      { id: 'f505', t: 's', e: '❓', fr: 'Comment vous appelez-vous ?', ko: '성함이 어떻게 되세요?', pr: '꼬멍 부 자쁠레 부' },
      { id: 'f506', t: 's', e: '🇰🇷', fr: 'Je viens de Corée.', ko: '저는 한국에서 왔어요.', pr: '쥬 비앙 드 꼬헤' },
      { id: 'f507', t: 's', e: '🏠', fr: "J'habite à Séoul.", ko: '저는 서울에 살아요.', pr: '자비뜨 아 쎄울' },
      { id: 'f508', t: 's', e: '📖', fr: "J'apprends le français.", ko: '저는 프랑스어를 배우고 있어요.', pr: '자프헝 르 프헝쎄' },
      { id: 'f509', t: 's', e: '❤️', fr: "J'aime le café.", ko: '저는 커피를 좋아해요.', pr: '젬 르 까페' },
    ] },
    { id: 'u6', emoji: '💼', title: '사무실 맛보기', items: [
      { id: 'f601', t: 'w', e: '🏢', fr: 'le bureau', ko: '사무실', pr: '르 뷔호' },
      { id: 'f602', t: 'w', e: '👥', fr: 'la réunion', ko: '회의', pr: '라 헤위니옹' },
      { id: 'f603', t: 'w', e: '🤵', fr: 'le client', ko: '고객, 클라이언트', pr: '르 끌리엉' },
      { id: 'f604', t: 'w', e: '📜', fr: 'le brevet', ko: '특허', pr: '르 브흐베' },
      { id: 'f605', t: 'w', e: '💻', fr: "l'ordinateur", ko: '컴퓨터', pr: '로흐디나뙤흐' },
      { id: 'f606', t: 's', e: '🏢', fr: 'Je suis au bureau.', ko: '저 사무실이에요.', pr: '쥬 쒸 오 뷔호' },
      { id: 'f607', t: 's', e: '📅', fr: "J'ai une réunion demain.", ko: '내일 회의가 있어요.', pr: '줴 윈 헤위니옹 드망' },
      { id: 'f608', t: 's', e: '📜', fr: 'Je travaille dans le domaine des brevets.', ko: '저는 특허 분야에서 일해요.', pr: '쥬 트하바이 당 르 도멘 데 브흐베' },
      { id: 'f609', t: 's', e: '👋', fr: 'À demain !', ko: '내일 봐요!', pr: '아 드망' },
      { id: 'f610', t: 's', e: '🏖️', fr: 'Bon week-end !', ko: '주말 잘 보내세요!', pr: '봉 위껜드' },
    ] },
  ];

  const data = { FR_UNITS };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.FR_DATA = data;
})(typeof window !== 'undefined' ? window : globalThis);
