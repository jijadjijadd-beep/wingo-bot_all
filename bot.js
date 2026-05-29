const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const BOT_TOKEN = '8237373943:AAEu0Gww7ez_eaKiB6lVG_v6jHPETpF_3JA';
const CHAT_ID = '-1003724062754';

const API_URL =
'https://draw.ar-lottery01.com/WinGo/WinGo_30/GetHistoryIssuePage.json';

// ===== STICKERS =====
const WIN_STICKER =
'CAACAgUAAxkBAAEBW8xmZ2VlZ2VlZ2VlZ2VlZ2VlZ2VlZ2UAAgACGAADwDZPGkqX2YV0KzIrHgQ';

const LOSS_STICKER =
'CAACAgUAAxkBAAEBW8xmZ2VlZ2VlZ2VlZ2VlZ2VlZ2VlZ2UAAgACGAADwDZPGkqX2YV0KzIrHgQ';

// ===== BOT =====
const bot = new TelegramBot(BOT_TOKEN, {
  polling: false
});

// ===== STATE =====
let lastPeriod = null;

let currentSignal = null;

let stats = {
  wins: 0,
  losses: 0
};

let history = [];

// ===== FETCH RESULT =====
async function fetchGameResult() {

  try {

    const response = await axios.get(API_URL);

    const data = response.data;

    if (
      !data ||
      !data.data ||
      !data.data.list
    ) {
      return [];
    }

    return data.data.list.map(item => ({
      period: item.issueNumber,
      number: parseInt(item.number)
    }));

  } catch (error) {

    console.log(
      'API ERROR:',
      error.message
    );

    return [];
  }

}

// ===== ORIGINAL SIGNAL LOGIC =====
async function generateReverseSignal() {

  try {

    const response =
    await axios.get(API_URL);

    const data = response.data;

    if (
      !data ||
      !data.data ||
      !data.data.list ||
      data.data.list.length < 5
    ) {

      const isBig =
      Math.random() > 0.5;

      const num1 = isBig
      ? Math.floor(Math.random() * 5)
      : 5 + Math.floor(Math.random() * 5);

      const num2 = isBig
      ? Math.floor(Math.random() * 5)
      : 5 + Math.floor(Math.random() * 5);

      return {
        signal: isBig
        ? 'SMALL'
        : 'BIG',

        numbers: [num1, num2]
        .sort((a,b)=>a-b)
      };

    }

    let bigCount = 0;
    let smallCount = 0;

    const recentResults =
    data.data.list.slice(0, 5);

    for (const result of recentResults) {

      const num =
      Number(result.number);

      if (num >= 5) {
        bigCount++;
      } else {
        smallCount++;
      }

    }

    // ===== SAME LOGIC =====
    let originalSignal =
    bigCount > smallCount
    ? 'SMALL'
    : 'BIG';

    if (bigCount === smallCount) {

      originalSignal =
      ['BIG', 'SMALL'][
        Math.floor(Math.random() * 2)
      ];

    }

    const reverseSignal =
    originalSignal === 'BIG'
    ? 'SMALL'
    : 'BIG';

    let numbers = [];

    if (reverseSignal === 'SMALL') {

      let n1 =
      Math.floor(Math.random() * 5);

      let n2 =
      Math.floor(Math.random() * 5);

      numbers =
      [n1, n2]
      .sort((a,b)=>a-b);

    } else {

      let n1 =
      5 + Math.floor(Math.random() * 5);

      let n2 =
      5 + Math.floor(Math.random() * 5);

      numbers =
      [n1, n2]
      .sort((a,b)=>a-b);

    }

    return {
      signal: reverseSignal,
      numbers: numbers
    };

  } catch (error) {

    console.log(
      'Generate Signal Error:',
      error.message
    );

    return {
      signal: 'SMALL',
      numbers: [0,1]
    };

  }

}

