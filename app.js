const state = {
  manifest: null,
  currentFile: "rpg/_index.md",
  currentMarkdown: "",
  currentRound: 120,
};

const els = {
  content: document.querySelector("#content"),
  roundSelect: document.querySelector("#roundSelect"),
  themeSelect: document.querySelector("#themeSelect"),
  storyBtn: document.querySelector("#storyBtn"),
  optionBtn: document.querySelector("#optionBtn"),
  cardBtn: document.querySelector("#cardBtn"),
  copyLinkBtn: document.querySelector("#copyLinkBtn"),
  docType: document.querySelector("#docType"),
  docPath: document.querySelector("#docPath"),
  searchInput: document.querySelector("#searchInput"),
  searchCount: document.querySelector("#searchCount"),
  metaFile: document.querySelector("#metaFile"),
  metaSize: document.querySelector("#metaSize"),
  metaHeadings: document.querySelector("#metaHeadings"),
  headingList: document.querySelector("#headingList"),
  mobileHeadingList: document.querySelector("#mobileHeadingList"),
  mobileChaptersBtn: document.querySelector("#mobileChaptersBtn"),
  mobileStoryBtn: document.querySelector("#mobileStoryBtn"),
  mobileOptionBtn: document.querySelector("#mobileOptionBtn"),
  mobileCardBtn: document.querySelector("#mobileCardBtn"),
  mobileSettingsBtn: document.querySelector("#mobileSettingsBtn"),
  chapterSheet: document.querySelector("#chapterSheet"),
  settingsSheet: document.querySelector("#settingsSheet"),
  sheetBackdrop: document.querySelector("#sheetBackdrop"),
  closeChapterSheetBtn: document.querySelector("#closeChapterSheetBtn"),
  closeSettingsSheetBtn: document.querySelector("#closeSettingsSheetBtn"),
  mobileThemeSelect: document.querySelector("#mobileThemeSelect"),
  menuToggle: document.querySelector("#menuToggle"),
  sidebarControls: document.querySelector("#sidebarControls"),
};

let restoreScrollState = null;
let saveScrollTimer = null;

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: false,
  mangle: false,
});

init();

async function init() {
  try {
    state.manifest = await fetchJson("./rpg-manifest.json");
    state.currentRound = state.manifest.latestRound;
    buildRoundSelect();
    wireEvents();
    applySavedTheme();
    const initialFile = getFileFromHash() || "rpg/_index.md";
    await loadMarkdown(initialFile);
  } catch (error) {
    renderError(error);
  }
}

function buildRoundSelect() {
  els.roundSelect.innerHTML = state.manifest.rounds
    .map((round) => `<option value="${round}" ${round === state.currentRound ? "selected" : ""}>第 ${round} 回合</option>`)
    .join("");
  buildMobileRoundList();
}

function wireEvents() {
  document.querySelectorAll("[data-file]").forEach((button) => {
    button.addEventListener("click", () => {
      loadMarkdown(button.dataset.file);
      closeMobileMenu();
    });
  });

  els.roundSelect.addEventListener("change", () => {
    state.currentRound = Number(els.roundSelect.value);
    loadRoundFile("story");
  });
  els.themeSelect.addEventListener("change", () => setTheme(els.themeSelect.value));

  els.storyBtn.addEventListener("click", () => loadRoundFile("story"));
  els.optionBtn.addEventListener("click", () => loadRoundFile("option"));
  els.cardBtn.addEventListener("click", () => loadRoundFile("card"));
  els.mobileStoryBtn.addEventListener("click", () => loadRoundFile("story"));
  els.mobileOptionBtn.addEventListener("click", () => loadRoundFile("option"));
  els.mobileCardBtn.addEventListener("click", () => loadRoundFile("card"));
  els.mobileChaptersBtn.addEventListener("click", openChapterSheet);
  els.mobileSettingsBtn.addEventListener("click", openSettingsSheet);
  els.closeChapterSheetBtn.addEventListener("click", closeChapterSheet);
  els.closeSettingsSheetBtn.addEventListener("click", closeSettingsSheet);
  els.sheetBackdrop.addEventListener("click", closeSheets);
  els.copyLinkBtn.addEventListener("click", copyCurrentLink);
  els.searchInput.addEventListener("input", () => renderMarkdown(state.currentMarkdown, els.searchInput.value));
  els.menuToggle.addEventListener("click", toggleMobileMenu);
  els.mobileThemeSelect.addEventListener("change", () => setTheme(els.mobileThemeSelect.value));
  window.addEventListener("scroll", scheduleSaveReadingPosition, { passive: true });

  window.addEventListener("hashchange", () => {
    const file = getFileFromHash();
    if (file && file !== state.currentFile) {
      loadMarkdown(file);
    }
  });
}

