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
const clearBtn = document.getElementById("clear-btn");
const analyzeBtn = document.getElementById("analyze-btn");

const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const zoomFitBtn = document.getElementById("zoom-fit-btn");
const zoomResetBtn = document.getElementById("zoom-reset-btn");
const zoomLevelText = document.getElementById("zoom-level-text");

let currentTreeZoom = 1.0;
let baseTreeWidth = 520;
let baseTreeHeight = 300;

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

// クリアボタンの処理
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    inputText.value = "";
    errorBox.classList.add("hidden");
    enResult.classList.add("hidden");
    jaResult.classList.add("hidden");
    inputText.focus();
  });
}

// 統語ツリーの拡大・縮小処理
function applyTreeZoom(zoomValue) {
  currentTreeZoom = Math.min(Math.max(zoomValue, 0.3), 2.5);
  const svgEl = document.querySelector("#en-tree svg");
  if (svgEl) {
    svgEl.setAttribute("width", Math.round(baseTreeWidth * currentTreeZoom));
    svgEl.setAttribute("height", Math.round(baseTreeHeight * currentTreeZoom));
  }
  if (zoomLevelText) {
    zoomLevelText.textContent = `${Math.round(currentTreeZoom * 100)}%`;
  }
}

if (zoomInBtn) {
  zoomInBtn.addEventListener("click", () => applyTreeZoom(currentTreeZoom + 0.15));
}
if (zoomOutBtn) {
  zoomOutBtn.addEventListener("click", () => applyTreeZoom(currentTreeZoom - 0.15));
}
if (zoomResetBtn) {
  zoomResetBtn.addEventListener("click", () => applyTreeZoom(1.0));
}
if (zoomFitBtn) {
  zoomFitBtn.addEventListener("click", () => {
    const treeContainer = document.getElementById("en-tree");
    if (treeContainer && baseTreeWidth > 0) {
      const containerW = treeContainer.clientWidth - 20;
      const fitScale = Math.min(1.0, containerW / baseTreeWidth);
      applyTreeZoom(fitScale);
    }
  });
}

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
      inputText.placeholder = "ここに英訳したい日本語文を入力してください（例: 私が昨日見た男性はその少年の父親だった。）";
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

// 入れ子チャンクが「先行詞 + 関係詞節/接触節/分詞修飾」構造を持っているか判定するヘルパー
function hasAdnominalModifierSubChunk(chunk) {
  if (!Array.isArray(chunk.sub_chunks) || chunk.sub_chunks.length < 2) return false;
  const hasModSub = chunk.sub_chunks.some(
    (s) => s.role === "M" && (Array.isArray(s.sub_chunks) || (s.clause_type && /関係詞|接触節|分詞|同格|修飾/.test(s.clause_type)))
  );
  const hasNonModSub = chunk.sub_chunks.some((s) => s.role !== "M");
  return hasModSub && hasNonModSub;
}

// 1つのインライン要素（先行詞や節内のSVOCMチップ）を生成するヘルパー
function createInlineChunkChip(text, roleLabel, colorClass) {
  const chip = document.createElement("div");
  chip.className = `inline-chunk-item ${colorClass}`;
  chip.innerHTML = `
    <span class="inline-chunk-text">${escapeHtml(text)}</span>
    <span class="chunk-role">${escapeHtml(roleLabel)}</span>
  `;
  return chip;
}

// 修飾節（関係詞節・接触節・分詞修飾・従属節）の内部要素を横並び・グレースケールで展開するヘルパー
function appendFlattenedModifierItems(container, subChunkList, forceGrayScale, mShadeLevel) {
  let nestedModCounter = mShadeLevel + 1;
  subChunkList.forEach((item, idx) => {
    if (idx > 0) {
      const sep = document.createElement("span");
      sep.className = "sub-chunk-sep";
      sep.textContent = "/";
      container.appendChild(sep);
    }

    const safeRole = String(item.role).replace("+", "");
    if (Array.isArray(item.sub_chunks) && item.sub_chunks.length > 0) {
      // 連鎖関係代名詞の挿入節やさらなる入れ子節がある場合、濃淡を変えたグループ枠で囲む
      const groupWrap = document.createElement("div");
      const shadeIdx = nestedModCounter % 3;
      nestedModCounter++;
      groupWrap.className = `mod-clause-group m-shade-${shadeIdx}`;
      appendFlattenedModifierItems(groupWrap, item.sub_chunks, true, shadeIdx);
      container.appendChild(groupWrap);
    } else {
      const roleLabel = item.clause_type ? `${item.role} (${item.clause_type})` : item.role;
      const colorClass = forceGrayScale ? `gray-role-${safeRole}` : `role-${safeRole}`;
      container.appendChild(createInlineChunkChip(item.text, roleLabel, colorClass));
    }
  });
}

