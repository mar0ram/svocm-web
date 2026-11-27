import {
    clampGrayLevel,
    computeCoordGroupGrayMap,
    escapeHtml,
    getChunkDisplayRoleText,
    getChunkGrayLevel,
    getCoordBorderClass,
    getSafeRoleClassName,
    hasAdnominalModifierSubChunk,
    hasRelativeModifierSubChunk,
    isAdnominalHeadSubChunk,
    isCoordContainerRole,
    shouldUseEqualSep
} from "./chunk_logic.js";

// 1つのインライン要素（先行詞や節内のチャンクチップ）を生成するヘルパー
function createInlineChunkChip(text, roleLabel, colorClass, coordGroup = null) {
    const chip = document.createElement("div");
    const borderCls = getCoordBorderClass(coordGroup);
    chip.className = `inline-chunk-item ${colorClass}${borderCls ? " " + borderCls : ""}`;
    chip.innerHTML = `
    <span class="inline-chunk-text">${escapeHtml(text)}</span>
    <span class="chunk-role">${escapeHtml(roleLabel)}</span>
  `;
    return chip;
}

// 修飾節・従属節の内部要素を、同じ節内の要素および並列要素同士が同じグレー（外側が濃いグレー、内側が薄いグレー）になるよう展開するヘルパー
export function appendFlattenedModifierItems(container, subChunkList, forceGrayScale, currentGrayLevel = 0) {
    const coordGrayMap = computeCoordGroupGrayMap(subChunkList, currentGrayLevel);

    subChunkList.forEach((item, idx) => {
        if (idx > 0) {
            const useEqual = shouldUseEqualSep(subChunkList[idx - 1], item);
            const sep = document.createElement("span");
            sep.className = useEqual ? "sub-chunk-sep sep-equal" : "sub-chunk-sep";
            sep.textContent = useEqual ? "＝" : "/";
            container.appendChild(sep);
        }

        const safeRole = getSafeRoleClassName(item.role);
        const hasSubs = Array.isArray(item.sub_chunks) && item.sub_chunks.length > 0;
        const hasCoordLv =
            typeof item.coord_group === "number" &&
            coordGrayMap[item.coord_group] !== undefined;
        const itemGrayLevel = hasCoordLv
            ? coordGrayMap[item.coord_group]
            : (hasSubs ? getChunkGrayLevel(item) : clampGrayLevel(currentGrayLevel));
        const itemShadeClass = `m-shade-${clampGrayLevel(itemGrayLevel)}`;
        const itemBorderCls = getCoordBorderClass(item.coord_group);
        const itemBorderSuffix = itemBorderCls ? ` ${itemBorderCls}` : "";

        if (hasSubs) {
            if (isCoordContainerRole(item.role)) {
                // 並列述部・並列節コンテナ：同じグループの大きいボックス同士を同じグレー背景・同じ枠線色に揃える
                const groupLv = clampGrayLevel(itemGrayLevel);
                const groupWrap = document.createElement("div");
                groupWrap.className = `coord-block-group m-shade-${groupLv}${itemBorderSuffix}`;
                appendFlattenedModifierItems(groupWrap, item.sub_chunks, forceGrayScale, groupLv);
                container.appendChild(groupWrap);
            } else if (hasAdnominalModifierSubChunk(item)) {
                // 節内の要素が「先行詞 + 関係詞節/前置詞句」等を持つ場合
                const isRelMod = hasRelativeModifierSubChunk(item);
                const headLv = clampGrayLevel(hasCoordLv ? itemGrayLevel : currentGrayLevel);
                const headShadeClass = `m-shade-${headLv}`;
                const innerCoordMap = computeCoordGroupGrayMap(item.sub_chunks, headLv);
                const wrapInCoordBox = Boolean(itemBorderCls);
                const targetContainer = wrapInCoordBox ? document.createElement("div") : container;
                if (wrapInCoordBox) {
                    targetContainer.className = `coord-block-group ${forceGrayScale ? headShadeClass : `role-${safeRole}`}${itemBorderSuffix}`;
                }
                let hasAppendedSub = false;
                item.sub_chunks.forEach((sub) => {
                    if (hasAppendedSub) {
                        const subSep = document.createElement("span");
                        subSep.className = "sub-chunk-sep";
                        subSep.textContent = "/";
                        targetContainer.appendChild(subSep);
                    }
                    if (isAdnominalHeadSubChunk(sub, item)) {
                        const antColor = forceGrayScale ? headShadeClass : `role-${safeRole}`;
                        const antLabel = isRelMod
                            ? `${item.role} (先行詞)`
                            : (sub.displayRoleLabel || item.displayRoleLabel || sub.role);
                        targetContainer.appendChild(createInlineChunkChip(sub.text, antLabel, antColor, sub.coord_group));
                        hasAppendedSub = true;
                    } else if (Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0) {
                        const subLv =
                            typeof sub.coord_group === "number" &&
                                innerCoordMap[sub.coord_group] !== undefined
                                ? innerCoordMap[sub.coord_group]
                                : getChunkGrayLevel(sub);
                        const subBorderCls = getCoordBorderClass(sub.coord_group);
                        const groupWrap = document.createElement("div");
                        groupWrap.className = `mod-clause-group m-shade-${clampGrayLevel(subLv)}${subBorderCls ? " " + subBorderCls : ""}`;
                        appendFlattenedModifierItems(groupWrap, sub.sub_chunks, true, subLv);
                        targetContainer.appendChild(groupWrap);
                        hasAppendedSub = true;
                    } else {
                        const subLv =
                            typeof sub.coord_group === "number" &&
                                innerCoordMap[sub.coord_group] !== undefined
                                ? innerCoordMap[sub.coord_group]
                                : headLv;
                        targetContainer.appendChild(
                            createInlineChunkChip(sub.text, getChunkDisplayRoleText(sub, true), `m-shade-${clampGrayLevel(subLv)}`, sub.coord_group)
                        );
                        hasAppendedSub = true;
                    }
                });
                if (wrapInCoordBox) {
                    container.appendChild(targetContainer);
                }
            } else {
                // 内側の入れ子節（【that S2 V2】や前置詞句など）は、同じ並列グループなら同じグレー背景・同じ枠線色で統一
                const subLv = clampGrayLevel(itemGrayLevel);
                const isApposGroup = item.role === "同格";
                const allApposItems =
                    isApposGroup &&
                    item.sub_chunks.every((sc) => sc.role === "同格" || sc.role === "Conj");
                const groupWrap = document.createElement("div");
                groupWrap.className = isApposGroup
                    ? `mod-clause-group role-同格${itemBorderSuffix}`
                    : `mod-clause-group m-shade-${subLv}${itemBorderSuffix}`;
                appendFlattenedModifierItems(groupWrap, item.sub_chunks, !allApposItems, subLv);
                if (item.displayRoleLabel && /真主語|真目的語/.test(item.displayRoleLabel)) {
                    const groupRoleBadge = document.createElement("span");
                    groupRoleBadge.className = "chunk-role";
                    groupRoleBadge.textContent = item.displayRoleLabel;
                    groupWrap.appendChild(groupRoleBadge);
                }
                container.appendChild(groupWrap);
            }
        } else {
            const roleLabel = getChunkDisplayRoleText(item, true);
            const isModRole =
                safeRole === "M" ||
                safeRole === "関係詞" ||
                safeRole === "間接疑問" ||
                safeRole === "前置詞";
            const colorClass = forceGrayScale || isModRole ? itemShadeClass : `role-${safeRole}`;
            container.appendChild(createInlineChunkChip(item.text, roleLabel, colorClass, item.coord_group));
        }
    });
}

