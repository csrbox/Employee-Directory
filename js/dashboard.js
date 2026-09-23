/* =========================================================================
   dashboard.js
   Overview page: KPI strip + 6 charts.
   Each chart has its own render function wrapped in try/catch — if one
   chart's data or config has a problem, only that card shows an error;
   every other chart still renders normally.
   ========================================================================= */

const PALETTE = ["#1B75BC", "#8DC63F", "#2CA6A4", "#F2A93B", "#E4572E", "#6C63FF", "#EC4899"];

if (typeof Chart !== "undefined" && typeof ChartDataLabels !== "undefined") {
  try { Chart.register(ChartDataLabels); } catch (_) { }
}

let chartOrgInstance = null;
let chartWorkModeInstance = null;
let chartLevelInstance = null;
let chartTenureInstance = null;
let chartLocationInstance = null;
let chartJoiningInstance = null;

document.addEventListener("data:ready", (e) => {
  const data = e.detail;

  renderKPIs(data);

  // Each chart call is isolated — one failing chart never blocks the rest.
  safeRender("chartOrg", () => renderOrgChart(data));
  safeRender("chartWorkMode", () => renderWorkModeChart(data));
  safeRender("chartLevel", () => renderLevelChart(data));
  safeRender("chartTenure", () => renderTenureChart(data));
  safeRender("chartLocation", () => renderLocationChart(data));
  safeRender("chartJoining", () => renderJoiningTrendChart(data));
});

/** Runs a chart render function; on failure, shows a visible error in that
 *  card instead of a silent blank box, and logs details to the console. */
function safeRender(canvasId, renderFn) {
  try {
    if (typeof Chart === "undefined") {
      throw new Error("Chart.js did not load (check your internet connection / CDN access).");
    }
    if (typeof ChartDataLabels !== "undefined") {
      try { Chart.register(ChartDataLabels); } catch (_) { }
    }
    renderFn();
  } catch (err) {
    console.error("Chart render failed for #" + canvasId, err);
    const canvas = document.getElementById(canvasId);
    const wrap = canvas ? canvas.closest(".chart-canvas-wrap") : null;
    if (wrap) {
      wrap.innerHTML = '<div class="chart-error">⚠️ Couldn\'t draw this chart: ' + escapeHtmlLocal(err.message) + "</div>";
    }
  }
}

function escapeHtmlLocal(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------------------------- KPI STRIP (simplified: 3 tiles) ---------------------------- */
function renderKPIs(data) {
  const orgs = new Set(data.map((d) => d.organisation).filter(Boolean));
  // Use Map Location for unique count
  const locations = new Set(data.map((d) => d.mapLocation).filter(Boolean));

  document.getElementById("kpiTotal").textContent = data.length;
  document.getElementById("kpiOrgs").textContent = orgs.size;
  document.getElementById("kpiLocations").textContent = locations.size;
}

/* ---------------------------- CHART: Headcount by Organisation ---------------------------- */
function renderOrgChart(data) {
  const counts = countBy(data, "organisation");
  // Sort descending by count (highest count first down to lowest)
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map((s) => s[0]);
  const values = sorted.map((s) => s[1]);
  const ctx = document.getElementById("chartOrg");
  if (chartOrgInstance) chartOrgInstance.destroy();

  chartOrgInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: PALETTE[0],
        borderRadius: 6,
        maxBarThickness: 38,
      }],
    },
    options: {
      ...baseBarOptions(),
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement && chartElement[0] ? "pointer" : "default";
      },
      onClick: (event, elements) => {
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const orgName = labels[idx];
        if (!orgName) return;

        const filtered = data.filter((d) => (d.organisation || "Unspecified") === orgName);
        openDrillDownModal({
          title: `🏢 ${orgName}`,
          badgeText: `${filtered.length} Employee${filtered.length !== 1 ? "s" : ""}`,
          employees: filtered,
          columns: [
            { key: "sr", label: "Sr.No" },
            { key: "name", label: "Name" },
            { key: "designation", label: "Designation" },
            { key: "location", label: "Location" },
            { key: "workMode", label: "Work Mode" },
            { key: "email", label: "Email" },
            { key: "action", label: "" },
          ],
        });
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "top",
          offset: 3,
          color: "#1B2A3A",
          font: { family: "Inter", weight: "700", size: 11 },
          formatter: (v) => (v !== undefined && v !== null ? v : ""),
        },
      },
    },
  });
}

