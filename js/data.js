/* =========================================================================
   data.js
   Single source of truth for employee data.
   Connected to Google Apps Script Web App API.
   ========================================================================= */


const API_URL = "https://script.google.com/macros/s/AKfycby-N3PuiQcR49JSmPVUNCPHqPtGZl7WMeGlfGGXJwSCdssv-zJp99x78JHaLi0AyFLDQw/exec";

let employeeData = []; // shared array every render function reads from

/**
 * Loads employee data from Google Apps Script Web App API,
 * normalizes field names/types, and fires the data:ready event.
 */
async function loadEmployeeData() {
  try {
    if (!API_URL || API_URL === "") {
      throw new Error("Apps Script API URL is not configured. Please set API_URL in js/data.js.");
    }

    const response = await fetch(API_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("API responded with HTTP status " + response.status);
    }

    const result = await response.json();

    // Validate API response structure
    let rawList = [];
    if (Array.isArray(result)) {
      rawList = result;
    } else if (result && Array.isArray(result.data)) {
      rawList = result.data;
    } else if (result && result.error) {
      throw new Error("API error: " + result.error);
    } else {
      throw new Error("Invalid data format received from API");
    }

    employeeData = rawList.map(normalizeEmployeeRow).filter((row) => row.empId);

    const timeStr = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const dataStamp = document.getElementById("dataStamp");
    if (dataStamp) {
      dataStamp.innerHTML = '<i class="bi bi-circle-fill text-success me-1" style="font-size:8px;"></i> Live API · ' + timeStr;
      dataStamp.title = "Connected to Google Apps Script API";
    }

    // Fire a single event; each view's own file listens and renders itself
    document.dispatchEvent(new CustomEvent("data:ready", { detail: employeeData }));
  } catch (err) {
    console.error("Failed to load employee data:", err);
    const dataStamp = document.getElementById("dataStamp");
    if (dataStamp) {
      dataStamp.textContent = "Data failed to load";
      dataStamp.title = err.message || "Failed to load data";
    }
    const stamp = document.getElementById("kpiStrip");
    if (stamp) {
      stamp.innerHTML =
        '<div style="padding:8px 4px;color:#B5502E;font-size:13px;">Could not load employee data. ' +
        escapeHtmlLocalData(err.message || "Please verify your Apps Script Web App deployment or internet connection.") +
        '</div>';
    }
  }
}

/** Cleans up one raw CSV row into consistent, typed fields.
 *  Supports standard headers and common typo variants. */
function normalizeEmployeeRow(row) {
  const get = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        const val = String(row[key]).trim();
        if (val) return val;
      }
    }
    return "";
  };

  const totalExpStr = get("Total Years of Experience", "Total Experience", "Total Years Of Experience");
  const orgExpStr = get("Experience with CSRBOX (years)", "Experience with CSRBOX", "Experience with CSRBOX (in years)", "Experience with org (years)", "Experience with org");

  const totalExp = parseExperienceYears(totalExpStr);
  const orgExp = parseExperienceYears(orgExpStr);
  const mapLoc = get("Map Location", "Base Location", "Location");

  return {
    empId: get("Emp ID", "EmpId", "Employee ID"),
    fullName: get("Full Name", "Name", "Employee Name"),
    organisation: get("Organisation", "Organization", "Org"),
    designation: get("Designation", "Role"),
    level: get("Level-Designation", "Level", "Designation Level"),
    officialEmail: get("Official Email ID", "Official Email", "Email ID", "Email"),
    officialPhone: get("Official Phone Number", "Official Phone", "Phone"),
    personalPhone: get("Personal Phone Number", "Personal Phone"),
    reportingManager: get("Reporting Managers", "Reporting Manager", "Manager"),
    reportingManagerEmail: get("Reporting Manager's Email ID", "Reporting Manager Email", "Manager Email"),
    baseLocation: get("Base Location", "Location", "City"),
    mapLocation: mapLoc,
    location: mapLoc, // keep location defaulted to mapLocation for backwards compatibility
    joiningDate: parseFlexibleDate(get("Date Of Joining", "Date of Joining", "Joining Date", "DOJ")),
    joiningDateRaw: get("Date Of Joining", "Date of Joining", "Joining Date", "DOJ"),
    orgExperience: orgExp,
    orgExperienceRaw: orgExpStr,
    orgExperienceFormatted: formatExperienceDisplay(orgExpStr, orgExp),
    totalExperience: totalExp,
    totalExperienceRaw: totalExpStr,
    totalExperienceFormatted: formatExperienceDisplay(totalExpStr, totalExp),
    bachelors: get("Bachelor's with Specialisation", "Bachelor's", "Bachelors"),
    bachelorsCollege: get("Bachelor's Degree College / University", "Bachelor's College", "Bachelors College"),
    masters: get("Master's with Specialisation", "Master's", "Masters"),
    mastersCollege: get("Master's Degree College / University", "Master's College", "Masters College"),
    otherCourse: get("Other Specialisation Course", "Other Course"),
    keySkills: get("Key Skills", "Skills"),
    workMode: get("Work Mode", "Workmode"),
    employmentType: get("Employement type", "Employment type", "Employment Type"),
    language: get("Language", "Languages", "Language Known", "Languages Known"),
    gender: get("Gender", "Sex") || "Unspecified",
    status: get("Status") || "Active",
  };
}

