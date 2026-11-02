# Womp Studio website

A static, scroll-controlled underwater expedition for Womp Studio. The homepage follows authentic Fish Aquarium plecos from a collectible card through the water surface, weapon pickups, ranged combat, bite/punch attacks, fighter swaps and six underwater worlds. Scroll upward to rewind the entire sequence.

## Run locally

Requires Python 3. No dependencies, build step or environment variables are needed.

```sh
python -m http.server 4173
```

Open http://localhost:4173/ . Serve over HTTP rather than opening index.html as a file, because the site uses ES modules and fetches local assets.

## Test

Requires Node.js 20 or newer. No npm install is required.

```sh
npm test
```

All 28 tests run independently. Source snapshots in test-fixtures/ support canonical game-source parity checks. GitHub Actions runs the tests on pushes and pull requests. Browser automation is not part of these checks.

## Files

- index.html: homepage mirror, with its base pointing to expedition/.
- expedition/: animation, combat timeline, real game rig runtime, sprites, backgrounds, weapons, documentation and tests.
- studio.html, scroll.js, three-bg.js and img/: preserved earlier studio page.
- vercel.json: static hosting headers.
- test-fixtures/: source snapshots used only by tests.

When editing expedition/index.html, update the root index.html mirror and retain its base href="/expedition/".

## Deploy

Import this repository into Vercel. Choose **Other** as the framework, repository root as Root Directory, leave the Build Command empty, and serve the repository root as the output. No secrets or environment variables are required. The .vercel account/project binding is intentionally excluded.

Any static host serving the repository root is suitable. For a subpath host such as GitHub project Pages, change the root index.html base to that deployment subpath first. The existing sitemap and canonical metadata in the preserved studio page reference womp-studio.vercel.app; update them if the domain changes.

Google Fonts and the preserved studio page's Three.js/GSAP libraries use external CDNs. Game art and the expedition runtime are bundled locally.

## Ownership

Website and game artwork are proprietary Womp Studio materials. No open-source license is granted by this repository.
