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
