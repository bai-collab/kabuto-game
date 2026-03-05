/* ============================================
   ui.js — DOM UI 互動
   按鈕、HUD、面板控制
   ============================================ */

const UI = (() => {
    let cooldowns = { spray: 0, feed: 0, soil: 0, photo: 0 };
    const COOLDOWN_TIME = { spray: 2000, feed: 3000, soil: 5000, photo: 1500 };

    function init(callbacks) {
        // 按鈕事件
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

        document.getElementById('btn-photo').addEventListener('click', () => {
            if (cooldowns.photo > 0) return;
            callbacks.onPhoto();
            startCooldown('photo');
        });

        // 日記關閉
        document.getElementById('btn-diary-close').addEventListener('click', () => {
            hideDiary();
            if (callbacks.onDiaryClose) callbacks.onDiaryClose();
        });

        // 結局按鈕
        document.getElementById('btn-diary-view').addEventListener('click', () => {
            showDiary();
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            callbacks.onRestart();
        });

        // 成長通知確認
        document.getElementById('btn-growth-ok').addEventListener('click', () => {
            hideGrowthNotify();
            if (callbacks.onGrowthOk) callbacks.onGrowthOk();
        });

        // Settings panel
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
        const btn = document.getElementById(
            type === 'spray' ? 'btn-spray' :
                type === 'feed' ? 'btn-feed' :
                    type === 'soil' ? 'btn-soil' : 'btn-photo'
        );
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
        } else if (type === 'gameover') {
            title.textContent = '💀 獨角仙死亡了...';
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
      🍖 餵食次數：${gameState.feedCount}<br>
      💧 噴水次數：${gameState.sprayCount}<br>
      🌱 換土次數：${gameState.soilCount}<br>
      📷 照片：${Diary.getCount()} / 6<br>
      🖱️ 互動次數：${gameState.interactCount}<br>
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

        document.getElementById('val-power').textContent = Math.floor(gameState.numPower);
        document.getElementById('val-moisture').textContent = Math.floor(gameState.moisture);
        document.getElementById('val-soil').textContent = Math.floor(gameState.soilQuality);
        document.getElementById('val-hunger').textContent = Math.floor(gameState.hunger);
        document.getElementById('val-size').textContent = Math.floor(gameState.numSize);

        document.getElementById('stage-label').textContent =
            `${stage.emoji} ${stage.name}`;
        document.getElementById('photo-count').textContent =
            `📷 ${Diary.getCount()}/6`;
    }

    function setBar(id, value, max) {
        const el = document.getElementById(id);
        el.style.width = `${(value / max) * 100}%`;

        // 低值警告閃爍
        if (value < 20) {
            el.style.animation = 'pulse 0.8s ease infinite';
        } else {
            el.style.animation = 'none';
        }
    }

    function showGrowthNotify(stage) {
        const screen = document.getElementById('growth-notify');
        screen.classList.remove('hidden');
        document.getElementById('growth-title').textContent =
            `🎉 進化成功！`;
        document.getElementById('growth-desc').textContent =
            `${stage.emoji} 你的獨角仙進化為「${stage.name}」了！`;
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
        // 觸發 reflow
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
        showGrowthNotify, hideGrowthNotify,
        showDiary, hideDiary, showInteractFeedback,
        showSettings, hideSettings, showCloudToast
    };
})();
