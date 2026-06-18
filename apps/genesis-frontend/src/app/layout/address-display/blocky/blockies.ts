// Identicons for Ethereum addresses
// original source from https://github.com/ethereum/blockies/blob/master/blockies.js

interface BlockiesBuildOptions {
  seed: string; // seed used to generate icon data
  size?: number; // width/height of the icon in blocks, default: 8
  scale?: number; // width/height of each block in pixels, default: 4
  color?: string; // to manually specify the icon color, default: random
  bgcolor?: string; // choose a different background color, default: random
  spotcolor?: string; // each pixel has a 13% chance of being of a third color,
}

interface BlockiesOptions {
  seed: string;
  size: number;
  scale: number;
  color: string;
  bgcolor: string;
  spotcolor: string;
}

// The random number is a js implementation of the Xorshift PRNG
const randseed = new Array(4); // Xorshift: [x, y, z, w] 32 bit values

function seedrand(seed: string) {
  for (let i = 0; i < randseed.length; i++) {
    randseed[i] = 0;
  }
  for (let j = 0; j < seed.length; j++) {
    randseed[j%4] = ((randseed[j%4] << 5) - randseed[j%4]) + seed.charCodeAt(j);
  }
}

function rand() {
  // based on Java's String.hashCode(), expanded to 4 32bit values
  const t = randseed[0] ^ (randseed[0] << 11);

  randseed[0] = randseed[1];
  randseed[1] = randseed[2];
  randseed[2] = randseed[3];
  randseed[3] = (randseed[3] ^ (randseed[3] >> 19) ^ t ^ (t >> 8));

  return (randseed[3]>>>0) / ((1 << 31)>>>0);
}

function createColor(): string {
  //saturation is the whole color spectrum
  const h = Math.floor(rand() * 360);
  //saturation goes from 40 to 100, it avoids greyish colors
  const s = ((rand() * 60) + 40) + '%';
  //lightness can be anything from 0 to 100, but probabilities are a bell curve around 50%
  const l = ((rand()+rand()+rand()+rand()) * 25) + '%';

  const color = 'hsl(' + h + ',' + s + ',' + l + ')';
  return color;
}

function createImageData(size: number) {
  const width = size; // Only support square icons for now
  const height = size;

  const dataWidth = Math.ceil(width / 2);
  const mirrorWidth = width - dataWidth;

  const data = [];
  for(let y = 0; y < height; y++) {
    let row = [];
    for(let x = 0; x < dataWidth; x++) {
      // this makes foreground and background color to have a 43% (1/2.3) probability
      // spot color has 13% chance
      row[x] = Math.floor(rand()*2.3);
    }
    const r = row.slice(0, mirrorWidth);
    r.reverse();
    row = row.concat(r);

    for(let i = 0; i < row.length; i++) {
      data.push(row[i]);
    }
  }

  return data;
}

function buildOpts(opts: BlockiesBuildOptions): BlockiesOptions {
  const newOpts = {} as BlockiesOptions;

  // EDIT: removing the random seed here,
  // because we always want a deterministic behaviour
  newOpts.seed = opts.seed; // || Math.floor((Math.random()*Math.pow(10,16))).toString(16);

  seedrand(newOpts.seed);

  newOpts.size = opts.size || 8;
  newOpts.scale = opts.scale || 4;
  newOpts.color = opts.color || createColor();
  newOpts.bgcolor = opts.bgcolor || createColor();
  newOpts.spotcolor = opts.spotcolor || createColor();

  return newOpts;
}

function renderIcon(bopts: BlockiesBuildOptions, canvas: HTMLCanvasElement) {
  const opts = buildOpts(bopts || ({} as BlockiesBuildOptions));
  const imageData = createImageData(opts.size);
  const width = Math.sqrt(imageData.length);

  canvas.width = canvas.height = opts.size * opts.scale;

  const cc = canvas.getContext('2d');
  if (!cc) {
    return null;
  }
  cc.fillStyle = opts.bgcolor;
  cc.fillRect(0, 0, canvas.width, canvas.height);
  cc.fillStyle = opts.color;

  for(let i = 0; i < imageData.length; i++) {

    // if data is 0, leave the background
    if(imageData[i]) {
      const row = Math.floor(i / width);
      const col = i % width;

      // if data is 2, choose spot color, if 1 choose foreground
      cc.fillStyle = (imageData[i] == 1) ? opts.color : opts.spotcolor;

      cc.fillRect(col * opts.scale, row * opts.scale, opts.scale, opts.scale);
    }
  }
  return canvas;
}

function createIcon(opts: BlockiesOptions) {
  const canvas: HTMLCanvasElement = window.document.createElement('canvas');

  renderIcon(opts, canvas);

  return canvas;
}

export const blockies = {
  create: createIcon,
  render: renderIcon
};