/* ---------------------------- CHART: Work Mode ---------------------------- */
function renderWorkModeChart(data) {
  const counts = countBy(data, "workMode");
  const ctx = document.getElementById("chartWorkMode");
  if (chartWorkModeInstance) chartWorkModeInstance.destroy();

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  chartWorkModeInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(counts),
      datasets: [{ data: Object.values(counts), backgroundColor: PALETTE, borderWidth: 0 }],
    },
    options: {
      ...baseDoughnutOptions(),
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { family: "Inter", size: 11.5 }, color: "#1B2A3A", padding: 14, boxWidth: 10 },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const val = context.parsed;
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ` ${context.label}: ${val} (${pct}%)`;
            },
          },
        },
        datalabels: {
          color: "#FFFFFF",
          font: { family: "Inter", weight: "700", size: 12 },
          formatter: (value) => {
            if (!value || total <= 0) return "";
            const pct = Math.round((value / total) * 100);
            return pct > 0 ? `${pct}%` : "";
          },
        },
      },
    },
  });
}

/* ---------------------------- CHART: Designation mix ---------------------------- */
function renderLevelChart(data) {
  const counts = countBy(data, "level");
  // Sort descending: highest count first (top to bottom)
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const badge = document.getElementById("levelCountBadge");
  if (badge) badge.textContent = sorted.length + " designations ↕";

  // Dynamic canvas height based on number of items for smooth vertical scroll
  const wrap = document.getElementById("wrapChartLevel");
  const itemHeight = 32;
  const computedHeight = Math.max(220, sorted.length * itemHeight);
  if (wrap) wrap.style.height = computedHeight + "px";

  const ctx = document.getElementById("chartLevel");
  if (chartLevelInstance) chartLevelInstance.destroy();

  chartLevelInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{
        data: sorted.map((s) => s[1]),
        backgroundColor: PALETTE[2],
        borderRadius: 6,
        maxBarThickness: 22,
      }],
    },
    options: {
      ...baseBarOptions(),
      indexAxis: "y",
      layout: {
        padding: { top: 6, right: 38, left: 0, bottom: 6 },
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement && chartElement[0] ? "pointer" : "default";
      },
      onClick: (event, elements) => {
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const desigLevel = sorted[idx] ? sorted[idx][0] : null;
        if (!desigLevel) return;

        const filtered = data.filter((d) => (d.level || "Unspecified") === desigLevel);
        openDrillDownModal({
          title: `🪪 ${desigLevel}`,
          badgeText: `${filtered.length} Employee${filtered.length !== 1 ? "s" : ""}`,
          employees: filtered,
          columns: [
            { key: "sr", label: "Sr.No" },
            { key: "name", label: "Name" },
            { key: "organisation", label: "Organisation" },
            { key: "location", label: "Location" },
            { key: "workMode", label: "Work Mode" },
            { key: "email", label: "Email" },
            { key: "action", label: "" },
          ],
        });
      },
      scales: {
        x: {
          grid: { color: "#EEF0EC" },
          ticks: { font: { family: "Inter", size: 11 }, color: "#5B6B79", precision: 0 },
          beginAtZero: true,
          grace: "15%",
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { family: "Inter", size: 11.5, weight: "500" },
            color: "#1B2A3A",
            autoSkip: false,
          },
        },
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "right",
          offset: 6,
          color: "#1B2A3A",
          font: { family: "Inter", weight: "700", size: 11 },
          formatter: (v) => (v !== undefined && v !== null ? v : ""),
        },
      },
    },
  });
}

