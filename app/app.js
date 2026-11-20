/* Vice Coast Cover Studio: an offline cover maker.
   One photo (or several) plus a caption becomes GTA-style poster art:
   a multi-panel grid, bold Anton lettering, a Pacifico script subtitle,
   a sunset or neon colour grade, grain and a vignette. Everything runs
   locally in the browser; photos are read on the machine, never uploaded.
   Exports a PNG at 1080 x 1080, 1080 x 1350 or 1920 x 1080. */

(function () {
  'use strict';

  var SAMPLES = [
    { name: 'Rooftop', src: './samples/hero-rooftop.jpg' },
    { name: 'Neon night', src: './samples/friends-neon.jpg' },
    { name: 'Boulevard', src: './samples/boulevard-sunset.jpg' }
  ];

  var SIZES = {
    square: { w: 1080, h: 1080, label: '1080 x 1080' },
    portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
    wide: { w: 1920, h: 1080, label: '1920 x 1080' }
  };

  var GRADES = {
    sunset: { sat: 1.3, con: 1.08, bright: 1.0, grey: 0, from: '#ff9a3c', to: '#ff2d78', alpha: 0.28 },
    neon: { sat: 1.45, con: 1.1, bright: 1.0, grey: 0, from: '#00e5ff', to: '#ff2d95', alpha: 0.30 },
    vice: { sat: 1.25, con: 1.05, bright: 1.0, grey: 0, from: '#7b2fff', to: '#ff5e3a', alpha: 0.30 },
    noir: { sat: 1.0, con: 1.18, bright: 1.02, grey: 1, from: '#888888', to: '#222222', alpha: 0.0 }
  };

  var state = {
    photos: [],
    layout: 'poster',
    grade: 'sunset',
    size: 'square',
    title: 'ROOFTOP NIGHTS',
    subtitle: 'golden hour in the city',
    selectedPanel: 0,
    panels: { poster: [], nine: [], full: [], snaps: [] }
  };

  var preview = document.getElementById('previewCanvas');
  var pctx = preview.getContext('2d');
  var statusEl = document.getElementById('status');
  var grainTile = null;
  var lastPanelRects = [];

  /* ---------- layout geometry (fractions of the cover) ---------- */

  function layoutPanels(layout, W, H) {
    if (layout === 'nine') {
      var cells = [];
      for (var r = 0; r < 3; r++) {
        for (var c = 0; c < 3; c++) {
          cells.push({ x: c / 3, y: (r * 0.76) / 3, w: 1 / 3, h: 0.76 / 3, rot: 0 });
        }
      }
      return { panels: cells, title: { x: 0, y: 0.76, w: 1, h: 0.24 } };
    }
    if (layout === 'full') {
      return { panels: [{ x: 0, y: 0, w: 1, h: 1, rot: 0 }], title: { x: 0, y: 0.62, w: 1, h: 0.38 } };
    }
    if (layout === 'snaps') {
      return {
        panels: [
          { x: 0.06, y: 0.30, w: 0.42, h: 0.52, rot: -0.10 },
          { x: 0.52, y: 0.26, w: 0.42, h: 0.52, rot: 0.08 },
          { x: 0.28, y: 0.62, w: 0.44, h: 0.34, rot: -0.03 }
        ],
        title: { x: 0, y: 0.02, w: 1, h: 0.22 }
      };
    }
    return {
      panels: [
        { x: 0, y: 0, w: 0.615, h: 0.66, rot: 0 },
        { x: 0.615, y: 0, w: 0.385, h: 0.33, rot: 0 },
        { x: 0.615, y: 0.33, w: 0.385, h: 0.33, rot: 0 }
      ],
      title: { x: 0, y: 0.66, w: 1, h: 0.34 }
    };
  }

  function panelState(layout, index) {
    if (index == null || index < 0) index = 0;
    var list = state.panels[layout];
    while (list.length <= index) list.push({ photo: 0, zoom: 1, ox: 0, oy: 0 });
    return list[index];
  }

  /* ---------- photo drawing ---------- */

  function drawPanelPhoto(ctx, rect, photo, zoom, ox, oy, grade) {
    var img = photo.img;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var rw = rect.w, rh = rect.h;
    var base = Math.max(rw / iw, rh / ih);
    var dw = iw * base * zoom, dh = ih * base * zoom;
    var dx = rect.x + (rw - dw) / 2 + ox * Math.max(0, dw - rw);
    var dy = rect.y + (rh - dh) / 2 + oy * Math.max(0, dh - rh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rw, rh);
    ctx.clip();
    ctx.filter = grade.grey
      ? 'grayscale(1) contrast(' + grade.con + ') brightness(' + grade.bright + ')'
      : 'saturate(' + grade.sat + ') contrast(' + grade.con + ') brightness(' + grade.bright + ')';
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
    if (grade.alpha > 0) {
      var grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rw, rect.y + rh);
      grad.addColorStop(0, grade.from);
      grad.addColorStop(1, grade.to);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = grade.alpha;
      ctx.fillStyle = grad;
      ctx.fillRect(rect.x, rect.y, rw, rh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function makeGrainTile() {
    var tile = document.createElement('canvas');
    tile.width = 180; tile.height = 180;
    var tctx = tile.getContext('2d');
    var data = tctx.createImageData(180, 180);
    for (var i = 0; i < data.data.length; i += 4) {
      var v = 96 + Math.floor(Math.random() * 64);
      data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
    }
    tctx.putImageData(data, 0, 0);
    return tile;
  }

  function drawGrain(ctx, W, H) {
    if (!grainTile) grainTile = makeGrainTile();
    var pattern = ctx.createPattern(grainTile, 'repeat');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawVignette(ctx, W, H) {
    var grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(10,4,24,0.38)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------- lettering ---------- */

  function fitFont(ctx, text, fontFamily, startSize, maxWidth, weight) {
    var size = startSize;
    while (size > 12) {
      ctx.font = weight + ' ' + size + 'px ' + fontFamily;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    return size;
  }

  function drawTitleBlock(ctx, area, W, H) {
    var bg = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
    bg.addColorStop(0, '#2b0a4a');
    bg.addColorStop(1, '#160a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    ctx.fillStyle = '#ff2d95';
    ctx.fillRect(area.x, area.y, area.w, Math.max(3, H * 0.004));
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(area.x, area.y + Math.max(3, H * 0.004), area.w, Math.max(2, H * 0.002));

    var title = (state.title || 'UNTITLED').toUpperCase();
    var size = fitFont(ctx, title, 'Anton', Math.round(W * 0.105), area.w * 0.92, '400');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var grad = ctx.createLinearGradient(0, area.y + area.h * 0.18, 0, area.y + area.h * 0.62);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#ffd76a');
    grad.addColorStop(1, '#ff5e3a');
    ctx.lineWidth = Math.max(2, size * 0.055);
    ctx.strokeStyle = '#1a0b2e';
    ctx.lineJoin = 'round';
    var ty = area.y + area.h * 0.38;
    ctx.strokeText(title, area.x + area.w / 2, ty);
    ctx.fillStyle = grad;
    ctx.fillText(title, area.x + area.w / 2, ty);

    var subSize = fitFont(ctx, state.subtitle, 'Pacifico', Math.round(W * 0.042), area.w * 0.86, '400');
    ctx.font = '400 ' + subSize + 'px Pacifico';
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = Math.round(W * 0.018);
    ctx.fillStyle = '#ff7ad9';
    ctx.fillText(state.subtitle, area.x + area.w / 2, area.y + area.h * 0.74);
    ctx.shadowBlur = 0;

    ctx.font = '400 ' + Math.max(11, Math.round(W * 0.02)) + 'px Anton';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('★ ★ ★ ★ ★    VICE COAST  •  2026', area.x + area.w / 2, area.y + area.h * 0.92);
  }

  function drawFullBleedTitle(ctx, area, W, H) {
    var scrim = ctx.createLinearGradient(0, area.y, 0, H);
    scrim.addColorStop(0, 'rgba(10,4,24,0)');
    scrim.addColorStop(1, 'rgba(10,4,24,0.88)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, area.y, W, H - area.y);

    var title = (state.title || 'UNTITLED').toUpperCase();
    var size = fitFont(ctx, title, 'Anton', Math.round(W * 0.115), W * 0.9, '400');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    var grad = ctx.createLinearGradient(0, H * 0.72, 0, H * 0.9);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, '#ffd76a');
    grad.addColorStop(1, '#ff5e3a');
    ctx.lineWidth = Math.max(2, size * 0.05);
    ctx.strokeStyle = '#1a0b2e';
    ctx.lineJoin = 'round';
    var tx = W * 0.05;
    ctx.strokeText(title, tx, H * 0.88);
    ctx.fillStyle = grad;
    ctx.fillText(title, tx, H * 0.88);

    var subSize = fitFont(ctx, state.subtitle, 'Pacifico', Math.round(W * 0.045), W * 0.8, '400');
    ctx.font = '400 ' + subSize + 'px Pacifico';
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = Math.round(W * 0.016);
    ctx.fillStyle = '#ff7ad9';
    ctx.fillText(state.subtitle, tx, H * 0.95);
    ctx.shadowBlur = 0;

    ctx.font = '400 ' + Math.max(11, Math.round(W * 0.02)) + 'px Anton';
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'right';
    ctx.fillText('★ ★ ★ ★ ★', W * 0.95, H * 0.06);
    ctx.textAlign = 'left';
  }

  /* ---------- the cover ---------- */

  function drawCover(ctx, W, H) {
    var grade = GRADES[state.grade];
    var geo = layoutPanels(state.layout, W, H);
    var g = Math.max(4, Math.round(W * 0.008));
    ctx.fillStyle = '#160a2e';
    ctx.fillRect(0, 0, W, H);
    lastPanelRects = [];

    if (state.layout === 'snaps') {
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#ff9a3c');
      sky.addColorStop(0.45, '#ff2d78');
      sky.addColorStop(1, '#2b0a4a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      var sun = ctx.createRadialGradient(W * 0.74, H * 0.3, 4, W * 0.74, H * 0.3, W * 0.16);
      sun.addColorStop(0, 'rgba(255,240,180,0.95)');
      sun.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, W, H);
    }

    geo.panels.forEach(function (frac, i) {
      var rect = { x: frac.x * W, y: frac.y * H, w: frac.w * W, h: frac.h * H };
      var ps = panelState(state.layout, i);
      var photo = state.photos[ps.photo] || state.photos[0];
      var pad = state.layout === 'snaps' ? Math.max(8, W * 0.014) : g;
      var inner = {
        x: rect.x + pad,
        y: rect.y + pad,
        w: rect.w - pad * 2,
        h: rect.h - pad * (state.layout === 'snaps' ? 3.2 : 2)
      };
      lastPanelRects.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, index: i });
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(frac.rot || 0);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.round(W * 0.02);
      ctx.shadowOffsetY = Math.round(W * 0.008);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      if (photo) drawPanelPhoto(ctx, inner, photo, ps.zoom, ps.ox, ps.oy, grade);
      ctx.restore();
    });

    if (state.layout === 'full') {
      drawFullBleedTitle(ctx, { x: 0, y: geo.title.y * H, w: W, h: geo.title.h * H }, W, H);
    } else if (state.layout === 'snaps') {
      var t = { x: 0, y: geo.title.y * H, w: W, h: geo.title.h * H };
      var title = (state.title || 'UNTITLED').toUpperCase();
      var size = fitFont(ctx, title, 'Anton', Math.round(W * 0.11), W * 0.94, '400');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var grad = ctx.createLinearGradient(0, t.y, 0, t.y + t.h * 0.7);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.6, '#ffd76a');
      grad.addColorStop(1, '#ff5e3a');
      ctx.lineWidth = Math.max(2, size * 0.05);
      ctx.strokeStyle = '#1a0b2e';
      ctx.lineJoin = 'round';
      ctx.strokeText(title, W / 2, t.y + t.h * 0.36);
      ctx.fillStyle = grad;
      ctx.fillText(title, W / 2, t.y + t.h * 0.36);
      var subSize = fitFont(ctx, state.subtitle, 'Pacifico', Math.round(W * 0.042), W * 0.86, '400');
      ctx.font = '400 ' + subSize + 'px Pacifico';
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = Math.round(W * 0.018);
      ctx.fillStyle = '#ff7ad9';
      ctx.fillText(state.subtitle, W / 2, t.y + t.h * 0.8);
      ctx.shadowBlur = 0;
    } else {
      drawTitleBlock(ctx, { x: 0, y: geo.title.y * H, w: W, h: geo.title.h * H }, W, H);
    }

    drawGrain(ctx, W, H);
    drawVignette(ctx, W, H);

    if (state.selectedPanel != null && document.body.classList.contains('editing')) {
      var sel = lastPanelRects[state.selectedPanel];
      if (sel) {
        ctx.save();
        ctx.strokeStyle = '#ffd76a';
        ctx.lineWidth = Math.max(3, W * 0.004);
        ctx.setLineDash([Math.round(W * 0.02), Math.round(W * 0.012)]);
        ctx.strokeRect(sel.x + 2, sel.y + 2, sel.w - 4, sel.h - 4);
        ctx.restore();
      }
    }
  }

  function renderPreview() {
    var size = SIZES[state.size];
    if (preview.width !== size.w || preview.height !== size.h) {
      preview.width = size.w;
      preview.height = size.h;
    }
    drawCover(pctx, size.w, size.h);
  }

  /* ---------- export ---------- */

  function exportCover(sizeKey) {
    var size = SIZES[sizeKey];
    var off = document.createElement('canvas');
    off.width = size.w;
    off.height = size.h;
    var octx = off.getContext('2d');
    var savedSelection = state.selectedPanel;
    state.selectedPanel = null;
    drawCover(octx, size.w, size.h);
    state.selectedPanel = savedSelection;
    renderPreview();
    return new Promise(function (resolve) {
      off.toBlob(function (blob) {
        if (!blob) { resolve(null); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'vice-coast-cover-' + size.w + 'x' + size.h + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        resolve(blob);
      }, 'image/png');
    });
  }

  function setStatus(text) { statusEl.textContent = text; }

  /* ---------- photos ---------- */

  function addPhoto(img, name) {
    state.photos.push({ img: img, name: name });
    buildStrip();
  }

  function buildStrip() {
    var strip = document.getElementById('sampleStrip');
    strip.innerHTML = '';
    state.photos.forEach(function (photo, i) {
      var thumb = document.createElement('img');
      thumb.src = photo.img.src;
      thumb.alt = photo.name;
      thumb.title = photo.name + ' — click to put it in the selected panel';
      thumb.addEventListener('click', function () {
        var ps = panelState(state.layout, state.selectedPanel);
        ps.photo = i;
        buildStrip();
        renderPreview();
      });
      var sel = panelState(state.layout, state.selectedPanel);
      if (sel.photo === i) thumb.classList.add('assigned');
      strip.appendChild(thumb);
    });
  }

  function loadSamples(done) {
    var remaining = SAMPLES.length;
    SAMPLES.forEach(function (sample) {
      var img = new Image();
      img.onload = function () {
        addPhoto(img, sample.name);
        if (--remaining === 0) done();
      };
      img.onerror = function () { if (--remaining === 0) done(); };
      img.src = sample.src;
    });
  }

  /* ---------- events ---------- */

  function bindEvents() {
    document.getElementById('photoInput').addEventListener('change', function (event) {
      var files = Array.prototype.slice.call(event.target.files || []);
      if (!files.length) return;
      var pending = files.length;
      files.forEach(function (file) {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            addPhoto(img, file.name);
            var ps = panelState(state.layout, state.selectedPanel);
            ps.photo = state.photos.length - 1;
            buildStrip();
            renderPreview();
            if (--pending === 0) setStatus(files.length + ' photo(s) added — click a panel, then a photo, to place it.');
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    });

    document.getElementById('fillAll').addEventListener('click', function () {
      var geo = layoutPanels(state.layout, 1, 1);
      geo.panels.forEach(function (frac, i) { panelState(state.layout, i).photo = 0; });
      buildStrip();
      renderPreview();
      setStatus('Every panel now shows the first photo.');
    });

    document.getElementById('layoutButtons').addEventListener('click', function (event) {
      var button = event.target.closest('button[data-layout]');
      if (!button) return;
      state.layout = button.dataset.layout;
      state.selectedPanel = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#layoutButtons button'), function (b) {
        b.classList.toggle('active', b === button);
      });
      buildStrip();
      renderPreview();
    });

    document.getElementById('gradeButtons').addEventListener('click', function (event) {
      var button = event.target.closest('button[data-grade]');
      if (!button) return;
      state.grade = button.dataset.grade;
      Array.prototype.forEach.call(document.querySelectorAll('#gradeButtons button'), function (b) {
        b.classList.toggle('active', b === button);
      });
      renderPreview();
    });

    document.getElementById('titleInput').addEventListener('input', function (event) {
      state.title = event.target.value;
      renderPreview();
    });
    document.getElementById('subtitleInput').addEventListener('input', function (event) {
      state.subtitle = event.target.value;
      renderPreview();
    });

    document.getElementById('zoomSlider').addEventListener('input', function (event) {
      var ps = panelState(state.layout, state.selectedPanel);
      ps.zoom = parseFloat(event.target.value);
      ps.ox = Math.max(-0.5, Math.min(0.5, ps.ox));
      ps.oy = Math.max(-0.5, Math.min(0.5, ps.oy));
      renderPreview();
    });

    document.getElementById('fitButton').addEventListener('click', function () {
      var ps = panelState(state.layout, state.selectedPanel);
      ps.zoom = 1; ps.ox = 0; ps.oy = 0;
      document.getElementById('zoomSlider').value = '1';
      renderPreview();
    });

    document.getElementById('exportSquare').addEventListener('click', function () {
      state.size = 'square';
      exportCover('square').then(function () { setStatus('Exported 1080 x 1080 PNG — check your downloads.'); });
    });
    document.getElementById('exportPortrait').addEventListener('click', function () {
      state.size = 'portrait';
      exportCover('portrait').then(function () { setStatus('Exported 1080 x 1350 PNG — check your downloads.'); });
    });
    document.getElementById('exportWide').addEventListener('click', function () {
      state.size = 'wide';
      exportCover('wide').then(function () { setStatus('Exported 1920 x 1080 PNG — check your downloads.'); });
    });
    document.getElementById('exportAll').addEventListener('click', async function () {
      for (var i = 0; i < 3; i++) {
        var key = ['square', 'portrait', 'wide'][i];
        state.size = key;
        await exportCover(key);
        setStatus('Exported ' + SIZES[key].label + ' PNG (' + (i + 1) + ' of 3)…');
        await new Promise(function (r) { setTimeout(r, 450); });
      }
      setStatus('All three sizes exported — check your downloads.');
    });

    var dragging = null;
    function canvasPoint(event) {
      var rect = preview.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (preview.width / rect.width),
        y: (event.clientY - rect.top) * (preview.height / rect.height)
      };
    }
    function hitPanel(point) {
      for (var i = lastPanelRects.length - 1; i >= 0; i--) {
        var r = lastPanelRects[i];
        if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) return i;
      }
      return -1;
    }
    preview.addEventListener('pointerdown', function (event) {
      var point = canvasPoint(event);
      var hit = hitPanel(point);
      if (hit < 0) return;
      state.selectedPanel = hit;
      var ps = panelState(state.layout, hit);
      document.getElementById('zoomSlider').value = String(ps.zoom);
      buildStrip();
      renderPreview();
      dragging = { x: point.x, y: point.y, panel: hit };
      preview.setPointerCapture(event.pointerId);
    });
    preview.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var point = canvasPoint(event);
      var ps = panelState(state.layout, dragging.panel);
      var rect = lastPanelRects[dragging.panel];
      var geo = layoutPanels(state.layout, preview.width, preview.height);
      var frac = geo.panels[dragging.panel];
      var rw = frac.w * preview.width, rh = frac.h * preview.height;
      var photo = state.photos[ps.photo] || state.photos[0];
      if (!photo || !rect) return;
      var base = Math.max(rw / photo.img.naturalWidth, rh / photo.img.naturalHeight);
      var dw = photo.img.naturalWidth * base * ps.zoom;
      var dh = photo.img.naturalHeight * base * ps.zoom;
      if (dw > rw) ps.ox = Math.max(-0.5, Math.min(0.5, ps.ox + (point.x - dragging.x) / (dw - rw)));
      if (dh > rh) ps.oy = Math.max(-0.5, Math.min(0.5, ps.oy + (point.y - dragging.y) / (dh - rh)));
      dragging.x = point.x;
      dragging.y = point.y;
      renderPreview();
    });
    preview.addEventListener('pointerup', function () { dragging = null; });
    preview.addEventListener('wheel', function (event) {
      event.preventDefault();
      var point = canvasPoint(event);
      var hit = hitPanel(point);
      if (hit < 0) return;
      var ps = panelState(state.layout, hit);
      ps.zoom = Math.max(1, Math.min(3, ps.zoom * Math.exp(-event.deltaY * 0.0012)));
      document.getElementById('zoomSlider').value = String(ps.zoom);
      renderPreview();
    }, { passive: false });
  }

  /* ---------- screenshot mode ---------- */

  function shotMode() {
    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    if (!shot) return false;
    if (params.get('layout') && layoutPanels(params.get('layout'), 1, 1)) state.layout = params.get('layout');
    if (params.get('grade') && GRADES[params.get('grade')]) state.grade = params.get('grade');
    if (params.get('title')) { state.title = params.get('title'); document.getElementById('titleInput').value = state.title; }
    if (params.get('subtitle')) { state.subtitle = params.get('subtitle'); document.getElementById('subtitleInput').value = state.subtitle; }
    if (params.get('size') && SIZES[params.get('size')]) state.size = params.get('size');
    var photoName = params.get('photo');
    if (photoName) {
      var idx = SAMPLES.findIndex(function (s) { return s.src.indexOf(photoName) !== -1; });
      if (idx >= 0) {
        var geo = layoutPanels(state.layout, 1, 1);
        geo.panels.forEach(function (frac, i) { panelState(state.layout, i).photo = idx; });
      }
    }
    var photoList = params.get('photos');
    if (photoList) {
      photoList.split(',').forEach(function (part, i) {
        var n = parseInt(part, 10);
        if (!isNaN(n) && n >= 0 && n < SAMPLES.length) panelState(state.layout, i).photo = n;
      });
    }
    if (shot === 'cover') {
      document.body.classList.add('shot-cover');
      document.body.classList.remove('editing');
      state.selectedPanel = null;
      var size = SIZES[state.size];
      preview.width = Math.round(window.innerWidth * (window.devicePixelRatio || 1));
      preview.height = Math.round(window.innerHeight * (window.devicePixelRatio || 1));
      drawCover(pctx, preview.width, preview.height);
      document.title = 'cover-ready';
      return true;
    }
    document.body.classList.add('editing');
    return true;
  }

  /* ---------- start ---------- */

  function start() {
    document.body.classList.add('editing');
    bindEvents();
    var inShot = shotMode();
    Promise.all([
      document.fonts.load('90px Anton'),
      document.fonts.load('48px Pacifico'),
      document.fonts.ready
    ]).catch(function () {}).then(function () {
      loadSamples(function () {
        if (!inShot || document.body.classList.contains('editing')) renderPreview();
        else drawCover(pctx, preview.width, preview.height);
        buildStrip();
      });
    });
    renderPreview();
  }

  window.__coverApp = {
    state: state,
    exportCover: exportCover,
    renderPreview: renderPreview,
    drawCover: drawCover,
    ready: function () { return state.photos.length > 0; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
