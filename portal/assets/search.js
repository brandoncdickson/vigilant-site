/* Vigilant AI Search: sends the customer's question to the portal and shows the matching reports.
 * Authentication is the server's session cookie; nothing is stored in the browser. */
(function () {
  "use strict";
  var SEARCH_URL = "/api/search";
  var LOGIN_PAGE = "index.html";
  if (document.body.getAttribute("data-page") !== "search") return;

  function $(id) { return document.getElementById(id); }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function showError(message) {
    var e = $("search-error"); e.textContent = message; e.hidden = !message;
  }

  function renderResults(data) {
    var box = $("search-results");
    clear(box);
    var count = $("search-count");
    var results = data.results || [];
    count.textContent = results.length ? results.length + " matching report" + (results.length === 1 ? "" : "s") : "No matching reports.";
    var summary = $("search-summary");
    if (data.summary) { summary.textContent = data.summary; summary.hidden = false; }
    else { summary.textContent = ""; summary.hidden = true; }
    results.forEach(function (r) {
      var card = document.createElement("article");
      card.className = "search-card";
      var head = document.createElement("div");
      head.className = "search-card-head";
      var when = document.createElement("strong"); when.textContent = r.when;
      var cam = document.createElement("span"); cam.className = "portal-count";
      cam.textContent = r.camera + " \u00b7 " + r.account;
      var tag = document.createElement("span"); tag.className = "badge"; tag.textContent = r.verdict;
      head.appendChild(when); head.appendChild(cam); head.appendChild(tag);
      var text = document.createElement("p"); text.textContent = r.summary || "";
      var link = document.createElement("a"); link.href = r.pdf_url; link.target = "_blank"; link.rel = "noopener"; link.textContent = "Open report (PDF)";
      link.className = "btn btn-ghost";
      card.appendChild(head); card.appendChild(text); card.appendChild(link);
      box.appendChild(card);
    });
    var note = document.createElement("p");
    note.className = "portal-disclaimer";
    note.textContent = data.disclaimer || "";
    box.appendChild(note);
  }

  function search(event) {
    event.preventDefault();
    var q = $("q").value.trim();
    showError("");
    if (!q) { showError("Enter a question first."); return; }
    var btn = $("search-btn");
    btn.disabled = true; btn.textContent = "Searching\u2026";
    fetch(SEARCH_URL, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ q: q })
    })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) { window.location.href = LOGIN_PAGE; return null; }
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || "Search is unavailable right now.");
          return body;
        });
      })
      .then(function (data) { if (data) renderResults(data); })
      .catch(function (err) { showError(err.message || "Search is unavailable right now."); })
      .then(function () { btn.disabled = false; btn.textContent = "Search"; });
  }

  $("search-form").addEventListener("submit", search);
})();
