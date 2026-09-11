# cubes-frontend/CLAUDE.md

Signal-first Angular 22 app. Adapted from the maintainer's `learnly`
best-practices playbook — the same patterns apply here.

## Reading order

1. Workspace `/Users/johanneshoppe/Work/ordpool/CLAUDE.md`
2. `genesis/CLAUDE.md` (this repo)
3. This file (frontend-specific)
4. Before any E2E work: workspace `/Users/johanneshoppe/Work/ordpool/E2E_BEST_PRACTICES.md`
   (data-testid first, click instead of `goto`, wait on states, secure-first-then-refactor,
   regtest bootstrap, wallet-load pattern, `openDetails` helper convention).

## HARD RULE: No NgRx in this app

NgRx was retired in favor of signals + `rxResourceFixed` (see below).

- No `provideStore`, `provideEffects`, `provideRouterStore`,
  `provideStoreDevtools`.
- No facades over `Store.selectSignal`.
- No `createActionGroup`/`createReducer`.
- No `ngrx-store-localstorage` metaReducer.

State-management primitives:

- `signal()` for local component state.
- `computed()` for derived read-only values.
- `linkedSignal()` for editable state that resets on source change.
- `effect()` for side effects that must run when signals change.
- `rxResourceFixed()` for async data (see below).

If a piece of state needs to persist across reloads, wrap a
`signal()` in an `effect()` that reads/writes localStorage. Don't
introduce a store just for that.

## HARD RULE: Don't set `changeDetection` explicitly

**OnPush is the default in Angular 22.** The enum still exists but its
values changed: `OnPush = 0` (the default), `Eager = 1` (the old
`Default` value, now `@deprecated`). Explicitly setting
`changeDetection: ChangeDetectionStrategy.OnPush` is redundant noise
just like `standalone: true` and empty `imports: []`.

Verify: `node_modules/@angular/core/types/_debug_node-chunk.d.ts`
around the `ChangeDetectionStrategy` enum — the JSDoc says "OnPush
is enabled by default".

If you ever need the old greedy behaviour (you probably don't in a
zoneless signal-first app), set `changeDetection:
ChangeDetectionStrategy.Eager` explicitly with a comment explaining
why. Otherwise omit the `changeDetection` key entirely.

## HARD RULE: Async data via `rxResourceFixed`

**Never call `rxResource` or `resource` from `@angular/core` directly.**
Use the wrapper at `src/app/shared/utils/rx-resource-fixed.ts` which
fixes three bugs in the built-in:

1. Value resets to `undefined` when parameters change (causes flicker).
2. `HttpErrorResponse` gets wrapped in an unhelpful `ResourceWrappedError`.
3. `reload()` doesn't clear error state immediately.

### Basic pattern

```typescript
import { rxResourceFixed } from '../shared/utils/rx-resource-fixed';

readonly cubesResource = rxResourceFixed({
  params: () => ({ page: this.currentPage() }),
  stream: ({ params }) => this.cubesData.getCubes(params.page),
});
```

Template consumes status directly:

```html
@if (cubesResource.value(); as cubes) {
  <!-- render cubes -->
} @else if (cubesResource.isLoading()) {
  <!-- skeleton -->
} @else if (cubesResource.error()) {
  <p>Failed. <a (click)="cubesResource.reload()" role="button">Retry</a></p>
}
```

### Key rules

- Reactivity comes from `params`, not from reading signals inside `stream`.
- Use `.reload()` directly — no refresh keys or Subjects needed.
- No `firstValueFrom` in services — services return `Observable<T>` or
  `Promise<T>` and the component uses `rxResourceFixed`/`toSignal`.

## HARD RULE: Cube iframes render via srcdoc + dark canvas (final, measured; do not refactor)

**Every on-chain cube iframe (gallery tiles, details page, mint-success
preview, "My cubes") is rendered by `ToggleIframeDirective` through the
mechanism in `src/app/shared/utils/cube-srcdoc.ts`. It is the final solution
to the white-flash and stage-flicker problem. Do not replace, "simplify" or
re-architect it without (a) a measured reproduction of a problem with it and
(b) a measured proof that the replacement passes the test below. "The tests
are green" or "it looked fine on my desktop" is not that proof: both earlier
regressions shipped green, and one of them was written by a session that had
just declared the problem solved.**

