# Womp Studio

Static website and interactive showcase for Womp Studio.

## Overview

- **Homepage (`index.html`)**: Mounts `expedition/` featuring real local Pleco rigs, character sprites, and scroll-controlled reversible combat.
- **Studio Archive (`studio.html`)**: Original studio portfolio and project catalog.
- **Zero Build**: Pure static assets. No build step, package installations, or environment variables required.

## Local Development

Start a local server using Python 3:

```bash
python -m http.server 4173
```

Open http://localhost:4173 . Serve over HTTP rather than opening the HTML as a file.

## Testing

Requires Node.js 20 or newer. Runs 28 automated tests against bundled test fixtures:

```bash
npm test
```

## Deployment (Vercel)

1. Import the repository into Vercel.
2. Set Framework Preset to **Other**, Root Directory to `.`, disable the Build Command and set Output Directory to `.`.
3. Deploy.

## License & Assets

All artwork, sprites, rigs, and assets are proprietary to Womp Studio. All rights reserved.

## Files

- index.html: homepage mirror, with its base pointing to expedition/.
- expedition/: animation, combat timeline, real game rig runtime, sprites, backgrounds, weapons, documentation and tests.
- studio.html, scroll.js, three-bg.js and img/: preserved earlier studio page.
- vercel.json: static hosting headers.
- test-fixtures/: source snapshots used only by tests.

When editing expedition/index.html, update the root index.html mirror and retain its base href="/expedition/".

## Hosting notes

The root homepage uses base href="/expedition/". Subpath hosts such as GitHub project Pages require adjusting that base. Update preserved studio canonical/sitemap metadata if changing the deployment domain.

Google Fonts and the preserved studio page's Three.js/GSAP use external CDNs. Expedition art and runtime are bundled locally. GitHub Actions runs npm test. Test fixtures are source snapshots, never loaded by the website. Account bindings, credentials and .vercel are excluded.
