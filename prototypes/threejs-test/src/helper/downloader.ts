import Axios from  'axios-observable';
import { forkJoin, retry } from 'rxjs';
import { config } from "../config";

// +encodeURIComponent
const testImages = [
  'https://cloudflare-ipfs.com/ipfs/QmYKabnBxtucct5Vkf81o9ZX6u2sCnZKU94VfGqUwzbZwg',
  'https://cloudflare-ipfs.com/ipfs/QmaWN5wo72fs9NGbXZnK3He8C8uZyURL6QrSJfwrCVzkEZ',
  'https://cloudflare-ipfs.com/ipfs/QmPRPBncyL6oxz6uQ4edgBBSBiounmeD3PpwzEZv23HEfk',
  'https://cloudflare-ipfs.com/ipfs/QmYksSVBoM8YYbJSMVab2mq6mg3sfQ2xaCmAhhc4LgR5Ny',
  'https://cloudflare-ipfs.com/ipfs/QmciDF297zeVRJSMuBycVSUY1WZuuvQeJBxZXUZp92dx4J',
  'https://cloudflare-ipfs.com/ipfs/QmacJ5HVz89YXNLXthWC3TqTNTQFyGLYeYMWnzb1UpUEiV'
];

// Three.js has no error handling at all for the Loaders :-(
export class Downloader
{

  getTextures() {

    const textures$ = testImages.map(url =>

      Axios.get(config.httpProxy + encodeURIComponent(url)).pipe(
        retry({
          count: 4,
          delay: 1000
        })
      )
    );

    return forkJoin(textures$);

  }

}