### The mechanism (all four parts are load-bearing)

1. **Fetch the bytes, then `srcdoc`; never a cross-origin `src`.** On
   intersection the directive fetches the cube's HTML from the ord behind the
   preview base (its sibling `/content/<id>`; CORS `*` verified live on
   ordinals.com, api.ordpool.space and ord.ordpool.space) and sets it as
   `srcdoc`. Owning the document is the only way to paint anything before the
   cube's own script has run.
2. **`<meta name="color-scheme" content="dark">` inside the document.** A
   browser paints a document's canvas in that document's colour scheme. The
   parent page's `color-scheme` never crosses the frame boundary (measured: a
   cross-origin `/preview/` frame painted white with the parent dark), so the
   meta has to live in the iframe's own head.
3. **The stage, as CSS, in the document before the renderer runs.** The v3
   renderer paints its stage at runtime by injecting
   `body { background-color: t; background-image: linear-gradient(180deg, t 20%, u 80%) }`
   (the sky), draws on a transparent WebGL canvas, and adds a lit floor plane
   in `k` that forms the horizon. `t`, `u`, `k` default to `#000000`,
   `#5a5a5a`, `#202020`; a cube overrides them via fields 9, 10, 8 of its
   `t='…'` list. `stageCss()` reproduces sky, horizon and floor with the cube's
   own colours (`stageColorsOf`, values validated so nothing can break out of
   the style), injected `!important` so the renderer's later sky-only style
   cannot drop the floor replica in the frames before WebGL paints the real
   floor. It applies to every cube: all three renderer versions (v1, v2, v3)
   paint this same stage, confirmed by the maintainer, who wrote them.
4. **A dark stage placeholder, never `about:blank`.** Out of the viewport, and
   while a fetch is in flight, the iframe shows `DARK_PLACEHOLDER_SRCDOC`, the
   default stage with nothing on it. `about:blank` is white.

Around that: a stale-fetch guard (a fetch superseded by a scroll-out or a new
id never overwrites the newer state), an LRU cache keyed by source and id (the
bytes are immutable), and lazy load / unload via `IntersectionObserver`, which
is what keeps twelve WebGL scenes from running at once on a phone.

The wrapping is display-only. The minted body stays the pristine canonical
cube from `getCubeHtml`, the bytes shown are the real on-chain bytes, and
`parseCube` rejects the wrapped copy by design (pinned in the spec). The local
previews (mint form, banner) render an un-inscribed cube and use
`withPreviewDarkCanvas` instead; the same rule applies to them.

### Measured proof (2026-09-11, live site, 390 px viewport, Playwright)

Method: scroll a below-fold tile into view and sample the iframe's rendered
pixels over time (mean luminance, 0 black to 255 white, plus a 16-row
luminance profile down a stage-only column at 6 % width).

- Cross-origin `src` + `about:blank` (the regression in `6f63eff`): **255**
  from the first sample after `load`, still 255 past one second, in light
  AND dark colour scheme, on the first scroll-in and on every scroll-out /
  scroll-in. The cube painted at about 2.7 to 3 s. Twelve tiles: a strobe.
- srcdoc + meta (`b8e640f`): the same window reads **31** (a flat dark
  canvas), never above 80 (that is the cube itself painting).
- srcdoc + meta + stage CSS (the final state): 43 ms after scroll-in, before
  any `load` has fired, the profile is already the stage,
  `0 0 0 3 12 21 32 41 | 1 6 12 17 22 27 32 32`; the placeholder in isolation
  reads `… 41 | 1 7 12 17 22 28 32 32`; the finished WebGL stage
  `… 41 | 4 10 17 22 26 29 31 33`. Sky identical, floor within five
  luminance steps. Placeholder, pre-render and finished stage look the same;
  only the cube appears.

### Tried before, does NOT work (do not retry)

- `:root { color-scheme: dark }` on the app (`6d2d3fb`): Bootstrap already
  sets it; changed nothing; reverted in `90e2c46`.