// ===== SEND MESSAGE =====
async function sendMessage(text) {

  try {

    await bot.sendMessage(
      CHAT_ID,
      text
    );

  } catch (error) {

    console.log(
      'Message Error:',
      error.message
    );

  }

}

// ===== SEND STICKER =====
async function sendSticker(sticker) {

  try {

    await bot.sendSticker(
      CHAT_ID,
      sticker
    );

  } catch (error) {

    console.log(
      'Sticker Error:',
      error.message
    );

  }

}

// ===== RESULT CHECK =====
async function checkResult() {

  try {

    const results =
    await fetchGameResult();

    if (results.length === 0) {
      return;
    }

    const latestResult =
    results[0];

    // ===== CHECK OLD SIGNAL =====
    if (
      currentSignal &&
      lastPeriod &&
      latestResult.period !== lastPeriod
    ) {

      const resultNum =
      Number(latestResult.number);

      const isBig =
      resultNum >= 5;

      const signalBig =
      currentSignal.signal === 'BIG';

      let result = 'LOSS';

      // ===== SAME LOGIC =====
      if (
        signalBig &&
        isBig &&
        currentSignal.numbers.includes(resultNum)
      ) {

        result = 'WIN';

      } else if (
        !signalBig &&
        !isBig &&
        currentSignal.numbers.includes(resultNum)
      ) {

        result = 'WIN';

      }

      // ===== SAVE HISTORY =====
      history.unshift({
        period: currentSignal.period,
        signal: currentSignal.signal,
        numbers: currentSignal.numbers,
        resultNumber: resultNum,
        status: result
      });

      if (history.length > 50) {
        history.pop();
      }

      // ===== WIN =====
      if (result === 'WIN') {

        stats.wins++;

        await sendSticker(
          WIN_STICKER
        );

        await sendMessage(`
◈▣▣▣ 👑 RESULT 👑 ▣▣▣◈

✅ STATUS: WIN

🎯 RESULT NUMBER: ${resultNum}

🔥 SIGNAL:
${currentSignal.signal}

🎲 NUMBERS:
${currentSignal.numbers[0]}/${currentSignal.numbers[1]}

◈▣▣▣ 💎 WIN 💎 ▣▣▣◈
`);

      }

      // ===== LOSS =====
      else {

        stats.losses++;

        await sendSticker(
          LOSS_STICKER
        );

        await sendMessage(`
◈▣▣▣ 👑 RESULT 👑 ▣▣▣◈

❌ STATUS: LOSS

🎯 RESULT NUMBER: ${resultNum}

🔥 SIGNAL:
${currentSignal.signal}

🎲 NUMBERS:
${currentSignal.numbers[0]}/${currentSignal.numbers[1]}

◈▣▣▣ 💀 LOSS 💀 ▣▣▣◈
`);

      }

    }

    lastPeriod =
    latestResult.period;

  } catch (error) {

    console.log(
      'Check Result Error:',
      error.message
    );

  }

}

// ===== SEND SIGNAL =====
async function sendSignal() {

  try {

    // ===== CHECK RESULT FIRST =====
    await checkResult();

    const results =
    await fetchGameResult();

    if (results.length === 0) {
      return;
    }

    const latest =
    results[0];

    const nextPeriod =
    (
      BigInt(latest.period) + 1n
    ).toString();

    // ===== GENERATE SIGNAL =====
    currentSignal =
    await generateReverseSignal();

    currentSignal.period =
    nextPeriod;

    const total =
    stats.wins + stats.losses;

    const accuracy =
    total > 0
    ? (
      (stats.wins / total) * 100
    ).toFixed(1)
    : 0;

    // ===== SEND NEW SIGNAL =====
    const message = `
◈▣▣▣ 👑 WINGO SIGNAL 👑 ▣▣▣◈

⚡ GAME: 30S

🆔 PERIOD:
${nextPeriod}

🔥 BET NOW:
${currentSignal.signal}

🎯 NUMBER:
${currentSignal.numbers[0]}, ${currentSignal.numbers[1]}

📊 WIN:
${stats.wins}

📊 LOSS:
${stats.losses}

📈 ACCURACY:
${accuracy}%

◈▣▣▣ 💎 SIGNAL 💎 ▣▣▣◈
`;

    await sendMessage(message);

    console.log(`
NEW SIGNAL:
${currentSignal.signal}
${currentSignal.numbers[0]}/${currentSignal.numbers[1]}
`);

  } catch (error) {

    console.log(
      'Send Signal Error:',
      error.message
    );

  }

}

