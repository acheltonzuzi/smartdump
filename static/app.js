/* =========================================================
   SmartDebugger — frontend app
   Vanilla JS, no dependencies, no build step
   ========================================================= */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  dumps: [],         // all received dumps (newest first)
  levelFilter: "all",
  searchQuery: "",
  sortOrder: "newest",  // "newest" | "oldest"
};

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const $dumpList    = document.getElementById("dump-list");
const $emptyState  = document.getElementById("empty-state");
const $dumpCount   = document.getElementById("dump-count");
const $wsStatus    = document.getElementById("ws-status");
const $searchInput = document.getElementById("search-input");
const $btnClear    = document.getElementById("btn-clear");
const $levelPills  = document.querySelectorAll("[data-level]");
const $sortNewest  = document.getElementById("sort-newest");
const $sortOldest  = document.getElementById("sort-oldest");

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

let ws = null;
let reconnectTimer = null;

function connectWs() {
  const url = `ws://${location.host}/ws`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    setWsStatus("connected");
    clearTimeout(reconnectTimer);
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.event === "dump") {
      state.dumps.unshift(msg.payload);
      renderList();
    } else if (msg.event === "clear") {
      state.dumps = [];
      renderList();
    }
  };

  ws.onclose = ws.onerror = () => {
    setWsStatus("disconnected");
    reconnectTimer = setTimeout(connectWs, 3000);
  };
}

function setWsStatus(status) {
  const labels = {
    connected: "● connected",
    connecting: "● connecting",
    disconnected: "● disconnected",
  };
  $wsStatus.textContent = labels[status];
  $wsStatus.dataset.status = status;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function filteredDumps() {
  let list = [...state.dumps];

  if (state.levelFilter !== "all") {
    list = list.filter((d) => d.level === state.levelFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter((d) => {
      const label = (d.label || "").toLowerCase();
      const file  = (d.meta?.file || "").toLowerCase();
      const data  = JSON.stringify(d.data).toLowerCase();
      return label.includes(q) || file.includes(q) || data.includes(q);
    });
  }

  if (state.sortOrder === "oldest") {
    list = list.reverse();
  }

  return list;
}

function renderList() {
  const dumps = filteredDumps();

  $dumpCount.textContent = `${state.dumps.length} dump${state.dumps.length !== 1 ? "s" : ""}`;
  $emptyState.style.display = state.dumps.length === 0 ? "flex" : "none";

  // Efficient reconciliation: re-render only what changed.
  // For simplicity (and given typical dump volumes) we do a full re-render.
  $dumpList.innerHTML = "";
  dumps.forEach((dump) => $dumpList.appendChild(buildCard(dump)));
}

// ---------------------------------------------------------------------------
// Card builder
// ---------------------------------------------------------------------------

function buildCard(dump) {
  const card = document.createElement("div");
  card.className = "dump-card";
  card.dataset.id = dump.id;

  const label   = dump.label || dump.type || "dump";
  const level   = dump.level || "info";
  const ts      = formatTimestamp(dump.timestamp);
  const file    = shortPath(dump.meta?.file || "");
  const line    = dump.meta?.line ?? "";
  const fn      = dump.meta?.function ?? "";

  // ── Header ──────────────────────────────────────────────
  const header = document.createElement("div");
  header.className = "card-header";
  header.innerHTML = `
    <span class="card-toggle">▼</span>
    <span class="card-label">${escHtml(label)}</span>
    <span class="level-badge level-${level}">${level}</span>
    <span class="type-badge">${escHtml(dump.type || "?")}</span>
    <span style="color:var(--text-muted);font-size:11px;margin-left:auto">${ts}</span>
  `;
  header.addEventListener("click", () => card.classList.toggle("collapsed"));

  // ── Meta ────────────────────────────────────────────────
  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.innerHTML = `
    <span>📄 <span class="file-link">${escHtml(file)}:${line}</span></span>
    ${fn ? `<span>ƒ <code>${escHtml(fn)}()</code></span>` : ""}
    <div class="card-actions">
      <button class="btn btn-ghost" title="Copy JSON" onclick="copyJson(event, '${escAttr(dump.id)}')">Copy</button>
    </div>
  `;

  // ── Body ─────────────────────────────────────────────────
  const body = document.createElement("div");
  body.className = "card-body";
  const tree = buildJsonTree(dump.data);
  body.appendChild(tree);

  card.appendChild(header);
  card.appendChild(meta);
  card.appendChild(body);

  return card;
}

// ---------------------------------------------------------------------------
// JSON tree builder (recursive, collapsible)
// ---------------------------------------------------------------------------

function buildJsonTree(value, depth = 0) {
  const wrapper = document.createElement("div");
  wrapper.className = "json-tree";
  wrapper.appendChild(renderNode(value, depth, null));
  return wrapper;
}

function renderNode(value, depth, key) {
  const row = document.createElement("div");
  row.className = "json-row";

  if (key !== null) {
    const keyEl = document.createElement("span");
    keyEl.className = "json-key";
    keyEl.textContent = JSON.stringify(String(key));
    row.appendChild(keyEl);

    const colon = document.createElement("span");
    colon.className = "json-colon";
    colon.textContent = ": ";
    row.appendChild(colon);
  }

  if (value === null) {
    row.appendChild(makeLeaf("json-null", "null"));
    return row;
  }

  if (typeof value === "boolean") {
    row.appendChild(makeLeaf("json-bool", String(value)));
    return row;
  }

  if (typeof value === "number") {
    row.appendChild(makeLeaf("json-num", String(value)));
    return row;
  }

  if (typeof value === "string") {
    row.appendChild(makeLeaf("json-str", JSON.stringify(value)));
    return row;
  }

  if (Array.isArray(value)) {
    return renderCollection(value, row, "[", "]", depth, (v, i) => renderNode(v, depth + 1, null));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    return renderCollection(entries, row, "{", "}", depth, ([k, v]) => renderNode(v, depth + 1, k));
  }

  row.appendChild(makeLeaf("json-null", String(value)));
  return row;
}

function renderCollection(items, row, open, close, depth, renderItem) {
  const count = items.length;

  if (count === 0) {
    row.appendChild(bracketSpan(`${open}${close}`));
    return row;
  }

  // Container that holds toggle + row + children
  const container = document.createElement("div");
  container.className = "json-node";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "json-toggle-btn";
  toggleBtn.textContent = "▾";

  const openBracket = bracketSpan(open);
  const summary     = document.createElement("span");
  summary.className = "json-summary";
  summary.textContent = ` ${count} ${open === "[" ? "item" : "key"}${count !== 1 ? "s" : ""} `;

  row.insertBefore(toggleBtn, row.firstChild);
  row.appendChild(openBracket);
  row.appendChild(summary);

  const children = document.createElement("div");
  children.className = "json-children";

  items.forEach((item, idx) => {
    const childRow = renderItem(item, idx);
    // Add comma except last
    if (idx < count - 1) {
      const comma = document.createElement("span");
      comma.className = "json-colon";
      comma.textContent = ",";
      childRow.appendChild(comma);
    }
    children.appendChild(childRow);
  });

  const closingRow = document.createElement("div");
  closingRow.className = "json-row";
  closingRow.appendChild(bracketSpan(close));

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const collapsed = children.classList.toggle("hidden");
    toggleBtn.textContent = collapsed ? "▸" : "▾";
    summary.style.display = collapsed ? "inline" : "none";
    closingRow.style.display = collapsed ? "none" : "flex";
  });

  // Auto-collapse deep nodes
  if (depth >= 3) {
    children.classList.add("hidden");
    toggleBtn.textContent = "▸";
    closingRow.style.display = "none";
  } else {
    summary.style.display = "none";
  }

  container.appendChild(row);
  container.appendChild(children);
  container.appendChild(closingRow);
  return container;
}

