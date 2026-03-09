/* ============================================
   game.js — 遊戲核心引擎 v4
   4大指標 × 8操作 × 隨機事件 × 教育模擬
   ============================================ */

const Game = (() => {
  let hourInterval = 1000; // ms per game-hour
  const MAX_DAYS = 14;

  let state = {};
  let timerID = null;
  let onHourTick = null;
  let onDayTick = null;
  let onGameEnd = null;
  let onEvent = null;
  let onRandomEvent = null; // 隨機事件回調（雙選項）

  // ========== 隨機事件定義 ==========
  const RANDOM_EVENTS = [
    {
      id: 'rainy-season',
      name: '🌧️ 梅雨季節',
      trigger: (s) => s.numLevel >= 3 && s.numLevel <= 4 && Math.random() < 0.04,
      desc: '連續的梅雨帶來大量水氣，飼育箱內濕度正在上升！',
      optionA: { text: '🌬️ 加強通風', effect: (s) => { s.moisture = Math.max(0, s.moisture - 10); s.temperature = Math.max(15, s.temperature - 1); }, result: '通風後濕度回到安全範圍！' },
      optionB: { text: '🙈 不處理', effect: (s) => { s.moisture = Math.min(100, s.moisture + 25); }, result: '濕度暴增！環境變得過於潮濕...' },
    },
    {
      id: 'summer-heat',
      name: '☀️ 夏日高溫',
      trigger: (s) => s.temperature >= 28 && Math.random() < 0.06,
      desc: '外氣溫飆高，飼育箱溫度接近危險值！',
      optionA: { text: '🏠 移至陰涼處', effect: (s) => { s.temperature = Math.max(15, s.temperature - 5); }, result: '成功降溫！幼蟲恢復活力。' },
      optionB: { text: '🙈 不處理', effect: (s) => { s.temperature = Math.min(36, s.temperature + 3); s.health = Math.max(0, s.health - 15); }, result: '高溫持續！幼蟲有提早羽化的危險...' },
    },
    {
      id: 'nematode-invasion',
      name: '🦠 線蟲入侵',
      trigger: (s) => s.pestIndex > 30 && Math.random() < 0.05,
      desc: '底材中發現大量線蟲正在蔓延，可能危害幼蟲健康！',
      optionA: { text: '🍂 立即換土', effect: (s) => { s.substrateQuality = 100; s.pestIndex = Math.max(0, s.pestIndex - 40); }, result: '換土成功！線蟲被清除了。' },
      optionB: { text: '👀 繼續觀察', effect: (s) => { s.pestIndex = Math.min(100, s.pestIndex + 30); s.health = Math.max(0, s.health - 25); }, result: '線蟲大量繁殖！幼蟲遭受嚴重感染！' },
    },
    {
      id: 'poop-buildup',
      name: '🐛 糞便堆積',
      trigger: (s) => s.substrateQuality < 40 && Math.random() < 0.06,
      desc: '飼育箱中堆滿了幼蟲的糞便，底材品質急速下降！',
      optionA: { text: '🧹 清除糞便', effect: (s) => { s.substrateQuality = Math.min(100, s.substrateQuality + 20); }, result: '清理完畢！底材品質改善了。' },
      optionB: { text: '🙈 不處理', effect: (s) => { s.substrateQuality = Math.max(0, s.substrateQuality - 15); s.pestIndex = Math.min(100, s.pestIndex + 10); }, result: '糞便持續堆積，底材嚴重劣化...' },
    },
    {
      id: 'larva-surface',
      name: '💀 幼蟲爬出土面',
      trigger: (s) => s.numLevel >= 2 && s.numLevel <= 4 && (s.temperature > 30 || s.moisture > 70 || s.substrateQuality < 30 || s.pestIndex > 50) && Math.random() < 0.05,
      desc: '幼蟲異常地爬到了土面上！這是環境有問題的警訊！',
      optionA: { text: '🔍 找出原因修正', effect: (s) => { if (s.temperature > 28) s.temperature -= 3; if (s.moisture > 60) s.moisture -= 10; if (s.substrateQuality < 40) s.substrateQuality += 15; if (s.pestIndex > 30) s.pestIndex -= 10; }, result: '找出問題並修正，幼蟲回到土中了！' },
      optionB: { text: '✋ 強制放回', effect: (s) => { s.health = Math.max(0, s.health - 30); }, result: '沒有排除原因就強制放回，幼蟲受到很大的傷害...' },
    },
    {
      id: 'chamber-collapse',
      name: '🌀 蛹室崩塌',
      trigger: (s) => s.numLevel === 5 && s.pupaBuilt && !s.chamberCollapsed && s.pupaIntegrity < 40 && Math.random() < 0.08,
      desc: '蛹室結構因環境不穩而出現裂縫，隨時可能崩塌！',
      optionA: { text: '🏠 製作人工蛹室', effect: (s) => { s.pupaIntegrity = 60; s.chamberCollapsed = false; s.artificialChamberUsed = true; }, result: '成功建造人工蛹室！蛹得到了保護。' },
      optionB: { text: '🙈 放著不管', effect: (s) => { s.chamberCollapsed = true; s.pupaIntegrity = 0; s.health = Math.max(0, s.health - 20); }, result: '蛹室完全崩塌了！蛹暴露在外...' },
    },
    {
      id: 'mold-growth',
      name: '🍄 底材發霉',
      trigger: (s) => s.moisture > 65 && Math.random() < 0.05,
      desc: '潮濕的環境導致底材表面長出了白色霉菌！',
      optionA: { text: '🍂 換土', effect: (s) => { s.substrateQuality = 100; s.pestIndex = Math.max(0, s.pestIndex - 10); s.moisture = 50; }, result: '換上乾淨的底材，霉菌問題解決了！' },
      optionB: { text: '🙈 不處理', effect: (s) => { s.pestIndex = Math.min(100, s.pestIndex + 40); s.substrateQuality = Math.max(0, s.substrateQuality - 20); }, result: '霉菌蔓延，病蟲害指數大幅上升！' },
    },
  ];

  // ========== 各階段成長所需時間（秒 = 遊戲小時數） ==========
  const STAGE_HOURS = {
    1: 20,   // 卵 → 1齡
    2: 20,   // 1齡：約 20 秒
    3: 40,   // 2齡：約 40 秒
    4: 180,  // 3齡：約 180 秒（最多事件）
    5: 60,   // 前蛹/蛹期：約 60+90 秒
    6: 90,   // 蛹期
  };

  function init() {
    state = {
      numDay: 1,
      numHour: 6,
      numLevel: 1, // 1=卵 2=1齡 3=2齡 4=3齡 5=蛹 6=羽化 7=成蟲
      // === 4 大核心指標 ===
      temperature: 24,      // 🌡️ 溫度 (°C)
      moisture: 50,         // 💧 濕度 (%)
      substrateQuality: 80, // 🍂 底材品質 (%)
      pestIndex: 5,         // 🦠 病蟲害指數 (%)
      // === 健康值（由4指標綜合計算） ===
      health: 100,
      // === 蛹室系統 ===
      pupaBuilt: false,
      pupaIntegrity: 0,
      pupaWarning: '',
      chamberCollapsed: false,
      artificialChamberUsed: false,
      // === 蟄伏期 ===
      dormancyHours: 0,
      isDormant: false,
      // === 環境控制 ===
      isShaded: false,
      gameSpeed: 1,
      // === 大便系統 ===
      poopCount: 0,        // 場上大便數量
      poopPositions: [],   // 大便位置 [{x, y}]
      poopTimer: 0,        // 大便計時器
      // === 遊戲狀態 ===
      bAlive: true,
      bGameover: false,
      phase: 'playing',
      growthProgress: 0,
      totalGrowth: 0,
      interactCount: 0,
      // === 評分追蹤 ===
      scoreTracking: {
        tempScore: 0,
        tempSamples: 0,
        moistureScore: 0,
        moistureSamples: 0,
        substrateScore: 0,
        substrateSamples: 0,
        pestScore: 0,
        pestSamples: 0,
        eventCorrect: 0,
        eventTotal: 0,
      },
      // === 事件系統 ===
      activeEvent: null,
      eventCooldown: 0,
      lastEventHour: 0,
    };
  }

  function start(callbacks) {
    onHourTick = callbacks.onHourTick || (() => { });
    onDayTick = callbacks.onDayTick || (() => { });
    onGameEnd = callbacks.onGameEnd || (() => { });
    onEvent = callbacks.onEvent || (() => { });
    onRandomEvent = callbacks.onRandomEvent || (() => { });
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

  // ========== 每小時 Tick ==========
  function addHour() {
    if (!state.bAlive || state.bGameover) return;
    state.numHour++;

    // 溫度自然波動
    updateTemperature();

    // 事件冷卻
    if (state.eventCooldown > 0) state.eventCooldown--;

    // ========== 蟄伏期 ==========
    if (state.isDormant) {
      state.dormancyHours--;
      if (state.dormancyHours <= 0) {
        state.isDormant = false;
        state.numLevel = 7;
        onEvent('dormancy-end', '🪲 獨角仙甦醒了！已成為完整的成蟲！');
        state.bGameover = true;
        stopTimer();
        onGameEnd('complete');
        return;
      }
      state.moisture = Math.max(0, state.moisture - 0.5);
      onHourTick(state);
      checkDayChange();
      return;
    }

    // ========== 濕度自然衰減 ==========
    const shadeEvapMod = state.isShaded ? 0.5 : 1;
    const heatEvapMod = state.temperature > 30 ? (1 + (state.temperature - 30) * 0.3) : 1;
    const tempFactor = state.temperature > 25 ? 1.3 : 1;
    const evapRate = (isDay() ? 2 : 1) * tempFactor * shadeEvapMod * heatEvapMod;
    state.moisture = Math.max(0, state.moisture - evapRate);

    // ========== 底材品質自然衰減 ==========
    let substrateDelta = -0.3;
    // 幼蟲進食消耗底材
    if (state.numLevel >= 2 && state.numLevel <= 4) {
      substrateDelta -= 0.5;
    }
    // 高濕度加速劣化
    if (state.moisture > 65) substrateDelta -= 0.3;
    // 大便堆積加速劣化
    if (state.poopCount > 3) substrateDelta -= state.poopCount * 0.2;
    state.substrateQuality = Math.max(0, state.substrateQuality + substrateDelta);

    // ========== 大便系統 ==========
    if (state.numLevel >= 2 && state.numLevel <= 4) {
      state.poopTimer++;
      // 每 8~12 小時拉一次
      if (state.poopTimer >= 8 + Math.floor(Math.random() * 5)) {
        state.poopTimer = 0;
        state.poopCount++;
        // 隨機位置（0~1 正規化）
        state.poopPositions.push({
          x: 0.15 + Math.random() * 0.7,
          y: 0.3 + Math.random() * 0.5,
        });
        onEvent('poop', '💩 幼蟲大便了！記得清理喔～');
      }
    }

    // ========== 病蟲害自然增長 ==========
    let pestDelta = 0.2;
    // 低底材品質加速病蟲害
    if (state.substrateQuality < 40) pestDelta += 0.3;
    // 高濕度加速病蟲害
    if (state.moisture > 65) pestDelta += 0.2;
    // 大便多加速病蟲害
    if (state.poopCount > 5) pestDelta += state.poopCount * 0.15;
    // 低濕度環境較乾淨
    if (state.moisture < 35) pestDelta -= 0.1;
    state.pestIndex = Math.max(0, Math.min(100, state.pestIndex + pestDelta));

    // ========== 蛹室系統 ==========
    if (state.numLevel === 5) {
      updatePupaChamber();
    }

    // ========== 健康值計算（由4指標決定） ==========
    let healthDelta = 0;

    // 溫度影響
    if (state.temperature >= 23 && state.temperature <= 26) {
      healthDelta += 0.5;
    } else if (state.temperature >= 27 && state.temperature <= 30) {
      healthDelta -= 1;
    } else if (state.temperature > 30 || state.temperature < 15) {
      healthDelta -= 4;
      if (state.temperature > 30) {
        onEvent('heat-stress', '🌡️ 溫度過高！幼蟲正處於熱壓力狀態！');
      }
      if (state.temperature < 15) {
        onEvent('cold-stress', '🌡️ 溫度過低！幼蟲活動力大幅下降！');
      }
    } else if (state.temperature < 23 || state.temperature > 26) {
      healthDelta -= 0.3;
    }

    // 濕度影響
    if (state.moisture >= 40 && state.moisture <= 55) {
      healthDelta += 0.5;
    } else if ((state.moisture >= 30 && state.moisture < 40) || (state.moisture > 55 && state.moisture <= 70)) {
      healthDelta -= 0.5;
    } else if (state.moisture < 30 || state.moisture > 70) {
      healthDelta -= 3;
    }

    // 底材品質影響
    if (state.substrateQuality >= 60) {
      healthDelta += 0.3;
    } else if (state.substrateQuality >= 30 && state.substrateQuality < 60) {
      healthDelta -= 0.5;
    } else if (state.substrateQuality < 30) {
      healthDelta -= 3;
    }

    // 病蟲害影響
    if (state.pestIndex <= 20) {
      healthDelta += 0.2;
    } else if (state.pestIndex > 20 && state.pestIndex <= 50) {
      healthDelta -= 1;
    } else if (state.pestIndex > 50) {
      healthDelta -= 4;
    }

    // 蛹室崩塌
    if (state.numLevel === 5 && state.chamberCollapsed) {
      healthDelta -= 3;
    }

    state.health = Math.max(0, Math.min(100, state.health + healthDelta));

    // ========== 評分追蹤 ==========
    updateScoreTracking();

    // ========== 成長累積 ==========
    if (state.health > 20 && state.numLevel < 5) {
      const envBonus = (
        (state.temperature >= 23 && state.temperature <= 26 ? 1.2 : 0.7) *
        (state.moisture >= 40 && state.moisture <= 55 ? 1.1 : 0.8) *
        (state.substrateQuality >= 60 ? 1.1 : 0.7)
      );
      const growthRate = (state.health / 100) * envBonus * 1.5;
      state.growthProgress += growthRate;
      state.totalGrowth += growthRate;
    } else if (state.numLevel === 5 && state.pupaBuilt && !state.chamberCollapsed) {
      const tempBonus = (state.temperature >= 23 && state.temperature <= 26) ? 1.5 : 0.5;
      const chamberBonus = state.pupaIntegrity / 100;
      const pupaGrowth = tempBonus * chamberBonus * 1.2;
      state.growthProgress += pupaGrowth;
      state.totalGrowth += pupaGrowth;
    }

    // ========== 隨機事件觸發 ==========
    if (state.eventCooldown <= 0 && !state.activeEvent) {
      checkRandomEvents();
    }

    // ========== 死亡判定 ==========
    if (state.health <= 0) {
      state.health = 0;
      state.bAlive = false;
      state.bGameover = true;
      stopTimer();
      onGameEnd('gameover');
      return;
    }

    // ========== 時間推進與 UI 更新 ==========
    onHourTick(state);

    checkDayChange();
  }

  function checkDayChange() {
    if (state.numHour >= 24) {
      state.numHour = 0;
      state.numDay++;

      // 檢查是否超過總天數
      if (state.numDay > state.totalDays) {
        state.bGameover = true;
        stopTimer();
        onGameEnd('timeout');
        return;
      }

      onDayTick(state);
    }
  }

  // ========== 溫度系統 ==========
  function updateTemperature() {
    const baseTemp = 24;
    const dayOffset = isDay() ? 5 : -1;
    const shadeOffset = state.isShaded ? -4 : 0;
    const random = (Math.random() - 0.5) * 1.5;
    const target = baseTemp + dayOffset + shadeOffset + random;
    const clampedTarget = Math.max(15, Math.min(36, target));
    state.temperature += (clampedTarget - state.temperature) * 0.12;
    state.temperature = Math.round(state.temperature * 10) / 10;
  }

  // ========== 蛹室系統 ==========
  function updatePupaChamber() {
    if (!state.pupaBuilt) return;
    state.pupaWarning = '';

    let integrityDelta = 0;

    if (state.moisture < 25) {
      integrityDelta -= 2;
      state.pupaWarning = '⚠️ 環境過乾，蛹室壁面龜裂！';
    } else if (state.moisture > 75) {
      integrityDelta -= 3;
      state.pupaWarning = '⚠️ 環境過濕，蛹室有積水風險！';
    } else {
      integrityDelta += 0.3;
    }

    if (state.temperature < 18 || state.temperature > 28) {
      integrityDelta -= 1.5;
      state.pupaWarning = '⚠️ 溫度異常，對蛹造成壓力！';
    }

    if (state.pestIndex > 40) {
      integrityDelta -= 1;
      state.pupaWarning = '⚠️ 病蟲害影響蛹室結構！';
    }

    state.pupaIntegrity = Math.max(0, Math.min(100, state.pupaIntegrity + integrityDelta));

    if (state.pupaIntegrity <= 0 && !state.chamberCollapsed) {
      state.chamberCollapsed = true;
      state.pupaWarning = '🚨 蛹室崩塌了！請緊急處理！';
      onEvent('chamber-collapse', '🚨 蛹室崩塌了！需要立即製作人工蛹室！');
    }
  }

  // 蛹室建造
  function buildPupaChamber() {
    if (state.numLevel !== 5) return false;
    state.pupaBuilt = true;
    state.pupaIntegrity = 80;
    state.chamberCollapsed = false;
    onEvent('chamber-built', '🏗️ 幼蟲正在建造蛹室...\n使用糞便塗抹壁面，形成直立橢圓形蛹室\n\n⚠️ 蛹期間請勿翻土打擾！保持環境穩定即可。');
    return true;
  }

  // ========== 隨機事件檢查 ==========
  function checkRandomEvents() {
    for (const evt of RANDOM_EVENTS) {
      if (evt.trigger(state)) {
        state.activeEvent = evt;
        state.eventCooldown = 15; // 至少 15 小時後才會再觸發
        pause();
        onRandomEvent(evt);
        return;
      }
    }
  }

  // 玩家選擇事件選項
  function resolveEvent(choiceIsA) {
    if (!state.activeEvent) return;
    const evt = state.activeEvent;
    const choice = choiceIsA ? evt.optionA : evt.optionB;
    choice.effect(state);

    // 評分追蹤
    state.scoreTracking.eventTotal++;
    if (choiceIsA) state.scoreTracking.eventCorrect++;

    const resultMsg = choice.result;
    state.activeEvent = null;

    return resultMsg;
  }

  // ========== 評分追蹤 ==========
  function updateScoreTracking() {
    const t = state.scoreTracking;

    // 溫度
    t.tempSamples++;
    if (state.temperature >= 23 && state.temperature <= 26) t.tempScore++;

    // 濕度
    t.moistureSamples++;
    if (state.moisture >= 40 && state.moisture <= 55) t.moistureScore++;

    // 底材
    t.substrateSamples++;
    if (state.substrateQuality >= 60) t.substrateScore++;

    // 病蟲害
    t.pestSamples++;
    if (state.pestIndex <= 20) t.pestScore++;
  }

  // ========== 8 個玩家操作 ==========

  // 💦 噴水補濕：濕度 +10%
  function spray() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    const amount = state.numLevel >= 5 ? 8 : 10;
    state.moisture = Math.min(100, state.moisture + amount);
    return true;
  }

  // 🌬️ 通風換氣：溫度 -2°C、濕度 -5%
  function ventilate() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.temperature = Math.max(15, state.temperature - 2);
    state.moisture = Math.max(0, state.moisture - 5);
    return true;
  }

  // 🍂 換新底材：底材品質 +50%、病蟲害 -20%
  function changeSubstrate() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    if (state.numLevel === 5 && state.pupaBuilt) {
      onEvent('substrate-warning', '⚠️ 蛹期間不建議換底材！會破壞蛹室！');
      return false;
    }
    state.substrateQuality = Math.min(100, state.substrateQuality + 50);
    state.pestIndex = Math.max(0, state.pestIndex - 20);
    return true;
  }

  // 🔍 翻土觀察：查看幼蟲狀態，15% 機率破壞蛹室（蛹期 50%）
  function inspect() {
    if (!state.bAlive || state.phase !== 'playing') return null;

    let info = `🌡️ ${state.temperature.toFixed(1)}°C | 💧 ${Math.floor(state.moisture)}%\n🍂 底材 ${Math.floor(state.substrateQuality)}% | 🦠 病蟲害 ${Math.floor(state.pestIndex)}%`;

    if (state.numLevel === 5 && state.pupaBuilt && !state.chamberCollapsed) {
      const damageChance = 0.5;
      if (Math.random() < damageChance) {
        state.pupaIntegrity = Math.max(0, state.pupaIntegrity - 20);
        onEvent('inspect-damage', '⚠️ 翻土時不小心破壞了蛹室！完整度下降！');
        info += '\n\n⚠️ 翻土造成蛹室損傷！';
      }
    } else if (state.numLevel >= 2 && state.numLevel <= 4) {
      const damageChance = 0.15;
      if (Math.random() < damageChance) {
        state.health = Math.max(0, state.health - 5);
        info += '\n\n⚠️ 翻土時驚擾到了幼蟲！';
      }
    }

    state.interactCount++;
    return info;
  }

  // 🧹 清除糞便：底材品質 +15%，清空大便
  function cleanPoop() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.substrateQuality = Math.min(100, state.substrateQuality + 15);
    state.poopCount = 0;
    state.poopPositions = [];
    return true;
  }

  // ❄️ 降溫處理：溫度 -5°C
  function coolDown() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.temperature = Math.max(15, state.temperature - 5);
    return true;
  }

  // 🏥 除蟲處理：病蟲害 -30%
  function removePest() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.pestIndex = Math.max(0, state.pestIndex - 30);
    return true;
  }

  // 🏠 製作人工蛹室（蛹期專用，一次性）
  function buildArtificialChamber() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    if (state.numLevel !== 5) {
      onEvent('chamber-wrong-stage', '⚠️ 只有蛹期才需要人工蛹室！');
      return false;
    }
    if (!state.chamberCollapsed) {
      onEvent('chamber-intact', '蛹室目前完好，不需要重建！');
      return false;
    }
    if (state.artificialChamberUsed) {
      onEvent('chamber-used', '⚠️ 人工蛹室已使用過了！');
      return false;
    }
    state.chamberCollapsed = false;
    state.pupaIntegrity = 50;
    state.pupaWarning = '';
    state.artificialChamberUsed = true;
    state.health = Math.max(10, state.health - 5);
    onEvent('chamber-rebuilt', '🔧 已製作人工蛹室！但蛹受到了一些損傷。');
    return true;
  }

  // 互動（點擊蟲蟲）
  function interact() {
    if (!state.bAlive || state.phase !== 'playing') return null;

    if (state.numLevel === 5) {
      if (state.pupaBuilt && !state.chamberCollapsed) {
        state.pupaIntegrity = Math.max(0, state.pupaIntegrity - 8);
        onEvent('pupa-disturb', '⚠️ 不要干擾蛹室！完整度下降了！');
        return '😰';
      }
      return null;
    }

    if (state.isDormant) {
      onEvent('dormant-touch', '💤 牠正在蟄伏休息，請不要打擾...');
      return '💤';
    }

    state.interactCount++;
    state.growthProgress += 0.2;
    state.totalGrowth += 0.2;

    const reactions = ['❤️', '✨', '💕', '🎵', '😊', '⭐', '🌟'];
    return reactions[Math.floor(Math.random() * reactions.length)];
  }

  // ========== 成長升級 ==========
  function tryLevelUp() {
    if (state.isDormant) return false;

    const thresholds = [0, 15, 18, 30, 100, 50, 55, 999];
    if (state.growthProgress >= thresholds[state.numLevel]) {
      state.growthProgress = 0;

      // 三齡 → 蛹
      if (state.numLevel === 4) {
        state.numLevel = 5;
        setTimeout(() => buildPupaChamber(), 500);
        return true;
      }

      // 蛹 → 羽化 → 蟄伏
      if (state.numLevel === 5) {
        state.numLevel = 6;
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

  // ========== 評分系統（4指標各20分共80分，事件應對最多+20加分） ==========
  function calcScore() {
    const t = state.scoreTracking;

    const tempPct = t.tempSamples > 0 ? t.tempScore / t.tempSamples : 0;
    const moisturePct = t.moistureSamples > 0 ? t.moistureScore / t.moistureSamples : 0;
    const substratePct = t.substrateSamples > 0 ? t.substrateScore / t.substrateSamples : 0;
    const pestPct = t.pestSamples > 0 ? t.pestScore / t.pestSamples : 0;

    const base = Math.round((tempPct + moisturePct + substratePct + pestPct) * 20);

    // 事件應對：有遭遇事件才計算加分，沒遇到事件不加也不扣
    const eventBonus = t.eventTotal > 0 ? Math.round((t.eventCorrect / t.eventTotal) * 20) : 0;

    return {
      tempScore: Math.round(tempPct * 20),
      moistureScore: Math.round(moisturePct * 20),
      substrateScore: Math.round(substratePct * 20),
      pestScore: Math.round(pestPct * 20),
      eventBonus,
      eventTotal: t.eventTotal,
      total: Math.min(100, base + eventBonus),
    };
  }

  function getRank(totalScore) {
    if (!state.bAlive) return { rank: 'F', label: '飼育失敗，環境太差', color: '#c45a5a' };
    if (totalScore >= 90) return { rank: 'SS', label: '超大型成蟲，長角威武！', color: '#ffd700' };
    if (totalScore >= 80) return { rank: 'S+', label: '大型成蟲', color: '#ff8c00' };
    if (totalScore >= 60) return { rank: 'A', label: '中型成蟲', color: '#68c4e0' };
    return { rank: 'S', label: '小型成蟲，角短', color: '#9a8d7a' };
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

  // 遮陰控制
  function toggleShade() {
    if (!state.bAlive || state.phase !== 'playing') return false;
    state.isShaded = !state.isShaded;
    return true;
  }

  // 遊戲速度
  function toggleSpeed() {
    if (state.gameSpeed === 1) {
      state.gameSpeed = 2;
      hourInterval = 500;
    } else if (state.gameSpeed === 2) {
      state.gameSpeed = 3;
      hourInterval = 250;
    } else {
      state.gameSpeed = 1;
      hourInterval = 1000;
    }
    if (timerID) {
      stopTimer();
      playTimer();
    }
    return state.gameSpeed;
  }

  function getSpeed() { return state.gameSpeed; }

  return {
    init, start, stop: stopTimer,
    spray, ventilate, changeSubstrate, inspect, cleanPoop, coolDown, removePest,
    buildArtificialChamber, interact,
    tryLevelUp, isDay, calcScore, getRank, getState,
    pause, resume, playTimer, stopTimer, buildPupaChamber,
    toggleShade, toggleSpeed, getSpeed, resolveEvent,
  };
})();
