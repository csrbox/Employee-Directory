/* =========================================================================
   profile.js
   The Employee Profile page has its own selector (Organisation / Location /
   Level -> Employee), same cascading-filter idea as the Directory, plus
   renders the full detail card once someone is picked.
   ========================================================================= */

let profileData = [];

document.addEventListener("data:ready", (e) => {
  profileData = e.detail;
  refreshProfileFilterOptions();
  attachProfileEvents();

  // If we arrived via a deep link (#/profile/CB-XXXX) before data loaded, honour it.
  if (window.pendingProfileEmpId) {
    selectProfileEmployee(window.pendingProfileEmpId);
    window.pendingProfileEmpId = null;
  } else {
    renderEmptyProfileState();
  }
});

function getProfileFilterState() {
  const searchInput = document.getElementById("profileSearchName");
  return {
    searchQuery: searchInput ? searchInput.value.trim() : "",
    organisation: document.getElementById("profileFilterOrg").value,
    location: document.getElementById("profileFilterLocation").value,
    level: document.getElementById("profileFilterLevel").value,
  };
}

function profileOptionsForField(field) {
  const { organisation, location, level, searchQuery } = getProfileFilterState();

  const subset = profileData.filter((emp) => {
    const empLoc = emp.mapLocation || emp.location;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = emp.fullName.toLowerCase().includes(q);
      const matchId = emp.empId.toLowerCase().includes(q);
      const matchDesig = (emp.designation || "").toLowerCase().includes(q);
      if (!matchName && !matchId && !matchDesig) return false;
    }
    if (field !== "organisation" && organisation && emp.organisation !== organisation) return false;
    if (field !== "mapLocation" && location && empLoc !== location) return false;
    if (field !== "level" && level && emp.level !== level) return false;
    return true;
  });

  return [...new Set(subset.map((emp) => (field === "mapLocation" ? (emp.mapLocation || emp.location) : emp[field])).filter(Boolean))].sort();
}

function refreshProfileFilterOptions() {
  fillSelectPreservingLocal("profileFilterOrg", profileOptionsForField("organisation"));
  fillSelectPreservingLocal("profileFilterLocation", profileOptionsForField("mapLocation"));
  fillSelectPreservingLocal("profileFilterLevel", profileOptionsForField("level"));
  refreshProfileEmployeeOptions();
}

/** The employee dropdown is filtered by search query + org/location/level. */
function refreshProfileEmployeeOptions() {
  const { organisation, location, level, searchQuery } = getProfileFilterState();
  const select = document.getElementById("profileSelectEmployee");
  const current = select.value;

  const matches = profileData.filter((emp) => {
    const empLoc = emp.mapLocation || emp.location;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = emp.fullName.toLowerCase().includes(q);
      const matchId = emp.empId.toLowerCase().includes(q);
      const matchDesig = (emp.designation || "").toLowerCase().includes(q);
      if (!matchName && !matchId && !matchDesig) return false;
    }
    if (organisation && emp.organisation !== organisation) return false;
    if (location && empLoc !== location) return false;
    if (level && emp.level !== level) return false;
    return true;
  }).sort((a, b) => a.fullName.localeCompare(b.fullName));

  select.innerHTML = `<option value="">👤 Select employee (${matches.length})…</option>`;
  matches.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = emp.empId;
    opt.textContent = emp.fullName + " — " + emp.designation;
    select.appendChild(opt);
  });

  select.value = matches.some((m) => m.empId === current) ? current : "";
}

function fillSelectPreservingLocal(id, values) {
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

function attachProfileEvents() {
  const searchInput = document.getElementById("profileSearchName");
  const orgSelect = document.getElementById("profileFilterOrg");
  const locSelect = document.getElementById("profileFilterLocation");
  const levelSelect = document.getElementById("profileFilterLevel");
  const empSelect = document.getElementById("profileSelectEmployee");
  const clearBtn = document.getElementById("profileClearFilters");

  if (orgSelect.dataset.bound) return;
  orgSelect.dataset.bound = "true";

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      refreshProfileFilterOptions();
      // If search query produces matches and employee wasn't chosen, let user pick
      const { searchQuery } = getProfileFilterState();
      if (!searchQuery && !empSelect.value) {
        renderEmptyProfileState();
      }
    });

    searchInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const options = empSelect.options;
        if (options.length > 1) {
          empSelect.value = options[1].value;
          window.location.hash = "#/profile/" + empSelect.value;
        }
      }
    });
  }

  [orgSelect, locSelect, levelSelect].forEach((sel) => {
    sel.addEventListener("change", () => {
      refreshProfileFilterOptions();
      if (!empSelect.value) renderEmptyProfileState();
    });
  });

  empSelect.addEventListener("change", () => {
    if (empSelect.value) {
      window.location.hash = "#/profile/" + empSelect.value;
    } else {
      renderEmptyProfileState();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      orgSelect.value = "";
      locSelect.value = "";
      levelSelect.value = "";
      refreshProfileFilterOptions();
      empSelect.value = "";
      renderEmptyProfileState();
      if (window.location.hash.startsWith("#/profile/")) {
        window.location.hash = "#/profile";
      }
    });
  }
}

/** Called by the router for deep links like #/profile/CB-101204,
 *  and internally once an employee is picked from the dropdown. */
