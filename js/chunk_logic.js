export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 並列述部・並列節コンテナのロールかどうか判定するヘルパー
export function isCoordContainerRole(role) {
    return role === "並列述部" || role === "並列節";
}

// 同格・敷衍チャンクかどうか判定するヘルパー
export function isAppositiveChunk(chunk) {
    if (!chunk) return false;
    if (chunk.role === "同格") return true;
    return Boolean(
        chunk.clause_type &&
        /同格・敷衍|敷衍・独立節|文同格/.test(chunk.clause_type)
    );
}

// 2つのチャンク間の区切り記号を「＝」にすべきか判定するヘルパー（並列する同格要素同士は「/」を維持）
export function shouldUseEqualSep(prevChunk, currChunk) {
    if (!prevChunk || !currChunk) return false;
    if (!isAppositiveChunk(currChunk)) return false;
    if (isAppositiveChunk(prevChunk) || prevChunk.role === "Conj") return false;
    return true;
}

// ロール文字列をCSSクラス名として安全な形式に正規化するヘルパー
export function getSafeRoleClassName(role) {
    const str = String(role || "").trim();
    if (str === "C / M") return "C";
    return str.replace(/[+\s/]+/g, "");
}

// 等位接続グループ (coord_group) 用の落ち着いた枠線カラークラスを返すヘルパー
export function getCoordBorderClass(coordGroup) {
    if (typeof coordGroup !== "number" || coordGroup <= 0) return "";
    return `coord-border coord-border-${((coordGroup - 1) % 5) + 1}`;
}

// 同じ coord_group に属する並列要素同士のグレーレベルをグループ内の最大値に揃えるマップを計算するヘルパー
export function computeCoordGroupGrayMap(chunkList, fallbackLevel = 0) {
    const map = {};
    if (!Array.isArray(chunkList)) return map;
    chunkList.forEach((ch) => {
        if (typeof ch.coord_group === "number" && ch.coord_group > 0) {
            const hasSubs = Array.isArray(ch.sub_chunks) && ch.sub_chunks.length > 0;
            const lv = hasSubs ? getChunkGrayLevel(ch) : clampGrayLevel(fallbackLevel);
            if (map[ch.coord_group] === undefined || lv > map[ch.coord_group]) {
                map[ch.coord_group] = lv;
            }
        }
    });
    return map;
}

// サブチャンクが後置修飾を受ける被修飾語（先行詞・主要部名詞句）かどうか判定するヘルパー
export function isAdnominalHeadSubChunk(sub, parentChunk = null) {
    if (!sub) return false;
    if (["関係詞", "間接疑問", "Conj", "V", "動名詞", "分詞", "前置詞", "並列述部", "並列節"].includes(sub.role)) {
        return false;
    }
    if (sub.clause_type && /関係詞|接触節|分詞句|同格節|後置修飾|前置詞/.test(sub.clause_type)) {
        return false;
    }
    if (sub.role !== "M") return true;
    return Boolean(
        parentChunk &&
        parentChunk.role === "M" &&
        !sub.clause_type &&
        (!Array.isArray(sub.sub_chunks) || sub.sub_chunks.length === 0)
    );
}

// 入れ子チャンクが「先行詞(被修飾語) + 関係詞節/接触節/分詞句/同格節/後置修飾不定詞/前置詞句」構造を持っているか判定するヘルパー
export function hasAdnominalModifierSubChunk(chunk) {
    if (!chunk || !Array.isArray(chunk.sub_chunks) || chunk.sub_chunks.length < 2) return false;
    if (isCoordContainerRole(chunk.role)) return false;
    if (chunk.clause_type && /節|構文|不定詞|動名詞|動詞|前置詞|並列/.test(chunk.clause_type)) {
        return false;
    }
    const hasPredicateOrPrep = chunk.sub_chunks.some((s) =>
        ["V", "動名詞", "分詞", "前置詞", "並列述部", "並列節"].includes(s.role)
    );
    if (hasPredicateOrPrep) return false;

    const isPlainCoordMList =
        chunk.role === "M" && chunk.sub_chunks.some((s) => s.role === "Conj");
    const firstModIdx = chunk.sub_chunks.findIndex((s, idx) => {
        if (s.role !== "M") return false;
        if (
            s.clause_type &&
            /関係詞|接触節|分詞句|同格節|後置修飾|前置詞/.test(s.clause_type) &&
            !/複合関係詞/.test(s.clause_type)
        ) {
            return true;
        }
        return (
            !s.clause_type &&
            !isPlainCoordMList &&
            idx > 0 &&
            chunk.sub_chunks[idx - 1].role !== "Conj"
        );
    });
    if (firstModIdx <= 0) return false;

    return chunk.sub_chunks
        .slice(0, firstModIdx)
        .some((s) => isAdnominalHeadSubChunk(s, chunk));
}

