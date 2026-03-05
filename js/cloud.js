/* ============================================
   cloud.js — Google Sheets 飼養紀錄
   儲存/讀取紀錄
   ============================================ */

const Cloud = (() => {
    // ⚠️ 部署 GAS 後，將網址貼到這裡
    let ENDPOINT = '';
    let playerName = '';

    function init() {
        // 從 localStorage 讀取設定
        ENDPOINT = localStorage.getItem('kabuto_endpoint') || '';
        playerName = localStorage.getItem('kabuto_player') || '';
    }

    function isConfigured() {
        return ENDPOINT.length > 0;
    }

    function getPlayerName() {
        return playerName;
    }

    function setConfig(endpoint, name) {
        ENDPOINT = endpoint;
        playerName = name;
        localStorage.setItem('kabuto_endpoint', endpoint);
        localStorage.setItem('kabuto_player', name);
    }

    async function saveRecord(gameState, endType) {
        if (!isConfigured()) return { status: 'skip', message: '未設定 Google Sheets' };

        const score = Game.calcScore();
        const { rank } = Game.getRank(score);
        const stage = Beetle.getStage(gameState.numLevel);

        const record = {
            playerName: playerName || '匿名飼育員',
            day: gameState.numDay,
            stage: stage.name,
            size: Math.floor(gameState.numSize),
            power: Math.floor(gameState.numPower),
            score: score,
            rank: rank,
            endType: endType,
            photos: Diary.getCount(),
            interactions: gameState.interactCount,
            detail: {
                moisture: Math.floor(gameState.moisture),
                soilQuality: Math.floor(gameState.soilQuality),
                totalGrowth: Math.floor(gameState.totalGrowth),
                feedCount: gameState.feedCount || 0,
            }
        };

        try {
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'SAVE_RECORD', record }),
            });
            const result = await response.json();
            return result;
        } catch (err) {
            console.error('Cloud save error:', err);
            return { status: 'error', message: err.message };
        }
    }

    async function getRecords() {
        if (!isConfigured()) return [];

        try {
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'GET_RECORDS' }),
            });
            const result = await response.json();
            return result.records || [];
        } catch (err) {
            console.error('Cloud load error:', err);
            return [];
        }
    }

    return { init, isConfigured, getPlayerName, setConfig, saveRecord, getRecords };
})();
