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
let chartGenderInstance = null;
let chartLevelInstance = null;
let chartTenureInstance = null;
let chartLocationInstance = null;
// let chartJoiningInstance = null; // Commented out as requested
let leafletMapInstance = null;

document.addEventListener("data:ready", (e) => {
  const data = e.detail;

  renderKPIs(data);

  // Each chart call is isolated — one failing chart never blocks the rest.
  safeRender("chartOrg", () => renderOrgChart(data));
  safeRender("chartWorkMode", () => renderWorkModeChart(data));
  safeRender("chartGender", () => renderGenderChart(data));
  safeRender("chartLevel", () => renderLevelChart(data));
  safeRender("chartTenure", () => renderTenureChart(data));
  safeRender("chartLocation", () => renderLocationChart(data));
  safeRenderMap("indiaMap", () => renderIndiaMap(data));
  // safeRender("chartJoining", () => renderJoiningTrendChart(data)); // Commented out
});

/** Safely runs map rendering logic */
function safeRenderMap(containerId, renderFn) {
  try {
    if (typeof L === "undefined") {
      throw new Error("Leaflet.js map library is still loading or could not be reached.");
    }
    renderFn();
  } catch (err) {
    console.error("Map render failed for #" + containerId, err);
    const el = document.getElementById(containerId);
    if (el) {
      el.innerHTML = '<div class="chart-error" style="padding:24px;text-align:center;">⚠️ Couldn\'t load India Map: ' + escapeHtmlLocal(err.message) + '</div>';
    }
  }
}

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

  const labels = Object.keys(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  chartWorkModeInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{ data: Object.values(counts), backgroundColor: PALETTE, borderWidth: 0 }],
    },
    options: {
      ...baseDoughnutOptions(),
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement && chartElement[0] ? "pointer" : "default";
      },
      onClick: (event, elements) => {
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const mode = labels[idx];
        if (!mode) return;

        const filtered = data.filter((d) => (d.workMode || "Unspecified") === mode);
        openDrillDownModal({
          title: `💼 Work Mode: ${mode}`,
          badgeText: `${filtered.length} Employee${filtered.length !== 1 ? "s" : ""}`,
          employees: filtered,
          columns: [
            { key: "sr", label: "Sr.No" },
            { key: "name", label: "Name" },
            { key: "organisation", label: "Organisation" },
            { key: "designation", label: "Designation" },
            { key: "location", label: "Location" },
            { key: "email", label: "Email" },
            { key: "action", label: "" },
          ],
        });
      },
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
              return ` ${context.label}: ${val} (${pct}%) (Click to view)`;
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

/* ---------------------------- CHART: Gender proportion ---------------------------- */
function renderGenderChart(data) {
  const counts = countBy(data, "gender");
  const ctx = document.getElementById("chartGender");
  if (chartGenderInstance) chartGenderInstance.destroy();

  const labels = Object.keys(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Female = Rose/Pink, Male = Brand Blue, Other = Amber/Slate
  const GENDER_PALETTE = labels.map((l) => {
    const low = l.toLowerCase();
    if (low.includes("female") || low === "f") return "#EC4899";
    if (low.includes("male") || low === "m") return "#1B75BC";
    return "#F2A93B";
  });

  chartGenderInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{ data: Object.values(counts), backgroundColor: GENDER_PALETTE, borderWidth: 0 }],
    },
    options: {
      ...baseDoughnutOptions(),
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement && chartElement[0] ? "pointer" : "default";
      },
      onClick: (event, elements) => {
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const genderVal = labels[idx];
        if (!genderVal) return;

        const filtered = data.filter((d) => (d.gender || "Unspecified") === genderVal);
        openDrillDownModal({
          title: `👤 Gender: ${genderVal}`,
          badgeText: `${filtered.length} Employee${filtered.length !== 1 ? "s" : ""}`,
          employees: filtered,
          columns: [
            { key: "sr", label: "Sr.No" },
            { key: "name", label: "Name" },
            { key: "organisation", label: "Organisation" },
            { key: "designation", label: "Designation" },
            { key: "location", label: "Location" },
            { key: "workMode", label: "Work Mode" },
            { key: "email", label: "Email" },
            { key: "action", label: "" },
          ],
        });
      },
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
              return ` ${context.label}: ${val} (${pct}%) (Click to view)`;
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