// ===== START =====
console.log(
'BOT STARTED 24/7'
);

// ===== FIRST RUN =====
sendSignal();

// ===== AUTO RUN =====
setInterval(
  sendSignal,
  30000
);

// ===== EXPRESS SERVER =====
const app = express();

const PORT =
process.env.PORT || 3000;

app.get('/', (req, res) => {

  res.send(`
  <h2>
  WINGO BOT RUNNING 24/7
  </h2>
  `);

});

app.listen(PORT, () => {

  console.log(`
  SERVER RUNNING:
  ${PORT}
  `);

});    for (const result of recentResults) {
      const num = Number(result.number);
      if (num >= 5) bigCount++;
      else smallCount++;
    }

    // আসল লজিকের উল্টা
    let originalSignal = bigCount > smallCount? 'SMALL' : 'BIG';
    if (bigCount === smallCount) originalSignal = ['BIG', 'SMALL'][Math.floor(Math.random() * 2)];

    const reverseSignal = originalSignal === 'BIG'? 'SMALL' : 'BIG';

    // র‍্যান্ডম নাম্বার: Small=0-4, Big=5-9
    let numbers = [];
    if (reverseSignal === 'SMALL') {
      let n1 = Math.floor(Math.random() * 5); // 0-4
      let n2 = Math.floor(Math.random() * 5); // 0-4
      numbers = [n1, n2].sort((a,b)=>a-b);
    } else {
      let n1 = 5 + Math.floor(Math.random() * 5); // 5-9
      let n2 = 5 + Math.floor(Math.random() * 5); // 5-9
      numbers = [n1, n2].sort((a,b)=>a-b);
    }

    return { signal: reverseSignal, numbers: numbers };

  } catch (error) {
    console.error('API Error:', error.message);
    return { signal: 'SMALL', numbers: [0, 1] };
  }
}

// রেজাল্ট চেক + WIN/LOSS দুইটার স্টিকার
async function checkResult() {
  try {
    const response = await axios.get(API_URL);
    const data = response.data;

    if (!data ||!data.data || data.data.length === 0) return;

    const latestResult = data.data[0];

    // নতুন পিরিয়ড হইলে রেজাল্ট চেক
    if (currentSignal && lastPeriod && latestResult.issueNumber!== lastPeriod) {
      const resultNum = Number(latestResult.number);
      const isBig = resultNum >= 5;
      const signalBig = currentSignal.signal === 'BIG';

      // WIN/LOSS চেক
      let result = 'LOSS';
      if (signalBig && isBig && currentSignal.numbers.includes(resultNum)) {
        result = 'WIN';
      } else if (!signalBig &&!isBig && currentSignal.numbers.includes(resultNum)) {
        result = 'WIN';
      }

      // WIN/LOSS দুইটার স্টিকার + মেসেজ
      if (result === 'WIN') {
        await bot.sendSticker(CHAT_ID, WIN_STICKER); // ✅ স্টিকার
        await bot.sendMessage(CHAT_ID, `✅ RESULT: WIN ✅\n🎯 আসল নাম্বার: ${resultNum}\n💰 সিগনাল: ${currentSignal.signal} ${currentSignal.numbers[0]}/${currentSignal.numbers[1]}`);
      } else {
        await bot.sendSticker(CHAT_ID, LOSS_STICKER); // ❌ স্টিকার
        await bot.sendMessage(CHAT_ID, `❌ RESULT: LOSS ❌\n💀 আসল নাম্বার: ${resultNum}\n😭 সিগনাল: ${currentSignal.signal} ${currentSignal.numbers[0]}/${currentSignal.numbers[1]}`);
      }
    }

    lastPeriod = latestResult.issueNumber;

  } catch (error) {
    console.error('Check Result Error:', error.message);
  }
}

