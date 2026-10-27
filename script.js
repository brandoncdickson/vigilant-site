(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  // Cursor glow follows the pointer on desktop
  var glow = document.querySelector('.cursor-glow');
  if (glow && finePointer && !reduceMotion) {
    window.addEventListener('pointermove', function (e) {
      glow.style.transform = 'translate(' + e.clientX + 'px, ' + e.clientY + 'px)';
    }, { passive: true });
  } else if (glow) {
    glow.style.display = 'none';
  }

  // Spotlight on service cards
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });

  // Lead form: submit to the Google Form in the background and show a thank-you
  var form = document.getElementById('lead-form');
  var success = document.getElementById('form-success');
  if (form && success && window.fetch && window.URLSearchParams) {
    var statusEl = form.querySelector('.form-status');
    var submitBtn = form.querySelector('.btn-submit');
    var trap = document.getElementById('f-website');

    var showSuccess = function () {
      var nameInput = document.getElementById('f-name');
      var first = nameInput && nameInput.value.trim() ? nameInput.value.trim().split(/\s+/)[0] : '';
      document.getElementById('success-name').textContent = first ? ', ' + first : '';
      form.hidden = true;
      success.hidden = false;
      success.focus();
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (trap && trap.value) { showSuccess(); return; }
      submitBtn.disabled = true;
      statusEl.classList.remove('is-error');
      statusEl.textContent = 'Sending your request...';
      fetch(form.action, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams(new FormData(form))
      }).then(function () {
        statusEl.textContent = '';
        showSuccess();
      }).catch(function () {
        submitBtn.disabled = false;
        statusEl.classList.add('is-error');
        statusEl.textContent = 'We could not send your request. Please try again or call (843) 991-0062.';
      });
    });
  }

  // Animated network background
  var canvas = document.getElementById('net');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var width = 0;
  var height = 0;
  var dpr = 1;
  var points = [];
  var rafId = null;

  function seed() {
    var area = window.innerWidth * window.innerHeight;
    var count = Math.max(24, Math.min(70, Math.floor(area / 26000)));
    points = [];
    for (var i = 0; i < count; i++) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35 * dpr,
        vy: (Math.random() - 0.5) * 0.35 * dpr,
        warm: Math.random() < 0.12
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.width = Math.floor(window.innerWidth * dpr);
    height = canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    seed();
    if (reduceMotion) draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    var maxDist = 150 * dpr;
    var i, j, p, a, b, d;

    if (!reduceMotion) {
      for (i = 0; i < points.length; i++) {
        p = points[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }
    }

    ctx.lineWidth = 1 * dpr;
    for (i = 0; i < points.length; i++) {
      for (j = i + 1; j < points.length; j++) {
        a = points[i];
        b = points[j];
        d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < maxDist) {
          ctx.strokeStyle = 'rgba(111, 198, 242, ' + ((1 - d / maxDist) * 0.3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (i = 0; i < points.length; i++) {
      p = points[i];
      ctx.fillStyle = p.warm ? 'rgba(240, 165, 96, 0.9)' : 'rgba(214, 236, 250, 0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduceMotion) {
      rafId = requestAnimationFrame(draw);
    }
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (rafId) cancelAnimationFrame(rafId);
      resize();
      if (!reduceMotion) draw();
    }, 150);
  });

  // Pause the animation when the tab is hidden
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!document.hidden && !reduceMotion && !rafId) {
      draw();
    }
  });

  resize();
  if (!reduceMotion) draw();
})();