- `color-scheme` or a `background` on the `<iframe>` element: does not cross
  the document boundary; cosmetic.
- Keeping the iframe at `opacity: 0` until `load`: `load` fires once the
  document and its script tag have loaded, long before the WebGL scene
  paints, so it reveals a white document.
- A cross-origin `src` to `/preview/<id>` for "speed" or "real bytes"
  (`6f63eff`): the bytes are just as real when fetched, and the frame is
  white until the script runs.
- A dark placeholder alone, without the in-document meta (`139efcd`, 2023):
  fixes the scroll-out, not the load window.
- A fixed delay before revealing the frame: a guessed number; too short still
  flashes, too long hides a cube that has already painted.

### How to verify any change (the test a replacement has to pass)

Playwright against the built app: `emulateMedia({ colorScheme: 'light' })`,
viewport 390×844, pick an `iframe[apptoggleiframe]` below the fold,
`scrollIntoView`, then element-screenshot every 100 to 400 ms for about 5 s
and compute the mean luminance, plus the column profile. Pass: no sample near
255, and the profile right after scroll-in equals the settled stage profile
in the sky rows and stays within a few steps in the floor rows. Repeat after a
scroll-out (placeholder) and a second scroll-in. Then ship, and run the same
measurement against production.

Pitfalls that produced wrong conclusions while building this, each of which
cost real time:

- `load` fires after the renderer script ran; sample by time after
  scroll-in, not "after load", to see the pre-render window.
- Setting `srcdoc` to the value it already has does not re-navigate, so no
  `load` fires for it.
- A Playwright element screenshot scrolls the element into view first, which
  triggers the lazy load; measure the placeholder in a standalone iframe.
- `page.waitForFunction(fn, arg, options)` takes ONE argument; a second one
  is read as the options object and the wait silently times out.
- The Playwright MCP console log glues `:<column>` onto a resource URL with
  no separator, so `…i02888:0` is not a request for `:0`; verify request
  URLs with `page.on('response')`.
- Under plain `ng serve` the start page has no gallery and no mint form:
  `environment.ts` carries `haushoppeTipAddress: '???'` and
  `deriveNetwork()` throws on it. For a local measurement put a real mainnet
  address there temporarily and revert it; never commit it.

### Known and unrelated: five 404s on a full scroll

Cube #96140351 (`8bb3374c…i0`) carries five side ids with zero-padded indices
(`i02888` and friends) that no inscription has; they 404 on ordinals.com's
own preview as well. On-chain, immutable, one cube. Not a symptom of this
mechanism; do not touch the mechanism to make them go away.

### Files

`src/app/layout/toggle-iframe.directive.ts`,
`src/app/shared/utils/cube-srcdoc.ts` (+ `.vitest.ts`),
`src/app/shared/utils/preview-dark-canvas.ts` (local previews),
`src/app/services/cube-html.ts` (`CUBE_RENDERER_INSCRIPTION_ID`, the v3 id
the gate keys on), and
`e2e/regtest/specs/unisat-cube-mint-roundtrip.spec.ts`, which asserts that
the minted body lands in the success preview's srcdoc byte-for-byte.

## Component conventions (Angular 22+)

- **No `standalone: true`** — it's the default in v19+.
- **No `.component.` in filenames** — `start.ts`, `start.html`,
  `start.scss`. Class names have no `Component` suffix — `class Start`,
  not `class StartComponent`. Existing files may still use the old
  convention; only apply this rule to newly-created components until
  we do a workspace-wide rename.
- **No empty `imports: []`** — omit entirely if no imports needed.
- **No empty stylesheet files** — omit `styleUrl` if no CSS is needed.
- **`inject()` over constructor injection** always.
- **`input()` and `output()` functions** — not decorators.
- **Native control flow** — `@if`, `@for`, `@switch`, never
  `*ngIf`/`*ngFor`/`*ngSwitch`.
- **Host bindings in `host: { }`** — no `@HostBinding`/`@HostListener`.
- **Class bindings** — `[class.foo]="bar()"` — not `ngClass`.
- **Style bindings** — `[style.color]="c()"` — not `ngStyle`.

## Template signal-tracking rules