function selectProfileEmployee(empId) {
  if (!profileData.length) {
    window.pendingProfileEmpId = empId; // data not loaded yet — wait for data:ready
    return;
  }

  const emp = profileData.find((d) => d.empId === empId);
  if (!emp) {
    renderNotFoundProfile();
    return;
  }

  // Sync the search and filter dropdowns to match this employee
  const searchInput = document.getElementById("profileSearchName");
  if (searchInput) searchInput.value = emp.fullName;

  document.getElementById("profileFilterOrg").value = emp.organisation;
  document.getElementById("profileFilterLocation").value = emp.mapLocation || emp.location;
  document.getElementById("profileFilterLevel").value = emp.level;
  refreshProfileEmployeeOptions();
  document.getElementById("profileSelectEmployee").value = emp.empId;

  renderProfileDetail(emp);
}

function renderEmptyProfileState() {
  const container = document.getElementById("profileContent");
  if (container) {
    container.innerHTML = '<div class="empty-state">👋 Pick an employee above to view their full profile.</div>';
  }
}

function renderNotFoundProfile() {
  const container = document.getElementById("profileContent");
  if (container) {
    container.innerHTML = '<div class="not-found">🤔 We couldn\'t find that employee. They may have left, or the link is incorrect.</div>';
  }
}

function renderProfileDetail(emp) {
  const container = document.getElementById("profileContent");
  if (!container) return;

  const initials = emp.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");

  const isActive = emp.status.toLowerCase() === "active";
  const skillChips = emp.keySkills
    ? emp.keySkills.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const rawGender = (emp.gender || "").trim();
  const hasGender = rawGender && rawGender.toLowerCase() !== "unspecified";
  const genderIcon = rawGender.toLowerCase().startsWith("f") ? "♀️" : (rawGender.toLowerCase().startsWith("m") ? "♂️" : "👤");
  const genderDisplay = hasGender ? rawGender : "Unspecified";

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${initials}</div>
      <div class="profile-header-text">
        <h2>${escapeHtml(emp.fullName)}</h2>
        <p>${escapeHtml(emp.designation)} · ${escapeHtml(emp.organisation)} · ${escapeHtml(emp.empId)}</p>
      </div>
      <div class="profile-header-badges">
        <span class="gender-pill ${hasGender ? "" : "unspecified"}">${genderIcon} ${escapeHtml(genderDisplay)}</span>
        <span class="status-pill ${isActive ? "" : "inactive"}">${isActive ? "✅" : "⏸️"} ${escapeHtml(emp.status)}</span>
      </div>
    </div>

    <div class="profile-grid">

      <div class="profile-section">
        <h4>📞 Contact</h4>
        ${field("📧 Official email", emp.officialEmail ? `<a href="mailto:${emp.officialEmail}">${escapeHtml(emp.officialEmail)}</a>` : "—")}
        ${field("📱 Official phone", emp.officialPhone || "—")}
        ${field("☎️ Personal phone", emp.personalPhone || "—")}
        ${field("📍 Location", (emp.mapLocation || emp.location) || "—")}
      </div>

      <div class="profile-section">
        <h4>🧭 Reporting</h4>
        ${field("👤 Reporting manager", emp.reportingManager || "—")}
        ${field("✉️ Manager's email", emp.reportingManagerEmail ? `<a href="mailto:${emp.reportingManagerEmail}">${escapeHtml(emp.reportingManagerEmail)}</a>` : "—")}
      </div>

      <div class="profile-section">
        <h4>⏳ Tenure &amp; Work Details</h4>
        ${field("🧾 Employment type", emp.employmentType || "—")}
        ${field("💼 Work mode", emp.workMode || "—")}
        ${field("📅 Joining date", emp.joiningDateRaw || "—")}
        ${field("🏢 Experience with CSRBOX", emp.orgExperienceFormatted || (emp.orgExperience !== null ? emp.orgExperience + " yrs" : "—"))}
        ${field("📈 Total experience", emp.totalExperienceFormatted || (emp.totalExperience !== null ? emp.totalExperience + " yrs" : "—"))}
      </div>

      <div class="profile-section">
        <h4>🎓 Education</h4>
        ${field("🎓 Bachelor's", emp.bachelors ? emp.bachelors + (emp.bachelorsCollege && emp.bachelorsCollege !== "NA" ? " — " + emp.bachelorsCollege : "") : "—")}
        ${field("🎓 Master's", emp.masters && emp.masters !== "NA" ? emp.masters + (emp.mastersCollege && emp.mastersCollege !== "NA" ? " — " + emp.mastersCollege : "") : "—")}
        ${field("📚 Other course", emp.otherCourse && emp.otherCourse !== "NA" ? emp.otherCourse : "—")}
        ${field("🗣️ Language", emp.language || "—")}
      </div>

      <div class="profile-section" style="grid-column: span 2;">
        <h4>🛠️ Key skills</h4>
        ${
          skillChips.length
            ? `<div class="skill-chip-wrap">${skillChips.map((s) => `<span class="skill-chip">${escapeHtml(s)}</span>`).join("")}</div>`
            : `<div class="profile-field-value">—</div>`
        }
      </div>

    </div>
  `;
}


function field(label, valueHtml) {
  return `
    <div class="profile-field">
      <span class="profile-field-label">${escapeHtml(label)}</span>
      <span class="profile-field-value">${valueHtml}</span>
    </div>
  `;
}
