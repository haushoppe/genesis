// The `process` package (a browser polyfill re-export used by sats-connect)
// ships JS without .d.ts. We only assign it to `window.process` in
// polyfills.ts; nothing else in the app types it, so a bare `unknown`
// export is enough to satisfy `strict: true` without pulling @types/node.
declare module 'process' {
  const process: unknown;
  export default process;
}