/* ---------------------------- CHART: Experience distribution with CSRBOX ---------------------------- */
function renderTenureChart(data) {
  const buckets = { "0–1 yrs": 0, "1–3 yrs": 0, "3–5 yrs": 0, "5–10 yrs": 0, "10+ yrs": 0 };
  const bucketKeys = Object.keys(buckets);

  data.forEach((d) => {
    const v = d.orgExperience;
    if (v === null || v === undefined || isNaN(v)) return;
    if (v < 1) buckets["0–1 yrs"]++;
    else if (v < 3) buckets["1–3 yrs"]++;
    else if (v < 5) buckets["3–5 yrs"]++;
    else if (v < 10) buckets["5–10 yrs"]++;
    else buckets["10+ yrs"]++;
  });

  const ctx = document.getElementById("chartTenure");
  if (chartTenureInstance) chartTenureInstance.destroy();

  chartTenureInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: bucketKeys,
      datasets: [{
        data: Object.values(buckets),
        backgroundColor: PALETTE[3],
        borderRadius: 6,
        maxBarThickness: 34,
      }],
    },
    options: {
      ...baseBarOptions(),
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement && chartElement[0] ? "pointer" : "default";
      },
      onClick: (event, elements) => {
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const bucket = bucketKeys[idx];
        if (!bucket) return;

        const filtered = data.filter((d) => {
          const v = d.orgExperience;
          if (v === null || v === undefined || isNaN(v)) return false;
          if (bucket === "0–1 yrs") return v < 1;
          if (bucket === "1–3 yrs") return v >= 1 && v < 3;
          if (bucket === "3–5 yrs") return v >= 3 && v < 5;
          if (bucket === "5–10 yrs") return v >= 5 && v < 10;
          if (bucket === "10+ yrs") return v >= 10;
          return false;
        });

        openDrillDownModal({
          title: `⏳ Experience: ${bucket}`,
          badgeText: `${filtered.length} Employee${filtered.length !== 1 ? "s" : ""}`,
          employees: filtered,
          columns: [
            { key: "sr", label: "Sr.No" },
            { key: "name", label: "Name" },
            { key: "organisation", label: "Organisation" },
            { key: "designation", label: "Designation" },
            { key: "orgExp", label: "Exp with CSRBOX" },
            { key: "location", label: "Location" },
            { key: "email", label: "Email" },
            { key: "action", label: "" },
          ],
        });
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "top",
          offset: 3,
          color: "#1B2A3A",
          font: { family: "Inter", weight: "700", size: 11 },
          formatter: (v) => (v !== undefined && v !== null ? v : ""),
        },
      },
    },
  });
}

