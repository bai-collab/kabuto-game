/* ============================================
   main.js — 遊戲入口
   初始化、事件監聽、主迴圈
   ============================================ */

(() => {
    const canvas = document.getElementById('game-canvas');
    let gamePhase = 'title'; // title, playing, ended
    let beetlePos = { x: 0, y: 0 };
    let lastTimestamp = 0;

    // ======== 初始化 ========
    function initGame() {
        Renderer.init(canvas);
        Game.init();
        Diary.init();
        Cloud.init();

        const { w, h } = Renderer.getCanvasSize();
        beetlePos = { x: w * 0.5, y: h * 0.62 };

        UI.init({
            onSpray: handleSpray,
            onFeed: handleFeed,
            onSoil: handleSoil,
            onPhoto: handlePhoto,
            onRestart: handleRestart,
            onGrowthOk: handleGrowthOk,
            onDiaryClose: handleDiaryClose,
        });

        // 開始按鈕
        document.getElementById('btn-start').addEventListener('click', startGame);

        // Canvas 點擊 → 蟲蟲互動
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('touchend', handleCanvasTouch);

        // 繪製標題背景
        requestAnimationFrame(titleLoop);
    }

    // ======== 標題畫面迴圈 ========
    function titleLoop(ts) {
        if (gamePhase !== 'title') return;
        const dt = ts - lastTimestamp;
        lastTimestamp = ts;

        Renderer.clear();
        Renderer.drawBackground(true, 12);

        // 標題畫面也畫一隻成蟲
        const { w, h } = Renderer.getCanvasSize();
        Beetle.update(dt);
        Beetle.draw(Renderer.getCtx(), w * 0.5, h * 0.48, 7, 80);

        requestAnimationFrame(titleLoop);
    }

    // ======== 開始遊戲 ========
    function startGame() {
        gamePhase = 'playing';
        Game.init();
        Diary.init();

        UI.showPlaying();

        Game.start({
            onHourTick: handleHourTick,
            onDayTick: handleDayTick,
            onGameEnd: handleGameEnd,
        });

        lastTimestamp = performance.now();
        requestAnimationFrame(gameLoop);
    }

    // ======== 遊戲主迴圈 ========
    function gameLoop(ts) {
        if (gamePhase !== 'playing') return;
        const dt = ts - lastTimestamp;
        lastTimestamp = ts;

        const state = Game.getState();
        const isDay = Game.isDay();
        const { w, h } = Renderer.getCanvasSize();

        // 更新
        Beetle.update(dt);
        Renderer.frame(dt);

        // 成長檢查
        Game.tryLevelUp();

        // 更新蟲蟲位置（中間偏下）
        beetlePos.x = w * 0.5;
        beetlePos.y = h * 0.62;

        // 繪製
        Renderer.clear();
        Renderer.drawBackground(isDay, state.numHour);
        Renderer.drawBox(state.moisture, state.soilQuality);
        Beetle.draw(Renderer.getCtx(), beetlePos.x, beetlePos.y, state.numLevel, state.numSize);
        Renderer.drawParticles();

        // HUD
        UI.updateHUD(state);

        requestAnimationFrame(gameLoop);
    }

    // ======== 事件處理 ========
    function handleHourTick(state) {
        // 每小時更新 UI
        UI.updateHUD(state);
    }

    function handleDayTick(state) {
        // 每天的結算已在 game.js 內處理
    }

    function handleGameEnd(type) {
        gamePhase = 'ended';
        const state = Game.getState();

        // 延遲顯示結局，讓最後一幀渲染完
        setTimeout(async () => {
            UI.showEnding(type, state);

            // 自動儲存到 Google Sheets
            if (Cloud.isConfigured()) {
                UI.showCloudToast('☁️ 正在儲存飼養紀錄...');
                const result = await Cloud.saveRecord(state, type);
                if (result.status === 'ok') {
                    UI.showCloudToast('✅ 飼養紀錄已儲存到 Google Sheets！');
                } else {
                    UI.showCloudToast('❌ 儲存失敗：' + (result.message || '未知錯誤'));
                }
            }
        }, 500);
    }

    function handleSpray() {
        if (gamePhase !== 'playing') return;
        const ok = Game.spray();
        if (ok) {
            const { w, h } = Renderer.getCanvasSize();
            Renderer.spawnSprayParticles(beetlePos.x, beetlePos.y - 30);
        }
    }

    function handleFeed() {
        if (gamePhase !== 'playing') return;
        const ok = Game.feed();
        if (ok) {
            // 食物粒子特效 — 從上方舡下
            const { w, h } = Renderer.getCanvasSize();
            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    Renderer.spawnInteractParticles(
                        beetlePos.x + (Math.random() - 0.5) * 40,
                        beetlePos.y - 20
                    );
                }, i * 80);
            }
        }
    }

    function handleSoil() {
        if (gamePhase !== 'playing') return;
        const ok = Game.changeSoil();
        if (ok) {
            Renderer.spawnSoilParticles(beetlePos.x, beetlePos.y + 20);
        }
    }

    function handlePhoto() {
        if (gamePhase !== 'playing') return;
        if (!Diary.canTakePhoto()) return;

        const state = Game.getState();
        const stage = Beetle.getStage(state.numLevel);
        const ok = Diary.takePhoto(Renderer.getCanvas(), state, stage);

        if (ok) {
            // 閃光效果
            const ctx = Renderer.getCtx();
            const { w, h } = Renderer.getCanvasSize();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillRect(0, 0, w, h);
            setTimeout(() => {
                // 重繪
            }, 100);
        }
    }

    function handleRestart() {
        gamePhase = 'title';
        document.getElementById('ending-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.remove('hidden');
        document.getElementById('hud').style.display = 'none';
        document.getElementById('action-buttons').style.display = 'none';
        lastTimestamp = performance.now();
        requestAnimationFrame(titleLoop);
    }

    function handleGrowthOk() {
        if (gamePhase === 'playing') {
            Game.resume();
        }
    }

    function handleDiaryClose() {
        if (gamePhase === 'playing') {
            Game.resume();
        }
    }

    // ======== Canvas 互動 ========
    function handleCanvasClick(e) {
        if (gamePhase !== 'playing') return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / (Renderer.getCanvasSize().w);
        const scaleY = rect.height / (Renderer.getCanvasSize().h);
        const mx = (e.clientX - rect.left) / scaleX;
        const my = (e.clientY - rect.top) / scaleY;

        checkBeetleInteraction(mx, my, e.clientX, e.clientY);
    }

    function handleCanvasTouch(e) {
        if (gamePhase !== 'playing') return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / (Renderer.getCanvasSize().w);
        const scaleY = rect.height / (Renderer.getCanvasSize().h);
        const mx = (touch.clientX - rect.left) / scaleX;
        const my = (touch.clientY - rect.top) / scaleY;

        checkBeetleInteraction(mx, my, touch.clientX, touch.clientY);
    }

    function checkBeetleInteraction(mx, my, screenX, screenY) {
        const state = Game.getState();
        const hitbox = Beetle.getHitBox(beetlePos.x, beetlePos.y, state.numLevel, state.numSize);

        if (mx >= hitbox.x && mx <= hitbox.x + hitbox.w &&
            my >= hitbox.y && my <= hitbox.y + hitbox.h) {

            // 觸發互動！
            const reaction = Game.interact();
            if (reaction) {
                Beetle.triggerPoke();
                Renderer.spawnInteractParticles(beetlePos.x, beetlePos.y);

                // 取得容器相對位置
                const container = document.getElementById('game-container');
                const containerRect = container.getBoundingClientRect();
                const feedbackX = screenX - containerRect.left;
                const feedbackY = screenY - containerRect.top - 30;

                UI.showInteractFeedback(reaction, feedbackX, feedbackY);
            }
        }
    }

    // ======== 成長升級通知（攔截 tryLevelUp） ========
    const originalTryLevelUp = Game.tryLevelUp;
    Game.tryLevelUp = function () {
        const prevLevel = Game.getState().numLevel;
        const result = originalTryLevelUp.call(Game);
        const newLevel = Game.getState().numLevel;

        if (result && newLevel > prevLevel && newLevel < 7) {
            // 暫停並顯示通知
            Game.pause();
            const stage = Beetle.getStage(newLevel);
            UI.showGrowthNotify(stage);
        }

        return result;
    };

    // ======== 啟動 ========
    document.addEventListener('DOMContentLoaded', initGame);
})();