// チャンク要素（展開ボタン付き・先行詞ラベル対応・修飾節内SVOCMグレー色分け・横連結対応）を生成する関数
function createChunkElement(chunk, mShadeLevel = 0) {
  const div = document.createElement("div");
  const safeRole = String(chunk.role).replace("+", "");
  const isMod = safeRole === "M";
  const shadeClass = isMod ? ` m-shade-${mShadeLevel % 3}` : "";

  if (Array.isArray(chunk.sub_chunks) && chunk.sub_chunks.length > 0) {
    div.className = `chunk-box chunk-nested role-${safeRole}${shadeClass}`;
    const isAdnominal = hasAdnominalModifierSubChunk(chunk);
    const headerRoleLabel = (!isAdnominal && chunk.clause_type)
      ? `${chunk.role} (${chunk.clause_type})`
      : `${chunk.role}`;

    const headerDiv = document.createElement("div");
    headerDiv.className = "chunk-nested-header";
    headerDiv.innerHTML = `
      <span class="chunk-text">${escapeHtml(chunk.text)}</span>
      <div class="chunk-header-actions">
        <button type="button" class="chunk-toggle-btn" aria-expanded="false">表示 ▼</button>
        <span class="chunk-role">${escapeHtml(headerRoleLabel)}</span>
      </div>
    `;

    const subContainer = document.createElement("div");
    subContainer.className = "sub-chunks-container hidden";

    if (isAdnominal) {
      // 先行詞 + 関係詞節/接触節/分詞句 の構造
      const modClauseCount = chunk.sub_chunks.filter((s) => s.role === "M" && Array.isArray(s.sub_chunks)).length;
      let modGroupCounter = mShadeLevel;
      let hasAppendedAny = false;

      chunk.sub_chunks.forEach((sub) => {
        if (hasAppendedAny) {
          const sep = document.createElement("span");
          sep.className = "sub-chunk-sep";
          sep.textContent = "/";
          subContainer.appendChild(sep);
        }

        if (sub.role !== "M") {
          // 先行詞：色は元のSVOCM（Sなら青など）のまま、ラベルは「先行詞」と表示
          const antColorClass = `role-${safeRole}`;
          subContainer.appendChild(createInlineChunkChip(sub.text, "先行詞", antColorClass));
          hasAppendedAny = true;
        } else if (Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0) {
          // 関係詞節・接触節・分詞修飾の内部：SVOCMに応じてグレーで色分けし横に連結
          const curShade = modGroupCounter % 3;
          modGroupCounter++;
          if (modClauseCount > 1) {
            // 1つの先行詞に複数の関係詞節が修飾している場合は、まとまりごとにグレー濃淡枠で囲む
            const groupWrap = document.createElement("div");
            groupWrap.className = `mod-clause-group m-shade-${curShade}`;
            appendFlattenedModifierItems(groupWrap, sub.sub_chunks, true, curShade);
            subContainer.appendChild(groupWrap);
          } else {
            appendFlattenedModifierItems(subContainer, sub.sub_chunks, true, curShade);
          }
          hasAppendedAny = true;
        } else {
          subContainer.appendChild(createInlineChunkChip(sub.text, sub.role, "gray-role-M"));
          hasAppendedAny = true;
        }
      });
    } else {
      // 名詞節・副詞節・分詞構文・付帯状況などの内部展開（M節または修飾節の内部はすべてグレー色分け）
      const useGrayForInner = isMod || Boolean(chunk.clause_type);
      appendFlattenedModifierItems(subContainer, chunk.sub_chunks, useGrayForInner, mShadeLevel);
    }

    const toggleBtn = headerDiv.querySelector(".chunk-toggle-btn");
    toggleBtn.addEventListener("click", () => {
      const isHidden = subContainer.classList.toggle("hidden");
      toggleBtn.textContent = isHidden ? "表示 ▼" : "閉じる ▲";
      toggleBtn.setAttribute("aria-expanded", String(!isHidden));
    });

    div.appendChild(headerDiv);
    div.appendChild(subContainer);
  } else {
    div.className = `chunk-box role-${safeRole}${shadeClass}`;
    const typeLabel = chunk.clause_type ? `${chunk.role} (${chunk.clause_type})` : `${chunk.role}`;
    div.innerHTML = `
      <span class="chunk-text">${escapeHtml(chunk.text)}</span>
      <span class="chunk-role">${escapeHtml(typeLabel)}</span>
    `;
  }
  return div;
}

