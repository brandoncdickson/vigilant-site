/* Customer camera wall: every camera on the page starts live automatically.
 * Up to 8 cameras per page (the server's limit per customer). Authentication is the session cookie. */
(function () {
  "use strict";
  var CAMERAS_URL = "/api/cameras";
  var ACCOUNTS_URL = "/api/accounts";
  var LOGIN_PAGE = "index.html";
  var PER = 8;
  if (document.body.getAttribute("data-page") !== "cameras") return;

  var LABELS = { ready: "Live", connecting: "Connecting, about a minute", offline: "No response", idle: "Connecting..." };
  var cams = [], page = 0, pcs = {}, pending = {};

  function $(id) { return document.getElementById(id); }
  function enc(id) { return encodeURIComponent(id); }

  function getJSON(url) {
    return fetch(url, { credentials: "same-origin", headers: { "Accept": "application/json" } })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) { window.location.href = LOGIN_PAGE; return null; }
        if (!res.ok) throw new Error("Could not load cameras. Refresh to try again.");
        return res.json();
      });
  }

  function accountFilter() { var s = $("account-select"); return s ? s.value : ""; }
  function filtered() { var a = accountFilter(); return cams.filter(function (c) { return !a || c.account === a; }); }
  function visible() { return filtered().slice(page * PER, page * PER + PER); }

  function setBadge(id, cls, text) {
    var b = $("st-" + id); if (!b) return;
    b.className = "badge " + cls; b.textContent = text;
  }
  function setMsg(id, text) { var m = $("m-" + id); if (m) m.textContent = text || ""; }

  function buildCard(c) {
    var card = document.createElement("article");
    card.className = "cam-card"; card.id = "card-" + c.id;
    var v = document.createElement("video");
    v.id = "v-" + c.id; v.autoplay = true; v.muted = true; v.playsInline = true; v.controls = true;
    if (c.still) v.poster = "/api/camera/" + enc(c.id) + "/still.jpg?t=" + c.still;
    card.appendChild(v);
    var body = document.createElement("div"); body.className = "cam-card-body";
    var title = document.createElement("strong"); title.textContent = c.name;
    var meta = document.createElement("div"); meta.className = "portal-count";
    meta.textContent = c.account + " \u00b7 " + c.brand;
    var badge = document.createElement("span"); badge.className = "badge idle"; badge.id = "st-" + c.id;
    badge.textContent = "Connecting...";
    var msg = document.createElement("div"); msg.className = "portal-count"; msg.id = "m-" + c.id;
    body.appendChild(title); body.appendChild(meta); body.appendChild(badge); body.appendChild(msg);
    card.appendChild(body);
    return card;
  }

  function renderGrid() {
    var grid = $("cam-grid"), list = visible();
    grid.innerHTML = "";
    list.forEach(function (c) { grid.appendChild(buildCard(c)); });
    grid.style.gridTemplateColumns = window.innerWidth < 700 || list.length <= 1 ? "1fr" : "repeat(2,minmax(0,1fr))";
    var total = filtered().length, pages = Math.max(1, Math.ceil(total / PER));
    $("cam-count").textContent = total + " camera" + (total === 1 ? "" : "s");
    $("pg").textContent = pages > 1 ? "Page " + (page + 1) + " of " + pages : "";
    $("prev").disabled = page === 0;
    $("next").disabled = page >= pages - 1;
    list.forEach(function (c) { if (pcs[c.id]) { setBadge(c.id, "ready", "Live"); } });
  }

  function waitIce(conn) {
    return new Promise(function (res) {
      if (conn.iceGatheringState === "complete") return res();
      conn.onicegatheringstatechange = function () { if (conn.iceGatheringState === "complete") res(); };
      setTimeout(res, 3000);
    });
  }

  function dropCam(id) {
    if (pcs[id] && pcs[id].close) pcs[id].close();
    delete pcs[id]; delete pending[id];
    var v = $("v-" + id); if (v) v.srcObject = null;
  }

  function startCam(c) {
    if (pcs[c.id] || pending[c.id]) return;
    pending[c.id] = Date.now();
    setBadge(c.id, "idle", "Connecting...");
    var v = $("v-" + c.id);
    var conn = new RTCPeerConnection({ iceServers: [] });
    pcs[c.id] = conn;
    conn.addTransceiver("video", { direction: "recvonly" });
    conn.ontrack = function (e) {
      if (v) v.srcObject = e.streams[0];
      delete pending[c.id];
      setBadge(c.id, "ready", "Live"); setMsg(c.id, "");
    };
    conn.onconnectionstatechange = function () {
      if (conn.connectionState === "failed" || conn.connectionState === "closed") {
        if (pcs[c.id] === conn) { dropCam(c.id); setBadge(c.id, "offline", "Reconnecting..."); }
      }
    };
    conn.createOffer()
      .then(function (offer) { return conn.setLocalDescription(offer); })
      .then(function () { return waitIce(conn); })
      .then(function () {
        return fetch("/api/camera/" + enc(c.id) + "/webrtc", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/sdp" }, body: conn.localDescription.sdp
        });
      })
      .then(function (res) {
        if (res.status === 401) { window.location.href = LOGIN_PAGE; throw new Error("signed out"); }
        if (res.status === 429) throw new Error("limit");
        if (!res.ok) throw new Error("wait");
        return res.text();
      })
      .then(function (answer) { return conn.setRemoteDescription({ type: "answer", sdp: answer }); })
      .catch(function (err) {
        if (pcs[c.id] === conn) dropCam(c.id);
        if (err && err.message === "limit") {
          setBadge(c.id, "offline", "Limit reached"); setMsg(c.id, "Too many live views open. Close one on another page and this will retry.");
        } else if (err && err.message === "signed out") {
          return;
        } else {
          setBadge(c.id, "connecting", "Connecting, about a minute");
          setMsg(c.id, "Cameras can take about a minute to wake. This will keep trying.");
        }
      });
  }

  function tick() {
    visible().forEach(function (c) {
      var started = pending[c.id];
      if (pcs[c.id] && !pending[c.id]) return;          // already live
      if (started && Date.now() - started < 70000) return; // still trying
      if (started) { delete pending[c.id]; }
      startCam(c);
    });
  }

  function touchAll() {
    Object.keys(pcs).forEach(function (id) {
      fetch("/api/camera/" + enc(id) + "/touch", { method: "POST", credentials: "same-origin" }).catch(function () {});
    });
  }

  function refreshList() {
    getJSON(CAMERAS_URL).then(function (rows) {
      if (!rows) return;
      cams = rows;
      renderGrid();
    }).catch(function () {});
  }

  function changePage(delta) {
    var pages = Math.max(1, Math.ceil(filtered().length / PER));
    var next = page + delta; if (next < 0 || next >= pages) return;
    visible().forEach(function (c) { dropCam(c.id); });
    page = next; renderGrid(); tick();
  }

  function signOut() {
    var b = $("signout-btn"); if (!b) return;
    b.addEventListener("click", function () {
      b.disabled = true; b.textContent = "Signing out\u2026";
      Object.keys(pcs).forEach(dropCam);
      fetch("/api/logout", { method: "POST", credentials: "same-origin" })
        .catch(function () {})
        .then(function () { window.location.href = LOGIN_PAGE; });
    });
  }

  function init() {
    signOut();
    $("prev").addEventListener("click", function () { changePage(-1); });
    $("next").addEventListener("click", function () { changePage(1); });
    window.addEventListener("pagehide", function () {
      Object.keys(pcs).forEach(function (id) {
        dropCam(id);
        fetch("/api/camera/" + enc(id) + "/close", { method: "POST", credentials: "same-origin", keepalive: true }).catch(function () {});
      });
    });
    getJSON(ACCOUNTS_URL).then(function (accounts) {
      if (!accounts) return;
      var sel = $("account-select");
      sel.innerHTML = "";
      var all = document.createElement("option"); all.value = ""; all.textContent = "All accounts";
      sel.appendChild(all);
      accounts.forEach(function (a) {
        var o = document.createElement("option"); o.value = a.account; o.textContent = a.account; sel.appendChild(o);
      });
      sel.addEventListener("change", function () { page = 0; renderGrid(); tick(); });
      return getJSON(CAMERAS_URL);
    }).then(function (rows) {
      if (!rows) return;
      cams = rows;
      renderGrid();
      tick();
      setInterval(tick, 5000);
      setInterval(touchAll, 20000);
      setInterval(refreshList, 15000);
    }).catch(function (err) {
      var e = $("load-error"); e.textContent = err.message; e.hidden = false;
    });
  }

  init();
})();
