/**
 * Custom webpack config for cubes-frontend.
 *
 * Reason: ordpool-sdk imports `sats-connect` (for its Xverse
 * connector) which references Node built-ins — `Buffer`, `crypto`,
 * `stream`, etc. Vanilla @angular-devkit/build-angular does not
 * polyfill Node built-ins for the browser; without these aliases
 * and the Buffer/process ProvidePlugins, the SDK crashes at
 * module-init time when the browser hits `Buffer.from(…)` or
 * `require("crypto")`.
 *
 * Same shape as apps/genesis-frontend/webpack.config.js — that
 * project uses @web3-onboard which hits the same Node-built-in
 * assumptions.
 */
const webpack = require('webpack');

module.exports = {
  resolve: {
    alias: {
      assert: 'assert',
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      http: 'stream-http',
      https: 'https-browserify',
      os: 'os-browserify/browser',
      process: 'process/browser',
      stream: 'stream-browserify',
      util: 'util',
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
};