// সিগনাল পাঠাও
async function sendSignal() {
  try {
    await checkResult(); // আগে রেজাল্ট চেক

    currentSignal = await generateReverseSignal();

    const message = `
◈▣▣▣ 👑 ▣▣▣◈
⚡ GAME: 30S
🆔 SIGNAL: ${currentSignal.signal} ${currentSignal.numbers[0]}/${currentSignal.numbers[1]}
🔥 BET NOW: ${currentSignal.signal}
🎯 NUMBER: ${currentSignal.numbers[0]}, ${currentSignal.numbers[1]}
◈▣▣▣ 💎 ▣▣▣◈
    `;

    await bot.sendMessage(CHAT_ID, message);
    console.log(`Signal: ${currentSignal.signal} ${currentSignal.numbers[0]}/${currentSignal.numbers[1]}`);

  } catch (error) {
    console.error('Send Signal Error:', error.message);
  }
}

// 30 সেকেন্ড পরপর চালাও
console.log('Bot Started - Running 24/7');
sendSignal(); // প্রথমবার
setInterval(sendSignal, 30000); // 30 সেকেন্ড

// Render কে জাগায় রাখার জন্য
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is Running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// ===== CLASS 11 MATH CALCULATION =====
function calculateClass11Math(){
  const nums = historyCache.slice(0, 10);
  if(nums.length < 10) return null;

  const n = nums.length;
  const sum = nums.reduce((a,b)=>a+b, 0);
  const mean = sum / n;

  const sorted = [...nums].sort((a,b)=>a-b);
  const median = (sorted[4] + sorted[5]) / 2;

  const freq = {};
  nums.forEach(n => freq[n] = (freq[n]||0)+1);
  let maxFreq = Math.max(...Object.values(freq));
  let mode = maxFreq === 1? -1 : parseInt(Object.keys(freq).filter(k=>freq[k]===maxFreq)[0]);

  const q1Pos = (n + 1) / 4;
  const q3Pos = 3 * (n + 1) / 4;
  const q1 = sorted[Math.floor(q1Pos)-1];
  const q3 = sorted[Math.floor(q3Pos)-1];

  const variance = nums.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return { mean, median, mode, q1, q3, stdDev, nums };
}

// ===== SIGNAL GENERATOR - Class 11 Logic =====
function generateSignal(){
  const math = calculateClass11Math();
  if(!math) return {bet: 'BIG', colorName: 'GREEN', numbers: [7,9]};

  const { mean, median, mode, q1, q3, stdDev } = math;
  let bet, colorName, numbers;

  // গড় + চতুর্থক দিয়ে সিগনাল
  if(mean > 4.5 && q3 > 6){
    bet = 'BIG';
  }else if(mean < 4.5 && q1 < 3){
    bet = 'SMALL';
  }else{
    bet = median >= 5? 'BIG' : 'SMALL';
  }

  // স্ট্রিক ব্রেক - 3টা একই হলে উল্টা
  const last3 = historyCache.slice(0, 3);
  if(last3.length >= 3){
    if(last3.every(n => n >= 5)) bet = 'SMALL';
    if(last3.every(n => n <= 4)) bet = 'BIG';
  }

  // নাম্বার সিলেক্ট - Class 11 প্রচুরক ইউজ
  if(bet === 'BIG'){
    if(mode >= 5 && mode <= 9){
      numbers = mode == 5 || mode == 6? [6,8] : [7,9];
      colorName = mode == 5 || mode == 6? 'RED' : 'GREEN';
    }else{
      if(mean > 7){ numbers = [8,9]; colorName = 'GREEN'; }
      else if(mean > 6){ numbers = [7,9]; colorName = 'GREEN'; }
      else if(mean > 5){ numbers = [6,8]; colorName = 'RED'; }
      else{ numbers = [5,7]; colorName = 'GREEN'; }
    }
  }else{
    if(mode >= 0 && mode <= 4){
      numbers = mode == 0 || mode == 2? [0,2] : [1,3];
      colorName = mode == 0 || mode == 2? 'RED' : 'GREEN';
    }else{
      if(mean < 1.5){ numbers = [0,2]; colorName = 'RED'; }
      else if(mean < 2.5){ numbers = [1,3]; colorName = 'GREEN'; }
      else if(mean < 3.5){ numbers = [2,4]; colorName = 'RED'; }
      else{ numbers = [3,4]; colorName = 'GREEN'; }
    }
  }

  return { bet, colorName, numbers };
}

