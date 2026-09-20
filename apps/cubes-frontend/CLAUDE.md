# cubes-frontend/CLAUDE.md

Signal-first Angular 22 app.

## Reading order

1. `/Users/johanneshoppe/Work/ordpool/CLAUDE.md` (workspace)
2. `genesis/CLAUDE.md` (this repo)
3. This file
4. Before any E2E work: `/Users/johanneshoppe/Work/ordpool/E2E_BEST_PRACTICES.md`

## RULE: No NgRx

- Banned: `provideStore`, `provideEffects`, `provideRouterStore`, `provideStoreDevtools`, facades over `Store.selectSignal`, `createActionGroup`/`createReducer`, the `ngrx-store-localstorage` metaReducer.
- Use `signal()` for local state, `computed()` for derived values, `linkedSignal()` for editable state that resets on its source, `effect()` for side effects, `rxResourceFixed()` for async data.
- Persistence across reloads is a `signal()` plus an `effect()` reading and writing localStorage, not a store.

## RULE: Never set `changeDetection`

- OnPush is the default in Angular 22. The enum values changed: `OnPush = 0` (default), `Eager = 1` (the old `Default`, now `@deprecated`).
- Omit the key. Setting `ChangeDetectionStrategy.OnPush` is noise, like `standalone: true` or an empty `imports: []`.
- The greedy behaviour, if ever needed, is `ChangeDetectionStrategy.Eager` with a comment saying why.

Ref: `node_modules/@angular/core/types/_debug_node-chunk.d.ts`, the `ChangeDetectionStrategy` JSDoc.

## RULE: Async data goes through `rxResourceFixed`

- Never call `rxResource` or `resource` from `@angular/core` directly. Use `src/app/shared/utils/rx-resource-fixed.ts`.
- It fixes three built-in bugs: value resets to `undefined` when params change (flicker), `HttpErrorResponse` wrapped in `ResourceWrappedError`, and `reload()` not clearing error state immediately.
- Reactivity comes from `params`, never from signals read inside `stream`.
- `.reload()` directly; no refresh keys, no Subjects.
- No `firstValueFrom` in services: return `Observable<T>` or `Promise<T>` and let the component wrap it.

## rxResourceFixed shape

```typescript
readonly cubesResource = rxResourceFixed({
  params: () => ({ page: this.currentPage() }),
  stream: ({ params }) => this.cubesData.getCubes(params.page),
});
```

```html
@if (cubesResource.value(); as cubes) { <!-- render --> }
@else if (cubesResource.isLoading()) { <!-- skeleton --> }
@else if (cubesResource.error()) { <a (click)="cubesResource.reload()" role="button">Retry</a> }
```

## RULE: Nothing hardcoded may be unreachable on regtest

- Inscription ids that production reads from mainnet come from the environment, never from module constants: `cubeRendererInscriptionId`, `previewFallbackSides`, `bannerCubeSides`, `cubesIndexBase`, `suggestionGalleries`, `sideImageProbeBase`.
- On regtest they resolve to fixtures inscribed on that chain by `e2e/regtest/inscribe-fixtures.sh`, which writes `src/environments/regtest-inscriptions.generated.ts` (gitignored; `scripts/ensure-regtest-inscriptions.mjs` writes a loud placeholder from `pretypecheck`/`prebuild` so a missing file cannot break the production build).
- `parse-cube.ts`'s known-versions list takes `environment.cubeRendererInscriptionId` in its v3 SLOT, never a fourth entry: an appended entry reports the cube as v4 and breaks the Version trait.
- A Node-side importer of app code (a Playwright spec) resolves `environments/environment` WITHOUT Angular's fileReplacements, so it sees mainnet values while the running app sees regtest ones. `expectedRegtestCubeHtml` and `parseRegtestCube` in `e2e/regtest/regtest-helpers.ts` bridge that, and throw rather than pass through if the id they substitute is absent.

Why: a fixture pointing at mainnet is the bug, not the 404 it produces. See the workspace rule "Never suppress an error. Fix it, or ask."

## RULE: Cube iframes render via srcdoc + dark canvas. Do not refactor

<!-- long-rule: the measured luminance profiles and the list of failed approaches ARE the rule; a replacement without them repeats a shipped regression -->

Every on-chain cube iframe (gallery tiles, details, mint-success preview, "My cubes") renders through `ToggleIframeDirective` and `src/app/shared/utils/cube-srcdoc.ts`. Replace it only with (a) a measured reproduction of a problem with it and (b) a measured proof the replacement passes the test below. A green suite is not that proof: both earlier regressions shipped green.

