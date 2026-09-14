/**
 * The sliver of the extension API these specs evaluate INSIDE a wallet's
 * service worker.
 *
 * Declared here rather than pulled in as `@types/chrome` because that package
 * is a large surface for two calls, and because the shape that matters is the
 * one the worker actually has: anything wider would let a spec type-check
 * against an API the wallet's manifest may not expose.
 */
declare const chrome: {
  storage: {
    local: {
      get(keys: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};
