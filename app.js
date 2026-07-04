"use strict";

/* ============================================================
   Datenmodell & Persistenz
   ============================================================ */

const STORAGE_KEY_SONGS = "shr_songs";
const STORAGE_KEY_SETLISTS = "shr_setlists";
const STORAGE_KEY_WISHLIST = "shr_wishlist";
const STORAGE_KEY_THEME = "shr_theme";
const STORAGE_KEY_VISIBLE_COLUMNS = "shr_visible_columns";

const GENRES = ["Polka", "Walzer", "Marsch", "Boarischer", "Landler", "Choral", "Zwiefacher", "Modern", "Sonstiges"];
const STATUSES = ["Neu", "Einstudieren", "Festigen", "Auftrittsreif", "Auffrischen", "Zurückgestellt", "Verworfen"];
const DEFAULT_STATUS = "Neu";

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
}

function loadSongs() {
  let songs;
  try {
    songs = JSON.parse(localStorage.getItem(STORAGE_KEY_SONGS)) || [];
  } catch {
    songs = [];
  }
  songs.forEach((s) => {
    if (!s.status) s.status = DEFAULT_STATUS;
  });
  return songs;
}

function saveSongs(songs) {
  localStorage.setItem(STORAGE_KEY_SONGS, JSON.stringify(songs));
}

function loadSetlists() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_SETLISTS)) || [];
  } catch {
    return [];
  }
}

function saveSetlists(setlists) {
  localStorage.setItem(STORAGE_KEY_SETLISTS, JSON.stringify(setlists));
}

function loadWishlist() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_WISHLIST)) || [];
  } catch {
    return [];
  }
}

function saveWishlist(wishlist) {
  localStorage.setItem(STORAGE_KEY_WISHLIST, JSON.stringify(wishlist));
}

function loadVisibleColumns() {
  try {
    return { genre: true, difficulty: true, status: true, ...JSON.parse(localStorage.getItem(STORAGE_KEY_VISIBLE_COLUMNS)) };
  } catch {
    return { genre: true, difficulty: true, status: true };
  }
}

function saveVisibleColumns(cols) {
  localStorage.setItem(STORAGE_KEY_VISIBLE_COLUMNS, JSON.stringify(cols));
}

let songs = loadSongs();
let setlists = loadSetlists();
let wishlist = loadWishlist();

let editingSongId = null;
let editingWishId = null;
let activeSetlistId = setlists.length ? setlists[0].id : null;

let sortState = { column: "title", dir: 1 };
let filterState = { search: "", genre: "", status: "", difficulty: "" };
let wishSearch = "";
let visibleColumns = loadVisibleColumns();
let selectedSongIds = new Set();

function getSong(id) {
  return songs.find((s) => s.id === id);
}

function getSetlist(id) {
  return setlists.find((s) => s.id === id);
}

function getWish(id) {
  return wishlist.find((w) => w.id === id);
}

/* ============================================================
   DOM-Referenzen
   ============================================================ */

const el = (id) => document.getElementById(id);

const tabButtons = document.querySelectorAll(".tab-btn");
const views = document.querySelectorAll(".view");

const searchInput = el("search-songs");
const filterGenre = el("filter-genre");
const filterStatus = el("filter-status");
const filterSchwierigkeit = el("filter-schwierigkeit");
const songTableBody = el("song-table-body");
const songEmptyHint = el("song-empty-hint");
const songTable = el("song-table");
const selectAllSongs = el("select-all-songs");

const btnColumnPicker = el("btn-column-picker");
const columnPickerPopover = el("column-picker-popover");

const bulkActions = el("bulk-actions");
const bulkCount = el("bulk-count");
const bulkSetlistSelect = el("bulk-setlist-select");
const bulkAddBtn = el("bulk-add-btn");
const bulkClearBtn = el("bulk-clear-btn");

const btnExportSongsCsv = el("btn-export-songs-csv");