function applySavedTheme() {
  const saved = localStorage.getItem("mingmo-reader-theme") || "paper";
  els.themeSelect.value = saved;
  els.mobileThemeSelect.value = saved;
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("mingmo-reader-theme", theme);
  els.themeSelect.value = theme;
  els.mobileThemeSelect.value = theme;
}

function toggleMobileMenu() {
  const isOpen = els.sidebarControls.classList.toggle("open");
  els.menuToggle.setAttribute("aria-expanded", String(isOpen));
  els.menuToggle.textContent = isOpen ? "收合" : "選單";
}

function closeMobileMenu() {
  if (!window.matchMedia("(max-width: 760px)").matches) return;
  els.sidebarControls.classList.remove("open");
  els.menuToggle.setAttribute("aria-expanded", "false");
  els.menuToggle.textContent = "選單";
}

function loadRoundFile(type) {
  const round = state.currentRound;
  const map = {
    story: `rpg/story/story_${round}.md`,
    option: `rpg/story/option_${round}.md`,
    card: `rpg/status_cards/round_${round}_cards.md`,
  };
  loadMarkdown(map[type]);
}

async function loadMarkdown(file) {
  saveReadingPosition();
  setActiveNav(file);
  state.currentFile = file;
  restoreScrollState = readSavedPosition(file);
  els.docPath.textContent = file;
  els.docType.textContent = labelForFile(file);
  els.searchInput.value = "";
  els.content.innerHTML = `<p class="empty-state">讀取中：${escapeHtml(file)}</p>`;

  try {
    const response = await fetch(`./${file}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`讀取失敗 ${response.status}: ${file}`);
    }
    state.currentMarkdown = await response.text();
    history.replaceState(null, "", `#${encodeURIComponent(file)}`);
    renderMarkdown(state.currentMarkdown, "");
    updateMeta(file, state.currentMarkdown);
    restoreReadingPosition();
  } catch (error) {
    renderError(error);
  }
}

function renderMarkdown(markdown, query) {
  let source = markdown;
  let hitCount = 0;

  if (query.trim()) {
    const escaped = escapeRegExp(query.trim());
    const regex = new RegExp(escaped, "gi");
    source = markdown.replace(regex, (match) => {
      hitCount += 1;
      return `<mark class="mark-hit">${match}</mark>`;
    });
  }

  const html = marked.parse(source);
  els.content.innerHTML = DOMPurify.sanitize(html, {
    ADD_ATTR: ["id"],
  });
  addHeadingAnchors();
  buildHeadingList();
  els.searchCount.textContent = query.trim() ? `${hitCount} 筆` : "未搜尋";
}

function addHeadingAnchors() {
  const headings = els.content.querySelectorAll("h1, h2, h3");
  headings.forEach((heading, index) => {
    heading.id = `section-${index + 1}`;
  });
}

function buildHeadingList() {
  const headings = [...els.content.querySelectorAll("h1, h2, h3")].slice(0, 18);
  els.metaHeadings.textContent = `${els.content.querySelectorAll("h1, h2, h3").length}`;
  if (!headings.length) {
    els.headingList.innerHTML = `<p class="empty-state">沒有標題</p>`;
    els.mobileHeadingList.innerHTML = `<p class="empty-state">沒有標題</p>`;
    return;
  }
  els.headingList.innerHTML = headings
    .map((heading) => `<button type="button" class="heading-jump" data-target="${heading.id}">${escapeHtml(heading.textContent)}</button>`)
    .join("");
  els.mobileHeadingList.innerHTML = headings
    .map((heading) => `<button type="button" class="mobile-heading-jump" data-target="${heading.id}">${escapeHtml(heading.textContent)}</button>`)
    .join("");
  els.headingList.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.target);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  els.mobileHeadingList.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.target);
      if (!target) return;
      closeChapterSheet();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function updateMeta(file, markdown) {
  const bytes = new Blob([markdown]).size;
  els.metaFile.textContent = file;
  els.metaSize.textContent = formatBytes(bytes);
}

function openChapterSheet() {
  closeSettingsSheet(false);
  buildMobileRoundList();
  els.sheetBackdrop.hidden = false;
  els.chapterSheet.classList.add("open");
  els.chapterSheet.setAttribute("aria-hidden", "false");
  els.mobileChaptersBtn.setAttribute("aria-expanded", "true");
}

