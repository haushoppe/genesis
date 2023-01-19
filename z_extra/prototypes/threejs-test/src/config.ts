const httpProxy = 'https://backend.haushoppe.art/cube/proxy/';

export const config = {
  httpProxy,
  hardcodedDieceTextures: [
    'images/textures/diece-1.svg',
    'images/textures/diece-2.svg',
    'images/textures/diece-3.svg',
    'images/textures/diece-4.svg',
    'images/textures/diece-5.svg',
    'images/textures/diece-6.svg'
  ],
  hardcodedStarsTextures: [
    httpProxy + encodeURIComponent('https://cloudflare-ipfs.com/ipfs/QmYKabnBxtucct5Vkf81o9ZX6u2sCnZKU94VfGqUwzbZwg'),
    httpProxy + encodeURIComponent('https://cloudflare-ipfs.com/ipfs/QmaWN5wo72fs9NGbXZnK3He8C8uZyURL6QrSJfwrCVzkEZ'),
    httpProxy + encodeURIComponent('https://cloudflare-ipfs.com/ipfs/QmPRPBncyL6oxz6uQ4edgBBSBiounmeD3PpwzEZv23HEfk'),
    httpProxy + encodeURIComponent('https://cloudflare-ipfs.com/ipfs/QmYksSVBoM8YYbJSMVab2mq6mg3sfQ2xaCmAhhc4LgR5Ny'),
    httpProxy + encodeURIComponent('https://cloudflare-ipfs.com/ipfs/QmciDF297zeVRJSMuBycVSUY1WZuuvQeJBxZXUZp92dx4J'),
    httpProxy + encodeURIComponent('https://cloudflare-ipfs.com/ipfs/QmacJ5HVz89YXNLXthWC3TqTNTQFyGLYeYMWnzb1UpUEiV')
  ]
}
