import {
  checkEnglishSpelling,
  normalizeEnglishInput,
  validateLanguageInput
} from "./js/spelling.js";
import {
  annotateSpecialRolesAndRelatives,
  buildDisplayChunksHierarchy
} from "./js/chunk_logic.js";
import {
  renderChunks,
  renderGrammarCheckTable,
  renderTokensTable
} from "./js/chunk_renderer.js";
import { buildHierarchicalTreeSvg } from "./js/tree_renderer.js";

// ★ここにRenderで発行されたURLを設定してください（末尾の / は不要）
const API_BASE_URL = "https://svocm-api.onrender.com";

// DOM要素の取得
const authModal = document.getElementById("auth-modal");
const passwordInput = document.getElementById("password-input");
const authError = document.getElementById("auth-error");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const serverStatus = document.getElementById("server-status");
const statusText = document.getElementById("status-text");

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
const warningBox = document.getElementById("warning-box");
const loadingBox = document.getElementById("loading");
const enResult = document.getElementById("en-result");
const interpretationTabs = document.getElementById("en-interpretation-tabs");

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
loginBtn.addEventListener("click", async () => {
  const pwd = passwordInput.value.trim();
  if (!pwd) {
    authError.textContent = "パスワードを入力してください。";
    authError.classList.remove("hidden");
    return;
  }

  loginBtn.disabled = true;
  authError.classList.add("hidden");

  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${pwd}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem("svocm_api_token");
      authError.textContent = "パスワードが正しくありません。";
      authError.classList.remove("hidden");
      return;
    }

    if (!response.ok) {
      throw new Error(`Status error: ${response.status}`);
    }

    sessionStorage.setItem("svocm_api_token", pwd);
    authError.classList.add("hidden");
    authModal.classList.add("hidden");
    serverStatus.className = "status-badge online";
    statusText.textContent = "サーバー準備完了";
  } catch (err) {
    authError.textContent = "サーバーに接続できませんでした。起動完了後に再度お試しください。";
    authError.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
  }
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
    if (warningBox) warningBox.classList.add("hidden");
    enResult.classList.add("hidden");
    inputText.focus();
  });
}

// 統語ツリーの拡大・縮小処理
function applyTreeZoom(zoomValue) {
  currentTreeZoom = Math.min(Math.max(zoomValue, 0.1), 2.5);
  const svgEl = document.querySelector("#en-tree svg");
  if (svgEl) {
    svgEl.setAttribute("width", Math.round(baseTreeWidth * currentTreeZoom));
    svgEl.setAttribute("height", Math.round(baseTreeHeight * currentTreeZoom));
  }
  if (zoomLevelText) {
    zoomLevelText.textContent = `${Math.round(currentTreeZoom * 100)}%`;
  }
}

