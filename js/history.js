const HISTORY_STORAGE_KEY = "svocm_search_history_v1";
const MAX_HISTORY_ITEMS = 30;

// 保存日時を読みやすい形式 (YYYY/MM/DD HH:MM) に整形
function formatSavedAt(timestamp) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

// localStorage から検索履歴を読み込む
export function loadSearchHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.text === "string" && item.text.trim().length > 0)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch (_) {
    return [];
  }
}

// localStorage へ検索履歴を保存する
function saveSearchHistory(items) {
  try {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS))
    );
  } catch (_) {
    // ストレージ制限時などはアプリ本体を止めない
  }
}

// 英文を履歴の先頭に追加する（同一英文は重複させず先頭へ移動・最大30件）
export function addSearchHistory(text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return loadSearchHistory();

  const current = loadSearchHistory().filter((item) => item.text !== cleanText);
  const newItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: cleanText,
    savedAt: Date.now()
  };
  const updated = [newItem, ...current].slice(0, MAX_HISTORY_ITEMS);
  saveSearchHistory(updated);
  return updated;
}

// 指定IDの履歴を1件削除する
function removeSearchHistoryById(id) {
  const updated = loadSearchHistory().filter((item) => item.id !== id);
  saveSearchHistory(updated);
  return updated;
}

// 履歴をすべて削除する
function clearAllSearchHistory() {
  saveSearchHistory([]);
  return [];
}

// 履歴ポップアップおよび削除確認ダイアログの初期化
export function initHistoryModal({ openBtn, onSelect }) {
  const historyModal = document.getElementById("history-modal");
  const historyCount = document.getElementById("history-count");
  const historyList = document.getElementById("history-list");
  const clearAllBtn = document.getElementById("history-clear-all-btn");
  const closeBtn = document.getElementById("history-close-btn");

  const confirmModal = document.getElementById("history-confirm-modal");
  const confirmTitle = document.getElementById("history-confirm-title");
  const confirmMessage = document.getElementById("history-confirm-message");
  const confirmPreview = document.getElementById("history-confirm-preview");
  const confirmCancelBtn = document.getElementById("history-confirm-cancel-btn");
  const confirmOkBtn = document.getElementById("history-confirm-ok-btn");

  if (!historyModal || !historyList) {
    return {
      open: () => { },
      close: () => { },
      refresh: () => {  }
    };
  }

  let pendingConfirmAction = null;

  function syncBodyScrollLock() {
    const isHistoryOpen = !historyModal.classList.contains("hidden");
    const isConfirmOpen = Boolean(confirmModal && !confirmModal.classList.contains("hidden"));
    document.body.classList.toggle("modal-open", isHistoryOpen || isConfirmOpen);
  }

  function closeConfirmDialog() {
    pendingConfirmAction = null;
    if (confirmModal) {
      confirmModal.classList.add("hidden");
    }
    syncBodyScrollLock();
  }

  function openConfirmDialog({ title, message, previewText = "", okLabel = "削除する", onConfirm }) {
    if (!confirmModal) {
      if (typeof onConfirm === "function") onConfirm();
      return;
    }
    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    if (confirmPreview) {
      if (previewText) {
        confirmPreview.textContent = previewText;
        confirmPreview.classList.remove("hidden");
      } else {
        confirmPreview.textContent = "";
        confirmPreview.classList.add("hidden");
      }
    }
    if (confirmOkBtn) confirmOkBtn.textContent = okLabel;
    pendingConfirmAction = onConfirm;
    confirmModal.classList.remove("hidden");
    syncBodyScrollLock();
  }

  function renderHistoryList() {
    const items = loadSearchHistory();
    if (historyCount) {
      historyCount.textContent = `${items.length} / ${MAX_HISTORY_ITEMS}件`;
    }
    if (clearAllBtn) {
      clearAllBtn.disabled = items.length === 0;
    }

    historyList.innerHTML = "";
    if (items.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "history-empty";
      emptyEl.textContent = "保存されている検索履歴はありません。";
      historyList.appendChild(emptyEl);
      return;
    }

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "history-item";

      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "history-item-select";

      const textSpan = document.createElement("span");
      textSpan.className = "history-item-text";
      textSpan.textContent = item.text;
      selectBtn.appendChild(textSpan);

      const dateStr = formatSavedAt(item.savedAt);
      if (dateStr) {
        const metaSpan = document.createElement("span");
        metaSpan.className = "history-item-date";
        metaSpan.textContent = dateStr;
        selectBtn.appendChild(metaSpan);
      }

      selectBtn.addEventListener("click", () => {
        closeHistoryModal();
        if (typeof onSelect === "function") {
          onSelect(item.text);
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "history-item-delete";
      deleteBtn.title = "この履歴を削除";
      deleteBtn.setAttribute("aria-label", "この履歴を削除");
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => {
        openConfirmDialog({
          title: "履歴を削除",
          message: "この検索履歴を削除してもよろしいですか？",
          previewText: item.text,
          okLabel: "削除する",
          onConfirm: () => {
            removeSearchHistoryById(item.id);
            renderHistoryList();
          }
        });
      });

      li.appendChild(selectBtn);
      li.appendChild(deleteBtn);
      historyList.appendChild(li);
    });
  }

  function openHistoryModal() {
    renderHistoryList();
    historyModal.classList.remove("hidden");
    syncBodyScrollLock();
  }

  function closeHistoryModal() {
    closeConfirmDialog();
    historyModal.classList.add("hidden");
    syncBodyScrollLock();
  }

  if (openBtn) {
    openBtn.addEventListener("click", openHistoryModal);
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", closeHistoryModal);
  }
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      const count = loadSearchHistory().length;
      if (count === 0) return;
      openConfirmDialog({
        title: "すべての履歴を削除",
        message: `保存されている検索履歴（${count}件）をすべて削除してもよろしいですか？`,
        okLabel: "すべて削除",
        onConfirm: () => {
          clearAllSearchHistory();
          renderHistoryList();
        }
      });
    });
  }

  // オーバーレイ背景クリックで閉じる
  historyModal.addEventListener("click", (e) => {
    if (e.target === historyModal) {
      closeHistoryModal();
    }
  });

  if (confirmModal) {
    confirmModal.addEventListener("click", (e) => {
      if (e.target === confirmModal) {
        closeConfirmDialog();
      }
    });
  }
  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener("click", closeConfirmDialog);
  }
  if (confirmOkBtn) {
    confirmOkBtn.addEventListener("click", () => {
      const action = pendingConfirmAction;
      closeConfirmDialog();
      if (typeof action === "function") {
        action();
      }
    });
  }

  // Escキーで最前面のポップアップを閉じる
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (confirmModal && !confirmModal.classList.contains("hidden")) {
      closeConfirmDialog();
    } else if (!historyModal.classList.contains("hidden")) {
      closeHistoryModal();
    }
  });

  return {
    open: openHistoryModal,
    close: closeHistoryModal,
    refresh: renderHistoryList
  };
}