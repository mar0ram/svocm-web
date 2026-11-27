import {
  CORRELATIVE_LEAD_REGEX,
  NOT_ONLY_LEAD_REGEX,
  clampGrayLevel,
  computeCoordGroupGrayMap,
  escapeHtml,
  getChunkDisplayRoleText,
  getChunkGrayLevel,
  getSpecialRoleKey,
  hasAdnominalModifierSubChunk,
  hasRelativeModifierSubChunk,
  isAdnominalHeadSubChunk,
  isCoordContainerRole
} from "./chunk_logic.js";

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
export function buildHierarchicalTreeSvg(tokens, chunks) {
  const validTokens = tokens.filter((t) => t.pos !== "PUNCT");
  if (validTokens.length === 0) {
    return { svg: "", width: 520, height: 300 };
  }

  const roleStyle = {
    S: { fill: "#eff6ff", stroke: "#2563eb", badge: "#2563eb", text: "#1e40af" },
    V: { fill: "#fef2f2", stroke: "#dc2626", badge: "#dc2626", text: "#991b1b" },
    O: { fill: "#ecfdf5", stroke: "#059669", badge: "#059669", text: "#065f46" },
    C: { fill: "#fffbeb", stroke: "#d97706", badge: "#d97706", text: "#92400e" },
    "C / M": { fill: "#fffbeb", stroke: "#d97706", badge: "#d97706", text: "#92400e" },
    強調部分: { fill: "#f5f3ff", stroke: "#7c3aed", badge: "#7c3aed", text: "#5b21b6" },
    同格: { fill: "#f0fdfa", stroke: "#0d9488", badge: "#0d9488", text: "#115e59" },
    M: { fill: "#e2e8f0", stroke: "#64748b", badge: "#475569", text: "#0f172a" },
    前置詞: { fill: "#f1f5f9", stroke: "#94a3b8", badge: "#64748b", text: "#1e293b" },
    動名詞: { fill: "#f1f5f9", stroke: "#94a3b8", badge: "#64748b", text: "#1e293b" },
    分詞: { fill: "#f1f5f9", stroke: "#94a3b8", badge: "#64748b", text: "#1e293b" },
    並列述部: { fill: "#e2e8f0", stroke: "#64748b", badge: "#475569", text: "#0f172a" },
    並列節: { fill: "#e2e8f0", stroke: "#64748b", badge: "#475569", text: "#0f172a" },
    関係詞: { fill: "#f8fafc", stroke: "#cbd5e1", badge: "#94a3b8", text: "#334155" },
    間接疑問: { fill: "#f8fafc", stroke: "#cbd5e1", badge: "#94a3b8", text: "#334155" },
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

  // 等位接続グループ (coord_group) 用の明るめで見やすい枠線カラーパレット（背景色は変えず枠線のみ強調）
  const coordBorderStrokes = [
    "#06b6d4", // Group 1: 明るいシアン
    "#ec4899", // Group 2: 明るいローズピンク
    "#6366f1", // Group 3: 明るいインディゴ
    "#f97316", // Group 4: 明るいオレンジ
    "#65a30d"  // Group 5: 明るいリーフグリーン
  ];

  function getCoordBorderStroke(coordGroup) {
    if (typeof coordGroup !== "number" || coordGroup <= 0) return null;
    return coordBorderStrokes[(coordGroup - 1) % coordBorderStrokes.length];
  }

  function getRoleVisualStyle(role, grayLevel = 0, inModClause = false) {
    const clamped = clampGrayLevel(grayLevel);
    if (
      inModClause ||
      role === "M" ||
      role === "関係詞" ||
      role === "間接疑問" ||
      role === "前置詞" ||
      isCoordContainerRole(role)
    ) {
      if (role === "強調部分") {
        return roleStyle["強調部分"];
      }
      return mShadeStyles[clamped];
    }
    return roleStyle[role] || roleStyle.Other;
  }

  // 1. 入れ子チャンク(sub_chunks)を再帰的に展開して葉グループ(groups)と階層構造を構築
  // 同じ節および並列グループに属する要素はすべて同じグレーレベルで統一し、内側の入れ子節ほど薄く(0)、外側の節ほど濃く(+1)する
  const groups = [];
  const clauseBrackets = [];

  function registerChunkHierarchy(ch, inModClause = false, isAntecedent = false, currentGrayLevel = 0, isTopLevel = false) {
    const isMod = ch.role === "M" || ch.role === "関係詞" || ch.role === "間接疑問";
    const isCoordContainer = isCoordContainerRole(ch.role);
    const nextInMod = inModClause || isMod;

    if (Array.isArray(ch.sub_chunks) && ch.sub_chunks.length > 0) {
      const isAdnominal = hasAdnominalModifierSubChunk(ch);
      const isRelMod = hasRelativeModifierSubChunk(ch);
      const myGrayLevel = currentGrayLevel;
      const innerForceGray = isCoordContainer ? inModClause : (nextInMod || Boolean(ch.clause_type));
      const childCoordGrayMap = computeCoordGroupGrayMap(ch.sub_chunks, myGrayLevel);

      const childItems = ch.sub_chunks.map((sub) => {
        const subIsMod = sub.role === "M" || sub.role === "関係詞" || sub.role === "間接疑問";
        const subIsHeadNominal = isAdnominal && isAdnominalHeadSubChunk(sub, ch);
        const subIsAnt = isRelMod && subIsHeadNominal;
        const hasGrandChildren = Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0;
        const hasSubCoordLv =
          typeof sub.coord_group === "number" &&
          childCoordGrayMap[sub.coord_group] !== undefined;
        const childGrayLevel = hasSubCoordLv
          ? childCoordGrayMap[sub.coord_group]
          : (hasGrandChildren
            ? (hasAdnominalModifierSubChunk(sub) ? myGrayLevel : getChunkGrayLevel(sub))
            : myGrayLevel);
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

      const shouldDrawBracket =
        isCoordContainer ||
        Boolean(ch.clause_type) ||
        Boolean(ch.displayRoleLabel) ||
        maxChildDepth === 0;
      let myDepth = maxChildDepth;
      if (shouldDrawBracket) {
        myDepth = maxChildDepth + 1;
        const bLabel = ch.displayRoleLabel
          ? ch.displayRoleLabel
          : (isCoordContainer
            ? (ch.clause_type || ch.role)
            : (ch.clause_type ? `${ch.role} (${ch.clause_type})` : `${ch.role} (節)`));
        clauseBrackets.push({
          role: ch.role,
          grayLevel: myGrayLevel,
          inModClause: nextInMod || isCoordContainer,
          coordGroup: ch.coord_group || null,
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
        inModClause: nextInMod || isCoordContainer,
        coordGroup: ch.coord_group || null,
        clauseType: ch.clause_type || null,
        children: childItems,
        leafIndices: allLeafIndices,
        bracketDepth: myDepth
      };
    } else {
      const matched = validTokens.filter((t) => t.id >= ch.start && t.id <= ch.end);
      if (matched.length === 0) return null;
      const gIdx = groups.length;
      const leafGrayLevel = currentGrayLevel;
      const dispRole = isAntecedent
        ? (isTopLevel ? "先行詞" : `${ch.role} (先行詞)`)
        : getChunkDisplayRoleText(ch, true);

      groups.push({
        role: ch.role,
        displayRole: dispRole,
        grayLevel: leafGrayLevel,
        inModClause: nextInMod,
        coordGroup: ch.coord_group || null,
        tokens: matched
      });
      return {
        isContainer: false,
        role: ch.role,
        displayRoleLabel: dispRole,
        grayLevel: leafGrayLevel,
        inModClause: nextInMod,
        coordGroup: ch.coord_group || null,
        groupIdx: gIdx,
        leafIndices: [gIdx],
        bracketDepth: 0
      };
    }
  }

  let hierarchyRoots = [];
  if (Array.isArray(chunks) && chunks.length > 0) {
    const topTreeCoordGrayMap = computeCoordGroupGrayMap(chunks, 2);
    hierarchyRoots = chunks.map((ch) => {
      const hasSubs = Array.isArray(ch.sub_chunks) && ch.sub_chunks.length > 0;
      const topLv =
        typeof ch.coord_group === "number" &&
        topTreeCoordGrayMap[ch.coord_group] !== undefined
          ? topTreeCoordGrayMap[ch.coord_group]
          : (hasSubs ? getChunkGrayLevel(ch) : 2);
      return registerChunkHierarchy(ch, ch.role === "M" || ch.role === "関係詞" || ch.role === "間接疑問", false, topLv, true);
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
    node.coordGroup = grp.coordGroup || null;
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

  // 同じ役割の並列チャンク列（A, B, and C や both A and B：S/O/C/M/強調部分/並列述部/並列節の並列）を先に1つの並列ノードへ束ねるヘルパー
  function collapseCoordinatedArgRuns(nodesList, inModClause = false, grayLevel = 0) {
    const coordTargetRoles = ["S", "O", "C", "C / M", "M", "強調部分", "同格", "並列述部", "並列節"];
    const result = [];
    let i = 0;
    while (i < nodesList.length) {
      let hasLeadPreconj = false;
      let firstRoleIdx = i;
      const leadText = nodesList[i].tokens
        ? nodesList[i].tokens.map((t) => t.text).join(" ")
        : (nodesList[i].label || "");

      if (
        (
          (nodesList[i].chunkRole === "Conj" && CORRELATIVE_LEAD_REGEX.test(String(leadText).trim())) ||
          (nodesList[i].chunkRole === "M" && NOT_ONLY_LEAD_REGEX.test(String(leadText).trim()))
        ) &&
        i + 1 < nodesList.length &&
        coordTargetRoles.includes(nodesList[i + 1].chunkRole)
      ) {
        hasLeadPreconj = true;
        firstRoleIdx = i + 1;
      }

      const role = nodesList[firstRoleIdx].chunkRole;
      if (coordTargetRoles.includes(role)) {
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
          const isCoordVp = role === "並列述部";
          const isCoordClause = role === "並列節";
          const mergedRoleKey = isCoordVp || isCoordClause ? "VP" : role;
          const finalCoordLabel = isCoordVp
            ? "VP (並列述部)"
            : (isCoordClause
              ? "並列節"
              : (allAreClauses ? `${role} (並列節)` : `${role} (並列句)`));

          const mergedItems = [];
          let m = 0;
          while (m < seq.length) {
            const isLeadNotOnlyMod = m === 0 && hasLeadPreconj && seq[0].chunkRole === "M";
            if ((seq[m].chunkRole === "Conj" || isLeadNotOnlyMod) && m + 1 < seq.length) {
              const leadPrefix = isLeadNotOnlyMod ? "M" : "Conj";
              const stepLbl = isCoordVp
                ? `${leadPrefix} + VP`
                : (isCoordClause ? `${leadPrefix} + 節` : `${leadPrefix} + ${role}`);
              const cRight = mergeTwoNodes(seq[m], seq[m + 1], stepLbl, mergedRoleKey, inModClause, grayLevel);
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
            const pairLbl = isCoordVp
              ? "VP + VP"
              : (isCoordClause ? "節 + 節" : `${role} + ${role}`);
            const lbl = isLast ? finalCoordLabel : pairLbl;
            coordNode = mergeTwoNodes(coordNode, mergedItems[k], lbl, mergedRoleKey, inModClause, grayLevel);
          }
          coordNode.chunkRole = isCoordVp ? "V" : role;
          coordNode.displayRoleLabel = isCoordVp || isCoordClause
            ? finalCoordLabel
            : (nodesList[firstRoleIdx].displayRoleLabel || finalCoordLabel);
          coordNode.tokens = allCombinedTokens;
          coordNode.isClauseContainer = allAreClauses || isCoordClause;
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
    if (nodesSlice.length === 1) {
      if (isTopSentence && nodesSlice[0].chunkRole === "並列節") {
        nodesSlice[0].label = "文 (重文)";
        nodesSlice[0].role = "Sentence";
      }
      return nodesSlice[0];
    }

    if (
      (nodesSlice[0].chunkRole === "Conj" ||
        nodesSlice[0].chunkRole === "関係詞" ||
        nodesSlice[0].chunkRole === "間接疑問") &&
      nodesSlice.length > 1
    ) {
      const leadText = nodesSlice[0].tokens
        ? nodesSlice[0].tokens.map((t) => t.text).join(" ")
        : (nodesSlice[0].label || "");
      const isCorrelativeForVerb =
        nodesSlice[0].chunkRole === "Conj" &&
        CORRELATIVE_LEAD_REGEX.test(String(leadText).trim()) &&
        nodesSlice[1].chunkRole === "V";

      if (!isCorrelativeForVerb) {
        const restTree = buildClauseTreeFromNodes(nodesSlice.slice(1), false, inModClause, grayLevel);
        const leadLabel =
          nodesSlice[0].chunkRole === "間接疑問"
            ? "間接疑問 + 節"
            : (nodesSlice[0].chunkRole === "関係詞" ? "関係詞 + 節" : "Conj + 節");
        const topLbl = isTopSentence ? "文 (Sentence)" : leadLabel;
        return mergeTwoNodes(nodesSlice[0], restTree, topLbl, isTopSentence ? "Sentence" : "VP", inModClause, grayLevel);
      }
    }

    // 1. 重文（S1 V1 ..., S2 V2 ..., and S3 V3 ...）および並列動詞句の分割点となるVインデックスを収集
    //    （助動詞＋副詞＋本動詞、句動詞粒子、および部分倒置 Aux + S + V の分割Vは除外）
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
      const hasSubjBeforePrevV = nodesSlice.slice(0, prevV).some(
        (ch) => ch.chunkRole === "S" && ch.displayRoleLabel !== "S (真主語)"
      );
      const hasConjBetween = betweenSlice.some((ch) => ch.chunkRole === "Conj");
      const hasCommaBetween = hasCommaBetweenTreeNodes(nodesSlice[prevV], n);
      const isAuxSubjVerbInversion =
        hasSubjBetween && !hasSubjBeforePrevV && !hasConjBetween && !hasCommaBetween;
      if (!isAuxSubjVerbInversion && (hasSubjBetween || hasConjBetween || hasCommaBetween)) {
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
        if (
          vpSpanStart > 0 &&
          (nodesSlice[vpSpanStart - 1].chunkRole === "Conj" || nodesSlice[vpSpanStart - 1].chunkRole === "M")
        ) {
          const prevTxt = nodesSlice[vpSpanStart - 1].tokens
            ? nodesSlice[vpSpanStart - 1].tokens.map((t) => t.text).join(" ")
            : "";
          if (
            (nodesSlice[vpSpanStart - 1].chunkRole === "Conj" && CORRELATIVE_LEAD_REGEX.test(String(prevTxt).trim())) ||
            (nodesSlice[vpSpanStart - 1].chunkRole === "M" && NOT_ONLY_LEAD_REGEX.test(String(prevTxt).trim()))
          ) {
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
            const leadLbl = nodesSlice[conjIdx].chunkRole === "M" ? "M + VP" : "Conj + VP";
            vpSegments.push(mergeTwoNodes(nodesSlice[conjIdx], vpTree, leadLbl, "VP", inModClause, grayLevel));
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

    const isVerbalRole = (r) => r === "V" || r === "動名詞" || r === "分詞";
    const vIdx = nodesSlice.findIndex((n) => isVerbalRole(n.chunkRole));
    if (vIdx === -1) {
      const allParallelClauses = nodesSlice.every((n) => n.chunkRole === "並列節");
      let cur = nodesSlice[0];
      for (let i = 1; i < nodesSlice.length; i++) {
        const isTop = isTopSentence && i === nodesSlice.length - 1;
        let lbl;
        let mRole;
        if (allParallelClauses) {
          lbl = isTop ? "文 (重文)" : "節 + 節";
          mRole = isTop ? "Sentence" : "VP";
        } else {
          lbl = (cur.chunkRole === "S" && nodesSlice[i].chunkRole === "C") ? "S + C" : (isTop ? "文 (Sentence)" : "句");
          mRole = isTop ? "Sentence" : "Phrase";
        }
        cur = mergeTwoNodes(cur, nodesSlice[i], lbl, mRole, inModClause, grayLevel);
      }
      return cur;
    }

    const secondVIdx = nodesSlice.findIndex((n, idx) => idx > vIdx && isVerbalRole(n.chunkRole));
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
      if (isVerbalRole(nodesSlice[i].chunkRole)) lastVIdx = i;
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
        } else if (nextRole === "O" || nextRole === "C" || nextRole === "C / M") {
          mergeLabel = "VP (動詞句)";
        } else if (nextNode.displayRoleLabel === "S (真主語)") {
          mergeLabel = "述部 + S (真主語)";
        } else if (nextRole === "S") {
          mergeLabel = "V + S (倒置)";
        } else if (nextRole === "同格") {
          mergeLabel = "＝ 同格・敷衍";
        }
        if (nextRole === "O") hasSeenObjAfterV = true;
        if (nextRole === "C" || nextRole === "C / M") hasSeenCompAfterV = true;

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
    if (
      !item.clauseType &&
      !isCoordContainerRole(item.role) &&
      !childNodes.some((n) => ["V", "動名詞", "分詞", "並列述部", "並列節"].includes(n.chunkRole))
    ) {
      combined = childNodes[0];
      for (let i = 1; i < childNodes.length; i++) {
        combined = mergeTwoNodes(combined, childNodes[i], item.role, item.role, false, item.grayLevel);
      }
    } else {
      combined = buildClauseTreeFromNodes(childNodes, false, item.inModClause, item.grayLevel);
    }
    const nodeLabel = item.displayRoleLabel
      ? item.displayRoleLabel
      : (isCoordContainerRole(item.role)
        ? (item.clauseType || item.role)
        : (item.clauseType ? `${item.role} (${item.clauseType})` : item.role));
    const allChildTokens = [];
    childNodes.forEach((cn) => {
      if (Array.isArray(cn.tokens)) allChildTokens.push(...cn.tokens);
    });
    combined.label = nodeLabel;
    combined.role = item.role;
    combined.chunkRole = item.role;
    combined.displayRoleLabel = item.displayRoleLabel || nodeLabel;
    combined.tokens = allChildTokens;
    combined.isClauseContainer = Boolean(item.clauseType) || isCoordContainerRole(item.role);
    combined.inModClause = item.inModClause;
    combined.grayLevel = item.grayLevel;
    combined.coordGroup = item.coordGroup || null;
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

  // (B) 逆V字の結合点ラベル（楕円形：背景は階層グレー/SVOC維持、並列グループは枠線色のみ統一）を描画
  mergeNodes.forEach((node) => {
    const nx = node.x;
    const ny = getNodeY(node);
    const isSentence = node.role === "Sentence";
    let st;
    if (isSentence) {
      st = { fill: "#0f172a", stroke: "#0f172a", text: "#ffffff" };
    } else if (
      node.inModClause ||
      node.role === "M" ||
      node.role === "関係詞" ||
      node.role === "間接疑問" ||
      node.role === "前置詞" ||
      isCoordContainerRole(node.role)
    ) {
      st = getRoleVisualStyle(node.role, node.grayLevel || 0, true);
    } else {
      st = roleStyle[node.role] || { fill: "#ffffff", stroke: "#64748b", text: "#334155" };
    }
    const coordStroke = isSentence ? null : getCoordBorderStroke(node.coordGroup);
    const strokeColor = coordStroke || st.stroke;
    const strokeWidth = coordStroke ? "2.2" : "1.5";

    const labelText = node.label;
    const textWidth = calcSvgTextWidth(labelText, 11);
    const pillW = Math.max(textWidth + 28, 46);
    const pillH = 24;

    svgContent += `<rect x="${nx - pillW / 2}" y="${ny - pillH / 2}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" ry="${pillH / 2}" fill="${st.fill}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
    svgContent += `<text x="${nx}" y="${ny + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${st.text}">${escapeHtml(labelText)}</text>`;
  });

  // (C) チャンクの囲み枠と下部ラベルを描画（背景は階層グレー/SVOC維持、並列グループは枠線色のみ統一）
  groups.forEach((grp) => {
    const st = getRoleVisualStyle(grp.role, grp.grayLevel || 0, grp.inModClause);
    const coordStroke = getCoordBorderStroke(grp.coordGroup);
    const strokeColor = coordStroke || st.stroke;
    const strokeWidth = coordStroke ? "2.5" : "2";
    const x = grp.leftX - 6;
    const w = (grp.rightX - grp.leftX) + 12;
    const h = boxBottomY - boxTopY;

    svgContent += `<rect x="${x}" y="${boxTopY}" width="${w}" height="${h}" rx="8" fill="${st.fill}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;

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

  // (C2) 従属節・関係詞節・分詞構文・分詞句・並列コンテナをまとめる下部アンダーブラケットを描画
  clauseBrackets.forEach((br) => {
    if (br.subGroupIndices.length === 0) return;
    const firstGrp = groups[br.subGroupIndices[0]];
    const lastGrp = groups[br.subGroupIndices[br.subGroupIndices.length - 1]];
    const st = getRoleVisualStyle(br.role, br.grayLevel || 0, br.inModClause);
    const coordStroke = getCoordBorderStroke(br.coordGroup);
    const strokeColor = coordStroke || st.stroke;
    const strokeWidth = coordStroke ? "3" : "2.5";

    const depth = br.depth || 1;
    const x1 = firstGrp.leftX - 6;
    const x2 = lastGrp.rightX + 6;
    const midX = (x1 + x2) / 2;
    const bracketY = boxBottomY + 30 * depth;
    const legTopY = bracketY - 12;

    svgContent += `<path d="M ${x1} ${legTopY} L ${x1} ${bracketY} L ${x2} ${bracketY} L ${x2} ${legTopY}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
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

  const svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">${svgContent}</svg>`;
  return { svg, width: svgWidth, height: svgHeight };
}