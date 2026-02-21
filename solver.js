// solver.js
export function validateBoard(boardData) {

    let errors = [];
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [ 0, -1],           [ 0, 1],
        [ 1, -1], [ 1, 0],  [ 1, 1]
    ];

    const height = boardData.length;
    const width = boardData[0].length;

    // --- 基本チェック（既存の内容） ---
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {

            const cell = boardData[y][x];
            const row = y + 1;
            const col = x + 1;

            if (cell.type === "number" && cell.value === null)
                errors.push({ message:`(${row},${col}) number なのに value が null`, y, x });

            if (cell.type === "chbox" && cell.value === null)
                errors.push({ message:`(${row},${col}) chbox に value が入っていない`, y, x });

            if (cell.type === "hole" && cell.value !== null)
                errors.push({ message:`(${row},${col}) hole に value がある`, y, x });

            if (cell.type === "empty" && cell.value !== null)
                errors.push({ message:`(${row},${col}) empty に value がある`, y, x });

            if (cell.value !== null) {

                let count = 0;

                for (let d of directions) {
                    const ny = y + d[0];
                    const nx = x + d[1];

                    if (ny>=0 && ny<height && nx>=0 && nx<width) {

                        const neighbor = boardData[ny][nx];

                        if (neighbor.value !== null) {

                            count++;

                            // 同じ数字が隣接している場合のエラー
                            if (neighbor.value === cell.value)
                                errors.push({ message:`(${row},${col}) 同じ数字`, y, x });
                        }
                    }
                }

                // 接続数不一致
                if (cell.value !== count)
                    errors.push({ message:`(${row},${col}) 接続数不一致`, y, x });
            }
        }
    }

    // --- 追加チェック 1: すべての数字が1つのまとまりになっているか ---
    // 0は例外として独立を許可したい場合は、value === 0 を除外する。
    // 以下では、value !== null && value !== 0 を「対象数字」とする。

    // 1) 非0数字を数える
    let totalTarget = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = boardData[y][x];
            if (cell.value !== null && cell.value !== 0) {
                totalTarget++;
            }
        }
    }

    // 2) まず対象数字のうち最初の1つを探索の起点にする
    let start = null;
    outer:
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = boardData[y][x];
            if (cell.value !== null && cell.value !== 0) {
                start = [y, x];
                break outer;
            }
        }
    }

    if (start !== null) {
        // 3) DFS/BFSで到達可能な対象数字を数える
        const stack = [start];
        const visited = new Set(); // "y-x" string
        let reached = 0;

        while (stack.length > 0) {
            const [cy, cx] = stack.pop();
            const key = cy + "-" + cx;
            if (visited.has(key)) continue;
            visited.add(key);

            const cell = boardData[cy][cx];
            // 対象数字であればカウント
            if (cell.value !== null && cell.value !== 0) {
                reached++;
            }

            // 8方向に探索
            for (let d of directions) {
                const ny = cy + d[0];
                const nx = cx + d[1];

                if (ny>=0 && ny<height && nx>=0 && nx<width) {
                    const neighbor = boardData[ny][nx];
                    // 隣接に数字があるなら探索を続行
                    if (neighbor.value !== null && neighbor.value !== 0) {
                        const nkey = ny + "-" + nx;
                        if (!visited.has(nkey)) {
                            stack.push([ny, nx]);
                        }
                    }
                }
            }
        }

        // 4) もし reached != totalTarget なら、塊が分かれている
        if (reached !== totalTarget) {
            errors.push({
                message: "すべての非0数字が1つのまとまりになっていません",
                y: start[0],
                x: start[1]
            });
        }
    }

    // --- 追加チェック 2: chbox と接続していない数字があるか ---
    // 目的は「chbox を介さず孤立している数字がある」場合にエラーを出す、というもの。
    // 以下の考え方（以前の議論に近い）：
    // chbox を含む構造全体を探索して、その構造の外にある数字が存在したらNG。
    // ただし 0 は例外で独立許可。ここでも value !== null && value !== 0 が対象。

    // 1) chbox の場所を全部列挙
    const chboxPositions = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = boardData[y][x];
            if (cell.type === "chbox") {
                chboxPositions.push([y, x]);
            }
        }
    }

    if (chboxPositions.length > 0) {
        // 2) chbox を起点としてDFS/BFSし、到達できる非0数字を記録
        const visited2 = new Set();
        const stack2 = [...chboxPositions];
        while (stack2.length > 0) {
            const [cy, cx] = stack2.pop();
            const key = cy + "-" + cx;
            if (visited2.has(key)) continue;
            visited2.add(key);

            const cell = boardData[cy][cx];
            // chbox 自身は対象外かもしれませんが、value !== null && value !== 0 なら含む
            // ここでは数字があれば到達対象としてカウント補助に。
            // ただし、chbox の value は数字必須でありそれも含むことになる。
            // 0を除くかどうかはルール次第。ここでは value !== null && value !== 0 を対象とした。
            // if (cell.value !== null && cell.value !== 0) { /* we may count or mark */ }

            // 8方向探索
            for (let d of directions) {
                const ny = cy + d[0];
                const nx = cx + d[1];
                if (ny>=0 && ny<height && nx>=0 && nx<width) {
                    const neighbor = boardData[ny][nx];
                    if (neighbor.value !== null) {
                        // 数字ありなら到達可能
                        const nkey = ny + "-" + nx;
                        if (!visited2.has(nkey)) {
                            stack2.push([ny, nx]);
                        }
                    }
                }
            }
        }

        // 3) 非0数字で visited2 に含まれないものがあればエラー
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = boardData[y][x];
                if (cell.value !== null && cell.value !== 0) {
                    const key = y + "-" + x;
                    if (!visited2.has(key)) {
                        // この数字はどの chbox 構造からも離れている
                        const row = y + 1;
                        const col = x + 1;
                        errors.push({
                            message: `(${row},${col}) chbox とつながっていない数字`,
                            y, x
                        });
                    }
                }
            }
        }
    } else {
        // chboxが一つも無い場合のルールがあるならここで扱う。
        // 例えば、chboxなしの場合は単純に塊チェックだけでOK、というなら何もしない。
        // もし chboxなしで独立多発OKなら何もしない。
        // 必要ならルールに従って条件を追加。
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}


