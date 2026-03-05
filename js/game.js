/* ============================================
   game.js — 遊戲核心引擎
   時間系統、成長判定、數值管理
   ============================================ */

const Game = (() => {
  // 遊戲速度：每秒 = 遊戲內 1 小時
  const HOUR_INTERVAL = 1000; // ms
  const MAX_DAYS = 10;

  let state = {};
  let timerID = null;
  let onHourTick = null;
  let onDayTick = null;
  let onGameEnd = null;

  function init() {
    state = {
      numDay: 1,
      numHour: 6,
      numPower: 100,
      numSize: 10,
      numLevel: 1,
      numEat: 0,
      moisture: 50,
      soilQuality: 100,
      hunger: 60, // 飽食度 0-100
      bAlive: true,
      bGameover: false,
      phase: 'playing', // title, playing, paused, ended
      growthProgress: 0,
      totalGrowth: 0,
      interactCount: 0,
      feedCount: 0,
    };
  }

  function start(callbacks) {
    onHourTick = callbacks.onHourTick || (() => { });
    onDayTick = callbacks.onDayTick || (() => { });
    onGameEnd = callbacks.onGameEnd || (() => { });
    state.phase = 'playing';
    playTimer();
  }

  function playTimer() {
    if (timerID) return;
    timerID = setInterval(addHour, HOUR_INTERVAL);
  }

  function stopTimer() {
    if (timerID) {
      clearInterval(timerID);
      timerID = null;
    }
  }

  function addHour() {
    if (!state.bAlive || state.bGameover) return;

    state.numHour++;

    // --- 每小時自然衰減 ---
    // 濕度自然蒸發
    const evapRate = isDay() ? 4 : 2;
    state.moisture = Math.max(0, state.moisture - evapRate);

    // 土壤每小時微量消耗
    state.soilQuality = Math.max(0, state.soilQuality - 0.5);

    // 幼蟲進食（在有土壤的情況下）
    if (state.numLevel >= 2 && state.numLevel <= 4) {
      const eatAmount = Math.min(2, state.soilQuality);
      state.numEat += eatAmount;
      state.soilQuality = Math.max(0, state.soilQuality - eatAmount * 0.3);
    }

    // 飽食度自然下降
    const hungerDecay = state.numLevel >= 2 && state.numLevel <= 4 ? 5 : 3;
    state.hunger = Math.max(0, state.hunger - hungerDecay);

    // --- 體力計算 ---
    let powerDelta = 0;

    // 濕度影響
    if (state.moisture < 15) powerDelta -= 3;
    else if (state.moisture < 30) powerDelta -= 1;
    else if (state.moisture > 85) powerDelta -= 2;
    else if (state.moisture >= 40 && state.moisture <= 70) powerDelta += 0.5;

    // 土壤影響
    if (state.soilQuality < 20) powerDelta -= 2;
    else if (state.soilQuality < 40) powerDelta -= 0.5;
    else if (state.soilQuality > 60) powerDelta += 0.3;

    // 飽食度影響
    if (state.hunger < 15) powerDelta -= 3;
    else if (state.hunger < 30) powerDelta -= 1;
    else if (state.hunger >= 50 && state.hunger <= 80) powerDelta += 0.5;
    else if (state.hunger > 90) powerDelta -= 0.5; // 過飽

    state.numPower = Math.max(0, Math.min(100, state.numPower + powerDelta));

    // --- 成長累積 ---
    if (state.numPower > 30) {
      const hungerBonus = state.hunger > 40 ? 1 + (state.hunger / 100) * 0.5 : 0.5;
      const growthRate = (state.numPower / 100) * (state.soilQuality / 100) * hungerBonus * 2;
      state.growthProgress += growthRate;
      state.totalGrowth += growthRate;

      // 體型跟隨成長
      if (state.numLevel >= 2 && state.numLevel <= 4) {
        state.numSize = Math.min(100, state.numSize + growthRate * 0.3);
      }
    }

    // --- 死亡判定 ---
    if (state.numPower <= 0) {
      state.bAlive = false;
      state.bGameover = true;
      stopTimer();
      onGameEnd('gameover');
      return;
    }

    // --- 通知 ---
    onHourTick(state);

    // --- 換日 ---
    if (state.numHour >= 24) {
      state.numHour = 0;
      state.numDay++;

      onDayTick(state);

      // 時間到期
      if (state.numDay > MAX_DAYS) {
        state.bGameover = true;
        stopTimer();
        if (state.numLevel >= 7) {
          onGameEnd('complete');
        } else {
          onGameEnd('timeover');
        }
        return;
      }
    }
  }

  function spray() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.moisture = Math.min(100, state.moisture + 25);
    // 噴水也微量恢復體力
    state.numPower = Math.min(100, state.numPower + 1);
    return true;
  }

  function changeSoil() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.soilQuality = 100;
    state.numPower = Math.min(100, state.numPower + 2);
    return true;
  }

  function feed() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.hunger = Math.min(100, state.hunger + 30);
    state.numPower = Math.min(100, state.numPower + 2);
    state.feedCount++;
    // 餵食也加速成長
    state.growthProgress += 0.5;
    state.totalGrowth += 0.5;
    return true;
  }

  function interact() {
    if (!state.bAlive || state.phase !== 'playing') return null;
    state.interactCount++;
    // 互動提升少量體力和成長
    state.numPower = Math.min(100, state.numPower + 0.5);
    state.growthProgress += 0.3;
    state.totalGrowth += 0.3;

    // 隨機回應
    const reactions = ['❤️', '✨', '💕', '🎵', '😊', '⭐', '🌟'];
    return reactions[Math.floor(Math.random() * reactions.length)];
  }

  // 嘗試升級，回傳是否升級
  function tryLevelUp() {
    const thresholds = [0, 12, 20, 28, 38, 50, 65, 999];
    if (state.growthProgress >= thresholds[state.numLevel]) {
      state.growthProgress = 0;
      state.numLevel++;
      if (state.numLevel >= 7) {
        // 成蟲！
        state.bGameover = true;
        stopTimer();
        onGameEnd('complete');
      }
      return true;
    }
    return false;
  }

  function isDay() {
    return state.numHour >= 6 && state.numHour < 18;
  }

  function calcScore() {
    const photoBonus = (typeof Diary !== 'undefined') ? Diary.getCount() * 5 : 0;
    return Math.floor(
      state.numSize * 2 +
      state.numPower +
      photoBonus +
      state.numDay * 3 +
      state.interactCount * 0.5 +
      state.feedCount * 1
    );
  }

  function getRank(score) {
    if (score >= 280) return { rank: 'SSS', color: '#ffd700' };
    if (score >= 240) return { rank: 'SS', color: '#ff8c00' };
    if (score >= 200) return { rank: 'S', color: '#e0e0e0' };
    if (score >= 160) return { rank: 'A', color: '#68c4e0' };
    if (score >= 120) return { rank: 'B', color: '#7ec468' };
    return { rank: 'C', color: '#9a8d7a' };
  }

  function getState() { return state; }

  function pause() {
    state.phase = 'paused';
    stopTimer();
  }

  function resume() {
    state.phase = 'playing';
    playTimer();
  }

  return {
    init, start, stop: stopTimer, spray, changeSoil, feed, interact,
    tryLevelUp, isDay, calcScore, getRank, getState,
    pause, resume, playTimer, stopTimer
  };
})();
