import { validateForPlayer } from "./solver.js";

let problemData = null;
let playerData = null;

let hand = {};
let selectedNumber = null;

let removedSet = new Set();
let fixedSet = new Set();

let mode = "normal";  // "normal" or "memo"
let selectedMemoNumber = null;
let selectedMark = null;

let initialHand = {};
let initialRemoved = [];

let errorCells = new Set();

let history = [];
let historyIndex = -1;


const checkBtn = document.getElementById("checkBtn");
checkBtn.disabled = true;

const boardDiv = document.getElementById("board");
const resultP = document.getElementById("result");

const normalModeBtn = document.getElementById("normalModeBtn");
const memoModeBtn = document.getElementById("memoModeBtn");

const memoNumbersDiv = document.getElementById("memoNumbersRow");
const memoInputDiv = document.getElementById("memoInput");
const circleBtn = document.getElementById("circleBtn");
const crossBtn = document.getElementById("crossBtn");

const handDiv = document.getElementById("hand");

const resetBtn = document.getElementById("resetBtn");


document.getElementById("loadFile").addEventListener("change", loadBoard);
document.getElementById("checkBtn").addEventListener("click", checkBoard);

function loadBoard(event) {

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {

        const loaded = JSON.parse(e.target.result);

        problemData = loaded.solution;
        playerData = JSON.parse(JSON.stringify(problemData));

        // ===== メモ初期化 =====
        for (let y = 0; y < playerData.length; y++) {
            for (let x = 0; x < playerData[y].length; x++) {

                playerData[y][x].memoNumbers = new Set();
                playerData[y][x].mark = null;  // "circle" or "cross"
            }
        }

        hand = { ...loaded.removedCount };
        initialHand = { ...loaded.removedCount };
        initialRemoved = [...(loaded.removed || [])];

        const removed = loaded.removed || [];

        fixedSet = new Set();

        // 固定数字の判定
        for (let y = 0; y < playerData.length; y++) {
            for (let x = 0; x < playerData[y].length; x++) {

                const key = y + "-" + x;

                // 数字があり、removedに含まれていない → 固定
                if (
                    problemData[y][x].value !== null &&
                    !removed.includes(key)
                ) {
                    fixedSet.add(key);
                }
            }
        }

        // removedの場所を空にする
        removed.forEach(key => {
            const [y, x] = key.split("-").map(Number);
            playerData[y][x].value = null;
        });

        selectedNumber = null;

        renderBoard();
        renderHand();
        updateModeUI();
        renderMemoInput();
        checkBtn.disabled = false;
        
        result.textContent = "";
        result.className = "";
        boardDiv.classList.remove("board-clear");
        boardDiv.classList.remove("board-error");

        saveState();
    };

    reader.readAsText(file);

    
}