const songModal = el("song-modal");
const songForm = el("song-form");
const songModalTitle = el("song-modal-title");
const btnNewSong = el("btn-new-song");
const btnCancelSong = el("btn-cancel-song");

const fTitle = el("f-title");
const fGenre = el("f-genre");
const fStatus = el("f-status");
const fDifficulty = el("f-difficulty");
const fNotes = el("f-notes");

const btnNewSetlist = el("btn-new-setlist");
const setlistListEl = el("setlist-list");
const setlistEmptyHint = el("setlist-empty-hint");
const setlistDetail = el("setlist-detail");
const setlistNameInput = el("setlist-name-input");
const setlistSummary = el("setlist-summary");
const addSongSelect = el("add-song-select");
const setlistSongsEl = el("setlist-songs");
const setlistSongsEmpty = el("setlist-songs-empty");
const btnPrintSetlist = el("btn-print-setlist");
const btnDeleteSetlist = el("btn-delete-setlist");
const btnDuplicateSetlist = el("btn-duplicate-setlist");
const btnExportSetlistCsv = el("btn-export-setlist-csv");

const searchWishlist = el("search-wishlist");
const wishlistTableBody = el("wishlist-table-body");
const wishlistEmptyHint = el("wishlist-empty-hint");
const btnNewWishlist = el("btn-new-wishlist");
const btnExportWishlistCsv = el("btn-export-wishlist-csv");
const wishlistModal = el("wishlist-modal");
const wishlistForm = el("wishlist-form");
const wishlistModalTitle = el("wishlist-modal-title");
const btnCancelWishlist = el("btn-cancel-wishlist");
const wTitle = el("w-title");
const wGenre = el("w-genre");
const wDifficulty = el("w-difficulty");
const wNotes = el("w-notes");

const btnThemeToggle = el("btn-theme-toggle");
const btnExport = el("btn-export");
const btnImport = el("btn-import");
const fileImport = el("file-import");
const printArea = el("print-area");

/* ============================================================
   Icons (Lucide-Stil, inline SVG)
   ============================================================ */

const ICON_PATHS = {
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  gripVertical: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  chevronUp: '<polyline points="18 15 12 9 6 15"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STARS = { 1: "★☆☆☆☆", 2: "★★☆☆☆", 3: "★★★☆☆", 4: "★★★★☆", 5: "★★★★★" };

/* ============================================================
   Theme (Hell/Dunkel)
   ============================================================ */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  btnThemeToggle.innerHTML = icon(theme === "dark" ? "sun" : "moon");
}

let currentTheme = document.documentElement.getAttribute("data-theme") || "light";
applyTheme(currentTheme);

btnThemeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY_THEME, currentTheme);
  applyTheme(currentTheme);
});

/* ============================================================
   Tabs
   ============================================================ */

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.view;
    views.forEach((v) => v.classList.toggle("active", v.id === "view-" + target));
  });
});

function switchToTab(view) {
  const btn = [...tabButtons].find((b) => b.dataset.view === view);
  if (btn) btn.click();
}

/* ============================================================
   Gemeinsame Select-Optionen (Genre/Status)
   ============================================================ */

function fillSelectOptions(selectEl, values, { placeholder, currentValue } = {}) {
  let html = "";
  if (placeholder !== undefined) html += `<option value="">${placeholder}</option>`;
  const allValues = currentValue && !values.includes(currentValue) ? [currentValue, ...values] : values;
  html += allValues.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  selectEl.innerHTML = html;
  if (currentValue) selectEl.value = currentValue;
}

/* ============================================================
   Repertoire: Rendering
   ============================================================ */

function populateFilterOptions() {
  fillSelectOptions(filterGenre, GENRES, { placeholder: "Alle Genres", currentValue: filterState.genre });
  fillSelectOptions(filterStatus, STATUSES, { placeholder: "Alle Status", currentValue: filterState.status });
}