**The mechanism, all six parts load-bearing:**

1. **Fetch the bytes, then `srcdoc`; never a cross-origin `src`.** On intersection the directive fetches the cube's HTML from the ord behind the preview base (sibling `/content/<id>`; CORS `*` verified on ordinals.com, api.ordpool.space, ord.ordpool.space). Owning the document is the only way to paint before the cube's own script runs.
2. **`<meta name="color-scheme" content="dark">` inside the document.** A browser paints a document's canvas in that document's scheme; the parent's never crosses the frame boundary (measured: a cross-origin `/preview/` frame painted white under a dark parent).
3. **The stage as CSS, before the renderer runs.** The renderer injects `body { background-color: t; background-image: linear-gradient(180deg, t 20%, u 80%) }`, draws on a transparent WebGL canvas, and adds a lit floor in `k`. Defaults `t`/`u`/`k` = `#000000`/`#5a5a5a`/`#202020`; a cube overrides them via fields 9, 10, 8 of its `t='…'` list. `stageCss()` reproduces sky, horizon and floor from `stageColorsOf` (values validated so nothing escapes the style), `!important` so the renderer's later sky-only style cannot drop the floor replica. All three renderer versions paint this same stage.
4. **A dark stage placeholder, never `about:blank`.** Off-viewport and during a fetch the iframe shows `DARK_PLACEHOLDER_SRCDOC`. `about:blank` is white.
5. **The texture shim, injected before the cube's scripts.** Chrome refuses an SVG with no intrinsic size as a WebGL texture source: it decodes, the upload fails `INVALID_VALUE` ("bad image data"), the face stays black. Same on ordinals.com's own `/preview/`. The shim patches `texImage2D`/`texSubImage2D` on both contexts: a failed `HTMLImageElement` upload is redrawn onto a canvas and that is uploaded, keeping the image's pixel size (WebGL2 allocates immutable storage from it). Needs an origin-clean image, hence `crossOrigin='anonymous'` on every `<img>` the document creates. The six "bad image data" warnings are the native first attempt and stay.
6. **Every document after the first goes in a FRESH iframe element.** Chrome does not paint a new srcdoc document in an iframe whose current document ran WebGL: prev/next on the details page left a flat dark rectangle although the document loaded and fetched everything. A new element with identical srcdoc painted at once.

Around it: a stale-fetch guard, an LRU cache keyed by source and id, and lazy load/unload via `IntersectionObserver`.

**Measured proof** (2026-09-11, live site, 390 px viewport, Playwright; mean luminance 0 black to 255 white, plus a 16-row profile down a stage-only column at 6% width):

- Cross-origin `src` + `about:blank` (regression `6f63eff`): **255** from the first sample after `load`, still 255 past one second, both colour schemes, every scroll-in. Cube painted at ~2.7 to 3 s. Twelve tiles: a strobe.
- srcdoc + meta (`b8e640f`): **31**, never above 80 (that is the cube painting).
- srcdoc + meta + stage CSS (final): 43 ms after scroll-in, before any `load`, the profile is already `0 0 0 3 12 21 32 41 | 1 6 12 17 22 27 32 32`; the placeholder alone reads `… 41 | 1 7 12 17 22 28 32 32`; the finished WebGL stage `… 41 | 4 10 17 22 26 29 31 33`. Sky identical, floor within five steps.

**Tried, does NOT work, do not retry:**

- `:root { color-scheme: dark }` on the app (`6d2d3fb`): Bootstrap already sets it. Reverted `90e2c46`.
- `color-scheme` or `background` on the `<iframe>` element: does not cross the document boundary.
- `opacity: 0` until `load`: `load` fires long before the WebGL scene paints, so it reveals a white document.
- A cross-origin `src` to `/preview/<id>` for speed or "real bytes" (`6f63eff`): the bytes are just as real when fetched, and the frame is white until the script runs.
- A dark placeholder without the in-document meta (`139efcd`): fixes scroll-out, not the load window.
- A fixed delay before revealing: guessed; too short flashes, too long hides a painted cube.

**The test a replacement must pass:** Playwright on the built app, `emulateMedia({ colorScheme: 'light' })`, viewport 390x844, an `iframe[apptoggleiframe]` below the fold, `scrollIntoView`, element-screenshot every 100 to 400 ms for ~5 s, compute mean luminance plus the column profile. Pass: no sample near 255, and the profile right after scroll-in matches the settled stage in the sky rows and is within a few steps in the floor rows. Repeat after scroll-out and a second scroll-in. Then run the same measurement against production.

