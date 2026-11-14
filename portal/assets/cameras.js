/* Customer camera wall: lists the cameras for the signed-in account(s) and plays live view.
 * Authentication is the server's session cookie; nothing is stored in the browser. */
(function () {
  "use strict";
  var CAMERAS_URL = "/api/cameras";
  var ACCOUNTS_URL = "/api/accounts";
  var LOGIN_PAGE = "index.html";
  var page = document.body.getAttribute("data-page");
  var LABELS = { ready: "Connected", connecting: "Connecting, about a minute", offline: "No response", idle: "Not connected" };
  var current = null, pc = null, keepalive = null, cams = [];

  function $(id) { return document.getElementById(id); }

  function getJSON(url) {
    return fetch(url, { credentials: "same-origin", headers: { "Accept": "application/json" } })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) { window.location.href = LOGIN_PAGE; return null; }
        if (!res.ok) throw new Error("Could not load cameras. Refresh to try again.");
        return res.json();
      });
  }

  function accountFilter() { var s = $("account-select"); return s ? s.value : ""; }

  function renderCards() {
    var grid = $("cam-grid"), acct = accountFilter();
    grid.innerHTML = "";
    var shown = cams.filter(function (c) { return !acct || c.account === acct; });
    $("cam-count").textContent = shown.length + " camera" + (shown.length === 1 ? "" : "s");
    shown.forEach(function (c) {
      var card = document.createElement("article");
      card.className = "cam-card";
      card.id = "card-" + c.id;
      var img;
      if (c.still) {
        img = document.createElement("img");
        img.alt = c.name; img.src = "/api/camera/" + encodeURIComponent(c.id) + "/still.jpg?t=" + c.still;
        img.onerror = function () { img.replaceWith(placeholder()); };
      } else {
        img = placeholder();
      }
      var body = document.createElement("div"); body.className = "cam-card-body";
      var title = document.createElement("strong"); title.textContent = c.name;
      var meta = document.createElement("div"); meta.className = "portal-count";
      meta.textContent = c.account + " \u00b7 " + c.brand + (c.label ? " \u00b7 still " + c.label : "");
      var badge = document.createElement("span"); badge.className = "badge " + c.state; badge.id = "st-" + c.id;
      badge.textContent = LABELS[c.state] || c.state;
      var btn = document.createElement("button"); btn.className = "btn"; btn.type = "button"; btn.textContent = "Watch live";
      btn.addEventListener("click", function () { play(c); });
      body.appendChild(title); body.appendChild(meta); body.appendChild(badge); body.appendChild(btn);
      card.appendChild(img); card.appendChild(body); grid.appendChild(card);
    });
  }

  function placeholder() {
    var p = document.createElement("div");
    p.className = "cam-placeholder";
    p.textContent = "Still on the way";
    return p;
  }

  function waitIce(conn) {
    return new Promise(function (res) {
      if (conn.iceGatheringState === "complete") return res();
      conn.onicegatheringstatechange = function () { if (conn.iceGatheringState === "complete") res(); };
      setTimeout(res, 3000);
    });
  }

  function stop() {
    if (keepalive) { clearInterval(keepalive); keepalive = null; }
    if (pc) { pc.close(); pc = null; }
    if (current) { fetch("/api/camera/" + encodeURIComponent(current.id) + "/close", { method: "POST", credentials: "same-origin" }).catch(function () {}); }
    current = null;
    var v = $("player-video"); if (v) v.srcObject = null;
    $("cam-player").hidden = true;
  }

  function play(c) {
    stop();
    current = c;
    $("cam-player").hidden = false;
    $("player-name").textContent = c.name;
    setStatus("Connecting...", "connecting");
    $("player-msg").textContent = "Cameras can take about a minute to wake.";
    var v = $("player-video");
    pc = new RTCPeerConnection({ iceServers: [] });
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.ontrack = function (e) { v.srcObject = e.streams[0]; setStatus("Live", "ready"); $("player-msg").textContent = ""; };
    pc.onconnectionstatechange = function () { if (pc && (pc.connectionState === "failed" || pc.connectionState === "closed")) setStatus("Lost the connection", "offline"); };
    pc.createOffer()
      .then(function (offer) { return pc.setLocalDescription(offer); })
      .then(function () { return waitIce(pc); })
      .then(function () {
        return fetch("/api/camera/" + encodeURIComponent(c.id) + "/webrtc", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/sdp" }, body: pc.localDescription.sdp
        });
      })
      .then(function (res) {
        if (res.status === 429) throw new Error("You have too many live views open. Close one and try again.");
        if (res.status === 401) { window.location.href = LOGIN_PAGE; throw new Error("Signed out."); }
        if (!res.ok) throw new Error("Not connected yet. Cameras can take about a minute to wake. Try again.");
        return res.text();
      })
      .then(function (answer) { return pc.setRemoteDescription({ type: "answer", sdp: answer }); })
      .then(function () {
        keepalive = setInterval(function () {
          fetch("/api/camera/" + encodeURIComponent(c.id) + "/touch", { method: "POST", credentials: "same-origin" }).catch(function () {});
        }, 20000);
      })
      .catch(function (err) {
        setStatus("Not connected", "offline");
        $("player-msg").textContent = err.message || "Live view is not available right now.";
        stop();
        $("cam-player").hidden = false;
      });
  }

  function setStatus(text, cls) {
    var b = $("player-status"); b.textContent = text; b.className = "badge " + cls;
  }

  function refreshStatus() {
    getJSON(CAMERAS_URL).then(function (rows) {
      if (!rows) return;
      var changed = false;
      rows.forEach(function (fresh) {
        var old = cams.filter(function (c) { return c.id === fresh.id; })[0];
        if (!old || String(old.still) !== String(fresh.still)) changed = true;
      });
      cams = rows;
      if (changed) { renderCards(); return; }  // a new still arrived: redraw the grid
      rows.forEach(function (fresh) {
        var b = $("st-" + fresh.id);
        if (b) { b.className = "badge " + fresh.state; b.textContent = LABELS[fresh.state] || fresh.state; }
      });
    }).catch(function () {});
  }


  function bindSignOut() {
    var b = document.getElementById("signout-btn");
    if (!b) return;
    b.addEventListener("click", function () {
      b.disabled = true; b.textContent = "Signing out\u2026";
      fetch("/api/logout", { method: "POST", credentials: "same-origin" })
        .catch(function () { /* the server session is what matters */ })
        .then(function () { window.location.href = "index.html"; });
    });
  }

  function init() {
    bindSignOut();
    $("player-close").addEventListener("click", stop);
    window.addEventListener("pagehide", stop);
    getJSON(ACCOUNTS_URL).then(function (accounts) {
      if (!accounts) return;
      var sel = $("account-select");
      sel.innerHTML = "";
      var all = document.createElement("option"); all.value = ""; all.textContent = "All accounts";
      sel.appendChild(all);
      accounts.forEach(function (a) {
        var o = document.createElement("option"); o.value = a.account; o.textContent = a.account; sel.appendChild(o);
      });
      sel.addEventListener("change", renderCards);
      return getJSON(CAMERAS_URL);
    }).then(function (rows) {
      if (!rows) return;
      cams = rows;
      renderCards();
      setInterval(refreshStatus, 15000);
    }).catch(function (err) {
      var e = $("load-error"); e.textContent = err.message; e.hidden = false;
    });
  }

  if (page === "cameras") init();
})();
