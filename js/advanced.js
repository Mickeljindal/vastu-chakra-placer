/* =====================================================================
   Advanced Features Module — Vastu Shakti Chakra Placer
   All features are off by default and enabled via the "Advanced" toggle.
   No backend required — everything is localStorage + canvas.

   Features:
   1. Room/zone annotation (draw rectangles, label rooms, detect zone)
   2. Entrance door marker (identifies devata pada + auspicious rating)
   3. 16-zone color overlay
   4. Measurement tool (click two points → distance)
   5. Text annotations (sticky notes on the plan)
   6. Client info header (name, address, date on exports)
   7. Save/Load projects (localStorage)
   ===================================================================== */
(function () {
  "use strict";

  /* ============ STATE ============ */
  const adv = {
    enabled: false,
    // rooms
    rooms: [],          // [{points:[{x,y},...], label:"Kitchen", zone:"SE"}]
    drawingRoom: null,  // temp points while drawing
    // entrance
    entrance: null,     // {x, y, pada, devata, quality}
    // zone overlay
    zoneOverlay: false,
    // measurement
    measurements: [],   // [{a:{x,y}, b:{x,y}, dist:0}]
    measuringFrom: null,
    // annotations
    notes: [],          // [{x, y, text}]
    // client info
    client: { name: "", address: "", date: "" },
    clientEnabled: false,
    // current tool
    tool: "none",       // none | room | entrance | measure | note
  };

  const SAVE_KEY = "vastu_projects_v1";

  /* ============ 16 ZONE DATA ============ */
  const ZONES_16 = [
    { dir: "N",   start: 348.75, end: 11.25,  name: "North",     area: "Money & Opportunities", color: "rgba(76,175,80,.25)" },
    { dir: "NNE", start: 11.25,  end: 33.75,  name: "NNE",       area: "Health & Immunity",     color: "rgba(102,187,106,.25)" },
    { dir: "NE",  start: 33.75,  end: 56.25,  name: "North-East", area: "Mind & Clarity",       color: "rgba(38,166,154,.25)" },
    { dir: "ENE", start: 56.25,  end: 78.75,  name: "ENE",       area: "Recreation & Fun",      color: "rgba(41,182,246,.25)" },
    { dir: "E",   start: 78.75,  end: 101.25, name: "East",      area: "Social & Association",  color: "rgba(66,165,245,.25)" },
    { dir: "ESE", start: 101.25, end: 123.75, name: "ESE",       area: "Anxiety & Churning",    color: "rgba(126,87,194,.25)" },
    { dir: "SE",  start: 123.75, end: 146.25, name: "South-East", area: "Fire, Cash & Liquidity", color: "rgba(239,83,80,.25)" },
    { dir: "SSE", start: 146.25, end: 168.75, name: "SSE",       area: "Power & Confidence",    color: "rgba(236,64,122,.25)" },
    { dir: "S",   start: 168.75, end: 191.25, name: "South",     area: "Relaxation & Fame",     color: "rgba(171,71,188,.25)" },
    { dir: "SSW", start: 191.25, end: 213.75, name: "SSW",       area: "Expenditure & Disposal", color: "rgba(141,110,99,.25)" },
    { dir: "SW",  start: 213.75, end: 236.25, name: "South-West", area: "Relationship & Skills", color: "rgba(255,112,67,.25)" },
    { dir: "WSW", start: 236.25, end: 258.75, name: "WSW",       area: "Education & Savings",   color: "rgba(255,167,38,.25)" },
    { dir: "W",   start: 258.75, end: 281.25, name: "West",      area: "Gains & Profit",        color: "rgba(255,202,40,.25)" },
    { dir: "WNW", start: 281.25, end: 303.75, name: "WNW",       area: "Depression & Detoxify", color: "rgba(120,144,156,.25)" },
    { dir: "NW",  start: 303.75, end: 326.25, name: "North-West", area: "Support & Banking",    color: "rgba(92,107,192,.25)" },
    { dir: "NNW", start: 326.25, end: 348.75, name: "NNW",       area: "Sex & Attraction",      color: "rgba(38,198,218,.25)" },
  ];

  /* ============ 32 ENTRANCE DATA ============ */
  const DEVATAS_32 = [
    { name: "Shikhi",     quality: "bad",     start: 0,     end: 11.25 },
    { name: "Parjanya",   quality: "good",    start: 11.25, end: 22.5 },
    { name: "Jayanta",    quality: "good",    start: 22.5,  end: 33.75 },
    { name: "Indra",      quality: "good",    start: 33.75, end: 45 },
    { name: "Surya",      quality: "neutral", start: 45,    end: 56.25 },
    { name: "Satya",      quality: "bad",     start: 56.25, end: 67.5 },
    { name: "Bhrisha",    quality: "bad",     start: 67.5,  end: 78.75 },
    { name: "Aakash",     quality: "bad",     start: 78.75, end: 90 },
    { name: "Anil",       quality: "bad",     start: 90,    end: 101.25 },
    { name: "Pusha",      quality: "bad",     start: 101.25,end: 112.5 },
    { name: "Vitatha",    quality: "bad",     start: 112.5, end: 123.75 },
    { name: "Grihaksha",  quality: "good",    start: 123.75,end: 135 },
    { name: "Yama",       quality: "bad",     start: 135,   end: 146.25 },
    { name: "Gandharva",  quality: "good",    start: 146.25,end: 157.5 },
    { name: "Bhringaraj", quality: "bad",     start: 157.5, end: 168.75 },
    { name: "Mriga",      quality: "bad",     start: 168.75,end: 180 },
    { name: "Pitra",      quality: "bad",     start: 180,   end: 191.25 },
    { name: "Sugriva",    quality: "good",    start: 191.25,end: 202.5 },
    { name: "Pushpdant",  quality: "good",    start: 202.5, end: 213.75 },
    { name: "Varuna",     quality: "good",    start: 213.75,end: 225 },
    { name: "Asura",      quality: "bad",     start: 225,   end: 236.25 },
    { name: "Shosha",     quality: "bad",     start: 236.25,end: 247.5 },
    { name: "Papyakshma", quality: "bad",     start: 247.5, end: 258.75 },
    { name: "Roga",       quality: "bad",     start: 258.75,end: 270 },
    { name: "Naga",       quality: "bad",     start: 270,   end: 281.25 },
    { name: "Mukhya",     quality: "good",    start: 281.25,end: 292.5 },
    { name: "Bhallat",    quality: "good",    start: 292.5, end: 303.75 },
    { name: "Soma",       quality: "best",    start: 303.75,end: 315 },
    { name: "Bhujag",     quality: "bad",     start: 315,   end: 326.25 },
    { name: "Aditi",      quality: "good",    start: 326.25,end: 337.5 },
    { name: "Diti",       quality: "good",    start: 337.5, end: 348.75 },
    { name: "Isha",       quality: "best",    start: 348.75,end: 360 },
  ];

  /* ============ HELPER: angle from center to point ============ */
  function getAngleFromCenter(px, py, cx, cy, northAng) {
    // angle of point relative to center, adjusted for north rotation
    const dx = px - cx, dy = py - cy;
    let ang = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    // adjust for north offset
    ang = (ang - northAng + 360) % 360;
    return ang;
  }

  function getZoneForAngle(ang) {
    for (const z of ZONES_16) {
      if (z.start > z.end) { // wraps around 0
        if (ang >= z.start || ang < z.end) return z;
      } else {
        if (ang >= z.start && ang < z.end) return z;
      }
    }
    return ZONES_16[0];
  }

  function getDevataForAngle(ang) {
    for (const d of DEVATAS_32) {
      if (d.start > d.end) {
        if (ang >= d.start || ang < d.end) return d;
      } else {
        if (ang >= d.start && ang < d.end) return d;
      }
    }
    return DEVATAS_32[0];
  }

  /* ============ DRAW: 16-zone color overlay ============ */
  function drawZoneOverlay(ctx, cx, cy, radius, northAng, zoom) {
    if (!adv.zoneOverlay) return;
    ctx.save();
    ZONES_16.forEach((z) => {
      const startRad = ((z.start + northAng - 90) * Math.PI) / 180;
      const endRad = ((z.end + northAng - 90) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startRad, endRad);
      ctx.closePath();
      ctx.fillStyle = z.color;
      ctx.fill();
      // label
      const midAng = (z.start + z.end) / 2 + northAng;
      const labelR = radius * 0.6;
      const lx = cx + labelR * Math.cos((midAng - 90) * Math.PI / 180);
      const ly = cy + labelR * Math.sin((midAng - 90) * Math.PI / 180);
      ctx.fillStyle = "rgba(0,0,0,.7)";
      ctx.font = `bold ${Math.max(9, 11 * zoom)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(z.dir, lx, ly);
    });
    ctx.restore();
  }

  /* ============ DRAW: rooms ============ */
  function drawRooms(ctx, w2sFn) {
    adv.rooms.forEach((room) => {
      if (room.points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = "rgba(52,152,219,.8)";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(52,152,219,.08)";
      ctx.beginPath();
      room.points.forEach((p, i) => {
        const s = w2sFn(p.x, p.y);
        i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // label
      if (room.label) {
        const ctr = roomCenter(room.points);
        const s = w2sFn(ctr.x, ctr.y);
        ctx.fillStyle = "#2980b9";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(room.label, s.x, s.y - 4);
        if (room.zone) {
          ctx.fillStyle = "#7f8c8d";
          ctx.font = "11px sans-serif";
          ctx.fillText(room.zone, s.x, s.y + 12);
        }
      }
      ctx.restore();
    });
    // drawing in progress
    if (adv.drawingRoom && adv.drawingRoom.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(52,152,219,.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      adv.drawingRoom.forEach((p, i) => {
        const s = w2sFn(p.x, p.y);
        i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      adv.drawingRoom.forEach((p) => {
        const s = w2sFn(p.x, p.y);
        ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#3498db"; ctx.fill();
      });
      ctx.restore();
    }
  }

  function roomCenter(pts) {
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x, y };
  }

  /* ============ DRAW: entrance marker ============ */
  function drawEntrance(ctx, w2sFn) {
    if (!adv.entrance) return;
    const s = w2sFn(adv.entrance.x, adv.entrance.y);
    ctx.save();
    // door icon
    const colors = { best: "#f1c40f", good: "#2ecc71", neutral: "#f39c12", bad: "#e74c3c" };
    const c = colors[adv.entrance.quality] || "#888";
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    // label
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("⚊", s.x, s.y + 4);
    // info box
    ctx.fillStyle = "rgba(0,0,0,.75)";
    const txt = `${adv.entrance.devata} — ${adv.entrance.quality === "best" ? "Very Auspicious" : adv.entrance.quality === "good" ? "Auspicious" : adv.entrance.quality === "neutral" ? "Neutral" : "Inauspicious"}`;
    const tw = ctx.measureText(txt).width;
    ctx.fillRect(s.x - tw / 2 - 6, s.y - 30, tw + 12, 18);
    ctx.fillStyle = c; ctx.font = "bold 11px sans-serif";
    ctx.fillText(txt, s.x, s.y - 17);
    ctx.restore();
  }

  /* ============ DRAW: measurements ============ */
  function drawMeasurements(ctx, w2sFn, planW, planH) {
    adv.measurements.forEach((m) => {
      const sa = w2sFn(m.a.x, m.a.y);
      const sb = w2sFn(m.b.x, m.b.y);
      ctx.save();
      ctx.strokeStyle = "#8e44ad"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
      // endpoints
      [sa, sb].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = "#8e44ad"; ctx.fill(); });
      // distance label
      const mid = { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 };
      ctx.fillStyle = "rgba(142,68,173,.9)"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(m.dist, mid.x, mid.y - 8);
      ctx.restore();
    });
  }

  /* ============ DRAW: text notes ============ */
  function drawNotes(ctx, w2sFn) {
    adv.notes.forEach((n) => {
      const s = w2sFn(n.x, n.y);
      ctx.save();
      ctx.fillStyle = "rgba(255,193,7,.9)";
      const tw = ctx.measureText(n.text).width;
      const pad = 6;
      ctx.fillRect(s.x - pad, s.y - 14, tw + pad * 2, 20);
      ctx.fillStyle = "#333"; ctx.font = "12px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(n.text, s.x, s.y);
      ctx.restore();
    });
  }

  /* ============ DRAW: client info header ============ */
  function drawClientInfo(ctx, planW, planH, isExport) {
    if (!adv.clientEnabled) return;
    if (!adv.client.name && !adv.client.address && !adv.client.date) return;
    const scale = isExport ? 1 : 1;
    const h = planH * 0.04;
    const pad = h * 0.3;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0, 0, planW, h);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${h * 0.45}px sans-serif`;
    ctx.textAlign = "left";
    const parts = [];
    if (adv.client.name) parts.push(adv.client.name);
    if (adv.client.address) parts.push(adv.client.address);
    if (adv.client.date) parts.push(adv.client.date);
    ctx.fillText(parts.join("  |  "), pad, h * 0.65);
    ctx.restore();
  }

  /* ============ MASTER DRAW (called by app.js render) ============ */
  function drawAdvanced(ctx, w2sFn, state) {
    if (!adv.enabled) return;
    // zone overlay (drawn under rooms)
    if (adv.zoneOverlay && state.centerPt && state.northLocked) {
      const radius = Math.min(state.planW, state.planH) * state.chakraScale * 0.5;
      const sc = w2sFn(state.centerPt.x, state.centerPt.y);
      drawZoneOverlay(ctx, sc.x, sc.y, radius * state.zoom, state.northAngle, state.zoom);
    }
    drawRooms(ctx, w2sFn);
    drawEntrance(ctx, w2sFn);
    drawMeasurements(ctx, w2sFn, state.planW, state.planH);
    drawNotes(ctx, w2sFn);
    // client info at top of plan area
    if (adv.clientEnabled) {
      ctx.save();
      ctx.translate(state.viewTx, state.viewTy);
      ctx.scale(state.zoom, state.zoom);
      drawClientInfo(ctx, state.planW, state.planH, false);
      ctx.restore();
    }
  }

  /* export version (plan pixel space, no view transform) */
  function drawAdvancedExport(ctx, planW, planH, state) {
    if (!adv.enabled) return;
    const identity = (x, y) => ({ x, y });
    if (adv.zoneOverlay && state.centerPt && state.northLocked) {
      const radius = Math.min(planW, planH) * state.chakraScale * 0.5;
      drawZoneOverlay(ctx, state.centerPt.x, state.centerPt.y, radius, state.northAngle, 1);
    }
    drawRooms(ctx, identity);
    drawEntrance(ctx, identity);
    drawMeasurements(ctx, identity, planW, planH);
    drawNotes(ctx, identity);
    drawClientInfo(ctx, planW, planH, true);
  }

  /* ============ POINTER HANDLER (returns true if consumed) ============ */
  function handlePointer(worldPt, state) {
    if (!adv.enabled || adv.tool === "none") return false;

    if (adv.tool === "room") {
      if (!adv.drawingRoom) adv.drawingRoom = [];
      adv.drawingRoom.push(worldPt);
      return true;
    }

    if (adv.tool === "entrance" && state.centerPt && state.northAngle !== null) {
      const ang = getAngleFromCenter(worldPt.x, worldPt.y, state.centerPt.x, state.centerPt.y, state.northAngle);
      const devata = getDevataForAngle(ang);
      adv.entrance = { x: worldPt.x, y: worldPt.y, pada: devata.name, devata: devata.name, quality: devata.quality };
      adv.tool = "none";
      return true;
    }

    if (adv.tool === "measure") {
      if (!adv.measuringFrom) {
        adv.measuringFrom = worldPt;
      } else {
        const dx = worldPt.x - adv.measuringFrom.x;
        const dy = worldPt.y - adv.measuringFrom.y;
        const px = Math.round(Math.sqrt(dx * dx + dy * dy));
        // rough conversion assuming typical plan scale
        const distLabel = px + "px";
        adv.measurements.push({ a: adv.measuringFrom, b: worldPt, dist: distLabel });
        adv.measuringFrom = null;
        adv.tool = "none";
      }
      return true;
    }

    if (adv.tool === "note") {
      const text = prompt("Enter note text:");
      if (text) adv.notes.push({ x: worldPt.x, y: worldPt.y, text });
      adv.tool = "none";
      return true;
    }

    return false;
  }

  /* ============ ROOM COMPLETION ============ */
  function finishRoom(centerPt, northAngle) {
    if (!adv.drawingRoom || adv.drawingRoom.length < 3) {
      adv.drawingRoom = null;
      return;
    }
    const label = prompt("Room name (e.g. Kitchen, Bedroom):");
    let zone = "";
    if (centerPt && northAngle !== null) {
      const c = roomCenter(adv.drawingRoom);
      const ang = getAngleFromCenter(c.x, c.y, centerPt.x, centerPt.y, northAngle);
      const z = getZoneForAngle(ang);
      zone = z.dir + " — " + z.area;
    }
    adv.rooms.push({ points: [...adv.drawingRoom], label: label || "Room", zone });
    adv.drawingRoom = null;
  }

  /* ============ SAVE/LOAD PROJECTS ============ */
  function saveProject(state) {
    const project = {
      timestamp: Date.now(),
      corners: state.corners,
      centerPt: state.centerPt,
      northAngle: state.northAngle,
      chakraRotation: state.chakraRotation,
      chakraScale: state.chakraScale,
      rooms: adv.rooms,
      entrance: adv.entrance,
      measurements: adv.measurements,
      notes: adv.notes,
      client: adv.client,
      clientEnabled: adv.clientEnabled,
    };
    let projects = [];
    try { projects = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); } catch (_) {}
    const name = adv.client.name || "Analysis " + new Date().toLocaleDateString();
    project.name = prompt("Project name:", name) || name;
    projects.unshift(project);
    if (projects.length > 20) projects = projects.slice(0, 20);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(projects)); } catch (_) {}
    return project.name;
  }

  function loadProjectList() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); } catch (_) { return []; }
  }

  function loadProject(index, applyFn) {
    const projects = loadProjectList();
    if (!projects[index]) return null;
    const p = projects[index];
    adv.rooms = p.rooms || [];
    adv.entrance = p.entrance || null;
    adv.measurements = p.measurements || [];
    adv.notes = p.notes || [];
    adv.client = p.client || { name: "", address: "", date: "" };
    adv.clientEnabled = p.clientEnabled || false;
    if (applyFn) applyFn(p);
    return p;
  }

  function deleteProject(index) {
    let projects = loadProjectList();
    projects.splice(index, 1);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(projects)); } catch (_) {}
  }

  /* ============ RESET ============ */
  function resetAdvanced() {
    adv.rooms = [];
    adv.drawingRoom = null;
    adv.entrance = null;
    adv.measurements = [];
    adv.measuringFrom = null;
    adv.notes = [];
    adv.tool = "none";
  }

  /* ============ EXPOSE ============ */
  window.VastuAdvanced = {
    state: adv,
    drawAdvanced,
    drawAdvancedExport,
    handlePointer,
    finishRoom,
    resetAdvanced,
    saveProject,
    loadProjectList,
    loadProject,
    deleteProject,
    ZONES_16,
    DEVATAS_32,
    getAngleFromCenter,
    getZoneForAngle,
    getDevataForAngle,
  };
})();
