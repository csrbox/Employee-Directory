/* =========================================================================
   data.js
   Single source of truth for employee data.
   Connected directly to Google Sheets (Dashboard tab).
   ========================================================================= */

const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1O9SikyIiwm0xTZuAdEDvVBD3AZS3Ztku6e1A88CJahY/export?format=csv&gid=142552145";
const LOCAL_FALLBACK_URL = "./data/employees.csv";

let employeeData = []; // shared array every render function reads from

/**
 * Loads and parses the live Google Sheet CSV, normalizes field names/types,
 * then triggers every view's render functions.
 */
async function loadEmployeeData() {
  try {
    let response;
    let isLive = true;

    try {
      response = await fetch(GOOGLE_SHEET_CSV_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Google Sheet HTTP status " + response.status);
    } catch (sheetErr) {
      console.warn("Could not fetch Google Sheet, trying local fallback:", sheetErr);
      isLive = false;
      response = await fetch(LOCAL_FALLBACK_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Network response was not ok (" + response.status + ")");
    }

    const csvText = await response.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    employeeData = parsed.data.map(normalizeEmployeeRow).filter((row) => row.empId);

    const timeStr = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const dataStamp = document.getElementById("dataStamp");
    if (dataStamp) {
      dataStamp.textContent = (isLive ? "🟢 Live Sheet · " : "Updated ") + timeStr;
      dataStamp.title = isLive ? "Connected to Google Sheet: Dashboard" : "Loaded from local file";
    }

    // Fire a single event; each view's own file listens and renders itself
    document.dispatchEvent(new CustomEvent("data:ready", { detail: employeeData }));
  } catch (err) {
    console.error("Failed to load employee data:", err);
    document.getElementById("dataStamp").textContent = "Data failed to load";
    const stamp = document.getElementById("kpiStrip");
    if (stamp) {
      stamp.innerHTML =
        '<div style="padding:8px 4px;color:#B5502E;font-size:13px;">Could not load employee data. Please verify your Google Sheet sharing settings or internet connection.</div>';
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