function renderBoard() {

    boardDiv.innerHTML = "";

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";

    for (let y = 0; y < playerData.length; y++) {

        const row = document.createElement("tr");

        for (let x = 0; x < playerData[y].length; x++) {
            
            const cellData = playerData[y][x];
            const key = y + "-" + x;

            const cell = document.createElement("td");
            cell.style.backgroundColor = "white";
            cell.style.border = "1px solid black";
            cell.style.width = "50px";
            cell.style.height = "50px";
            cell.style.textAlign = "center";
            cell.style.verticalAlign = "middle";
            cell.style.position = "relative";
            cell.style.userSelect = "none";
            cell.style.cursor = "pointer";
            cell.style.fontFamily = "sans-serif";

            // ===== hole =====
            if (cellData.type === "hole") {
                cell.style.backgroundColor = "black";
                row.appendChild(cell);
                continue;
            }

            // ===== chbox =====
            if (cellData.type === "chbox") {
                cell.style.backgroundColor = "yellow";
            } else {
                cell.style.backgroundColor = "white";
            }

            // ===== 表示優先順位 =====
            // 1️⃣ 本配置
            if (cellData.value !== null) {

                cell.textContent = cellData.value;
                cell.style.fontSize = "22px";

                if (fixedSet.has(key)) {
                    cell.style.color = "black";
                    cell.style.fontWeight = "bold";
                } else {
                    cell.style.color = "#1976d2";
                    cell.style.fontWeight = "bold";
                }
            }

            // 2️⃣ ○×
            else if (cellData.mark !== null) {

                cell.textContent = cellData.mark === "circle" ? "○" : "×";
                cell.style.fontSize = "28px";
                cell.style.color = "#9e9e9e";   // 灰色
            }

            // 3️⃣ 数字メモ
            else if (cellData.memoNumbers.size > 0) {

                const memoDiv = document.createElement("div");
                memoDiv.style.display = "grid";
                memoDiv.style.gridTemplateColumns = "repeat(3, 1fr)";
                memoDiv.style.gridTemplateRows = "repeat(3, 1fr)";
                memoDiv.style.width = "100%";
                memoDiv.style.height = "100%";
                memoDiv.style.fontSize = "10px";
                memoDiv.style.color = "#9e9e9e";

                for (let i = 1; i <= 9; i++) {

                    const small = document.createElement("div");
                    small.style.display = "flex";
                    small.style.alignItems = "center";
                    small.style.justifyContent = "center";

                    if (cellData.memoNumbers.has(i)) {
                        small.textContent = i;
                    }

                    memoDiv.appendChild(small);
                }

                cell.appendChild(memoDiv);
            }

            // ===== クリック処理 =====
            cell.onclick = function() {

                // 盤面操作があったらエラー表示を全部消す
                errorCells.clear();

                if (fixedSet.has(key)) {
                    renderBoard();
                    return;
                }


                // ===== メモモード =====
                if (mode === "memo") {

                    if (cellData.value !== null) return;

                    // ○×入力
                    if (selectedMark !== null) {

                        if (cellData.mark === selectedMark) {
                            cellData.mark = null;  // 同じなら解除
                        } else {
                            cellData.mark = selectedMark;
                            cellData.memoNumbers.clear();
                        }

                        saveState();

                        renderBoard();
                        return;
                    }

                    // 数字メモ入力
                    if (selectedMemoNumber !== null) {

                        if (cellData.memoNumbers.has(selectedMemoNumber)) {
                            cellData.memoNumbers.delete(selectedMemoNumber);
                        } else {
                            cellData.memoNumbers.add(selectedMemoNumber);
                        }

                        cellData.mark = null;

                        saveState();

                        renderBoard();
                        return;
                    }

                    return;
                }

                // ===== 通常モード =====
                if (mode === "normal") {

                    if (cellData.value !== null) {

                        const val = cellData.value;
                        if (hand[val] !== undefined) hand[val]++;

                        cellData.value = null;

                        saveState();

                        renderBoard();
                        renderHand();
                        return;
                    }

                    if (selectedNumber === null) return;
                    if (!hand[selectedNumber] || hand[selectedNumber] <= 0) return;

                    cellData.value = selectedNumber;
                    cellData.memoNumbers.clear();
                    cellData.mark = null;

                    hand[selectedNumber]--;

                    saveState();

                    renderBoard();
                    renderHand();
                }
            };

            if (errorCells.has(key)) {

                const frame = document.createElement("div");
                frame.style.position = "absolute";
                frame.style.top = "0";
                frame.style.left = "0";
                frame.style.width = "100%";
                frame.style.height = "100%";
                frame.style.border = "3px solid red";
                frame.style.boxSizing = "border-box";
                frame.style.pointerEvents = "none";

                cell.appendChild(frame);
            }

            row.appendChild(cell);

        }

        table.appendChild(row);
    }

    boardDiv.appendChild(table);

    document.getElementById("undoBtn").disabled = (historyIndex <= 0);
    document.getElementById("redoBtn").disabled = (historyIndex >= history.length - 1);
}