// 入れ子チャンクが関係詞節（関係詞・接触節）による修飾構造を持っているか判定するヘルパー
export function hasRelativeModifierSubChunk(chunk) {
    if (!hasAdnominalModifierSubChunk(chunk)) return false;
    return chunk.sub_chunks.some(
        (s) =>
            s.role === "M" &&
            s.clause_type &&
            /関係詞|接触節/.test(s.clause_type) &&
            !/複合関係詞/.test(s.clause_type)
    );
}

// ⑤ 関係詞の判定および「形式主語・真主語・形式目的語・真目的語」の()付きラベル付与を行う関数
const RELATIVE_WORD_REGEX = /^(who|whom|whose|which|that|where|when|why|what|whatever|whoever|whomever|whichever|wherever|whenever|however)$/i;
const PREP_RELATIVE_REGEX = /^(in|on|at|to|for|from|with|by|of|about|through|under|over|between|among|into|onto|upon|within|without|during|after|before|against|toward|towards)\s+(which|whom|whose)$/i;
const FREE_REL_REGEX = /^(what|whatever|whoever|whomever|whichever|wherever|whenever|however)$/i;
const INTERROGATIVE_WORD_REGEX = /^(who|whom|whose|which|what|when|where|why|how|whether|if)$/i;
const INTERROGATIVE_NO_IF_REGEX = /^(who|whom|whose|which|what|when|where|why|how|whether)$/i;
const INTERROGATIVE_PHRASE_LEAD_REGEX = /^(what|which|whose|how)\s+/i;
const PREP_INTERROGATIVE_REGEX = /^(in|on|at|to|for|from|with|by|of|about|through|under|over|between|among|into|onto|upon|within|without|during|after|before|against|toward|towards)\s+(who|whom|whose|which|what|where|when|how)\b/i;
const REL_ADJ_PHRASE_REGEX = /^(?:(?:in|on|at|to|for|from|with|by|of|about|through|under|over|between|among|into|onto|upon|within|without|during|after|before|against|toward|towards)\s+)?(which|what|whose)\b/i;

function isConjunctiveAdverbHoweverChunk(chunk, tokens) {
    const clean = String((chunk && chunk.text) || "").trim().toLowerCase();
    if (clean !== "however") return false;
    if (!Array.isArray(tokens) || typeof chunk.start !== "number") return false;

    const tokIdx = tokens.findIndex((t) => t.id === chunk.start);
    if (tokIdx === -1) return false;

    const tok = tokens[tokIdx];
    if (tok.tag === "RB") return true;

    const prevTok = tokIdx > 0 ? tokens[tokIdx - 1] : null;
    const nextTok = tokIdx + 1 < tokens.length ? tokens[tokIdx + 1] : null;

    const isAfterBoundary = !prevTok || /^[,;:.!?—–(]$/.test(prevTok.text);
    const isBeforeComma = Boolean(nextTok && nextTok.text === ",");
    const isSentenceEndConjAdv =
        Boolean(prevTok && prevTok.text === ",") &&
        (!nextTok || /^[.!?;:)—–]$/.test(nextTok.text));

    if ((isAfterBoundary && isBeforeComma) || isSentenceEndConjAdv) {
        return true;
    }
    if (prevTok && prevTok.text === ";" && nextTok && nextTok.pos !== "ADJ" && nextTok.pos !== "ADV") {
        return true;
    }
    return false;
}