/** Parses experience values like "1.5" (1 yr 5 mos), "0.8" (8 mos), "3.8", "8", etc. into fractional years. */
function parseExperienceYears(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s || s.toLowerCase() === "na" || s.toLowerCase() === "n/a") return null;

  // Handles strings like "8 months" or "8 mos"
  if (/month/i.test(s) && !/year/i.test(s)) {
    const m = parseFloat(s);
    return isNaN(m) ? null : m / 12;
  }

  // Handles notation like "1.5" (1 year 5 months) or "0.8" (8 months) or plain integers
  const match = s.match(/^(\d+)(?:\.(\d+))?/);
  if (match) {
    const years = parseInt(match[1], 10);
    if (match[2] !== undefined) {
      const months = parseInt(match[2], 10);
      return years + (months / 12);
    }
    return years;
  }

  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

/** Formats an experience value into a human-friendly string for profiles. */
function formatExperienceDisplay(rawStr, numYears) {
  if (numYears === null || numYears === undefined || isNaN(numYears)) return null;
  if (!rawStr) return numYears + " yrs";

  const s = String(rawStr).trim();
  const match = s.match(/^(\d+)(?:\.(\d+))?/);
  if (match && match[2] !== undefined) {
    const yr = parseInt(match[1], 10);
    const mo = parseInt(match[2], 10);
    if (yr === 0) return `${mo} mo${mo !== 1 ? "s" : ""}`;
    if (mo === 0) return `${yr} yr${yr !== 1 ? "s" : ""}`;
    return `${yr} yr${yr !== 1 ? "s" : ""} ${mo} mo${mo !== 1 ? "s" : ""}`;
  }
  return s.includes("yr") || s.includes("month") ? s : `${s} yrs`;
}

/** Parses DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, or text dates into a valid JS Date, or null. */
function parseFlexibleDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s || s.toLowerCase() === "na" || s.toLowerCase() === "n/a") return null;

  // ISO format: YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split(/[-/]/);
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }

  // DD-MM-YYYY or DD/MM/YYYY (or loose 3-part splits)
  const parts = s.split(/[-/]/).map((p) => p.trim());
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (d.length === 4) {
      // Actually YYYY-MM-DD
      const date = new Date(Number(d), Number(m) - 1, Number(y));
      return isNaN(date.getTime()) ? null : date;
    }
    if (y.length === 2) y = "20" + y;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }

  // Fallback to native parser (e.g. "15 Sep 2026")
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

document.addEventListener("DOMContentLoaded", loadEmployeeData);
