/* ============================================
   ui.js — DOM UI 互動 v3
   按鈕、HUD、面板控制、蛹室 UI
   ============================================ */

const UI = (() => {
    let cooldowns = { spray: 0, feed: 0, soil: 0, compact: 0, photo: 0, rebuild: 0 };
    const COOLDOWN_TIME = { spray: 2000, feed: 3000, soil: 5000, compact: 3000, photo: 1500, rebuild: 2000 };

    function init(callbacks) {
        document.getElementById('btn-spray').addEventListener('click', () => {
            if (cooldowns.spray > 0) return;
            callbacks.onSpray();
            startCooldown('spray');
        });

        document.getElementById('btn-feed').addEventListener('click', () => {
            if (cooldowns.feed > 0) return;
            callbacks.onFeed();
            startCooldown('feed');
        });

        document.getElementById('btn-soil').addEventListener('click', () => {
            if (cooldowns.soil > 0) return;
            callbacks.onSoil();
            startCooldown('soil');
        });

        document.getElementById('btn-compact').addEventListener('click', () => {
            if (cooldowns.compact > 0) return;
            callbacks.onCompact();
            startCooldown('compact');
        });

        document.getElementById('btn-photo').addEventListener('click', () => {
            if (cooldowns.photo > 0) return;
            callbacks.onPhoto();
            startCooldown('photo');
        });

        document.getElementById('btn-rebuild').addEventListener('click', () => {
            if (cooldowns.rebuild > 0) return;
            callbacks.onRebuild();
            startCooldown('rebuild');
        });

        document.getElementById('btn-diary-close').addEventListener('click', () => {
            hideDiary();
            if (callbacks.onDiaryClose) callbacks.onDiaryClose();
        });

        document.getElementById('btn-diary-view').addEventListener('click', () => {
            showDiary();
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            callbacks.onRestart();
        });

        document.getElementById('btn-growth-ok').addEventListener('click', () => {
            hideGrowthNotify();
            if (callbacks.onGrowthOk) callbacks.onGrowthOk();
        });

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

    function startCooldown(type) {
        const btnMap = {
            spray: 'btn-spray', feed: 'btn-feed', soil: 'btn-soil',
            compact: 'btn-compact', photo: 'btn-photo', rebuild: 'btn-rebuild'
        };
        const btn = document.getElementById(btnMap[type]);
        if (!btn) return;
        btn.classList.add('cooldown');
        cooldowns[type] = COOLDOWN_TIME[type];
        setTimeout(() => {
            btn.classList.remove('cooldown');
            cooldowns[type] = 0;
        }, COOLDOWN_TIME[type]);
    }

    function showPlaying() {
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('ending-screen').classList.add('hidden');
        document.getElementById('hud').style.display = 'block';
        document.getElementById('action-buttons').style.display = 'flex';
        document.getElementById('hud-pupa').classList.add('hidden');
        document.getElementById('btn-rebuild').classList.add('hidden');
    }

    function showEnding(type, gameState) {
        document.getElementById('hud').style.display = 'none';
        document.getElementById('action-buttons').style.display = 'none';

        const screen = document.getElementById('ending-screen');
        screen.classList.remove('hidden');

        const title = document.getElementById('ending-title');
        const stats = document.getElementById('ending-stats');
        const rankEl = document.getElementById('ending-rank');

        const score = Game.calcScore();
        const { rank, color } = Game.getRank(score);

        if (type === 'complete') {
            title.textContent = '🎉 恭喜！成功羽化！';
            title.style.color = '#f0d68a';
        } else if (type === 'gameover' || type === 'chamber-death') {
            title.textContent = type === 'chamber-death'
                ? '💀 蛹室崩塌，獨角仙死亡了...'
                : '💀 獨角仙死亡了...';
            title.style.color = '#c45a5a';
        } else {
            title.textContent = '⏰ 時間到！';
            title.style.color = '#d4a843';
        }

        const stage = Beetle.getStage(gameState.numLevel);
        stats.innerHTML = `
      ${stage.emoji} 最終階段：${stage.name}<br>
      📏 體型：${Math.floor(gameState.numSize)}<br>
      💪 體力：${Math.floor(gameState.numPower)}<br>
      🌡 溫度：${gameState.temperature.toFixed(1)}°C<br>
      🏠 蛹室：${gameState.pupaBuilt ? (gameState.chamberCollapsed ? '崩塌' : `${Math.floor(gameState.pupaIntegrity)}%`) : '未建造'}<br>
      🍖 餵食：${gameState.feedCount} 次<br>
      📷 照片：${Diary.getCount()} / 6<br>
      🖱️ 互動：${gameState.interactCount} 次<br>
      📅 存活：${gameState.numDay} 天<br>
      🏆 總分：${score}
    `;

        rankEl.textContent = rank;
        rankEl.style.color = color;
    }

    function updateHUD(gameState) {
        const stage = Beetle.getStage(gameState.numLevel);

        document.getElementById('hud-day').textContent = `第 ${gameState.numDay} 天`;
        document.getElementById('hud-hour').textContent =
            `${String(gameState.numHour).padStart(2, '0')}:00`;

        setBar('bar-power', gameState.numPower, 100);
        setBar('bar-moisture', gameState.moisture, 100);
        setBar('bar-soil', gameState.soilQuality, 100);
        setBar('bar-hunger', gameState.hunger, 100);
        setBar('bar-size', gameState.numSize, 100);

        // 溫度條：18-30°C 映射為 0-100%
        const tempPercent = Math.max(0, Math.min(100, ((gameState.temperature - 15) / 20) * 100));
        setBar('bar-temp', tempPercent, 100);
        document.getElementById('val-temp').textContent = `${gameState.temperature.toFixed(1)}°`;

        // 溫度條顏色
        const tempBar = document.getElementById('bar-temp');
        if (gameState.temperature >= 20 && gameState.temperature <= 25) {
            tempBar.style.background = 'linear-gradient(90deg, #5a8f4a, #7ec468)';
        } else if (gameState.temperature < 18 || gameState.temperature > 28) {
            tempBar.style.background = 'linear-gradient(90deg, #c45a5a, #e87c7c)';
        } else {
            tempBar.style.background = 'linear-gradient(90deg, #c47a30, #e8a850)';
        }

        document.getElementById('val-power').textContent = Math.floor(gameState.numPower);
        document.getElementById('val-moisture').textContent = Math.floor(gameState.moisture);
        document.getElementById('val-soil').textContent = Math.floor(gameState.soilQuality);
        document.getElementById('val-hunger').textContent = Math.floor(gameState.hunger);
        document.getElementById('val-size').textContent = Math.floor(gameState.numSize);

        // 蛹室 UI
        const pupaHud = document.getElementById('hud-pupa');
        if (gameState.numLevel >= 5 && gameState.pupaBuilt) {
            pupaHud.classList.remove('hidden');
            setBar('bar-pupa', gameState.pupaIntegrity, 100);
            document.getElementById('val-pupa').textContent = Math.floor(gameState.pupaIntegrity);
            document.getElementById('pupa-warning').textContent = gameState.pupaWarning || '';

            // 蛹室崩塌時顯示重建按鈕
            const rebuildBtn = document.getElementById('btn-rebuild');
            if (gameState.chamberCollapsed) {
                rebuildBtn.classList.remove('hidden');
            } else {
                rebuildBtn.classList.add('hidden');
            }
        } else {
            pupaHud.classList.add('hidden');
            document.getElementById('btn-rebuild').classList.add('hidden');
        }

        // 蛹期隱藏餵食按鈕
        const feedBtn = document.getElementById('btn-feed');
        const soilBtn = document.getElementById('btn-soil');
        if (gameState.numLevel >= 5 || gameState.isDormant) {
            feedBtn.classList.add('hidden');
            soilBtn.classList.add('hidden');
        } else {
            feedBtn.classList.remove('hidden');
            soilBtn.classList.remove('hidden');
        }

        // 蟄伏期顯示
        const stageText = gameState.isDormant
            ? `💤 蟄伏中（剩餘 ${gameState.dormancyHours} 小時）`
            : `${stage.emoji} ${stage.name}`;

        document.getElementById('stage-label').textContent = stageText;
        document.getElementById('photo-count').textContent =
            `📷 ${Diary.getCount()}/6`;
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
        const desc = document.getElementById('growth-desc');
        desc.textContent = message;
        desc.style.whiteSpace = 'pre-line';
    }

    function hideGrowthNotify() {
        document.getElementById('growth-notify').classList.add('hidden');
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

    return {
        init, showPlaying, showEnding, updateHUD,
        showGrowthNotify, showEventNotify, hideGrowthNotify,
        showDiary, hideDiary, showInteractFeedback,
        showSettings, hideSettings, showCloudToast
    };
})();
