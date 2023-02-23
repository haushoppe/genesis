const webpack = require('webpack')

// see https://onboard.blocknative.com/docs/modules/core#webpack-5

module.exports = {
  resolve: {
    // fallback: {
    //   path: require.resolve('path-browserify')
    // },
    alias: {
      assert: 'assert',
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      http: 'stream-http',
      https: 'https-browserify',
      os: 'os-browserify/browser',
      process: 'process/browser',
      stream: 'stream-browserify',
      util: 'util'
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ]
}