function checkBoard() {

    resultP.classList.remove("result-clear", "result-error");

    // ===== データ未ロード対策 =====
    if (!playerData || !problemData) {
        resultP.textContent = "問題データを読み込んでください";
        resultP.classList.add("result-error");
        return;
    }

    errorCells.clear();

    const result = validateForPlayer(playerData);

    if (result.errors) {
        result.errors.forEach(e => {
            if (e.y !== undefined && e.x !== undefined) {
                errorCells.add(e.y + "-" + e.x);
            }
        });
    }

    const allUsed = Object.values(hand).every(count => count === 0);
    if (result.isValid && allUsed) {

        resultP.textContent = "クリア！";
        resultP.classList.add("result-clear");

        boardDiv.classList.add("board-clear");
        boardDiv.classList.remove("board-error");

    } else {

        if (!result.isValid) {
            resultP.textContent = "エラーあり";
            resultP.classList.add("result-error");

            boardDiv.classList.add("board-error");
            boardDiv.classList.remove("board-clear");
        } 
        else if (!allUsed) {
            resultP.textContent = "手札をすべて使い切ってください";
            resultP.classList.add("result-error");

            boardDiv.classList.add("board-error");
            boardDiv.classList.remove("board-clear");
        }
    }
    renderBoard();
}


function renderHand() {

    const handDiv = document.getElementById("hand");
    handDiv.innerHTML = "";

    const keys = Object.keys(hand);

    if (keys.length === 0) {
        handDiv.textContent = "手札：なし";
        return;
    }

    keys.sort((a, b) => Number(a) - Number(b));

    const label = document.createElement("div");
    label.textContent = "手札";
    label.style.marginBottom = "5px";
    label.style.fontWeight = "bold";
    handDiv.appendChild(label);

    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.gap = "8px";
    container.style.flexWrap = "wrap";

    keys.forEach(num => {

        const count = hand[num];

        const tile = document.createElement("div");
        tile.style.position = "relative";
        tile.style.width = "40px";
        tile.style.height = "40px";
        tile.style.border = "2px solid black";
        tile.style.display = "flex";
        tile.style.alignItems = "center";
        tile.style.justifyContent = "center";
        tile.style.fontWeight = "bold";
        tile.style.fontSize = "18px";
        tile.style.borderRadius = "6px";

        tile.textContent = num;

        // ===== 残数ゼロ処理 =====
        if (count <= 0) {
            tile.style.backgroundColor = "#e0e0e0";
            tile.style.color = "#9e9e9e";
            tile.style.cursor = "default";
            tile.style.border = "2px solid #bdbdbd"; // ← 薄い枠線
            tile.style.opacity = "0.6";
        } else {
            tile.style.backgroundColor = "#f5f5f5";
            tile.style.cursor = "pointer";
            tile.style.border = "2px solid black";

            tile.onclick = () => {
                selectedNumber = parseInt(num);
                renderHand();
            };
        }

        // ===== 選択中ハイライト =====
        if (selectedNumber == num && count > 0) {
            tile.style.backgroundColor = "#90caf9";
        }

        // ===== バッジ =====
        const badge = document.createElement("div");
        badge.textContent = count;
        badge.style.position = "absolute";
        badge.style.bottom = "-6px";
        badge.style.right = "-6px";
        badge.style.borderRadius = "50%";
        badge.style.width = "20px";
        badge.style.height = "20px";
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.fontSize = "12px";
        badge.style.color = "white";

        if (count <= 0) {
            badge.style.backgroundColor = "#9e9e9e"; // 灰色
        } else {
            badge.style.backgroundColor = "#e53935"; // 赤
        }

        tile.appendChild(badge);
        container.appendChild(tile);
    });

    handDiv.appendChild(container);
}


normalModeBtn.onclick = () => {
    mode = "normal";
    updateModeUI();
};

memoModeBtn.onclick = () => {
    mode = "memo";
    updateModeUI();
};