// 5. 英文分析結果の描画
function renderEnglishResult(data) {
  document.getElementById("en-pattern").textContent = data.pattern;

  // チャンクの描画（1つずつ縦並び・連続するMのグレー濃淡変化に対応）
  const chunksContainer = document.getElementById("en-chunks");
  chunksContainer.innerHTML = "";
  let topModCounter = 0;
  data.chunks.forEach((chunk) => {
    const shade = chunk.role === "M" ? topModCounter++ : 0;
    chunksContainer.appendChild(createChunkElement(chunk, shade));
  });

  // 統語ツリー(1行配置・品詞・SVOCM囲み枠・逆V字連結ツリーSVG)の描画
  const treeContainer = document.getElementById("en-tree");
  treeContainer.innerHTML = buildHierarchicalTreeSvg(data.tokens, data.chunks);
  applyTreeZoom(1.0);

  // 文法網羅チェッカー（13項目）の描画
  const grammarBody = document.getElementById("en-grammar-check-body");
  if (grammarBody) {
    grammarBody.innerHTML = "";
    const checkList = Array.isArray(data.grammar_check) ? data.grammar_check : [];
    checkList.forEach((row) => {
      const tr = document.createElement("tr");
      tr.className = row.detected ? "grammar-row-active" : "grammar-row-inactive";
      const itemsHtml = (row.items || []).map((it) => {
        const cls = row.detected ? "grammar-detected-item" : "grammar-none-item";
        return `<div class="${cls}">${escapeHtml(it)}</div>`;
      }).join("");
      tr.innerHTML = `
        <td><span class="grammar-cat-badge">${escapeHtml(row.category)}</span></td>
        <td class="grammar-target-desc">${escapeHtml(row.targets)}</td>
        <td><div class="grammar-detected-list">${itemsHtml}</div></td>
      `;
      grammarBody.appendChild(tr);
    });
  }

  // トークン一覧テーブルの描画（品詞列は括弧なしの品詞名のみ表示）
  const tbody = document.getElementById("en-tokens-body");
  tbody.innerHTML = "";
  data.tokens.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(t.text)}</strong></td>
      <td>${escapeHtml(t.lemma)}</td>
      <td>${escapeHtml(t.pos)}</td>
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