function closeChapterSheet(hideBackdrop = true) {
  els.chapterSheet.classList.remove("open");
  els.chapterSheet.setAttribute("aria-hidden", "true");
  els.mobileChaptersBtn.setAttribute("aria-expanded", "false");
  if (!hideBackdrop) return;
  window.setTimeout(() => {
    if (!els.chapterSheet.classList.contains("open") && !els.settingsSheet.classList.contains("open")) {
      els.sheetBackdrop.hidden = true;
    }
  }, 180);
}

function openSettingsSheet() {
  closeChapterSheet(false);
  els.sheetBackdrop.hidden = false;
  els.settingsSheet.classList.add("open");
  els.settingsSheet.setAttribute("aria-hidden", "false");
  els.mobileSettingsBtn.setAttribute("aria-expanded", "true");
}

function closeSettingsSheet(hideBackdrop = true) {
  els.settingsSheet.classList.remove("open");
  els.settingsSheet.setAttribute("aria-hidden", "true");
  els.mobileSettingsBtn.setAttribute("aria-expanded", "false");
  if (!hideBackdrop) return;
  window.setTimeout(() => {
    if (!els.chapterSheet.classList.contains("open") && !els.settingsSheet.classList.contains("open")) {
      els.sheetBackdrop.hidden = true;
    }
  }, 180);
}

function closeSheets() {
  closeChapterSheet(false);
  closeSettingsSheet(true);
}

function scheduleSaveReadingPosition() {
  if (saveScrollTimer) window.clearTimeout(saveScrollTimer);
  saveScrollTimer = window.setTimeout(saveReadingPosition, 180);
}

function saveReadingPosition() {
  if (!state.currentFile) return;
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const payload = {
    y: Math.max(0, Math.round(window.scrollY)),
    ratio: Math.min(1, Math.max(0, window.scrollY / max)),
    updatedAt: Date.now(),
  };
  localStorage.setItem(readingKey(state.currentFile), JSON.stringify(payload));
}

function readSavedPosition(file) {
  try {
    const raw = localStorage.getItem(readingKey(file));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function restoreReadingPosition() {
  const saved = restoreScrollState;
  restoreScrollState = null;
  window.requestAnimationFrame(() => {
    if (!saved || typeof saved.y !== "number") {
      window.scrollTo({ top: 0 });
      return;
    }
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.min(saved.y, max) });
  });
}

function readingKey(file) {
  return `mingmo-reader-position:${file}`;
}

function buildMobileRoundList() {
  if (!state.manifest) return;
  els.mobileHeadingList.innerHTML = state.manifest.rounds
    .slice()
    .reverse()
    .map((round) => {
      const active = round === state.currentRound ? " active" : "";
      return `<button type="button" class="mobile-heading-jump${active}" data-round="${round}">第 ${round} 回合</button>`;
    })
    .join("");
  els.mobileHeadingList.querySelectorAll("[data-round]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentRound = Number(button.dataset.round);
      els.roundSelect.value = String(state.currentRound);
      closeChapterSheet();
      loadRoundFile("story");
    });
  });
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`讀取 manifest 失敗：${response.status}`);
  }
  return response.json();
}

function setActiveNav(file) {
  document.querySelectorAll("[data-file]").forEach((button) => {
    button.classList.toggle("active", button.dataset.file === file);
  });
}

async function copyCurrentLink() {
  const url = `${location.origin}${location.pathname}#${encodeURIComponent(state.currentFile)}`;
  await navigator.clipboard.writeText(url);
  els.copyLinkBtn.textContent = "✓";
  window.setTimeout(() => {
    els.copyLinkBtn.textContent = "⛓";
  }, 900);
}

function getFileFromHash() {
  if (!location.hash) return "";
  const value = decodeURIComponent(location.hash.slice(1));
  return value.startsWith("rpg/") ? value : "";
}

function labelForFile(file) {
  if (file.includes("/story_")) return "故事";
  if (file.includes("/option_")) return "選項";
  if (file.includes("status_cards")) return "現狀卡";
  const labels = {
    "rpg/_index.md": "現況總覽",
    "rpg/military.md": "軍力軍備",
    "rpg/tech.md": "科技工業",
    "rpg/economy.md": "財政產業",
    "rpg/politics.md": "政治法制",
    "rpg/international.md": "國際外交",
    "rpg/events.md": "大事記",
    "rpg/project_timeline.md": "專案時間表",
    "rpg/personnel.md": "人物卡",
    "rpg/institutions.md": "機關卡",
    "rpg/laws.md": "法律彙編",
  };
  return labels[file] || "Markdown";
}

function renderError(error) {
  els.content.innerHTML = `<div class="empty-state"><h1>讀取失敗</h1><p>${escapeHtml(error.message)}</p></div>`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
