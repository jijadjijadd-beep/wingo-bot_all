const axios = require('axios');
const express = require('express');

// ===== CONFIG - এখানে তোমার ডাটা বসাও =====
const BOT_TOKEN = '8965691630:AAHWX9hlPmJkK2nQSISwLkG-HwK6IZtfA8c';
const CHAT_ID = '-1003724062754';
const WIN_STICKER_ID = 'CAACAgUAAyEFAATd-LAiAAMuahKLjafHDa6DlYrmGvEMk1ZY2BoAAooWAAI5ZnFWhtrhUSe9Z2c7BA';
const LOSS_STICKER_ID = 'CAACAgUAAyEFAATd-LAiAAIC72oWibuEBTEYjF4Lk72vRb0LfN8PAALSGQAC0qi4VPqvJMBD8fejOwQ';

const API_1M = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';

// ===== BOT STATE =====
let lastPeriod = null;
let lastSignal = null;
let lastColor = null;
let lastNumbers = null;
let historyCache = [];
let winCount = 0;
let lossCount = 0;

// ===== EXPRESS SERVER - Render ঘুমানো ঠেকানোর জন্য =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Wingo Bot is Running 24/7 ✅');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// নিজেকে পিং করা - প্রতি 4 মিনিটে
setInterval(() => {
  axios.get(`http://localhost:${PORT}`).catch(()=>{});
}, 4 * 60 * 1000);

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