// SVG内のテキスト描画幅（半角・全角）を計算するヘルパー関数
function calcSvgTextWidth(text, fontSize = 11) {
  let width = 0;
  const str = String(text || "");
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) {
      width += fontSize * 0.62;
    } else {
      width += fontSize * 1.06;
    }
  }
  return Math.ceil(width);
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
    M: { fill: "#f8fafc", stroke: "#94a3b8", badge: "#64748b", text: "#334155" },
    Conj: { fill: "#f8fafc", stroke: "#cbd5e1", badge: "#94a3b8", text: "#475569" },
    Other: { fill: "#f8fafc", stroke: "#cbd5e1", badge: "#64748b", text: "#334155" }
  };

  // 修飾節(関係詞節・分詞修飾等)の内部にあるSVOCM要素用のグレースケールパレット
  const grayRoleStyles = {
    S: { fill: "#e2e8f0", stroke: "#475569", badge: "#334155", text: "#0f172a" },
    V: { fill: "#cbd5e1", stroke: "#1e293b", badge: "#0f172a", text: "#0f172a" },
    O: { fill: "#e5e7eb", stroke: "#4b5563", badge: "#4b5563", text: "#111827" },
    C: { fill: "#e7e5e4", stroke: "#57534e", badge: "#57534e", text: "#1c1917" },
    M: { fill: "#f8fafc", stroke: "#94a3b8", badge: "#64748b", text: "#334155" },
    Conj: { fill: "#f8fafc", stroke: "#cbd5e1", badge: "#94a3b8", text: "#475569" }
  };

  // まとまりごとにグレーの濃さを変える3段階パレット
  const mShadeStyles = [
    { fill: "#f8fafc", stroke: "#94a3b8", badge: "#64748b", text: "#334155" },
    { fill: "#f1f5f9", stroke: "#64748b", badge: "#475569", text: "#1e293b" },
    { fill: "#e2e8f0", stroke: "#475569", badge: "#334155", text: "#0f172a" }
  ];

  function getRoleVisualStyle(role, mShade = 0, inModClause = false) {
    if (inModClause) {
      if (role === "M") {
        return mShadeStyles[mShade % mShadeStyles.length];
      }
      return grayRoleStyles[role] || mShadeStyles[mShade % mShadeStyles.length];
    }
    if (role === "M") {
      return mShadeStyles[mShade % mShadeStyles.length];
    }
    return roleStyle[role] || roleStyle.Other;
  }

  // 1. 入れ子チャンク(sub_chunks)を再帰的に展開して葉グループ(groups)と階層構造を構築
  const groups = [];
  const clauseBrackets = [];

  function registerChunkHierarchy(ch, mShadeLevel = 0, inModClause = false, isAntecedent = false) {
    const isMod = ch.role === "M";
    const nextInMod = inModClause || isMod;

    if (Array.isArray(ch.sub_chunks) && ch.sub_chunks.length > 0) {
      const isAdnominal = hasAdnominalModifierSubChunk(ch);
      let childModCounter = isMod ? mShadeLevel + 1 : mShadeLevel;

      const childItems = ch.sub_chunks.map((sub) => {
        const subIsMod = sub.role === "M";
        const subIsAnt = isAdnominal && !subIsMod;
        const subShade = subIsMod ? childModCounter++ : mShadeLevel;
        return registerChunkHierarchy(sub, subShade, nextInMod || subIsMod, subIsAnt);
      }).filter(Boolean);
      if (childItems.length === 0) return null;

      const allLeafIndices = [];
      let maxChildDepth = 0;
      childItems.forEach((ci) => {
        allLeafIndices.push(...ci.leafIndices);
        if (ci.bracketDepth > maxChildDepth) maxChildDepth = ci.bracketDepth;
      });

      const shouldDrawBracket = Boolean(ch.clause_type) || maxChildDepth === 0;
      let myDepth = maxChildDepth;
      if (shouldDrawBracket) {
        myDepth = maxChildDepth + 1;
        const bLabel = ch.clause_type ? `${ch.role} (${ch.clause_type})` : `${ch.role} (節)`;
        clauseBrackets.push({
          role: ch.role,
          mShade: mShadeLevel,
          inModClause: nextInMod,
          label: bLabel,
          subGroupIndices: allLeafIndices,
          depth: myDepth
        });
      }

      return {
        isContainer: true,
        role: ch.role,
        mShade: mShadeLevel,
        inModClause: nextInMod,
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
        displayRole: isAntecedent ? "先行詞" : ch.role,
        mShade: mShadeLevel,
        inModClause: isAntecedent ? false : inModClause,
        tokens: matched
      });
      return {
        isContainer: false,
        role: ch.role,
        mShade: mShadeLevel,
        inModClause: isAntecedent ? false : inModClause,
        groupIdx: gIdx,
        leafIndices: [gIdx],
        bracketDepth: 0
      };
    }
  }

  let hierarchyRoots = [];
  if (Array.isArray(chunks) && chunks.length > 0) {
    let rootModCounter = 0;
    hierarchyRoots = chunks.map((ch) => {
      const shade = ch.role === "M" ? rootModCounter++ : 0;
      return registerChunkHierarchy(ch, shade, ch.role === "M", false);
    }).filter(Boolean);
  }
  if (groups.length === 0) {
    validTokens.forEach((t, idx) => {
      groups.push({
        role: t.svocm || "Other",
        displayRole: t.svocm || "Other",
        mShade: 0,
        inModClause: false,
        tokens: [t]
      });
      hierarchyRoots.push({
        isContainer: false,
        role: t.svocm || "Other",
        mShade: 0,
        inModClause: false,
        groupIdx: idx,
        leafIndices: [idx],
        bracketDepth: 0
      });
    });
  }

  // 2. 1行に並べる各単語のX座標を計算
  const padX = 48;
  const wordGap = 16;
  const groupGap = 26;
  const tokenCenterX = {};
  const tokenBoxWidth = {};

  let currentX = padX;
  groups.forEach((grp, gIdx) => {
    if (gIdx > 0) currentX += groupGap;
    grp.leftX = currentX;

    grp.tokens.forEach((t, tIdx) => {
      if (tIdx > 0) currentX += wordGap;
      const posLabel = getPosLabel(t);
      const wordW = calcSvgTextWidth(t.text, 15) + 24;
      const posW = calcSvgTextWidth(posLabel, 10.5) + 20;
      const w = Math.max(wordW, posW, 72);
      tokenBoxWidth[t.id] = w;
      tokenCenterX[t.id] = currentX + w / 2;
      currentX += w;
    });

    grp.rightX = currentX;
  });

  // 3. 逆V字の連結ツリー構造（単語同士の結合 -> 句同士の結合 -> 文）を構築
  const mergeEdges = [];
  const mergeNodes = [];

  function createLeafNode(token, inModClause = false, mShade = 0) {
    return {
      x: tokenCenterX[token.id],
      level: 0,
      label: token.text,
      role: token.svocm,
      inModClause,
      mShade
    };
  }

  function mergeTwoNodes(leftNode, rightNode, label, role, inModClause = false, mShade = 0) {
    const level = Math.max(leftNode.level, rightNode.level) + 1;
    const x = (leftNode.x + rightNode.x) / 2;
    const isModNode = inModClause || (leftNode.inModClause && rightNode.inModClause);
    const shadeVal = mShade || leftNode.mShade || rightNode.mShade || 0;
    const parent = {
      x,
      level,
      label,
      role: role || "Phrase",
      inModClause: isModNode,
      mShade: shadeVal
    };
    mergeEdges.push({ parent, left: leftNode, right: rightNode });
    mergeNodes.push(parent);
    return parent;
  }

  // spaCyの親子関係(head_id)を直接たどってチャンク内部の逆V字結合を組み立てる
  function buildIntraGroupTree(tokSlice, role, inModClause = false, mShade = 0) {
    if (tokSlice.length === 1) {
      return createLeafNode(tokSlice[0], inModClause, mShade);
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

      let cur = createLeafNode(headTok, inModClause, mShade);

      for (let i = lefts.length - 1; i >= 0; i--) {
        const leftSub = buildDepSubtree(lefts[i], false);
        const isFinalMerge = isTopLevel && i === 0 && rights.length === 0 && localRoots.length === 1;
        cur = mergeTwoNodes(leftSub, cur, isFinalMerge ? role : "句", isFinalMerge ? role : "Phrase", inModClause, mShade);
      }

      for (let i = 0; i < rights.length; i++) {
        const rightSub = buildDepSubtree(rights[i], false);
        const isFinalMerge = isTopLevel && i === rights.length - 1 && localRoots.length === 1;
        cur = mergeTwoNodes(cur, rightSub, isFinalMerge ? role : "句", isFinalMerge ? role : "Phrase", inModClause, mShade);
      }

      return cur;
    }

    const rootNodes = localRoots.map((r) => buildDepSubtree(r, true));
    let combined = rootNodes[0];
    for (let i = 1; i < rootNodes.length; i++) {
      const isFinal = (i === rootNodes.length - 1);
      combined = mergeTwoNodes(combined, rootNodes[i], isFinal ? role : "句", isFinal ? role : "Phrase", inModClause, mShade);
    }
    combined.label = role;
    combined.role = role;
    combined.inModClause = inModClause;
    combined.mShade = mShade;
    return combined;
  }

  // 各葉チャンクの頂点ノードを作成
  const leafChunkNodes = groups.map((grp) => {
    const node = buildIntraGroupTree(grp.tokens, grp.displayRole || grp.role, grp.inModClause, grp.mShade);
    node.chunkRole = grp.role;
    node.tokens = grp.tokens;
    node.inModClause = grp.inModClause;
    node.mShade = grp.mShade;
    return node;
  });

  // 節内部（または主節）のチャンクノード列を結合して1つの節/文ノードにするヘルパー
  function buildClauseTreeFromNodes(nodesSlice, isTopSentence, inModClause = false, mShade = 0) {
    if (nodesSlice.length === 1) return nodesSlice[0];

    if (nodesSlice[0].chunkRole === "Conj" && nodesSlice.length > 1) {
      const restTree = buildClauseTreeFromNodes(nodesSlice.slice(1), false, inModClause, mShade);
      const topLbl = isTopSentence ? "文 (Sentence)" : "Conj + 節";
      return mergeTwoNodes(nodesSlice[0], restTree, topLbl, isTopSentence ? "Sentence" : "VP", inModClause, mShade);
    }

    const conjIdx = nodesSlice.findIndex((n, idx) => idx > 0 && n.chunkRole === "Conj");
    const firstVIdx = nodesSlice.findIndex((n) => n.chunkRole === "V");
    if (conjIdx !== -1 && firstVIdx !== -1 && conjIdx > firstVIdx) {
      const rightSlice = nodesSlice.slice(conjIdx + 1);
      const rightHasOwnSubjAndVerb = rightSlice.some((n) => n.chunkRole === "S") && rightSlice.some((n) => n.chunkRole === "V");

      if (rightHasOwnSubjAndVerb) {
        const clause1 = buildClauseTreeFromNodes(nodesSlice.slice(0, conjIdx), false, inModClause, mShade);
        const conjNode = nodesSlice[conjIdx];
        const clause2 = buildClauseTreeFromNodes(rightSlice, false, inModClause, mShade);
        const conjRight = mergeTwoNodes(conjNode, clause2, "Conj + 節", "VP", inModClause, mShade);
        const topLbl = isTopSentence ? "文 (重文)" : "節 + 節";
        return mergeTwoNodes(clause1, conjRight, topLbl, isTopSentence ? "Sentence" : "VP", inModClause, mShade);
      }

      if (!rightSlice.some((n) => n.chunkRole === "S")) {
        const prefixNodes = nodesSlice.slice(0, firstVIdx);
        const vp1Nodes = nodesSlice.slice(firstVIdx, conjIdx);
        const conjNode = nodesSlice[conjIdx];
        const vp2Nodes = rightSlice;

        const vp1 = buildClauseTreeFromNodes(vp1Nodes, false, inModClause, mShade);
        const vp2 = buildClauseTreeFromNodes(vp2Nodes, false, inModClause, mShade);
        const conjRight = mergeTwoNodes(conjNode, vp2, "Conj + VP", "VP", inModClause, mShade);
        let combinedVp = mergeTwoNodes(vp1, conjRight, "VP (並列述部)", "VP", inModClause, mShade);

        for (let i = prefixNodes.length - 1; i >= 0; i--) {
          const isTop = isTopSentence && i === 0;
          const pRole = prefixNodes[i].chunkRole;
          const pLabel = isTop ? "文 (Sentence)" : (pRole === "S" ? "S + VP" : `${pRole} + 節`);
          combinedVp = mergeTwoNodes(
            prefixNodes[i],
            combinedVp,
            pLabel,
            isTop ? "Sentence" : "VP",
            inModClause,
            mShade
          );
        }
        return combinedVp;
      }
    }

    const vIdx = nodesSlice.findIndex((n) => n.chunkRole === "V");
    if (vIdx === -1) {
      let cur = nodesSlice[0];
      for (let i = 1; i < nodesSlice.length; i++) {
        const isTop = isTopSentence && i === nodesSlice.length - 1;
        const lbl = (cur.chunkRole === "S" && nodesSlice[i].chunkRole === "C") ? "S + C" : (isTop ? "文 (Sentence)" : "句");
        cur = mergeTwoNodes(cur, nodesSlice[i], lbl, isTop ? "Sentence" : "Phrase", inModClause, mShade);
      }
      return cur;
    }

    const secondVIdx = nodesSlice.findIndex((n, idx) => idx > vIdx && n.chunkRole === "V");
    const hasSubjBetweenV = secondVIdx !== -1 && nodesSlice.slice(vIdx + 1, secondVIdx).some((n) => n.chunkRole === "S");

    if (hasSubjBetweenV) {
      let mainVp = nodesSlice[secondVIdx];
      for (let i = secondVIdx + 1; i < nodesSlice.length; i++) {
        const nextRole = nodesSlice[i].chunkRole;
        const lbl = (nextRole === "O" || nextRole === "C") ? "VP (動詞句)" : "VP (述部)";
        mainVp = mergeTwoNodes(mainVp, nodesSlice[i], lbl, "VP", inModClause, mShade);
      }
      for (let i = secondVIdx - 1; i > vIdx; i--) {
        mainVp = mergeTwoNodes(nodesSlice[i], mainVp, "S + VP", "VP", inModClause, mShade);
      }
      let invNode = mergeTwoNodes(
        nodesSlice[vIdx],
        mainVp,
        isTopSentence && vIdx === 0 ? "文 (倒置)" : "Aux + S + VP",
        isTopSentence && vIdx === 0 ? "Sentence" : "VP",
        inModClause,
        mShade
      );
      for (let i = vIdx - 1; i >= 0; i--) {
        const isTop = isTopSentence && i === 0;
        invNode = mergeTwoNodes(nodesSlice[i], invNode, isTop ? "文 (倒置)" : "倒置節", isTop ? "Sentence" : "VP", inModClause, mShade);
      }
      return invNode;
    }

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
          vpNode = mergeTwoNodes(vpNode, nextNode, pvLabel, "V", inModClause, mShade);
        } else {
          vpNode = mergeTwoNodes(vpNode, nextNode, "V + " + nextRole, "VP", inModClause, mShade);
        }
      } else {
        let mergeLabel = "VP (述部)";
        if (nextRole === "O" && hasSeenObjAfterV && hasSeenCompAfterV) {
          mergeLabel = "VP + 真目的語(O)";
        } else if (nextRole === "O" || nextRole === "C") {
          mergeLabel = "VP (動詞句)";
        } else if (nextRole === "S") {
          mergeLabel = "述部 + 真主語(S)";
        }
        if (nextRole === "O") hasSeenObjAfterV = true;
        if (nextRole === "C") hasSeenCompAfterV = true;

        if (isTopSentence && isLastRight) mergeLabel = "文 (Sentence)";
        vpNode = mergeTwoNodes(vpNode, nextNode, mergeLabel, isTopSentence && isLastRight ? "Sentence" : "VP", inModClause, mShade);
      }
    }

    const leftNodes = nodesSlice.slice(0, vIdx);
    let currentRight = vpNode;
    for (let i = leftNodes.length - 1; i >= 0; i--) {
      const isTop = isTopSentence && i === 0;
      const lRole = leftNodes[i].chunkRole;
      let label = "S + VP";
      if (isTop) {
        label = "文 (Sentence)";
      } else if (lRole === "M" && i > 0 && leftNodes[i - 1].chunkRole === "S") {
        label = "挿入節 + VP";
      } else if (lRole !== "S") {
        label = `${lRole} + 節`;
      }
      currentRight = mergeTwoNodes(leftNodes[i], currentRight, label, isTop ? "Sentence" : "VP", inModClause, mShade);
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
      combined = childNodes[0];
      for (let i = 1; i < childNodes.length; i++) {
        combined = mergeTwoNodes(combined, childNodes[i], item.role, item.role, false, item.mShade);
      }
    } else {
      combined = buildClauseTreeFromNodes(childNodes, false, item.inModClause, item.mShade);
    }
    const nodeLabel = item.clauseType ? `${item.role} (${item.clauseType})` : item.role;
    combined.label = nodeLabel;
    combined.role = item.role;
    combined.chunkRole = item.role;
    combined.inModClause = item.inModClause;
    combined.mShade = item.mShade;
    return combined;
  }

  const topLevelNodes = hierarchyRoots.map((item) => buildNodeFromHierarchyItem(item));
  if (topLevelNodes.length > 1) {
    buildClauseTreeFromNodes(topLevelNodes, true, false, 0);
  }

  // 5. 高さとY座標・横幅の計算（接合部楕円が左右にはみ出さないよう余白を確保）
  let maxRightEdge = currentX + padX;
  mergeNodes.forEach((node) => {
    const halfPill = (calcSvgTextWidth(node.label, 11) + 32) / 2;
    if (node.x + halfPill + 20 > maxRightEdge) {
      maxRightEdge = node.x + halfPill + 20;
    }
  });
  const svgWidth = Math.max(Math.ceil(maxRightEdge), 520);

  const maxLevel = mergeNodes.reduce((max, n) => Math.max(max, n.level), 0);
  const maxBracketDepth = clauseBrackets.reduce((max, b) => Math.max(max, b.depth || 1), 0);
  const levelStepY = 50;
  const topPadY = 42;
  const treeBaseY = topPadY + maxLevel * levelStepY + 12;

  const boxTopY = treeBaseY;
  const wordY = boxTopY + 26;
  const posY = boxTopY + 46;
  const boxBottomY = boxTopY + 58;
  const svgHeight = boxBottomY + (maxBracketDepth > 0 ? 38 + maxBracketDepth * 32 : 36);

  baseTreeWidth = svgWidth;
  baseTreeHeight = svgHeight;

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

  // (B) 逆V字の結合点ラベル（楕円形：テキストがはみ出さず十分な余白を持つサイズに自動調整）を描画
  mergeNodes.forEach((node) => {
    const nx = node.x;
    const ny = getNodeY(node);
    const isSentence = node.role === "Sentence";
    let st;
    if (isSentence) {
      st = { fill: "#0f172a", stroke: "#0f172a", text: "#ffffff" };
    } else if (node.inModClause) {
      st = getRoleVisualStyle(node.role, node.mShade || 0, true);
    } else {
      st = roleStyle[node.role] || { fill: "#ffffff", stroke: "#64748b", text: "#334155" };
    }

    const labelText = node.label;
    const textWidth = calcSvgTextWidth(labelText, 11);
    const pillW = Math.max(textWidth + 28, 46);
    const pillH = 24;

    svgContent += `<rect x="${nx - pillW / 2}" y="${ny - pillH / 2}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" ry="${pillH / 2}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.5" />`;
    svgContent += `<text x="${nx}" y="${ny + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${st.text}">${escapeHtml(labelText)}</text>`;
  });

  // (C) SVOCMの囲み枠と下部ラベルを描画（先行詞は元の色で「先行詞」表示、関係詞節・分詞修飾内部はSVOCMグレースケール）
  groups.forEach((grp) => {
    const st = getRoleVisualStyle(grp.role, grp.mShade || 0, grp.inModClause);
    const x = grp.leftX - 6;
    const w = (grp.rightX - grp.leftX) + 12;
    const h = boxBottomY - boxTopY;

    svgContent += `<rect x="${x}" y="${boxTopY}" width="${w}" height="${h}" rx="8" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2" />`;

    if (grp.role !== "Other") {
      const badgeLabel = grp.displayRole || grp.role;
      const badgeW = Math.max(calcSvgTextWidth(badgeLabel, 11.5) + 16, 36);
      const badgeH = 20;
      const bx = x + w / 2 - badgeW / 2;
      const by = boxBottomY - badgeH / 2 + 2;
      svgContent += `<rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}" rx="6" fill="${st.badge}" />`;
      svgContent += `<text x="${x + w / 2}" y="${by + 14}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ffffff">${escapeHtml(badgeLabel)}</text>`;
    }
  });

  // (C2) 従属節・関係詞節・分詞構文・分詞句をまとめる下部アンダーブラケットを描画
  clauseBrackets.forEach((br) => {
    if (br.subGroupIndices.length === 0) return;
    const firstGrp = groups[br.subGroupIndices[0]];
    const lastGrp = groups[br.subGroupIndices[br.subGroupIndices.length - 1]];
    const st = getRoleVisualStyle(br.role, br.mShade || 0, br.inModClause);

    const depth = br.depth || 1;
    const x1 = firstGrp.leftX - 6;
    const x2 = lastGrp.rightX + 6;
    const midX = (x1 + x2) / 2;
    const bracketY = boxBottomY + 30 * depth;
    const legTopY = bracketY - 12;

    svgContent += `<path d="M ${x1} ${legTopY} L ${x1} ${bracketY} L ${x2} ${bracketY} L ${x2} ${legTopY}" fill="none" stroke="${st.stroke}" stroke-width="2.5" stroke-linecap="round" />`;
    const bText = br.label || `${br.role} (節)`;
    const bw = Math.max(calcSvgTextWidth(bText, 11) + 24, 58);
    const bh = 22;
    svgContent += `<rect x="${midX - bw / 2}" y="${bracketY - bh / 2}" width="${bw}" height="${bh}" rx="8" fill="${st.badge}" />`;
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

// 6. 日本語分析結果の描画（1つずつ縦並び・Mのグレー濃淡変化に対応）
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
  let jaModCounter = 0;
  data.clauses.forEach((c) => {
    const shade = c.role === "M" ? jaModCounter++ : 0;
    clausesContainer.appendChild(createChunkElement(c, shade));
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