function getFilteredSortedSongs() {
  const q = filterState.search.trim().toLowerCase();
  let result = songs.filter((s) => {
    if (filterState.genre && s.genre !== filterState.genre) return false;
    if (filterState.status && s.status !== filterState.status) return false;
    if (filterState.difficulty && String(s.difficulty || "") !== filterState.difficulty) return false;
    if (q) {
      const hay = `${s.title} ${s.genre} ${s.status}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const { column, dir } = sortState;
  result.sort((a, b) => {
    let va = a[column];
    let vb = b[column];
    if (column === "difficulty") {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return (va - vb) * dir;
    }
    va = (va || "").toString().toLowerCase();
    vb = (vb || "").toString().toLowerCase();
    return va.localeCompare(vb, "de") * dir;
  });

  return result;
}

function applyColumnVisibility() {
  ["genre", "difficulty", "status"].forEach((col) => {
    songTable.classList.toggle(`hide-${col}`, !visibleColumns[col]);
  });
  columnPickerPopover.querySelectorAll(".col-toggle").forEach((cb) => {
    cb.checked = !!visibleColumns[cb.dataset.col];
  });
}

function renderSongTable() {
  const list = getFilteredSortedSongs();
  songTableBody.innerHTML = "";
  songEmptyHint.hidden = songs.length !== 0;

  if (songs.length && !list.length) {
    songTableBody.innerHTML = `<tr><td colspan="6" class="empty-hint">Keine Stücke gefunden – Suche/Filter anpassen.</td></tr>`;
  }

  list.forEach((song) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" class="row-select" ${selectedSongIds.has(song.id) ? "checked" : ""}></td>
      <td>${escapeHtml(song.title)}</td>
      <td class="col-genre">${escapeHtml(song.genre) || "–"}</td>
      <td class="col-difficulty stars">${song.difficulty ? STARS[song.difficulty] : "–"}</td>
      <td class="col-status">${escapeHtml(song.status) || "–"}</td>
      <td class="row-actions">
        <button data-action="edit" title="Bearbeiten">${icon("pencil")}</button>
        <button data-action="delete" title="Löschen">${icon("trash")}</button>
      </td>
    `;
    tr.querySelector('[data-action="edit"]').addEventListener("click", () => openSongModal(song.id));
    tr.querySelector('[data-action="delete"]').addEventListener("click", () => deleteSong(song.id));
    tr.querySelector(".row-select").addEventListener("change", (e) => {
      if (e.target.checked) selectedSongIds.add(song.id);
      else selectedSongIds.delete(song.id);
      updateBulkActionsUI();
    });
    songTableBody.appendChild(tr);
  });

  updateSortHeaderUI();
  applyColumnVisibility();
  updateSelectAllState(list);
  updateBulkActionsUI();
}

function updateSortHeaderUI() {
  document.querySelectorAll("#song-table thead th[data-sort]").forEach((th) => {
    th.classList.toggle("sorted", th.dataset.sort === sortState.column);
    th.dataset.dir = sortState.dir === 1 ? "▲" : "▼";
  });
}

document.querySelectorAll("#song-table thead th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const col = th.dataset.sort;
    if (sortState.column === col) {
      sortState.dir *= -1;
    } else {
      sortState = { column: col, dir: 1 };
    }
    renderSongTable();
  });
});

searchInput.addEventListener("input", () => {
  filterState.search = searchInput.value;
  renderSongTable();
});
filterGenre.addEventListener("change", () => {
  filterState.genre = filterGenre.value;
  renderSongTable();
});
filterStatus.addEventListener("change", () => {
  filterState.status = filterStatus.value;
  renderSongTable();
});
filterSchwierigkeit.addEventListener("change", () => {
  filterState.difficulty = filterSchwierigkeit.value;
  renderSongTable();
});

/* ============================================================
   Repertoire: Spalten ein-/ausblenden
   ============================================================ */

