/**
 * VastuDrawPlan - Floor Plan Drawing Tool Module
 * 
 * An IIFE that exposes window.VastuDrawPlan with canvas-based floor plan
 * drawing capabilities including walls, symbols, labels, and measurements.
 * 
 * No external dependencies. Does not touch the DOM directly — receives a
 * canvas element and renders to it. The host app wires UI controls.
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // DEFAULT STATE
  // ─────────────────────────────────────────────────────────────────────────

  /** Pixels per foot — used for all measurement conversions */
  const DEFAULT_SCALE = 20;

  /** Wall thickness in pixels (~4 inches at 20px/ft) */
  const DEFAULT_WALL_THICKNESS = 6;

  /** Snap / eraser tolerance in pixels */
  const HIT_TOLERANCE = 10;

  /** Page dimensions in pixels at default scale */
  const PAGE_SIZES = {
    A4: { w: 690, h: 975 },   // 210x297mm at ~20px/ft
    A3: { w: 975, h: 1380 }   // 297x420mm at ~20px/ft
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE STATE
  // ─────────────────────────────────────────────────────────────────────────

  let canvas = null;
  let ctx = null;

  let state = {
    pages: [],
    activePage: 0,
    scale: DEFAULT_SCALE,
    pageSize: 'A4',
    grid: true,
    tool: 'select',
    snapToGrid: true,
    wallThickness: DEFAULT_WALL_THICKNESS
  };

  /** Current wall being drawn (null when idle) */
  let drawingWall = null; // {x1, y1, x2, y2}

  /** Current symbol rotation (0, 90, 180, 270) */
  let currentRotation = 0;

  /** Undo history stack — stores snapshots of page state */
  let history = [];

  /** Maximum undo depth */
  const MAX_HISTORY = 50;

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Snap a coordinate to the nearest grid point.
   * Grid spacing = state.scale (1 foot).
   */
  function snapToGrid(val) {
    if (!state.snapToGrid) return val;
    return Math.round(val / state.scale) * state.scale;
  }

  /** Snap a point {x, y} */
  function snapPoint(pt) {
    return { x: snapToGrid(pt.x), y: snapToGrid(pt.y) };
  }

  /** Distance between two points */
  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  /**
   * Convert pixel distance to feet-inches string, e.g. "12'-6\""
   */
  function pxToFeetStr(px) {
    const totalFeet = Math.abs(px) / state.scale;
    const feet = Math.floor(totalFeet);
    const inches = Math.round((totalFeet - feet) * 12);
    if (inches === 0) return feet + "'";
    if (inches === 12) return (feet + 1) + "'";
    return feet + "'-" + inches + '"';
  }

  /**
   * Distance from a point to a line segment.
   */
  function pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist(px, py, x1, y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return dist(px, py, projX, projY);
  }

  /** Get the active page object */
  function activePage() {
    return state.pages[state.activePage];
  }

  /** Save current page state to undo history */
  function pushHistory() {
    const page = activePage();
    if (!page) return;
    const snapshot = JSON.parse(JSON.stringify(page));
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
  }

  /** Create a blank page */
  function createPage(name) {
    return {
      name: name || 'Page ' + (state.pages.length + 1),
      walls: [],
      symbols: [],
      labels: []
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYMBOL DRAWING FUNCTIONS
  // Each draws a symbol centered at (0,0) with given width/height.
  // The caller handles translation and rotation.
  // ─────────────────────────────────────────────────────────────────────────

  const SYMBOL_DEFAULTS = {
    door:    { w: 40, h: 40 },
    window:  { w: 40, h: 10 },
    stairs:  { w: 40, h: 60 },
    toilet:  { w: 30, h: 40 },
    sink:    { w: 24, h: 20 },
    stove:   { w: 40, h: 40 },
    bed:     { w: 60, h: 80 },
    sofa:    { w: 70, h: 30 },
    table:   { w: 50, h: 40 },
    car:     { w: 50, h: 100 }
  };

  /**
   * Draw a symbol at (0,0). Called within a translated/rotated context.
   */
  function drawSymbolShape(type, w, h) {
    const hw = w / 2;
    const hh = h / 2;

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(200,200,200,0.3)';

    switch (type) {

      // ── Door: arc + line (swing) ──
      case 'door':
        ctx.beginPath();
        ctx.moveTo(-hw, hh);
        ctx.lineTo(-hw, -hh);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-hw, hh, h, -Math.PI / 2, 0);
        ctx.stroke();
        break;

      // ── Window: three parallel lines ──
      case 'window':
        ctx.beginPath();
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw, -hh);
        ctx.moveTo(-hw, 0);
        ctx.lineTo(hw, 0);
        ctx.moveTo(-hw, hh);
        ctx.lineTo(hw, hh);
        ctx.stroke();
        break;

      // ── Stairs: parallel lines with arrow ──
      case 'stairs':
        ctx.strokeRect(-hw, -hh, w, h);
        var stepCount = 6;
        var stepH = h / stepCount;
        for (var i = 1; i < stepCount; i++) {
          ctx.beginPath();
          ctx.moveTo(-hw, -hh + i * stepH);
          ctx.lineTo(hw, -hh + i * stepH);
          ctx.stroke();
        }
        // Arrow pointing up
        ctx.beginPath();
        ctx.moveTo(0, hh - 5);
        ctx.lineTo(0, -hh + 5);
        ctx.lineTo(-5, -hh + 12);
        ctx.moveTo(0, -hh + 5);
        ctx.lineTo(5, -hh + 12);
        ctx.stroke();
        break;

      // ── Toilet: oval bowl + tank rectangle ──
      case 'toilet':
        // Tank
        ctx.fillRect(-hw, -hh, w, h * 0.25);
        ctx.strokeRect(-hw, -hh, w, h * 0.25);
        // Bowl (ellipse)
        ctx.beginPath();
        ctx.ellipse(0, hh * 0.3, hw * 0.8, hh * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      // ── Sink: rectangle with circle (drain) ──
      case 'sink':
        ctx.fillRect(-hw, -hh, w, h);
        ctx.strokeRect(-hw, -hh, w, h);
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(hw, hh) * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        break;

      // ── Stove: rectangle with 4 burner circles ──
      case 'stove':
        ctx.fillRect(-hw, -hh, w, h);
        ctx.strokeRect(-hw, -hh, w, h);
        var burnerR = Math.min(hw, hh) * 0.25;
        var offX = hw * 0.45;
        var offY = hh * 0.45;
        [[-offX, -offY], [offX, -offY], [-offX, offY], [offX, offY]].forEach(function (p) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], burnerR, 0, Math.PI * 2);
          ctx.stroke();
        });
        break;

      // ── Bed: rectangle with pillow at head ──
      case 'bed':
        ctx.fillRect(-hw, -hh, w, h);
        ctx.strokeRect(-hw, -hh, w, h);
        // Pillow
        ctx.fillStyle = 'rgba(150,150,150,0.4)';
        ctx.fillRect(-hw + 4, -hh + 4, w - 8, h * 0.2);
        ctx.strokeRect(-hw + 4, -hh + 4, w - 8, h * 0.2);
        break;

      // ── Sofa: rectangle with back cushion ──
      case 'sofa':
        ctx.fillRect(-hw, -hh, w, h);
        ctx.strokeRect(-hw, -hh, w, h);
        // Back cushion (thicker top edge)
        ctx.fillStyle = 'rgba(150,150,150,0.5)';
        ctx.fillRect(-hw, -hh, w, h * 0.3);
        ctx.strokeRect(-hw, -hh, w, h * 0.3);
        break;

      // ── Table: rectangle with chair circles ──
      case 'table':
        ctx.fillRect(-hw, -hh, w, h);
        ctx.strokeRect(-hw, -hh, w, h);
        var chairR = 5;
        // Chairs on long sides
        ctx.beginPath();
        ctx.arc(0, -hh - chairR - 3, chairR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, hh + chairR + 3, chairR, 0, Math.PI * 2);
        ctx.stroke();
        break;

      // ── Car: rectangle with rounded ends ──
      case 'car':
        ctx.beginPath();
        var radius = hw * 0.8;
        ctx.moveTo(-hw, -hh + radius);
        ctx.lineTo(-hw, hh - radius);
        ctx.arcTo(-hw, hh, 0, hh, radius);
        ctx.arcTo(hw, hh, hw, hh - radius, radius);
        ctx.lineTo(hw, -hh + radius);
        ctx.arcTo(hw, -hh, 0, -hh, radius);
        ctx.arcTo(-hw, -hh, -hw, -hh + radius, radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      default:
        // Fallback: simple rectangle
        ctx.strokeRect(-hw, -hh, w, h);
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERING
  // ─────────────────────────────────────────────────────────────────────────

  /** Main render function — draws grid, walls, symbols, labels */
  function render() {
    if (!ctx) return;
    const page = activePage();
    if (!page) return;

    const size = PAGE_SIZES[state.pageSize] || PAGE_SIZES.A4;

    // Clear canvas
    canvas.width = size.w;
    canvas.height = size.h;
    ctx.clearRect(0, 0, size.w, size.h);

    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size.w, size.h);

    // Grid
    if (state.grid) {
      drawGrid(size);
    }

    // Page border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size.w, size.h);

    // Walls
    drawWalls(page.walls);

    // Drawing preview (wall in progress)
    if (drawingWall) {
      drawWallPreview();
    }

    // Symbols
    drawSymbols(page.symbols);

    // Labels
    drawLabels(page.labels);
  }

  /** Draw the background grid */
  function drawGrid(size) {
    const step = state.scale; // 1 foot
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= size.w; x += step) {
      ctx.strokeStyle = (x % (step * 5) === 0) ? '#ccc' : '#e8e8e8';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.h);
      ctx.stroke();
    }

    for (let y = 0; y <= size.h; y += step) {
      ctx.strokeStyle = (y % (step * 5) === 0) ? '#ccc' : '#e8e8e8';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.w, y);
      ctx.stroke();
    }
  }

  /** Draw all walls with dimension labels */
  function drawWalls(walls) {
    walls.forEach(function (wall) {
      drawSingleWall(wall, false);
    });
  }

  /** Draw a single wall with optional dimension */
  function drawSingleWall(wall, isPreview) {
    ctx.strokeStyle = isPreview ? '#0077cc' : '#222';
    ctx.lineWidth = state.wallThickness;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1);
    ctx.lineTo(wall.x2, wall.y2);
    ctx.stroke();

    // Dimension label
    const length = dist(wall.x1, wall.y1, wall.x2, wall.y2);
    if (length > 5) {
      const label = pxToFeetStr(length);
      const midX = (wall.x1 + wall.x2) / 2;
      const midY = (wall.y1 + wall.y2) / 2;

      // Offset the label perpendicular to the wall
      const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
      const offsetDist = 12;
      const labelX = midX + Math.cos(angle - Math.PI / 2) * offsetDist;
      const labelY = midY + Math.sin(angle - Math.PI / 2) * offsetDist;

      ctx.save();
      ctx.font = '10px sans-serif';
      ctx.fillStyle = isPreview ? '#0077cc' : '#555';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX, labelY);
      ctx.restore();
    }
  }

  /** Draw the wall currently being drawn (preview) */
  function drawWallPreview() {
    drawSingleWall(drawingWall, true);
  }

  /** Draw all placed symbols */
  function drawSymbols(symbols) {
    symbols.forEach(function (sym) {
      ctx.save();
      ctx.translate(sym.x, sym.y);
      ctx.rotate((sym.rotation || 0) * Math.PI / 180);
      drawSymbolShape(sym.type, sym.w, sym.h);
      ctx.restore();
    });
  }

  /** Draw all labels */
  function drawLabels(labels) {
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    labels.forEach(function (lbl) {
      ctx.fillText(lbl.text, lbl.x, lbl.y);
    });
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INPUT HANDLING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handle pointer down (click/tap) at a world-space point.
   * Returns true if the event was consumed.
   */
  function handlePointerDown(worldPt) {
    const pt = state.snapToGrid ? snapPoint(worldPt) : worldPt;
    const page = activePage();
    if (!page) return false;

    switch (state.tool) {

      // ── Wall tool ──
      case 'wall':
        if (!drawingWall) {
          // Start a new wall
          drawingWall = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
        } else {
          // Finish the wall
          pushHistory();
          page.walls.push({
            x1: drawingWall.x1,
            y1: drawingWall.y1,
            x2: pt.x,
            y2: pt.y
          });
          // Start a new wall from the end point (chain drawing)
          drawingWall = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
          render();
        }
        return true;

      // ── Symbol tools ──
      case 'door':
      case 'window':
      case 'stairs':
      case 'toilet':
      case 'sink':
      case 'stove':
      case 'bed':
      case 'sofa':
      case 'table':
      case 'car':
        pushHistory();
        var defaults = SYMBOL_DEFAULTS[state.tool] || { w: 40, h: 40 };
        page.symbols.push({
          type: state.tool,
          x: pt.x,
          y: pt.y,
          rotation: currentRotation,
          w: defaults.w,
          h: defaults.h
        });
        render();
        return true;

      // ── Label tool ──
      case 'label':
        var text = prompt('Enter label text:');
        if (text && text.trim()) {
          pushHistory();
          page.labels.push({
            text: text.trim(),
            x: pt.x,
            y: pt.y
          });
          render();
        }
        return true;

      // ── Eraser tool ──
      case 'eraser':
        return eraseAt(pt);

      // ── Select tool (no-op for now) ──
      case 'select':
      default:
        return false;
    }
  }

  /**
   * Handle pointer move — updates wall preview.
   */
  function handlePointerMove(worldPt) {
    if (state.tool === 'wall' && drawingWall) {
      const pt = state.snapToGrid ? snapPoint(worldPt) : worldPt;
      drawingWall.x2 = pt.x;
      drawingWall.y2 = pt.y;
      render();
      return true;
    }
    return false;
  }

  /**
   * Handle pointer up — currently a no-op (walls use click-click).
   */
  function handlePointerUp() {
    // Wall drawing uses click-to-start, click-to-end pattern,
    // so pointer up doesn't finish the wall.
    return false;
  }

  /**
   * Cancel the current wall drawing (e.g. Escape key or double-click).
   */
  function cancelWallDrawing() {
    drawingWall = null;
    render();
  }

  /**
   * Erase the nearest wall, symbol, or label within tolerance.
   * Returns true if something was erased.
   */
  function eraseAt(pt) {
    const page = activePage();
    if (!page) return false;

    // Check walls
    for (let i = page.walls.length - 1; i >= 0; i--) {
      const w = page.walls[i];
      if (pointToSegmentDist(pt.x, pt.y, w.x1, w.y1, w.x2, w.y2) < HIT_TOLERANCE) {
        pushHistory();
        page.walls.splice(i, 1);
        render();
        return true;
      }
    }

    // Check symbols
    for (let i = page.symbols.length - 1; i >= 0; i--) {
      const s = page.symbols[i];
      if (dist(pt.x, pt.y, s.x, s.y) < Math.max(s.w, s.h) / 2 + HIT_TOLERANCE) {
        pushHistory();
        page.symbols.splice(i, 1);
        render();
        return true;
      }
    }

    // Check labels
    for (let i = page.labels.length - 1; i >= 0; i--) {
      const l = page.labels[i];
      if (dist(pt.x, pt.y, l.x, l.y) < HIT_TOLERANCE + 10) {
        pushHistory();
        page.labels.splice(i, 1);
        render();
        return true;
      }
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the module with a canvas element.
   * Sets up initial page and starts rendering.
   */
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');

    // Create default first page if none exist
    if (state.pages.length === 0) {
      state.pages.push(createPage('Ground Floor'));
    }

    // Set canvas size to page size
    var size = PAGE_SIZES[state.pageSize] || PAGE_SIZES.A4;
    canvas.width = size.w;
    canvas.height = size.h;

    render();
  }

  /** Switch the active drawing tool */
  function setTool(toolName) {
    // Cancel wall drawing if switching away from wall tool
    if (state.tool === 'wall' && toolName !== 'wall') {
      cancelWallDrawing();
    }
    state.tool = toolName;
  }

  /** Change page size ("A4" or "A3") */
  function setPageSize(size) {
    if (PAGE_SIZES[size]) {
      state.pageSize = size;
      if (canvas) {
        var dims = PAGE_SIZES[size];
        canvas.width = dims.w;
        canvas.height = dims.h;
      }
      render();
    }
  }

  /** Add a new page */
  function addPage(name) {
    state.pages.push(createPage(name));
    state.activePage = state.pages.length - 1;
    history = []; // Clear undo history for new page
    render();
  }

  /** Switch to a page by index */
  function switchPage(index) {
    if (index >= 0 && index < state.pages.length) {
      cancelWallDrawing();
      state.activePage = index;
      history = [];
      render();
    }
  }

  /** Delete a page by index */
  function deletePage(index) {
    if (state.pages.length <= 1) return; // Keep at least one page
    state.pages.splice(index, 1);
    if (state.activePage >= state.pages.length) {
      state.activePage = state.pages.length - 1;
    }
    history = [];
    render();
  }

  /** Undo the last action on the current page */
  function undo() {
    if (history.length === 0) return;
    var snapshot = history.pop();
    state.pages[state.activePage] = snapshot;
    render();
  }

  /** Clear the current page (walls, symbols, labels) */
  function clear() {
    pushHistory();
    var page = activePage();
    if (page) {
      page.walls = [];
      page.symbols = [];
      page.labels = [];
    }
    cancelWallDrawing();
    render();
  }

  /**
   * Export the current page as a clean image (no grid, white background).
   * Returns a new canvas element with the rendered plan.
   */
  function exportAsImage() {
    var size = PAGE_SIZES[state.pageSize] || PAGE_SIZES.A4;
    var exportCanvas = document.createElement('canvas');
    exportCanvas.width = size.w;
    exportCanvas.height = size.h;
    var exportCtx = exportCanvas.getContext('2d');

    // Temporarily swap context
    var origCtx = ctx;
    var origCanvas = canvas;
    ctx = exportCtx;
    canvas = exportCanvas;

    // Render without grid
    var origGrid = state.grid;
    state.grid = false;

    render();

    // Restore
    state.grid = origGrid;
    ctx = origCtx;
    canvas = origCanvas;

    return exportCanvas;
  }

  /**
   * Get the full serializable state for save/load.
   */
  function getState() {
    return JSON.parse(JSON.stringify({
      pages: state.pages,
      activePage: state.activePage,
      scale: state.scale,
      pageSize: state.pageSize,
      grid: state.grid,
      snapToGrid: state.snapToGrid,
      wallThickness: state.wallThickness
    }));
  }

  /**
   * Restore state from a previously saved object.
   */
  function setState(data) {
    if (!data) return;
    state.pages = data.pages || [createPage('Ground Floor')];
    state.activePage = data.activePage || 0;
    state.scale = data.scale || DEFAULT_SCALE;
    state.pageSize = data.pageSize || 'A4';
    state.grid = data.grid !== undefined ? data.grid : true;
    state.snapToGrid = data.snapToGrid !== undefined ? data.snapToGrid : true;
    state.wallThickness = data.wallThickness || DEFAULT_WALL_THICKNESS;
    history = [];
    drawingWall = null;
    currentRotation = 0;
    render();
  }

  /**
   * Rotate the current symbol placement by 90 degrees.
   * Call this when the user presses 'R'.
   */
  function rotateSymbol() {
    currentRotation = (currentRotation + 90) % 360;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPOSE PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────

  window.VastuDrawPlan = {
    init: init,
    render: render,
    handlePointerDown: handlePointerDown,
    handlePointerMove: handlePointerMove,
    handlePointerUp: handlePointerUp,
    cancelWallDrawing: cancelWallDrawing,
    setTool: setTool,
    setPageSize: setPageSize,
    addPage: addPage,
    switchPage: switchPage,
    deletePage: deletePage,
    undo: undo,
    clear: clear,
    exportAsImage: exportAsImage,
    getState: getState,
    setState: setState,
    rotateSymbol: rotateSymbol
  };

})();
