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
const warningBox = document.getElementById("warning-box");
const loadingBox = document.getElementById("loading");
const enResult = document.getElementById("en-result");
const jaResult = document.getElementById("ja-result");

// 頻出英単語スペルミス辞書
const COMMON_MISSPELLINGS = {
  teh: "the",
  recieve: "receive",
  recieved: "received",
  occured: "occurred",
  occuring: "occurring",
  seperate: "separate",
  definately: "definitely",
  definitly: "definitely",
  accomodate: "accommodate",
  untill: "until",
  beggining: "beginning",
  convinient: "convenient",
  techonological: "technological",
  arguement: "argument",
  beleive: "believe",
  enviroment: "environment",
  goverment: "government",
  independant: "independent",
  neccessary: "necessary",
  occassion: "occasion",
  priviledge: "privilege",
  recomend: "recommend",
  succesful: "successful",
  successfull: "successful",
  tommorow: "tomorrow",
  wierd: "weird",
  writting: "writing",
  freind: "friend",
  knowlege: "knowledge",
  maintainance: "maintenance",
  percieve: "perceive",
  appearence: "appearance",
  buisness: "business",
  calender: "calendar",
  collegue: "colleague",
  concious: "conscious",
  curiousity: "curiosity",
  dissapear: "disappear",
  embarass: "embarrass",
  existance: "existence",
  foriegn: "foreign",
  fourty: "forty",
  grammer: "grammar",
  harrass: "harass",
  immediatly: "immediately",
  lonley: "lonely",
  millenium: "millennium",
  mispell: "misspell",
  noticable: "noticeable",
  parliment: "parliament",
  persistant: "persistent",
  politican: "politician",
  posession: "possession",
  prefered: "preferred",
  publically: "publicly",
  realy: "really",
  refered: "referred",
  religous: "religious",
  rember: "remember",
  sieze: "seize",
  similer: "similar",
  speach: "speech",
  stoped: "stopped",
  studing: "studying",
  suprise: "surprise",
  tendancy: "tendency",
  therefor: "therefore",
  threshhold: "threshold",
  truely: "truly",
  unfortunatly: "unfortunately",
  whereever: "wherever",
  wich: "which",
  peopel: "people",
  becuase: "because",
  thier: "their",
  alothough: "although",
  thoought: "thought",
  recogize: "recognize"
};

// 母音なしでも許容される略語・語彙セット
const ALLOWED_NO_VOWEL_WORDS = new Set([
  "mr", "mrs", "ms", "dr", "st", "vs", "etc", "tv", "pc", "ai", "it", "uk", "us", "un", "eu",
  "by", "my", "try", "fly", "cry", "dry", "shy", "sky", "spy", "why", "gym", "myth", "rhythm", "lynx", "hymn",
  "shh", "hmm", "brr", "nth"
]);

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
    if (warningBox) warningBox.classList.add("hidden");
    enResult.classList.add("hidden");
    jaResult.classList.add("hidden");
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

// 3. 英語 / 日本語モードの切り替え
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;

    errorBox.classList.add("hidden");
    if (warningBox) warningBox.classList.add("hidden");
    enResult.classList.add("hidden");
    jaResult.classList.add("hidden");

    if (currentMode === "english") {
      inputText.placeholder = "ここに分析したい英文を入力してください（例: Reading English books makes your vocabulary richer.）";
    } else {
      inputText.placeholder = "ここに英訳したい日本語文を入力してください（例: 私が昨日見た男性はその少年の父親だった。）";
    }
  });
});

// ① 入力言語のバリデーション（英語モードは英語のみ、日本語モードは日本語のみ）
function validateLanguageInput(text, mode) {
  const hasJaChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF01-\uFF60]/.test(text);
  const hasKanaOrKanji = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
  const hasEnAlpha = /[a-zA-Z]/.test(text);

  if (mode === "english") {
    if (hasJaChars || !hasEnAlpha) {
      return "英文分析モードでは英語で入力してください（日本語や全角記号が含まれているか、英単語が入力されていません）。";
    }
  } else if (mode === "japanese") {
    if (!hasKanaOrKanji) {
      return "日本語分析モードでは日本語で入力してください。";
    }
  }
  return null;
}

// ② 英語スペルミス検査（ローカル辞書＋綴り字ルール＋Datamuse辞書API照会）
async function checkEnglishSpelling(text) {
  const rawWords = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  const findings = [];
  const seenLower = new Set();
  const candidatesForApi = [];

  for (const raw of rawWords) {
    if (raw.includes("'")) continue;
    const lower = raw.toLowerCase();
    if (seenLower.has(lower)) continue;
    seenLower.add(lower);

    // 1. 頻出タイポ辞書に一致
    if (COMMON_MISSPELLINGS[lower]) {
      findings.push(`"${raw}"（候補: ${COMMON_MISSPELLINGS[lower]}）`);
      continue;
    }

    // 2. 同じ文字が3連続以上（例: goood, theee）
    if (/(.)\1\1/i.test(raw)) {
      findings.push(`"${raw}"`);
      continue;
    }

    // 3. 母音(a,e,i,o,u,y)が1つもない2文字以上の小文字語
    if (lower.length >= 2 && !/[aeiouy]/.test(lower) && !ALLOWED_NO_VOWEL_WORDS.has(lower) && raw === lower) {
      findings.push(`"${raw}"`);
      continue;
    }

    // 4. オンライン辞書APIによるチェック対象（固有名詞の可能性がある先頭大文字語以外の3文字以上の単語）
    if (lower.length >= 3 && (raw === lower || text.trim().startsWith(raw))) {
      candidatesForApi.push(raw);
    }
  }

  // Datamuse APIでスペル実在確認（タイムアウト1.5秒）
  if (candidatesForApi.length > 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    try {
      await Promise.all(
        candidatesForApi.slice(0, 20).map(async (word) => {
          const low = word.toLowerCase();
          const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(low)}&max=5`, {
            signal: controller.signal
          });
          if (!res.ok) return;
          const list = await res.json();
          const exactMatch = Array.isArray(list) && list.some((item) => item.word && item.word.toLowerCase() === low);
          if (!exactMatch) {
            const sugRes = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(low)}&max=3`, {
              signal: controller.signal
            });
            let suggestionText = "";
            if (sugRes.ok) {
              const sugList = await sugRes.json();
              if (Array.isArray(sugList) && sugList.length > 0) {
                const topSug = sugList[0].word;
                if (topSug && topSug.toLowerCase() !== low) {
                  suggestionText = `（候補: ${topSug}）`;
                }
              }
            }
            findings.push(`"${word}"${suggestionText}`);
          }
        })
      );
    } catch (_) {
      // ネットワーク制限やタイムアウト時はローカル検出結果のみ使用
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return findings;
}

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
  if (warningBox) warningBox.classList.add("hidden");

  // ① 言語チェック（不一致の場合は警告を出して分析しない）
  const langError = validateLanguageInput(text, currentMode);
  if (langError) {
    showError(langError);
    return;
  }

  enResult.classList.add("hidden");
  jaResult.classList.add("hidden");
  loadingBox.classList.remove("hidden");
  analyzeBtn.disabled = true;

  const endpoint = currentMode === "english" ? "/analyze/english" : "/analyze/japanese";

  try {
    // 英語モードの場合はスペルチェックとAPI解析を並行実行
    const spellPromise = currentMode === "english" ? checkEnglishSpelling(text) : Promise.resolve([]);

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
    const spellWarnings = await spellPromise;

    if (spellWarnings.length > 0) {
      showWarning(`スペルミスの可能性がある単語が含まれています: ${spellWarnings.join(" / ")}`);
    }

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
    (s) => s.role === "M" && s.clause_type && /関係詞|接触節|分詞|同格|修飾/.test(s.clause_type)
  );
  const hasNonModSub = chunk.sub_chunks.some((s) => s.role !== "M");
  return hasModSub && hasNonModSub;
}

// 入れ子チャンクが関係詞節（関係詞・接触節）による修飾構造を持っているか判定するヘルパー
function hasRelativeModifierSubChunk(chunk) {
  if (!Array.isArray(chunk.sub_chunks) || chunk.sub_chunks.length < 2) return false;
  return chunk.sub_chunks.some(
    (s) => s.role === "M" && s.clause_type && /関係詞|接触節/.test(s.clause_type)
  );
}

// ⑤ 関係詞の判定および「形式主語・真主語・形式目的語・真目的語」の()付きラベル付与を行う関数
const RELATIVE_WORD_REGEX = /^(who|whom|whose|which|that|where|when|why|what|whatever|whoever|whomever|whichever|wherever|whenever|however)$/i;
const PREP_RELATIVE_REGEX = /^(in|on|at|to|for|from|with|by|of|about|through|under|over|between|among|into|onto|upon|within|without|during|after|before|against|toward|towards)\s+(which|whom|whose)$/i;
const FREE_REL_REGEX = /^(what|whatever|whoever|whomever|whichever|wherever|whenever|however)$/i;

function isRelativeChunkText(text, isInsideRelClause, isQuestionSentence) {
  const clean = String(text || "").trim();
  if (!clean) return false;
  if (PREP_RELATIVE_REGEX.test(clean)) return true;
  if (isInsideRelClause && RELATIVE_WORD_REGEX.test(clean)) return true;
  if (!isQuestionSentence && FREE_REL_REGEX.test(clean)) return true;
  return false;
}