// チャンク要素（展開ボタン付き・本文の核となるSVOC以外は階層ごとのグレー統一・並列要素同士は同色枠線）を生成する関数
export function createChunkElement(chunk, coordGrayMap = null) {
    const div = document.createElement("div");
    const safeRole = getSafeRoleClassName(chunk.role);
    const isMod = safeRole === "M" || safeRole === "関係詞" || safeRole === "間接疑問";
    const isCoordContainer = isCoordContainerRole(chunk.role);
    const hasSubs = Array.isArray(chunk.sub_chunks) && chunk.sub_chunks.length > 0;
    const rawGrayLevel = getChunkGrayLevel(chunk);
    const mappedGrayLevel =
        coordGrayMap &&
            typeof chunk.coord_group === "number" &&
            coordGrayMap[chunk.coord_group] !== undefined
            ? coordGrayMap[chunk.coord_group]
            : (hasSubs ? rawGrayLevel : 2);
    const chunkGrayLevel = hasSubs ? mappedGrayLevel : rawGrayLevel;
    const outerGrayLevel = mappedGrayLevel;
    const shadeClass = isMod || isCoordContainer ? ` m-shade-${clampGrayLevel(outerGrayLevel)}` : "";
    const borderCls = getCoordBorderClass(chunk.coord_group);
    const borderSuffix = borderCls ? ` ${borderCls}` : "";

    if (hasSubs) {
        div.className = `chunk-box chunk-nested role-${safeRole}${shadeClass}${borderSuffix}`;
        const isAdnominal = hasAdnominalModifierSubChunk(chunk);
        const headerRoleLabel = getChunkDisplayRoleText(
            chunk,
            !isAdnominal || chunk.role === "同格"
        );

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
            // 先行詞 + 関係詞節/接触節 または 被修飾語 + 分詞句/前置詞句 等 の構造
            const isRelMod = hasRelativeModifierSubChunk(chunk);
            const innerCoordMap = computeCoordGroupGrayMap(chunk.sub_chunks, chunkGrayLevel);
            let hasAppendedAny = false;

            chunk.sub_chunks.forEach((sub, subIdx) => {
                if (hasAppendedAny) {
                    const useEqual =
                        subIdx > 0 && shouldUseEqualSep(chunk.sub_chunks[subIdx - 1], sub);
                    const sep = document.createElement("span");
                    sep.className = useEqual ? "sub-chunk-sep sep-equal" : "sub-chunk-sep";
                    sep.textContent = useEqual ? "＝" : "/";
                    subContainer.appendChild(sep);
                }

                if (isAdnominalHeadSubChunk(sub, chunk)) {
                    // 被修飾語：Mチャンクなら外側のグレー(chunkGrayLevel)、S/O/Cなら元の骨格カラー
                    const antColorClass = isMod ? `m-shade-${clampGrayLevel(chunkGrayLevel)}` : `role-${safeRole}`;
                    const antLabel = isRelMod
                        ? "先行詞"
                        : (sub.displayRoleLabel || chunk.displayRoleLabel || sub.role);
                    subContainer.appendChild(createInlineChunkChip(sub.text, antLabel, antColorClass, sub.coord_group));
                    hasAppendedAny = true;
                } else if (Array.isArray(sub.sub_chunks) && sub.sub_chunks.length > 0) {
                    // 関係詞節・接触節・分詞修飾・前置詞句のまとまり枠（内部要素もすべて subLv で統一）
                    const subLv =
                        typeof sub.coord_group === "number" &&
                            innerCoordMap[sub.coord_group] !== undefined
                            ? innerCoordMap[sub.coord_group]
                            : getChunkGrayLevel(sub);
                    const subBorderCls = getCoordBorderClass(sub.coord_group);
                    const groupWrap = document.createElement("div");
                    groupWrap.className = `mod-clause-group m-shade-${clampGrayLevel(subLv)}${subBorderCls ? " " + subBorderCls : ""}`;
                    appendFlattenedModifierItems(groupWrap, sub.sub_chunks, true, subLv);
                    subContainer.appendChild(groupWrap);
                    hasAppendedAny = true;
                } else {
                    const subLv =
                        typeof sub.coord_group === "number" &&
                            innerCoordMap[sub.coord_group] !== undefined
                            ? innerCoordMap[sub.coord_group]
                            : chunkGrayLevel;
                    subContainer.appendChild(
                        createInlineChunkChip(sub.text, getChunkDisplayRoleText(sub, true), `m-shade-${clampGrayLevel(subLv)}`, sub.coord_group)
                    );
                    hasAppendedAny = true;
                }
            });
        } else {
            // 名詞節・副詞節・分詞構文・付帯状況などの内部展開（主節直下の並列述部・並列節コンテナ内部は核となるSVOCカラーを維持）
            const useGrayForInner = !isCoordContainer && (isMod || Boolean(chunk.clause_type));
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
        div.className = `chunk-box role-${safeRole}${shadeClass}${borderSuffix}`;
        const typeLabel = getChunkDisplayRoleText(chunk, true);
        div.innerHTML = `
      <span class="chunk-text">${escapeHtml(chunk.text)}</span>
      <span class="chunk-role">${escapeHtml(typeLabel)}</span>
    `;
    }
    return div;
}

// チャンク一覧の描画
export function renderChunks(chunksContainer, displayChunks) {
    if (!chunksContainer) return;
    const topCoordGrayMap = computeCoordGroupGrayMap(displayChunks, 2);
    chunksContainer.innerHTML = "";
    displayChunks.forEach((chunk, idx) => {
        if (idx > 0 && shouldUseEqualSep(displayChunks[idx - 1], chunk)) {
            const eqSep = document.createElement("span");
            eqSep.className = "chunk-equal-sep";
            eqSep.textContent = "＝";
            chunksContainer.appendChild(eqSep);
        }
        chunksContainer.appendChild(createChunkElement(chunk, topCoordGrayMap));
    });
}

// 文法網羅チェッカー（13項目）の描画
export function renderGrammarCheckTable(grammarBody, grammarCheckList) {
    if (!grammarBody) return;
    grammarBody.innerHTML = "";
    const checkList = Array.isArray(grammarCheckList) ? grammarCheckList : [];
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
export function renderTokensTable(tbody, tokens) {
    if (!tbody) return;
    tbody.innerHTML = "";
    tokens.forEach((t) => {
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
}