// 統語ツリー全体が枠内にちょうど収まる倍率を計算して適用する関数
function fitTreeToContainer() {
  const treeContainer = document.getElementById("en-tree");
  if (treeContainer && baseTreeWidth > 0) {
    const containerW = Math.max(treeContainer.clientWidth - 24, 200);
    const fitScale = Math.min(1.0, containerW / baseTreeWidth);
    applyTreeZoom(fitScale);
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
  zoomFitBtn.addEventListener("click", () => fitTreeToContainer());
}

// 4. 分析リクエストの送信
analyzeBtn.addEventListener("click", async () => {
  const rawText = inputText.value.trim();
  const text = normalizeEnglishInput(rawText);
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
  if (warningBox) warningBox.classList.add("hidden");

  // ① 言語チェック（不一致の場合は警告を出して分析しない）
  const langError = validateLanguageInput(text);
  if (langError) {
    showError(langError);
    return;
  }

  enResult.classList.add("hidden");
  loadingBox.classList.remove("hidden");
  analyzeBtn.disabled = true;

  try {
    // スペルチェックとAPI解析を並行実行
    const spellPromise = checkEnglishSpelling(text);

    const response = await fetch(`${API_BASE_URL}/analyze/english`, {
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
    const spellWarnings = await spellPromise;

    if (spellWarnings.length > 0) {
      showWarning(`スペルミスの可能性がある単語が含まれています: ${spellWarnings.join(" / ")}`);
    }

    // 通信成功時はステータスをオンラインに更新
    serverStatus.className = "status-badge online";
    statusText.textContent = "サーバー準備完了";

    renderEnglishResult(data);
  } catch (err) {
    showError(err.message || "サーバーとの通信に失敗しました。URLまたはネットワークを確認してください。");
  } finally {
    loadingBox.classList.add("hidden");
    analyzeBtn.disabled = false;
  }
});

// 5. 英文分析結果の描画（単一解釈の描画と、両義ケースのタブ切り替え）
function renderEnglishInterpretation(viewData, fullText) {
  const clonedChunks = JSON.parse(JSON.stringify(viewData.chunks || []));
  const clonedTokens = JSON.parse(JSON.stringify(viewData.tokens || []));

  document.getElementById("en-pattern").textContent = viewData.pattern;

  // ⑤ 形式主語・真主語・形式目的語・真目的語の()付き表記および関係詞表記の適用
  annotateSpecialRolesAndRelatives(clonedChunks, clonedTokens, fullText);

  // チャンクの描画（並列動詞句・並列句も入れ子構造に変換し、本文の核となるSVOC以外は階層ごとのグレーで表示）
  const displayChunks = buildDisplayChunksHierarchy(clonedChunks, clonedTokens, true);
  renderChunks(document.getElementById("en-chunks"), displayChunks);

  // 文法網羅チェッカー（13項目）の描画
  renderGrammarCheckTable(
    document.getElementById("en-grammar-check-body"),
    viewData.grammar_check
  );

  // トークン一覧テーブルの描画
  renderTokensTable(document.getElementById("en-tokens-body"), clonedTokens);

  // ③ 結果セクションを表示状態にしてから統語ツリーを描画し、全体が範囲にちょうど収まる倍率を初期適用する
  enResult.classList.remove("hidden");

  const treeContainer = document.getElementById("en-tree");
  const treeResult = buildHierarchicalTreeSvg(clonedTokens, clonedChunks);
  treeContainer.innerHTML = treeResult.svg;
  baseTreeWidth = treeResult.width;
  baseTreeHeight = treeResult.height;
  fitTreeToContainer();
}

function renderEnglishResult(data) {
  const interpretations = Array.isArray(data.interpretations) ? data.interpretations : [];

  if (interpretationTabs) {
    interpretationTabs.innerHTML = "";
    if (interpretations.length >= 2) {
      const labelSpan = document.createElement("span");
      labelSpan.className = "interpretation-label";
      labelSpan.textContent = "解釈の切替";
      interpretationTabs.appendChild(labelSpan);

      const btnGroup = document.createElement("div");
      btnGroup.className = "interpretation-btn-group";

      interpretations.forEach((item, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `interpretation-tab-btn${idx === 0 ? " active" : ""}`;
        btn.textContent = item.label || item.key || `解釈${idx + 1}`;
        btn.setAttribute("aria-pressed", String(idx === 0));
        btn.addEventListener("click", () => {
          btnGroup.querySelectorAll(".interpretation-tab-btn").forEach((b, bIdx) => {
            const isActive = bIdx === idx;
            b.classList.toggle("active", isActive);
            b.setAttribute("aria-pressed", String(isActive));
          });
          renderEnglishInterpretation(item, data.text);
        });
        btnGroup.appendChild(btn);
      });

      interpretationTabs.appendChild(btnGroup);
      interpretationTabs.classList.remove("hidden");
      renderEnglishInterpretation(interpretations[0], data.text);
      return;
    }
    interpretationTabs.classList.add("hidden");
  }

  renderEnglishInterpretation(data, data.text);
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function showWarning(msg) {
  if (!warningBox) return;
  warningBox.textContent = msg;
  warningBox.classList.remove("hidden");
}