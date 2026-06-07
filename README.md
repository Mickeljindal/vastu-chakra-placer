# Vastu Shakti Chakra Placer

A professional tool for Vastu experts to upload a floor plan, find the
Brahmasthan (center), set the North direction, and overlay the authentic
Vastu Shakti Chakra — all in a step-by-step guided workflow.

## Workflow

1. **Upload a floor plan** — image (PNG/JPG/WEBP) or PDF
2. **Find Brahmasthan** — mark 4 property corners (diagonals auto-compute
   the center), or click directly to set it manually
3. **Set North** — click a point on the plan toward North (or enter degrees).
   This tells the app which way the plan is oriented.
4. **Chakra auto-places** — fixed at the center, rotated so its North aligns
   with the plan's North. Fine-tune size, rotation, and opacity.
5. **Download PNG** — full-resolution export with the overlay.

## Features

- PDF support (via pdf.js) — multi-page PDFs with page navigation
- Zoom & pan canvas (scroll wheel + buttons)
- Step-by-step guided panels (each step unlocks the next)
- Diagonal intersection for scientific Brahmasthan calculation
- North-direction alignment (visual + manual degree input)
- Bundled Vastu Shakti Chakra image (transparent PNG, 3024px)
- Upload a custom chakra image if desired
- Fine rotation for precise alignment (±10° in 0.1° steps)
- Dim floor plan toggle for better visibility
- Export composited PNG at full resolution

## Run locally

```bash
python3 -m http.server 8777
# open http://localhost:8777
```

Or simply open `index.html` in a browser.

## Project structure

```
.
├── index.html                     # UI (step-by-step panels + canvas)
├── css/styles.css                 # styling
├── js/app.js                      # main canvas editor logic
├── js/chakras.js                  # SVG fallback chakra generator
├── assets/chakras/
│   ├── vastu-shakti-chakra.png    # default bundled chakra (transparent)
│   └── README.txt                 # instructions for replacing
├── Dockerfile                     # nginx container (port 8080)
├── nginx.conf
└── .do/app.yaml                   # DigitalOcean App Platform spec
```

## Deploy on DigitalOcean

### App Platform (easiest)
1. Push to GitHub
2. DigitalOcean → Apps → Create App → pick your repo
3. Auto-detects Dockerfile, serves on port 8080

### Docker
```bash
docker build -t vastu-placer .
docker run -p 8080:8080 vastu-placer
```

### Static hosting
Drop `index.html`, `css/`, `js/`, `assets/` onto any static host.
