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

let directoryCurrentPage = 1;
const DIRECTORY_PAGE_SIZE = 20;
let lastFilteredDirectoryRows = [];

/** Renders the table body from a given (already filtered) array with pagination. */
function renderTable(rows) {
  lastFilteredDirectoryRows = rows || [];
  const tbody = document.getElementById("empTableBody");
  const countEl = document.getElementById("resultCount");
  const summaryEl = document.getElementById("directoryPaginationSummary");
  const paginationEl = document.getElementById("directoryPagination");
  if (!tbody) return;

  const totalItems = lastFilteredDirectoryRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / DIRECTORY_PAGE_SIZE));

  if (directoryCurrentPage > totalPages) {
    directoryCurrentPage = totalPages;
  }
  if (directoryCurrentPage < 1) {
    directoryCurrentPage = 1;
  }

  const startIndex = (directoryCurrentPage - 1) * DIRECTORY_PAGE_SIZE;
  const pageRows = lastFilteredDirectoryRows.slice(startIndex, startIndex + DIRECTORY_PAGE_SIZE);

  if (countEl) {
    countEl.innerHTML = `<i class="bi bi-people-fill text-primary me-1"></i><strong>${totalItems}</strong> matching employees (of ${directoryData.length} total)`;
  }

  if (summaryEl) {
    if (totalItems > 0) {
      summaryEl.textContent = `Page ${directoryCurrentPage} of ${totalPages} (Showing ${startIndex + 1}–${Math.min(startIndex + DIRECTORY_PAGE_SIZE, totalItems)})`;
    } else {
      summaryEl.textContent = "";
    }
  }

  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:36px;text-align:center;color:#64748B;"><i class="bi bi-search me-2" style="font-size:18px;"></i>No employees match these filters.</td></tr>';
    if (paginationEl) paginationEl.innerHTML = "";
    return;
  }

  tbody.innerHTML = pageRows.map((emp) => `
    <tr tabindex="0" data-empid="${escapeHtml(emp.empId)}">
      <td class="emp-name-cell" data-label="Name">
        ${escapeHtml(emp.fullName)}
        <span class="emp-sub">${escapeHtml(emp.empId)}</span>
      </td>
      <td class="col-designation" data-label="Designation">${escapeHtml(emp.designation)}</td>
      <td class="col-org" data-label="Organisation">${escapeHtml(emp.organisation)}</td>
      <td class="col-location" data-label="Location"><span class="location-cell-content"><i class="bi bi-geo-alt-fill text-danger me-1"></i>${escapeHtml(emp.mapLocation || emp.location)}</span></td>
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

  renderPaginationControls(paginationEl, totalPages, directoryCurrentPage);
}

function renderPaginationControls(container, totalPages, current) {
  if (!container) return;
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = '<nav aria-label="Directory pagination"><ul class="pagination pagination-sm mb-0 gap-1">';

  // Previous button
  html += `<li class="page-item ${current === 1 ? 'disabled' : ''}">
    <button class="page-link" type="button" ${current === 1 ? 'disabled' : ''} onclick="goToDirectoryPage(${current - 1})" aria-label="Previous">
      <i class="bi bi-chevron-left"></i>
    </button>
  </li>`;

  // Page numbers logic (max 7 visible)
  let pages = [];
  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p++) pages.push(p);
  } else {
    pages.push(1);
    if (current > 3) pages.push("...");
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    for (let p = start; p <= end; p++) pages.push(p);
    if (current < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  pages.forEach((p) => {
    if (p === "...") {
      html += '<li class="page-item disabled"><span class="page-link">…</span></li>';
    } else {
      const active = p === current ? "active" : "";
      html += `<li class="page-item ${active}"><button class="page-link" type="button" onclick="goToDirectoryPage(${p})">${p}</button></li>`;
    }
  });

  // Next button
  html += `<li class="page-item ${current === totalPages ? 'disabled' : ''}">
    <button class="page-link" type="button" ${current === totalPages ? 'disabled' : ''} onclick="goToDirectoryPage(${current + 1})" aria-label="Next">
      <i class="bi bi-chevron-right"></i>
    </button>
  </li>`;

  html += '</ul></nav>';
  container.innerHTML = html;
}

window.goToDirectoryPage = function (page) {
  directoryCurrentPage = page;
  renderTable(lastFilteredDirectoryRows);
  const tableWrap = document.querySelector(".table-wrap");
  if (tableWrap) tableWrap.scrollTop = 0;
};

function workModeBadge(mode) {
  if (!mode) return "";
  const lower = mode.toLowerCase();
  let cls = "badge-office", icon = '<i class="bi bi-buildings me-1"></i>';
  if (lower.includes("home")) { cls = "badge-wfh"; icon = '<i class="bi bi-house-door-fill me-1"></i>'; }
  else if (lower.includes("hybrid")) { cls = "badge-hybrid"; icon = '<i class="bi bi-shuffle me-1"></i>'; }
  return `<span class="badge-workmode ${cls}">${icon}${escapeHtml(mode)}</span>`;
}

function applyDirectoryFilters() {
  directoryCurrentPage = 1;
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