function renderMemoInput() {

    memoNumbersDiv.innerHTML = "";

    for (let i = 1; i <= 8; i++) {

        const btn = document.createElement("button");
        btn.textContent = i;
        btn.style.padding = "4px 8px";

        if (selectedMemoNumber === i) {
            btn.style.backgroundColor = "#f8bbd0";
            btn.style.fontWeight = "bold";
        }

        btn.onclick = () => {
            selectedMemoNumber = i;
            selectedMark = null;
            renderMemoInput();   // ← 再描画でハイライト更新
        };

        memoNumbersDiv.appendChild(btn);
    }

    // ○ボタン
    circleBtn.style.backgroundColor =
        selectedMark === "circle" ? "#f8bbd0" : "";

    // ×ボタン
    crossBtn.style.backgroundColor =
        selectedMark === "cross" ? "#f8bbd0" : "";
}


circleBtn.onclick = () => {
    if (selectedMark === "circle") {
        selectedMark = null;
    } else {
        selectedMark = "circle";
        selectedMemoNumber = null;
    }
    renderMemoInput();
};

crossBtn.onclick = () => {
    if (selectedMark === "cross") {
        selectedMark = null;
    } else {
        selectedMark = "cross";
        selectedMemoNumber = null;
    }
    renderMemoInput();
};


function updateModeUI() {

    normalModeBtn.classList.remove("active-normal");
    memoModeBtn.classList.remove("active-memo");

    if (mode === "normal") {

        normalModeBtn.classList.add("active-normal");
        memoInputDiv.style.display = "none";

        handDiv.classList.remove("hand-dimmed");   // ← 追加

    } else {

        memoModeBtn.classList.add("active-memo");
        memoInputDiv.style.display = "block";

        selectedNumber = null;
        renderHand();

        handDiv.classList.add("hand-dimmed");      // ← 追加
    }
}


resetBtn.onclick = () => {

    if (!problemData) return;

    if (!confirm("盤面をリセットしますか？")) {
        return;
    }

    // ここから既存処理
    playerData = JSON.parse(JSON.stringify(problemData));

    for (let y = 0; y < playerData.length; y++) {
        for (let x = 0; x < playerData[y].length; x++) {
            playerData[y][x].memoNumbers = new Set();
            playerData[y][x].mark = null;
        }
    }

    initialRemoved.forEach(key => {
        const [y, x] = key.split("-").map(Number);
        playerData[y][x].value = null;
    });

    hand = { ...initialHand };

    selectedNumber = null;
    selectedMemoNumber = null;
    selectedMark = null;

    renderBoard();
    renderHand();
    renderMemoInput();

    resultP.textContent = "";

    errorCells.clear();

    history = [];
    historyIndex = -1;

    saveState();
};


function saveState() {

    history = history.slice(0, historyIndex + 1);

    history.push({
        board: structuredClone(playerData),
        hand: structuredClone(hand)
    });

    historyIndex++;
}


function undoMove() {

    if (historyIndex <= 0) return;

    historyIndex--;

    const state = history[historyIndex];

    playerData = structuredClone(state.board);
    hand = structuredClone(state.hand);

    errorCells.clear();

    renderBoard();
    renderHand();
}


function redoMove() {

    if (historyIndex >= history.length - 1) return;

    historyIndex++;

    const state = history[historyIndex];

    playerData = structuredClone(state.board);
    hand = structuredClone(state.hand);

    errorCells.clear();

    renderBoard();
    renderHand();
}


document.getElementById("undoBtn").onclick = undoMove;
document.getElementById("redoBtn").onclick = redoMove;


function restoreState(state) {

    playerData = state.board;
    hand = state.hand;

    for (let y = 0; y < playerData.length; y++) {
        for (let x = 0; x < playerData[y].length; x++) {

            const cell = playerData[y][x];

            // memoNumbers が壊れている場合の復元
            if (cell.memoNumbers instanceof Set) {
                continue;
            }

            if (Array.isArray(cell.memoNumbers)) {
                cell.memoNumbers = new Set(cell.memoNumbers);
            } else {
                cell.memoNumbers = new Set();
            }
        }
    }

    renderBoard();
    renderHand();
}


document.addEventListener("keydown", (e) => {

    if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undoMove();
    }

    if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redoMove();
    }

});