btnColumnPicker.addEventListener("click", (e) => {
  e.stopPropagation();
  columnPickerPopover.hidden = !columnPickerPopover.hidden;
});
document.addEventListener("click", (e) => {
  if (!columnPickerPopover.hidden && !columnPickerPopover.contains(e.target) && e.target !== btnColumnPicker) {
    columnPickerPopover.hidden = true;
  }
});
columnPickerPopover.querySelectorAll(".col-toggle").forEach((cb) => {
  cb.addEventListener("change", () => {
    visibleColumns[cb.dataset.col] = cb.checked;
    saveVisibleColumns(visibleColumns);
    applyColumnVisibility();
  });
});

/* ============================================================
   Repertoire: Mehrfachauswahl → zu Setliste hinzufügen
   ============================================================ */

function updateSelectAllState(list) {
  const selectableIds = list.map((s) => s.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedSongIds.has(id));
  selectAllSongs.checked = allSelected;
}

selectAllSongs.addEventListener("change", () => {
  const list = getFilteredSortedSongs();
  if (selectAllSongs.checked) {
    list.forEach((s) => selectedSongIds.add(s.id));
  } else {
    list.forEach((s) => selectedSongIds.delete(s.id));
  }
  renderSongTable();
});

function updateBulkActionsUI() {
  bulkActions.hidden = selectedSongIds.size === 0;
  bulkCount.textContent = `${selectedSongIds.size} Stück${selectedSongIds.size === 1 ? "" : "e"} ausgewählt`;

  const currentValue = bulkSetlistSelect.value;
  bulkSetlistSelect.innerHTML = `<option value="">Setliste wählen…</option>` +
    setlists.map((sl) => `<option value="${sl.id}">${escapeHtml(sl.name)}</option>`).join("");
  bulkSetlistSelect.value = setlists.some((sl) => sl.id === currentValue) ? currentValue : "";
  bulkSetlistSelect.disabled = setlists.length === 0;
  bulkAddBtn.disabled = setlists.length === 0;
}

bulkAddBtn.addEventListener("click", () => {
  const setlist = getSetlist(bulkSetlistSelect.value);
  if (!setlist) return;
  selectedSongIds.forEach((id) => {
    if (!setlist.songIds.includes(id)) setlist.songIds.push(id);
  });
  saveSetlists(setlists);
  selectedSongIds.clear();
  renderSongTable();
  renderSetlistList();
  renderSetlistDetail();
});

bulkClearBtn.addEventListener("click", () => {
  selectedSongIds.clear();
  renderSongTable();
});

/* ============================================================
   Repertoire: Modal (Anlegen/Bearbeiten)
   ============================================================ */

function openSongModal(songId) {
  editingSongId = songId || null;
  const song = songId ? getSong(songId) : null;

  songModalTitle.textContent = song ? "Stück bearbeiten" : "Neues Stück";
  fTitle.value = song?.title || "";
  fillSelectOptions(fGenre, GENRES, { placeholder: "–", currentValue: song?.genre || "" });
  fillSelectOptions(fStatus, STATUSES, { currentValue: song?.status || DEFAULT_STATUS });
  fDifficulty.value = song?.difficulty || "";
  fNotes.value = song?.notes || "";

  songModal.hidden = false;
  fTitle.focus();
}

function closeSongModal() {
  songModal.hidden = true;
  editingSongId = null;
  songForm.reset();
}

btnNewSong.addEventListener("click", () => openSongModal(null));
btnCancelSong.addEventListener("click", closeSongModal);
songModal.addEventListener("click", (e) => {
  if (e.target === songModal) closeSongModal();
});

songForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = fTitle.value.trim();
  if (!title) return;

  const data = {
    title,
    genre: fGenre.value,
    status: fStatus.value || DEFAULT_STATUS,
    difficulty: fDifficulty.value ? Number(fDifficulty.value) : null,
    notes: fNotes.value.trim(),
  };

  if (editingSongId) {
    const song = getSong(editingSongId);
    Object.assign(song, data);
  } else {
    songs.push({ id: uid(), ...data });
  }

  saveSongs(songs);
  closeSongModal();
  renderSongTable();
  renderAddSongSelect();
});

function deleteSong(songId) {
  const song = getSong(songId);
  if (!song) return;
  if (!confirm(`„${song.title}“ wirklich aus dem Repertoire löschen?\nDas Stück wird auch aus allen Setlisten entfernt.`)) return;

  songs = songs.filter((s) => s.id !== songId);
  saveSongs(songs);
  selectedSongIds.delete(songId);

  setlists.forEach((sl) => {
    sl.songIds = sl.songIds.filter((id) => id !== songId);
  });
  saveSetlists(setlists);

  renderSongTable();
  renderSetlistList();
  renderSetlistDetail();
}

/* ============================================================
   Setlisten: Sidebar
   ============================================================ */

function renderSetlistList() {
  setlistListEl.innerHTML = "";
  setlists.forEach((sl) => {
    const li = document.createElement("li");
    li.classList.toggle("active", sl.id === activeSetlistId);
    li.innerHTML = `<span>${escapeHtml(sl.name)}</span><span class="count">${sl.songIds.length}</span>`;
    li.addEventListener("click", () => {
      activeSetlistId = sl.id;
      renderSetlistList();
      renderSetlistDetail();
    });
    setlistListEl.appendChild(li);
  });
}

btnNewSetlist.addEventListener("click", () => {
  const name = `Setliste ${setlists.length + 1}`;
  const setlist = { id: uid(), name, songIds: [], createdAt: new Date().toISOString() };
  setlists.push(setlist);
  saveSetlists(setlists);
  activeSetlistId = setlist.id;
  renderSetlistList();
  renderSetlistDetail();
  updateBulkActionsUI();
  setlistNameInput.focus();
  setlistNameInput.select();
});

btnDuplicateSetlist.addEventListener("click", () => {
  const original = getSetlist(activeSetlistId);
  if (!original) return;
  const copy = {
    id: uid(),
    name: `${original.name} (Kopie)`,
    songIds: [...original.songIds],
    createdAt: new Date().toISOString(),
  };
  setlists.push(copy);
  saveSetlists(setlists);
  activeSetlistId = copy.id;
  renderSetlistList();
  renderSetlistDetail();
  setlistNameInput.focus();
  setlistNameInput.select();
});

/* ============================================================
   Setlisten: Detailansicht
   ============================================================ */

