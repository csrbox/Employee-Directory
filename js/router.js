/* =========================================================================
   router.js
   Lightweight hash router: #/dashboard  #/directory  #/profile  #/profile/:id
   Works on static GitHub Pages hosting with no backend/config needed.
   ========================================================================= */

const VIEWS = {
  dashboard: document.getElementById("view-dashboard"),
  directory: document.getElementById("view-directory"),
  profile: document.getElementById("view-profile"),
};

const NAV_LINKS = document.querySelectorAll(".nav-link[data-route]");

function showView(name) {
  Object.entries(VIEWS).forEach(([key, el]) => {
    if (!el) return;
    el.style.display = key === name ? "block" : "none";
  });

  NAV_LINKS.forEach((link) => {
    link.classList.toggle("active", link.dataset.route === name);
  });

  if (name === "dashboard" && window.leafletMapInstance) {
    setTimeout(() => {
      window.leafletMapInstance.invalidateSize();
      window.leafletMapInstance.fitBounds([[7.0, 68.0], [35.8, 97.5]], { padding: [10, 10] });
    }, 150);
  }

  window.scrollTo({ top: 0 });
}

function handleRoute() {
  const hash = window.location.hash || "#/dashboard";
  const parts = hash.replace(/^#\//, "").split("/");

  if (parts[0] === "profile") {
    showView("profile");
    if (parts[1]) {
      selectProfileEmployee(decodeURIComponent(parts[1]));
    }
  } else if (parts[0] === "employee" && parts[1]) {
    // backward-compatible with the old #/employee/:id links
    showView("profile");
    selectProfileEmployee(decodeURIComponent(parts[1]));
  } else if (parts[0] === "directory") {
    showView("directory");
  } else {
    showView("dashboard");
  }
}

window.addEventListener("hashchange", handleRoute);
window.addEventListener("DOMContentLoaded", handleRoute);