/* ---------------------------- CHART: Top locations (by Map Location) ---------------------------- */
function renderLocationChart(data) {
  const counts = {};
  data.forEach((d) => {
    if (!d.empId) return;
    const loc = d.mapLocation || "Unspecified";
    counts[loc] = (counts[loc] || 0) + 1;
  });
  // Sort descending: highest count first (top to bottom)
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const badge = document.getElementById("locationCountBadge");
  if (badge) badge.textContent = sorted.length + " locations ↕";

  // Dynamic canvas height based on number of items for smooth vertical scroll
  const wrap = document.getElementById("wrapChartLocation");
  const itemHeight = 32;
  const computedHeight = Math.max(220, sorted.length * itemHeight);
  if (wrap) wrap.style.height = computedHeight + "px";

  const ctx = document.getElementById("chartLocation");
  if (chartLocationInstance) chartLocationInstance.destroy();

  chartLocationInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{
        data: sorted.map((s) => s[1]),
        backgroundColor: PALETTE[4],
        borderRadius: 6,
        maxBarThickness: 22,
      }],
    },
    options: {
      ...baseBarOptions(),
      indexAxis: "y",
      layout: {
        padding: { top: 6, right: 38, left: 0, bottom: 6 },
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement && chartElement[0] ? "pointer" : "default";
      },
      onClick: (event, elements) => {
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const locName = sorted[idx] ? sorted[idx][0] : null;
        if (!locName) return;

        const filtered = data.filter((d) => (d.mapLocation || d.location || "Unspecified") === locName);
        openDrillDownModal({
          title: `📍 ${locName}`,
          badgeText: `${filtered.length} Employee${filtered.length !== 1 ? "s" : ""}`,
          employees: filtered,
          columns: [
            { key: "sr", label: "Sr.No" },
            { key: "name", label: "Name" },
            { key: "organisation", label: "Organisation" },
            { key: "designation", label: "Designation" },
            { key: "workMode", label: "Work Mode" },
            { key: "email", label: "Email" },
            { key: "action", label: "" },
          ],
        });
      },
      scales: {
        x: {
          grid: { color: "#EEF0EC" },
          ticks: { font: { family: "Inter", size: 11 }, color: "#5B6B79", precision: 0 },
          beginAtZero: true,
          grace: "15%",
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { family: "Inter", size: 11.5, weight: "500" },
            color: "#1B2A3A",
            autoSkip: false,
          },
        },
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "right",
          offset: 6,
          color: "#1B2A3A",
          font: { family: "Inter", weight: "700", size: 11 },
          formatter: (v) => (v !== undefined && v !== null ? v : ""),
        },
      },
    },
  });
}