function renderAddSongSelect() {
  const setlist = getSetlist(activeSetlistId);
  addSongSelect.innerHTML = `<option value="">– Stück zur Setliste hinzufügen –</option>`;
  if (!setlist) return;

  const available = songs
    .filter((s) => !setlist.songIds.includes(s.id))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));

  available.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.title}${s.genre ? " – " + s.genre : ""}`;
    addSongSelect.appendChild(opt);
  });
}

addSongSelect.addEventListener("change", () => {
  const songId = addSongSelect.value;
  if (!songId) return;
  const setlist = getSetlist(activeSetlistId);
  if (!setlist) return;
  setlist.songIds.push(songId);
  saveSetlists(setlists);
  renderSetlistDetail();
  renderSetlistList();
});

setlistNameInput.addEventListener("change", () => {
  const setlist = getSetlist(activeSetlistId);
  if (!setlist) return;
  setlist.name = setlistNameInput.value.trim() || "Unbenannte Setliste";
  setlistNameInput.value = setlist.name;
  saveSetlists(setlists);
  renderSetlistList();
});

btnDeleteSetlist.addEventListener("click", () => {
  const setlist = getSetlist(activeSetlistId);
  if (!setlist) return;
  if (!confirm(`Setliste „${setlist.name}“ wirklich löschen?`)) return;
  setlists = setlists.filter((s) => s.id !== activeSetlistId);
  saveSetlists(setlists);
  activeSetlistId = setlists.length ? setlists[0].id : null;
  renderSetlistList();
  renderSetlistDetail();
  updateBulkActionsUI();
});

function renderSetlistDetail() {
  const setlist = getSetlist(activeSetlistId);
  setlistEmptyHint.hidden = !!setlist;
  setlistDetail.hidden = !setlist;
  if (!setlist) return;

  setlistNameInput.value = setlist.name;

  const setlistSongs = setlist.songIds.map(getSong).filter(Boolean);
  setlistSummary.textContent = `${setlistSongs.length} Stück${setlistSongs.length === 1 ? "" : "e"}`;

  renderAddSongSelect();

  setlistSongsEl.innerHTML = "";
  setlistSongsEmpty.hidden = setlistSongs.length !== 0;

  setlistSongs.forEach((song, idx) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.songId = song.id;
    li.innerHTML = `
      <span class="drag-handle">${icon("gripVertical")}</span>
      <span class="order-num">${idx + 1}</span>
      <span class="song-info">
        <div class="t">${escapeHtml(song.title)}</div>
        <div class="meta">${escapeHtml(song.genre) || "–"}${song.status ? " · " + escapeHtml(song.status) : ""}</div>
      </span>
      <span class="reorder-btns">
        <button class="move-btn" data-dir="up" title="Nach oben verschieben" ${idx === 0 ? "disabled" : ""}>${icon("chevronUp")}</button>
        <button class="move-btn" data-dir="down" title="Nach unten verschieben" ${idx === setlistSongs.length - 1 ? "disabled" : ""}>${icon("chevronDown")}</button>
      </span>
      <button class="remove-btn" title="Aus Setliste entfernen">${icon("x")}</button>
    `;
    li.querySelector(".remove-btn").addEventListener("click", () => {
      setlist.songIds = setlist.songIds.filter((id) => id !== song.id);
      saveSetlists(setlists);
      renderSetlistDetail();
      renderSetlistList();
    });
    li.querySelectorAll(".move-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        moveSongInSetlist(setlist, song.id, btn.dataset.dir === "up" ? -1 : 1);
      });
    });
    attachDragHandlers(li, setlist);
    setlistSongsEl.appendChild(li);
  });
}

function moveSongInSetlist(setlist, songId, delta) {
  const ids = setlist.songIds;
  const idx = ids.indexOf(songId);
  const newIdx = idx + delta;
  if (idx === -1 || newIdx < 0 || newIdx >= ids.length) return;
  [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
  saveSetlists(setlists);
  renderSetlistDetail();
}

/* ---- native HTML5 drag & drop reordering ---- */

let dragSourceId = null;

function attachDragHandlers(li, setlist) {
  li.addEventListener("dragstart", () => {
    dragSourceId = li.dataset.songId;
    li.classList.add("dragging");
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    setlistSongsEl.querySelectorAll("li").forEach((n) => n.classList.remove("drag-over"));
  });
  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    li.classList.add("drag-over");
  });
  li.addEventListener("dragleave", () => {
    li.classList.remove("drag-over");
  });
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    li.classList.remove("drag-over");
    const targetId = li.dataset.songId;
    if (!dragSourceId || dragSourceId === targetId) return;

    const ids = setlist.songIds;
    const fromIdx = ids.indexOf(dragSourceId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragSourceId);

    saveSetlists(setlists);
    renderSetlistDetail();
  });
}

/* ============================================================
   Drucken
   ============================================================ */

btnPrintSetlist.addEventListener("click", () => {
  const setlist = getSetlist(activeSetlistId);
  if (!setlist) return;
  const setlistSongs = setlist.songIds.map(getSong).filter(Boolean);

  const dateStr = new Date().toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });

  printArea.innerHTML = `
    <h1>${escapeHtml(setlist.name)}</h1>
    <div class="print-date">${dateStr} · ${setlistSongs.length} Stück${setlistSongs.length === 1 ? "" : "e"}</div>
    <ol>
      ${setlistSongs.map((s) => `
        <li>
          <strong>${escapeHtml(s.title)}</strong>
          <div class="meta">${escapeHtml(s.genre) || "–"}</div>
        </li>
      `).join("")}
    </ol>
  `;

  window.print();
});

/* ============================================================
   Wunschliste
   ============================================================ */

function getFilteredWishlist() {
  const q = wishSearch.trim().toLowerCase();
  if (!q) return wishlist;
  return wishlist.filter((w) => `${w.title} ${w.genre || ""}`.toLowerCase().includes(q));
}

function renderWishlistTable() {
  const list = getFilteredWishlist();
  wishlistTableBody.innerHTML = "";
  wishlistEmptyHint.hidden = wishlist.length !== 0;

  if (wishlist.length && !list.length) {
    wishlistTableBody.innerHTML = `<tr><td colspan="4" class="empty-hint">Keine Einträge gefunden.</td></tr>`;
  }

  list.forEach((wish) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(wish.title)}</td>
      <td>${escapeHtml(wish.genre) || "–"}</td>
      <td class="stars">${wish.difficulty ? STARS[wish.difficulty] : "–"}</td>
      <td class="row-actions">
        <button data-action="adopt" title="Ins Repertoire übernehmen">${icon("arrowRight")}</button>
        <button data-action="edit" title="Bearbeiten">${icon("pencil")}</button>
        <button data-action="delete" title="Löschen">${icon("trash")}</button>
      </td>
    `;
    tr.querySelector('[data-action="edit"]').addEventListener("click", () => openWishlistModal(wish.id));
    tr.querySelector('[data-action="delete"]').addEventListener("click", () => deleteWish(wish.id));
    tr.querySelector('[data-action="adopt"]').addEventListener("click", () => adoptWish(wish.id));
    wishlistTableBody.appendChild(tr);
  });
}