function annotateSpecialRolesAndRelatives(chunks, tokens, fullText = "") {
  if (!Array.isArray(chunks)) return;
  const isQuestion = String(fullText || "").trim().endsWith("?");
  const relTokenIds = new Set();
  const specialTokenLabels = {};

  function processChunkList(chunkList, parentClauseType = "") {
    if (!Array.isArray(chunkList) || chunkList.length === 0) return;

    // 1. 形式主語 (It) と 真主語 の検出
    const sChunks = chunkList.filter((c) => c.role === "S");
    if (sChunks.length >= 2 && String(sChunks[0].text || "").trim().toLowerCase() === "it") {
      sChunks[0].displayRoleLabel = "S (形式主語)";
      sChunks[0].clause_type = "形式主語";
      for (let idx = sChunks[0].start; idx <= sChunks[0].end; idx++) {
        specialTokenLabels[idx] = "S (形式主語)";
      }
      for (let i = 1; i < sChunks.length; i++) {
        sChunks[i].displayRoleLabel = "S (真主語)";
        sChunks[i].clause_type = "真主語";
        for (let idx = sChunks[i].start; idx <= sChunks[i].end; idx++) {
          specialTokenLabels[idx] = "S (真主語)";
        }
      }
    }

    // 2. 形式目的語 (it) と 真目的語 の検出
    const oChunks = chunkList.filter((c) => c.role === "O");
    const hasC = chunkList.some((c) => c.role === "C");
    if (
      oChunks.length >= 2 &&
      String(oChunks[0].text || "").trim().toLowerCase() === "it" &&
      (hasC || oChunks[1].clause_type || Array.isArray(oChunks[1].sub_chunks))
    ) {
      oChunks[0].displayRoleLabel = "O (形式目的語)";
      oChunks[0].clause_type = "形式目的語";
      for (let idx = oChunks[0].start; idx <= oChunks[0].end; idx++) {
        specialTokenLabels[idx] = "O (形式目的語)";
      }
      for (let i = 1; i < oChunks.length; i++) {
        oChunks[i].displayRoleLabel = "O (真目的語)";
        oChunks[i].clause_type = "真目的語";
        for (let idx = oChunks[i].start; idx <= oChunks[i].end; idx++) {
          specialTokenLabels[idx] = "O (真目的語)";
        }
      }
    }

    // 既存の clause_type に「真主語」「真目的語」が含まれている場合の統一
    chunkList.forEach((c) => {
      if (c.clause_type && c.clause_type.includes("真主語")) {
        c.displayRoleLabel = "S (真主語)";
        c.clause_type = "真主語";
      } else if (c.clause_type && c.clause_type.includes("真目的語")) {
        c.displayRoleLabel = "O (真目的語)";
        c.clause_type = "真目的語";
      }
    });

    // 3. 関係詞の検出（関係詞節・非制限関係詞節・複合関係詞節の先頭関係詞）
    const isRelContext = /関係詞/.test(parentClauseType || "");
    chunkList.forEach((c, idx) => {
      if (idx <= 1 && isRelativeChunkText(c.text, isRelContext, isQuestion && c.start === 0)) {
        c.role = "関係詞";
        c.displayRoleLabel = "関係詞";
        delete c.clause_type;
        if (typeof c.start === "number" && typeof c.end === "number") {
          for (let ti = c.start; ti <= c.end; ti++) {
            relTokenIds.add(ti);
          }
        }
      }

      if (Array.isArray(c.sub_chunks) && c.sub_chunks.length > 0) {
        processChunkList(c.sub_chunks, c.clause_type || "");
      }
    });
  }

  processChunkList(chunks, "");

  // トークン一覧データ側にも関係詞・形式主語/真主語/形式目的語/真目的語を反映
  if (Array.isArray(tokens)) {
    tokens.forEach((t) => {
      if (relTokenIds.has(t.id)) {
        t.svocm = "関係詞";
      } else if (specialTokenLabels[t.id]) {
        t.svocm = specialTokenLabels[t.id];
      }
    });
  }
}

// 深さレベル(0:最内 〜 3:最外)を 0〜3 のグレーインデックスに変換するヘルパー
function clampGrayLevel(level) {
  return Math.min(Math.max(Math.round(level), 0), 3);
}

// ④ 節（チャンクの塊）ごとのグレーレベルを計算するヘルパー（最内の節が 0、外側の節に行くにつれて +1）
function getChunkGrayLevel(chunk) {
  if (!chunk || !Array.isArray(chunk.sub_chunks) || chunk.sub_chunks.length === 0) {
    return 0;
  }
  if (hasAdnominalModifierSubChunk(chunk)) {
    let maxModLevel = 0;
    chunk.sub_chunks.forEach((sub) => {
      if (Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0) {
        const lv = getChunkGrayLevel(sub);
        if (lv > maxModLevel) maxModLevel = lv;
      }
    });
    return clampGrayLevel(maxModLevel + 1);
  }
  let maxRequiredLevel = 0;
  chunk.sub_chunks.forEach((sub) => {
    if (Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0) {
      const subLv = getChunkGrayLevel(sub);
      const reqLv = hasAdnominalModifierSubChunk(sub) ? subLv : subLv + 1;
      if (reqLv > maxRequiredLevel) maxRequiredLevel = reqLv;
    }
  });
  return clampGrayLevel(maxRequiredLevel);
}

// チャンクの表示用ロール文字列を取得するヘルパー
function getChunkDisplayRoleText(chunk, includeClauseType = true) {
  if (chunk.displayRoleLabel) {
    return chunk.displayRoleLabel;
  }
  if (includeClauseType && chunk.clause_type) {
    return `${chunk.role} (${chunk.clause_type})`;
  }
  return `${chunk.role}`;
}

// 1つのインライン要素（先行詞や節内のチャンクチップ）を生成するヘルパー
function createInlineChunkChip(text, roleLabel, colorClass) {
  const chip = document.createElement("div");
  chip.className = `inline-chunk-item ${colorClass}`;
  chip.innerHTML = `
    <span class="inline-chunk-text">${escapeHtml(text)}</span>
    <span class="chunk-role">${escapeHtml(roleLabel)}</span>
  `;
  return chip;
}

// 修飾節・従属節の内部要素を、同じ節内の要素は同じグレー（外側がグレーA、内側の入れ子節がグレーB）で統一して展開するヘルパー
function appendFlattenedModifierItems(container, subChunkList, forceGrayScale, currentGrayLevel = 0) {
  const shadeClassForCurrent = `m-shade-${clampGrayLevel(currentGrayLevel)}`;

  subChunkList.forEach((item, idx) => {
    if (idx > 0) {
      const sep = document.createElement("span");
      sep.className = "sub-chunk-sep";
      sep.textContent = "/";
      container.appendChild(sep);
    }

    const safeRole = String(item.role).replace("+", "");

    if (Array.isArray(item.sub_chunks) && item.sub_chunks.length > 0) {
      if (hasAdnominalModifierSubChunk(item)) {
        // 節内の要素が「先行詞 + 関係詞節」等を持つ場合：被修飾語はこの節と同じグレー(currentGrayLevel)、修飾節は1段薄い内側のグレーで統一
        const isRelMod = hasRelativeModifierSubChunk(item);
        let hasAppendedSub = false;
        item.sub_chunks.forEach((sub) => {
          if (hasAppendedSub) {
            const subSep = document.createElement("span");
            subSep.className = "sub-chunk-sep";
            subSep.textContent = "/";
            container.appendChild(subSep);
          }
          if (sub.role !== "M" && sub.role !== "関係詞" && sub.role !== "Conj") {
            const antColor = forceGrayScale ? shadeClassForCurrent : `role-${safeRole}`;
            const antLabel = isRelMod
              ? `${item.role} (先行詞)`
              : (sub.displayRoleLabel || item.displayRoleLabel || sub.role);
            container.appendChild(createInlineChunkChip(sub.text, antLabel, antColor));
            hasAppendedSub = true;
          } else if (Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0) {
            const subLv = getChunkGrayLevel(sub);
            const groupWrap = document.createElement("div");
            groupWrap.className = `mod-clause-group m-shade-${subLv}`;
            appendFlattenedModifierItems(groupWrap, sub.sub_chunks, true, subLv);
            container.appendChild(groupWrap);
            hasAppendedSub = true;
          } else {
            container.appendChild(createInlineChunkChip(sub.text, getChunkDisplayRoleText(sub, true), shadeClassForCurrent));
            hasAppendedSub = true;
          }
        });
      } else {
        // 内側の入れ子節（【that S2 V2】など）は、その節固有のグレー(subLv)の枠で囲み、内部要素もすべて同じ subLv で統一
        const subLv = getChunkGrayLevel(item);
        const groupWrap = document.createElement("div");
        groupWrap.className = `mod-clause-group m-shade-${subLv}`;
        appendFlattenedModifierItems(groupWrap, item.sub_chunks, true, subLv);
        container.appendChild(groupWrap);
      }
    } else {
      const roleLabel = getChunkDisplayRoleText(item, true);
      // 同じ節に直接属する要素（that, S1, V1 など）はすべて親節と同じグレー(currentGrayLevel)で統一
      const colorClass = forceGrayScale ? shadeClassForCurrent : `role-${safeRole}`;
      container.appendChild(createInlineChunkChip(item.text, roleLabel, colorClass));
    }
  });
}

