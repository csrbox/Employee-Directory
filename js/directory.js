/* =========================================================================
   directory.js
   Searchable / filterable employee table with CASCADING filters:
   picking one filter narrows what's available in the others, so you can
   never land on an impossible combination (e.g. an Org + Location pair
   that has zero employees).
   ========================================================================= */

let directoryData = [];

document.addEventListener("data:ready", (e) => {
  directoryData = e.detail;
  refreshDirectoryFilterOptions();
  renderTable(getFilteredDirectoryData());
  attachDirectoryEvents();
});

/** Reads the three select elements' current values. */
function getDirectoryFilterState() {
  return {
    organisation: document.getElementById("filterOrg").value,
    location: document.getElementById("filterLocation").value,
    level: document.getElementById("filterLevel").value,
  };
}

/** Returns rows matching name search + all active filters. */
function getFilteredDirectoryData() {
  const nameQuery = (document.getElementById("searchName").value || "").toLowerCase().trim();
  const { organisation, location, level } = getDirectoryFilterState();

  return directoryData.filter((emp) => {
    const empLoc = emp.mapLocation || emp.location;
    if (nameQuery && !emp.fullName.toLowerCase().includes(nameQuery)) return false;
    if (organisation && emp.organisation !== organisation) return false;
    if (location && empLoc !== location) return false;
    if (level && emp.level !== level) return false;
    return true;
  });
}

/** Cascading logic: for a given field, compute the data filtered by every
 *  OTHER active filter (excluding this field's own value), so its dropdown
 *  only ever offers options that are actually reachable together. */
function optionsForField(field) {
  const { organisation, location, level } = getDirectoryFilterState();
  const nameQuery = (document.getElementById("searchName").value || "").toLowerCase().trim();

  const subset = directoryData.filter((emp) => {
    const empLoc = emp.mapLocation || emp.location;
    if (nameQuery && !emp.fullName.toLowerCase().includes(nameQuery)) return false;
    if (field !== "organisation" && organisation && emp.organisation !== organisation) return false;
    if (field !== "mapLocation" && location && empLoc !== location) return false;
    if (field !== "level" && level && emp.level !== level) return false;
    return true;
  });

  return [...new Set(subset.map((emp) => (field === "mapLocation" ? (emp.mapLocation || emp.location) : emp[field])).filter(Boolean))].sort();
}

/** Rebuilds all three dropdown option lists based on current selections,
 *  keeping the current value selected if it's still valid. */
function refreshDirectoryFilterOptions() {
  fillSelectPreserving("filterOrg", optionsForField("organisation"));
  fillSelectPreserving("filterLocation", optionsForField("mapLocation"));
  fillSelectPreserving("filterLevel", optionsForField("level"));
}

function fillSelectPreserving(id, values) {
  const select = document.getElementById(id);
  if (!select) return;
  const current = select.value;
  const placeholder = select.options[0];

  select.innerHTML = "";
  select.appendChild(placeholder);
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });

  select.value = values.includes(current) ? current : "";
}

/** Renders the table body from a given (already filtered) array. */
function renderTable(rows) {
  const tbody = document.getElementById("empTableBody");
  const countEl = document.getElementById("resultCount");
  if (!tbody) return;

  if (countEl) countEl.textContent = "👥 " + rows.length + " of " + directoryData.length + " employees";

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:28px;text-align:center;color:#5B6B79;">🔍 No employees match these filters.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((emp) => `
    <tr tabindex="0" data-empid="${escapeHtml(emp.empId)}">
      <td class="emp-name-cell" data-label="Name">
        ${escapeHtml(emp.fullName)}
        <span class="emp-sub">${escapeHtml(emp.empId)}</span>
      </td>
      <td class="col-designation" data-label="Designation">${escapeHtml(emp.designation)}</td>
      <td class="col-org" data-label="Organisation">${escapeHtml(emp.organisation)}</td>
      <td class="col-location" data-label="Location"><span class="location-cell-content">📍 ${escapeHtml(emp.mapLocation || emp.location)}</span></td>
      <td class="col-workmode" data-label="Work mode">${workModeBadge(emp.workMode)}</td>
      <td class="col-email" data-label="Email" title="${escapeHtml(emp.officialEmail)}">${escapeHtml(emp.officialEmail)}</td>
      <td class="action-cell"><span class="view-btn">View</span></td>
    </tr>
  `).join("");

  // click / keyboard-enter to open profile
  tbody.querySelectorAll("tr[data-empid]").forEach((tr) => {
    const open = () => { window.location.hash = "#/profile/" + tr.dataset.empid; };
    tr.addEventListener("click", open);
    tr.addEventListener("keydown", (ev) => { if (ev.key === "Enter") open(); });
  });
}

function workModeBadge(mode) {
  if (!mode) return "";
  const lower = mode.toLowerCase();
  let cls = "badge-office", emoji = "🏢";
  if (lower.includes("home")) { cls = "badge-wfh"; emoji = "🏠"; }
  else if (lower.includes("hybrid")) { cls = "badge-hybrid"; emoji = "🔀"; }
  return `<span class="badge-workmode ${cls}">${emoji} ${escapeHtml(mode)}</span>`;
}

function applyDirectoryFilters() {
  refreshDirectoryFilterOptions();
  renderTable(getFilteredDirectoryData());
}

function attachDirectoryEvents() {
  const searchInput = document.getElementById("searchName");
  const orgSelect = document.getElementById("filterOrg");
  const locSelect = document.getElementById("filterLocation");
  const levelSelect = document.getElementById("filterLevel");
  const clearBtn = document.getElementById("clearFilters");

  if (searchInput.dataset.bound) return; // avoid double-binding on data refresh
  searchInput.dataset.bound = "true";

  searchInput.addEventListener("input", applyDirectoryFilters);
  orgSelect.addEventListener("change", applyDirectoryFilters);
  locSelect.addEventListener("change", applyDirectoryFilters);
  levelSelect.addEventListener("change", applyDirectoryFilters);

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    orgSelect.value = "";
    locSelect.value = "";
    levelSelect.value = "";
    applyDirectoryFilters();
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