Then the SPA paths a direct load never exercises: on a details page press ArrowRight or click "Next Cube" and screenshot after a few seconds (measured with the fresh-element swap: iframe region mean luminance 41 and 36 right after the swap, never white); on the gallery scroll tiles out and back in; confirm exactly one iframe per tile remains after the swaps.

**Pitfalls that produced wrong conclusions here:**

- `load` fires after the renderer script ran. Sample by time after scroll-in, not after `load`.
- Setting `srcdoc` to the value it already holds does not re-navigate, so no `load` fires.
- A Playwright element screenshot scrolls the element into view first and triggers the lazy load; measure the placeholder in a standalone iframe.
- `page.waitForFunction(fn, arg, options)` takes ONE argument; a second is read as options and the wait silently times out.
- The Playwright MCP console log glues `:<column>` onto a resource URL with no separator, so `…i02888:0` is not a request for `:0`. Verify with `page.on('response')`.
- Under plain `ng serve` the start page has no gallery and no mint form: `environment.ts` carries `haushoppeTipAddress: '???'` and `deriveNetwork()` throws. Use `npm run start:regtest`, or put a real mainnet address there temporarily and never commit it.

**Known and unrelated:** cube #96140351 (`8bb3374c…i0`) carries five side ids with zero-padded indices (`i02888` and friends) that no inscription has. They 404 on ordinals.com's own preview too. On-chain, immutable, one cube. Do not touch the mechanism for them.

**Files:** `src/app/services/cube-html.ts` (`getCubeHtml`, the cube body every consumer generates from; 11 importers), `src/app/layout/toggle-iframe.directive.ts`, `src/app/shared/utils/cube-srcdoc.ts` (+ `.vitest.ts`), `src/app/shared/utils/preview-dark-canvas.ts` (local previews), `src/shared/ordinals/parse-cube.ts` (the version gate), and `e2e/regtest/specs/unisat-cube-mint-roundtrip.spec.ts`, which asserts the minted body reaches the success preview's srcdoc byte-for-byte.

## RULE: The header paints with zero requests

- `src/app/layout/banner/banner-poster.ts` holds a 5914-byte WebP still frame of the featured cube as a data URI. It carries first paint.
- The live cube replaces it after the window `load` event plus an idle callback, never on `afterNextRender` alone: measured, that swap fires within milliseconds and the ~253 KB of on-chain fetches (renderer + its 250274-byte three.js and fflate bundle + one image per side) land back inside the window that decides first paint.
- Regenerate the poster after changing `bannerCubeSides`: screenshot the banner iframe on the live site at deviceScaleFactor 2, then `cwebp -q 72 -resize 1200 0 shot.png -o poster.webp`, and base64 it into that file.

## RULE: A green vitest suite says nothing about types

- Run the suite with `npm run test:vitest`. Specs sit next to the code (`foo.spec.ts`, or the legacy `foo.component.spec.ts`).
- `npm run typecheck` runs `tsconfig.app.json`, `tsconfig.spec.json` and `tsconfig.e2e.json`. CI runs it after the test lanes.
- vitest strips types rather than checking them, and `ng build` compiles the app project and not the tests, so a spec can disagree with the types it claims to use and stay green forever.
- A test file matching neither `*.spec.ts`, `*.test.ts` nor `*.vitest.ts` is invisible to the checker; add its pattern to `tsconfig.spec.json`.
- Never run `tsc -p tsconfig.json` and treat the output as real: it is the base config, has no test-runner types, and reports dozens of meaningless missing-`describe` errors.
- A mock of an object must SPREAD the real one (`vi.importActual`) and override only what the test needs. A hand-listed copy silently omits every field added later.

Ref: a hand-written `InscribeSnapshot` fell five fields behind its SDK type unnoticed; a hand-listed `environment` mock omitted two new fields and turned the production build red for four commits.

## Component conventions (Angular 22+)

- No `standalone: true` (default since v19). No empty `imports: []`. No empty stylesheet file, omit `styleUrl`.
- No `.component.` in filenames: `start.ts`, `start.html`, `start.scss`, `class Start`. Existing files keep the old naming; apply this to new components only.
- `inject()` over constructor injection, always.
- `input()` / `output()` functions, not decorators.
- `@if` / `@for` / `@switch`, never `*ngIf` / `*ngFor` / `*ngSwitch`.
- Host bindings in `host: { }`, not `@HostBinding` / `@HostListener`.
- `[class.foo]="bar()"` not `ngClass`; `[style.color]="c()"` not `ngStyle`.

## Template and signal rules