// チャンク要素（展開ボタン付き・節単位のグレー統一・内から外に行くにつれて濃いグレー）を生成する関数
function createChunkElement(chunk) {
  const div = document.createElement("div");
  const safeRole = String(chunk.role).replace("+", "");
  const isMod = safeRole === "M" || safeRole === "関係詞";
  const chunkGrayLevel = getChunkGrayLevel(chunk);
  const outerGrayLevel = Array.isArray(chunk.sub_chunks) && chunk.sub_chunks.length > 0
    ? chunkGrayLevel
    : 2;
  const shadeClass = isMod ? ` m-shade-${outerGrayLevel}` : "";

  if (Array.isArray(chunk.sub_chunks) && chunk.sub_chunks.length > 0) {
    div.className = `chunk-box chunk-nested role-${safeRole}${shadeClass}`;
    const isAdnominal = hasAdnominalModifierSubChunk(chunk);
    const headerRoleLabel = getChunkDisplayRoleText(chunk, !isAdnominal);

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
      // 先行詞 + 関係詞節/接触節 または 被修飾語 + 分詞句 等 の構造
      const isRelMod = hasRelativeModifierSubChunk(chunk);
      let hasAppendedAny = false;

      chunk.sub_chunks.forEach((sub) => {
        if (hasAppendedAny) {
          const sep = document.createElement("span");
          sep.className = "sub-chunk-sep";
          sep.textContent = "/";
          subContainer.appendChild(sep);
        }

        if (sub.role !== "M" && sub.role !== "関係詞" && sub.role !== "Conj") {
          // 被修飾語：Mチャンクなら外側のグレー(chunkGrayLevel)、S/O/Cなら元の骨格カラー
          const antColorClass = isMod ? `m-shade-${chunkGrayLevel}` : `role-${safeRole}`;
          const antLabel = isRelMod
            ? "先行詞"
            : (sub.displayRoleLabel || chunk.displayRoleLabel || sub.role);
          subContainer.appendChild(createInlineChunkChip(sub.text, antLabel, antColorClass));
          hasAppendedAny = true;
        } else if (Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0) {
          // 関係詞節・接触節・分詞修飾のまとまり枠（内部要素もすべて subLv で統一）
          const subLv = getChunkGrayLevel(sub);
          const groupWrap = document.createElement("div");
          groupWrap.className = `mod-clause-group m-shade-${subLv}`;
          appendFlattenedModifierItems(groupWrap, sub.sub_chunks, true, subLv);
          subContainer.appendChild(groupWrap);
          hasAppendedAny = true;
        } else {
          subContainer.appendChild(createInlineChunkChip(sub.text, getChunkDisplayRoleText(sub, true), `m-shade-${chunkGrayLevel}`));
          hasAppendedAny = true;
        }
      });
    } else {
      // 名詞節・副詞節・分詞構文・付帯状況などの内部展開（この節の要素はすべて chunkGrayLevel で統一）
      const useGrayForInner = isMod || Boolean(chunk.clause_type);
      appendFlattenedModifierItems(subContainer, chunk.sub_chunks, useGrayForInner, chunkGrayLevel);
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
    const typeLabel = getChunkDisplayRoleText(chunk, true);
    div.innerHTML = `
      <span class="chunk-text">${escapeHtml(chunk.text)}</span>
      <span class="chunk-role">${escapeHtml(typeLabel)}</span>
    `;
  }
  return div;
}

// チャンク範囲のトークン列からカンマ等を含む自然な英文テキストを復元するヘルパー
function joinChunkSpanText(chunkSlice, tokens) {
  if (!Array.isArray(chunkSlice) || chunkSlice.length === 0) return "";
  const startId = chunkSlice[0].start;
  const endId = chunkSlice[chunkSlice.length - 1].end;
  if (Array.isArray(tokens) && typeof startId === "number" && typeof endId === "number") {
    const spanTokens = tokens.filter((t) => t.id >= startId && t.id <= endId);
    if (spanTokens.length > 0) {
      let text = "";
      spanTokens.forEach((t, idx) => {
        if (idx > 0 && !/^[,.;:!?)]$/.test(t.text)) {
          text += " ";
        }
        text += t.text;
      });
      return text;
    }
  }
  return chunkSlice.map((c) => c.text).join(" ");
}

const CORRELATIVE_LEAD_REGEX = /^(both|either|neither|not\s+only|not\s+just|not\s+merely)$/i;

// 2つのチャンク間にカンマ・セミコロンが存在するか判定するヘルパー
function hasCommaBetweenChunks(prevChunk, nextChunk, tokens) {
  if (!Array.isArray(tokens) || !prevChunk || !nextChunk) return true;
  if (typeof prevChunk.end !== "number" || typeof nextChunk.start !== "number") return true;
  return tokens.some(
    (t) => t.id > prevChunk.end && t.id < nextChunk.start && /^[,;]$/.test(t.text)
  );
}

// 形式主語/真主語・形式目的語/真目的語を区別するためのキーを取得するヘルパー
function getSpecialRoleKey(item) {
  const disp = String(item.displayRoleLabel || "");
  if (disp.includes("形式主語")) return "formal_S";
  if (disp.includes("真主語")) return "true_S";
  if (disp.includes("形式目的語")) return "formal_O";
  if (disp.includes("真目的語")) return "true_O";
  return item.role || item.chunkRole || "";
}

