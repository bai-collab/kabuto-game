/* ============================================
   ui.js — DOM UI 互動 v4
   8操作按鈕、4指標HUD、事件對話框
   ============================================ */

const UI = (() => {
    let cooldowns = {};
    const COOLDOWN_TIME = {
        spray: 0,
        ventilate: 0,
        substrate: 0,
        inspect: 0,
        clean: 0,
        cool: 0,
        pest: 0,
        photo: 0,
    };

    function init(callbacks) {
        // 初始化冷卻
        for (const key of Object.keys(COOLDOWN_TIME)) {
            cooldowns[key] = 0;
        }

        // 8 個操作按鈕
        bindBtn('btn-spray', 'spray', callbacks.onSpray);
        bindBtn('btn-ventilate', 'ventilate', callbacks.onVentilate);
        bindBtn('btn-substrate', 'substrate', callbacks.onSubstrate);
        bindBtn('btn-inspect', 'inspect', callbacks.onInspect);
        bindBtn('btn-clean', 'clean', callbacks.onClean);
        bindBtn('btn-cool', 'cool', callbacks.onCool);
        bindBtn('btn-pest', 'pest', callbacks.onPest);
        bindBtn('btn-photo', 'photo', callbacks.onPhoto);

        // 蛹室（無冷卻，一次性）
        document.getElementById('btn-chamber').addEventListener('click', () => {
            if (callbacks.onChamber) callbacks.onChamber();
        });

        // 速度
        document.getElementById('btn-speed').addEventListener('click', () => {
            if (callbacks.onSpeed) callbacks.onSpeed();
        });

        // 日記
        document.getElementById('btn-diary-close').addEventListener('click', () => {
            hideDiary();
            if (callbacks.onDiaryClose) callbacks.onDiaryClose();
        });
        document.getElementById('btn-diary-view').addEventListener('click', () => {
            showDiary();
        });

        // 重啟
        document.getElementById('btn-restart').addEventListener('click', () => {
            callbacks.onRestart();
        });

        // 成長通知
        document.getElementById('btn-growth-ok').addEventListener('click', () => {
            hideGrowthNotify();
            if (callbacks.onGrowthOk) callbacks.onGrowthOk();
        });

        // 設定
        document.getElementById('btn-settings').addEventListener('click', () => {
            showSettings();
        });
        document.getElementById('btn-settings-save').addEventListener('click', () => {
            const endpoint = document.getElementById('input-endpoint').value.trim();
            const name = document.getElementById('input-player').value.trim();
            Cloud.setConfig(endpoint, name);
            const statusEl = document.getElementById('settings-status');
            statusEl.textContent = '✅ 設定已儲存！';
            statusEl.style.color = '#7ec468';
            setTimeout(() => hideSettings(), 1000);
        });
        document.getElementById('btn-settings-close').addEventListener('click', () => {
            hideSettings();
        });
    }

    function bindBtn(btnId, cdKey, callback) {
        const btn = document.getElementById(btnId);
        if (!btn || !callback) return;
        btn.addEventListener('click', () => {
            if (cooldowns[cdKey] > 0) return;
            callback();
            startCooldown(cdKey, btnId);
        });
    }

    function startCooldown(type, btnId) {
        const btn = document.getElementById(btnId);
        if (!btn || !COOLDOWN_TIME[type]) return;
        btn.classList.add('cooldown');
        cooldowns[type] = COOLDOWN_TIME[type];

        const cdEl = document.getElementById(`cd-${type}`);
        const totalMs = COOLDOWN_TIME[type];
        let remaining = totalMs;

        const updateCD = () => {
            remaining -= 100;
            cooldowns[type] = remaining;
            if (cdEl) {
                const secs = Math.ceil(remaining / 1000);
                cdEl.textContent = secs > 0 ? `${secs}s` : '';
            }
            if (remaining <= 0) {
                clearInterval(cdInterval);
                btn.classList.remove('cooldown');
                cooldowns[type] = 0;
                if (cdEl) cdEl.textContent = '';
            }
        };

        if (cdEl) cdEl.textContent = `${Math.ceil(totalMs / 1000)}s`;
        const cdInterval = setInterval(updateCD, 100);
    }

    function showPlaying() {
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('ending-screen').classList.add('hidden');
        document.getElementById('hud').style.display = 'block';
        document.getElementById('action-buttons').style.display = 'flex';
        document.getElementById('hud-pupa').classList.add('hidden');
        document.getElementById('btn-chamber').classList.add('hidden');
    }

    function showEnding(type, gameState) {
        document.getElementById('hud').style.display = 'none';
        document.getElementById('action-buttons').style.display = 'none';

        const screen = document.getElementById('ending-screen');
        screen.classList.remove('hidden');

        const title = document.getElementById('ending-title');
        const stats = document.getElementById('ending-stats');
        const rankEl = document.getElementById('ending-rank');

        const scores = Game.calcScore();
        const { rank, label, color } = Game.getRank(scores.total);

        if (type === 'complete') {
            title.textContent = '🎉 恭喜！成功羽化！';
            title.style.color = '#f0d68a';
            document.querySelector('.ending-adult-img').style.display = 'block';
        } else if (type === 'gameover' || type === 'chamber-death' || type === 'pest-death') {
            const deathMsg = type === 'chamber-death' ? '蛹室崩塌'
                : type === 'pest-death' ? '病蟲害致死' : '環境惡劣';
            title.textContent = `💀 ${deathMsg}，獨角仙死亡了...`;
            title.style.color = '#c45a5a';
            document.querySelector('.ending-adult-img').style.display = 'none';
        } else {
            title.textContent = '⏰ 時間到！';
            title.style.color = '#d4a843';
            document.querySelector('.ending-adult-img').style.display = 'none';
        }

        const stage = Beetle.getStage(gameState.numLevel);
        const pupaLine = (gameState.numLevel >= 5 && gameState.pupaBuilt)
            ? `<br>🏗️ 蛹室完整度：${Math.floor(gameState.pupaIntegrity)}%`
            : '';
        const eventLine = scores.eventTotal > 0
            ? `📋 事件應對：+${scores.eventBonus} / 20<br>`
            : `📋 事件應對：無事件（不計分）<br>`;

        stats.innerHTML = `
      ${stage.emoji} 最終階段：${stage.name}<br>
      <br>
      <strong>📈 結束時數值</strong><br>
      🌡️ 溫度：${gameState.temperature.toFixed(1)}°C<br>
      💧 濕度：${Math.floor(gameState.moisture)}%<br>
      🍂 底材品質：${Math.floor(gameState.substrateQuality)}%<br>
      🦠 病蟲害指數：${Math.floor(gameState.pestIndex)}%<br>
      ❤️ 健康值：${Math.floor(gameState.health)}%${pupaLine}<br>
      <br>
      <strong>📊 飼育評分（基礎 80 分）</strong><br>
      🌡️ 溫度管理：${scores.tempScore} / 20<br>
      💧 濕度管理：${scores.moistureScore} / 20<br>
      🍂 底材品質：${scores.substrateScore} / 20<br>
      🦠 病蟲害控制：${scores.pestScore} / 20<br>
      ${eventLine}
      <br>
      🏆 總分：${scores.total}<br>
      🪲 成蟲體型：${label}<br>
      📅 存活：${gameState.numDay} 天
    `;

        rankEl.textContent = rank;
        rankEl.style.color = color;
    }

    function updateHUD(gameState) {
        const stage = Beetle.getStage(gameState.numLevel);

        document.getElementById('day-counter').textContent = `第 ${gameState.numDay} 天`;

        // 切換左上角大頭貼顯示（僅1~4齡顯示）
        const larvaImg = document.getElementById('hud-larva-img');
        if (gameState.numLevel >= 1 && gameState.numLevel <= 4) {
            larvaImg.style.display = 'block';
        } else {
            larvaImg.style.display = 'none';
        }

        document.getElementById('stage-badge').textContent = `${stage.emoji} ${stage.name}`;

        const hourTxt = gameState.numHour.toString().padStart(2, '0') + ':00';
        document.getElementById('hud-hour').textContent = hourTxt;

        // 4 大指標
        // 溫度：15~36°C 映射 0~100%
        const tempPercent = Math.max(0, Math.min(100, ((gameState.temperature - 15) / 21) * 100));
        setBar('bar-temp', tempPercent, 100);
        document.getElementById('val-temp').textContent = `${gameState.temperature.toFixed(1)}°`;
        colorTempBar(gameState.temperature);

        setBar('bar-moisture', gameState.moisture, 100);
        document.getElementById('val-moisture').textContent = `${Math.floor(gameState.moisture)}%`;
        colorIndicatorBar('bar-moisture', gameState.moisture, 40, 55, 30, 70);

        setBar('bar-substrate', gameState.substrateQuality, 100);
        document.getElementById('val-substrate').textContent = Math.floor(gameState.substrateQuality);
        colorIndicatorBar('bar-substrate', gameState.substrateQuality, 60, 100, 30, 999, true);

        // 病蟲害（反向：越高越危險）
        setBar('bar-pest', gameState.pestIndex, 100);
        document.getElementById('val-pest').textContent = Math.floor(gameState.pestIndex);
        colorPestBar(gameState.pestIndex);

        // 健康
        setBar('bar-health', gameState.health, 100);
        document.getElementById('val-health').textContent = Math.floor(gameState.health);

        // 蛹室
        const pupaHud = document.getElementById('hud-pupa');
        if (gameState.numLevel >= 5 && gameState.pupaBuilt) {
            pupaHud.classList.remove('hidden');
            setBar('bar-pupa', gameState.pupaIntegrity, 100);
            document.getElementById('val-pupa').textContent = Math.floor(gameState.pupaIntegrity);
            document.getElementById('pupa-warning').textContent = gameState.pupaWarning || '';
        } else {
            pupaHud.classList.add('hidden');
        }

        // 蛹室按鈕（蛹期且崩塌時顯示）
        const chamberBtn = document.getElementById('btn-chamber');
        if (gameState.numLevel === 5 && gameState.chamberCollapsed && !gameState.artificialChamberUsed) {
            chamberBtn.classList.remove('hidden');
        } else {
            chamberBtn.classList.add('hidden');
        }

        // 蟄伏期
        const stageText = gameState.isDormant
            ? `💤 蟄伏中（剩餘 ${gameState.dormancyHours} 小時）`
            : `${stage.emoji} ${stage.name}`;
        document.getElementById('stage-badge').textContent = stageText;
        document.getElementById('photo-count').textContent =
            `📷 ${Diary.getCount()}/6`;
    }

    function colorTempBar(temp) {
        const bar = document.getElementById('bar-temp');
        if (temp >= 23 && temp <= 26) {
            bar.style.background = 'linear-gradient(90deg, #5a8f4a, #7ec468)';
        } else if (temp < 15 || temp > 30) {
            bar.style.background = 'linear-gradient(90deg, #c45a5a, #e87c7c)';
        } else {
            bar.style.background = 'linear-gradient(90deg, #c47a30, #e8a850)';
        }
    }

    function colorIndicatorBar(barId, value, safeMin, safeMax, dangerMin, dangerMax, inverted) {
        const bar = document.getElementById(barId);
        if (inverted) {
            // 高好型（底材）
            if (value >= safeMin) {
                bar.style.background = 'linear-gradient(90deg, #5a8f4a, #7ec468)';
            } else if (value >= dangerMin) {
                bar.style.background = 'linear-gradient(90deg, #c47a30, #e8a850)';
            } else {
                bar.style.background = 'linear-gradient(90deg, #c45a5a, #e87c7c)';
            }
        } else {
            // 區間好型（濕度）
            if (value >= safeMin && value <= safeMax) {
                bar.style.background = 'linear-gradient(90deg, #4a7a9f, #6db4e0)';
            } else if (value < dangerMin || value > dangerMax) {
                bar.style.background = 'linear-gradient(90deg, #c45a5a, #e87c7c)';
            } else {
                bar.style.background = 'linear-gradient(90deg, #c47a30, #e8a850)';
            }
        }
    }

    function colorPestBar(pest) {
        const bar = document.getElementById('bar-pest');
        if (pest <= 20) {
            bar.style.background = 'linear-gradient(90deg, #5a8f4a, #7ec468)';
        } else if (pest <= 50) {
            bar.style.background = 'linear-gradient(90deg, #c47a30, #e8a850)';
        } else {
            bar.style.background = 'linear-gradient(90deg, #8b3a8b, #c45a5a)';
        }
    }

    function setBar(id, value, max) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.width = `${(value / max) * 100}%`;
        if (value < 20) {
            el.style.animation = 'pulse 0.8s ease infinite';
        } else {
            el.style.animation = 'none';
        }
    }

    function showGrowthNotify(stage, extraText) {
        const screen = document.getElementById('growth-notify');
        screen.classList.remove('hidden');
        document.getElementById('growth-title').textContent = '🎉 進化成功！';
        const desc = document.getElementById('growth-desc');
        desc.textContent = `${stage.emoji} 你的獨角仙進化為「${stage.name}」了！`;
        if (extraText) {
            desc.textContent += '\n' + extraText;
        }
        desc.style.whiteSpace = 'pre-line';
    }

    function showEventNotify(title, message) {
        const screen = document.getElementById('growth-notify');
        screen.classList.remove('hidden');
        document.getElementById('growth-title').textContent = title;

        // 羽化事件顯示破蛹圖
        const growthImg = document.getElementById('growth-image');
        if (title.includes('羽化')) {
            growthImg.src = 'pic/LbJUMWKWTP.png';
            growthImg.classList.remove('hidden');
        } else {
            growthImg.classList.add('hidden');
        }

        const desc = document.getElementById('growth-desc');
        desc.textContent = message;
        desc.style.whiteSpace = 'pre-line';
    }

    function hideGrowthNotify() {
        document.getElementById('growth-notify').classList.add('hidden');
        document.getElementById('growth-image').classList.add('hidden');
    }

    // ========== 隨機事件對話框 ==========
    function showEventChoice(evt, onChoose) {
        const screen = document.getElementById('event-choice');
        screen.classList.remove('hidden');

        document.getElementById('event-title').textContent = evt.name;
        document.getElementById('event-desc').textContent = evt.desc;
        document.getElementById('event-desc').style.whiteSpace = 'pre-line';
        document.getElementById('event-result').classList.add('hidden');
        document.getElementById('btn-event-ok').classList.add('hidden');

        const btnA = document.getElementById('btn-event-a');
        const btnB = document.getElementById('btn-event-b');
        btnA.textContent = evt.optionA.text;
        btnB.textContent = evt.optionB.text;
        btnA.style.display = '';
        btnB.style.display = '';

        // 移除舊 listener
        const newBtnA = btnA.cloneNode(true);
        const newBtnB = btnB.cloneNode(true);
        btnA.replaceWith(newBtnA);
        btnB.replaceWith(newBtnB);

        newBtnA.addEventListener('click', () => {
            const result = onChoose(true);
            showEventResult(result, true);
        });
        newBtnB.addEventListener('click', () => {
            const result = onChoose(false);
            showEventResult(result, false);
        });
    }

    function showEventResult(resultText, isCorrect) {
        document.getElementById('btn-event-a').style.display = 'none';
        document.getElementById('btn-event-b').style.display = 'none';

        const resultEl = document.getElementById('event-result');
        resultEl.textContent = (isCorrect ? '✅ ' : '❌ ') + resultText;
        resultEl.style.color = isCorrect ? '#7ec468' : '#e87c7c';
        resultEl.classList.remove('hidden');

        const okBtn = document.getElementById('btn-event-ok');
        okBtn.classList.remove('hidden');

        const newOkBtn = okBtn.cloneNode(true);
        okBtn.replaceWith(newOkBtn);
        newOkBtn.addEventListener('click', () => {
            document.getElementById('event-choice').classList.add('hidden');
            Game.resume();
        });
    }

    function showDiary() {
        Diary.renderDiaryPanel();
        document.getElementById('diary-panel').classList.remove('hidden');
    }

    function hideDiary() {
        document.getElementById('diary-panel').classList.add('hidden');
    }

    function showInteractFeedback(emoji, x, y) {
        const el = document.getElementById('interact-feedback');
        el.textContent = emoji;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.classList.remove('hidden');
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = 'floatUp 1s ease forwards';
        setTimeout(() => el.classList.add('hidden'), 1000);
    }

    function showSettings() {
        const panel = document.getElementById('settings-panel');
        panel.classList.remove('hidden');
        document.getElementById('input-endpoint').value =
            localStorage.getItem('kabuto_endpoint') || '';
        document.getElementById('input-player').value =
            localStorage.getItem('kabuto_player') || '';
        document.getElementById('settings-status').textContent = '';
    }

    function hideSettings() {
        document.getElementById('settings-panel').classList.add('hidden');
    }

    function showCloudToast(msg) {
        const el = document.getElementById('cloud-toast');
        el.textContent = msg;
        el.classList.remove('hidden');
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = 'toastIn 0.3s ease';
        setTimeout(() => el.classList.add('hidden'), 3000);
    }

    function showKnowledgeToast(msg) {
        const el = document.getElementById('knowledge-toast');
        el.innerHTML = msg;
        el.classList.remove('hidden');
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = 'toastIn 0.3s ease';
        setTimeout(() => el.classList.add('hidden'), 5000);
    }

    function updateSpeedBtn(speed) {
        const btn = document.getElementById('btn-speed');
        const labels = { 1: '1x', 2: '2x', 3: '3x' };
        btn.querySelector('.btn-icon').textContent = speed >= 3 ? '⏸️' : '⏩';
        btn.querySelector('.btn-text').textContent = labels[speed] || '1x';
    }

    return {
        init, showPlaying, showEnding, updateHUD,
        showGrowthNotify, showEventNotify, hideGrowthNotify,
        showEventChoice,
        showDiary, hideDiary, showInteractFeedback,
        showSettings, hideSettings, showCloudToast,
        showKnowledgeToast, updateSpeedBtn,
    };
})();
