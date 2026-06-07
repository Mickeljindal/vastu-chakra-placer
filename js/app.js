/* =====================================================================
   Vastu Shakti Chakra Placer
   Workflow:
     1. Upload floor plan (image / PDF)
     2. Mark 4 corners → auto-find Brahmasthan (center) via diagonals
        OR manually click the center
     3. Set North direction (click on plan OR enter degrees)
     4. Chakra places at center, rotated to North → user fine-tunes
   ===================================================================== */
(function () {
  "use strict";

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  /* ============ STATE ============ */
  const view = { tx: 0, ty: 0, zoom: 1 };
  const plan = { img: null, w: 0, h: 0 };

  // Step 2 - corners & center
  const corners = [];   // [{x,y},...] in world coords
  let centerPt = null;  // {x,y} world coords (Brahmasthan)
  let centerLocked = false;

  // Step 3 - north
  let northAngle = null; // degrees clockwise from top of image = 0
  let northLocked = false;

  // Step 4 - chakra
  const chakra = {
    img: null,
    natW: 0, natH: 0,
    scale: 1,         // size multiplier
    rotation: 0,      // absolute rotation of the chakra in degrees (0 = chakra North at image top)
    opacity: 0.8,
  };

  // Watermark / expert branding
  const watermark = {
    enabled: false,
    name: "",
    title: "",
    contact: "",
    logo: null,        // Image object
    position: "bottom-right",
    size: 1,           // scale multiplier
    opacity: 0.9,
  };

  // Interaction modes
  let mode = "idle"; // idle | pan | markCorners | markCenter | markNorth

  // PDF
  let pdfDoc = null, pdfPage = 1, pdfPages = 1;

  /* ============ ELEMENTS ============ */
  const $ = (id) => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const els = {
    stageWrap: $("stageWrap"), emptyState: $("emptyState"),
    status: $("status"), zoomBadge: $("zoomBadge"), modeBadge: $("modeBadge"),
    dropZone: $("dropZone"), fileInput: $("fileInput"),
    pdfPager: $("pdfPager"), pdfPrev: $("pdfPrev"), pdfNext: $("pdfNext"), pdfPageLabel: $("pdfPageLabel"),
    // source tabs / map
    tabUpload: $("tabUpload"), tabMap: $("tabMap"),
    srcUpload: $("srcUpload"), srcMap: $("srcMap"),
    mapSearch: $("mapSearch"), mapHolder: $("mapHolder"), mapPlaceholder: $("mapPlaceholder"),
    mapNorthNote: $("mapNorthNote"), btnCaptureMap: $("btnCaptureMap"),
    mapKeyBox: $("mapKeyBox"), mapKeyInput: $("mapKeyInput"),
    btnSaveMapKey: $("btnSaveMapKey"), btnClearMapKey: $("btnClearMapKey"),
    mapSearchField: $("mapSearchField"),
    panelUpload: $("panelUpload"), panelCenter: $("panelCenter"),
    panelNorth: $("panelNorth"), panelAdjust: $("panelAdjust"),
    cornerStatus: $("cornerStatus"),
    btnMarkCorners: $("btnMarkCorners"), btnResetCorners: $("btnResetCorners"),
    btnLockCenter: $("btnLockCenter"), btnManualCenter: $("btnManualCenter"),
    btnSetNorth: $("btnSetNorth"), btnNorthManual: $("btnNorthManual"),
    northDegControl: $("northDegControl"), northDegRange: $("northDegRange"), northDegVal: $("northDegVal"),
    btnLockNorth: $("btnLockNorth"),
    fineRotRange: $("fineRotRange"), fineRotVal: $("fineRotVal"),
    sizeRange: $("sizeRange"), sizeVal: $("sizeVal"),
    opacityRange: $("opacityRange"), opacityVal: $("opacityVal"),
    dimPlan: $("dimPlan"),
    btnStartOver: $("btnStartOver"),
    chakraDrop: $("chakraDrop"), chakraInput: $("chakraInput"),
    btnZoomIn: $("btnZoomIn"), btnZoomOut: $("btnZoomOut"),
    btnZoom100: $("btnZoom100"), btnFit: $("btnFit"),
    btnDownload: $("btnDownload"),
    // watermark
    wmEnable: $("wmEnable"), wmBody: $("wmBody"),
    wmName: $("wmName"), wmTitle: $("wmTitle"), wmContact: $("wmContact"),
    wmLogoDrop: $("wmLogoDrop"), wmLogoInput: $("wmLogoInput"),
    wmLogoLabel: $("wmLogoLabel"), wmLogoClear: $("wmLogoClear"),
    wmPosition: $("wmPosition"),
    wmSizeRange: $("wmSizeRange"), wmSizeVal: $("wmSizeVal"),
    wmOpacityRange: $("wmOpacityRange"), wmOpacityVal: $("wmOpacityVal"),
  };

  function setStatus(msg) { els.status.textContent = msg || ""; }
  function setMode(m, label) {
    mode = m;
    canvas.classList.toggle("crosshair", m !== "idle" && m !== "pan");
    els.modeBadge.hidden = !label;
    els.modeBadge.textContent = label || "";
  }

  /* ============ PANEL FLOW ============ */
  function enablePanel(panel) { panel.classList.remove("disabled"); }
  function disablePanel(panel) { panel.classList.add("disabled"); }
  function donePanel(panel) { panel.classList.add("done"); }

  function resetToStep(step) {
    if (step <= 1) {
      disablePanel(els.panelCenter); disablePanel(els.panelNorth); disablePanel(els.panelAdjust);
      els.panelCenter.classList.remove("done"); els.panelNorth.classList.remove("done");
      corners.length = 0; centerPt = null; centerLocked = false;
      northAngle = null; northLocked = false;
      updateCornerDots();
    }
    if (step <= 2) {
      disablePanel(els.panelNorth); disablePanel(els.panelAdjust);
      els.panelNorth.classList.remove("done");
      northAngle = null; northLocked = false;
      els.btnLockNorth.hidden = true;
    }
    if (step <= 3) {
      disablePanel(els.panelAdjust);
    }
    setMode("idle", null);
    render();
  }

  /* ============ CANVAS SIZING ============ */
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const r = els.stageWrap.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }
  window.addEventListener("resize", resizeCanvas);
  function cssSize() { const r = els.stageWrap.getBoundingClientRect(); return { w: r.width, h: r.height }; }

  /* ============ COORD TRANSFORMS ============ */
  function w2s(x, y) { return { x: x * view.zoom + view.tx, y: y * view.zoom + view.ty }; }
  function s2w(x, y) { return { x: (x - view.tx) / view.zoom, y: (y - view.ty) / view.zoom }; }

  /* ============ VIEW ============ */
  function fitView() {
    if (!plan.img) return;
    const { w, h } = cssSize();
    const pad = 50;
    view.zoom = Math.min((w - pad) / plan.w, (h - pad) / plan.h);
    view.tx = (w - plan.w * view.zoom) / 2;
    view.ty = (h - plan.h * view.zoom) / 2;
    updateZoomBadge(); render();
  }
  function updateZoomBadge() { els.zoomBadge.hidden = !plan.img; els.zoomBadge.textContent = Math.round(view.zoom * 100) + "%"; }

  function zoomBy(factor) {
    const { w, h } = cssSize();
    const cx = w / 2, cy = h / 2;
    const before = s2w(cx, cy);
    view.zoom = Math.max(0.05, Math.min(30, view.zoom * factor));
    view.tx = cx - before.x * view.zoom; view.ty = cy - before.y * view.zoom;
    updateZoomBadge(); render();
  }

  /* ============ FLOOR PLAN LOADING ============ */
  function setPlan(bitmap, w, h) {
    plan.img = bitmap; plan.w = w; plan.h = h;
    els.emptyState.style.display = "none";
    enablePanel(els.panelCenter);
    donePanel(els.panelUpload);
    fitView(); setStatus("");
  }

  function loadImage(file) {
    setStatus("Loading…");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); els.pdfPager.hidden = true; pdfDoc = null; setPlan(img, img.naturalWidth, img.naturalHeight); };
    img.onerror = () => setStatus("Could not load image.");
    img.src = url;
  }

  async function loadPdf(file) {
    if (!window.pdfjsLib) { setStatus("PDF library not loaded."); return; }
    setStatus("Loading PDF…");
    const buf = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    pdfPages = pdfDoc.numPages; pdfPage = 1;
    els.pdfPager.hidden = false;
    await renderPdfPage();
  }
  async function renderPdfPage() {
    if (!pdfDoc) return;
    setStatus("Rendering page…");
    const page = await pdfDoc.getPage(pdfPage);
    const bvp = page.getViewport({ scale: 1 });
    const scale = 2400 / Math.max(bvp.width, bvp.height);
    const vp = page.getViewport({ scale });
    const off = document.createElement("canvas");
    off.width = Math.round(vp.width); off.height = Math.round(vp.height);
    await page.render({ canvasContext: off.getContext("2d"), viewport: vp }).promise;
    els.pdfPageLabel.textContent = `${pdfPage} / ${pdfPages}`;
    setPlan(off, off.width, off.height);
  }
  function handleFile(file) {
    if (!file) return;
    resetToStep(1);
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) loadPdf(file).catch(() => setStatus("PDF error."));
    else if (file.type.startsWith("image/")) loadImage(file);
    else setStatus("Unsupported file.");
  }

  /* ============ CHAKRA IMAGE ============ */
  function loadChakraFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); chakra.img = img; chakra.natW = img.naturalWidth; chakra.natH = img.naturalHeight; render(); };
    img.src = url;
  }

  /* ============ STEP 2: CORNERS & CENTER ============ */
  function updateCornerDots() {
    for (let i = 0; i < 4; i++) {
      $("c" + i).classList.toggle("set", i < corners.length);
    }
  }

  function computeCenter() {
    if (corners.length < 4) return null;
    // intersection of diagonals: corner0-corner2 and corner1-corner3
    const p = lineIntersection(corners[0], corners[2], corners[1], corners[3]);
    return p;
  }

  function lineIntersection(a, b, c, d) {
    const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denom) < 0.001) {
      // lines parallel — fallback: average of all corners
      return { x: (a.x + b.x + c.x + d.x) / 4, y: (a.y + b.y + c.y + d.y) / 4 };
    }
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  }

  /* ============ RENDERING ============ */
  function render() {
    const { w, h } = cssSize();
    ctx.clearRect(0, 0, w, h);
    if (!plan.img) return;

    // floor plan
    ctx.save();
    ctx.translate(view.tx, view.ty); ctx.scale(view.zoom, view.zoom);
    if (els.dimPlan.checked) ctx.filter = "brightness(0.5)";
    ctx.drawImage(plan.img, 0, 0, plan.w, plan.h);
    ctx.filter = "none";
    ctx.restore();

    // corners & diagonals
    if (corners.length > 0) {
      ctx.save();
      corners.forEach((c, i) => {
        const s = w2s(c.x, c.y);
        dot(s.x, s.y, "#2ecc71", 7);
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText((i + 1).toString(), s.x, s.y - 12);
      });
      // draw outline
      if (corners.length >= 2) {
        ctx.strokeStyle = "rgba(46,204,113,.7)"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
        ctx.beginPath();
        for (let i = 0; i < corners.length; i++) {
          const s = w2s(corners[i].x, corners[i].y);
          i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
        }
        if (corners.length === 4) ctx.closePath();
        ctx.stroke(); ctx.setLineDash([]);
      }
      // diagonals
      if (corners.length === 4) {
        ctx.strokeStyle = "rgba(255,122,0,.6)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        const s0 = w2s(corners[0].x, corners[0].y), s2 = w2s(corners[2].x, corners[2].y);
        const s1 = w2s(corners[1].x, corners[1].y), s3 = w2s(corners[3].x, corners[3].y);
        ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s3.x, s3.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // center point (Brahmasthan)
    if (centerPt) {
      const sc = w2s(centerPt.x, centerPt.y);
      // crosshair
      ctx.save();
      ctx.strokeStyle = centerLocked ? "#ff7a00" : "rgba(255,122,0,.7)";
      ctx.lineWidth = 1.5;
      const cr = 18;
      ctx.beginPath(); ctx.moveTo(sc.x - cr, sc.y); ctx.lineTo(sc.x + cr, sc.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sc.x, sc.y - cr); ctx.lineTo(sc.x, sc.y + cr); ctx.stroke();
      dot(sc.x, sc.y, "#ff7a00", 5);
      // label
      ctx.fillStyle = "#ff7a00"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("Brahmasthan", sc.x + 12, sc.y - 8);
      ctx.restore();
    }

    // North direction line
    if (centerPt && northAngle !== null) {
      const len = Math.min(plan.w, plan.h) * 0.3;
      const rad = (northAngle - 90) * Math.PI / 180; // northAngle: 0=up
      const ex = centerPt.x + len * Math.cos(rad + Math.PI / 2 * 0);
      // angle: 0 = up (negative Y)
      const nx = centerPt.x + len * Math.sin(northAngle * Math.PI / 180);
      const ny = centerPt.y - len * Math.cos(northAngle * Math.PI / 180);
      const sc = w2s(centerPt.x, centerPt.y);
      const sn = w2s(nx, ny);
      ctx.save();
      ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(sc.x, sc.y); ctx.lineTo(sn.x, sn.y); ctx.stroke();
      // arrowhead
      const ang = Math.atan2(sn.y - sc.y, sn.x - sc.x);
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.moveTo(sn.x, sn.y);
      ctx.lineTo(sn.x - 12 * Math.cos(ang - 0.4), sn.y - 12 * Math.sin(ang - 0.4));
      ctx.lineTo(sn.x - 12 * Math.cos(ang + 0.4), sn.y - 12 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
      // label
      ctx.fillStyle = "#e74c3c"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("N", sn.x, sn.y - 14);
      ctx.restore();
    }

    // Chakra overlay (only when center locked & north set)
    if (centerLocked && northLocked && chakra.img) {
      const size = Math.min(plan.w, plan.h) * (chakra.scale);
      const sc = w2s(centerPt.x, centerPt.y);
      const dw = size * view.zoom;
      const totalRot = chakra.rotation; // absolute: chakra North aligns to plan North (set when North locked)
      ctx.save();
      ctx.translate(sc.x, sc.y);
      ctx.rotate(totalRot * Math.PI / 180);
      ctx.globalAlpha = chakra.opacity;
      ctx.drawImage(chakra.img, -dw / 2, -dw / 2, dw, dw);
      ctx.restore();
    }

    // Watermark (drawn in plan space via the view transform so the live
    // preview matches the export exactly)
    if (watermark.enabled) {
      ctx.save();
      ctx.translate(view.tx, view.ty);
      ctx.scale(view.zoom, view.zoom);
      drawWatermark(ctx);
      ctx.restore();
    }
  }

  function dot(x, y, color, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  /* ============ WATERMARK ============
     Draws in plan-pixel space onto the given context. Used by both the
     live canvas preview (with the view transform applied) and the export
     (drawn directly at full resolution). Returns nothing.
  */
  function drawWatermark(g) {
    if (!watermark.enabled || !plan.img) return;
    const hasText = watermark.name || watermark.title || watermark.contact;
    if (!hasText && !watermark.logo) return;

    // base unit scales with the plan so it looks consistent at any resolution
    const unit = Math.min(plan.w, plan.h) * 0.022 * watermark.size;
    const pad = unit * 0.9;
    const margin = Math.min(plan.w, plan.h) * 0.03;
    const lineGap = unit * 1.35;

    // font sizes
    const fsName = unit * 1.15;
    const fsTitle = unit * 0.78;
    const fsContact = unit * 0.72;

    // measure text block
    g.save();
    g.textBaseline = "top";
    const lines = [];
    if (watermark.name) lines.push({ text: watermark.name, font: `700 ${fsName}px "Inter", sans-serif`, color: "#fff", h: fsName });
    if (watermark.title) lines.push({ text: watermark.title, font: `500 ${fsTitle}px "Inter", sans-serif`, color: "#ffe6c7", h: fsTitle });
    if (watermark.contact) lines.push({ text: watermark.contact, font: `500 ${fsContact}px "Inter", sans-serif`, color: "#f3e3c8", h: fsContact });

    let textW = 0;
    lines.forEach((ln) => { g.font = ln.font; textW = Math.max(textW, g.measureText(ln.text).width); });
    // total text block height (first line full height, subsequent lines spaced by lineGap)
    let computedTextH = 0;
    lines.forEach((ln, i) => { computedTextH += (i === 0 ? ln.h : lineGap); });

    // logo dimensions
    let logoW = 0, logoH = 0;
    if (watermark.logo) {
      logoH = unit * 2.4;
      logoW = logoH * (watermark.logo.naturalWidth / watermark.logo.naturalHeight || 1);
    }

    const contentW = Math.max(textW, 0) + (logoW ? logoW + (textW ? pad * 0.8 : 0) : 0);
    const contentH = Math.max(computedTextH, logoH);
    const boxW = contentW + pad * 2;
    const boxH = contentH + pad * 1.4;

    // position
    let bx, by;
    const pos = watermark.position;
    if (pos.includes("left")) bx = margin;
    else if (pos.includes("center")) bx = (plan.w - boxW) / 2;
    else bx = plan.w - boxW - margin; // right
    by = pos.includes("top") ? margin : plan.h - boxH - margin;

    g.globalAlpha = watermark.opacity;

    // rounded translucent plaque
    const r = pad * 0.6;
    g.fillStyle = "rgba(46, 26, 15, 0.62)";
    roundRect(g, bx, by, boxW, boxH, r);
    g.fill();
    // saffron accent bar on the left
    g.fillStyle = "rgba(224,123,26,0.95)";
    roundRect(g, bx, by, Math.max(3, unit * 0.16), boxH, 0);
    g.fill();

    // content origin
    let cx = bx + pad;
    const cyTop = by + (boxH - contentH) / 2;

    // logo
    if (watermark.logo) {
      g.globalAlpha = watermark.opacity;
      g.drawImage(watermark.logo, cx, by + (boxH - logoH) / 2, logoW, logoH);
      cx += logoW + (textW ? pad * 0.8 : 0);
    }

    // text lines
    let ty = cyTop;
    lines.forEach((ln, i) => {
      if (i > 0) ty += lineGap; else ty = cyTop;
      g.font = ln.font;
      g.fillStyle = ln.color;
      g.textAlign = "left";
      g.fillText(ln.text, cx, ty);
    });

    g.restore();
  }

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ============ POINTER INTERACTIONS ============ */
  let dragData = null;
  function getPos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  canvas.addEventListener("pointerdown", (e) => {
    if (!plan.img) return;
    const p = getPos(e);
    canvas.setPointerCapture(e.pointerId);

    if (mode === "markCorners") {
      const wp = s2w(p.x, p.y);
      if (corners.length < 4) {
        corners.push(wp);
        updateCornerDots();
        if (corners.length === 4) {
          centerPt = computeCenter();
          setStatus("Center found! Lock it or adjust corners.");
          setMode("idle", null);
        }
        render();
      }
      return;
    }

    if (mode === "markCenter") {
      centerPt = s2w(p.x, p.y);
      setMode("idle", null);
      setStatus("Center set. Lock it to proceed.");
      render();
      return;
    }

    if (mode === "markNorth") {
      const wp = s2w(p.x, p.y);
      // angle from center to this point (0 = up)
      const dx = wp.x - centerPt.x;
      const dy = wp.y - centerPt.y;
      northAngle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      northAngle = Math.round(northAngle * 10) / 10;
      els.northDegRange.value = northAngle;
      els.northDegVal.textContent = Math.round(northAngle);
      els.northDegControl.hidden = false;
      els.btnLockNorth.hidden = false;
      setMode("idle", null);
      setStatus("North set at " + Math.round(northAngle) + "°. Lock to place chakra.");
      render();
      return;
    }

    // default: pan
    mode = "pan"; canvas.classList.add("grabbing");
    dragData = { sx: p.x, sy: p.y, tx: view.tx, ty: view.ty };
  });

  canvas.addEventListener("pointermove", (e) => {
    if (mode !== "pan" || !dragData) return;
    const p = getPos(e);
    view.tx = dragData.tx + (p.x - dragData.sx);
    view.ty = dragData.ty + (p.y - dragData.sy);
    render();
  });

  canvas.addEventListener("pointerup", (e) => {
    if (mode === "pan") { mode = "idle"; canvas.classList.remove("grabbing"); dragData = null; }
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener("wheel", (e) => {
    if (!plan.img) return; e.preventDefault();
    const p = getPos(e); const before = s2w(p.x, p.y);
    view.zoom = Math.max(0.05, Math.min(30, view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    view.tx = p.x - before.x * view.zoom; view.ty = p.y - before.y * view.zoom;
    updateZoomBadge(); render();
  }, { passive: false });

  /* ============ STEP 2 BUTTONS ============ */
  els.btnMarkCorners.addEventListener("click", () => {
    corners.length = 0; centerPt = null; updateCornerDots();
    setMode("markCorners", "Click 4 corners of property boundary");
    setStatus("Click 4 corners clockwise (NE → SE → SW → NW)");
    render();
  });
  els.btnResetCorners.addEventListener("click", () => {
    corners.length = 0; centerPt = null; centerLocked = false; updateCornerDots();
    resetToStep(2); render();
  });
  els.btnManualCenter.addEventListener("click", () => {
    setMode("markCenter", "Click to set center (Brahmasthan)");
    setStatus("Click the exact center point on the plan");
  });
  els.btnLockCenter.addEventListener("click", () => {
    if (!centerPt) { setStatus("Set the center first!"); return; }
    centerLocked = true;
    donePanel(els.panelCenter);
    enablePanel(els.panelNorth);
    setStatus("Center locked. Now set the North direction.");
    render();
  });

  /* ============ STEP 3 BUTTONS ============ */
  els.btnSetNorth.addEventListener("click", () => {
    setMode("markNorth", "Click toward NORTH from center");
    setStatus("Click a point on the plan that is toward North");
  });
  els.btnNorthManual.addEventListener("click", () => {
    els.northDegControl.hidden = false;
    els.btnLockNorth.hidden = false;
    northAngle = parseFloat(els.northDegRange.value);
    render();
  });
  els.northDegRange.addEventListener("input", (e) => {
    northAngle = parseFloat(e.target.value);
    els.northDegVal.textContent = Math.round(northAngle);
    render();
  });
  els.btnLockNorth.addEventListener("click", () => {
    if (northAngle === null) { setStatus("Set North first!"); return; }
    northLocked = true;
    donePanel(els.panelNorth);
    enablePanel(els.panelAdjust);
    // set initial chakra scale to fit nicely
    chakra.scale = 0.75;
    els.sizeRange.value = 75;
    els.sizeVal.textContent = "75";
    // align chakra North to the plan's North direction
    chakra.rotation = ((northAngle % 360) + 360) % 360;
    els.fineRotRange.value = chakra.rotation;
    els.fineRotVal.textContent = Math.round(chakra.rotation);
    setStatus("Chakra placed & aligned to North. Fine-tune below.");
    setMode("idle", null);
    render();
  });

  /* ============ STEP 4 CONTROLS ============ */
  els.fineRotRange.addEventListener("input", (e) => {
    chakra.rotation = parseFloat(e.target.value);
    els.fineRotVal.textContent = Math.round(chakra.rotation); render();
  });
  function nudgeRot(delta) {
    let v = chakra.rotation + delta;
    v = ((v % 360) + 360) % 360;        // wrap into 0..360
    chakra.rotation = Math.round(v * 10) / 10;
    els.fineRotRange.value = chakra.rotation;
    els.fineRotVal.textContent = Math.round(chakra.rotation);
    render();
  }
  $("btnRotMinus").addEventListener("click", () => nudgeRot(-1));
  $("btnRotPlus").addEventListener("click", () => nudgeRot(1));
  $("btnRotZero").addEventListener("click", () => {
    // re-align chakra North to the detected plan North
    chakra.rotation = ((northAngle % 360) + 360) % 360;
    els.fineRotRange.value = chakra.rotation;
    els.fineRotVal.textContent = Math.round(chakra.rotation);
    render();
  });
  els.sizeRange.addEventListener("input", (e) => {
    chakra.scale = parseInt(e.target.value, 10) / 100;
    els.sizeVal.textContent = e.target.value; render();
  });
  els.opacityRange.addEventListener("input", (e) => {
    chakra.opacity = parseInt(e.target.value, 10) / 100;
    els.opacityVal.textContent = e.target.value; render();
  });
  els.dimPlan.addEventListener("change", render);
  els.btnStartOver.addEventListener("click", () => {
    resetToStep(1);
    enablePanel(els.panelCenter);
    els.panelUpload.classList.add("done");
  });

  /* ============ VIEW BUTTONS ============ */
  els.btnFit.addEventListener("click", fitView);
  els.btnZoomIn.addEventListener("click", () => zoomBy(1.3));
  els.btnZoomOut.addEventListener("click", () => zoomBy(1 / 1.3));
  els.btnZoom100.addEventListener("click", () => {
    const { w, h } = cssSize(); const before = s2w(w / 2, h / 2);
    view.zoom = 1; view.tx = w / 2 - before.x; view.ty = h / 2 - before.y;
    updateZoomBadge(); render();
  });

  /* ============ WATERMARK CONTROLS ============ */
  const WM_KEY = "vastu_watermark_v1";

  function saveWatermark() {
    try {
      localStorage.setItem(WM_KEY, JSON.stringify({
        enabled: watermark.enabled, name: watermark.name, title: watermark.title,
        contact: watermark.contact, position: watermark.position,
        size: watermark.size, opacity: watermark.opacity,
        logo: watermark.logoDataUrl || null,
      }));
    } catch (_) {}
  }

  function restoreWatermark() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(WM_KEY) || "null"); } catch (_) {}
    if (!data) return;
    watermark.enabled = !!data.enabled;
    watermark.name = data.name || "";
    watermark.title = data.title || "";
    watermark.contact = data.contact || "";
    watermark.position = data.position || "bottom-right";
    watermark.size = data.size || 1;
    watermark.opacity = data.opacity != null ? data.opacity : 0.9;
    // reflect in UI
    els.wmEnable.checked = watermark.enabled;
    els.wmName.value = watermark.name;
    els.wmTitle.value = watermark.title;
    els.wmContact.value = watermark.contact;
    els.wmPosition.value = watermark.position;
    els.wmSizeRange.value = Math.round(watermark.size * 100);
    els.wmSizeVal.textContent = Math.round(watermark.size * 100);
    els.wmOpacityRange.value = Math.round(watermark.opacity * 100);
    els.wmOpacityVal.textContent = Math.round(watermark.opacity * 100);
    els.wmBody.classList.toggle("collapsed", !watermark.enabled);
    if (data.logo) {
      const img = new Image();
      img.onload = () => { watermark.logo = img; watermark.logoDataUrl = data.logo; els.wmLogoLabel.innerHTML = "<strong>Logo added ✓</strong>"; els.wmLogoClear.hidden = false; render(); };
      img.src = data.logo;
    }
  }

  els.wmEnable.addEventListener("change", (e) => {
    watermark.enabled = e.target.checked;
    els.wmBody.classList.toggle("collapsed", !watermark.enabled);
    saveWatermark(); render();
  });
  els.wmName.addEventListener("input", (e) => { watermark.name = e.target.value.trim(); saveWatermark(); render(); });
  els.wmTitle.addEventListener("input", (e) => { watermark.title = e.target.value.trim(); saveWatermark(); render(); });
  els.wmContact.addEventListener("input", (e) => { watermark.contact = e.target.value.trim(); saveWatermark(); render(); });
  els.wmPosition.addEventListener("change", (e) => { watermark.position = e.target.value; saveWatermark(); render(); });
  els.wmSizeRange.addEventListener("input", (e) => { watermark.size = parseInt(e.target.value, 10) / 100; els.wmSizeVal.textContent = e.target.value; saveWatermark(); render(); });
  els.wmOpacityRange.addEventListener("input", (e) => { watermark.opacity = parseInt(e.target.value, 10) / 100; els.wmOpacityVal.textContent = e.target.value; saveWatermark(); render(); });

  function loadWatermarkLogo(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        watermark.logo = img;
        watermark.logoDataUrl = reader.result;
        els.wmLogoLabel.innerHTML = "<strong>Logo added ✓</strong>";
        els.wmLogoClear.hidden = false;
        if (!watermark.enabled) { watermark.enabled = true; els.wmEnable.checked = true; els.wmBody.classList.remove("collapsed"); }
        saveWatermark(); render();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  els.wmLogoInput.addEventListener("change", (e) => loadWatermarkLogo(e.target.files[0]));
  els.wmLogoDrop.addEventListener("click", () => els.wmLogoInput.click());
  els.wmLogoClear.addEventListener("click", () => {
    watermark.logo = null; watermark.logoDataUrl = null;
    els.wmLogoLabel.innerHTML = "<strong>Add logo</strong>";
    els.wmLogoClear.hidden = true;
    saveWatermark(); render();
  });
  wireDrop(els.wmLogoDrop, loadWatermarkLogo);

  /* ============ GOOGLE MAPS (True North) ============ */
  let gmap = null, gmapsLoaded = false, gmapsLoading = false;
  let lastMapCenter = null, lastMapZoom = 19;
  const MAPS_KEY_STORE = "vastu_gmaps_key_v1";

  function mapsKey() {
    // priority: user-entered (localStorage) → config.js default
    let saved = "";
    try { saved = localStorage.getItem(MAPS_KEY_STORE) || ""; } catch (_) {}
    if (saved) return saved;
    return (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_MAPS_API_KEY) || "";
  }

  function reflectKeyUI() {
    const key = mapsKey();
    if (els.mapKeyInput && key) {
      // show a masked hint that a key is present, but keep the real value editable
      els.mapKeyInput.value = key;
    }
    if (els.btnClearMapKey) els.btnClearMapKey.hidden = !key;
  }

  function switchSource(src) {
    const isMap = src === "map";
    els.tabUpload.classList.toggle("active", !isMap);
    els.tabMap.classList.toggle("active", isMap);
    els.srcUpload.hidden = isMap;
    els.srcMap.hidden = !isMap;
    if (isMap) initMapsFeature();
  }

  function initMapsFeature() {
    if (!mapsKey()) {
      // no key — show the key input box, keep upload available
      if (els.mapKeyBox) els.mapKeyBox.style.display = "block";
      els.mapPlaceholder.style.display = "flex";
      els.btnCaptureMap.hidden = true;
      els.mapNorthNote.hidden = true;
      if (els.mapSearchField) els.mapSearchField.hidden = true;
      return;
    }
    if (gmapsLoaded || gmapsLoading) return;
    gmapsLoading = true;
    setStatus("Loading map…");
    const s = document.createElement("script");
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(mapsKey()) +
            "&libraries=places&callback=__initGMap";
    s.async = true; s.defer = true;
    s.onerror = () => { setStatus("Map failed to load. Check API key."); gmapsLoading = false; };
    window.__initGMap = onGMapReady;
    document.head.appendChild(s);
  }

  function onGMapReady() {
    gmapsLoaded = true; gmapsLoading = false;
    setStatus("");
    if (els.mapKeyBox) els.mapKeyBox.style.display = "none";
    els.mapPlaceholder.style.display = "none";
    els.mapNorthNote.hidden = false;
    els.btnCaptureMap.hidden = false;
    if (els.mapSearchField) els.mapSearchField.hidden = false;

    gmap = new google.maps.Map(els.mapHolder, {
      center: { lat: 28.6139, lng: 77.2090 }, // default: New Delhi
      zoom: lastMapZoom,
      mapTypeId: "satellite",
      heading: 0,            // true North up
      tilt: 0,               // straight-down (plan view)
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      rotateControl: false,
      headingInteractionEnabled: false,  // keep locked to true North
      tiltInteractionEnabled: false,
    });

    // "NORTH ↑" badge overlay
    const badge = document.createElement("div");
    badge.className = "map-north-badge";
    badge.textContent = "NORTH ↑";
    els.mapHolder.appendChild(badge);

    // Places search box
    try {
      const ac = new google.maps.places.Autocomplete(els.mapSearch, { fields: ["geometry"] });
      ac.bindTo("bounds", gmap);
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place.geometry && place.geometry.location) {
          gmap.setCenter(place.geometry.location);
          gmap.setZoom(20);
        }
      });
    } catch (e) { /* Places may not be enabled; map still works */ }
  }

  // Use the Static Maps API to grab a clean, true-North satellite image
  // of the current view, then load it as the floor plan.
  function captureMapView() {
    if (!gmap) return;
    const c = gmap.getCenter();
    const z = Math.round(gmap.getZoom());
    if (!c) return;
    // request a large, high-DPI square image (640x640 max per tile * scale 2)
    const size = 640;
    const url = "https://maps.googleapis.com/maps/api/staticmap" +
      "?center=" + c.lat() + "," + c.lng() +
      "&zoom=" + z +
      "&size=" + size + "x" + size +
      "&scale=2" +
      "&maptype=satellite" +
      "&key=" + encodeURIComponent(mapsKey());
    setStatus("Capturing map…");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      resetToStep(1);
      els.pdfPager.hidden = true; pdfDoc = null;
      // map images are already true-North oriented: preset North to 0°
      setPlan(img, img.naturalWidth, img.naturalHeight);
      northAngle = 0;
      setStatus("Map captured — already aligned to true North.");
    };
    img.onerror = () => setStatus("Capture failed. Enable 'Maps Static API' for your key.");
    img.src = url;
  }

  els.tabUpload.addEventListener("click", () => switchSource("upload"));
  els.tabMap.addEventListener("click", () => switchSource("map"));
  els.btnCaptureMap.addEventListener("click", captureMapView);

  // API key save / clear
  els.btnSaveMapKey.addEventListener("click", () => {
    const key = (els.mapKeyInput.value || "").trim();
    if (!key) { setStatus("Paste an API key first."); return; }
    try { localStorage.setItem(MAPS_KEY_STORE, key); } catch (_) {}
    reflectKeyUI();
    setStatus("API key saved. Loading map…");
    initMapsFeature();
  });
  els.mapKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); els.btnSaveMapKey.click(); }
  });
  els.btnClearMapKey.addEventListener("click", () => {
    try { localStorage.removeItem(MAPS_KEY_STORE); } catch (_) {}
    els.mapKeyInput.value = "";
    els.btnClearMapKey.hidden = true;
    // reset map state so a new key can load fresh
    gmap = null; gmapsLoaded = false; gmapsLoading = false;
    els.mapKeyBox.style.display = "block";
    els.mapPlaceholder.style.display = "flex";
    els.mapPlaceholder.querySelector("p").textContent = "Enter your Google Maps API key above to load the map.";
    els.btnCaptureMap.hidden = true;
    els.mapNorthNote.hidden = true;
    if (els.mapSearchField) els.mapSearchField.hidden = true;
    setStatus("Saved key removed.");
  });
  reflectKeyUI();

  /* ============ FILE INPUTS ============ */
  els.fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
  els.dropZone.addEventListener("click", () => els.fileInput.click());
  els.chakraInput.addEventListener("change", (e) => loadChakraFile(e.target.files[0]));
  els.chakraDrop.addEventListener("click", () => els.chakraInput.click());

  function wireDrop(zone, fn) {
    ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
    zone.addEventListener("drop", (e) => { if (e.dataTransfer.files[0]) fn(e.dataTransfer.files[0]); });
  }
  wireDrop(els.dropZone, handleFile);
  wireDrop(els.chakraDrop, loadChakraFile);
  els.stageWrap.addEventListener("dragover", (e) => e.preventDefault());
  els.stageWrap.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

  // PDF pager
  els.pdfPrev.addEventListener("click", async () => { if (pdfDoc && pdfPage > 1) { pdfPage--; await renderPdfPage(); } });
  els.pdfNext.addEventListener("click", async () => { if (pdfDoc && pdfPage < pdfPages) { pdfPage++; await renderPdfPage(); } });

  /* ============ EXPORT PNG ============ */
  els.btnDownload.addEventListener("click", () => {
    if (!plan.img) { setStatus("Upload a floor plan first."); return; }
    const out = document.createElement("canvas"); out.width = plan.w; out.height = plan.h;
    const o = out.getContext("2d");
    if (els.dimPlan.checked) o.filter = "brightness(0.5)";
    o.drawImage(plan.img, 0, 0, plan.w, plan.h); o.filter = "none";

    // draw corners & diagonals
    if (corners.length > 0) {
      o.strokeStyle = "rgba(46,204,113,.8)"; o.lineWidth = 3; o.setLineDash([10, 8]);
      o.beginPath();
      corners.forEach((c, i) => i === 0 ? o.moveTo(c.x, c.y) : o.lineTo(c.x, c.y));
      if (corners.length === 4) o.closePath();
      o.stroke(); o.setLineDash([]);
      if (corners.length === 4) {
        o.strokeStyle = "rgba(255,122,0,.5)"; o.lineWidth = 2; o.setLineDash([6, 6]);
        o.beginPath(); o.moveTo(corners[0].x, corners[0].y); o.lineTo(corners[2].x, corners[2].y); o.stroke();
        o.beginPath(); o.moveTo(corners[1].x, corners[1].y); o.lineTo(corners[3].x, corners[3].y); o.stroke();
        o.setLineDash([]);
      }
    }

    // center
    if (centerPt) {
      o.strokeStyle = "#ff7a00"; o.lineWidth = 3;
      o.beginPath(); o.moveTo(centerPt.x - 30, centerPt.y); o.lineTo(centerPt.x + 30, centerPt.y); o.stroke();
      o.beginPath(); o.moveTo(centerPt.x, centerPt.y - 30); o.lineTo(centerPt.x, centerPt.y + 30); o.stroke();
    }

    // north line
    if (centerPt && northAngle !== null) {
      const len = Math.min(plan.w, plan.h) * 0.3;
      const nx = centerPt.x + len * Math.sin(northAngle * Math.PI / 180);
      const ny = centerPt.y - len * Math.cos(northAngle * Math.PI / 180);
      o.strokeStyle = "#e74c3c"; o.lineWidth = 4;
      o.beginPath(); o.moveTo(centerPt.x, centerPt.y); o.lineTo(nx, ny); o.stroke();
      o.fillStyle = "#e74c3c"; o.font = "bold 28px sans-serif"; o.textAlign = "center";
      o.fillText("N", nx, ny - 20);
    }

    // chakra
    if (centerLocked && northLocked && chakra.img) {
      const size = Math.min(plan.w, plan.h) * chakra.scale;
      const totalRot = chakra.rotation;
      o.save();
      o.translate(centerPt.x, centerPt.y);
      o.rotate(totalRot * Math.PI / 180);
      o.globalAlpha = chakra.opacity;
      o.drawImage(chakra.img, -size / 2, -size / 2, size, size);
      o.restore();
    }

    // watermark (drawn directly in plan-pixel space at full resolution)
    drawWatermark(o);

    out.toBlob((blob) => {
      const a = document.createElement("a"); a.download = `vastu-analysis-${Date.now()}.png`;
      a.href = URL.createObjectURL(blob); a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  });

  /* ============ INIT ============ */
  resizeCanvas();
  restoreWatermark();
  // Load default bundled chakra image (user should place their transparent chakra PNG here)
  // If it fails, fall back to the SVG-generated one
  const defaultImg = new Image();
  defaultImg.crossOrigin = "anonymous";
  defaultImg.onload = () => { chakra.img = defaultImg; chakra.natW = defaultImg.naturalWidth; chakra.natH = defaultImg.naturalHeight; render(); };
  defaultImg.onerror = () => {
    // fallback: generate SVG chakra if bundled image not found
    if (window.VastuChakra) {
      const size = 1800;
      const inner = window.VastuChakra.build(size);
      const svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + inner + '</svg>';
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const fb = new Image();
      fb.onload = () => { chakra.img = fb; chakra.natW = size; chakra.natH = size; URL.revokeObjectURL(url); render(); };
      fb.src = url;
    } else {
      setStatus("Upload a chakra image to get started.");
    }
  };
  defaultImg.src = "assets/chakras/vastu-shakti-chakra.png";
})();
