// ★ここにRenderで発行されたURLを設定してください（末尾の / は不要）
const API_BASE_URL = "https://svocm-api.onrender.com";

let currentMode = "english";

// DOM要素の取得
const authModal = document.getElementById("auth-modal");
const passwordInput = document.getElementById("password-input");
const authError = document.getElementById("auth-error");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const serverStatus = document.getElementById("server-status");
const statusText = document.getElementById("status-text");

const tabBtns = document.querySelectorAll(".tab-btn");
const inputText = document.getElementById("input-text");
const analyzeBtn = document.getElementById("analyze-btn");

const errorBox = document.getElementById("error-box");
const loadingBox = document.getElementById("loading");
const enResult = document.getElementById("en-result");
const jaResult = document.getElementById("ja-result");

// 1. ページ読み込み時の初期化とスリープ対策
window.addEventListener("DOMContentLoaded", () => {
  // ページを開いた瞬間にRenderサーバーを裏で起こす
  wakeUpServer();

  // 開いている間は10分(600,000ミリ秒)ごとに通信してスリープを防ぐ
  setInterval(wakeUpServer, 600000);

  // セッション内にパスワードが保存されていればモーダルを閉じる
  const savedPassword = sessionStorage.getItem("svocm_api_token");
  if (savedPassword) {
    authModal.classList.add("hidden");
  }
});

// Renderサーバーの起動確認（スリープ解除用）
async function wakeUpServer() {
  try {
    serverStatus.className = "status-badge waking";
    statusText.textContent = "サーバー起動中...";

    const response = await fetch(`${API_BASE_URL}/`, { method: "GET" });
    if (response.ok) {
      serverStatus.className = "status-badge online";
      statusText.textContent = "サーバー準備完了";
    } else {
      throw new Error("Status error");
    }
  } catch (err) {
    serverStatus.className = "status-badge offline";
    statusText.textContent = "サーバー接続待機中";
  }
}

// 2. パスワード認証モーダルの処理
loginBtn.addEventListener("click", () => {
  const pwd = passwordInput.value.trim();
  if (!pwd) {
    authError.classList.remove("hidden");
    return;
  }
  sessionStorage.setItem("svocm_api_token", pwd);
  authError.classList.add("hidden");
  authModal.classList.add("hidden");
});

passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    loginBtn.click();
  }
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("svocm_api_token");
  passwordInput.value = "";
  authModal.classList.remove("hidden");
});

// 3. 英語 / 日本語モードの切り替え
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;

    errorBox.classList.add("hidden");
    enResult.classList.add("hidden");
    jaResult.classList.add("hidden");

    if (currentMode === "english") {
      inputText.placeholder = "ここに分析したい英文を入力してください（例: Reading English books makes your vocabulary richer.）";
    } else {
      inputText.placeholder = "ここに英訳したい日本語文を入力してください（例: 私が昨日買った本は面白い。）";
    }
  });
});

// 4. 分析リクエストの送信
analyzeBtn.addEventListener("click", async () => {
  const text = inputText.value.trim();
  const token = sessionStorage.getItem("svocm_api_token");

  if (!token) {
    authModal.classList.remove("hidden");
    return;
  }

  if (!text) {
    showError("分析する文章を入力してください。");
    return;
  }

  errorBox.classList.add("hidden");
  enResult.classList.add("hidden");
  jaResult.classList.add("hidden");
  loadingBox.classList.remove("hidden");
  analyzeBtn.disabled = true;

  const endpoint = currentMode === "english" ? "/analyze/english" : "/analyze/japanese";

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem("svocm_api_token");
      authModal.classList.remove("hidden");
      throw new Error("パスワードが正しくありません。再度入力してください。");
    }

    if (!response.ok) {
      throw new Error(`通信エラーが発生しました (Status: ${response.status})`);
    }

    const data = await response.json();

    // 通信成功時はステータスをオンラインに更新
    serverStatus.className = "status-badge online";
    statusText.textContent = "サーバー準備完了";

    if (currentMode === "english") {
      renderEnglishResult(data);
    } else {
      renderJapaneseResult(data);
    }
  } catch (err) {
    showError(err.message || "サーバーとの通信に失敗しました。URLまたはネットワークを確認してください。");
  } finally {
    loadingBox.classList.add("hidden");
    analyzeBtn.disabled = false;
  }
});

