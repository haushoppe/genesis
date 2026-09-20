# Regtest inscription fixtures

The bytes the regtest bootstrap inscribes so a cube minted on regtest
references inscriptions that EXIST on regtest.

Nothing hardcoded may point at mainnet from a regtest run: a fixture
aimed at mainnet data is the bug, not the 404 it produces. These are
inscribed locally at bootstrap, so the run needs no mainnet egress and
the cube actually renders.

Byte-identical copies of the mainnet originals, so a regtest cube behaves
like a real one:

| file | mainnet inscription | bytes |
|---|---|---|
| `side-1.png` | `df58fbb44dbb2a9b17405f944c8ff966fd120cccda87873f3206f012ea239bebi0` | 325 |
| `side-2.png` | `ad8d751046787e22a0ef89a15b7f0e5eedae927a488a8ecc7e30711a7692fb11i0` | 338 |
| `side-3.png` | `fe4e588430b19d6e8b81005a3515a0f634fb3cd3b3bdf372bc7b12b50e302acci0` | 332 |
| `side-4.png` | `9825f7f09818f0adb7d3b20a4db6aa92f9af850bd4e0597db6b7ade3790b0f5bi0` | 335 |
| `side-5.png` | `412cb15b19496075ef9afbd07fbabe6d6e08461c30845fafe4ece083fd20d84fi0` | 328 |
| `side-6.png` | `81c64b1c7dfa8ce4e9e32dbcf68fbb51e004fb56be5b2253c880cd833ae74bcai0` | 334 |
| `cube-renderer.js` | `fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0` | 2376 |

The six PNGs are the BitcoinOneZero digits 1-6 (600x600, image/png), which
production also uses as the mint form's placeholder faces. The JS is the v3
cube renderer every cube body loads through `/content/`.

`sha256.txt` pins them. Re-fetch with
`curl -s https://api.ordpool.space/content/<id>` and compare.