function makeLeaf(cls, text) {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = text;
  return el;
}

function bracketSpan(text) {
  const el = document.createElement("span");
  el.className = "json-bracket";
  el.textContent = text;
  return el;
}

// ---------------------------------------------------------------------------
// Copy to clipboard
// ---------------------------------------------------------------------------

const _dumpMap = {};   // id → dump, populated during render

function copyJson(event, id) {
  event.stopPropagation();
  const dump = state.dumps.find((d) => d.id === id);
  if (!dump) return;

  const text = JSON.stringify(dump.data, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    const btn = event.currentTarget;
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = orig), 1500);
  });
}
window.copyJson = copyJson;  // expose for inline onclick

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

function shortPath(p) {
  // Show only last 3 segments to keep the UI tidy
  const parts = p.replace(/\\/g, "/").split("/");
  return parts.slice(-3).join("/");
}

function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Load historical dumps on first load
// ---------------------------------------------------------------------------

async function loadHistory() {
  try {
    const res = await fetch("/dumps");
    if (!res.ok) return;
    const dumps = await res.json();
    state.dumps = dumps;  // server returns newest-first
    renderList();
  } catch {
    // Server not ready yet — WebSocket will bring live dumps
  }
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

// Level filter pills
$levelPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    $levelPills.forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    state.levelFilter = pill.dataset.level;
    renderList();
  });
});

// Search
$searchInput.addEventListener("input", () => {
  state.searchQuery = $searchInput.value.trim();
  renderList();
});

// Sort
$sortNewest.addEventListener("click", () => {
  state.sortOrder = "newest";
  $sortNewest.classList.add("active");
  $sortOldest.classList.remove("active");
  renderList();
});
$sortOldest.addEventListener("click", () => {
  state.sortOrder = "oldest";
  $sortOldest.classList.add("active");
  $sortNewest.classList.remove("active");
  renderList();
});

// Clear
$btnClear.addEventListener("click", async () => {
  await fetch("/dumps", { method: "DELETE" });
  state.dumps = [];
  renderList();
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

loadHistory();
connectWs();
