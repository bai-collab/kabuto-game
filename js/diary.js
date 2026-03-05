/* ============================================
   diary.js — 日記系統
   拍照、記錄、回顧
   ============================================ */

const Diary = (() => {
    const MAX_PHOTOS = 6;
    let entries = [];

    function init() {
        entries = [];
    }

    function canTakePhoto() {
        return entries.length < MAX_PHOTOS;
    }

    function getCount() {
        return entries.length;
    }

    function takePhoto(canvas, gameState, stage) {
        if (!canTakePhoto()) return false;

        // 截圖
        const dataURL = canvas.toDataURL('image/png');

        entries.push({
            photo: dataURL,
            day: gameState.numDay,
            hour: gameState.numHour,
            level: gameState.numLevel,
            stage: stage.name,
            stageEmoji: stage.emoji,
            power: Math.floor(gameState.numPower),
            size: Math.floor(gameState.numSize),
            timestamp: Date.now()
        });

        return true;
    }

    function getEntries() {
        return entries;
    }

    function renderDiaryPanel() {
        const container = document.getElementById('diary-entries');
        container.innerHTML = '';

        if (entries.length === 0) {
            container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#9a8d7a;padding:40px;">尚未拍攝任何照片<br>按下 📷 記錄成長瞬間吧！</p>';
            return;
        }

        entries.forEach((entry, i) => {
            const div = document.createElement('div');
            div.className = 'diary-entry';
            div.innerHTML = `
        <img src="${entry.photo}" alt="Day ${entry.day}">
        <div class="diary-info">
          <span class="diary-stage">${entry.stageEmoji} ${entry.stage}</span>
          第 ${entry.day} 天 ${String(entry.hour).padStart(2, '0')}:00<br>
          💪${entry.power} 📏${entry.size}
        </div>
      `;
            container.appendChild(div);
        });
    }

    return { init, canTakePhoto, getCount, takePhoto, getEntries, renderDiaryPanel };
})();