// チャンク要素（入れ子の従属節・関係詞節・分詞構文・分詞句 sub_chunks 対応）を再帰的に生成する関数
function createChunkElement(chunk) {
  const div = document.createElement("div");
  if (Array.isArray(chunk.sub_chunks) && chunk.sub_chunks.length > 0) {
    div.className = `chunk-box chunk-nested role-${chunk.role}`;
    const typeLabel = chunk.clause_type ? `${chunk.role} (${chunk.clause_type})` : `${chunk.role}`;
    div.innerHTML = `
      <div class="chunk-nested-header">
        <span class="chunk-text">${escapeHtml(chunk.text)}</span>
        <span class="chunk-role">${escapeHtml(typeLabel)}</span>
      </div>
    `;
    const subContainer = document.createElement("div");
    subContainer.className = "sub-chunks-container";
    chunk.sub_chunks.forEach((sub) => {
      subContainer.appendChild(createChunkElement(sub));
    });
    div.appendChild(subContainer);
  } else {
    div.className = `chunk-box role-${chunk.role}`;
    div.innerHTML = `
      <span class="chunk-text">${escapeHtml(chunk.text)}</span>
      <span class="chunk-role">${escapeHtml(chunk.role)}</span>
    `;
  }
  return div;
}

// 5. 英文分析結果の描画
function renderEnglishResult(data) {
  document.getElementById("en-pattern").textContent = data.pattern;

  // チャンクの描画（従属節の入れ子表示に対応）
  const chunksContainer = document.getElementById("en-chunks");
  chunksContainer.innerHTML = "";
  data.chunks.forEach((chunk) => {
    chunksContainer.appendChild(createChunkElement(chunk));
  });

  // 統語ツリー(1行配置・品詞・SVOCM囲み枠・逆V字連結ツリーSVG)の描画
  const treeContainer = document.getElementById("en-tree");
  treeContainer.innerHTML = buildHierarchicalTreeSvg(data.tokens, data.chunks);

  // トークン一覧テーブルの描画
  const tbody = document.getElementById("en-tokens-body");
  tbody.innerHTML = "";
  data.tokens.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(t.text)}</strong></td>
      <td>${escapeHtml(t.lemma)}</td>
      <td>${escapeHtml(t.pos)} (${escapeHtml(t.tag)})</td>
      <td><strong>${escapeHtml(t.svocm)}</strong></td>
      <td>${escapeHtml(t.dep)}</td>
      <td>${escapeHtml(t.head_text)}</td>
    `;
    tbody.appendChild(tr);
  });

  enResult.classList.remove("hidden");
}

// 品詞の日本語表記マップ
const POS_JA_MAP = {
  NOUN: "名詞",
  PROPN: "固有名詞",
  PRON: "代名詞",
  VERB: "動詞",
  AUX: "助動詞",
  ADJ: "形容詞",
  ADV: "副詞",
  ADP: "前置詞",
  DET: "冠詞/限定詞",
  PART: "to/不変化詞",
  CCONJ: "接続詞",
  SCONJ: "接続詞",
  NUM: "数詞",
  INTJ: "間投詞"
};

function getPosLabel(token) {
  if (token.tag === "RP" || token.dep === "prt") return "副詞粒子(PRT)";
  if (token.tag === "TO") return "不定詞(to)";
  if (token.tag === "VBG" && !String(token.svocm).includes("V")) return "動名詞/分詞";
  const ja = POS_JA_MAP[token.pos] || token.pos;
  return `${ja}(${token.pos})`;
}

// 1行配置・品詞・SVOCM囲み枠つきの逆V字統語ツリー（句構造ツリー）を生成する関数
function buildHierarchicalTreeSvg(tokens, chunks) {
  const validTokens = tokens.filter((t) => t.pos !== "PUNCT");
  if (validTokens.length === 0) return "";

  const roleStyle = {
    S: { fill: "#eff6ff", stroke: "#2563eb", badge: "#2563eb", text: "#1e40af" },
    V: { fill: "#fef2f2", stroke: "#dc2626", badge: "#dc2626", text: "#991b1b" },
    O: { fill: "#ecfdf5", stroke: "#059669", badge: "#059669", text: "#065f46" },
    C: { fill: "#fffbeb", stroke: "#d97706", badge: "#d97706", text: "#92400e" },
    M: { fill: "#f5f3ff", stroke: "#7c3aed", badge: "#7c3aed", text: "#5b21b6" },
    Conj: { fill: "#f1f5f9", stroke: "#64748b", badge: "#475569", text: "#334155" },
    Other: { fill: "#f8fafc", stroke: "#94a3b8", badge: "#64748b", text: "#334155" }
  };

  // 1. 入れ子チャンク(sub_chunks)を再帰的に展開して葉グループ(groups)と階層構造を構築
  const groups = [];
  const clauseBrackets = [];

  function registerChunkHierarchy(ch) {
    if (Array.isArray(ch.sub_chunks) && ch.sub_chunks.length > 0) {
      const childItems = ch.sub_chunks.map((sub) => registerChunkHierarchy(sub)).filter(Boolean);
      if (childItems.length === 0) return null;

      const allLeafIndices = [];
      let maxChildDepth = 0;
      childItems.forEach((ci) => {
        allLeafIndices.push(...ci.leafIndices);
        if (ci.bracketDepth > maxChildDepth) maxChildDepth = ci.bracketDepth;
      });

      // 先行詞 + 関係詞節/分詞句 のように子要素自体が節ブラケットを持ち、このチャンク自体には clause_type がない場合は重複ブラケットを省略
      const shouldDrawBracket = Boolean(ch.clause_type) || maxChildDepth === 0;
      let myDepth = maxChildDepth;
      if (shouldDrawBracket) {
        myDepth = maxChildDepth + 1;
        const bLabel = ch.clause_type ? `${ch.role} (${ch.clause_type})` : `${ch.role} (節)`;
        clauseBrackets.push({
          role: ch.role,
          label: bLabel,
          subGroupIndices: allLeafIndices,
          depth: myDepth
        });
      }

      return {
        isContainer: true,
        role: ch.role,
        clauseType: ch.clause_type || null,
        children: childItems,
        leafIndices: allLeafIndices,
        bracketDepth: myDepth
      };
    } else {
      const matched = validTokens.filter((t) => t.id >= ch.start && t.id <= ch.end);
      if (matched.length === 0) return null;
      const gIdx = groups.length;
      groups.push({
        role: ch.role,
        tokens: matched
      });
      return {
        isContainer: false,
        role: ch.role,
        groupIdx: gIdx,
        leafIndices: [gIdx],
        bracketDepth: 0
      };
    }
  }

  let hierarchyRoots = [];
  if (Array.isArray(chunks) && chunks.length > 0) {
    hierarchyRoots = chunks.map((ch) => registerChunkHierarchy(ch)).filter(Boolean);
  }
  if (groups.length === 0) {
    validTokens.forEach((t, idx) => {
      groups.push({ role: t.svocm || "Other", tokens: [t] });
      hierarchyRoots.push({
        isContainer: false,
        role: t.svocm || "Other",
        groupIdx: idx,
        leafIndices: [idx],
        bracketDepth: 0
      });
    });
  }

  // 2. 1行に並べる各単語のX座標を計算
  const padX = 36;
  const wordGap = 14;
  const groupGap = 24;
  const tokenCenterX = {};
  const tokenBoxWidth = {};

  let currentX = padX;
  groups.forEach((grp, gIdx) => {
    if (gIdx > 0) currentX += groupGap;
    grp.leftX = currentX;

    grp.tokens.forEach((t, tIdx) => {
      if (tIdx > 0) currentX += wordGap;
      const posLabel = getPosLabel(t);
      const w = Math.max(t.text.length * 10 + 24, posLabel.length * 7 + 16, 68);
      tokenBoxWidth[t.id] = w;
      tokenCenterX[t.id] = currentX + w / 2;
      currentX += w;
    });

    grp.rightX = currentX;
  });

  const svgWidth = Math.max(currentX + padX, 520);

  // 3. 逆V字の連結ツリー構造（単語同士の結合 -> 句同士の結合 -> 文）を構築
  const mergeEdges = [];
  const mergeNodes = [];

  function createLeafNode(token) {
    return {
      x: tokenCenterX[token.id],
      level: 0,
      label: token.text,
      role: token.svocm
    };
  }

  function mergeTwoNodes(leftNode, rightNode, label, role) {
    const level = Math.max(leftNode.level, rightNode.level) + 1;
    const x = (leftNode.x + rightNode.x) / 2;
    const parent = { x, level, label, role: role || "Phrase" };
    mergeEdges.push({ parent, left: leftNode, right: rightNode });
    mergeNodes.push(parent);
    return parent;
  }

  // spaCyの親子関係(head_id)を直接たどってチャンク内部の逆V字結合を組み立てる
  function buildIntraGroupTree(tokSlice, role) {
    if (tokSlice.length === 1) {
      return createLeafNode(tokSlice[0]);
    }

    const idSet = new Set(tokSlice.map((t) => t.id));
    const localChildren = {};
    tokSlice.forEach((t) => {
      localChildren[t.id] = [];
    });

    const localRoots = [];
    tokSlice.forEach((t) => {
      if (idSet.has(t.head_id) && t.head_id !== t.id) {
        localChildren[t.head_id].push(t);
      } else {
        localRoots.push(t);
      }
    });

    function buildDepSubtree(headTok, isTopLevel) {
      const ch = localChildren[headTok.id] || [];
      const lefts = ch.filter((c) => c.id < headTok.id).sort((a, b) => a.id - b.id);
      const rights = ch.filter((c) => c.id > headTok.id).sort((a, b) => a.id - b.id);

      let cur = createLeafNode(headTok);

      // 1. 左側の修飾語は、主要語(headTok)に近い側（内側）から順に逆V字で結合する
      for (let i = lefts.length - 1; i >= 0; i--) {
        const leftSub = buildDepSubtree(lefts[i], false);
        const isFinalMerge = isTopLevel && i === 0 && rights.length === 0 && localRoots.length === 1;
        cur = mergeTwoNodes(leftSub, cur, isFinalMerge ? role : "句", isFinalMerge ? role : "Phrase");
      }

      // 2. 右側の補部・修飾語は、主要語(headTok)に近い側から順に逆V字で結合する
      for (let i = 0; i < rights.length; i++) {
        const rightSub = buildDepSubtree(rights[i], false);
        const isFinalMerge = isTopLevel && i === rights.length - 1 && localRoots.length === 1;
        cur = mergeTwoNodes(cur, rightSub, isFinalMerge ? role : "句", isFinalMerge ? role : "Phrase");
      }

      return cur;
    }

    const rootNodes = localRoots.map((r) => buildDepSubtree(r, true));
    let combined = rootNodes[0];
    for (let i = 1; i < rootNodes.length; i++) {
      const isFinal = (i === rootNodes.length - 1);
      combined = mergeTwoNodes(combined, rootNodes[i], isFinal ? role : "句", isFinal ? role : "Phrase");
    }
    combined.label = role;
    combined.role = role;
    return combined;
  }

  // 各葉チャンクの頂点ノードを作成
  const leafChunkNodes = groups.map((grp) => {
    const node = buildIntraGroupTree(grp.tokens, grp.role);
    node.chunkRole = grp.role;
    node.tokens = grp.tokens;
    return node;
  });

  // 節内部（または主節）のチャンクノード列を結合して1つの節/文ノードにするヘルパー
  function buildClauseTreeFromNodes(nodesSlice, isTopSentence) {
    if (nodesSlice.length === 1) return nodesSlice[0];

    // 1. 先頭に接続詞・前置詞マーカー (Conj: that / so that / in order that / with 等) がある場合は最後に外側から結合する
    if (nodesSlice[0].chunkRole === "Conj" && nodesSlice.length > 1) {
      const restTree = buildClauseTreeFromNodes(nodesSlice.slice(1), false);
      const topLbl = isTopSentence ? "文 (Sentence)" : "Conj + 節";
      return mergeTwoNodes(nodesSlice[0], restTree, topLbl, isTopSentence ? "Sentence" : "VP");
    }

    // 2. 等位接続詞 (and / but / or / for / so) による重文 (S1+V1, and/but S2+V2) または並列動詞句 (S + V1 and V2)
    const conjIdx = nodesSlice.findIndex((n, idx) => idx > 0 && n.chunkRole === "Conj");
    const firstVIdx = nodesSlice.findIndex((n) => n.chunkRole === "V");
    if (conjIdx !== -1 && firstVIdx !== -1 && conjIdx > firstVIdx) {
      const rightSlice = nodesSlice.slice(conjIdx + 1);
      const rightHasOwnSubjAndVerb = rightSlice.some((n) => n.chunkRole === "S") && rightSlice.some((n) => n.chunkRole === "V");

      if (rightHasOwnSubjAndVerb) {
        // 改善⑥: 重文 (Clause 1 + Conj + Clause 2)
        const clause1 = buildClauseTreeFromNodes(nodesSlice.slice(0, conjIdx), false);
        const conjNode = nodesSlice[conjIdx];
        const clause2 = buildClauseTreeFromNodes(rightSlice, false);
        const conjRight = mergeTwoNodes(conjNode, clause2, "Conj + 節", "VP");
        const topLbl = isTopSentence ? "文 (重文)" : "節 + 節";
        return mergeTwoNodes(clause1, conjRight, topLbl, isTopSentence ? "Sentence" : "VP");
      }

      if (!rightSlice.some((n) => n.chunkRole === "S")) {
        // 共通主語の並列述部 (S + [VP1 + Conj + VP2])
        const prefixNodes = nodesSlice.slice(0, firstVIdx);
        const vp1Nodes = nodesSlice.slice(firstVIdx, conjIdx);
        const conjNode = nodesSlice[conjIdx];
        const vp2Nodes = rightSlice;

        const vp1 = buildClauseTreeFromNodes(vp1Nodes, false);
        const vp2 = buildClauseTreeFromNodes(vp2Nodes, false);
        const conjRight = mergeTwoNodes(conjNode, vp2, "Conj + VP", "VP");
        let combinedVp = mergeTwoNodes(vp1, conjRight, "VP (並列述部)", "VP");

        for (let i = prefixNodes.length - 1; i >= 0; i--) {
          const isTop = isTopSentence && i === 0;
          const pRole = prefixNodes[i].chunkRole;
          const pLabel = isTop ? "文 (Sentence)" : (pRole === "S" ? "S + VP" : `${pRole} + 節`);
          combinedVp = mergeTwoNodes(
            prefixNodes[i],
            combinedVp,
            pLabel,
            isTop ? "Sentence" : "VP"
          );
        }
        return combinedVp;
      }
    }

    // 3. 付帯状況の with 構文などで V がなく [S + C (+ M)] のネクサス構造になっている場合
    const vIdx = nodesSlice.findIndex((n) => n.chunkRole === "V");
    if (vIdx === -1) {
      let cur = nodesSlice[0];
      for (let i = 1; i < nodesSlice.length; i++) {
        const isTop = isTopSentence && i === nodesSlice.length - 1;
        const lbl = (cur.chunkRole === "S" && nodesSlice[i].chunkRole === "C") ? "S + C" : (isTop ? "文 (Sentence)" : "句");
        cur = mergeTwoNodes(cur, nodesSlice[i], lbl, isTop ? "Sentence" : "Phrase");
      }
      return cur;
    }

    // 4. 疑問文・否定語文頭移動・仮定法if省略の倒置 ( [Never/What] + Aux [V] + S + V ... )
    const secondVIdx = nodesSlice.findIndex((n, idx) => idx > vIdx && n.chunkRole === "V");
    const hasSubjBetweenV = secondVIdx !== -1 && nodesSlice.slice(vIdx + 1, secondVIdx).some((n) => n.chunkRole === "S");

    if (hasSubjBetweenV) {
      let mainVp = nodesSlice[secondVIdx];
      for (let i = secondVIdx + 1; i < nodesSlice.length; i++) {
        const nextRole = nodesSlice[i].chunkRole;
        const lbl = (nextRole === "O" || nextRole === "C") ? "VP (動詞句)" : "VP (述部)";
        mainVp = mergeTwoNodes(mainVp, nodesSlice[i], lbl, "VP");
      }
      for (let i = secondVIdx - 1; i > vIdx; i--) {
        mainVp = mergeTwoNodes(nodesSlice[i], mainVp, "S + VP", "VP");
      }
      let invNode = mergeTwoNodes(
        nodesSlice[vIdx],
        mainVp,
        isTopSentence && vIdx === 0 ? "文 (倒置)" : "Aux + S + VP",
        isTopSentence && vIdx === 0 ? "Sentence" : "VP"
      );
      for (let i = vIdx - 1; i >= 0; i--) {
        const isTop = isTopSentence && i === 0;
        invNode = mergeTwoNodes(nodesSlice[i], invNode, isTop ? "文 (倒置)" : "倒置節", isTop ? "Sentence" : "VP");
      }
      return invNode;
    }

    // 5. 通常の述部結合（分離句動詞 take ... off や、形式目的語 it + C + 真目的語 O、形式主語 It + C + 真主語 S に対応）
    let lastVIdx = vIdx;
    for (let i = vIdx + 1; i < nodesSlice.length; i++) {
      if (nodesSlice[i].chunkRole === "V") lastVIdx = i;
    }

    const mainVerbTok = nodesSlice[vIdx].tokens ? nodesSlice[vIdx].tokens[nodesSlice[vIdx].tokens.length - 1] : null;
    const mainVerbText = mainVerbTok ? mainVerbTok.text : "";

    let vpNode = nodesSlice[vIdx];
    let hasSeenObjAfterV = false;
    let hasSeenCompAfterV = false;

    for (let i = vIdx + 1; i < nodesSlice.length; i++) {
      const nextNode = nodesSlice[i];
      const nextRole = nextNode.chunkRole;
      const isLastRight = (i === nodesSlice.length - 1) && (vIdx === 0);

      if (i <= lastVIdx) {
        if (nextRole === "V") {
          const prtText = nextNode.tokens ? nextNode.tokens.map((t) => t.text).join(" ") : "";
          const pvLabel = mainVerbText ? `VP (句動詞: ${mainVerbText} ... ${prtText})` : "VP (句動詞)";
          vpNode = mergeTwoNodes(vpNode, nextNode, pvLabel, "V");
        } else {
          vpNode = mergeTwoNodes(vpNode, nextNode, "V + " + nextRole, "VP");
        }
      } else {
        let mergeLabel = "VP (述部)";
        if (nextRole === "O" && hasSeenObjAfterV && hasSeenCompAfterV) {
          // 改善①: V + it (O) + C の後ろに来た真目的語 (O)
          mergeLabel = "VP + 真目的語(O)";
        } else if (nextRole === "O" || nextRole === "C") {
          mergeLabel = "VP (動詞句)";
        } else if (nextRole === "S") {
          mergeLabel = "述部 + 真主語(S)";
        }
        if (nextRole === "O") hasSeenObjAfterV = true;
        if (nextRole === "C") hasSeenCompAfterV = true;

        if (isTopSentence && isLastRight) mergeLabel = "文 (Sentence)";
        vpNode = mergeTwoNodes(vpNode, nextNode, mergeLabel, isTopSentence && isLastRight ? "Sentence" : "VP");
      }
    }

    // 6. 動詞より左側の要素（主語 S、連鎖関係詞節の挿入節 M、関係詞節・強調構文・倒置で文頭に出た要素）を右から順に結合
    const leftNodes = nodesSlice.slice(0, vIdx);
    let currentRight = vpNode;
    for (let i = leftNodes.length - 1; i >= 0; i--) {
      const isTop = isTopSentence && i === 0;
      const lRole = leftNodes[i].chunkRole;
      let label = "S + VP";
      if (isTop) {
        label = "文 (Sentence)";
      } else if (lRole === "M" && i > 0 && leftNodes[i - 1].chunkRole === "S") {
        // 改善⑧: 連鎖関係詞節 (who [S] + I thought [M] + was honest [VP])
        label = "挿入節 + VP";
      } else if (lRole !== "S") {
        label = `${lRole} + 節`;
      }
      currentRight = mergeTwoNodes(leftNodes[i], currentRight, label, isTop ? "Sentence" : "VP");
    }
    return currentRight;
  }

  // 4. 階層構造(hierarchyRoots)からボトムアップで節ノード・先行詞＋関係詞節ノードを組み立て、最後に主節を結合する
  function buildNodeFromHierarchyItem(item) {
    if (!item.isContainer) {
      return leafChunkNodes[item.groupIdx];
    }
    const childNodes = item.children.map((ci) => buildNodeFromHierarchyItem(ci));
    let combined;
    if (!item.clauseType && !childNodes.some((n) => n.chunkRole === "V")) {
      // 先行詞 (The book) + 関係詞節/分詞句 (M) の結合
      combined = childNodes[0];
      for (let i = 1; i < childNodes.length; i++) {
        combined = mergeTwoNodes(combined, childNodes[i], item.role, item.role);
      }
    } else {
      combined = buildClauseTreeFromNodes(childNodes, false);
    }
    const nodeLabel = item.clauseType ? `${item.role} (${item.clauseType})` : item.role;
    combined.label = nodeLabel;
    combined.role = item.role;
    combined.chunkRole = item.role;
    return combined;
  }

  const topLevelNodes = hierarchyRoots.map((item) => buildNodeFromHierarchyItem(item));
  if (topLevelNodes.length > 1) {
    buildClauseTreeFromNodes(topLevelNodes, true);
  }

  // 5. 高さとY座標の計算（アンダーブラケットの段数に応じて下部余白を調整）
  const maxLevel = mergeNodes.reduce((max, n) => Math.max(max, n.level), 0);
  const maxBracketDepth = clauseBrackets.reduce((max, b) => Math.max(max, b.depth || 1), 0);
  const levelStepY = 48;
  const topPadY = 38;
  const treeBaseY = topPadY + maxLevel * levelStepY + 12;

  const boxTopY = treeBaseY;
  const wordY = boxTopY + 26;
  const posY = boxTopY + 46;
  const boxBottomY = boxTopY + 58;
  const svgHeight = boxBottomY + (maxBracketDepth > 0 ? 36 + maxBracketDepth * 30 : 34);

  function getNodeY(node) {
    return treeBaseY - node.level * levelStepY;
  }

  let svgContent = "";

  // (A) 逆V字の枝（直線）を描画
  mergeEdges.forEach((edge) => {
    const px = edge.parent.x;
    const py = getNodeY(edge.parent);
    const lx = edge.left.x;
    const ly = getNodeY(edge.left);
    const rx = edge.right.x;
    const ry = getNodeY(edge.right);

    svgContent += `<line x1="${px}" y1="${py}" x2="${lx}" y2="${ly}" stroke="#475569" stroke-width="2" stroke-linecap="round" />`;
    svgContent += `<line x1="${px}" y1="${py}" x2="${rx}" y2="${ry}" stroke="#475569" stroke-width="2" stroke-linecap="round" />`;
  });

  // (B) 逆V字の結合点ラベルを描画
  mergeNodes.forEach((node) => {
    const nx = node.x;
    const ny = getNodeY(node);
    const isSentence = node.role === "Sentence";
    const st = roleStyle[node.role] || (isSentence
      ? { fill: "#0f172a", stroke: "#0f172a", text: "#ffffff" }
      : { fill: "#ffffff", stroke: "#64748b", text: "#334155" });

    const labelText = node.label;
    const pillW = Math.max(labelText.length * 8 + 16, 36);
    const pillH = 20;

    svgContent += `<rect x="${nx - pillW / 2}" y="${ny - pillH / 2}" width="${pillW}" height="${pillH}" rx="10" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.5" />`;
    svgContent += `<text x="${nx}" y="${ny + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${st.text}">${escapeHtml(labelText)}</text>`;
  });

  // (C) SVOCMの囲み枠と下部ラベルを描画
  groups.forEach((grp) => {
    const st = roleStyle[grp.role] || roleStyle.Other;
    const x = grp.leftX - 6;
    const w = (grp.rightX - grp.leftX) + 12;
    const h = boxBottomY - boxTopY;

    svgContent += `<rect x="${x}" y="${boxTopY}" width="${w}" height="${h}" rx="8" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2" />`;

    if (grp.role !== "Other") {
      const badgeW = grp.role === "Conj" ? 44 : 36;
      const badgeH = 20;
      const bx = x + w / 2 - badgeW / 2;
      const by = boxBottomY - badgeH / 2 + 2;
      svgContent += `<rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}" rx="6" fill="${st.badge}" />`;
      svgContent += `<text x="${x + w / 2}" y="${by + 14}" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff">${escapeHtml(grp.role)}</text>`;
    }
  });

  // (C2) 従属節・関係詞節・分詞構文・分詞句をまとめる下部アンダーブラケットを描画
  clauseBrackets.forEach((br) => {
    if (br.subGroupIndices.length === 0) return;
    const firstGrp = groups[br.subGroupIndices[0]];
    const lastGrp = groups[br.subGroupIndices[br.subGroupIndices.length - 1]];
    const st = roleStyle[br.role] || roleStyle.Other;

    const depth = br.depth || 1;
    const x1 = firstGrp.leftX - 6;
    const x2 = lastGrp.rightX + 6;
    const midX = (x1 + x2) / 2;
    const bracketY = boxBottomY + 28 * depth;
    const legTopY = bracketY - 12;

    svgContent += `<path d="M ${x1} ${legTopY} L ${x1} ${bracketY} L ${x2} ${bracketY} L ${x2} ${legTopY}" fill="none" stroke="${st.stroke}" stroke-width="2.5" stroke-linecap="round" />`;
    const bText = br.label || `${br.role} (節)`;
    const bw = Math.max(bText.length * 9 + 14, 54);
    const bh = 20;
    svgContent += `<rect x="${midX - bw / 2}" y="${bracketY - bh / 2}" width="${bw}" height="${bh}" rx="6" fill="${st.badge}" />`;
    svgContent += `<text x="${midX}" y="${bracketY + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">${escapeHtml(bText)}</text>`;
  });

  // (D) 1行の英単語と、その下の品詞を描画
  validTokens.forEach((t) => {
    const cx = tokenCenterX[t.id];
    const posLabel = getPosLabel(t);

    svgContent += `<text x="${cx}" y="${wordY}" text-anchor="middle" font-size="15" font-weight="700" fill="#0f172a">${escapeHtml(t.text)}</text>`;
    svgContent += `<text x="${cx}" y="${posY}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#475569">${escapeHtml(posLabel)}</text>`;
  });

  return `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">${svgContent}</svg>`;
}

// 6. 日本語分析結果の描画（関係詞節・従属節の入れ子 sub_chunks 表示に対応）
function renderJapaneseResult(data) {
  const guideContainer = document.getElementById("ja-order-guide");
  guideContainer.innerHTML = "";

  const guide = data.english_order_guide;
  Object.keys(guide).forEach((key) => {
    const card = document.createElement("div");
    card.className = "guide-card";
    const items = guide[key].length ? guide[key].join(" / ") : "（なし）";
    card.innerHTML = `
      <h4>${escapeHtml(key)}</h4>
      <p><strong>${escapeHtml(items)}</strong></p>
    `;
    guideContainer.appendChild(card);
  });

  const clausesContainer = document.getElementById("ja-clauses");
  clausesContainer.innerHTML = "";
  data.clauses.forEach((c) => {
    clausesContainer.appendChild(createChunkElement(c));
  });

  jaResult.classList.remove("hidden");
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}