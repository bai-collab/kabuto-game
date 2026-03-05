/* ============================================
   main.js — 遊戲入口 v3
   初始化、事件監聽、主迴圈
   蛹室事件、蟄伏期處理
   ============================================ */

(() => {
    const canvas = document.getElementById('game-canvas');
    let gamePhase = 'title';
    let beetlePos = { x: 0, y: 0 };
    let lastTimestamp = 0;

    // ======== 初始化 ========
    function initGame() {
        Renderer.init(canvas);
        Game.init();
        Diary.init();
        Cloud.init();

        const { w, h } = Renderer.getCanvasSize();
        beetlePos = { x: w * 0.45, y: h * 0.65 };

        UI.init({
            onSpray: handleSpray,
            onFeed: handleFeed,
            onSoil: handleSoil,
            onCompact: handleCompact,
            onPhoto: handlePhoto,
            onRebuild: handleRebuild,
            onRestart: handleRestart,
            onGrowthOk: handleGrowthOk,
            onDiaryClose: handleDiaryClose,
        });

        document.getElementById('btn-start').addEventListener('click', startGame);
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('touchend', handleCanvasTouch);

        requestAnimationFrame(titleLoop);
    }

    // ======== 標題畫面 ========
    function titleLoop(ts) {
        if (gamePhase !== 'title') return;
        const dt = ts - lastTimestamp;
        lastTimestamp = ts;

        Renderer.clear();
        Renderer.drawBackground(true, 12);

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
            onEvent: handleGameEvent,
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

        Beetle.update(dt);
        Renderer.frame(dt);
        Game.tryLevelUp();

        beetlePos.x = w * 0.45;
        beetlePos.y = h * 0.65;

        // 繪製
        Renderer.clear();
        Renderer.drawBackground(isDay, state.numHour);
        Renderer.drawBox(state.moisture, state.soilQuality);

        // 蛹室視覺（蛹期時在蟲蟲下方畫蛹室輪廓）
        if (state.numLevel === 5 && state.pupaBuilt) {
            drawPupaChamber(Renderer.getCtx(), beetlePos.x, beetlePos.y, state);
        }

        Beetle.draw(Renderer.getCtx(), beetlePos.x, beetlePos.y, state.numLevel, state.numSize);
        Renderer.drawParticles();

        UI.updateHUD(state);

        requestAnimationFrame(gameLoop);
    }

    // ======== 繪製蛹室 ========
    function drawPupaChamber(ctx, cx, cy, state) {
        ctx.save();
        const integrity = state.pupaIntegrity / 100;
        const collapsed = state.chamberCollapsed;

        // 蛹室橢圓形空間
        ctx.strokeStyle = collapsed
            ? `rgba(200, 80, 80, 0.6)`
            : `rgba(180, 140, 60, ${0.3 + integrity * 0.4})`;
        ctx.lineWidth = collapsed ? 1 : 2;
        ctx.setLineDash(collapsed ? [4, 4] : []);

        ctx.beginPath();
        ctx.ellipse(cx, cy, 22, 35, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 蛹室壁面紋理
        if (!collapsed) {
            ctx.fillStyle = `rgba(100, 70, 30, ${integrity * 0.15})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 24, 37, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 裂痕（完整度低時）
        if (integrity < 0.5 && !collapsed) {
            ctx.strokeStyle = 'rgba(200, 80, 80, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                const angle = (Math.PI * 2 / 3) * i + Date.now() / 10000;
                const x1 = cx + Math.cos(angle) * 18;
                const y1 = cy + Math.sin(angle) * 28;
                ctx.moveTo(x1, y1);
                ctx.lineTo(x1 + (Math.random() - 0.5) * 8, y1 + (Math.random() - 0.5) * 8);
                ctx.stroke();
            }
        }

        ctx.setLineDash([]);
        ctx.restore();
    }

    // ======== 事件處理 ========
    function handleHourTick(state) {
        UI.updateHUD(state);
    }

    function handleDayTick(state) { }

    function handleGameEnd(type) {
        gamePhase = 'ended';
        const state = Game.getState();

        setTimeout(async () => {
            UI.showEnding(type, state);

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

    function handleGameEvent(type, message) {
        if (type === 'chamber-collapse' || type === 'chamber-built' ||
            type === 'eclosion' || type === 'dormancy-end') {
            Game.pause();
            UI.showEventNotify(
                type === 'chamber-collapse' ? '🚨 蛹室崩塌！' :
                    type === 'chamber-built' ? '🏗️ 蛹室建造' :
                        type === 'eclosion' ? '🦋 羽化成功！' :
                            '🪲 甦醒了！',
                message
            );
        } else {
            // 小型提示用 toast
            UI.showCloudToast(message);
        }
    }

    // ======== 玩家操作 ========
    function handleSpray() {
        if (gamePhase !== 'playing') return;
        const ok = Game.spray();
        if (ok) {
            Renderer.spawnSprayParticles(beetlePos.x, beetlePos.y - 30);
        }
    }

    function handleFeed() {
        if (gamePhase !== 'playing') return;
        const ok = Game.feed();
        if (ok) {
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

    function handleCompact() {
        if (gamePhase !== 'playing') return;
        const ok = Game.compactSoil();
        if (ok) {
            // 壓實粒子
            Renderer.spawnSoilParticles(beetlePos.x, beetlePos.y + 10);
            UI.showCloudToast('✊ 土壤已壓實！');
        }
    }

    function handleRebuild() {
        if (gamePhase !== 'playing') return;
        Game.rebuildChamber();
    }

    function handlePhoto() {
        if (gamePhase !== 'playing') return;
        if (!Diary.canTakePhoto()) return;

        const state = Game.getState();
        const stage = Beetle.getStage(state.numLevel);
        const ok = Diary.takePhoto(Renderer.getCanvas(), state, stage);

        if (ok) {
            const ctx = Renderer.getCtx();
            const { w, h } = Renderer.getCanvasSize();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillRect(0, 0, w, h);
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

            const reaction = Game.interact();
            if (reaction) {
                Beetle.triggerPoke();
                if (reaction !== '😰' && reaction !== '💤') {
                    Renderer.spawnInteractParticles(beetlePos.x, beetlePos.y);
                }

                const container = document.getElementById('game-container');
                const containerRect = container.getBoundingClientRect();
                const feedbackX = screenX - containerRect.left;
                const feedbackY = screenY - containerRect.top - 30;
                UI.showInteractFeedback(reaction, feedbackX, feedbackY);
            }
        }
    }

    // ======== 成長升級通知 ========
    const originalTryLevelUp = Game.tryLevelUp;
    Game.tryLevelUp = function () {
        const prevLevel = Game.getState().numLevel;
        const result = originalTryLevelUp.call(Game);
        const newLevel = Game.getState().numLevel;

        if (result && newLevel > prevLevel && newLevel < 7) {
            Game.pause();
            const stage = Beetle.getStage(newLevel);

            if (newLevel === 5) {
                UI.showGrowthNotify(stage,
                    '幼蟲即將建造蛹室！\n請確保土壤深度≥5cm、壓實度≥40\n蛹期間請勿觸碰蟲蟲！');
            } else if (newLevel === 6) {
                // 羽化通知由 game.js 的 onEvent 處理
            } else {
                UI.showGrowthNotify(stage);
            }
        }

        return result;
    };

    // ======== 啟動 ========
    document.addEventListener('DOMContentLoaded', initGame);
})();