searchWishlist.addEventListener("input", () => {
  wishSearch = searchWishlist.value;
  renderWishlistTable();
});

function openWishlistModal(wishId) {
  editingWishId = wishId || null;
  const wish = wishId ? getWish(wishId) : null;

  wishlistModalTitle.textContent = wish ? "Wunsch bearbeiten" : "Neuer Wunsch";
  wTitle.value = wish?.title || "";
  fillSelectOptions(wGenre, GENRES, { placeholder: "–", currentValue: wish?.genre || "" });
  wDifficulty.value = wish?.difficulty || "";
  wNotes.value = wish?.notes || "";

  wishlistModal.hidden = false;
  wTitle.focus();
}

function closeWishlistModal() {
  wishlistModal.hidden = true;
  editingWishId = null;
  wishlistForm.reset();
}

btnNewWishlist.addEventListener("click", () => openWishlistModal(null));
btnCancelWishlist.addEventListener("click", closeWishlistModal);
wishlistModal.addEventListener("click", (e) => {
  if (e.target === wishlistModal) closeWishlistModal();
});

wishlistForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = wTitle.value.trim();
  if (!title) return;

  const data = {
    title,
    genre: wGenre.value,
    difficulty: wDifficulty.value ? Number(wDifficulty.value) : null,
    notes: wNotes.value.trim(),
  };

  if (editingWishId) {
    Object.assign(getWish(editingWishId), data);
  } else {
    wishlist.push({ id: uid(), ...data });
  }

  saveWishlist(wishlist);
  closeWishlistModal();
  renderWishlistTable();
});

function deleteWish(wishId) {
  const wish = getWish(wishId);
  if (!wish) return;
  if (!confirm(`„${wish.title}“ wirklich von der Wunschliste löschen?`)) return;
  wishlist = wishlist.filter((w) => w.id !== wishId);
  saveWishlist(wishlist);
  renderWishlistTable();
}