- Read signals directly in interpolations and bindings: `{{ x() }}`, `[disabled]="isBusy()"`.
- Prefer top-level signal reads. Deeply nested `@if (x; as alias)` with the alias read in the interior view is the shape behind Angular #61662; use `rxResourceFixed` and do not fabricate nested `@if` gates on top of it (detail in `CLAUDE_HISTORICAL_BUGS.md`).
- `@if (x; as alias)` scopes `alias` to that view. For multiple uses take a named `linkedSignal` or a top-level `@let`.
- `computed()` reading a plain object property (`router.url`) needs `toSignal()` first.
- Signals read inside `resource.stream` are NOT tracked; reactive reads belong in `params`.
- Setting a signal inside `computed()` is a bug; use `effect()`.
- `linkedSignal` when local state follows an async source but stays editable.

## Templates and accessibility

- Every route needs a `title`.
- `<button>` for actions, `<a>` for navigation.
- `rel="noopener"` on every `target="_blank"`.
- `aria-live="polite"` on async-updating containers, `role="status"` on spinners with a `visually-hidden` label, `role="alert"` on errors.

## Services and RxJS

- Single responsibility, `providedIn: 'root'`, `inject()`.
- HTTP-backed methods return `Observable<T>`; do not convert to Promise or Signal inside the service.
- Never `firstValueFrom` / `toPromise` in a service.
- `switchMap` / `concatMap` / `mergeMap` for chaining; `toSignal()` at the component entry point.

## RULE: native `fetch` only

- No `axios`, no `xhr`. `HttpClient` where Angular DI matters (interceptors, auth), `fetch` for plain reads.

## Routing: sort and page are query parameters

- `/?sort=newest&page=3`, bound to `StartComponent` inputs by `withComponentInputBinding()`, parsed by `toCubeSort` / `toCubePage` which tolerate missing or nonsensical values. `cubeListQueryParams` writes only what differs from the default, so a plain URL stays plain.
- Because those are navigations, the router's `withInMemoryScrolling` is OFF in `app.config.ts` and `CustomScrollService` is the single authority: back/forward restores position, an anchor is polled into view, a navigation within the same component HOLDS the viewport, only a navigation to another component jumps to the top.
- The hold is active: the grid swaps every tile at once and the document is briefly too short to keep the offset, so the position is re-asserted for 1.5 s.

Ref: verified in the browser, sort/page/Back/Back keep y=1556; opening a cube lands at top; Back restores y=1556; the `#mint` anchor lands on the heading.

## RULE: keep `deployUrl: "/"`

- Set in `angular.json`. It makes every resource URL in `index.html` root-absolute (`/main-XXXX.js`, `/chunk-XXXX.js`).
- Angular emits the hint relative (`<link rel="modulepreload" href="chunk-XXXX.js">`) and Cloudflare Pages turns it into a header (`link: <chunk-XXXX.js>; rel="modulepreload"`). A relative `Link` target resolves against the REQUEST URL, not `<base href="/">`, so on a nested route (`/inscription/<id>`) the browser preloads `/inscription/chunk-XXXX.js`, the SPA fallback answers with index.html, and every deep link logs "Failed to load module script … MIME type of text/html".
- Only the hint misfires; the chunk still loads via `main.js`. `/faq` never showed it because a relative name under a top-level route resolves to the root.
- A plain static server sends no such header, so this does not reproduce locally. Verify on production. `index.preloadInitial: false` would drop the hint altogether and is not the fix.

## What lives where

| Path | What |
|---|---|
| `src/app/start/` | mint form, drawer, past mints, minted-cubes grid |
| `src/app/details/` | single cube page |
| `src/app/faq/`, `src/app/presskit/` | static content |
| `src/app/layout/` | banner, footer, header, cube-preview, inscription-list-item, loading-indicator |
| `src/app/services/` | thin HTTP wrappers |
| `src/app/services/cubes-data/rarity.service.ts` | `rarity.json` from the cubes index (rank, score, cursed reasons); rules in the `ordinal-cubes-index` README, wording in `rarity-labels.ts` |
| `src/app/services/cubes-data/cube-order.ts` | list order: newest first, or by rarity rank with unranked last. A plain signal, not a URL parameter, because a query-param navigation scrolls to the top |
| `src/app/start/side-image-check.ts`, `side-image-probe.service.ts` | the black-face check: every side loads as an `<img>` from `environment.sideImageProbeBase`, the renderer's own load path, and Mint stays off until all six decode. The cubes index probes the same way, so a cube that passes here is not cursed there |
| `src/app/shared/utils/rx-resource-fixed.ts` | the resource wrapper |
| `src/environments/` | per-environment config, including every id that must differ on regtest |