function isSentenceInitialQuestionOrExclamative(chunk, tokens, fullText = "") {
    if (!chunk || typeof chunk.start !== "number" || !Array.isArray(tokens)) {
        return false;
    }
    const tokIdx = tokens.findIndex((t) => t.id === chunk.start);
    if (tokIdx === -1) return false;

    const tok = tokens[tokIdx];
    if (tok.dep === "predet") return true;

    let prevIdx = tokIdx - 1;
    while (prevIdx >= 0 && /^["“‘``(\[]$/.test(tokens[prevIdx].text)) {
        prevIdx--;
    }
    const isAtSentenceStart = prevIdx < 0 || /^[.!?]$/.test(tokens[prevIdx].text);
    if (!isAtSentenceStart) return false;

    for (let i = tokIdx + 1; i < tokens.length; i++) {
        const tText = tokens[i].text;
        if (tText === "?" || tText === "!") return true;
        if (tText === ".") return false;
    }
    const trimmed = String(fullText || "").trim();
    return trimmed.endsWith("?") || trimmed.endsWith("!");
}

const INDIRECT_Q_PREDICATES = new Set([
    "ask",
    "wonder",
    "inquire",
    "enquire",
    "question",
    "curious",
    "uncertain",
    "unsure",
    "doubt",
    "doubtful"
]);

const NEG_INDIRECT_Q_VERBS = new Set([
    "know",
    "tell",
    "say",
    "predict",
    "guess",
    "figure",
    "determine",
    "decide",
    "care"
]);

function isIndirectQuestionWhatChunk(chunk, tokens, isInsideRelClause, isQuestionOrExclamativeStart) {
    if (isInsideRelClause || isQuestionOrExclamativeStart) return false;
    const clean = String((chunk && chunk.text) || "").trim().toLowerCase();
    if (clean !== "what") return false;
    if (!Array.isArray(tokens) || typeof chunk.start !== "number") return false;

    const tokenById = {};
    const childrenByHead = {};
    tokens.forEach((t) => {
        tokenById[t.id] = t;
        if (!childrenByHead[t.head_id]) childrenByHead[t.head_id] = [];
        if (t.head_id !== t.id) childrenByHead[t.head_id].push(t);
    });

    const whatTok = tokenById[chunk.start];
    if (!whatTok) return false;

    const whatChildren = childrenByHead[whatTok.id] || [];
    let spanHead = whatTok;
    if (!whatChildren.some((c) => c.pos === "VERB" || c.pos === "AUX")) {
        let currAnc = tokenById[whatTok.head_id];
        for (let step = 0; step < 2 && currAnc; step++) {
            if (
                currAnc.id !== whatTok.id &&
                (currAnc.pos === "VERB" || currAnc.pos === "AUX") &&
                currAnc.id > whatTok.id &&
                currAnc.dep !== "ROOT"
            ) {
                spanHead = currAnc;
                break;
            }
            if (currAnc.head_id === currAnc.id) break;
            currAnc = tokenById[currAnc.head_id];
        }
    }

    const spanChildren = childrenByHead[spanHead.id] || [];
    const isWhToInf =
        spanHead.id !== whatTok.id &&
        spanChildren.some(
            (c) =>
                (c.dep === "aux" || c.dep === "mark") &&
                String(c.lemma || "").toLowerCase() === "to" &&
                c.id > whatTok.id &&
                c.id < spanHead.id
        );
    if (isWhToInf) return true;

    let govPred = spanHead.head_id !== spanHead.id ? tokenById[spanHead.head_id] : null;
    if (govPred && govPred.pos === "ADP" && govPred.head_id !== govPred.id) {
        govPred = tokenById[govPred.head_id];
    }
    if (!govPred) return false;

    const govChildren = childrenByHead[govPred.id] || [];
    const govParent = govPred.head_id !== govPred.id ? tokenById[govPred.head_id] : null;
    const govParentChildren = govParent ? (childrenByHead[govParent.id] || []) : [];

    const isThereNoDoingGov =
        govPred.tag === "VBG" &&
        govChildren.some(
            (c) =>
                (c.dep === "det" || c.dep === "neg") &&
                String(c.lemma || "").toLowerCase() === "no"
        ) &&
        Boolean(
            govParent &&
            String(govParent.lemma || "").toLowerCase() === "be" &&
            govParentChildren.some(
                (c) => c.dep === "expl" && String(c.lemma || "").toLowerCase() === "there"
            )
        );
    if (isThereNoDoingGov) return true;

    const govLow = String(govPred.lemma || "").toLowerCase();
    if (INDIRECT_Q_PREDICATES.has(govLow)) return true;

    if (NEG_INDIRECT_Q_VERBS.has(govLow)) {
        const negWords = new Set(["not", "never", "no", "hardly", "scarcely", "nobody", "nothing", "none"]);
        const hasDirectNeg = govChildren.some(
            (c) => c.dep === "neg" || negWords.has(String(c.lemma || "").toLowerCase())
        );
        const hasNegSubj = govChildren.some((c) => {
            if (c.dep !== "nsubj" && c.dep !== "nsubjpass") return false;
            const stack = [c];
            while (stack.length > 0) {
                const cur = stack.pop();
                if (["no", "nobody", "nothing", "none"].includes(String(cur.lemma || "").toLowerCase())) {
                    return true;
                }
                (childrenByHead[cur.id] || []).forEach((ch) => stack.push(ch));
            }
            return false;
        });
        if (hasDirectNeg || hasNegSubj) return true;
    }

    return false;
}

function isIndirectQuestionChunk(
    chunk,
    chunkList,
    idx,
    tokens,
    parentClauseType,
    isInsideRelClause,
    isQuestionOrExclamativeStart
) {
    if (isInsideRelClause || isQuestionOrExclamativeStart) return false;
    const pType = String(parentClauseType || "");
    if (/関係形容詞/.test(pType)) return false;

    const clean = String((chunk && chunk.text) || "").trim();
    if (!clean) return false;

    // 1. バックエンドで「間接疑問節」と判定された節の先頭疑問詞・疑問詞句
    if (/間接疑問/.test(pType)) {
        if (
            idx === 0 &&
            (INTERROGATIVE_WORD_REGEX.test(clean) ||
                INTERROGATIVE_PHRASE_LEAD_REGEX.test(clean) ||
                PREP_INTERROGATIVE_REGEX.test(clean))
        ) {
            return true;
        }
    }

    // 2. 疑問詞＋to不定詞 (what to do / how to swim / whether to go / which book to buy 等)
    const hasFollowingToInf =
        Array.isArray(chunkList) &&
        idx === 0 &&
        chunkList.some(
            (other, oIdx) =>
                oIdx > idx && String(other.role || "").startsWith("to不定詞")
        );
    if (hasFollowingToInf && !/後置修飾/.test(pType)) {
        if (
            INTERROGATIVE_NO_IF_REGEX.test(clean) ||
            INTERROGATIVE_PHRASE_LEAD_REGEX.test(clean) ||
            (PREP_INTERROGATIVE_REGEX.test(clean) && !PREP_RELATIVE_REGEX.test(clean))
        ) {
            return true;
        }
    }

    // 3. 名詞節先頭の what 以外の疑問詞・疑問詞句 (who/where/when/why/how/which/whose/whether)
    if (/名詞節/.test(pType) && idx === 0 && clean.toLowerCase() !== "what") {
        if (
            INTERROGATIVE_NO_IF_REGEX.test(clean) ||
            INTERROGATIVE_PHRASE_LEAD_REGEX.test(clean) ||
            PREP_INTERROGATIVE_REGEX.test(clean)
        ) {
            return true;
        }
    }

    // 4. 従来の what 間接疑問判定（疑問述語・否定述語・There is no doing 等）
    return isIndirectQuestionWhatChunk(
        chunk,
        tokens,
        isInsideRelClause,
        isQuestionOrExclamativeStart
    );
}

function isRelativeChunkText(
    text,
    isInsideRelClause,
    isQuestionOrExclamativeStart,
    parentClauseType = ""
) {
    const clean = String(text || "").trim();
    if (!clean) return false;
    if (/関係形容詞/.test(parentClauseType || "") && REL_ADJ_PHRASE_REGEX.test(clean)) {
        return true;
    }
    if (PREP_RELATIVE_REGEX.test(clean)) return true;
    if (isInsideRelClause && RELATIVE_WORD_REGEX.test(clean)) return true;
    if (!isQuestionOrExclamativeStart && FREE_REL_REGEX.test(clean)) return true;
    return false;
}

export function annotateSpecialRolesAndRelatives(chunks, tokens, fullText = "") {
    if (!Array.isArray(chunks)) return;
    const relTokenLabels = {};
    const indirectQTokenLabels = {};
    const specialTokenLabels = {};

    function processChunkList(chunkList, parentClauseType = "") {
        if (!Array.isArray(chunkList) || chunkList.length === 0) return;

        const origClauseTypes = new Map();
        chunkList.forEach((c) => {
            origClauseTypes.set(c, c.clause_type || "");
        });

        // 1. 形式主語 (It) と 真主語 の検出
        const sChunks = chunkList.filter((c) => c.role === "S");
        const hasExplicitFormalS = sChunks.some(
            (c) =>
                c.clause_type === "形式主語" ||
                (c.clause_type && c.clause_type.includes("真主語"))
        );
        const hasTrueSubjClauseType = sChunks
            .slice(1)
            .some(
                (c) =>
                    c.clause_type &&
                    /真主語|不定詞|動名詞|名詞節|節/.test(c.clause_type)
            );
        const isCoordinatedItS =
            sChunks.length >= 2 &&
            typeof sChunks[0].coord_group === "number" &&
            sChunks[0].coord_group === sChunks[1].coord_group;
        if (
            sChunks.length >= 2 &&
            String(sChunks[0].text || "").trim().toLowerCase() === "it" &&
            !isCoordinatedItS &&
            (hasExplicitFormalS || hasTrueSubjClauseType)
        ) {
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
        const hasC = chunkList.some((c) => c.role === "C" || c.role === "C / M");
        const hasExplicitFormalO = oChunks.some(
            (c) =>
                c.clause_type === "形式目的語" ||
                (c.clause_type && c.clause_type.includes("真目的語"))
        );
        const hasTrueObjClauseType = oChunks
            .slice(1)
            .some(
                (c) =>
                    c.clause_type &&
                    /真目的語|不定詞|動名詞|名詞節|節/.test(c.clause_type)
            );
        const isCoordinatedItO =
            oChunks.length >= 2 &&
            typeof oChunks[0].coord_group === "number" &&
            oChunks[0].coord_group === oChunks[1].coord_group;
        if (
            oChunks.length >= 2 &&
            String(oChunks[0].text || "").trim().toLowerCase() === "it" &&
            !isCoordinatedItO &&
            (hasExplicitFormalO || (hasC && hasTrueObjClauseType))
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

        // 既存の clause_type に「形式主語」「真主語」「形式目的語」「真目的語」が含まれている場合の統一
        chunkList.forEach((c) => {
            if (c.clause_type === "形式主語") {
                c.displayRoleLabel = "S (形式主語)";
                for (let idx = c.start; idx <= c.end; idx++) {
                    specialTokenLabels[idx] = "S (形式主語)";
                }
            } else if (c.clause_type && c.clause_type.includes("真主語")) {
                c.displayRoleLabel = "S (真主語)";
                c.clause_type = "真主語";
                for (let idx = c.start; idx <= c.end; idx++) {
                    specialTokenLabels[idx] = "S (真主語)";
                }
            } else if (c.clause_type === "形式目的語") {
                c.displayRoleLabel = "O (形式目的語)";
                for (let idx = c.start; idx <= c.end; idx++) {
                    specialTokenLabels[idx] = "O (形式目的語)";
                }
            } else if (c.clause_type && c.clause_type.includes("真目的語")) {
                c.displayRoleLabel = "O (真目的語)";
                c.clause_type = "真目的語";
                for (let idx = c.start; idx <= c.end; idx++) {
                    specialTokenLabels[idx] = "O (真目的語)";
                }
            }
        });

        // 3. 間接疑問および関係詞の検出（間接疑問節・wh+to不定詞・関係詞節・非制限関係詞節・関係形容詞・複合関係詞節の先頭要素）
        const isRelContext =
            /関係詞/.test(parentClauseType || "") && !/関係詞省略/.test(parentClauseType || "");
        chunkList.forEach((c, idx) => {
            const isQOrExcl = isSentenceInitialQuestionOrExclamative(c, tokens, fullText);
            const origRole = String(c.role || "").trim();
            const caseSuffix = ["S", "O", "C"].includes(origRole) ? ` (${origRole})` : "";
            if (
                idx <= 1 &&
                !isConjunctiveAdverbHoweverChunk(c, tokens) &&
                isIndirectQuestionChunk(
                    c,
                    chunkList,
                    idx,
                    tokens,
                    parentClauseType,
                    isRelContext,
                    isQOrExcl
                )
            ) {
                const iqLabel = `間接疑問${caseSuffix}`;
                c.role = "間接疑問";
                c.displayRoleLabel = iqLabel;
                delete c.clause_type;
                if (typeof c.start === "number" && typeof c.end === "number") {
                    for (let ti = c.start; ti <= c.end; ti++) {
                        indirectQTokenLabels[ti] = iqLabel;
                    }
                }
            } else if (
                idx <= 1 &&
                !isConjunctiveAdverbHoweverChunk(c, tokens) &&
                isRelativeChunkText(c.text, isRelContext, isQOrExcl, parentClauseType)
            ) {
                const relLabel = `関係詞${caseSuffix}`;
                c.role = "関係詞";
                c.displayRoleLabel = relLabel;
                delete c.clause_type;
                if (typeof c.start === "number" && typeof c.end === "number") {
                    for (let ti = c.start; ti <= c.end; ti++) {
                        relTokenLabels[ti] = relLabel;
                    }
                }
            }

            if (Array.isArray(c.sub_chunks) && c.sub_chunks.length > 0) {
                processChunkList(c.sub_chunks, origClauseTypes.get(c) || c.clause_type || "");
            }
        });
    }

    processChunkList(chunks, "");

    // トークン一覧データ側にも間接疑問・関係詞・形式主語/真主語/形式目的語/真目的語を反映
    if (Array.isArray(tokens)) {
        tokens.forEach((t) => {
            if (indirectQTokenLabels[t.id]) {
                t.svocm = indirectQTokenLabels[t.id];
            } else if (relTokenLabels[t.id]) {
                t.svocm = relTokenLabels[t.id];
            } else if (specialTokenLabels[t.id]) {
                t.svocm = specialTokenLabels[t.id];
            }
        });
    }
}

// 深さレベル(0:最内 〜 3:最外)を 0〜3 のグレーインデックスに変換するヘルパー
export function clampGrayLevel(level) {
    return Math.min(Math.max(Math.round(level), 0), 3);
}

// ④ 節（チャンクの塊）ごとのグレーレベルを計算するヘルパー（最内の節が 0、外側の節に行くにつれて +1）
export function getChunkGrayLevel(chunk) {
    if (!chunk || !Array.isArray(chunk.sub_chunks) || chunk.sub_chunks.length === 0) {
        return 0;
    }
    if (hasAdnominalModifierSubChunk(chunk)) {
        let hasNestedMod = false;
        let maxModLevel = 0;
        chunk.sub_chunks.forEach((sub) => {
            if (Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0) {
                hasNestedMod = true;
                const lv = getChunkGrayLevel(sub);
                if (lv > maxModLevel) maxModLevel = lv;
            }
        });
        return hasNestedMod ? clampGrayLevel(maxModLevel + 1) : 0;
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
export function getChunkDisplayRoleText(chunk, includeClauseType = true) {
    if (chunk.displayRoleLabel) {
        return chunk.displayRoleLabel;
    }
    if (includeClauseType && chunk.clause_type) {
        if (String(chunk.clause_type).startsWith(String(chunk.role))) {
            return `${chunk.clause_type}`;
        }
        return `${chunk.role} (${chunk.clause_type})`;
    }
    return `${chunk.role}`;
}

// チャンク範囲のトークン列からカンマ等を含む自然な英文テキストを復元するヘルパー
export function joinChunkSpanText(chunkSlice, tokens) {
    if (!Array.isArray(chunkSlice) || chunkSlice.length === 0) return "";
    const startId = chunkSlice[0].start;
    const endId = chunkSlice[chunkSlice.length - 1].end;
    if (Array.isArray(tokens) && typeof startId === "number" && typeof endId === "number") {
        const spanTokens = tokens.filter((t) => t.id >= startId && t.id <= endId);
        if (spanTokens.length > 0) {
            let text = "";
            let inDoubleQuote = false;
            spanTokens.forEach((t, idx) => {
                const curr = t.text;
                const prev = idx > 0 ? spanTokens[idx - 1].text : "";
                if (idx > 0) {
                    const isClosingDoubleQuote = curr === '"' && inDoubleQuote;
                    const isAfterOpeningDoubleQuote = prev === '"' && inDoubleQuote;
                    const noSpaceBeforeCurr =
                        /^[,.;:!?)}\]”’'']$/.test(curr) ||
                        /^(n't|'s|'re|'ve|'ll|'d|'m|')$/i.test(curr) ||
                        curr === "-" ||
                        isClosingDoubleQuote;
                    const noSpaceAfterPrev =
                        /^[(\[{“‘``]$/.test(prev) ||
                        prev === "-" ||
                        isAfterOpeningDoubleQuote;
                    if (!noSpaceBeforeCurr && !noSpaceAfterPrev) {
                        text += " ";
                    }
                }
                text += curr;
                if (curr === '"') {
                    inDoubleQuote = !inDoubleQuote;
                }
            });
            return text;
        }
    }
    return chunkSlice.map((c) => c.text).join(" ");
}

export const CORRELATIVE_LEAD_REGEX = /^(both|either|neither|not\s+only|not\s+just|not\s+merely|not\s+simply)$/i;
const ARG_CORRELATIVE_LEAD_REGEX = /^(both|either|neither)$/i;
export const NOT_ONLY_LEAD_REGEX = /^not\s+(only|just|merely|simply)$/i;

// 2つのチャンク間にカンマ・セミコロンが存在するか判定するヘルパー
function hasCommaBetweenChunks(prevChunk, nextChunk, tokens) {
    if (!Array.isArray(tokens) || !prevChunk || !nextChunk) return true;
    if (typeof prevChunk.end !== "number" || typeof nextChunk.start !== "number") return true;
    return tokens.some(
        (t) => t.id > prevChunk.end && t.id < nextChunk.start && /^[,;]$/.test(t.text)
    );
}

// 形式主語/真主語・形式目的語/真目的語を区別するためのキーを取得するヘルパー
export function getSpecialRoleKey(item) {
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
            ARG_CORRELATIVE_LEAD_REGEX.test(String(chunkList[i].text || "").trim()) &&
            i + 1 < chunkList.length &&
            ["S", "O", "C", "C / M", "M", "同格"].includes(chunkList[i + 1].role)
        ) {
            hasLeadPreconj = true;
            firstRoleIdx = i + 1;
        }

        const role = chunkList[firstRoleIdx].role;
        if (
            role === "S" ||
            role === "O" ||
            role === "C" ||
            role === "C / M" ||
            role === "M" ||
            role === "同格"
        ) {
            const prevChunk = !hasLeadPreconj && firstRoleIdx > 0 ? chunkList[firstRoleIdx - 1] : null;
            const prevLeadText =
                prevChunk && (prevChunk.role === "Conj" || prevChunk.role === "M")
                    ? String(prevChunk.text || "").trim()
                    : "";
            const precededByNotSoMuch =
                Boolean(prevChunk && prevChunk.role === "Conj") && /^not\s+so\s+much$/i.test(prevLeadText);
            const precededByNotOnly = NOT_ONLY_LEAD_REGEX.test(prevLeadText);
            const isFlatCorrelativeConj = (chunk) => {
                if (!chunk || chunk.role !== "Conj") return false;
                const txt = String(chunk.text || "").trim();
                if (precededByNotSoMuch && /^as$/i.test(txt)) return true;
                if (/^but\s+also$/i.test(txt) || /^as\s+well\s+as$/i.test(txt)) return true;
                if (precededByNotOnly && /^but$/i.test(txt)) return true;
                return false;
            };
            const baseKey = getSpecialRoleKey(chunkList[firstRoleIdx]);
            let j = firstRoleIdx + 1;
            let hasConj = false;

            while (j < chunkList.length) {
                if (isFlatCorrelativeConj(chunkList[j])) {
                    break;
                }
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
                        if (isFlatCorrelativeConj(chunkList[k])) {
                            break;
                        }
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
            const isPrepCoordObjList =
                !isTopLevel &&
                startSliceIdx === 1 &&
                chunkList[0].role === "前置詞" &&
                j === chunkList.length;
            if (hasConj && j - firstRoleIdx >= 3) {
                if (isEntireNonTopList || isPrepCoordObjList) {
                    result.push(...chunkList.slice(startSliceIdx, j));
                    i = j;
                    continue;
                }
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
export function buildDisplayChunksHierarchy(rawChunkList, tokens, isTopLevel = false) {
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
                if (!copy.clause_type && !isCoordContainerRole(copy.role) && copy.sub_chunks.some((s) => s.role === "Conj")) {
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

    // 助動詞＋副詞＋動詞（has [V] greatly [M] improved [V]）、句動詞粒子、および
    // 部分倒置（Rarely do [V] we [S] recognize [V]）のように1つ目のVの前にSがなく間にConjもカンマもない分割Vは別動詞句・等位節の先頭から除外する
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
        const hasSubjBeforePrevV = collapsedList.slice(0, prevV).some(
            (ch) =>
                ch.role === "S" &&
                ch.displayRoleLabel !== "S (真主語)" &&
                ch.clause_type !== "真主語"
        );
        const hasConjBetween = betweenSlice.some((ch) => ch.role === "Conj");
        const hasCommaBetween = hasCommaBetweenChunks(collapsedList[prevV], c, tokens);
        const isAuxSubjVerbInversion =
            hasSubjBetween && !hasSubjBeforePrevV && !hasConjBetween && !hasCommaBetween;
        if (!isAuxSubjVerbInversion && (hasSubjBetween || hasConjBetween || hasCommaBetween)) {
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

        const hasFlatCorrelativeVerbConj = collapsedList
            .slice(firstVIdx + 1, lastVIdx)
            .some((c) => {
                if (c.role !== "Conj") return false;
                const txt = String(c.text || "").trim();
                if (/^but\s+also$/i.test(txt) || /^as\s+well\s+as$/i.test(txt)) {
                    return true;
                }
                if (
                    /^but$/i.test(txt) &&
                    firstVIdx > 0 &&
                    (collapsedList[firstVIdx - 1].role === "M" || collapsedList[firstVIdx - 1].role === "Conj") &&
                    NOT_ONLY_LEAD_REGEX.test(String(collapsedList[firstVIdx - 1].text || "").trim())
                ) {
                    return true;
                }
                return false;
            });

        // 4-A. 動詞単体の並列＋共通の目的語/補語（例: He [bought, cooked, and ate] the fish.）
        const onlyVerbsAndConjBetween = collapsedList
            .slice(firstVIdx, lastVIdx + 1)
            .every((c) => c.role === "V" || c.role === "Conj");
        const hasSharedArgsAfterLastV = collapsedList
            .slice(lastVIdx + 1)
            .some((c) => c.role === "O" || c.role === "C" || c.role === "M");

        if (
            !hasSubjBetweenFirstTwoV &&
            hasConjBetweenVerbs &&
            !hasFlatCorrelativeVerbConj &&
            onlyVerbsAndConjBetween &&
            hasSharedArgsAfterLastV
        ) {
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
        if (!hasSubjBetweenFirstTwoV && hasConjBetweenVerbs && !hasFlatCorrelativeVerbConj) {
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