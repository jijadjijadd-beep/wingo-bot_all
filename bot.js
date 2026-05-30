const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const BOT_TOKEN = '8237373943:AAEu0Gww7ez_eaKiB6lVG_v6jHPETpF_3JA';
const CHAT_ID = '-1003724062754';
const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_30/GetHistoryIssuePage.json";

// স্টিকার ID - @RawDataBot থেকে নিজেরটা বসাও
const WIN_STICKER = 'CAACAgIAAxkBAAIBa2Vt1J7b8kYQZ1X1AAIqAAP3AsgNBh3oAAB0J8yNAQ'; // ✅
const LOSS_STICKER = 'CAACAgIAAxkBAAIBaWVt1I7a8kYQZ1X1Z1X1AAIqAAP3AsgNBh3oAAB0J8yNAQ'; // ❌

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastPeriod = null;
let currentSignal = null;

// ========================================
// সিগনাল লজিক - 7 টা অ্যানালাইসিস
// ========================================
async function generateAdvancedSignal() {
  try {
    const response = await axios.get(API_URL);
    const data = response.data;

    if (!data ||!data.data || data.data.length < 10) {
      return { signal: 'SMALL', odd: 0, even: 0, period: '0000' };
    }

    const results = data.data;
    let oddCount = 0;
    let evenCount = 0;
    const currentPeriod = results[0].issueNumber.slice(-4); // লাস্ট 4 ডিজিট

    // 1. লাস্ট রেজাল্ট ODD/EVEN
    const last1 = Number(results[0].number);
    if (last1 % 2 === 0) evenCount++; else oddCount++;

    // 2. লাস্ট ২ রেজাল্ট ODD/EVEN
    for (let i = 0; i < 2; i++) {
      const num = Number(results[i].number);
      if (num % 2 === 0) evenCount++; else oddCount++;
    }

    // 3. লাস্ট 3/4 পিরিয়ড ODD/EVEN
    for (let i = 0; i < 4; i++) {
      const num = Number(results[i].number);
      if (num % 2 === 0) evenCount++; else oddCount++;
    }

    // 4. LAST 5 RESULT ODD/EVEN
    for (let i = 0; i < 5; i++) {
      const num = Number(results[i].number);
      if (num % 2 === 0) evenCount++; else oddCount++;
    }

    // 5. LAST 10 RESULT WINGO TRACKING - Big/Small ট্রেন্ড
    let bigTrend = 0, smallTrend = 0;
    for (let i = 0; i < 10; i++) {
      const num = Number(results[i].number);
      if (num >= 5) bigTrend++; else smallTrend++;
    }
    if (bigTrend > smallTrend) evenCount++; else oddCount++; // Big=Even ধরি

    // 6. QUANTUM AI - প্যাটার্ন ডিটেকশন
    let pattern = 0;
    for (let i = 0; i < 9; i++) {
      if (Number(results[i].number) % 2 === Number(results[i+1].number) % 2) pattern++;
    }
    if (pattern > 4) evenCount++; else oddCount++;

    // 7. LAST 5 PERIOD ODD/EVEN - পিরিয়ড নাম্বার দিয়ে
    for (let i = 0; i < 5; i++) {
      const periodNum = Number(results[i].issueNumber.slice(-1));
      if (periodNum % 2 === 0) evenCount++; else oddCount++;
    }

    // ========================================
    // ফাইনাল ডিসিশন: ODD vs EVEN
    // ========================================
    const finalSignal = oddCount > evenCount? 'ODD' : 'EVEN';

    // ODD/EVEN → BIG/SMALL কনভার্ট
    // ODD = SMALL, EVEN = BIG
    const bigSmall = finalSignal === 'ODD'? 'SMALL' : 'BIG';

    return {
      signal: bigSmall,
      odd: oddCount,
      even: evenCount,
      period: currentPeriod
    };

  } catch (error) {
    console.error('API Error:', error.message);
    return { signal: 'SMALL', odd: 0, even: 0, period: '0000' };
  }
}

// ========================================
// WIN/LOSS চেক + স্টিকার
// ========================================
async function checkResult() {
  try {
    const response = await axios.get(API_URL);
    const data = response.data;

    if (!data ||!data.data || data.data.length === 0) return;

    const latestResult = data.data[0];

    if (currentSignal && lastPeriod && latestResult.issueNumber!== lastPeriod) {
      const resultNum = Number(latestResult.number);
      const isBig = resultNum >= 5;
      const signalBig = currentSignal.signal === 'BIG';

      let result = 'LOSS';
      if (signalBig && isBig) result = 'WIN';
      if (!signalBig &&!isBig) result = 'WIN';

      // WIN/LOSS মেসেজ + স্টিকার
      if (result === 'WIN') {
        await bot.sendSticker(CHAT_ID, WIN_STICKER);
        await bot.sendMessage(CHAT_ID, `
◈▣▣▣▣▣▣ 💎 ▣▣▣▣◈
✅ RESULT: WIN WIN 💰
◈▣▣▣▣ 💎 ▣▣▣▣◈
        `);
      } else {
        await bot.sendSticker(CHAT_ID, LOSS_STICKER);
        await bot.sendMessage(CHAT_ID, `
◈▣▣▣▣▣▣▣▣ ⚠️ ▣▣▣▣▣▣▣▣◈
❌ RESULT: LOSS ❌
◈▣▣▣▣▣▣▣▣ ⚠️ ▣▣▣▣▣▣◈
        `);
      }
    }

    lastPeriod = latestResult.issueNumber;

  } catch (error) {
    console.error('Check Result Error:', error.message);
  }
}

// ========================================
// সিগনাল পাঠাও
// ========================================
async function sendSignal() {
  try {
    await checkResult(); // আগে রেজাল্ট চেক

    currentSignal = await generateAdvancedSignal();

    const message = `
◈▣▣▣▣▣ 👑 ▣▣▣◈
⚡ 𝗚𝗔𝗠𝗘: 𝟑𝟎 𝐒𝐄𝐂
🆔 𝐏𝐄𝐑𝐈𝐎𝐃: 💠${currentSignal.period}💠
🔥 𝐁𝐄𝐓 𝐍𝐎𝐖: ${currentSignal.signal === 'BIG'? '𝗕𝐈𝐆 🟢' : '𝗦𝐌𝐀𝐋𝐋 🔴'}
📊 ODD: ${currentSignal.odd} | EVEN: ${currentSignal.even}
◈▣▣▣▣▣ 💎 ▣▣▣◈
    `;

    await bot.sendMessage(CHAT_ID, message);
    console.log(`Signal: ${currentSignal.signal} | ODD:${currentSignal.odd} EVEN:${currentSignal.even}`);

  } catch (error) {
    console.error('Send Signal Error:', error.message);
  }
}

// 30 সেকেন্ড পরপর চালাও
console.log('Bot Started - 7 Analysis Running 24/7');
sendSignal();
setInterval(sendSignal, 30000);

// Render কে জাগায় রাখার জন্য
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Quantum AI Bot Running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