/* ---------------------------- CHART: India Map Presence ---------------------------- */
const INDIA_CITY_COORDINATES = {
  // Major Metros & Hubs
  "ahmedabad": [23.0225, 72.5714],
  "pune": [18.5204, 73.8567],
  "hyderabad": [17.3850, 78.4867],
  "mumbai": [19.0760, 72.8777],
  "delhi": [28.6139, 77.2090],
  "new delhi": [28.6139, 77.2090],
  "ncr": [28.6139, 77.2090],
  "bengaluru": [12.9716, 77.5946],
  "bangalore": [12.9716, 77.5946],
  "chennai": [13.0827, 80.2707],
  "kolkata": [22.5726, 88.3639],

  // Gujarat
  "vadodara": [22.3072, 73.1812],
  "baroda": [22.3072, 73.1812],
  "surat": [21.1702, 72.8311],
  "rajkot": [22.3039, 70.8022],
  "gandhinagar": [23.2156, 72.6369],
  "bhavnagar": [21.7645, 72.1519],
  "jamnagar": [22.4707, 70.0577],
  "junagadh": [21.5222, 70.4579],
  "anand": [22.5645, 72.9289],
  "bharuch": [21.7051, 72.9959],
  "navsari": [20.9467, 72.9520],
  "morbi": [22.8120, 70.8377],
  "vapi": [20.3893, 72.9106],
  "mehsana": [23.5880, 72.3693],
  "bhuj": [23.2420, 69.6669],
  "kutch": [23.2420, 69.6669],
  "porbandar": [21.6417, 69.6293],
  "valsad": [20.5992, 72.9342],
  "palanpur": [24.1724, 72.4346],
  "himatnagar": [23.5977, 72.9698],

  // Maharashtra
  "nagpur": [21.1458, 79.0882],
  "nashik": [19.9975, 73.7898],
  "thane": [19.2183, 72.9781],
  "navi mumbai": [19.0330, 73.0297],
  "aurangabad": [19.8762, 75.3433],
  "chhatrapati sambhajinagar": [19.8762, 75.3433],
  "solapur": [17.6599, 75.9064],
  "kolhapur": [16.7050, 74.2433],
  "amravati": [20.9374, 77.7796],
  "nanded": [19.1383, 77.3210],
  "sangli": [16.8524, 74.5815],
  "jalgaon": [21.0077, 75.5626],
  "akola": [20.7002, 77.0082],
  "latur": [18.4088, 76.5604],
  "dhule": [20.9042, 74.7749],
  "ahmednagar": [19.0952, 74.7496],
  "satara": [17.6805, 73.9997],

  // Rajasthan
  "jaipur": [26.9124, 75.7873],
  "jodhpur": [26.2389, 73.0243],
  "udaipur": [24.5854, 73.7125],
  "kota": [25.2138, 75.8648],
  "bikaner": [28.0229, 73.3119],
  "ajmer": [26.4499, 74.6399],
  "bhilwara": [25.3470, 74.6408],
  "alwar": [27.5530, 76.6346],
  "sikar": [27.6094, 75.1398],
  "bharatpur": [27.2152, 77.5030],

  // Uttar Pradesh & Uttarakhand
  "lucknow": [26.8467, 80.9462],
  "kanpur": [26.4499, 80.3319],
  "varanasi": [25.3176, 82.9739],
  "agra": [27.1767, 78.0081],
  "prayagraj": [25.4358, 81.8463],
  "allahabad": [25.4358, 81.8463],
  "noida": [28.5355, 77.3910],
  "greater noida": [28.4744, 77.5040],
  "ghaziabad": [28.6692, 77.4538],
  "meerut": [28.9845, 77.7064],
  "aligarh": [27.8974, 78.0880],
  "bareilly": [28.3670, 79.4304],
  "gorakhpur": [26.7606, 83.3732],
  "jhansi": [25.4484, 78.5685],
  "ayodhya": [26.7922, 82.1998],
  "dehradun": [30.3165, 78.0322],
  "haridwar": [29.9457, 78.1642],
  "rishikesh": [30.0869, 78.2676],

  // Madhya Pradesh & Chhattisgarh
  "bhopal": [23.2599, 77.4126],
  "indore": [22.7196, 75.8577],
  "jabalpur": [23.1815, 79.9864],
  "gwalior": [26.2183, 78.1828],
  "ujjain": [23.1765, 75.7885],
  "raipur": [21.2514, 81.6296],
  "bhilai": [21.1938, 81.3509],
  "bilaspur": [22.0797, 82.1409],

  // South India
  "secunderabad": [17.4399, 78.4983],
  "warangal": [17.9689, 79.5941],
  "visakhapatnam": [17.6868, 83.2185],
  "vizag": [17.6868, 83.2185],
  "vijayawada": [16.5062, 80.6480],
  "guntur": [16.3067, 80.4365],
  "tirupati": [13.6288, 79.4192],
  "mysuru": [12.2958, 76.6394],
  "mysore": [12.2958, 76.6394],
  "mangaluru": [12.9141, 74.8560],
  "mangalore": [12.9141, 74.8560],
  "hubli": [15.3647, 75.1240],
  "belagavi": [15.8497, 74.4977],
  "coimbatore": [11.0168, 76.9558],
  "madurai": [9.9252, 78.1198],
  "trichy": [10.7905, 78.7047],
  "salem": [11.6643, 78.1460],
  "kochi": [9.9312, 76.2673],
  "cochin": [9.9312, 76.2673],
  "thiruvananthapuram": [8.5241, 76.9366],
  "kozhikode": [11.2588, 75.7804],

  // East & North East
  "patna": [25.5941, 85.1376],
  "ranchi": [23.3441, 85.3096],
  "jamshedpur": [22.8046, 86.2029],
  "dhanbad": [23.7957, 86.4304],
  "bhubaneswar": [20.2961, 85.8245],
  "cuttack": [20.4625, 85.8828],
  "howrah": [22.5958, 88.2636],
  "siliguri": [26.7271, 88.3953],
  "guwahati": [26.1445, 91.7362],
  "shillong": [25.5788, 91.8933],
  "agartala": [23.8315, 91.2868],
  "imphal": [24.8170, 93.9368],

  // North & Other
  "chandigarh": [30.7333, 76.7794],
  "ludhiana": [30.9010, 75.8573],
  "amritsar": [31.6340, 74.8723],
  "gurugram": [28.4595, 77.0266],
  "gurgaon": [28.4595, 77.0266],
  "faridabad": [28.4089, 77.3178],
  // South & Central Additional Hubs from Dataset
  "balaghat": [21.8049, 80.1849],
  "baihar": [22.0991, 80.5489],
  "balaghat baihar": [21.8049, 80.1849],
  "bankura": [23.2324, 87.0715],
  "baramati": [18.1519, 74.5770],
  "barwani": [22.0371, 74.9038],
  "bhubaneshwar": [20.2961, 85.8245],
  "birbhum": [23.8402, 87.6186],
  "chhindwara": [22.0574, 78.9382],
  "chittorgarh": [24.8887, 74.6269],
  "dungarpur": [23.8385, 73.7149],
  "hamirpur": [31.6862, 76.5213],
  "hardoi": [27.3989, 80.1311],
  "hisar": [29.1492, 75.7217],
  "hosur": [12.7409, 77.8253],
  "jagdalpur": [19.0734, 82.0287],
  "karnal": [29.6857, 76.9905],
  "khammam": [17.2473, 80.1514],
  "khojbal": [22.8000, 79.5000],
  "kurukshetra": [29.9695, 76.8783],
  "malegaon": [20.5579, 74.5287],
  "nandurbar": [21.3705, 74.2415],
  "narnaul": [28.0444, 76.1070],
  "mahendragarh": [28.2771, 76.1517],
  "narnaul mahendragarh": [28.0444, 76.1070],
  "nizamabad": [18.6725, 78.0941],
  "panchkula": [30.6942, 76.8606],
  "raichur": [16.2076, 77.3463],
  "rangareddy": [17.3370, 78.4980],
  "rourkela": [22.2604, 84.8536],
  "sanand": [22.9868, 72.3813],
  "sangareddy": [17.6190, 78.0814],
  "sendhwa": [21.6847, 75.0931],
  "sonipat": [28.9931, 77.0151],
  "surgana": [20.5739, 73.6197],
  "thoothukudi": [8.7642, 78.1348],
  "trivandrum": [8.5241, 76.9366],
  "tumkur": [13.3409, 77.1010],
  "yamunanagar": [30.1290, 77.2674],
  "shimla": [31.1048, 77.1734],
  "jammu": [32.7266, 74.8570],
  "srinagar": [34.0837, 74.7973],
  "goa": [15.2993, 74.1240],
  "panaji": [15.4909, 73.8278],
  "puducherry": [11.9416, 79.8083],
};

