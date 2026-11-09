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
        // 節内の要素が「先行詞 + 関係詞節」を持つ場合：先行詞はこの節と同じグレー(currentGrayLevel)、関係詞節は1段薄い内側のグレーで統一
        let hasAppendedSub = false;
        item.sub_chunks.forEach((sub) => {
          if (hasAppendedSub) {
            const subSep = document.createElement("span");
            subSep.className = "sub-chunk-sep";
            subSep.textContent = "/";
            container.appendChild(subSep);
          }
          if (sub.role !== "M" && sub.role !== "関係詞") {
            const antColor = forceGrayScale ? shadeClassForCurrent : `role-${safeRole}`;
            const antLabel = `${item.role} (先行詞)`;
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
      // 先行詞 + 関係詞節/接触節/分詞句 の構造
      let hasAppendedAny = false;

      chunk.sub_chunks.forEach((sub) => {
        if (hasAppendedAny) {
          const sep = document.createElement("span");
          sep.className = "sub-chunk-sep";
          sep.textContent = "/";
          subContainer.appendChild(sep);
        }

        if (sub.role !== "M" && sub.role !== "関係詞") {
          // 先行詞：Mチャンクなら外側のグレー(chunkGrayLevel)、S/O/Cなら元の骨格カラー
          const antColorClass = isMod ? `m-shade-${chunkGrayLevel}` : `role-${safeRole}`;
          subContainer.appendChild(createInlineChunkChip(sub.text, "先行詞", antColorClass));
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

// 5. 英文分析結果の描画
function renderEnglishResult(data) {
  document.getElementById("en-pattern").textContent = data.pattern;

  // ⑤ 形式主語・真主語・形式目的語・真目的語の()付き表記および関係詞表記の適用
  annotateSpecialRolesAndRelatives(data.chunks, data.tokens, data.text);

  // チャンクの描画（入れ子の内から外に行くにつれて濃いグレー）
  const chunksContainer = document.getElementById("en-chunks");
  chunksContainer.innerHTML = "";
  data.chunks.forEach((chunk) => {
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
      const myGrayLevel = isAdnominal && !isTopLevel ? currentGrayLevel : getChunkGrayLevel(ch);
      const innerForceGray = nextInMod || Boolean(ch.clause_type);

      const childItems = ch.sub_chunks.map((sub) => {
        const subIsMod = sub.role === "M" || sub.role === "関係詞";
        const subIsAnt = isAdnominal && !subIsMod;
        const hasGrandChildren = Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0;
        const childGrayLevel = hasGrandChildren
          ? (hasAdnominalModifierSubChunk(sub) ? myGrayLevel : getChunkGrayLevel(sub))
          : myGrayLevel;
        const childInMod = subIsAnt ? nextInMod : (innerForceGray || subIsMod);
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

  // 節内部（または主節）のチャンクノード列を結合して1つの節/文ノードにするヘルパー
  function buildClauseTreeFromNodes(nodesSlice, isTopSentence, inModClause = false, grayLevel = 0) {
    if (nodesSlice.length === 1) return nodesSlice[0];

    if ((nodesSlice[0].chunkRole === "Conj" || nodesSlice[0].chunkRole === "関係詞") && nodesSlice.length > 1) {
      const restTree = buildClauseTreeFromNodes(nodesSlice.slice(1), false, inModClause, grayLevel);
      const leadLabel = nodesSlice[0].chunkRole === "関係詞" ? "関係詞 + 節" : "Conj + 節";
      const topLbl = isTopSentence ? "文 (Sentence)" : leadLabel;
      return mergeTwoNodes(nodesSlice[0], restTree, topLbl, isTopSentence ? "Sentence" : "VP", inModClause, grayLevel);
    }

    const conjIdx = nodesSlice.findIndex((n, idx) => idx > 0 && n.chunkRole === "Conj");
    const firstVIdx = nodesSlice.findIndex((n) => n.chunkRole === "V");
    if (conjIdx !== -1 && firstVIdx !== -1 && conjIdx > firstVIdx) {
      const rightSlice = nodesSlice.slice(conjIdx + 1);
      const rightHasOwnSubjAndVerb = rightSlice.some((n) => n.chunkRole === "S") && rightSlice.some((n) => n.chunkRole === "V");

      if (rightHasOwnSubjAndVerb) {
        const clause1 = buildClauseTreeFromNodes(nodesSlice.slice(0, conjIdx), false, inModClause, grayLevel);
        const conjNode = nodesSlice[conjIdx];
        const clause2 = buildClauseTreeFromNodes(rightSlice, false, inModClause, grayLevel);
        const conjRight = mergeTwoNodes(conjNode, clause2, "Conj + 節", "VP", inModClause, grayLevel);
        const topLbl = isTopSentence ? "文 (重文)" : "節 + 節";
        return mergeTwoNodes(clause1, conjRight, topLbl, isTopSentence ? "Sentence" : "VP", inModClause, grayLevel);
      }

      if (!rightSlice.some((n) => n.chunkRole === "S")) {
        const prefixNodes = nodesSlice.slice(0, firstVIdx);
        const vp1Nodes = nodesSlice.slice(firstVIdx, conjIdx);
        const conjNode = nodesSlice[conjIdx];
        const vp2Nodes = rightSlice;

        const vp1 = buildClauseTreeFromNodes(vp1Nodes, false, inModClause, grayLevel);
        const vp2 = buildClauseTreeFromNodes(vp2Nodes, false, inModClause, grayLevel);
        const conjRight = mergeTwoNodes(conjNode, vp2, "Conj + VP", "VP", inModClause, grayLevel);
        let combinedVp = mergeTwoNodes(vp1, conjRight, "VP (並列述部)", "VP", inModClause, grayLevel);

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
          const prtText = nextNode.tokens ? nextNode.tokens.map((t) => t.text).join(" ") : "";
          const pvLabel = mainVerbText ? `VP (句動詞: ${mainVerbText} ... ${prtText})` : "VP (句動詞)";
          vpNode = mergeTwoNodes(vpNode, nextNode, pvLabel, "V", inModClause, grayLevel);
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
    combined.label = nodeLabel;
    combined.role = item.role;
    combined.chunkRole = item.role;
    combined.displayRoleLabel = item.displayRoleLabel || nodeLabel;
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