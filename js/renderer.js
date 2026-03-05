/* ============================================
   renderer.js — Canvas 渲染引擎
   場景繪製、粒子系統、背景日夜切換
   ============================================ */

const Renderer = (() => {
    let canvas, ctx;
    let W, H;
    let particles = [];
    let soilChangeAnim = 0;
    let lastTime = 0;

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        const container = canvas.parentElement;
        W = canvas.width = container.clientWidth * window.devicePixelRatio;
        H = canvas.height = container.clientHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    function getCanvasSize() {
        return {
            w: canvas.width / window.devicePixelRatio,
            h: canvas.height / window.devicePixelRatio
        };
    }

    function clear() {
        ctx.clearRect(0, 0, W, H);
    }

    // ========== 背景 ==========
    function drawBackground(isDay, hour) {
        const { w, h } = getCanvasSize();

        // 天空漸層 — 根據小時平滑過渡
        let topColor, bottomColor;

        if (hour >= 6 && hour < 10) {
            // 清晨
            const t = (hour - 6) / 4;
            topColor = lerpColor('#1a1028', '#4a7ab0', t);
            bottomColor = lerpColor('#2a1830', '#88b8d8', t);
        } else if (hour >= 10 && hour < 16) {
            // 白天
            topColor = '#4a7ab0';
            bottomColor = '#88b8d8';
        } else if (hour >= 16 && hour < 20) {
            // 黃昏
            const t = (hour - 16) / 4;
            topColor = lerpColor('#4a7ab0', '#1a1028', t);
            bottomColor = lerpColor('#88b8d8', '#2a1830', t);
        } else {
            // 夜晚
            topColor = '#0a0818';
            bottomColor = '#1a1028';
        }

        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
        skyGrad.addColorStop(0, topColor);
        skyGrad.addColorStop(1, bottomColor);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // 星星（夜晚）
        if (!isDay) {
            drawStars(w, h, hour);
        }

        // 月亮 / 太陽
        if (isDay) {
            drawSun(w, hour);
        } else {
            drawMoon(w, hour);
        }
    }

    function drawStars(w, h, hour) {
        const alpha = hour >= 20 || hour < 4 ? 0.8 : 0.4;
        ctx.fillStyle = `rgba(255, 255, 220, ${alpha})`;
        // 偽隨機固定星星
        const seed = 42;
        for (let i = 0; i < 30; i++) {
            const px = ((seed * (i + 1) * 137) % 1000) / 1000 * w;
            const py = ((seed * (i + 1) * 251) % 1000) / 1000 * h * 0.4;
            const twinkle = Math.sin(Date.now() / 500 + i * 2) * 0.5 + 0.5;
            const r = (i % 3 === 0 ? 2 : 1) * twinkle;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawSun(w, hour) {
        const t = (hour - 6) / 12; // 0-1 across day
        const x = w * 0.2 + t * w * 0.6;
        const peakY = 40;
        const y = peakY + Math.abs(t - 0.5) * 80;

        const glow = ctx.createRadialGradient(x, y, 5, x, y, 40);
        glow.addColorStop(0, 'rgba(255, 220, 100, 0.8)');
        glow.addColorStop(0.5, 'rgba(255, 200, 60, 0.2)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffe080';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawMoon(w, hour) {
        const t = hour >= 18 ? (hour - 18) / 12 : (hour + 6) / 12;
        const x = w * 0.3 + t * w * 0.4;
        const y = 50 + Math.abs(t - 0.5) * 60;

        const glow = ctx.createRadialGradient(x, y, 5, x, y, 30);
        glow.addColorStop(0, 'rgba(200, 210, 255, 0.3)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e0e8ff';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        // 月牙
        ctx.fillStyle = '#0a0818';
        ctx.beginPath();
        ctx.arc(x + 4, y - 2, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    // ========== 飼育箱 ==========
    function drawBox(moisture, soilQuality, gameState) {
        const { w, h } = getCanvasSize();
        const boxX = w * 0.08;
        const boxY = h * 0.42;
        const boxW = w * 0.84;
        const boxH = h * 0.48;

        // 遮陰蓋
        if (gameState && gameState.isShaded) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(boxX, boxY - 20, boxW, 18);
            ctx.strokeStyle = '#5a4020';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(boxX, boxY - 2);
            ctx.lineTo(boxX + boxW, boxY - 2);
            ctx.stroke();
            // 遮陰紋理
            ctx.fillStyle = 'rgba(80, 60, 30, 0.4)';
            for (let i = 0; i < 8; i++) {
                ctx.fillRect(boxX + i * (boxW / 8), boxY - 20, boxW / 16, 18);
            }
            ctx.restore();
        }

        // 箱體
        ctx.strokeStyle = '#6a4a20';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(60, 40, 15, 0.6)';
        roundRect(ctx, boxX, boxY, boxW, boxH, 12, true, true);

        // 箱框裝飾線
        ctx.strokeStyle = '#8a6a30';
        ctx.lineWidth = 1;
        roundRect(ctx, boxX + 4, boxY + 4, boxW - 8, boxH - 8, 8, false, true);

        // 土壤
        const soilY = boxY + boxH * 0.25;
        const soilH = boxH * 0.7;

        const soilDark = soilQuality > 50 ? 0.25 : 0.18;
        const moistFactor = moisture / 100;
        const r = Math.floor(60 + soilQuality * 0.4 - moistFactor * 20);
        const g = Math.floor(35 + soilQuality * 0.2 - moistFactor * 10);
        const b = Math.floor(10 + moistFactor * 15);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        roundRect(ctx, boxX + 6, soilY, boxW - 12, soilH - 6, 6, true, false);

        // 土壤紋理
        ctx.fillStyle = `rgba(0, 0, 0, ${0.15 - soilDark * 0.3})`;
        for (let i = 0; i < 20; i++) {
            const sx = boxX + 15 + ((i * 137) % (boxW - 30));
            const sy = soilY + 10 + ((i * 251) % (soilH - 25));
            ctx.beginPath();
            ctx.ellipse(sx, sy, 3 + (i % 4), 1.5, (i * 37) % 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // === 龜裂土壤（濕度 < 20）===
        if (moisture < 20) {
            ctx.save();
            ctx.strokeStyle = `rgba(160, 130, 80, ${0.4 + (20 - moisture) / 40})`;
            ctx.lineWidth = 1.5;
            const crackSeeds = [17, 53, 89, 127, 163, 199, 241, 277, 313];
            for (let i = 0; i < crackSeeds.length; i++) {
                const seed = crackSeeds[i];
                const cx = boxX + 20 + (seed * 3.7) % (boxW - 40);
                const cy = soilY + 8 + (seed * 2.3) % (soilH - 20);
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                // 隨機鋸齒裂紋
                let px = cx, py = cy;
                for (let j = 0; j < 4; j++) {
                    px += ((seed * (j + 1) * 7) % 20) - 10;
                    py += ((seed * (j + 1) * 11) % 12) + 2;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            // 乾裂色調覆蓋
            ctx.fillStyle = `rgba(180, 150, 100, ${(20 - moisture) / 60})`;
            roundRect(ctx, boxX + 6, soilY, boxW - 12, soilH - 6, 6, true, false);
            ctx.restore();
        }

        // === 淹水效果（濕度 > 85）===
        if (moisture > 85) {
            ctx.save();
            const waterLevel = ((moisture - 85) / 15) * (soilH * 0.25);
            const waterY = soilY + soilH - 6 - waterLevel;

            // 水面
            const waterGrad = ctx.createLinearGradient(0, waterY, 0, waterY + waterLevel);
            waterGrad.addColorStop(0, `rgba(80, 140, 200, 0.35)`);
            waterGrad.addColorStop(1, `rgba(60, 110, 170, 0.5)`);
            ctx.fillStyle = waterGrad;
            roundRect(ctx, boxX + 6, waterY, boxW - 12, waterLevel, 4, true, false);

            // 水面波紋
            ctx.strokeStyle = `rgba(160, 200, 255, 0.4)`;
            ctx.lineWidth = 1;
            const t = Date.now() / 800;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                const waveY = waterY + 2 + i * 4;
                for (let x = boxX + 10; x < boxX + boxW - 10; x += 3) {
                    const yOff = Math.sin((x - boxX) / 20 + t + i * 2) * 2;
                    if (x === boxX + 10) ctx.moveTo(x, waveY + yOff);
                    else ctx.lineTo(x, waveY + yOff);
                }
                ctx.stroke();
            }
            ctx.restore();
        }

        // 土壤表面高光
        if (moisture > 60 && moisture <= 85) {
            ctx.fillStyle = `rgba(140, 160, 200, ${(moisture - 60) / 200})`;
            ctx.beginPath();
            ctx.ellipse(boxX + boxW * 0.3, soilY + 5, boxW * 0.15, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 換土動畫
        if (soilChangeAnim > 0) {
            soilChangeAnim -= 16;
            const progress = soilChangeAnim / 500;
            ctx.fillStyle = `rgba(120, 80, 30, ${progress * 0.5})`;
            ctx.fillRect(boxX + 6, soilY, boxW - 12, soilH - 6);
        }

        return { boxX, boxY: soilY - 20, boxW, boxH: soilH + 20 };
    }

    // ========== 粒子系統（噴水） ==========
    function spawnSprayParticles(x, y) {
        for (let i = 0; i < 25; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 60,
                y: y - 20,
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * 2 + 1,
                life: 40 + Math.random() * 30,
                maxLife: 70,
                size: 2 + Math.random() * 3,
                type: 'water'
            });
        }
    }

    function spawnSoilParticles(x, y) {
        soilChangeAnim = 500;
        for (let i = 0; i < 15; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 100,
                y: y,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 3 - 1,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                size: 3 + Math.random() * 4,
                type: 'soil'
            });
        }
    }

    function spawnInteractParticles(x, y) {
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2 - 1,
                life: 25 + Math.random() * 15,
                maxLife: 40,
                size: 3 + Math.random() * 2,
                type: 'sparkle'
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.type === 'water') p.vy += 0.08;
            if (p.type === 'soil') p.vy += 0.12;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        particles.forEach(p => {
            const alpha = p.life / p.maxLife;
            if (p.type === 'water') {
                ctx.fillStyle = `rgba(100, 180, 255, ${alpha * 0.8})`;
            } else if (p.type === 'soil') {
                ctx.fillStyle = `rgba(120, 80, 30, ${alpha * 0.7})`;
            } else {
                ctx.fillStyle = `rgba(255, 220, 100, ${alpha * 0.9})`;
            }
            ctx.beginPath();
            if (p.type === 'sparkle') {
                // 星星形狀
                drawStar(ctx, p.x, p.y, p.size * alpha, 4);
            } else {
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            }
            ctx.fill();
        });
    }

    function drawStar(ctx, cx, cy, r, points) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI / points) * i - Math.PI / 2;
            const dist = i % 2 === 0 ? r : r * 0.4;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }

    // ========== 工具 ==========
    function roundRect(ctx, x, y, w, h, r, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
        ctx.lineTo(x + w, y + h - r);
        ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        ctx.lineTo(x + r, y + h);
        ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        ctx.lineTo(x, y + r);
        ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }

    function lerpColor(a, b, t) {
        const ar = parseInt(a.slice(1, 3), 16);
        const ag = parseInt(a.slice(3, 5), 16);
        const ab = parseInt(a.slice(5, 7), 16);
        const br = parseInt(b.slice(1, 3), 16);
        const bg = parseInt(b.slice(3, 5), 16);
        const bb = parseInt(b.slice(5, 7), 16);
        const rr = Math.round(ar + (br - ar) * t);
        const rg = Math.round(ag + (bg - ag) * t);
        const rb = Math.round(ab + (bb - ab) * t);
        return `rgb(${rr}, ${rg}, ${rb})`;
    }

    // 主渲染幀
    function frame(dt) {
        updateParticles(dt);
    }

    function getCtx() { return ctx; }
    function getCanvas() { return canvas; }

    return {
        init, clear, drawBackground, drawBox, drawParticles, frame,
        spawnSprayParticles, spawnSoilParticles, spawnInteractParticles,
        getCanvasSize, getCtx, getCanvas, resize
    };
})();
