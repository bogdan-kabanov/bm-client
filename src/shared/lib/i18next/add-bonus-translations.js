const fs = require('fs');
const path = require('path');

const translations = {
  en: {
    title: "+100% to deposit",
    subtitle: "Get a 100% bonus on your first deposit when you top up from $50",
    timeLeft: "Time left",
    depositButton: "Top up balance"
  },
  ru: {
    title: "+100% к депозиту",
    subtitle: "Получи бонус 100% на свой первый депозит при пополнении от 50$",
    timeLeft: "Осталось времени",
    depositButton: "Пополнить баланс"
  },
  es: {
    title: "+100% al depósito",
    subtitle: "Obtén un bono del 100% en tu primer depósito al recargar desde $50",
    timeLeft: "Tiempo restante",
    depositButton: "Recargar saldo"
  },
  fr: {
    title: "+100% au dépôt",
    subtitle: "Obtenez un bonus de 100% sur votre premier dépôt lors du rechargement à partir de 50$",
    timeLeft: "Temps restant",
    depositButton: "Recharger le solde"
  },
  de: {
    title: "+100% auf die Einzahlung",
    subtitle: "Erhalten Sie einen 100% Bonus auf Ihre erste Einzahlung bei Aufladung ab 50$",
    timeLeft: "Verbleibende Zeit",
    depositButton: "Guthaben aufladen"
  },
  it: {
    title: "+100% al deposito",
    subtitle: "Ottieni un bonus del 100% sul tuo primo deposito quando ricarichi da 50$",
    timeLeft: "Tempo rimanente",
    depositButton: "Ricarica saldo"
  },
  pt: {
    title: "+100% no depósito",
    subtitle: "Obtenha um bônus de 100% no seu primeiro depósito ao recarregar a partir de $50",
    timeLeft: "Tempo restante",
    depositButton: "Recarregar saldo"
  },
  zh: {
    title: "+100% 存款",
    subtitle: "首次存款从$50起充值即可获得100%奖金",
    timeLeft: "剩余时间",
    depositButton: "充值余额"
  },
  ja: {
    title: "+100% 入金",
    subtitle: "初回入金時に$50以上で100%ボーナスを獲得",
    timeLeft: "残り時間",
    depositButton: "残高をチャージ"
  },
  ko: {
    title: "+100% 입금",
    subtitle: "첫 입금 시 $50 이상 충전하면 100% 보너스 획득",
    timeLeft: "남은 시간",
    depositButton: "잔액 충전"
  },
  ar: {
    title: "+100% للإيداع",
    subtitle: "احصل على مكافأة 100% على إيداعك الأول عند الشحن من 50$",
    timeLeft: "الوقت المتبقي",
    depositButton: "شحن الرصيد"
  },
  hi: {
    title: "+100% जमा",
    subtitle: "$50 से शीर्ष अप करने पर अपने पहले जमा पर 100% बोनस प्राप्त करें",
    timeLeft: "बचा हुआ समय",
    depositButton: "बैलेंस टॉप अप करें"
  },
  tr: {
    title: "+100% yatırım",
    subtitle: "50$'dan itibaren yükleme yaparken ilk yatırımınızda %100 bonus kazanın",
    timeLeft: "Kalan süre",
    depositButton: "Bakiye yükle"
  },
  pl: {
    title: "+100% do depozytu",
    subtitle: "Otrzymaj 100% bonusu na pierwszy depozyt przy doładowaniu od 50$",
    timeLeft: "Pozostały czas",
    depositButton: "Doładuj saldo"
  },
  nl: {
    title: "+100% op storting",
    subtitle: "Krijg een 100% bonus op je eerste storting bij opladen vanaf $50",
    timeLeft: "Resterende tijd",
    depositButton: "Saldo opladen"
  },
  cs: {
    title: "+100% k vkladu",
    subtitle: "Získejte 100% bonus na první vklad při doplnění od 50$",
    timeLeft: "Zbývající čas",
    depositButton: "Doplnit zůstatek"
  },
  uk: {
    title: "+100% до депозиту",
    subtitle: "Отримай бонус 100% на свій перший депозит при поповненні від 50$",
    timeLeft: "Залишилось часу",
    depositButton: "Поповнити баланс"
  },
  ro: {
    title: "+100% la depozit",
    subtitle: "Primește un bonus de 100% la primul tău depozit când completezi de la 50$",
    timeLeft: "Timp rămas",
    depositButton: "Completează soldul"
  },
  th: {
    title: "+100% ฝากเงิน",
    subtitle: "รับโบนัส 100% สำหรับการฝากครั้งแรกเมื่อเติมเงินตั้งแต่ $50",
    timeLeft: "เวลาที่เหลือ",
    depositButton: "เติมยอดเงิน"
  }
};

const langsDir = path.join(__dirname, 'langs');
const files = fs.readdirSync(langsDir).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const langCode = file.replace('.json', '');
  const filePath = path.join(langsDir, file);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Get translation for this language or use English as fallback
  const translation = translations[langCode] || translations.en;
  
  // Add bonus section
  content.bonus = {
    title: translation.title,
    subtitle: translation.subtitle,
    timeLeft: translation.timeLeft,
    depositButton: translation.depositButton
  };
  
  // Write back to file
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log(`Added bonus translations to ${file}`);
});

console.log('Done!');