- Read signals directly in interpolations and property bindings —
  `{{ x() }}`, `[disabled]="isBusy()"`.
- Prefer top-level signal reads (root component view). Deeply-nested
  `@if (x; as alias)` with the alias-value read in the interior view
  is the shape that hit us with the #61662 bug — historical detail
  in `CLAUDE_HISTORICAL_BUGS.md`; the mitigation now is *use rxResource
  and don't fabricate nested `@if` gates on top of it*.
- Use `linkedSignal` when local state should follow an async source
  but stay editable — e.g. a form default derived from a resource
  value that the user can override.

## Vitest for unit tests

Vitest is installed at the workspace root. Unit tests live next to
the code:

- `foo.spec.ts` for a service or plain function
- `foo.component.spec.ts` for a component (legacy naming — new tests
  use `foo.spec.ts` alongside `foo.ts`)

Run: `npx vitest run` from `apps/cubes-frontend/`.

## Templates

- Every route needs a `title` (browser tab, screen readers).
- Use `<button>` for actions and `<a>` for navigation — never confuse.
- Add `rel="noopener"` on every `target="_blank"` link.
- `aria-live="polite"` on containers that update asynchronously.
- `role="status"` on spinners with a `<span class="visually-hidden">`.
- `role="alert"` on error messages.

## Services

- Design around a single responsibility.
- `providedIn: 'root'` for singletons.
- `inject()` — never constructor injection.
- Return `Observable<T>` from HTTP-backed methods so components can
  pipe them through `rxResourceFixed`. Do not eagerly convert to
  `Promise` or `Signal` inside the service.

## RxJS rules

- Never call `firstValueFrom`/`toPromise` in services.
- Prefer `switchMap`/`concatMap`/`mergeMap` for chaining.
- Use `toSignal(observable)` in components at the entry point when
  you have to expose an observable as a signal.

## Common pitfalls

- `@if (x; as alias)` — `alias` is view-scoped. Prefer named
  `linkedSignal` or top-level `@let` if you need the value in
  multiple places.
- `computed()` reading a plain object property (e.g. `router.url`) —
  convert to a signal first via `toSignal()`.
- Signals inside `resource.stream` are NOT tracked — put reactive
  reads in `params`.
- Setting signals inside `computed()` is a bug — use `effect()`.

## Build: `deployUrl` is `/` so the preload hint survives deep links

`angular.json` sets `"deployUrl": "/"` on the build, which makes every
resource URL Angular writes into `index.html` root-absolute (`/main-XXXX.js`,
`/chunk-XXXX.js`). Why that matters: Angular emits the start chunk's preload
hint relative (`<link rel="modulepreload" href="chunk-XXXX.js">`), and
Cloudflare Pages turns the page's preload links into an HTTP header
(`link: <chunk-XXXX.js>; rel="modulepreload"`, observed on production on every
route). A relative `Link` header target is resolved against the REQUEST URL,
not the document's `<base href="/">`, so on a nested route
(`/inscription/<id>`) the browser preloads `/inscription/chunk-XXXX.js`, the
SPA fallback answers with index.html, and the console shows "Failed to load
module script … MIME type of text/html" on every deep link. The chunk itself
still loads through `main.js`'s own import, so only the hint misfires; `/faq`
never showed it because a relative name under a top-level route resolves to
the root. A plain static server sends no such header, which is why this does
not reproduce locally: verify on production. Keep the option; the
alternative, `index.preloadInitial: false`, would drop the hint altogether.

## `native-fetch` only

- No `axios`, no `xhr`.
- `HttpClient` for Angular-DI-integrated cases (interceptors,
  auth), `fetch` for plain reads.

## What lives where

- `src/app/start/` — mint form, drawer, past mints, minted-cubes grid.
- `src/app/details/` — single cube page.
- `src/app/faq/`, `src/app/presskit/` — static content.
- `src/app/layout/` — reusable presentational components (banner,
  footer, header, cube-preview, inscription-list-item, loading-
  indicator).
- `src/app/services/` — thin HTTP wrappers.
- `src/app/shared/utils/rx-resource-fixed.ts` — the wrapper.
- `src/environments/` — env-specific config.