function adoptWish(wishId) {
  const wish = getWish(wishId);
  if (!wish) return;
  songs.push({
    id: uid(),
    title: wish.title,
    genre: wish.genre,
    status: DEFAULT_STATUS,
    difficulty: wish.difficulty,
    notes: wish.notes,
  });
  saveSongs(songs);

  wishlist = wishlist.filter((w) => w.id !== wishId);
  saveWishlist(wishlist);

  renderWishlistTable();
  renderSongTable();
  renderAddSongSelect();
  switchToTab("repertoire");
}

/* ============================================================
   CSV-Export
   ============================================================ */

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(",")];
  rows.forEach((row) => lines.push(row.map(csvEscape).join(",")));
  return "﻿" + lines.join("\r\n");
}

function downloadBlob(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

btnExportSongsCsv.addEventListener("click", () => {
  const list = getFilteredSortedSongs();
  const csv = toCsv(
    ["Titel", "Genre", "Schwierigkeit", "Status", "Notizen"],
    list.map((s) => [s.title, s.genre || "", s.difficulty || "", s.status || "", s.notes || ""])
  );
  downloadBlob(`repertoire-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
});

btnExportSetlistCsv.addEventListener("click", () => {
  const setlist = getSetlist(activeSetlistId);
  if (!setlist) return;
  const setlistSongs = setlist.songIds.map(getSong).filter(Boolean);
  const csv = toCsv(
    ["#", "Titel", "Genre", "Schwierigkeit", "Status", "Notizen"],
    setlistSongs.map((s, i) => [i + 1, s.title, s.genre || "", s.difficulty || "", s.status || "", s.notes || ""])
  );
  downloadBlob(`setliste-${setlist.name.replace(/[^\w\- ]+/g, "")}-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
});

btnExportWishlistCsv.addEventListener("click", () => {
  const csv = toCsv(
    ["Titel", "Genre", "Schwierigkeit", "Notizen"],
    wishlist.map((w) => [w.title, w.genre || "", w.difficulty || "", w.notes || ""])
  );
  downloadBlob(`wunschliste-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
});

/* ============================================================
   Export / Import (JSON-Backup)
   ============================================================ */

btnExport.addEventListener("click", () => {
  const payload = { songs, setlists, wishlist, exportedAt: new Date().toISOString() };
  downloadBlob(`repertoire-backup-${todayStr()}.json`, JSON.stringify(payload, null, 2), "application/json");
});

btnImport.addEventListener("click", () => fileImport.click());

fileImport.addEventListener("change", () => {
  const file = fileImport.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.songs) || !Array.isArray(data.setlists)) {
        throw new Error("Ungültiges Format");
      }
      if (!confirm("Import überschreibt dein aktuelles Repertoire, alle Setlisten und die Wunschliste. Fortfahren?")) {
        fileImport.value = "";
        return;
      }
      songs = data.songs;
      songs.forEach((s) => { if (!s.status) s.status = DEFAULT_STATUS; });
      setlists = data.setlists;
      wishlist = Array.isArray(data.wishlist) ? data.wishlist : [];
      saveSongs(songs);
      saveSetlists(setlists);
      saveWishlist(wishlist);
      activeSetlistId = setlists.length ? setlists[0].id : null;
      selectedSongIds.clear();

      renderSongTable();
      renderSetlistList();
      renderSetlistDetail();
      renderWishlistTable();
    } catch (err) {
      alert("Import fehlgeschlagen: Datei ist keine gültige Backup-Datei.");
    } finally {
      fileImport.value = "";
    }
  };
  reader.readAsText(file);
});

/* ============================================================
   Init
   ============================================================ */

populateFilterOptions();
renderSongTable();
renderSetlistList();
renderSetlistDetail();
renderWishlistTable();