// State capital fallbacks for state-level designations
const STATE_FALLBACK_COORDS = {
  "gujarat": [23.2156, 72.6369],
  "maharashtra": [19.0760, 72.8777],
  "telangana": [17.3850, 78.4867],
  "karnataka": [12.9716, 77.5946],
  "tamil nadu": [13.0827, 80.2707],
  "rajasthan": [26.9124, 75.7873],
  "madhya pradesh": [23.2599, 77.4126],
  "uttar pradesh": [26.8467, 80.9462],
  "delhi": [28.6139, 77.2090],
  "west bengal": [22.5726, 88.3639],
  "bihar": [25.5941, 85.1376],
  "odisha": [20.2961, 85.8245],
  "kerala": [8.5241, 76.9366],
  "punjab": [30.7333, 76.7794],
  "haryana": [30.7333, 76.7794],
  "assam": [26.1445, 91.7362],
};

function getCoordinatesForLocation(locStr) {
  if (!locStr) return null;
  const raw = String(locStr).toLowerCase().trim();
  // Strip out punctuation and common noisy suffixes
  const clean = raw.replace(/[(),.\-\/]/g, " ").replace(/\s+/g, " ").trim();

  // 1. Direct match
  if (INDIA_CITY_COORDINATES[clean]) return INDIA_CITY_COORDINATES[clean];

  // 2. City substring match
  for (const city in INDIA_CITY_COORDINATES) {
    if (clean.includes(city) || city.includes(clean)) {
      return INDIA_CITY_COORDINATES[city];
    }
  }

  // 3. Multi-word individual token match
  const parts = clean.split(" ");
  for (const part of parts) {
    if (part.length >= 4 && INDIA_CITY_COORDINATES[part]) {
      return INDIA_CITY_COORDINATES[part];
    }
  }

  // 4. State fallback
  for (const state in STATE_FALLBACK_COORDS) {
    if (clean.includes(state)) {
      return STATE_FALLBACK_COORDS[state];
    }
  }

  // 5. Stable pseudo-geographic fallback near Central India
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) & 0xffffffff;
  const latOffset = ((Math.abs(hash) % 40) - 20) * 0.12;
  const lngOffset = ((Math.abs(hash >> 5) % 40) - 20) * 0.12;
  return [22.5 + latOffset, 78.5 + lngOffset];
}

