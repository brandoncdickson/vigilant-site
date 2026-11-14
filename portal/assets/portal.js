/* Customer portal behavior: sign-in, incident list, search filter, sign-out.
 * No tokens, passwords, or camera data are stored in the browser.
 * Authentication relies on the server's session cookie (sent with credentials: "same-origin"). */
(function () {
  "use strict";

  var LOGIN_URL = "/api/login";
  var INCIDENTS_URL = "/api/incidents";
  var LOGOUT_URL = "/api/logout";
  var LOGIN_PAGE = "index.html";
  var INCIDENTS_PAGE = "incidents.html";

  var page = document.body.getAttribute("data-page");

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }

  function clearError(el) {
    el.textContent = "";
    el.hidden = true;
  }

  function setBusy(button, busy, idleLabel, busyLabel) {
    button.disabled = busy;
    button.textContent = busy ? busyLabel : idleLabel;
  }

  /* ---------- Sign-in page ---------- */

  function initLogin() {
    var form = document.getElementById("login-form");
    var errorEl = document.getElementById("login-error");
    var submit = form.querySelector('button[type="submit"]');
    var submitLabel = submit.textContent;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearError(errorEl);

      var email = form.email.value.trim();
      var password = form.password.value;
      var code = form.totp.value.trim();

      if (!email || !password) {
        showError(errorEl, "Enter your email and password.");
        return;
      }
      if (!/^[0-9]{6}$/.test(code)) {
        showError(errorEl, "Enter the 6-digit code from your authenticator app.");
        return;
      }

      setBusy(submit, true, submitLabel, "Signing in\u2026");

      fetch(LOGIN_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email: email, password: password, totp: code })
      })
        .then(function (res) {
          if (res.ok) {
            window.location.href = INCIDENTS_PAGE;
            return;
          }
          if (res.status === 429) {
            throw new Error("Too many attempts. Wait a few minutes and try again.");
          }
          if (res.status === 401 || res.status === 403) {
            throw new Error("Sign-in failed. Check your email, password, and two-factor code.");
          }
          throw new Error("Sign-in is unavailable right now. Try again shortly.");
        })
        .catch(function (err) {
          var message = err && err.message && err.message !== "Failed to fetch"
            ? err.message
            : "We could not reach the portal. Check your connection and try again.";
          showError(errorEl, message);
        })
        .then(function () {
          setBusy(submit, false, submitLabel, submitLabel);
        });
    });
  }

  /* ---------- Incidents page ---------- */

  function cell(text) {
    var td = document.createElement("td");
    td.textContent = text == null ? "" : String(text);
    return td;
  }

  function renderRows(rows) {
    var body = document.getElementById("incidents-body");
    body.textContent = "";

    if (!rows.length) {
      var empty = document.createElement("tr");
      empty.className = "portal-empty-row";
      var td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "No incident reports found.";
      empty.appendChild(td);
      body.appendChild(empty);
      return;
    }

    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-search", [row.when, row.camera, row.verdict, row.status]
        .join(" ").toLowerCase());

      tr.appendChild(cell(row.when));
      tr.appendChild(cell(row.camera));
      tr.appendChild(cell(row.verdict));

      var statusTd = document.createElement("td");
      var tag = document.createElement("span");
      tag.className = "status-tag";
      tag.textContent = row.status || "";
      statusTd.appendChild(tag);
      tr.appendChild(statusTd);

      var pdfTd = document.createElement("td");
      if (row.pdf_url) {
        var link = document.createElement("a");
        link.href = row.pdf_url;
        link.textContent = "Open PDF";
        link.target = "_blank";
        link.rel = "noopener";
        pdfTd.appendChild(link);
      }
      tr.appendChild(pdfTd);

      body.appendChild(tr);
    });
  }

  function applyFilter() {
    var query = document.getElementById("search").value.trim().toLowerCase();
    var rows = document.querySelectorAll("#incidents-body tr[data-search]");
    var visible = 0;

    Array.prototype.forEach.call(rows, function (tr) {
      var match = !query || tr.getAttribute("data-search").indexOf(query) !== -1;
      tr.hidden = !match;
      if (match) visible += 1;
    });

    var count = document.getElementById("row-count");
    count.textContent = rows.length
      ? "Showing " + visible + " of " + rows.length + " reports"
      : "";
  }

  function loadIncidents() {
    var errorEl = document.getElementById("load-error");

    return fetch(INCIDENTS_URL, {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = LOGIN_PAGE;
          return null;
        }
        if (!res.ok) {
          throw new Error("Incident reports could not be loaded. Refresh to try again.");
        }
        return res.json();
      })
      .then(function (data) {
        if (data === null) return;
        var rows = Array.isArray(data) ? data : (data.incidents || []);
        renderRows(rows);
        applyFilter();
      })
      .catch(function (err) {
        clearError(errorEl);
        showError(errorEl, err.message || "Incident reports could not be loaded.");
        renderRows([]);
        document.getElementById("row-count").textContent = "";
      });
  }

  function signOut(button) {
    setBusy(button, true, "Sign out", "Signing out\u2026");
    fetch(LOGOUT_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    })
      .catch(function () { /* Redirect regardless; the server session is the source of truth. */ })
      .then(function () {
        window.location.href = LOGIN_PAGE;
      });
  }

  function initIncidents() {
    document.getElementById("search").addEventListener("input", applyFilter);
    document.getElementById("signout-btn").addEventListener("click", function () {
      signOut(this);
    });
    loadIncidents();
  }

  if (page === "login") {
    initLogin();
  } else if (page === "incidents") {
    initIncidents();
  }
})();