function validateConstraints(boardData) {

    let errors = [];

    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [ 0, -1],           [ 0, 1],
        [ 1, -1], [ 1, 0],  [ 1, 1]
    ];

    const height = boardData.length;
    const width = boardData[0].length;

    // ===== 数字ルールチェック =====

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {

            const cell = boardData[y][x];

            if (cell.value === null) continue;

            let count = 0;

            for (let d of directions) {

                const ny = y + d[0];
                const nx = x + d[1];

                if (ny>=0 && ny<height && nx>=0 && nx<width) {

                    const neighbor = boardData[ny][nx];

                    if (neighbor.value !== null) {

                        count++;

                        // 同じ数字禁止
                        if (neighbor.value === cell.value) {
                            errors.push({ y, x });
                        }
                    }
                }
            }

            // 接続数一致
            if (cell.value !== count) {
                errors.push({ y, x });
            }
        }
    }

    // ===== chbox連結チェック =====

    let totalChbox = 0;
    let totalNumberCells = 0;
    let start = null;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {

            const cell = boardData[y][x];

            if (cell.type === "chbox") {
                totalChbox++;
                if (!start) start = [y, x];
            }

           if (cell.value !== null && cell.value !== 0) {
                totalNumberCells++;
            }
        }
    }

    if (totalChbox > 0) {

        let visited = Array.from({ length: height }, () =>
            Array(width).fill(false)
        );

        let stack = [start];
        let reachedChbox = 0;
        let reachedNumbers = 0;

        while (stack.length > 0) {

            const [cy, cx] = stack.pop();

            if (visited[cy][cx]) continue;
            visited[cy][cx] = true;

            const cell = boardData[cy][cx];

            if (cell.value === null && cell.type !== "chbox") continue;

            if (cell.type === "chbox") reachedChbox++;
            if (cell.value !== null && cell.value !== 0) {
                reachedNumbers++;
            }

            for (let d of directions) {

                const ny = cy + d[0];
                const nx = cx + d[1];

                if (ny>=0 && ny<height && nx>=0 && nx<width) {
                    if (!visited[ny][nx]) {
                        stack.push([ny, nx]);
                    }
                }
            }
        }

        if (reachedChbox !== totalChbox) {
            errors.push({ message: "chboxが分断" });
        }

        if (reachedNumbers !== totalNumberCells) {
            errors.push({ message: "chboxに属さない数字あり" });
        }
    }

    return errors;
}


export function validateForPlayer(boardData) {
    const errors = validateConstraints(boardData);

    return {
        isValid: errors.length === 0,
        errors
    };
}