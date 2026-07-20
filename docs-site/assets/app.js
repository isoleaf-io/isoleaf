// Vanilla port of frontend/isohub/src/pages/Docs/DocBlocks.tsx, plus the
// docs-site shell: header search, accordion sidebar with heading subitems,
// smooth scroll and mobile drawer. Content + section titles come from
// assets/data.json, emitted by build.ts.

const LANG = document.documentElement.getAttribute("data-lang") || "pt";
const APP_URL = "https://isoleaf.dev/app";

const STRINGS = {
  pt: {
    sectionsLabel: "Seções",
    notFound: "Seção não encontrada.",
    backApp: "← Voltar ao app",
    searchPlaceholder: "Buscar na documentação...",
    searchHint: "Digite ao menos 2 caracteres para buscar.",
    searchEmpty: "Nenhum resultado.",
    searchResults: "Resultados",
  },
  en: {
    sectionsLabel: "Sections",
    notFound: "Section not found.",
    backApp: "← Back to app",
    searchPlaceholder: "Search the documentation...",
    searchHint: "Type at least 2 characters to search.",
    searchEmpty: "No results.",
    searchResults: "Results",
  },
};
const T = STRINGS[LANG] || STRINGS.pt;

// ---- Inline parser ---------------------------------------------------------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function renderInline(text) {
  if (text == null) return "";
  const src = String(text);
  const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = regex.exec(src)) !== null) {
    if (m.index > last) out += escapeHtml(src.slice(last, m.index));
    if (m[1] !== undefined && m[2] !== undefined) {
      const href = m[2];
      const isMail = href.startsWith("mailto:");
      const safe = /^(https?:|mailto:|#|\/)/.test(href) ? href : "#";
      const ext = !isMail && /^https?:/.test(safe) ? ' target="_blank" rel="noopener"' : "";
      out += `<a href="${escapeHtml(safe)}"${ext}>${escapeHtml(m[1])}</a>`;
    } else if (m[3] !== undefined) {
      out += `<strong>${escapeHtml(m[3])}</strong>`;
    } else if (m[4] !== undefined) {
      out += `<code>${escapeHtml(m[4])}</code>`;
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) out += escapeHtml(src.slice(last));
  return out;
}
function stripInline(text) {
  if (!text) return "";
  return String(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

// ---- Slug for heading anchors ---------------------------------------------
function slugify(text) {
  return stripInline(text)
    .toLowerCase()
    .normalize("NFD").replace(/\p{M}+/gu, "")  // strip combining marks (accents)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "section";
}

// ---- Block renderer --------------------------------------------------------
// Headings get a stable `id` so subnav clicks can scroll to them. The id is
// passed in from the section render loop because the same slug may repeat
// across sections.
function renderBlock(b, anchorId) {
  switch (b.type) {
    case "heading": {
      const lvl = Math.min(Math.max(b.level || 2, 2), 4);
      const tag = lvl === 2 ? "h2" : lvl === 3 ? "h3" : "h4";
      const id = anchorId ? ` id="${escapeHtml(anchorId)}"` : "";
      const main = `<${tag}${id} class="db db-h${lvl}">${renderInline(b.text)}</${tag}>`;
      if (b.subtitle) {
        return `<div class="db db-heading-wrap">${main}<p class="db-heading-sub">${renderInline(b.subtitle)}</p></div>`;
      }
      return main;
    }
    case "paragraph":
      return `<p class="db db-p">${renderInline(b.text)}</p>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const items = (b.items || []).map((i) => `<li>${renderInline(i)}</li>`).join("");
      return `<${tag} class="db db-list">${items}</${tag}>`;
    }
    case "code": {
      const lang = b.lang ? `<span class="lang">${escapeHtml(b.lang)}</span>` : "";
      return `<pre class="db db-code">${lang}<code>${escapeHtml(b.text)}</code></pre>`;
    }
    case "diagram":
      return `<pre class="db db-diagram-ascii"><code>${escapeHtml(b.text)}</code></pre>`;
    case "table": {
      const head = (b.headers || []).map((h) => `<th>${renderInline(h)}</th>`).join("");
      const body = (b.rows || [])
        .map(
          (r) =>
            `<tr>${r
              .map((c, i) => `<td class="${i === 0 ? "td-mono" : ""}">${renderInline(c)}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      return `<div class="db db-table-wrap"><table class="db-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }
    case "callout": {
      const tone = b.tone || "info";
      return `<div class="db db-callout" data-tone="${escapeHtml(tone)}"><div>${renderInline(b.text)}</div></div>`;
    }
    case "svg":
      return `<div class="db db-svg">${b.text || ""}</div>`;
    case "image": {
      const alt = escapeHtml(b.alt || "");
      const cap = b.caption ? `<figcaption class="db-image-caption">${renderInline(b.caption)}</figcaption>` : "";
      return `<figure class="db db-image"><img src="${escapeHtml(b.src)}" alt="${alt}" loading="lazy">${cap}</figure>`;
    }
    case "divider":
      return `<hr class="db db-divider">`;
    default:
      return "";
  }
}

// ---- Build sections list with heading anchors -----------------------------
// Walks each section's blocks once and produces:
//   - rendered HTML (with stable heading ids)
//   - flat subitems list (level 2 + 3 only — level 4 is too granular for the TOC)
//   - search index entries (one per block with text)
function indexSection(key, section) {
  const subitems = [];
  const search = [];
  const seen = new Map();
  const html = (section.blocks || [])
    .map((b, idx) => {
      let anchorId = null;
      if (b.type === "heading") {
        const base = slugify(b.text);
        const n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        anchorId = n === 1 ? base : `${base}-${n}`;
        if ((b.level || 2) <= 3) {
          subitems.push({
            id: anchorId,
            text: stripInline(b.text),
            level: b.level || 2,
            blockIdx: idx,
          });
        }
      }
      // Index any block carrying searchable text. Headings already have an
      // anchor; for non-heading blocks the search jumps to the nearest preceding
      // anchor (handled at click time via the section + index lookup).
      const text = collectText(b);
      if (text) {
        search.push({
          sectionKey: key,
          sectionTitle: section.title || key,
          blockIdx: idx,
          anchorId,
          type: b.type,
          text,
        });
      }
      return renderBlock(b, anchorId);
    })
    .join("");
  return { html, subitems, search };
}

function collectText(b) {
  switch (b.type) {
    case "heading":
    case "paragraph":
    case "code":
    case "diagram":
      return stripInline(b.text || "");
    case "callout":
      return stripInline((b.title ? b.title + " — " : "") + (b.text || ""));
    case "list":
      return (b.items || []).map(stripInline).join(" • ");
    case "table":
      return [(b.headers || []).join(" "), ...(b.rows || []).map((r) => r.join(" "))]
        .join(" | ");
    default:
      return "";
  }
}

// ---- Sidebar render --------------------------------------------------------
// `activeKey` = section whose content is on screen (highlighted in the nav).
// `expandedKey` = section whose accordion is currently open (may differ from
// activeKey because clicking an already-expanded item collapses it without
// changing the visible content).
//
// Visual grouping: keys listed as children of GROUP_PARENT render with the
// nav-item--nested modifier (extra left padding, slightly smaller label
// font) so they read as members of the ISO 8583 / ISO 20022 world without
// changing any click/expand behaviour — each section still owns its own
// independent accordion. iso8583 and iso20022 are the group headings and
// have no entry here (they behave like any other top-level section).
const GROUP_PARENT = {
  emv: "iso8583",
  roles: "iso8583",
  fields: "iso8583",
  iso20022Roles: "iso20022",
};
// Derived set — every value that appears on the right-hand side of the
// map above is a "group parent" (the label that other keys nest under).
// Rendering-side these items get an extra `nav-item--group-parent`
// modifier: permanent bold label + thin top border, matching the
// mother-group treatment in the app Sidebar. No hardcoding a second
// list of names — a new child in GROUP_PARENT automatically lifts its
// parent into the set here.
const GROUP_PARENTS = new Set(Object.values(GROUP_PARENT));

function renderSidebar(sections, activeKey, expandedKey, activeSubId) {
  const nav = document.getElementById("nav");
  if (!nav) return;
  nav.innerHTML = sections
    .map((s) => {
      const isActive = s.key === activeKey;
      const isExpanded = s.key === expandedKey;
      const subItems = s.subitems
        .map((si) => {
          const cls = `sub-item level-${si.level}${isActive && si.id === activeSubId ? " active" : ""}`;
          return `<a class="${cls}" href="#${encodeURIComponent(s.key)}/${encodeURIComponent(si.id)}" data-anchor="${si.id}" data-section="${s.key}">${escapeHtml(si.text)}</a>`;
        })
        .join("");
      const itemClasses = ["nav-item"];
      if (isActive) itemClasses.push("active");
      if (isExpanded) itemClasses.push("expanded");
      if (GROUP_PARENT[s.key]) itemClasses.push("nav-item--nested");
      if (GROUP_PARENTS.has(s.key)) itemClasses.push("nav-item--group-parent");
      return `
        <button type="button" class="${itemClasses.join(" ")}" data-section="${s.key}" aria-expanded="${isExpanded}">
          <span class="nav-caret">▶</span>
          <span class="nav-item-label">${escapeHtml(s.title)}</span>
        </button>
        <div class="subnav ${isExpanded ? "open" : ""}" data-subnav="${s.key}">${subItems}</div>
      `;
    })
    .join("");

  nav.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-section");
      toggleSection(key);
    });
  });
  nav.querySelectorAll(".sub-item").forEach((a) => {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      const key = a.getAttribute("data-section");
      const anchor = a.getAttribute("data-anchor");
      navigateTo(key, anchor);
    });
  });
}