/* ---------------------------- CHART: Joining trend ---------------------------- */
function renderJoiningTrendChart(data) {
  // Calendar Quarter Mapping:
  // Q1: January, February, March (months 0, 1, 2)
  // Q2: April, May, June (months 3, 4, 5)
  // Q3: July, August, September (months 6, 7, 8)
  // Q4: October, November, December (months 9, 10, 11)
  const counts = {};
  data.forEach((d) => {
    if (!d.joiningDate) return;
    const year = d.joiningDate.getFullYear();
    const qNum = Math.floor(d.joiningDate.getMonth() / 3) + 1;
    const key = `${year}-Q${qNum}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  const quarterMonths = {
    "1": "Jan–Mar",
    "2": "Apr–Jun",
    "3": "Jul–Sep",
    "4": "Oct–Dec",
  };

  const sortedKeys = Object.keys(counts).sort();
  const displayLabels = sortedKeys.map((key) => {
    const [year, qPart] = key.split("-");
    return `${qPart} ${year}`;
  });

  const ctx = document.getElementById("chartJoining");
  if (chartJoiningInstance) chartJoiningInstance.destroy();

  chartJoiningInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: displayLabels,
      datasets: [{
        data: sortedKeys.map((k) => counts[k]),
        borderColor: PALETTE[5],
        backgroundColor: "rgba(108,99,255,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: PALETTE[5],
      }],
    },
    options: {
      ...baseBarOptions(),
      layout: {
        padding: { top: 22, right: 16, left: 0, bottom: 0 },
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement && chartElement[0] ? "pointer" : "default";
      },
      onClick: (event, elements) => {
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const key = sortedKeys[idx];
        const displayLabel = displayLabels[idx];
        if (!key) return;

        const filtered = data.filter((d) => {
          if (!d.joiningDate) return false;
          const year = d.joiningDate.getFullYear();
          const qNum = Math.floor(d.joiningDate.getMonth() / 3) + 1;
          return `${year}-Q${qNum}` === key;
        });

        openDrillDownModal({
          title: `📈 Joined in ${displayLabel}`,
          badgeText: `${filtered.length} Employee${filtered.length !== 1 ? "s" : ""}`,
          employees: filtered,
          columns: [
            { key: "sr", label: "Sr.No" },
            { key: "name", label: "Name" },
            { key: "organisation", label: "Organisation" },
            { key: "designation", label: "Designation" },
            { key: "joiningDate", label: "Date of Joining" },
            { key: "location", label: "Location" },
            { key: "email", label: "Email" },
            { key: "action", label: "" },
          ],
        });
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "Inter", size: 11 }, color: "#5B6B79" } },
        y: {
          grid: { color: "#EEF0EC" },
          ticks: { font: { family: "Inter", size: 11 }, color: "#5B6B79", precision: 0 },
          beginAtZero: true,
          grace: "18%",
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (items) {
              if (!items.length) return "";
              const idx = items[0].dataIndex;
              const key = sortedKeys[idx];
              if (!key) return "";
              const [year, qPart] = key.split("-");
              const qNum = qPart.replace("Q", "");
              return `${qPart} ${year} (${quarterMonths[qNum] || ""})`;
            },
            label: function (context) {
              const val = context.parsed.y;
              return ` ${val} employee${val !== 1 ? "s" : ""} joined (Click to view)`;
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "top",
          offset: 6,
          color: PALETTE[5],
          font: { family: "Inter", weight: "700", size: 11 },
          formatter: (v) => (v !== undefined && v !== null ? v : ""),
        },
      },
    },
  });
}

/* =========================================================================
   DRILL-DOWN MODAL LOGIC
   ========================================================================= */
let currentModalEmployees = [];
let currentModalColumns = [];

function openDrillDownModal({ title, badgeText, employees, columns }) {
  currentModalEmployees = employees || [];
  currentModalColumns = columns || [];

  const modalEl = document.getElementById("drillDownModal");
  const titleEl = document.getElementById("modalTitle");
  const badgeEl = document.getElementById("modalCountBadge");
  const searchInput = document.getElementById("modalSearchInput");

  if (titleEl) titleEl.textContent = title;
  if (badgeEl) badgeEl.textContent = badgeText;
  if (searchInput) searchInput.value = "";

  renderModalTable(currentModalEmployees);

  if (modalEl) {
    modalEl.style.display = "flex";
    requestAnimationFrame(() => {
      modalEl.classList.add("open");
    });
  }

  attachModalEventListeners();
}

function closeDrillDownModal() {
  const modalEl = document.getElementById("drillDownModal");
  if (!modalEl) return;
  modalEl.classList.remove("open");
  setTimeout(() => {
    modalEl.style.display = "none";
  }, 220);
}

function renderModalTable(employeesList) {
  const thead = document.getElementById("modalTableHead");
  const tbody = document.getElementById("modalTableBody");
  const showingEl = document.getElementById("modalShowingCount");

  if (showingEl) {
    showingEl.textContent = `Showing ${employeesList.length} of ${currentModalEmployees.length}`;
  }

  if (thead) {
    thead.innerHTML = `<tr>${currentModalColumns.map((col) => `<th>${escapeHtmlLocal(col.label)}</th>`).join("")}</tr>`;
  }

  if (!tbody) return;

  if (employeesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${currentModalColumns.length}" style="text-align:center;padding:32px;color:#64748B;">No employees found matching your search.</td></tr>`;
    return;
  }

  tbody.innerHTML = employeesList
    .map((emp, index) => {
      return `
      <tr data-empid="${escapeHtmlLocal(emp.empId)}" tabindex="0">
        ${currentModalColumns
          .map((col) => {
            switch (col.key) {
              case "sr":
                return `<td class="col-sr">${index + 1}</td>`;
              case "name":
                return `
                  <td class="col-drill-name">
                    ${escapeHtmlLocal(emp.fullName)}
                    <span class="drill-empid">${escapeHtmlLocal(emp.empId)}</span>
                  </td>`;
              case "organisation":
                return `<td>${escapeHtmlLocal(emp.organisation || "—")}</td>`;
              case "designation":
                return `<td>${escapeHtmlLocal(emp.designation || "—")}</td>`;
              case "location":
                return `<td>📍 ${escapeHtmlLocal(emp.mapLocation || emp.location || "—")}</td>`;
              case "workMode":
                return `<td>${workModePill(emp.workMode)}</td>`;
              case "orgExp":
                return `<td>${escapeHtmlLocal(emp.orgExperienceFormatted || (emp.orgExperience !== null ? emp.orgExperience + " yrs" : "—"))}</td>`;
              case "joiningDate":
                return `<td>📅 ${escapeHtmlLocal(emp.joiningDateRaw || "—")}</td>`;
              case "email":
                return emp.officialEmail
                  ? `<td><a class="drill-email-link" href="mailto:${escapeHtmlLocal(emp.officialEmail)}" onclick="event.stopPropagation();">${escapeHtmlLocal(emp.officialEmail)}</a></td>`
                  : `<td>—</td>`;
              case "action":
                return `<td><span class="drilldown-view-btn">View</span></td>`;
              default:
                return `<td>${escapeHtmlLocal(emp[col.key] || "—")}</td>`;
            }
          })
          .join("")}
      </tr>`;
    })
    .join("");

  // Click row or View to open profile
  tbody.querySelectorAll("tr[data-empid]").forEach((row) => {
    const empId = row.dataset.empid;
    const goToProfile = () => {
      closeDrillDownModal();
      window.location.hash = "#/profile/" + empId;
    };
    row.addEventListener("click", goToProfile);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter") goToProfile();
    });
  });
}

