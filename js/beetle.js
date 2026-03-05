/* ============================================
   beetle.js — 獨角仙狀態與外觀
   7 個成長階段的狀態機與繪製
   ============================================ */

const Beetle = (() => {
    const STAGES = [
        { id: 0, name: '卵', emoji: '🥚', nameJP: 'たまご' },
        { id: 1, name: '一齡幼蟲', emoji: '🐛', nameJP: '1れいようちゅう' },
        { id: 2, name: '二齡幼蟲', emoji: '🐛', nameJP: '2れいようちゅう' },
        { id: 3, name: '三齡幼蟲', emoji: '🐛', nameJP: '3れいようちゅう' },
        { id: 4, name: '蛹', emoji: '🫘', nameJP: 'さなぎ' },
        { id: 5, name: '羽化', emoji: '🦋', nameJP: 'うか' },
        { id: 6, name: '成蟲', emoji: '🪲', nameJP: 'せいちゅう' },
    ];

    let animFrame = 0;
    let animTimer = 0;
    let wiggle = 0;
    let pokeAnim = 0; // 互動動畫計時器
    let pokeDir = 1;

    function getStage(level) {
        return STAGES[Math.min(level - 1, 6)];
    }

    function update(dt) {
        animTimer += dt;
        if (animTimer > 150) {
            animFrame = (animFrame + 1) % 4;
            animTimer = 0;
        }
        wiggle = Math.sin(Date.now() / 500) * 3;

        if (pokeAnim > 0) {
            pokeAnim -= dt;
        }
    }

    function triggerPoke() {
        pokeAnim = 600;
        pokeDir = Math.random() > 0.5 ? 1 : -1;
    }

    /**
     * Draw the beetle on canvas at given center position
     */
    function draw(ctx, cx, cy, level, size) {
        ctx.save();
        const scale = 0.8 + (size / 100) * 0.7;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);

        // 互動搖晃
        if (pokeAnim > 0) {
            const shake = Math.sin(pokeAnim / 50) * 8 * pokeDir;
            ctx.rotate(shake * Math.PI / 180);
            ctx.translate(shake * 0.5, -Math.abs(shake) * 0.3);
        }

        switch (level) {
            case 1: drawEgg(ctx); break;
            case 2: drawLarva(ctx, 0.6); break;
            case 3: drawLarva(ctx, 0.8); break;
            case 4: drawLarva(ctx, 1.0); break;
            case 5: drawPupa(ctx); break;
            case 6: drawEmerge(ctx); break;
            case 7: drawAdult(ctx); break;
            default: drawEgg(ctx);
        }

        ctx.restore();
    }

    function drawEgg(ctx) {
        // 橢圓形的卵
        ctx.save();
        ctx.translate(0, wiggle * 0.3);

        // 卵影子
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(2, 22, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 卵本體
        const grad = ctx.createRadialGradient(-4, -6, 2, 0, 0, 20);
        grad.addColorStop(0, '#fff8e0');
        grad.addColorStop(0.5, '#f0e0a0');
        grad.addColorStop(1, '#c8a850');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(-4, -6, 5, 7, -0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawLarva(ctx, sizeMultiplier) {
        ctx.save();
        const s = sizeMultiplier;
        const bodyY = wiggle;

        // 影子
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 30 * s, 25 * s, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // C 字型身體 — 多段圓組成
        const segments = [
            { x: -15 * s, y: 20 * s + bodyY, r: 12 * s },
            { x: -8 * s, y: 8 * s + bodyY, r: 13 * s },
            { x: 0, y: -2 * s + bodyY, r: 14 * s },
            { x: 8 * s, y: -10 * s + bodyY, r: 13 * s },
            { x: 14 * s, y: -18 * s + bodyY, r: 11 * s },
        ];

        // 身體各節
        segments.forEach((seg, i) => {
            const grad = ctx.createRadialGradient(seg.x - 2, seg.y - 2, 1, seg.x, seg.y, seg.r);
            grad.addColorStop(0, '#fff8e8');
            grad.addColorStop(0.6, '#f0e0b0');
            grad.addColorStop(1, '#d0b870');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(seg.x, seg.y, seg.r, 0, Math.PI * 2);
            ctx.fill();

            // 節紋
            if (i > 0 && i < segments.length - 1) {
                ctx.strokeStyle = 'rgba(180, 150, 80, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(seg.x, seg.y, seg.r * 0.8, -0.5, 0.5);
                ctx.stroke();
            }
        });

        // 頭部 (最後一節，棕色)
        const head = segments[segments.length - 1];
        const headGrad = ctx.createRadialGradient(head.x - 2, head.y - 2, 1, head.x, head.y, head.r);
        headGrad.addColorStop(0, '#c0883a');
        headGrad.addColorStop(1, '#8a5520');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(head.x, head.y, head.r * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // 小眼睛
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath();
        ctx.arc(head.x + 4 * s, head.y - 3 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(head.x + 4 * s, head.y + 3 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();

        // 眼睛高光
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(head.x + 4.5 * s, head.y - 3.5 * s, 0.8 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(head.x + 4.5 * s, head.y + 2.5 * s, 0.8 * s, 0, Math.PI * 2);
        ctx.fill();

        // 小腳
        ctx.strokeStyle = '#b08040';
        ctx.lineWidth = 1.5 * s;
        for (let i = 0; i < 3; i++) {
            const seg = segments[i + 1];
            // 左
            ctx.beginPath();
            ctx.moveTo(seg.x - seg.r * 0.7, seg.y);
            ctx.lineTo(seg.x - seg.r * 1.3, seg.y + 5 * s);
            ctx.stroke();
            // 右
            ctx.beginPath();
            ctx.moveTo(seg.x + seg.r * 0.7, seg.y);
            ctx.lineTo(seg.x + seg.r * 1.3, seg.y + 5 * s);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawPupa(ctx) {
        ctx.save();
        ctx.translate(0, wiggle * 0.2);

        // 影子
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(2, 35, 22, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 蛹本體 — 橢圓形
        const grad = ctx.createRadialGradient(-5, -8, 3, 0, 0, 30);
        grad.addColorStop(0, '#c09040');
        grad.addColorStop(0.6, '#906828');
        grad.addColorStop(1, '#604018');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 32, 0, 0, Math.PI * 2);
        ctx.fill();

        // 節紋
        ctx.strokeStyle = 'rgba(60, 30, 10, 0.4)';
        ctx.lineWidth = 1.5;
        for (let i = -2; i <= 3; i++) {
            ctx.beginPath();
            const y = i * 8;
            ctx.ellipse(0, y, 18, 3, 0, 0, Math.PI);
            ctx.stroke();
        }

        // 翅膀輪廓（透過蛹殼若隱若現）
        ctx.strokeStyle = 'rgba(100, 70, 30, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-5, -15);
        ctx.quadraticCurveTo(-15, 5, -8, 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(5, -15);
        ctx.quadraticCurveTo(15, 5, 8, 20);
        ctx.stroke();

        // 高光
        ctx.fillStyle = 'rgba(255,255,200,0.15)';
        ctx.beginPath();
        ctx.ellipse(-6, -10, 6, 14, -0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawEmerge(ctx) {
        ctx.save();
        const t = (Date.now() / 1000) % 6.28;

        // 蛹殼（裂開）
        ctx.translate(0, 10);
        ctx.fillStyle = '#604018';
        ctx.beginPath();
        ctx.ellipse(-12, 15, 14, 20, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // 裂痕
        ctx.strokeStyle = '#302008';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, -5);
        ctx.lineTo(-8, 5);
        ctx.lineTo(-14, 15);
        ctx.lineTo(-10, 25);
        ctx.stroke();

        // 新成蟲（正在爬出）
        ctx.translate(8, -15 + Math.sin(t) * 2);

        // 身體
        const bodyGrad = ctx.createRadialGradient(-2, -3, 2, 0, 0, 18);
        bodyGrad.addColorStop(0, '#5a3a1a');
        bodyGrad.addColorStop(1, '#2a1a08');
        ctx.fillStyle = bodyGrad;

        // 前翅（未完全展開）
        ctx.beginPath();
        ctx.ellipse(-6, 5, 10, 16, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(6, 5, 10, 16, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // 頭
        const headGrad = ctx.createRadialGradient(0, -16, 2, 0, -14, 10);
        headGrad.addColorStop(0, '#4a2a10');
        headGrad.addColorStop(1, '#2a1508');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(0, -14, 8, 0, Math.PI * 2);
        ctx.fill();

        // 角（小）
        ctx.strokeStyle = '#3a2010';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.quadraticCurveTo(2, -30, 5, -34);
        ctx.stroke();

        // 眼
        ctx.fillStyle = '#c0a060';
        ctx.beginPath();
        ctx.arc(-4, -16, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, -16, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawAdult(ctx) {
        ctx.save();
        const breathe = Math.sin(Date.now() / 800) * 1.5;
        ctx.translate(0, breathe);

        // 影子
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(2, 35, 28, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // 腿
        ctx.strokeStyle = '#2a1508';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const legAngle = Math.sin(Date.now() / 300) * 0.1;
        // 左腿組
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const y = -5 + i * 12;
            ctx.moveTo(-12, y);
            ctx.lineTo(-25 - i * 2, y + 12 + Math.sin(Date.now() / 400 + i) * 2);
            ctx.lineTo(-30 - i * 2, y + 20);
            ctx.stroke();
        }
        // 右腿組
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const y = -5 + i * 12;
            ctx.moveTo(12, y);
            ctx.lineTo(25 + i * 2, y + 12 + Math.sin(Date.now() / 400 + i + 1) * 2);
            ctx.lineTo(30 + i * 2, y + 20);
            ctx.stroke();
        }

        // 後翅微露
        ctx.fillStyle = 'rgba(180, 140, 60, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-8, 8, 18, 22, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(8, 8, 18, 22, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // 前翅（鞘翅）
        const wingGrad1 = ctx.createLinearGradient(-16, -10, 16, 25);
        wingGrad1.addColorStop(0, '#5a3a1a');
        wingGrad1.addColorStop(0.5, '#4a2a10');
        wingGrad1.addColorStop(1, '#3a1a08');
        ctx.fillStyle = wingGrad1;

        // 左鞘翅
        ctx.beginPath();
        ctx.moveTo(-1, -12);
        ctx.quadraticCurveTo(-20, -8, -18, 15);
        ctx.quadraticCurveTo(-16, 28, -2, 30);
        ctx.lineTo(-1, -12);
        ctx.fill();

        // 右鞘翅
        ctx.beginPath();
        ctx.moveTo(1, -12);
        ctx.quadraticCurveTo(20, -8, 18, 15);
        ctx.quadraticCurveTo(16, 28, 2, 30);
        ctx.lineTo(1, -12);
        ctx.fill();

        // 鞘翅紋路
        ctx.strokeStyle = 'rgba(80, 50, 20, 0.5)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 28);
        ctx.stroke();

        // 鞘翅光澤
        ctx.fillStyle = 'rgba(255, 240, 180, 0.08)';
        ctx.beginPath();
        ctx.ellipse(-7, 2, 6, 16, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(7, 2, 6, 16, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // 前胸背板
        const thoraxGrad = ctx.createRadialGradient(0, -16, 2, 0, -14, 12);
        thoraxGrad.addColorStop(0, '#5a3a1a');
        thoraxGrad.addColorStop(1, '#3a1a08');
        ctx.fillStyle = thoraxGrad;
        ctx.beginPath();
        ctx.ellipse(0, -14, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // 頭部
        const headGrad = ctx.createRadialGradient(-1, -24, 2, 0, -22, 8);
        headGrad.addColorStop(0, '#4a2a10');
        headGrad.addColorStop(1, '#2a1508');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(0, -22, 7, 0, Math.PI * 2);
        ctx.fill();

        // 角！🦽
        ctx.strokeStyle = '#3a1a08';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.quadraticCurveTo(-2, -38, 0, -44);
        ctx.quadraticCurveTo(4, -50, 8, -52);
        ctx.stroke();

        // 角的分叉
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(1, -38);
        ctx.quadraticCurveTo(-4, -42, -6, -44);
        ctx.stroke();

        // 小角（前方）
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-3, -26);
        ctx.quadraticCurveTo(-6, -32, -4, -36);
        ctx.stroke();

        // 眼睛
        ctx.fillStyle = '#c09040';
        ctx.beginPath();
        ctx.arc(-4, -23, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, -23, 2, 0, Math.PI * 2);
        ctx.fill();

        // 眼睛高光
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-3.5, -23.5, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4.5, -23.5, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // 觸角
        ctx.strokeStyle = '#3a1a08';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-5, -26);
        ctx.quadraticCurveTo(-10, -30, -12, -28);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(5, -26);
        ctx.quadraticCurveTo(10, -30, 12, -28);
        ctx.stroke();

        ctx.restore();
    }

    function getHitBox(cx, cy, level, size) {
        const scale = 0.8 + (size / 100) * 0.7;
        const r = (level <= 1 ? 18 : level <= 4 ? 25 : 35) * scale;
        return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    }

    return { getStage, update, draw, triggerPoke, getHitBox, STAGES };
})();