function renderPage(section) {
  const titleEl = document.getElementById("page-title");
  const subEl = document.getElementById("page-sub");
  const bodyEl = document.getElementById("page-body");
  if (!titleEl || !bodyEl) return;
  if (!section) {
    titleEl.textContent = "—";
    if (subEl) subEl.textContent = "";
    bodyEl.innerHTML = `<p class="db db-p">${T.notFound}</p>`;
    return;
  }
  titleEl.textContent = section.title || "";
  if (subEl) subEl.textContent = section.subtitle || "";
  bodyEl.innerHTML = section.html || "";
  document.title = `${section.title} · ISOLeaf Docs`;
}

// ---- Hash & navigation -----------------------------------------------------
// Hash format:
//   #<sectionKey>                — open section, scroll to top
//   #<sectionKey>/<anchorId>     — open section, scroll to heading
function parseHash() {
  const h = location.hash.replace(/^#/, "");
  if (!h) return { key: null, anchor: null };
  const [key, anchor] = h.split("/", 2);
  return { key: decodeURIComponent(key || ""), anchor: anchor ? decodeURIComponent(anchor) : null };
}

let SECTIONS = [];
let SEARCH_INDEX = [];
let CURRENT_KEY = null;    // section visible in main content
let EXPANDED_KEY = null;   // section whose accordion is open in the sidebar

function navigateTo(key, anchor) {
  const sec = SECTIONS.find((s) => s.key === key) || SECTIONS[0];
  if (!sec) return;
  CURRENT_KEY = sec.key;
  EXPANDED_KEY = sec.key;
  const hash = anchor ? `#${sec.key}/${anchor}` : `#${sec.key}`;
  if (location.hash !== hash) history.pushState(null, "", hash);
  renderSidebar(SECTIONS, CURRENT_KEY, EXPANDED_KEY, anchor || null);
  renderPage(sec);
  closeDrawer();
  if (anchor) {
    requestAnimationFrame(() => scrollToAnchor(anchor));
  } else {
    window.scrollTo({ top: 0 });
  }
}

// Clicking the nav-item header is a pure accordion toggle: it never changes
// the visible content, only the open/closed state of the section the user
// clicked. Use sub-items (or search results) to actually navigate.
function toggleSection(key) {
  if (EXPANDED_KEY === key) {
    EXPANDED_KEY = null;
  } else {
    EXPANDED_KEY = key;
    // Also bring its content into view if the user is just exploring.
    const sec = SECTIONS.find((s) => s.key === key);
    if (sec && sec.key !== CURRENT_KEY) {
      CURRENT_KEY = sec.key;
      const hash = `#${sec.key}`;
      if (location.hash !== hash) history.pushState(null, "", hash);
      renderPage(sec);
      window.scrollTo({ top: 0 });
      closeDrawer();
    }
  }
  renderSidebar(SECTIONS, CURRENT_KEY, EXPANDED_KEY, null);
}

function scrollToAnchor(anchor) {
  const el = document.getElementById(anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("match-flash");
  setTimeout(() => el.classList.remove("match-flash"), 1700);
}

// ---- Search ----------------------------------------------------------------
function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${safe})`, "ig");
  return escapeHtml(text).replace(re, "<mark>$1</mark>");
}
function buildSnippet(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, 140) + (text.length > 140 ? "…" : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}

function runSearch(query) {
  const trimmed = (query || "").trim();
  const box = document.getElementById("search-results");
  if (!box) return;
  if (trimmed.length === 0) {
    box.classList.remove("open");
    box.innerHTML = "";
    return;
  }
  if (trimmed.length < 2) {
    box.classList.add("open");
    box.innerHTML = `<div class="search-hint">${T.searchHint}</div>`;
    return;
  }
  const q = trimmed.toLowerCase();
  const hits = [];
  for (const entry of SEARCH_INDEX) {
    const lower = entry.text.toLowerCase();
    if (lower.includes(q)) {
      hits.push({ entry, score: entry.type === "heading" ? 0 : 1 });
      if (hits.length >= 30) break;
    }
  }
  hits.sort((a, b) => a.score - b.score);
  if (hits.length === 0) {
    box.classList.add("open");
    box.innerHTML = `<div class="search-empty">${T.searchEmpty}</div>`;
    return;
  }
  box.classList.add("open");
  box.innerHTML = hits
    .map(({ entry }, i) => {
      const snippet = buildSnippet(entry.text, trimmed);
      const anchorTarget = entry.anchorId || nearestAnchor(entry.sectionKey, entry.blockIdx);
      return `
        <a class="search-result${i === 0 ? " active" : ""}" data-section="${entry.sectionKey}" data-anchor="${anchorTarget || ""}">
          <div class="search-result-section">${escapeHtml(entry.sectionTitle)}</div>
          <div class="search-result-snippet">${highlight(snippet, trimmed)}</div>
        </a>
      `;
    })
    .join("");
  box.querySelectorAll(".search-result").forEach((node) => {
    node.addEventListener("click", (ev) => {
      ev.preventDefault();
      const key = node.getAttribute("data-section");
      const anchor = node.getAttribute("data-anchor") || null;
      const input = document.getElementById("search-input");
      if (input) input.value = "";
      box.classList.remove("open");
      navigateTo(key, anchor);
    });
  });
}

// Returns the id of the heading at or before `idx` in the given section, so
// search hits on non-heading blocks still jump to the nearest landmark.
function nearestAnchor(sectionKey, idx) {
  const sec = SECTIONS.find((s) => s.key === sectionKey);
  if (!sec) return null;
  let best = null;
  for (const s of sec.subitems) {
    if (typeof s.blockIdx === "number" && s.blockIdx <= idx) best = s.id;
  }
  return best;
}

// ---- Mobile drawer --------------------------------------------------------
function openDrawer() {
  document.querySelector(".sidebar")?.classList.add("open");
  document.querySelector(".scrim")?.classList.add("open");
}
function closeDrawer() {
  document.querySelector(".sidebar")?.classList.remove("open");
  document.querySelector(".scrim")?.classList.remove("open");
}

// ---- Boot ------------------------------------------------------------------
async function boot() {
  const res = await fetch("/assets/data.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to fetch data.json: " + res.status);
  const data = await res.json();
  const bundle = data[LANG] || data.pt || {};

  SECTIONS = Object.entries(bundle).map(([key, s]) => {
    const idx = indexSection(key, s);
    return {
      key,
      title: s.title || key,
      subtitle: s.subtitle || "",
      subitems: idx.subitems,
      html: idx.html,
      search: idx.search,
    };
  });
  SEARCH_INDEX = SECTIONS.flatMap((s) => s.search);

  // Wire static UI
  const input = document.getElementById("search-input");
  if (input) {
    input.placeholder = T.searchPlaceholder;
    let timer = null;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => runSearch(input.value), 80);
    });
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        input.value = "";
        runSearch("");
        input.blur();
      }
    });
    document.getElementById("search-clear")?.addEventListener("click", () => {
      input.value = "";
      runSearch("");
      input.focus();
    });
    document.addEventListener("click", (ev) => {
      const box = document.getElementById("search-results");
      const search = document.querySelector(".search");
      if (!box || !search) return;
      if (!search.contains(ev.target)) box.classList.remove("open");
    });
  }
  document.querySelectorAll("[data-app-url]").forEach((a) => a.setAttribute("href", APP_URL));
  document.getElementById("menu-toggle")?.addEventListener("click", openDrawer);
  document.querySelector(".scrim")?.addEventListener("click", closeDrawer);

  // Initial render
  const { key, anchor } = parseHash();
  const startKey = (key && SECTIONS.some((s) => s.key === key)) ? key : SECTIONS[0]?.key;
  navigateTo(startKey, anchor);

  // History (back/forward) and direct hash edits
  window.addEventListener("hashchange", () => {
    const { key, anchor } = parseHash();
    if (!key) return;
    if (key !== CURRENT_KEY) {
      navigateTo(key, anchor);
    } else if (anchor) {
      EXPANDED_KEY = key;
      renderSidebar(SECTIONS, CURRENT_KEY, EXPANDED_KEY, anchor);
      scrollToAnchor(anchor);
    }
  });
}

boot().catch((err) => {
  console.error("[isoleaf-docs] boot failed", err);
  const body = document.getElementById("page-body");
  if (body) body.textContent = "Failed to load docs.";
});