function workModePill(mode) {
  if (!mode) return "—";
  const lower = mode.toLowerCase();
  let emoji = "🏢";
  if (lower.includes("home")) emoji = "🏠";
  else if (lower.includes("hybrid")) emoji = "🔀";
  return `${emoji} ${escapeHtmlLocal(mode)}`;
}

let modalListenersAttached = false;
function attachModalEventListeners() {
  if (modalListenersAttached) return;
  modalListenersAttached = true;

  const modalEl = document.getElementById("drillDownModal");
  const closeBtn = document.getElementById("modalCloseBtn");
  const searchInput = document.getElementById("modalSearchInput");

  if (closeBtn) {
    closeBtn.addEventListener("click", closeDrillDownModal);
  }

  if (modalEl) {
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) {
        closeDrillDownModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDrillDownModal();
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase().trim();
      if (!q) {
        renderModalTable(currentModalEmployees);
        return;
      }
      const filtered = currentModalEmployees.filter((emp) => {
        return (
          (emp.fullName && emp.fullName.toLowerCase().includes(q)) ||
          (emp.empId && emp.empId.toLowerCase().includes(q)) ||
          (emp.designation && emp.designation.toLowerCase().includes(q)) ||
          (emp.officialEmail && emp.officialEmail.toLowerCase().includes(q)) ||
          (emp.location && emp.location.toLowerCase().includes(q)) ||
          (emp.organisation && emp.organisation.toLowerCase().includes(q))
        );
      });
      renderModalTable(filtered);
    });
  }
}

/* ---------------------------- shared helpers ---------------------------- */
function countBy(data, field) {
  const counts = {};
  data.forEach((d) => {
    const key = d[field] || "Unspecified";
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function baseBarOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 18, right: 12, left: 0, bottom: 0 },
    },
    plugins: {
      legend: { display: false },
      datalabels: {
        color: "#1B2A3A",
        anchor: "end",
        align: "top",
        offset: 2,
        font: { family: "Inter", weight: "700", size: 11 },
        formatter: (val) => (val !== undefined && val !== null ? val : ""),
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: "Inter", size: 11 }, color: "#5B6B79" } },
      y: {
        grid: { color: "#EEF0EC" },
        ticks: { font: { family: "Inter", size: 11 }, color: "#5B6B79", precision: 0 },
        beginAtZero: true,
        grace: "12%",
      },
    },
  };
}

function baseDoughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { font: { family: "Inter", size: 11.5 }, color: "#1B2A3A", padding: 14, boxWidth: 10 },
      },
      datalabels: {
        color: "#FFFFFF",
        font: { family: "Inter", weight: "700", size: 12 },
        formatter: (value) => (value > 0 ? value : ""),
      },
    },
  };
}

