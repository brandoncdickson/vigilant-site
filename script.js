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
        vy: (Math.random() - 0.5) * 0.35 * dpr
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
          ctx.strokeStyle = 'rgba(54, 242, 255, ' + ((1 - d / maxDist) * 0.32) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    ctx.fillStyle = 'rgba(157, 255, 92, 0.85)';
    for (i = 0; i < points.length; i++) {
      p = points[i];
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
