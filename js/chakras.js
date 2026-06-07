/* =====================================================================
   Vastu Chakra SVG Generator — the authentic multi-ring 360° wheel
   Based on the traditional MahaVastu-style chakra with:
   - 360° degree ruler (outermost)
   - 16 direction band (black background, white text)
   - Organ/body part band (red text)
   - 16 life-zone band
   - 32 Devata entrance band with colored triangle flags
   - Inner devata/deity names ring
   - Brahma center
   ===================================================================== */
(function (global) {
  "use strict";

  /* ---------- helpers ---------- */
  function polar(cx, cy, r, deg) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arc(cx, cy, r, startDeg, endDeg) {
    const s = polar(cx, cy, r, startDeg);
    const e = polar(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  function sectorPath(cx, cy, r1, r2, startDeg, endDeg) {
    const s1 = polar(cx, cy, r1, startDeg);
    const e1 = polar(cx, cy, r1, endDeg);
    const s2 = polar(cx, cy, r2, endDeg);
    const e2 = polar(cx, cy, r2, startDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s1.x} ${s1.y} A ${r1} ${r1} 0 ${large} 1 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${r2} ${r2} 0 ${large} 0 ${e2.x} ${e2.y} Z`;
  }

  function textOnArc(cx, cy, r, midDeg, text, fontSize, fill, bold, rotate180) {
    const p = polar(cx, cy, r, midDeg);
    let rot = midDeg;
    if (rotate180 === undefined) {
      // auto-flip so text is always readable
      if (midDeg > 90 && midDeg < 270) rot += 180;
    } else if (rotate180) {
      rot += 180;
    }
    const fw = bold ? "font-weight='700'" : "";
    return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" fill="${fill}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" transform="rotate(${rot} ${p.x.toFixed(1)} ${p.y.toFixed(1)})" ${fw}>${text}</text>`;
  }

  /* ---------- DATA: 16 directions ---------- */
  const DIRS_16 = [
    "NORTH", "NNE", "NE", "ENE",
    "EAST", "ESE", "SE", "SSE",
    "SOUTH", "SSW", "SW", "WSW",
    "WEST", "WNW", "NW", "NNW",
  ];

  /* ---------- DATA: organs (clockwise from N) ---------- */
  const ORGANS = [
    "BLADDER", "KIDNEY", "PERICARDIUM", "CIRCULATION",
    "LIVER", "GALL BLADDER", "SPLEEN", "RAJAS",
    "STOMACH", "HEART", "COLON", "LUNG",
    "SMALL INTESTINE", "BLADDER", "TAMAS", "SATAV",
  ];

  /* ---------- DATA: 16 life zones (clockwise from N) ---------- */
  const ZONES = [
    { name: "MONEY\nOPPORTUNITIES", color: "#4caf50" },
    { name: "HEALTH &\nIMMUNITY", color: "#66bb6a" },
    { name: "MIND\nCLARITY", color: "#26a69a" },
    { name: "RECREATION\nFUN / JOY", color: "#29b6f6" },
    { name: "SOCIAL\nASSOCIATION", color: "#42a5f5" },
    { name: "ANXIETY\nCHURNING", color: "#7e57c2" },
    { name: "FIRE, CASH\nLIQUIDITY", color: "#ef5350" },
    { name: "POWER\nCONFIDENCE", color: "#ec407a" },
    { name: "RELAXATION\nFAME", color: "#ab47bc" },
    { name: "EXPENDITURE\nDISPOSAL", color: "#8d6e63" },
    { name: "RELATIONSHIP\nSKILLS", color: "#ff7043" },
    { name: "EDUCATION\nSAVINGS", color: "#ffa726" },
    { name: "GAINS\nPROFIT", color: "#ffca28" },
    { name: "DEPRESSION\nDETOXIFY", color: "#78909c" },
    { name: "SUPPORT\nBANKING", color: "#5c6bc0" },
    { name: "SEX\nATTRACTION", color: "#26c6da" },
  ];

  /* ---------- DATA: 32 Devata entrances (clockwise from N) ---------- */
  const DEVATAS = [
    // North (N1-N8)
    { name: "MUKHYA", flag: "green" },
    { name: "BHALLAT", flag: "green" },
    { name: "SOMA", flag: "yellow" },
    { name: "BHUJAG", flag: "red" },
    { name: "ADITI", flag: "green" },
    { name: "DITI", flag: "green" },
    { name: "SHIKHI", flag: "red" },
    { name: "PARJANYA", flag: "green" },
    // East (E1-E8)
    { name: "JAYANT", flag: "green" },
    { name: "MAHENDRA", flag: "green" },
    { name: "SURYA", flag: "yellow" },
    { name: "SATYA", flag: "red" },
    { name: "BHRISHA", flag: "red" },
    { name: "AAKASH", flag: "red" },
    { name: "ANIL", flag: "red" },
    { name: "PUSHA", flag: "red" },
    // South (S1-S8)
    { name: "VITATHA", flag: "red" },
    { name: "GRIHAKSHA", flag: "green" },
    { name: "YAMA", flag: "red" },
    { name: "GANDHARVA", flag: "green" },
    { name: "BHRINGARAJ", flag: "red" },
    { name: "MRIGA", flag: "red" },
    { name: "PITRA", flag: "red" },
    { name: "SUGRIVA", flag: "green" },
    // West (W1-W8)
    { name: "PUSHPDANT", flag: "green" },
    { name: "VARUN", flag: "green" },
    { name: "ASUR", flag: "red" },
    { name: "SHOSHA", flag: "red" },
    { name: "PAPYAKSHMA", flag: "red" },
    { name: "ROGA", flag: "red" },
    { name: "NAGA", flag: "red" },
    { name: "MUKHYA(N)", flag: "green" },
  ];

  /* ---------- DATA: inner deity names (4 quarters) ---------- */
  const INNER_DEITIES = [
    { name: "BHUDHAR", startDeg: 315, endDeg: 45 },
    { name: "ARYAMA", startDeg: 45, endDeg: 135 },
    { name: "VIVISVAN", startDeg: 135, endDeg: 225 },
    { name: "MITRA", startDeg: 225, endDeg: 315 },
  ];

  /* ---------- DATA: colored padas (entrance triangles) labels ---------- */
  const PADA_LABELS = [
    "N4","N5","N6","N7","N8","E1","E2","E3",
    "E4","E5","E6","E7","E8","S1","S2","S3",
    "S4","S5","S6","S7","S8","W1","W2","W3",
    "W4","W5","W6","W7","W8","N1","N2","N3",
  ];

  /* =====================================================================
     MAIN BUILD FUNCTION
     ===================================================================== */
  function buildVastuChakra(size) {
    size = size || 900;
    const cx = size / 2, cy = size / 2;

    // radii from outside inward
    const R = size * 0.48;       // outermost edge of degree ring
    const rDeg1 = R;             // outer degree ring
    const rDeg2 = R * 0.92;     // inner edge of degree ring
    const rDir1 = rDeg2;        // outer edge of direction band
    const rDir2 = R * 0.82;     // inner edge of direction band
    const rOrgan1 = rDir2;      // organ band outer
    const rOrgan2 = R * 0.74;   // organ band inner
    const rZone1 = rOrgan2;     // zone band outer
    const rZone2 = R * 0.55;    // zone band inner
    const rDev1 = rZone2;       // devata ring outer
    const rDev2 = R * 0.40;     // devata ring inner
    const rInner1 = rDev2;      // inner deity band outer
    const rInner2 = R * 0.28;   // inner deity band inner
    const rCenter = R * 0.20;   // brahma circle

    let svg = "";

    /* --- background circle fills --- */
    svg += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff" />`;

    /* --- RING 1: 360° degree ruler (outermost) --- */
    svg += `<circle cx="${cx}" cy="${cy}" r="${rDeg1}" fill="none" stroke="#333" stroke-width="1.5" />`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${rDeg2}" fill="none" stroke="#333" stroke-width="1" />`;
    for (let d = 0; d < 360; d++) {
      const r1 = rDeg1;
      const r2 = d % 10 === 0 ? rDeg2 + (rDeg1 - rDeg2) * 0.3 : d % 5 === 0 ? rDeg2 + (rDeg1 - rDeg2) * 0.5 : rDeg2 + (rDeg1 - rDeg2) * 0.7;
      const p1 = polar(cx, cy, r1, d);
      const p2 = polar(cx, cy, r2, d);
      svg += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="#333" stroke-width="${d % 10 === 0 ? 1.2 : 0.5}" />`;
    }
    // degree numbers every 10°
    for (let d = 0; d < 360; d += 10) {
      const rTxt = rDeg2 + (rDeg1 - rDeg2) * 0.17;
      svg += textOnArc(cx, cy, rTxt, d, d.toString(), size * 0.016, "#333", true);
    }

    /* --- RING 2: 16 Directions band (dark background) --- */
    svg += `<path d="${sectorPath(cx, cy, rDir1, rDir2, 0, 360)}" fill="#1a1a1a" />`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${rDir1}" fill="none" stroke="#000" stroke-width="2" />`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${rDir2}" fill="none" stroke="#000" stroke-width="1.5" />`;
    const dirStep = 22.5;
    for (let i = 0; i < 16; i++) {
      const startA = i * dirStep - dirStep / 2;
      const midA = i * dirStep;
      // spokes
      const pS = polar(cx, cy, rDir1, startA);
      const pE = polar(cx, cy, rDir2, startA);
      svg += `<line x1="${pS.x.toFixed(1)}" y1="${pS.y.toFixed(1)}" x2="${pE.x.toFixed(1)}" y2="${pE.y.toFixed(1)}" stroke="#555" stroke-width="0.8" />`;
      // label
      const rMid = (rDir1 + rDir2) / 2;
      svg += textOnArc(cx, cy, rMid, midA, DIRS_16[i], size * 0.017, "#fff", true);
    }

    /* --- RING 3: Organs band --- */
    svg += `<circle cx="${cx}" cy="${cy}" r="${rOrgan1}" fill="none" stroke="#333" stroke-width="0.8" />`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${rOrgan2}" fill="none" stroke="#333" stroke-width="0.8" />`;
    for (let i = 0; i < 16; i++) {
      const startA = i * dirStep - dirStep / 2;
      const midA = i * dirStep;
      const pS = polar(cx, cy, rOrgan1, startA);
      const pE = polar(cx, cy, rOrgan2, startA);
      svg += `<line x1="${pS.x.toFixed(1)}" y1="${pS.y.toFixed(1)}" x2="${pE.x.toFixed(1)}" y2="${pE.y.toFixed(1)}" stroke="#ccc" stroke-width="0.5" />`;
      const rMid = (rOrgan1 + rOrgan2) / 2;
      svg += textOnArc(cx, cy, rMid, midA, ORGANS[i], size * 0.012, "#cc0000", true);
    }

    /* --- RING 4: 16 Life Zones band --- */
    for (let i = 0; i < 16; i++) {
      const startA = i * dirStep - dirStep / 2;
      const endA = startA + dirStep;
      svg += `<path d="${sectorPath(cx, cy, rZone1, rZone2, startA, endA)}" fill="${ZONES[i].color}" fill-opacity="0.22" stroke="#999" stroke-width="0.5" />`;
      // label (split by \n)
      const lines = ZONES[i].name.split("\n");
      const midA = i * dirStep;
      const rTop = rZone1 - (rZone1 - rZone2) * 0.35;
      const rBot = rZone1 - (rZone1 - rZone2) * 0.65;
      svg += textOnArc(cx, cy, rTop, midA, lines[0], size * 0.012, "#222", true);
      if (lines[1]) svg += textOnArc(cx, cy, rBot, midA, lines[1], size * 0.011, "#555", false);
    }
    svg += `<circle cx="${cx}" cy="${cy}" r="${rZone1}" fill="none" stroke="#666" stroke-width="1" />`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${rZone2}" fill="none" stroke="#666" stroke-width="1" />`;

    /* --- RING 5: 32 Devata entrances + colored flag triangles --- */
    const devStep = 11.25;
    svg += `<circle cx="${cx}" cy="${cy}" r="${rDev1}" fill="none" stroke="#333" stroke-width="1" />`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${rDev2}" fill="none" stroke="#333" stroke-width="1" />`;
    for (let i = 0; i < 32; i++) {
      const startA = i * devStep - devStep / 2;
      const midA = i * devStep;
      const endA = startA + devStep;
      // spoke
      const pS = polar(cx, cy, rDev1, startA);
      const pE = polar(cx, cy, rDev2, startA);
      svg += `<line x1="${pS.x.toFixed(1)}" y1="${pS.y.toFixed(1)}" x2="${pE.x.toFixed(1)}" y2="${pE.y.toFixed(1)}" stroke="#bbb" stroke-width="0.5" />`;
      // devata name
      const rMid = (rDev1 + rDev2) / 2;
      svg += textOnArc(cx, cy, rMid, midA, DEVATAS[i].name, size * 0.01, "#222", true);
      // colored flag triangle at outer edge of devata band
      const flagColors = { red: "#e53935", green: "#43a047", yellow: "#fdd835", blue: "#1e88e5" };
      const fc = flagColors[DEVATAS[i].flag] || "#888";
      const rFlag = rDev1 - (rDev1 - rDev2) * 0.08;
      const rFlagIn = rDev1 - (rDev1 - rDev2) * 0.35;
      const fp1 = polar(cx, cy, rFlag, midA - devStep * 0.3);
      const fp2 = polar(cx, cy, rFlag, midA + devStep * 0.3);
      const fp3 = polar(cx, cy, rFlagIn, midA);
      svg += `<path d="M ${fp1.x.toFixed(1)} ${fp1.y.toFixed(1)} L ${fp2.x.toFixed(1)} ${fp2.y.toFixed(1)} L ${fp3.x.toFixed(1)} ${fp3.y.toFixed(1)} Z" fill="${fc}" opacity="0.8" />`;
      // pada label (N1..N8, E1..E8 etc.)
      const rPada = rDev1 - (rDev1 - rDev2) * 0.8;
      svg += textOnArc(cx, cy, rPada, midA, PADA_LABELS[i], size * 0.01, "#333", true);
    }

    /* --- RING 6: Inner deity names --- */
    svg += `<circle cx="${cx}" cy="${cy}" r="${rInner1}" fill="none" stroke="#333" stroke-width="1" />`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${rInner2}" fill="none" stroke="#333" stroke-width="1" />`;
    INNER_DEITIES.forEach((d) => {
      const midA = (d.startDeg + d.endDeg) / 2;
      const rMid = (rInner1 + rInner2) / 2;
      svg += textOnArc(cx, cy, rMid, midA, d.name, size * 0.025, "#222", true);
      // spoke at start
      const pS = polar(cx, cy, rInner1, d.startDeg);
      const pE = polar(cx, cy, rInner2, d.startDeg);
      svg += `<line x1="${pS.x.toFixed(1)}" y1="${pS.y.toFixed(1)}" x2="${pE.x.toFixed(1)}" y2="${pE.y.toFixed(1)}" stroke="#333" stroke-width="1" />`;
    });

    /* --- CENTER: Brahma --- */
    svg += `<circle cx="${cx}" cy="${cy}" r="${rCenter}" fill="#f5f5f5" stroke="#333" stroke-width="2" />`;
    // cross
    const cr = rCenter * 0.6;
    svg += `<line x1="${cx}" y1="${cy - cr}" x2="${cx}" y2="${cy + cr}" stroke="#333" stroke-width="3" />`;
    svg += `<line x1="${cx - cr}" y1="${cy}" x2="${cx + cr}" y2="${cy}" stroke="#333" stroke-width="3" />`;
    svg += `<text x="${cx}" y="${cy - rCenter * 0.3}" fill="#333" font-size="${size * 0.03}" text-anchor="middle" font-weight="800">BRAHMA</text>`;

    /* --- North pointer --- */
    const nX = cx, nY = cy - R - size * 0.01;
    svg += `<path d="M ${nX - 8} ${nY + 4} L ${nX} ${nY - 10} L ${nX + 8} ${nY + 4} Z" fill="#e53935" />`;

    return svg;
  }

  /* =====================================================================
     EXPORT
     ===================================================================== */
  global.VastuChakra = {
    build: buildVastuChakra,
    DEVATAS: DEVATAS,
    ZONES: ZONES,
    DIRS_16: DIRS_16,
  };
})(window);
