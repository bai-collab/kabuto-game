/* ============================================
   main.js — 遊戲入口 v4
   初始化、事件監聽、主迴圈
   隨機事件對話框、8操作處理
   ============================================ */

(() => {
    const canvas = document.getElementById('game-canvas');
    let gamePhase = 'title';
    let beetlePos = { x: 0, y: 0 };
    let lastTimestamp = 0;

    // ======== 知識小卡 ========
    const KNOWLEDGE_CARDS = {
        2: '📖 <b>知識小卡</b>：1齡幼蟲剛孵化時會先吃掉自己的卵殼，獲取前進所需營養！',
        3: '📖 <b>知識小卡</b>：2齡幼蟲會開始大量進食腐植土，身體顏色從白色漸漸轉黃。',
        4: '📖 <b>知識小卡</b>：3齡（終齡）幼蟲是最大的階段，體重可達卵的100倍以上！這個階段最需要充足的底材。',
        5: '📖 <b>知識小卡</b>：幼蟲會用自己的糞便塗抹蛹室壁面來加固結構，形成一個直立式橢圓形空間。蛹期間千萬不要打擾！',
        6: '📖 <b>知識小卡</b>：羽化後的獨角仙不會馬上活動，需要一段「蟄伏期」讓外殼硬化。這段時間請維持環境穩定！',
    };

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
            onVentilate: handleVentilate,
            onSubstrate: handleSubstrate,
            onInspect: handleInspect,
            onClean: handleClean,
            onCool: handleCool,
            onPest: handlePest,
            onChamber: handleChamber,
            onPhoto: handlePhoto,
            onSpeed: handleSpeed,
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

        // 重置漫遊狀態
        roamTimer = 0;
        escapePhase = 0;
        escaped = false;
        isDistressed = false;

        UI.showPlaying();

        Game.start({
            onHourTick: handleHourTick,
            onDayTick: handleDayTick,
            onGameEnd: handleGameEnd,
            onEvent: handleGameEvent,
            onRandomEvent: handleRandomEvent,
        });

        lastTimestamp = performance.now();
        requestAnimationFrame(gameLoop);
    }

    // ======== 遊戲主迴圈 ========
    // 漫遊 AI 狀態
    let roamTarget = { x: 0, y: 0 };
    let roamTimer = 0;
    let isDistressed = false;
    let escapePhase = 0; // 0=正常, 1=爬到上面, 2=跳出
    let escaped = false;

    function isEnvironmentBad(state) {
        return state.temperature > 30 || state.temperature < 15 ||
            state.moisture > 70 || state.moisture < 25 ||
            state.substrateQuality < 25 || state.pestIndex > 50;
    }

    function gameLoop(ts) {
        if (gamePhase !== 'playing') return;
        const dt = ts - lastTimestamp;
        lastTimestamp = ts;

        const state = Game.getState();
        const isDay = Game.isDay();
        const { w, h } = Renderer.getCanvasSize();

        // 處於事件選擇/暫停狀態時，只畫靜態畫面，不更新邏輯
        if (state.phase === 'playing') {
            Beetle.update(dt);
            Renderer.frame(dt);
            Game.tryLevelUp();

            // 飼育箱範圍
            const boxX = w * 0.08;
            const boxY = h * 0.42;
            const boxW = w * 0.84;
            const boxH = h * 0.48;
            const soilY = boxY + boxH * 0.25;
            const soilH = boxH * 0.7;

            // ========== 幼蟲漫遊 AI ==========
            const isLarva = state.numLevel >= 2 && state.numLevel <= 4;
            const isPupa = state.numLevel === 5;
            const isDormant = state.isDormant;

            if (isLarva && !escaped) {
                isDistressed = isEnvironmentBad(state);

                if (isDistressed && escapePhase === 0) {
                    // 開始往上爬
                    escapePhase = 1;
                    roamTarget.x = beetlePos.x;
                    roamTarget.y = soilY - 20; // 爬到土面上
                }

                if (escapePhase === 1) {
                    // 爬到上面
                    beetlePos.x += (roamTarget.x - beetlePos.x) * 0.005;
                    beetlePos.y += (roamTarget.y - beetlePos.y) * 0.005;
                    if (Math.abs(beetlePos.y - roamTarget.y) < 5) {
                        if (isDistressed) {
                            escapePhase = 2;
                            roamTarget.y = -60; // 跳出視窗
                        } else {
                            // 環境改善了，回到土裡
                            escapePhase = 0;
                            roamTarget.y = soilY + soilH * 0.3 + Math.random() * soilH * 0.4;
                        }
                    }
                } else if (escapePhase === 2) {
                    // 跳出畫面
                    beetlePos.y += (roamTarget.y - beetlePos.y) * 0.008;
                    if (beetlePos.y < -40) {
                        escaped = true;
                        // 環境太惡劣，幼蟲逃跑 = 死亡
                        state.health = 0;
                        onEvent && UI.showCloudToast('💀 幼蟲逃出飼育箱了！環境太惡劣...');
                    }
                } else {
                    // 正常漫遊
                    roamTimer -= dt;
                    if (roamTimer <= 0) {
                        roamTimer = 2000 + Math.random() * 4000;
                        roamTarget.x = boxX + 30 + Math.random() * (boxW - 60);
                        roamTarget.y = soilY + 10 + Math.random() * (soilH - 30);
                    }
                    beetlePos.x += (roamTarget.x - beetlePos.x) * 0.015;
                    beetlePos.y += (roamTarget.y - beetlePos.y) * 0.015;
                }
            } else if (isPupa || isDormant) {
                // 蛹期不動
                beetlePos.x = w * 0.45;
                beetlePos.y = h * 0.65;
            } else if (!isLarva && state.numLevel < 5) {
                // 卵期微微搖擺
                beetlePos.x = w * 0.45 + Math.sin(Date.now() / 2000) * 2;
                beetlePos.y = h * 0.65;
            } else {
                beetlePos.x = w * 0.45;
                beetlePos.y = h * 0.65;
            }

            // 高溫抖動
            if (state.temperature > 32 && !escaped) {
                beetlePos.x += (Math.random() - 0.5) * 4;
                beetlePos.y += (Math.random() - 0.5) * 4;
            }

            // 繪製
            Renderer.clear();
            Renderer.drawBackground(isDay, state.numHour);
            Renderer.drawHeatHaze(w, h, state.temperature);
            const bounds = Renderer.drawBox(state.moisture, state.substrateQuality, state);
            Renderer.setBoxBounds(bounds);

            // 大便
            Renderer.drawPoop(state.poopPositions);

            // 蛹室視覺
            if (state.numLevel === 5 && state.pupaBuilt) {
                drawPupaChamber(Renderer.getCtx(), beetlePos.x, beetlePos.y, state);
            }

            if (!escaped) {
                Beetle.draw(Renderer.getCtx(), beetlePos.x, beetlePos.y, state.numLevel, 50);
            }
            Renderer.drawParticles();

            UI.updateHUD(state);
        }

        requestAnimationFrame(gameLoop);
    }

    // ======== 繪製蛹室 ========
    function drawPupaChamber(ctx, cx, cy, state) {
        ctx.save();
        const integrity = state.pupaIntegrity / 100;
        const collapsed = state.chamberCollapsed;

        ctx.strokeStyle = collapsed
            ? `rgba(200, 80, 80, 0.6)`
            : `rgba(180, 140, 60, ${0.3 + integrity * 0.4})`;
        ctx.lineWidth = collapsed ? 1 : 2;
        ctx.setLineDash(collapsed ? [4, 4] : []);

        ctx.beginPath();
        ctx.ellipse(cx, cy, 22, 35, 0, 0, Math.PI * 2);
        ctx.stroke();

        if (!collapsed) {
            ctx.fillStyle = `rgba(100, 70, 30, ${integrity * 0.15})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 24, 37, 0, 0, Math.PI * 2);
            ctx.fill();
        }

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
            UI.showCloudToast(message);
        }
    }

    // ======== 隨機事件對話框 ========
    function handleRandomEvent(evt) {
        UI.showEventChoice(evt, (isA) => {
            return Game.resolveEvent(isA);
        });
    }

    // ======== 8 個玩家操作 ========
    function handleSpray() {
        if (gamePhase !== 'playing') return;
        const ok = Game.spray();
        if (ok) {
            Renderer.spawnSprayParticles(beetlePos.x, beetlePos.y - 30);
            UI.showCloudToast('💦 噴水補濕！濕度 +10%');
        }
    }

    function handleVentilate() {
        if (gamePhase !== 'playing') return;
        const ok = Game.ventilate();
        if (ok) {
            UI.showCloudToast('🌬️ 通風換氣！溫度-2°C、濕度-5%');
        }
    }

    function handleSubstrate() {
        if (gamePhase !== 'playing') return;
        const ok = Game.changeSubstrate();
        if (ok) {
            Renderer.spawnSoilParticles(beetlePos.x, beetlePos.y + 20);
            UI.showCloudToast('🍂 換新底材！底材品質+50%、病蟲害-20%');
        }
    }

    function handleInspect() {
        if (gamePhase !== 'playing') return;
        const info = Game.inspect();
        if (info) {
            Game.pause();
            UI.showEventNotify('🔍 翻土觀察', info);
        }
    }

    function handleClean() {
        if (gamePhase !== 'playing') return;
        const ok = Game.cleanPoop();
        if (ok) {
            UI.showCloudToast('🧹 糞便清除完畢！底材品質+15%');
        }
    }

    function handleCool() {
        if (gamePhase !== 'playing') return;
        const ok = Game.coolDown();
        if (ok) {
            UI.showCloudToast('❄️ 降溫處理！溫度-5°C');
        }
    }

    function handlePest() {
        if (gamePhase !== 'playing') return;
        const ok = Game.removePest();
        if (ok) {
            UI.showCloudToast('🏥 除蟲處理！病蟲害-30%');
        }
    }

    function handleChamber() {
        if (gamePhase !== 'playing') return;
        Game.buildArtificialChamber();
    }

    function handleSpeed() {
        if (gamePhase !== 'playing') return;
        const speed = Game.toggleSpeed();
        const labels = { 1: '1秒=1小時', 2: '0.5秒=1小時', 3: '0.25秒=1小時' };
        UI.showCloudToast(`⏩ 速度：${labels[speed]}`);
        UI.updateSpeedBtn(speed);
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
        const hitbox = Beetle.getHitBox(beetlePos.x, beetlePos.y, state.numLevel, 50);

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
                    '幼蟲即將建造蛹室！\n蛹期間請勿翻土觀察！\n保持環境穩定即可。');
            } else if (newLevel === 6) {
                // 羽化通知由 game.js 的 onEvent 處理
            } else {
                UI.showGrowthNotify(stage);
            }

            // 顯示知識小卡
            if (KNOWLEDGE_CARDS[newLevel]) {
                setTimeout(() => {
                    UI.showKnowledgeToast(KNOWLEDGE_CARDS[newLevel]);
                }, 1500);
            }
        }

        return result;
    };

    // ======== 啟動 ========
    document.addEventListener('DOMContentLoaded', initGame);
})();