// Current active basemap layer type
let currentMapLayerType = "satellite";
let activeBaseLayers = [];
let activeMaskLayer = null;
let mapMarkerList = [];

function renderIndiaMap(data) {
  const container = document.getElementById("indiaMap");
  if (!container || typeof L === "undefined") return;

  const locationCounts = {};
  data.forEach((d) => {
    if (!d.empId) return;
    const loc = (d.mapLocation || d.location || "Unspecified").trim();
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
  });

  if (leafletMapInstance) {
    leafletMapInstance.remove();
    leafletMapInstance = null;
  }

  // India geographic bounds
  const indiaBounds = [
    [7.0, 68.0],   // Southwest corner (Kanyakumari / Lakshadweep)
    [35.8, 97.5]   // Northeast corner (Kashmir / Arunachal)
  ];
  const maxBounds = [
    [5.5, 66.0],
    [37.5, 99.0]
  ];

  leafletMapInstance = L.map("indiaMap", {
    center: [22.5, 80.0],
    zoom: 4.6,
    minZoom: 4.2,
    maxZoom: 12,
    maxBounds: maxBounds,
    maxBoundsViscosity: 1.0, // Strictly keep user inside India viewport
    zoomSnap: 0.25,
    scrollWheelZoom: false,
    zoomControl: true,
  });
  window.leafletMapInstance = leafletMapInstance;

  // Fit view strictly to India
  leafletMapInstance.fitBounds(indiaBounds, { padding: [10, 10] });

  // Function to apply basemap tiles
  function setMapBasemap(type) {
    currentMapLayerType = type;
    // Clear existing basemap layers
    activeBaseLayers.forEach((l) => leafletMapInstance.removeLayer(l));
    activeBaseLayers = [];

    if (type === "satellite") {
      // 100% Free ArcGIS World Imagery Satellite - NO API Key, NO watermark
      const satLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Tiles &copy; Esri &mdash; Satellite',
        maxZoom: 19,
      }).addTo(leafletMapInstance);

      // Boundaries & City Labels overlay
      const labelLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
      }).addTo(leafletMapInstance);

      activeBaseLayers.push(satLayer, labelLayer);
    } else {
      // Free OpenStreetMap Standard - Streets
      const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(leafletMapInstance);

      activeBaseLayers.push(osmLayer);
    }

    // Update mask layer style to match basemap theme
    if (activeMaskLayer) {
      if (type === "satellite") {
        activeMaskLayer.setStyle({
          fillColor: "#0B1120",
          fillOpacity: 0.94,
          color: "#F59E0B", // Glowing Amber/Gold India Border
          weight: 2,
        });
      } else {
        activeMaskLayer.setStyle({
          fillColor: "#F1F5F9",
          fillOpacity: 0.90,
          color: "#1B75BC", // Brand Blue India Border
          weight: 2,
        });
      }
    }

    // Update marker styling
    mapMarkerList.forEach(({ marker }) => {
      if (type === "satellite") {
        marker.setStyle({
          fillColor: "#F59E0B",
          color: "#FFFFFF",
          weight: 2.2,
          fillOpacity: 0.92,
        });
      } else {
        marker.setStyle({
          fillColor: "#1B75BC",
          color: "#FFFFFF",
          weight: 2,
          fillOpacity: 0.85,
        });
      }
    });

    // Bring mask and markers to front above tile layer
    if (activeMaskLayer) activeMaskLayer.bringToFront();
    mapMarkerList.forEach(({ marker }) => marker.bringToFront());
  }

  // Load and apply Inverted India Mask (masks out Pakistan, China, Nepal, oceans so ONLY India is drawn)
  fetch("./data/india-mask.json")
    .then((res) => {
      if (!res.ok) throw new Error("Could not load india-mask.json");
      return res.json();
    })
    .then((maskGeojson) => {
      activeMaskLayer = L.geoJSON(maskGeojson, {
        style: {
          fillColor: currentMapLayerType === "satellite" ? "#0B1120" : "#F1F5F9",
          fillOpacity: currentMapLayerType === "satellite" ? 0.94 : 0.90,
          color: currentMapLayerType === "satellite" ? "#F59E0B" : "#1B75BC",
          weight: 2,
          opacity: 1,
        },
        interactive: false,
      }).addTo(leafletMapInstance);
      activeMaskLayer.bringToFront();
      mapMarkerList.forEach(({ marker }) => marker.bringToFront());
    })
    .catch((err) => {
      console.warn("India boundary mask load note:", err.message);
    });

  // Apply default basemap (Satellite)
  setMapBasemap("satellite");

  // Render Circle Markers for every location
  mapMarkerList = [];
  const entries = Object.entries(locationCounts);
  if (!entries.length) return;

  const maxCount = Math.max(...entries.map((e) => e[1]), 1);

  entries.forEach(([locName, count]) => {
    const coords = getCoordinatesForLocation(locName);
    if (!coords) return;

    // Radius scaled between 6.5px and 24px
    const radius = Math.max(6.5, Math.min(24, 6.5 + Math.sqrt(count / maxCount) * 17.5));

    const isSat = currentMapLayerType === "satellite";
    const defaultColor = isSat ? "#F59E0B" : "#1B75BC";

    const marker = L.circleMarker(coords, {
      radius: radius,
      fillColor: defaultColor,
      color: "#FFFFFF",
      weight: isSat ? 2.2 : 2,
      opacity: 1,
      fillOpacity: isSat ? 0.92 : 0.85,
      className: "map-marker-pulse",
    }).addTo(leafletMapInstance);

    marker.bindTooltip(
      `<strong>📍 ${escapeHtmlLocal(locName)}</strong><br>${count} Employee${count !== 1 ? "s" : ""} (Click to view list)`,
      {
        direction: "top",
        offset: [0, -radius],
        className: "custom-map-tooltip",
      }
    );

    marker.on("mouseover", () => {
      marker.setStyle({ fillColor: "#EF4444", fillOpacity: 1, weight: 3 });
    });
    marker.on("mouseout", () => {
      const activeColor = currentMapLayerType === "satellite" ? "#F59E0B" : "#1B75BC";
      marker.setStyle({ fillColor: activeColor, fillOpacity: currentMapLayerType === "satellite" ? 0.92 : 0.85, weight: 2 });
    });

    // Click marker opens Drill-Down Modal for that location (with Location column excluded)
    marker.on("click", () => {
      const filtered = data.filter((d) => (d.mapLocation || d.location || "Unspecified").trim() === locName);
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
    });

    mapMarkerList.push({ marker, locName, count });
  });

  // Layer Switch Button Handlers
  const btnSat = document.getElementById("btnMapSatellite");
  const btnStr = document.getElementById("btnMapStreets");

  if (btnSat && btnStr) {
    btnSat.onclick = (e) => {
      e.preventDefault();
      btnSat.classList.add("active");
      btnStr.classList.remove("active");
      setMapBasemap("satellite");
    };
    btnStr.onclick = (e) => {
      e.preventDefault();
      btnStr.classList.add("active");
      btnSat.classList.remove("active");
      setMapBasemap("streets");
    };
  }

  setTimeout(() => {
    if (leafletMapInstance) {
      leafletMapInstance.invalidateSize();
      leafletMapInstance.fitBounds(indiaBounds, { padding: [10, 10] });
    }
  }, 200);
}

/* ---------------------------- CHART: Joining trend (COMMENTED OUT) ----------------------------
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
---------------------------------------------------------------------------------- */

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