// ===== TELEGRAM FUNCTIONS =====
async function sendTelegram(msg){
  try{
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: msg
    });
    console.log('Signal sent to Telegram');
  }catch(e){
    console.log('Telegram error:', e.message);
  }
}

async function sendSticker(stickerId){
  try{
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendSticker`, {
      chat_id: CHAT_ID,
      sticker: stickerId
    });
    console.log('Sticker sent');
  }catch(e){
    console.log('Sticker error:', e.message);
  }
}

// ===== MAIN BOT LOOP =====
async function run(){
  try{
    const res = await axios.get(API_1M);
    const cur = res.data.data.list[0];
    const period = cur.issueNumber;
    const number = parseInt(cur.number);
    const type = number >= 5? "BIG" : "SMALL";

    historyCache = res.data.data.list.map(i => parseInt(i.number));

    // RESULT পাঠাও
    if(lastSignal && lastPeriod!== period){
      const numbers = lastNumbers.split(',').map(n=>parseInt(n));
      const result = numbers.includes(number)? "WIN" : "LOSS";

      if(result === "WIN") winCount++;
      else lossCount++;

      const resultMsg = `
◈▣▣▣ 👑 ▣▣▣▣▣◈
⚡ GAME: 1M
🆔 PERIOD: ${lastPeriod}
📊 RESULT: ${number} (${type})
🔥 SIGNAL: ${lastColor} ${lastSignal} [${lastNumbers}]
━━━━━━━━━━━━━━━━━━━━
💥 RESULT: ${result}
📈 WIN: ${winCount} | LOSS: ${lossCount}
◈▣▣▣ 💎 ▣▣▣▣▣◈
`;

      await sendTelegram(resultMsg);
      await sendSticker(result === "WIN"? WIN_STICKER_ID : LOSS_STICKER_ID);
    }

    // NEW SIGNAL পাঠাও
    if(lastPeriod!== period){
      const signal = generateSignal();
      lastSignal = signal.bet;
      lastColor = signal.colorName;
      lastNumbers = signal.numbers.join(',');

      const signalMsg = `
◈▣▣▣ 👑 ▣▣▣◈
⚡ GAME: 1M
🆔 PERIOD: ${period}
🎨 COLOR: ${signal.colorName}
🔥 BET NOW: ${signal.bet}
🎯 NUMBER: ${signal.numbers.join(',')}
📊 ACCURACY: ${winCount + lossCount > 0? ((winCount/(winCount+lossCount))*100).toFixed(1) : 0}%
◈▣▣▣ 💎 ▣▣▣◈
`;

      await sendTelegram(signalMsg);
      lastPeriod = period;
      console.log(`New signal sent for period ${period}`);
    }

  }catch(error){
    console.error('Error:', error.message);
  }
}

// 3 সেকেন্ড পরপর চেক করবে
setInterval(run, 3000);
console.log('Bot Started - Running 24/7');
console.log('Class 11 Math Bot Online');