// 同じ役割（S/O/C/M）の並列チャンク列（A, B, and C や both A and B）を1つの「並列句/並列節」チャンクへ入れ子化するヘルパー
function collapseCoordinatedArgChunks(chunkList, tokens, isTopLevel = false) {
  const result = [];
  let i = 0;
  while (i < chunkList.length) {
    let hasLeadPreconj = false;
    let firstRoleIdx = i;

    if (
      chunkList[i].role === "Conj" &&
      CORRELATIVE_LEAD_REGEX.test(String(chunkList[i].text || "").trim()) &&
      i + 1 < chunkList.length &&
      ["S", "O", "C", "M"].includes(chunkList[i + 1].role)
    ) {
      hasLeadPreconj = true;
      firstRoleIdx = i + 1;
    }

    const role = chunkList[firstRoleIdx].role;
    if (role === "S" || role === "O" || role === "C" || role === "M") {
      const baseKey = getSpecialRoleKey(chunkList[firstRoleIdx]);
      let j = firstRoleIdx + 1;
      let hasConj = false;

      while (j < chunkList.length) {
        if (
          chunkList[j].role === "Conj" &&
          j + 1 < chunkList.length &&
          chunkList[j + 1].role === role &&
          getSpecialRoleKey(chunkList[j + 1]) === baseKey
        ) {
          hasConj = true;
          j += 2;
        } else if (
          !hasConj &&
          chunkList[j].role === role &&
          getSpecialRoleKey(chunkList[j]) === baseKey &&
          hasCommaBetweenChunks(chunkList[j - 1], chunkList[j], tokens)
        ) {
          let k = j + 1;
          let conjAhead = false;
          while (k < chunkList.length) {
            if (
              chunkList[k].role === "Conj" &&
              k + 1 < chunkList.length &&
              chunkList[k + 1].role === role &&
              getSpecialRoleKey(chunkList[k + 1]) === baseKey
            ) {
              conjAhead = true;
              break;
            } else if (
              chunkList[k].role === role &&
              getSpecialRoleKey(chunkList[k]) === baseKey &&
              hasCommaBetweenChunks(chunkList[k - 1], chunkList[k], tokens)
            ) {
              k++;
            } else {
              break;
            }
          }
          if (conjAhead) {
            j++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      const startSliceIdx = hasLeadPreconj ? i : firstRoleIdx;
      const isEntireNonTopList = !isTopLevel && startSliceIdx === 0 && j === chunkList.length;
      if (hasConj && j - firstRoleIdx >= 3 && !isEntireNonTopList) {
        const seq = chunkList.slice(startSliceIdx, j);
        const roleItems = seq.filter((c) => c.role === role);
        const firstClauseType = chunkList[firstRoleIdx].clause_type;
        const allSameClauseType =
          firstClauseType && roleItems.every((c) => c.clause_type === firstClauseType);
        const allAreClauses = roleItems.every(
          (c) => Boolean(c.clause_type) || (Array.isArray(c.sub_chunks) && c.sub_chunks.length > 0)
        );
        let coordClauseType = "並列句";
        if (allSameClauseType) {
          coordClauseType = firstClauseType.includes("並列")
            ? firstClauseType
            : `${firstClauseType}・並列`;
        } else if (allAreClauses) {
          coordClauseType = "並列節";
        }
        result.push({
          text: joinChunkSpanText(seq, tokens),
          role: role,
          displayRoleLabel: chunkList[firstRoleIdx].displayRoleLabel || null,
          clause_type: coordClauseType,
          start: seq[0].start,
          end: seq[seq.length - 1].end,
          sub_chunks: seq
        });
        i = j;
        continue;
      }
    }
    result.push(chunkList[i]);
    i++;
  }
  return result;
}

// チャンクブロック表示用に「VO, VO, and VO」の並列動詞句、「V, V, and V + O」の並列動詞、「A, B, and C」の並列句を入れ子構造(sub_chunks)に変換する関数
function buildDisplayChunksHierarchy(rawChunkList, tokens, isTopLevel = false) {
  if (!Array.isArray(rawChunkList) || rawChunkList.length === 0) return [];

  // 1. 既存の sub_chunks 内部を再帰的に階層化
  const clonedList = rawChunkList.map((ch) => {
    const copy = { ...ch };
    if (Array.isArray(ch.sub_chunks) && ch.sub_chunks.length > 0) {
      if (hasAdnominalModifierSubChunk(ch)) {
        copy.sub_chunks = ch.sub_chunks.map((sub) => {
          if (Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0) {
            return {
              ...sub,
              sub_chunks: buildDisplayChunksHierarchy(sub.sub_chunks, tokens, false)
            };
          }
          return { ...sub };
        });
      } else {
        copy.sub_chunks = buildDisplayChunksHierarchy(ch.sub_chunks, tokens, false);
        if (!copy.clause_type && copy.sub_chunks.some((s) => s.role === "Conj")) {
          const innerRoleItems = copy.sub_chunks.filter((s) => s.role === copy.role);
          const firstInnerType = innerRoleItems.length > 0 ? innerRoleItems[0].clause_type : null;
          if (firstInnerType && innerRoleItems.every((s) => s.clause_type === firstInnerType)) {
            copy.clause_type = `${firstInnerType}・並列`;
          } else {
            copy.clause_type = "並列句";
          }
        }
      }
    }
    return copy;
  });

  // 2. 同じ役割（S/O/C/M）の並列（A, B, and C）を先にまとめる
  const collapsedList = collapseCoordinatedArgChunks(clonedList, tokens, isTopLevel);
  if (collapsedList.length <= 1) return collapsedList;

  // 助動詞＋副詞＋動詞（has [V] greatly [M] improved [V]）や句動詞粒子のように、
  // 直前のVとの間にカンマもConjも主語も存在しない分割Vは別動詞句の先頭から除外する
  const vIndicesAll = [];
  collapsedList.forEach((c, idx) => {
    if (c.role !== "V") return;
    if (vIndicesAll.length === 0) {
      vIndicesAll.push(idx);
      return;
    }
    const prevV = vIndicesAll[vIndicesAll.length - 1];
    const betweenSlice = collapsedList.slice(prevV + 1, idx);
    const hasSubjBetween = betweenSlice.some(
      (ch) =>
        ch.role === "S" &&
        ch.displayRoleLabel !== "S (真主語)" &&
        ch.clause_type !== "真主語"
    );
    const hasConjBetween = betweenSlice.some((ch) => ch.role === "Conj");
    const hasCommaBetween = hasCommaBetweenChunks(collapsedList[prevV], c, tokens);
    if (hasSubjBetween || hasConjBetween || hasCommaBetween) {
      vIndicesAll.push(idx);
    }
  });

  if (vIndicesAll.length >= 2) {
    // 3. 重文（S1 V1 ..., S2 V2 ..., and S3 V3 ...）の節単位グループ化（真主語Sは別節の主語とみなさない）
    const clauseStarts = [0];
    for (let vi = 1; vi < vIndicesAll.length; vi++) {
      const prevV = vIndicesAll[vi - 1];
      const currV = vIndicesAll[vi];
      const sIdxBetween = collapsedList
        .slice(prevV + 1, currV)
        .findIndex(
          (c) =>
            c.role === "S" &&
            c.displayRoleLabel !== "S (真主語)" &&
            c.clause_type !== "真主語"
        );
      if (sIdxBetween !== -1) {
        let splitPos = prevV + 1 + sIdxBetween;
        let scanBack = splitPos - 1;
        while (scanBack > prevV && collapsedList[scanBack].role === "M") {
          scanBack -= 1;
        }
        if (scanBack > prevV && collapsedList[scanBack].role === "Conj") {
          splitPos = scanBack;
        } else if (splitPos > 0 && collapsedList[splitPos - 1].role === "Conj") {
          splitPos -= 1;
        }
        clauseStarts.push(splitPos);
      }
    }

    if (clauseStarts.length >= 2) {
      const coordClauseItems = [];
      for (let ci = 0; ci < clauseStarts.length; ci++) {
        const st = clauseStarts[ci];
        const ed = ci + 1 < clauseStarts.length ? clauseStarts[ci + 1] : collapsedList.length;
        let seg = collapsedList.slice(st, ed);
        if (seg[0].role === "Conj" && seg.length > 1) {
          coordClauseItems.push(seg[0]);
          seg = seg.slice(1);
        }
        const nestedSeg = buildDisplayChunksHierarchy(seg, tokens, false);
        coordClauseItems.push({
          text: joinChunkSpanText(seg, tokens),
          role: "V",
          displayRoleLabel: "等位節",
          clause_type: "等位節",
          start: seg[0].start,
          end: seg[seg.length - 1].end,
          sub_chunks: nestedSeg
        });
      }
      return coordClauseItems;
    }

    const firstVIdx = vIndicesAll[0];
    const secondVIdx = vIndicesAll[1];
    const lastVIdx = vIndicesAll[vIndicesAll.length - 1];
    const hasSubjBetweenFirstTwoV = collapsedList
      .slice(firstVIdx + 1, secondVIdx)
      .some(
        (c) =>
          c.role === "S" &&
          c.displayRoleLabel !== "S (真主語)" &&
          c.clause_type !== "真主語"
      );
    const hasConjBetweenVerbs = collapsedList
      .slice(firstVIdx + 1, lastVIdx)
      .some((c) => c.role === "Conj");

    // 4-A. 動詞単体の並列＋共通の目的語/補語（例: He [bought, cooked, and ate] the fish.）
    const onlyVerbsAndConjBetween = collapsedList
      .slice(firstVIdx, lastVIdx + 1)
      .every((c) => c.role === "V" || c.role === "Conj");
    const hasSharedArgsAfterLastV = collapsedList
      .slice(lastVIdx + 1)
      .some((c) => c.role === "O" || c.role === "C" || c.role === "M");

    if (!hasSubjBetweenFirstTwoV && hasConjBetweenVerbs && onlyVerbsAndConjBetween && hasSharedArgsAfterLastV) {
      let vSpanStart = firstVIdx;
      if (
        vSpanStart > 0 &&
        collapsedList[vSpanStart - 1].role === "Conj" &&
        CORRELATIVE_LEAD_REGEX.test(String(collapsedList[vSpanStart - 1].text || "").trim())
      ) {
        vSpanStart -= 1;
      }
      const bareVerbsSlice = collapsedList.slice(vSpanStart, lastVIdx + 1);
      const coordVerbChunk = {
        text: joinChunkSpanText(bareVerbsSlice, tokens),
        role: "V",
        clause_type: "並列動詞",
        start: bareVerbsSlice[0].start,
        end: bareVerbsSlice[bareVerbsSlice.length - 1].end,
        sub_chunks: bareVerbsSlice
      };
      return [
        ...collapsedList.slice(0, vSpanStart),
        coordVerbChunk,
        ...collapsedList.slice(lastVIdx + 1)
      ];
    }

    // 4-B. 並列動詞句（VP1, VP2, and VP3：例 Acquire knowledge, process information, and make decisions）の入れ子化
    if (!hasSubjBetweenFirstTwoV && hasConjBetweenVerbs) {
      let vpSpanStart = firstVIdx;
      if (
        vpSpanStart > 0 &&
        collapsedList[vpSpanStart - 1].role === "Conj" &&
        CORRELATIVE_LEAD_REGEX.test(String(collapsedList[vpSpanStart - 1].text || "").trim())
      ) {
        vpSpanStart -= 1;
      }

      const prefixChunks = collapsedList.slice(0, vpSpanStart);
      const vpGroupItems = [];
      if (vpSpanStart < firstVIdx) {
        vpGroupItems.push(collapsedList[vpSpanStart]);
      }

      // 各動詞句の開始インデックスと直前の接続詞インデックスを計算（Conj直後の前置副詞Mは次の動詞句に含める）
      const vpBounds = vIndicesAll.map((vIdx, vi) => {
        if (vi === 0) return { conjIdx: -1, startIdx: vIdx };
        const prevVIdx = vIndicesAll[vi - 1];
        let conjIdx = -1;
        for (let k = vIdx - 1; k > prevVIdx; k--) {
          if (collapsedList[k].role === "Conj") {
            conjIdx = k;
            break;
          }
        }
        let startIdx = vIdx;
        if (conjIdx !== -1 && conjIdx + 1 < vIdx) {
          const allModBetween = collapsedList
            .slice(conjIdx + 1, vIdx)
            .every((c) => c.role === "M" && !c.sub_chunks);
          if (allModBetween) {
            startIdx = conjIdx + 1;
          }
        } else if (
          conjIdx === -1 &&
          vIdx - 1 > prevVIdx &&
          collapsedList[vIdx - 1].role === "M" &&
          !collapsedList[vIdx - 1].sub_chunks &&
          Array.isArray(tokens)
        ) {
          const prevEndId = collapsedList[vIdx - 2].end;
          const modStartId = collapsedList[vIdx - 1].start;
          const hasCommaBeforeMod = tokens.some(
            (t) => t.id > prevEndId && t.id < modStartId && t.text === ","
          );
          if (hasCommaBeforeMod) {
            startIdx = vIdx - 1;
          }
        }
        return { conjIdx, startIdx };
      });

      for (let vi = 0; vi < vIndicesAll.length; vi++) {
        const { conjIdx, startIdx } = vpBounds[vi];
        const nextBound = vi + 1 < vIndicesAll.length ? vpBounds[vi + 1] : null;
        const vEnd = nextBound
          ? (nextBound.conjIdx !== -1 ? nextBound.conjIdx : nextBound.startIdx)
          : collapsedList.length;

        if (conjIdx !== -1) {
          vpGroupItems.push(collapsedList[conjIdx]);
        }

        const singleVpChunks = collapsedList.slice(startIdx, vEnd);
        if (singleVpChunks.length >= 2) {
          vpGroupItems.push({
            text: joinChunkSpanText(singleVpChunks, tokens),
            role: "V",
            clause_type: "動詞句",
            start: singleVpChunks[0].start,
            end: singleVpChunks[singleVpChunks.length - 1].end,
            sub_chunks: singleVpChunks
          });
        } else if (singleVpChunks.length === 1) {
          vpGroupItems.push(singleVpChunks[0]);
        }
      }

      // 親チャンク（不定詞句など）の直下全体が並列動詞句である場合は、二重枠にせず各VO句の配列を直接返す
      if (!isTopLevel && prefixChunks.length === 0) {
        return vpGroupItems;
      }

      const allVpSlice = collapsedList.slice(vpSpanStart);
      const coordVpChunk = {
        text: joinChunkSpanText(allVpSlice, tokens),
        role: "V",
        clause_type: "並列動詞句",
        start: allVpSlice[0].start,
        end: allVpSlice[allVpSlice.length - 1].end,
        sub_chunks: vpGroupItems
      };
      return [...prefixChunks, coordVpChunk];
    }
  }

  return collapsedList;
}

// 5. 英文分析結果の描画
function renderEnglishResult(data) {
  document.getElementById("en-pattern").textContent = data.pattern;

  // ⑤ 形式主語・真主語・形式目的語・真目的語の()付き表記および関係詞表記の適用
  annotateSpecialRolesAndRelatives(data.chunks, data.tokens, data.text);

  // チャンクの描画（並列動詞句・並列句も入れ子構造に変換し、内から外に行くにつれて濃いグレーで表示）
  const displayChunks = buildDisplayChunksHierarchy(data.chunks, data.tokens, true);
  const chunksContainer = document.getElementById("en-chunks");
  chunksContainer.innerHTML = "";
  displayChunks.forEach((chunk) => {
    chunksContainer.appendChild(createChunkElement(chunk));
  });

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

  // トークン一覧テーブルの描画
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

  // ③ 結果セクションを表示状態にしてから統語ツリーを描画し、全体が範囲にちょうど収まる倍率を初期適用する
  enResult.classList.remove("hidden");

  const treeContainer = document.getElementById("en-tree");
  treeContainer.innerHTML = buildHierarchicalTreeSvg(data.tokens, data.chunks);
  fitTreeToContainer();
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
    強調部分: { fill: "#f5f3ff", stroke: "#7c3aed", badge: "#7c3aed", text: "#5b21b6" },
    M: { fill: "#e2e8f0", stroke: "#64748b", badge: "#475569", text: "#0f172a" },
    関係詞: { fill: "#f8fafc", stroke: "#cbd5e1", badge: "#94a3b8", text: "#334155" },
    Conj: { fill: "#f8fafc", stroke: "#cbd5e1", badge: "#94a3b8", text: "#475569" },
    Other: { fill: "#f8fafc", stroke: "#cbd5e1", badge: "#64748b", text: "#334155" }
  };

  // ④ チャンク単位・入れ子構造の内(0:薄)から外(3:濃)に行くにつれて濃くなる4段階グレーパレット
  const mShadeStyles = [
    { fill: "#f8fafc", stroke: "#cbd5e1", badge: "#94a3b8", text: "#334155" }, // Level 0: 最内（最も薄い）
    { fill: "#f1f5f9", stroke: "#94a3b8", badge: "#64748b", text: "#1e293b" }, // Level 1: 内側中間
    { fill: "#e2e8f0", stroke: "#64748b", badge: "#475569", text: "#0f172a" }, // Level 2: 外側中間
    { fill: "#cbd5e1", stroke: "#475569", badge: "#334155", text: "#0f172a" }  // Level 3: 最外（最も濃い）
  ];

  function getRoleVisualStyle(role, grayLevel = 0, inModClause = false) {
    const clamped = clampGrayLevel(grayLevel);
    if (inModClause || role === "M" || role === "関係詞") {
      if (role === "強調部分") {
        return roleStyle["強調部分"];
      }
      return mShadeStyles[clamped];
    }
    return roleStyle[role] || roleStyle.Other;
  }

  // 1. 入れ子チャンク(sub_chunks)を再帰的に展開して葉グループ(groups)と階層構造を構築
  // 同じ節に属する要素はすべて同じグレーレベルで統一し、内側の入れ子節ほど薄く(0)、外側の節ほど濃く(+1)する
  const groups = [];
  const clauseBrackets = [];

  function registerChunkHierarchy(ch, inModClause = false, isAntecedent = false, currentGrayLevel = 0, isTopLevel = false) {
    const isMod = ch.role === "M" || ch.role === "関係詞";
    const nextInMod = inModClause || isMod;

    if (Array.isArray(ch.sub_chunks) && ch.sub_chunks.length > 0) {
      const isAdnominal = hasAdnominalModifierSubChunk(ch);
      const isRelMod = hasRelativeModifierSubChunk(ch);
      const myGrayLevel = isAdnominal && !isTopLevel ? currentGrayLevel : getChunkGrayLevel(ch);
      const innerForceGray = nextInMod || Boolean(ch.clause_type);

      const childItems = ch.sub_chunks.map((sub) => {
        const subIsMod = sub.role === "M" || sub.role === "関係詞";
        const subIsHeadNominal = isAdnominal && !subIsMod && sub.role !== "Conj";
        const subIsAnt = isRelMod && subIsHeadNominal;
        const hasGrandChildren = Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0;
        const childGrayLevel = hasGrandChildren
          ? (hasAdnominalModifierSubChunk(sub) ? myGrayLevel : getChunkGrayLevel(sub))
          : myGrayLevel;
        const childInMod = subIsHeadNominal ? nextInMod : (innerForceGray || subIsMod);
        return registerChunkHierarchy(sub, childInMod, subIsAnt, childGrayLevel, false);
      }).filter(Boolean);
      if (childItems.length === 0) return null;

      const allLeafIndices = [];
      let maxChildDepth = 0;
      childItems.forEach((ci) => {
        allLeafIndices.push(...ci.leafIndices);
        if (ci.bracketDepth > maxChildDepth) maxChildDepth = ci.bracketDepth;
      });

      const shouldDrawBracket = Boolean(ch.clause_type) || Boolean(ch.displayRoleLabel) || maxChildDepth === 0;
      let myDepth = maxChildDepth;
      if (shouldDrawBracket) {
        myDepth = maxChildDepth + 1;
        const bLabel = ch.displayRoleLabel
          ? ch.displayRoleLabel
          : (ch.clause_type ? `${ch.role} (${ch.clause_type})` : `${ch.role} (節)`);
        clauseBrackets.push({
          role: ch.role,
          grayLevel: myGrayLevel,
          inModClause: nextInMod,
          label: bLabel,
          subGroupIndices: allLeafIndices,
          depth: myDepth
        });
      }

      return {
        isContainer: true,
        role: ch.role,
        displayRoleLabel: ch.displayRoleLabel || null,
        grayLevel: myGrayLevel,
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
      const leafGrayLevel = isTopLevel && isMod ? 2 : currentGrayLevel;
      const dispRole = isAntecedent
        ? (isTopLevel ? "先行詞" : `${ch.role} (先行詞)`)
        : (ch.displayRoleLabel || ch.role);

      groups.push({
        role: ch.role,
        displayRole: dispRole,
        grayLevel: leafGrayLevel,
        inModClause: nextInMod,
        tokens: matched
      });
      return {
        isContainer: false,
        role: ch.role,
        displayRoleLabel: dispRole,
        grayLevel: leafGrayLevel,
        inModClause: nextInMod,
        groupIdx: gIdx,
        leafIndices: [gIdx],
        bracketDepth: 0
      };
    }
  }

  let hierarchyRoots = [];
  if (Array.isArray(chunks) && chunks.length > 0) {
    hierarchyRoots = chunks.map((ch) => {
      const topLv = getChunkGrayLevel(ch);
      return registerChunkHierarchy(ch, ch.role === "M" || ch.role === "関係詞", false, topLv, true);
    }).filter(Boolean);
  }
  if (groups.length === 0) {
    validTokens.forEach((t, idx) => {
      groups.push({
        role: t.svocm || "Other",
        displayRole: t.svocm || "Other",
        grayLevel: 0,
        inModClause: false,
        tokens: [t]
      });
      hierarchyRoots.push({
        isContainer: false,
        role: t.svocm || "Other",
        grayLevel: 0,
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

  function createLeafNode(token, inModClause = false, grayLevel = 0) {
    return {
      x: tokenCenterX[token.id],
      level: 0,
      label: token.text,
      role: token.svocm,
      inModClause,
      grayLevel
    };
  }

  function mergeTwoNodes(leftNode, rightNode, label, role, inModClause = false, grayLevel = 0) {
    const level = Math.max(leftNode.level, rightNode.level) + 1;
    const x = (leftNode.x + rightNode.x) / 2;
    const isModNode = inModClause || (leftNode.inModClause && rightNode.inModClause);
    const gLevel = Math.max(grayLevel || 0, leftNode.grayLevel || 0, rightNode.grayLevel || 0);
    const parent = {
      x,
      level,
      label,
      role: role || "Phrase",
      inModClause: isModNode,
      grayLevel: gLevel
    };
    mergeEdges.push({ parent, left: leftNode, right: rightNode });
    mergeNodes.push(parent);
    return parent;
  }

  // spaCyの親子関係(head_id)を直接たどってチャンク内部の逆V字結合を組み立てる
  function buildIntraGroupTree(tokSlice, displayRole, role, inModClause = false, grayLevel = 0) {
    if (tokSlice.length === 1) {
      return createLeafNode(tokSlice[0], inModClause, grayLevel);
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

      let cur = createLeafNode(headTok, inModClause, grayLevel);

      for (let i = lefts.length - 1; i >= 0; i--) {
        const leftSub = buildDepSubtree(lefts[i], false);
        const isFinalMerge = isTopLevel && i === 0 && rights.length === 0 && localRoots.length === 1;
        cur = mergeTwoNodes(leftSub, cur, isFinalMerge ? displayRole : "句", isFinalMerge ? role : "Phrase", inModClause, grayLevel);
      }

      for (let i = 0; i < rights.length; i++) {
        const rightSub = buildDepSubtree(rights[i], false);
        const isFinalMerge = isTopLevel && i === rights.length - 1 && localRoots.length === 1;
        cur = mergeTwoNodes(cur, rightSub, isFinalMerge ? displayRole : "句", isFinalMerge ? role : "Phrase", inModClause, grayLevel);
      }

      return cur;
    }

    const rootNodes = localRoots.map((r) => buildDepSubtree(r, true));
    let combined = rootNodes[0];
    for (let i = 1; i < rootNodes.length; i++) {
      const isFinal = (i === rootNodes.length - 1);
      combined = mergeTwoNodes(combined, rootNodes[i], isFinal ? displayRole : "句", isFinal ? role : "Phrase", inModClause, grayLevel);
    }
    combined.label = displayRole;
    combined.role = role;
    combined.inModClause = inModClause;
    combined.grayLevel = grayLevel;
    return combined;
  }

  // 各葉チャンクの頂点ノードを作成
  const leafChunkNodes = groups.map((grp) => {
    const node = buildIntraGroupTree(grp.tokens, grp.displayRole || grp.role, grp.role, grp.inModClause, grp.grayLevel);
    node.chunkRole = grp.role;
    node.displayRoleLabel = grp.displayRole || grp.role;
    node.tokens = grp.tokens;
    node.inModClause = grp.inModClause;
    node.grayLevel = grp.grayLevel;
    return node;
  });

  // 2つのツリーノード間にカンマ・セミコロンが存在するか判定するヘルパー
  function hasCommaBetweenTreeNodes(prevNode, nextNode) {
    if (!prevNode || !nextNode) return true;
    const prevToks = prevNode.tokens;
    const nextToks = nextNode.tokens;
    if (!Array.isArray(prevToks) || !Array.isArray(nextToks) || prevToks.length === 0 || nextToks.length === 0) {
      return true;
    }
    const prevEndId = prevToks[prevToks.length - 1].id;
    const nextStartId = nextToks[0].id;
    return tokens.some((t) => t.id > prevEndId && t.id < nextStartId && /^[,;]$/.test(t.text));
  }

  // 同じ役割の並列チャンク列（A, B, and C や both A and B：S/O/C/Mの並列）を先に1つの並列句/並列節ノードへ束ねるヘルパー
  function collapseCoordinatedArgRuns(nodesList, inModClause = false, grayLevel = 0) {
    const result = [];
    let i = 0;
    while (i < nodesList.length) {
      let hasLeadPreconj = false;
      let firstRoleIdx = i;
      const leadText = nodesList[i].tokens
        ? nodesList[i].tokens.map((t) => t.text).join(" ")
        : (nodesList[i].label || "");

      if (
        nodesList[i].chunkRole === "Conj" &&
        CORRELATIVE_LEAD_REGEX.test(String(leadText).trim()) &&
        i + 1 < nodesList.length &&
        ["S", "O", "C", "M"].includes(nodesList[i + 1].chunkRole)
      ) {
        hasLeadPreconj = true;
        firstRoleIdx = i + 1;
      }

      const role = nodesList[firstRoleIdx].chunkRole;
      if (role === "S" || role === "O" || role === "C" || role === "M") {
        const baseKey = getSpecialRoleKey(nodesList[firstRoleIdx]);
        let j = firstRoleIdx + 1;
        let hasConj = false;
        while (j < nodesList.length) {
          if (
            nodesList[j].chunkRole === "Conj" &&
            j + 1 < nodesList.length &&
            nodesList[j + 1].chunkRole === role &&
            getSpecialRoleKey(nodesList[j + 1]) === baseKey
          ) {
            hasConj = true;
            j += 2;
          } else if (
            !hasConj &&
            nodesList[j].chunkRole === role &&
            getSpecialRoleKey(nodesList[j]) === baseKey &&
            hasCommaBetweenTreeNodes(nodesList[j - 1], nodesList[j])
          ) {
            // カンマ区切りの A, B, and C のうち、後ろに Conj + 同ロール が続く場合のみ同一並列グループに含める
            let k = j + 1;
            let conjAhead = false;
            while (k < nodesList.length) {
              if (
                nodesList[k].chunkRole === "Conj" &&
                k + 1 < nodesList.length &&
                nodesList[k + 1].chunkRole === role &&
                getSpecialRoleKey(nodesList[k + 1]) === baseKey
              ) {
                conjAhead = true;
                break;
              } else if (
                nodesList[k].chunkRole === role &&
                getSpecialRoleKey(nodesList[k]) === baseKey &&
                hasCommaBetweenTreeNodes(nodesList[k - 1], nodesList[k])
              ) {
                k++;
              } else {
                break;
              }
            }
            if (conjAhead) {
              j++;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        const startSliceIdx = hasLeadPreconj ? i : firstRoleIdx;
        if (hasConj && j - firstRoleIdx >= 3) {
          const seq = nodesList.slice(startSliceIdx, j);
          const allCombinedTokens = [];
          seq.forEach((n) => {
            if (Array.isArray(n.tokens)) allCombinedTokens.push(...n.tokens);
          });
          const roleNodes = seq.filter((n) => n.chunkRole === role);
          const allAreClauses = roleNodes.every((n) => Boolean(n.isClauseContainer));
          const finalCoordLabel = allAreClauses ? `${role} (並列節)` : `${role} (並列句)`;

          const mergedItems = [];
          let m = 0;
          while (m < seq.length) {
            if (seq[m].chunkRole === "Conj" && m + 1 < seq.length) {
              const cRight = mergeTwoNodes(seq[m], seq[m + 1], `Conj + ${role}`, role, inModClause, grayLevel);
              cRight.chunkRole = role;
              mergedItems.push(cRight);
              m += 2;
            } else {
              mergedItems.push(seq[m]);
              m++;
            }
          }
          let coordNode = mergedItems[0];
          for (let k = 1; k < mergedItems.length; k++) {
            const isLast = k === mergedItems.length - 1;
            const lbl = isLast ? finalCoordLabel : `${role} + ${role}`;
            coordNode = mergeTwoNodes(coordNode, mergedItems[k], lbl, role, inModClause, grayLevel);
          }
          coordNode.chunkRole = role;
          coordNode.displayRoleLabel = nodesList[firstRoleIdx].displayRoleLabel || finalCoordLabel;
          coordNode.tokens = allCombinedTokens;
          coordNode.isClauseContainer = allAreClauses;
          result.push(coordNode);
          i = j;
          continue;
        }
      }
      result.push(nodesList[i]);
      i++;
    }
    return result;
  }

  // 節内部（または主節）のチャンクノード列を結合して1つの節/文ノードにするヘルパー
  function buildClauseTreeFromNodes(rawNodesSlice, isTopSentence, inModClause = false, grayLevel = 0) {
    let nodesSlice = collapseCoordinatedArgRuns(rawNodesSlice, inModClause, grayLevel);
    if (nodesSlice.length === 1) return nodesSlice[0];

    if ((nodesSlice[0].chunkRole === "Conj" || nodesSlice[0].chunkRole === "関係詞") && nodesSlice.length > 1) {
      const leadText = nodesSlice[0].tokens
        ? nodesSlice[0].tokens.map((t) => t.text).join(" ")
        : (nodesSlice[0].label || "");
      const isCorrelativeForVerb =
        nodesSlice[0].chunkRole === "Conj" &&
        CORRELATIVE_LEAD_REGEX.test(String(leadText).trim()) &&
        nodesSlice[1].chunkRole === "V";

      if (!isCorrelativeForVerb) {
        const restTree = buildClauseTreeFromNodes(nodesSlice.slice(1), false, inModClause, grayLevel);
        const leadLabel = nodesSlice[0].chunkRole === "関係詞" ? "関係詞 + 節" : "Conj + 節";
        const topLbl = isTopSentence ? "文 (Sentence)" : leadLabel;
        return mergeTwoNodes(nodesSlice[0], restTree, topLbl, isTopSentence ? "Sentence" : "VP", inModClause, grayLevel);
      }
    }

    // 1. 重文（S1 V1 ..., S2 V2 ..., and S3 V3 ...）および並列動詞句の分割点となるVインデックスを収集
    //    （助動詞＋副詞＋本動詞や句動詞粒子のように間にカンマもConjもSもない分割Vは除外）
    let vIndicesAll = [];
    nodesSlice.forEach((n, idx) => {
      if (n.chunkRole !== "V") return;
      if (vIndicesAll.length === 0) {
        vIndicesAll.push(idx);
        return;
      }
      const prevV = vIndicesAll[vIndicesAll.length - 1];
      const betweenSlice = nodesSlice.slice(prevV + 1, idx);
      const hasSubjBetween = betweenSlice.some(
        (ch) => ch.chunkRole === "S" && ch.displayRoleLabel !== "S (真主語)"
      );
      const hasConjBetween = betweenSlice.some((ch) => ch.chunkRole === "Conj");
      const hasCommaBetween = hasCommaBetweenTreeNodes(nodesSlice[prevV], n);
      if (hasSubjBetween || hasConjBetween || hasCommaBetween) {
        vIndicesAll.push(idx);
      }
    });

    if (vIndicesAll.length >= 2) {
      const clauseStarts = [0];
      for (let vi = 1; vi < vIndicesAll.length; vi++) {
        const prevV = vIndicesAll[vi - 1];
        const currV = vIndicesAll[vi];
        const sIdxBetween = nodesSlice
          .slice(prevV + 1, currV)
          .findIndex(
            (n) =>
              n.chunkRole === "S" &&
              n.displayRoleLabel !== "S (真主語)"
          );
        if (sIdxBetween !== -1) {
          let splitPos = prevV + 1 + sIdxBetween;
          let scanBack = splitPos - 1;
          while (scanBack > prevV && nodesSlice[scanBack].chunkRole === "M") {
            scanBack -= 1;
          }
          if (scanBack > prevV && nodesSlice[scanBack].chunkRole === "Conj") {
            splitPos = scanBack;
          } else if (splitPos > 0 && nodesSlice[splitPos - 1].chunkRole === "Conj") {
            splitPos -= 1;
          }
          clauseStarts.push(splitPos);
        }
      }

      if (clauseStarts.length >= 2) {
        const clauseTreeUnits = [];
        for (let ci = 0; ci < clauseStarts.length; ci++) {
          const st = clauseStarts[ci];
          const ed = ci + 1 < clauseStarts.length ? clauseStarts[ci + 1] : nodesSlice.length;
          const seg = nodesSlice.slice(st, ed);
          if (seg[0].chunkRole === "Conj" && seg.length > 1) {
            const innerCl = buildClauseTreeFromNodes(seg.slice(1), false, inModClause, grayLevel);
            clauseTreeUnits.push(mergeTwoNodes(seg[0], innerCl, "Conj + 節", "VP", inModClause, grayLevel));
          } else {
            clauseTreeUnits.push(buildClauseTreeFromNodes(seg, false, inModClause, grayLevel));
          }
        }
        let combinedClauses = clauseTreeUnits[0];
        for (let ci = 1; ci < clauseTreeUnits.length; ci++) {
          const isTop = isTopSentence && ci === clauseTreeUnits.length - 1;
          const topLbl = isTop ? "文 (重文)" : "節 + 節";
          combinedClauses = mergeTwoNodes(
            combinedClauses,
            clauseTreeUnits[ci],
            topLbl,
            isTop ? "Sentence" : "VP",
            inModClause,
            grayLevel
          );
        }
        return combinedClauses;
      }

      const firstVIdx = vIndicesAll[0];
      const secondVIdx = vIndicesAll[1];
      const lastVIdx = vIndicesAll[vIndicesAll.length - 1];
      const hasSubjBetweenFirstTwoV = nodesSlice
        .slice(firstVIdx + 1, secondVIdx)
        .some((n) => n.chunkRole === "S" && n.displayRoleLabel !== "S (真主語)");
      const isPhrasalVerbSplit =
        vIndicesAll.length === 2 &&
        !nodesSlice.some((n) => n.chunkRole === "Conj") &&
        nodesSlice[secondVIdx].tokens &&
        nodesSlice[secondVIdx].tokens.every((t) => t.tag === "RP" || t.dep === "prt");

      // 2-A. 動詞単体の並列＋共通の目的語/補語（例: He [bought, cooked, and ate] the fish.）
      //      先に動詞同士を1つの「V (並列動詞)」ノードに結合し、続けて後続の共通目的語・補語と結合させる
      const hasConjBetweenVerbs = nodesSlice
        .slice(firstVIdx + 1, lastVIdx)
        .some((n) => n.chunkRole === "Conj");
      const onlyVerbsAndConjBetween = nodesSlice
        .slice(firstVIdx, lastVIdx + 1)
        .every((n) => n.chunkRole === "V" || n.chunkRole === "Conj");
      const hasSharedArgsAfterLastV = nodesSlice
        .slice(lastVIdx + 1)
        .some((n) => n.chunkRole === "O" || n.chunkRole === "C" || n.chunkRole === "M");

      if (!hasSubjBetweenFirstTwoV && !isPhrasalVerbSplit && hasConjBetweenVerbs && onlyVerbsAndConjBetween && hasSharedArgsAfterLastV) {
        let vSpanStart = firstVIdx;
        if (vSpanStart > 0 && nodesSlice[vSpanStart - 1].chunkRole === "Conj") {
          const prevTxt = nodesSlice[vSpanStart - 1].tokens
            ? nodesSlice[vSpanStart - 1].tokens.map((t) => t.text).join(" ")
            : "";
          if (CORRELATIVE_LEAD_REGEX.test(String(prevTxt).trim())) {
            vSpanStart -= 1;
          }
        }
        const vSeq = nodesSlice.slice(vSpanStart, lastVIdx + 1);
        const mergedVItems = [];
        let m = 0;
        while (m < vSeq.length) {
          if (vSeq[m].chunkRole === "Conj" && m + 1 < vSeq.length) {
            const cRight = mergeTwoNodes(vSeq[m], vSeq[m + 1], "Conj + V", "V", inModClause, grayLevel);
            cRight.chunkRole = "V";
            mergedVItems.push(cRight);
            m += 2;
          } else {
            mergedVItems.push(vSeq[m]);
            m++;
          }
        }
        let coordVNode = mergedVItems[0];
        for (let k = 1; k < mergedVItems.length; k++) {
          const isLast = k === mergedVItems.length - 1;
          coordVNode = mergeTwoNodes(
            coordVNode,
            mergedVItems[k],
            isLast ? "V (並列動詞)" : "V + V",
            "V",
            inModClause,
            grayLevel
          );
        }
        coordVNode.chunkRole = "V";
        nodesSlice = [
          ...nodesSlice.slice(0, vSpanStart),
          coordVNode,
          ...nodesSlice.slice(lastVIdx + 1)
        ];
        vIndicesAll = [vSpanStart];
      } else if (!hasSubjBetweenFirstTwoV && !isPhrasalVerbSplit && hasConjBetweenVerbs) {
        // 2-B. 並列動詞句（VP1, VP2, and VP3：例 Acquire knowledge, process information, and make decisions）の分割・結合
        let vpSpanStart = firstVIdx;
        if (vpSpanStart > 0 && nodesSlice[vpSpanStart - 1].chunkRole === "Conj") {
          const prevTxt = nodesSlice[vpSpanStart - 1].tokens
            ? nodesSlice[vpSpanStart - 1].tokens.map((t) => t.text).join(" ")
            : "";
          if (CORRELATIVE_LEAD_REGEX.test(String(prevTxt).trim())) {
            vpSpanStart -= 1;
          }
        }

        const prefixNodes = nodesSlice.slice(0, vpSpanStart);
        const vpSegments = [];

        const vpBounds = vIndicesAll.map((vIdx, vi) => {
          if (vi === 0) {
            return {
              conjIdx: vpSpanStart < firstVIdx ? vpSpanStart : -1,
              startIdx: vIdx
            };
          }
          const prevVIdx = vIndicesAll[vi - 1];
          let conjIdx = -1;
          for (let k = vIdx - 1; k > prevVIdx; k--) {
            if (nodesSlice[k].chunkRole === "Conj") {
              conjIdx = k;
              break;
            }
          }
          let startIdx = vIdx;
          if (conjIdx !== -1 && conjIdx + 1 < vIdx) {
            const allModBetween = nodesSlice
              .slice(conjIdx + 1, vIdx)
              .every((n) => n.chunkRole === "M");
            if (allModBetween) {
              startIdx = conjIdx + 1;
            }
          }
          return { conjIdx, startIdx };
        });

        for (let vi = 0; vi < vIndicesAll.length; vi++) {
          const { conjIdx, startIdx } = vpBounds[vi];
          const nextBound = vi + 1 < vIndicesAll.length ? vpBounds[vi + 1] : null;
          const vEnd = nextBound
            ? (nextBound.conjIdx !== -1 ? nextBound.conjIdx : nextBound.startIdx)
            : nodesSlice.length;

          const singleVpNodes = nodesSlice.slice(startIdx, vEnd);
          const vpTree = buildClauseTreeFromNodes(singleVpNodes, false, inModClause, grayLevel);
          if (conjIdx !== -1) {
            vpSegments.push(mergeTwoNodes(nodesSlice[conjIdx], vpTree, "Conj + VP", "VP", inModClause, grayLevel));
          } else {
            vpSegments.push(vpTree);
          }
        }

        let combinedVp = vpSegments[0];
        for (let k = 1; k < vpSegments.length; k++) {
          const isLastVp = k === vpSegments.length - 1;
          const isTopHere = isTopSentence && prefixNodes.length === 0 && isLastVp;
          const vpLbl = isTopHere
            ? "文 (Sentence)"
            : (isLastVp ? "VP (並列述部)" : "VP + VP");
          combinedVp = mergeTwoNodes(
            combinedVp,
            vpSegments[k],
            vpLbl,
            isTopHere ? "Sentence" : "VP",
            inModClause,
            grayLevel
          );
        }

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
            grayLevel
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
        cur = mergeTwoNodes(cur, nodesSlice[i], lbl, isTop ? "Sentence" : "Phrase", inModClause, grayLevel);
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
        mainVp = mergeTwoNodes(mainVp, nodesSlice[i], lbl, "VP", inModClause, grayLevel);
      }
      for (let i = secondVIdx - 1; i > vIdx; i--) {
        mainVp = mergeTwoNodes(nodesSlice[i], mainVp, "S + VP", "VP", inModClause, grayLevel);
      }
      let invNode = mergeTwoNodes(
        nodesSlice[vIdx],
        mainVp,
        isTopSentence && vIdx === 0 ? "文 (倒置)" : "Aux + S + VP",
        isTopSentence && vIdx === 0 ? "Sentence" : "VP",
        inModClause,
        grayLevel
      );
      for (let i = vIdx - 1; i >= 0; i--) {
        const isTop = isTopSentence && i === 0;
        invNode = mergeTwoNodes(nodesSlice[i], invNode, isTop ? "文 (倒置)" : "倒置節", isTop ? "Sentence" : "VP", inModClause, grayLevel);
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
          const isParticle = nextNode.tokens && nextNode.tokens.every((t) => t.tag === "RP" || t.dep === "prt");
          if (isParticle) {
            const prtText = nextNode.tokens.map((t) => t.text).join(" ");
            const pvLabel = mainVerbText ? `VP (句動詞: ${mainVerbText} ... ${prtText})` : "VP (句動詞)";
            vpNode = mergeTwoNodes(vpNode, nextNode, pvLabel, "V", inModClause, grayLevel);
          } else {
            vpNode = mergeTwoNodes(vpNode, nextNode, "V (述語動詞)", "V", inModClause, grayLevel);
          }
        } else {
          vpNode = mergeTwoNodes(vpNode, nextNode, "V + " + nextRole, "VP", inModClause, grayLevel);
        }
      } else {
        let mergeLabel = "VP (述部)";
        if ((nextRole === "O" && hasSeenObjAfterV && hasSeenCompAfterV) || nextNode.displayRoleLabel === "O (真目的語)") {
          mergeLabel = "VP + O (真目的語)";
        } else if (nextRole === "O" || nextRole === "C") {
          mergeLabel = "VP (動詞句)";
        } else if (nextRole === "S" || nextNode.displayRoleLabel === "S (真主語)") {
          mergeLabel = "述部 + S (真主語)";
        }
        if (nextRole === "O") hasSeenObjAfterV = true;
        if (nextRole === "C") hasSeenCompAfterV = true;

        if (isTopSentence && isLastRight) mergeLabel = "文 (Sentence)";
        vpNode = mergeTwoNodes(vpNode, nextNode, mergeLabel, isTopSentence && isLastRight ? "Sentence" : "VP", inModClause, grayLevel);
      }
    }

    // 主語(S)の直後に切り離された前置詞句・後置修飾節(M)がある場合、先にSと結合して「S (主部)」にまとめる
    const rawLeftNodes = nodesSlice.slice(0, vIdx);
    const leftNodes = [];
    for (let i = 0; i < rawLeftNodes.length; i++) {
      const currLeft = rawLeftNodes[i];
      if (
        currLeft.chunkRole === "M" &&
        leftNodes.length > 0 &&
        leftNodes[leftNodes.length - 1].chunkRole === "S"
      ) {
        const mLabel = String(currLeft.label || currLeft.displayRoleLabel || "");
        const isInsertion = mLabel.includes("挿入");
        const isPureAdverb =
          !isInsertion &&
          Array.isArray(currLeft.tokens) &&
          currLeft.tokens.length > 0 &&
          currLeft.tokens[0].pos === "ADV" &&
          !/節|分詞|不定詞|句/.test(mLabel);

        if (!isInsertion && !isPureAdverb) {
          const prevS = leftNodes.pop();
          const mergedS = mergeTwoNodes(prevS, currLeft, "S (主部)", "S", inModClause, grayLevel);
          mergedS.chunkRole = "S";
          mergedS.displayRoleLabel = prevS.displayRoleLabel || "S";
          mergedS.tokens = [...(prevS.tokens || []), ...(currLeft.tokens || [])];
          leftNodes.push(mergedS);
          continue;
        }
      }
      leftNodes.push(currLeft);
    }

    let currentRight = vpNode;
    for (let i = leftNodes.length - 1; i >= 0; i--) {
      const isTop = isTopSentence && i === 0;
      const lRole = leftNodes[i].chunkRole;
      const lLabel = String(leftNodes[i].label || leftNodes[i].displayRoleLabel || "");
      let label = "S + VP";
      if (isTop) {
        label = "文 (Sentence)";
      } else if (lRole === "M" && i > 0 && leftNodes[i - 1].chunkRole === "S") {
        label = lLabel.includes("挿入") ? "挿入節 + VP" : "M + VP";
      } else if (lRole !== "S") {
        label = `${lRole} + 節`;
      }
      currentRight = mergeTwoNodes(leftNodes[i], currentRight, label, isTop ? "Sentence" : "VP", inModClause, grayLevel);
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
        combined = mergeTwoNodes(combined, childNodes[i], item.role, item.role, false, item.grayLevel);
      }
    } else {
      combined = buildClauseTreeFromNodes(childNodes, false, item.inModClause, item.grayLevel);
    }
    const nodeLabel = item.displayRoleLabel
      ? item.displayRoleLabel
      : (item.clauseType ? `${item.role} (${item.clause_type || item.clauseType})` : item.role);
    const allChildTokens = [];
    childNodes.forEach((cn) => {
      if (Array.isArray(cn.tokens)) allChildTokens.push(...cn.tokens);
    });
    combined.label = nodeLabel;
    combined.role = item.role;
    combined.chunkRole = item.role;
    combined.displayRoleLabel = item.displayRoleLabel || nodeLabel;
    combined.tokens = allChildTokens;
    combined.isClauseContainer = Boolean(item.clauseType);
    combined.inModClause = item.inModClause;
    combined.grayLevel = item.grayLevel;
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

  // (B) 逆V字の結合点ラベル（楕円形：入れ子の内から外に行くにつれて濃いグレー）を描画
  mergeNodes.forEach((node) => {
    const nx = node.x;
    const ny = getNodeY(node);
    const isSentence = node.role === "Sentence";
    let st;
    if (isSentence) {
      st = { fill: "#0f172a", stroke: "#0f172a", text: "#ffffff" };
    } else if (node.inModClause || node.role === "M" || node.role === "関係詞") {
      st = getRoleVisualStyle(node.role, node.grayLevel || 0, true);
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

  // (C) チャンクの囲み枠と下部ラベルを描画（入れ子内部はチャンク単位でグレー設定、内ほど薄く外ほど濃い）
  groups.forEach((grp) => {
    const st = getRoleVisualStyle(grp.role, grp.grayLevel || 0, grp.inModClause);
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

  // (C2) 従属節・関係詞節・分詞構文・分詞句をまとめる下部アンダーブラケットを描画（外側の節ほど濃いグレー）
  clauseBrackets.forEach((br) => {
    if (br.subGroupIndices.length === 0) return;
    const firstGrp = groups[br.subGroupIndices[0]];
    const lastGrp = groups[br.subGroupIndices[br.subGroupIndices.length - 1]];
    const st = getRoleVisualStyle(br.role, br.grayLevel || 0, br.inModClause);

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

// 6. 日本語分析結果の描画（入れ子の内から外に行くにつれて濃いグレーに対応）
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

function showWarning(msg) {
  if (!warningBox) return;
  warningBox.textContent = msg;
  warningBox.classList.remove("hidden");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}