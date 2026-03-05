/* ============================================
   game.js — 遊戲核心引擎 v3
   真實模擬：溫度、蛹室、羽化蟄伏
   ============================================ */

const Game = (() => {
  let hourInterval = 1000; // ms per game-hour (mutable for speed control)
  const MAX_DAYS = 14;

  let state = {};
  let timerID = null;
  let onHourTick = null;
  let onDayTick = null;
  let onGameEnd = null;
  let onEvent = null; // 新增：事件回調

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
      hunger: 60,
      temperature: 23,
      soilDepth: 8,
      soilCompaction: 70,
      pupaBuilt: false,
      pupaIntegrity: 0,
      pupaWarning: '',
      dormancyHours: 0,
      isDormant: false,
      chamberCollapsed: false,
      // === v4 新增 ===
      isShaded: false,        // 是否有遮陰
      isFlooded: false,       // 是否淹水
      gameSpeed: 1,           // 1 = 1s/hr, 2 = 1s/30min
      // ================
      bAlive: true,
      bGameover: false,
      phase: 'playing',
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
    onEvent = callbacks.onEvent || (() => { });
    state.phase = 'playing';
    playTimer();
  }

  function playTimer() {
    if (timerID) return;
    timerID = setInterval(addHour, hourInterval);
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

    // ========== 溫度自然波動 ==========
    updateTemperature();

    // ========== 蟄伏期倒數 ==========
    if (state.isDormant) {
      state.dormancyHours--;
      if (state.dormancyHours <= 0) {
        state.isDormant = false;
        state.numLevel = 7; // 正式成為活躍成蟲
        onEvent('dormancy-end', '🪲 獨角仙甦醒了！已成為完整的成蟲！');
        state.bGameover = true;
        stopTimer();
        onGameEnd('complete');
        return;
      }
      // 蟄伏期只需維持環境，不需餵食
      state.moisture = Math.max(0, state.moisture - 1);
      onHourTick(state);
      checkDayChange();
      return;
    }

    // ========== 濕度衰減 ==========
    const shadeEvapMod = state.isShaded ? 0.5 : 1;
    // 高溫大幅加速蒸發
    const heatEvapMod = state.temperature > 30 ? (1 + (state.temperature - 30) * 0.5) : 1;
    const tempFactor = state.temperature > 25 ? 1.5 : 1;
    const evapRate = (isDay() ? 4 : 2) * tempFactor * shadeEvapMod * heatEvapMod;
    state.moisture = Math.max(0, state.moisture - evapRate);

    // ========== 淹水判定 ==========
    state.isFlooded = state.moisture > 85;

    // ========== 土壤消耗 ==========
    state.soilQuality = Math.max(0, state.soilQuality - 0.5);
    // 幼蟲啃食讓壓實度微降
    if (state.numLevel >= 2 && state.numLevel <= 4) {
      state.soilCompaction = Math.max(0, state.soilCompaction - 0.3);
    }

    // ========== 幼蟲進食 ==========
    if (state.numLevel >= 2 && state.numLevel <= 4) {
      const eatAmount = Math.min(2, state.soilQuality);
      state.numEat += eatAmount;
      state.soilQuality = Math.max(0, state.soilQuality - eatAmount * 0.3);
      // 進食也消耗土壤深度（微量）
      state.soilDepth = Math.max(2, state.soilDepth - 0.02);
    }

    // ========== 飽食度衰減 ==========
    if (state.numLevel >= 5) {
      // 蛹期不需餵食，飽食度緩慢回歸
      state.hunger = Math.max(30, state.hunger - 1);
    } else {
      const hungerDecay = state.numLevel >= 2 && state.numLevel <= 4 ? 3 : 2;
      state.hunger = Math.max(0, state.hunger - hungerDecay);
    }

    // ========== 蛹室機制 ==========
    if (state.numLevel === 5) {
      updatePupaChamber();
    }

    // ========== 體力計算 ==========
    let powerDelta = 0;

    // 濕度影響
    if (state.moisture < 15) powerDelta -= 3;
    else if (state.moisture < 30) powerDelta -= 1;
    else if (state.moisture > 85) powerDelta -= 2; // 積水
    else if (state.moisture >= 40 && state.moisture <= 70) powerDelta += 0.5;

    // 土壤影響
    if (state.soilQuality < 20) powerDelta -= 2;
    else if (state.soilQuality < 40) powerDelta -= 0.5;
    else if (state.soilQuality > 60) powerDelta += 0.3;

    // 飽食度影響（非蛹期）
    if (state.numLevel < 5) {
      if (state.hunger < 15) powerDelta -= 3;
      else if (state.hunger < 30) powerDelta -= 1;
      else if (state.hunger >= 50 && state.hunger <= 80) powerDelta += 0.5;
      else if (state.hunger > 90) powerDelta -= 0.5;
    }

    // 溫度影響
    if (state.temperature < 18 || state.temperature > 32) {
      powerDelta -= 4; // 極端溫度
      if (state.temperature > 32) {
        onEvent('heat-stress', '🌡️ 溫度過高！幼蟲正處於熱壓力狀態，體力迅速流失！');
      }
    }
    else if (state.temperature < 20 || state.temperature > 30) powerDelta -= 1.5;
    else if (state.temperature >= 20 && state.temperature <= 25) powerDelta += 0.5;

    // 蛹室崩塌嚴重扣血
    if (state.numLevel === 5 && state.chamberCollapsed) {
      powerDelta -= 4;
    }

    state.numPower = Math.max(0, Math.min(100, state.numPower + powerDelta));

    // ========== 成長累積 ==========
    if (state.numPower > 30 && state.numLevel < 5) {
      // 幼蟲期正常成長
      const hungerBonus = state.hunger > 40 ? 1 + (state.hunger / 100) * 0.5 : 0.5;
      const tempBonus = (state.temperature >= 20 && state.temperature <= 25) ? 1.2 : 0.8;
      const growthRate = (state.numPower / 100) * (state.soilQuality / 100) * hungerBonus * tempBonus * 2;
      state.growthProgress += growthRate;
      state.totalGrowth += growthRate;

      if (state.numLevel >= 2 && state.numLevel <= 4) {
        // 高溫抑制成長
        const heatGrowthMod = state.temperature > 30 ? 0.5 : 1;
        state.numSize = Math.min(100, state.numSize + growthRate * 0.3 * heatGrowthMod);
      }
    } else if (state.numLevel === 5 && state.pupaBuilt && !state.chamberCollapsed) {
      // 蛹期：環境穩定就持續成長
      const tempBonus = (state.temperature >= 20 && state.temperature <= 25) ? 1.5 : 0.5;
      const chamberBonus = state.pupaIntegrity / 100;
      const pupaGrowth = tempBonus * chamberBonus * 1.5;
      state.growthProgress += pupaGrowth;
      state.totalGrowth += pupaGrowth;
    }

    // ========== 死亡判定 ==========
    if (state.numPower <= 0) {
      state.bAlive = false;
      state.bGameover = true;
      stopTimer();
      if (state.numLevel === 5 && state.chamberCollapsed) {
        onGameEnd('chamber-death');
      } else {
        onGameEnd('gameover');
      }
      return;
    }

    onHourTick(state);
    checkDayChange();
  }

  function checkDayChange() {
    if (state.numHour >= 24) {
      state.numHour = 0;
      state.numDay++;
      onDayTick(state);

      if (state.numDay > MAX_DAYS) {
        state.bGameover = true;
        stopTimer();
        if (state.numLevel >= 7 || state.isDormant) {
          onGameEnd('complete');
        } else {
          onGameEnd('timeover');
        }
      }
    }
  }

  // ========== 溫度系統 ==========
  function updateTemperature() {
    const baseTemp = 24; // 基礎溫度稍微調高以配合新範圍
    const dayOffset = isDay() ? 6 : -2; // 加大日夜溫差
    const shadeOffset = state.isShaded ? -5 : 0; // 遮陰效果更強
    const random = (Math.random() - 0.5) * 2;
    const target = baseTemp + dayOffset + shadeOffset + random;
    // 限制在 15~36 之間
    const clampedTarget = Math.max(15, Math.min(36, target));
    state.temperature += (clampedTarget - state.temperature) * 0.15;
    state.temperature = Math.round(state.temperature * 10) / 10;
  }

  // ========== 蛹室系統 ==========
  function updatePupaChamber() {
    if (!state.pupaBuilt) return;

    state.pupaWarning = '';

    // 蛹室完整度受環境影響
    let integrityDelta = 0;

    // 濕度影響
    if (state.moisture < 20) {
      integrityDelta -= 2;
      state.pupaWarning = '⚠️ 環境過乾，蛹室壁面龜裂！';
    } else if (state.moisture > 80) {
      integrityDelta -= 3;
      state.pupaWarning = '⚠️ 環境過濕，蛹室有積水風險！';
    } else {
      integrityDelta += 0.3; // 適度環境緩慢修復
    }

    // 土壤壓實度影響
    if (state.soilCompaction < 30) {
      integrityDelta -= 2;
      state.pupaWarning = '⚠️ 土壤太鬆，蛹室結構不穩！';
    }

    // 土壤深度影響
    if (state.soilDepth < 5) {
      integrityDelta -= 1;
      state.pupaWarning = '⚠️ 土壤太淺，蛹室空間不足！';
    }

    // 溫度影響
    if (state.temperature < 18 || state.temperature > 28) {
      integrityDelta -= 1.5;
      state.pupaWarning = '⚠️ 溫度異常，對蛹造成壓力！';
    }

    state.pupaIntegrity = Math.max(0, Math.min(100, state.pupaIntegrity + integrityDelta));

    // 崩塌判定
    if (state.pupaIntegrity <= 0 && !state.chamberCollapsed) {
      state.chamberCollapsed = true;
      state.pupaWarning = '🚨 蛹室崩塌了！請緊急重建！';
      onEvent('chamber-collapse', '🚨 蛹室崩塌了！需要立即重建，否則蛹會死亡！');
    }
  }

  // 三齡幼蟲升級為蛹時觸發蛹室建造
  function buildPupaChamber() {
    if (state.numLevel !== 5) return false;

    // 檢查條件
    const canBuild = state.soilDepth >= 5 && state.soilCompaction >= 40;
    if (!canBuild) {
      onEvent('chamber-fail', '⚠️ 土壤條件不足！需要深度≥5cm 且壓實度≥40 才能建造蛹室');
      return false;
    }

    state.pupaBuilt = true;
    state.pupaIntegrity = 80 + (state.soilCompaction / 100) * 20;
    state.chamberCollapsed = false;
    onEvent('chamber-built', '🏗️ 幼蟲正在建造蛹室...\n使用糞便塗抹壁面，形成直立橢圓形蛹室\n深度約7cm、寬度約4cm\n\n⚠️ 蛹期間請勿觸碰蟲蟲！保持環境穩定即可。');
    return true;
  }

  // 緊急重建蛹室
  function rebuildChamber() {
    if (!state.chamberCollapsed || state.numLevel !== 5) return false;
    if (state.soilDepth < 3 || state.soilCompaction < 30) {
      onEvent('rebuild-fail', '⚠️ 土壤條件不足，無法重建蛹室！');
      return false;
    }
    state.chamberCollapsed = false;
    state.pupaIntegrity = 50; // 重建的不如原本堅固
    state.pupaWarning = '';
    state.numPower = Math.max(10, state.numPower - 10); // 重建過程損傷
    onEvent('chamber-rebuilt', '🔧 已緊急重建蛹室！但蛹受到了一些損傷。');
    return true;
  }

  // ========== 玩家操作 ==========
  function spray() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    // 蛹期噴水量減少（避免積水）
    const amount = state.numLevel >= 5 ? 15 : 25;
    state.moisture = Math.min(100, state.moisture + amount);
    state.numPower = Math.min(100, state.numPower + 1);
    return true;
  }

  function changeSoil() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    // 蛹期換土會破壞蛹室！
    if (state.numLevel === 5 && state.pupaBuilt) {
      onEvent('soil-warning', '⚠️ 蛹期間不建議換土！會破壞蛹室！');
      return false;
    }
    state.soilQuality = 100;
    state.soilDepth = 8;
    state.soilCompaction = 75;
    state.numPower = Math.min(100, state.numPower + 2);
    return true;
  }

  function compactSoil() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.soilCompaction = Math.min(100, state.soilCompaction + 20);
    return true;
  }

  function feed() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    // 蛹期不能餵食
    if (state.numLevel >= 5) {
      onEvent('feed-warning', '蛹期間不需要餵食喔！');
      return false;
    }
    state.hunger = Math.min(100, state.hunger + 30);
    state.numPower = Math.min(100, state.numPower + 2);
    state.feedCount++;
    state.growthProgress += 0.5;
    state.totalGrowth += 0.5;
    return true;
  }

  function interact() {
    if (!state.bAlive || state.phase !== 'playing') return null;

    // 蛹期觸碰 = 干擾蛹室！
    if (state.numLevel === 5) {
      if (state.pupaBuilt && !state.chamberCollapsed) {
        state.pupaIntegrity = Math.max(0, state.pupaIntegrity - 8);
        onEvent('pupa-disturb', '⚠️ 不要干擾蛹室！完整度下降了！');
        return '😰';
      }
      return null;
    }

    // 蟄伏期不能互動
    if (state.isDormant) {
      onEvent('dormant-touch', '💤 牠正在蟄伏休息，請不要打擾...');
      return '💤';
    }

    state.interactCount++;
    state.numPower = Math.min(100, state.numPower + 0.5);
    state.growthProgress += 0.3;
    state.totalGrowth += 0.3;

    const reactions = ['❤️', '✨', '💕', '🎵', '😊', '⭐', '🌟'];
    return reactions[Math.floor(Math.random() * reactions.length)];
  }

  // ========== 成長升級 ==========
  function tryLevelUp() {
    // 蟄伏期不升級
    if (state.isDormant) return false;

    const thresholds = [0, 12, 20, 28, 38, 50, 65, 999];
    if (state.growthProgress >= thresholds[state.numLevel]) {
      state.growthProgress = 0;

      // 特殊處理：三齡 → 蛹
      if (state.numLevel === 4) {
        state.numLevel = 5;
        // 自動嘗試建造蛹室
        setTimeout(() => buildPupaChamber(), 500);
        return true;
      }

      // 特殊處理：蛹 → 羽化 → 蟄伏
      if (state.numLevel === 5) {
        state.numLevel = 6; // 羽化
        // 進入蟄伏期（7~10小時）
        state.dormancyHours = 7 + Math.floor(Math.random() * 4);
        state.isDormant = true;
        onEvent('eclosion', `🦋 羽化成功！\n獨角仙正在蟄伏中...\n預計 ${state.dormancyHours} 小時後甦醒\n\n請維持環境穩定，靜待牠的甦醒。`);
        return true;
      }

      state.numLevel++;
      if (state.numLevel >= 7) {
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
    const chamberBonus = state.pupaBuilt && !state.chamberCollapsed ? 15 : 0;
    return Math.floor(
      state.numSize * 2 +
      state.numPower +
      photoBonus +
      state.numDay * 3 +
      state.interactCount * 0.5 +
      state.feedCount * 1 +
      chamberBonus
    );
  }

  function getRank(score) {
    if (score >= 300) return { rank: 'SSS', color: '#ffd700' };
    if (score >= 260) return { rank: 'SS', color: '#ff8c00' };
    if (score >= 220) return { rank: 'S', color: '#e0e0e0' };
    if (score >= 180) return { rank: 'A', color: '#68c4e0' };
    if (score >= 140) return { rank: 'B', color: '#7ec468' };
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

  // ========== 遮陰控制 ==========
  function toggleShade() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.isShaded = !state.isShaded;
    return true;
  }

  // ========== 遊戲速度控制 ==========
  function toggleSpeed() {
    if (state.gameSpeed === 1) {
      state.gameSpeed = 2;
      hourInterval = 2000; // 1s = 30 min = 2s per hour
    } else {
      state.gameSpeed = 1;
      hourInterval = 1000; // 1s = 1 hour
    }
    // 重新啟動計時器
    if (timerID) {
      stopTimer();
      playTimer();
    }
    return state.gameSpeed;
  }

  function getSpeed() { return state.gameSpeed; }

  return {
    init, start, stop: stopTimer, spray, changeSoil, compactSoil,
    feed, interact, tryLevelUp, isDay, calcScore, getRank, getState,
    pause, resume, playTimer, stopTimer, buildPupaChamber, rebuildChamber,
    toggleShade, toggleSpeed, getSpeed
  };
})();
