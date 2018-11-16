import * as libcp from 'child_process';
import * as libcrypto from 'crypto';
import * as libfs from 'fs';
import * as libpath from 'path';
import * as libdt from './delete_tree';

const SIZE = 8;

let gcd = (a, b) => {
  if (!b) {
    return a;
  }
  return gcd(b, a % b);
};

interface frame_info_t {
  dimx: number,
  dimy: number,
  parx: number,
  pary: number,
  darx: number,
  dary: number,
  farx: number,
  fary: number
};

let format_detect = (path: string, cb: { (result: frame_info_t): void }) => {
  libcp.exec(`ffprobe -v quiet -print_format json -show_streams ${path}`, (error, stdout, stderr) => {
    let json = JSON.parse(stdout);
    for (let i = 0; json.streams && i < json.streams.length; i++) {
      let stream = json.streams[i];
      if (stream.codec_type === 'video') {
        let divisor = gcd(stream.width, stream.height);
        let result = {
          dimx: stream.width,
          dimy: stream.height,
          parx: parseInt(stream.sample_aspect_ratio.split(':')[0]),
          pary: parseInt(stream.sample_aspect_ratio.split(':')[1]),
          darx: parseInt(stream.display_aspect_ratio.split(':')[0]),
          dary: parseInt(stream.display_aspect_ratio.split(':')[1]),
          farx: (stream.width / divisor),
          fary: (stream.height / divisor)
        };
        if (result.parx === 186 && result.pary === 157 && result.darx === 279 && result.dary === 157) {
          result.parx = 32;
          result.pary = 27;
          result.darx = 16;
          result.dary = 9;
        }
        cb(result);
        break;
      }
    }
  });
};

interface noise_t {
  y: number;
  u: number;
  v: number;
}

let analyse_frames = (path: string, finfo: frame_info_t, cb: { (n: any): void }): void => {
  let w = finfo.dimx;
  let h = finfo.dimy;
  let files = libfs.readdirSync(path).map((file) => {
    return libpath.join(path, file);
  });
  let frame = Buffer.alloc(w * h);
  let chroma_u = Buffer.alloc((w >> 1) * (h >> 1));
  let chroma_v = Buffer.alloc((w >> 1) * (h >> 1));
  let frame2 = Buffer.alloc(w * h);
  let chroma_u2 = Buffer.alloc((w >> 1) * (h >> 1));
  let chroma_v2 = Buffer.alloc((w >> 1) * (h >> 1));
  let accumulator3 = new Array<number>(w * h);
  for (let i = 0; i < accumulator3.length; i++) {
    accumulator3[i] = 0;
  }
  files.forEach((file) => {
    let offset = 0;
    let fd = libfs.openSync(file, 'r');
    offset += libfs.readSync(fd, frame, 0, frame.length, offset);
    libfs.closeSync(fd);
    for (let i = 0; i < accumulator3.length; i++) {
      let s = frame[i]/255;
      accumulator3[i] += s;
    }
  });
  for (let i = 0; i < accumulator3.length; i++) {
    accumulator3[i] /= (files.length);
  }
  let crop = {
    x1: 2,
    x2: (w - 2),
    y1: 2,
    y2: (h - 2),
    w: 0,
    h: 0
  };
  let threshold = 0.125;
  for (; crop.x1 < crop.x2; crop.x1++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      let s = accumulator3[(y * w) + crop.x1];
      sum += s;
    }
    sum /= h;
    if (sum >= threshold) {
      break;
    }
  }
  for (; crop.x1 < crop.x2; crop.x2--) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      let s = accumulator3[(y * w) + crop.x2 - 1];
      sum += s;
    }
    sum /= h;
    if (sum >= threshold) {
      break;
    }
  }
  for (; crop.y1 < crop.y2; crop.y1++) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      let s = accumulator3[(crop.y1 * w) + x];
      sum += s;
    }
    sum /= w;
    if (sum >= threshold) {
      break;
    }
  }
  for (; crop.y1 < crop.y2; crop.y2--) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      let s = accumulator3[((crop.y2 - 1) * w) + x];
      sum += s;
    }
    sum /= w;
    if (sum >= threshold) {
      break;
    }
  }
  crop.x1 += 4;
  crop.x2 -= 4;
  crop.y1 += 4;
  crop.y2 -= 4;
  crop.x1 = (((crop.x1 + SIZE*2 - 1) / (SIZE*2)) | 0) * (SIZE*2);
  crop.y1 = (((crop.y1 + SIZE*2 - 1) / (SIZE*2)) | 0) * (SIZE*2);
  crop.x2 = (((crop.x2) / (SIZE*2)) | 0) * (SIZE*2);
  crop.y2 = (((crop.y2) / (SIZE*2)) | 0) * (SIZE*2);
  crop.w = crop.x2 - crop.x1;
  crop.h = crop.y2 - crop.y1;
  let ar = (crop.w*finfo.parx/finfo.pary/crop.h);
  let candidates = [
    { w: 64, h: 27 },
    { w: 16, h: 9 },
    { w: 4, h: 3 }
  ];
  let deltas = candidates.map((candidate) => {
    return {
      ...candidate,
      delta: Math.abs(candidate.w/candidate.h - ar)
    };
  }).sort((a, b) => {
    if (a.delta < b.delta) return -1;
    if (a.delta > b.delta) return 1;
    return 0;
  });
  console.log({path, finfo, crop, ar, deltas});
  let nbx = ((crop.w / SIZE) | 0);
  let nby = ((crop.h / SIZE) | 0);
  let nbx_uv = nbx >> 1;
  let nby_uv = nby >> 1;
  let block = Buffer.alloc(SIZE * SIZE);
  let block2 = Buffer.alloc(SIZE * SIZE);
  let dct = new Array<number>(SIZE * SIZE);
  let dct2 = new Array<number>(SIZE * SIZE);
  let dct3 = new Array<number>(SIZE * SIZE);

  let collect_frequencies = (nby: number, nbx: number, frame: Buffer, x1: number, y1: number, w: number, h: number, accumulator: Array<number>, mse: number): number => {
    let weight = 1;
    let c = 0;
if (mse > 2) {
  //return 0;
}
    for (let by = 0; by < nby; by++) {
      for (let bx = 0; bx < nbx; bx++) {
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            let s = frame[((by*SIZE + y + y1) * w) + (bx*SIZE + x + x1)];
            block[(y * SIZE) + x] = s;
          }
        }
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            let k = x;
            let sum = 0;
            let f = k === 0 ? Math.sqrt(1/SIZE) : Math.sqrt(2/SIZE);
            for (let n = 0; n < SIZE; n++) {
              let s = block[(y * SIZE) + n]/255*2 - 1;
              sum += f*s*Math.cos(Math.PI*k/SIZE*(n + 0.5));
            }
            dct[(y * SIZE) + x] = sum / SIZE;
          }
        }
        for (let x = 0; x < SIZE; x++) {
          for (let y = 0; y < SIZE; y++) {
            let k = y;
            let sum = 0;
            let f = k === 0 ? Math.sqrt(1/SIZE) : Math.sqrt(2/SIZE);
            for (let n = 0; n < SIZE; n++) {
              let s = dct[(n * SIZE) + x];
              sum += f*s*Math.cos(Math.PI*k/SIZE*(n + 0.5));
            }
            dct2[(y * SIZE) + x] = sum / SIZE;
          }
        }
        for (let i = 0; i < accumulator.length; i++) {
          accumulator[i] += (dct2[i] > 0 ? dct2[i] : 0 - dct2[i])*weight;
        }
        c++;
      }
    }
    return c*weight;
  };
  let analyse = (accumulator: Array<number>, wf: { (xf: number, yf: number): number }): number => {
    let dc = accumulator[0];
    let ac = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (x !== 0 && y !== 0) {
          ac += accumulator[(y * SIZE) + x];
        }
      }
    }
    return ac;
  };
  let accumulator = new Array<number>(SIZE * SIZE);
  let accumulator_chroma_u = new Array<number>(SIZE * SIZE);
  let accumulator_chroma_v = new Array<number>(SIZE * SIZE);
  let accumulator2 = new Array<number>(SIZE * SIZE);
  let accumulator_chroma_u2 = new Array<number>(SIZE * SIZE);
  let accumulator_chroma_v2 = new Array<number>(SIZE * SIZE);
  for (let i = 0; i < accumulator.length; i++) {
    accumulator[i] = 0;
  }
  for (let i = 0; i < accumulator_chroma_u.length; i++) {
    accumulator_chroma_u[i] = 0;
  }
  for (let i = 0; i < accumulator_chroma_v.length; i++) {
    accumulator_chroma_v[i] = 0;
  }
  let ycount = 0;
  let ucount = 0;
  let vcount = 0;
  files.forEach((file, index) => {
    if ((index & 1) === 1) {
      return;
    }
    let offset = 0;
    let fd = libfs.openSync(file, 'r');
    offset += libfs.readSync(fd, frame, 0, frame.length, offset);
    offset += libfs.readSync(fd, chroma_u, 0, chroma_u.length, offset);
    offset += libfs.readSync(fd, chroma_v, 0, chroma_v.length, offset);
    libfs.closeSync(fd);
let mse = 0;
    ycount += collect_frequencies(nby, nbx, frame, crop.x1, crop.y1, w, h, accumulator, mse);
    ucount += collect_frequencies(nby_uv, nbx_uv, chroma_u, crop.x1 >> 1, crop.y1 >> 1, w >> 1, h >> 1, accumulator_chroma_u, mse);
    vcount += collect_frequencies(nby_uv, nbx_uv, chroma_v, crop.x1 >> 1, crop.y1 >> 1, w >> 1, h >> 1, accumulator_chroma_v, mse);
  });
  for (let i = 0; i < accumulator.length; i++) {
    accumulator[i] /= (ycount);
  }
  for (let i = 0; i < accumulator_chroma_u.length; i++) {
    accumulator_chroma_u[i] /= (ucount);
  }
  for (let i = 0; i < accumulator_chroma_v.length; i++) {
    accumulator_chroma_v[i] /= (vcount);
  }
  for (let i = 0; i < accumulator2.length; i++) {
    accumulator2[i] = 0;
  }
  for (let i = 0; i < accumulator_chroma_u2.length; i++) {
    accumulator_chroma_u2[i] = 0;
  }
  for (let i = 0; i < accumulator_chroma_v2.length; i++) {
    accumulator_chroma_v2[i] = 0;
  }
  ycount = 0;
  ucount = 0;
  vcount = 0;
  files.forEach((file, index) => {
    if ((index & 1) === 1) {
      return;
    }
    let offset = 0;
    let fd = libfs.openSync(file, 'r');
    offset += libfs.readSync(fd, frame, 0, frame.length, offset);
    offset += libfs.readSync(fd, chroma_u, 0, chroma_u.length, offset);
    offset += libfs.readSync(fd, chroma_v, 0, chroma_v.length, offset);
    libfs.closeSync(fd);
    let offset2 = 0;
    let fd2 = libfs.openSync(files[index+1], 'r');
    offset2 += libfs.readSync(fd2, frame2, 0, frame2.length, offset2);
    offset2 += libfs.readSync(fd2, chroma_u2, 0, chroma_u2.length, offset2);
    offset2 += libfs.readSync(fd2, chroma_v2, 0, chroma_v2.length, offset2);
    libfs.closeSync(fd2);
for (let i = 0; i < frame.length; i++) {
  let k = frame[i] - frame2[i];
  k = (k + 255) >> 1;
  frame2[i] = k;
}
for (let i = 0; i < chroma_u.length; i++) {
  let k = chroma_u[i] - chroma_u2[i];
  k = (k + 255) >> 1;
  chroma_u2[i] = k;
}
for (let i = 0; i < chroma_v.length; i++) {
  let k = chroma_v[i] - chroma_v2[i];
  k = (k + 255) >> 1;
  chroma_v2[i] = k;
}
let mse = 0;

    ycount += collect_frequencies(nby, nbx, frame2, crop.x1, crop.y1, w, h, accumulator2, mse);
    ucount += collect_frequencies(nby_uv, nbx_uv, chroma_u2, crop.x1 >> 1, crop.y1 >> 1, w >> 1, h >> 1, accumulator_chroma_u2, mse);
    vcount += collect_frequencies(nby_uv, nbx_uv, chroma_v2, crop.x1 >> 1, crop.y1 >> 1, w >> 1, h >> 1, accumulator_chroma_v2, mse);
  });
  for (let i = 0; i < accumulator2.length; i++) {
    accumulator2[i] /= (ycount);
  }
  for (let i = 0; i < accumulator_chroma_u2.length; i++) {
    accumulator_chroma_u2[i] /= (ucount);
  }
  for (let i = 0; i < accumulator_chroma_v2.length; i++) {
    accumulator_chroma_v2[i] /= (vcount);
  }

  let data = [];
    let wf = (xf, yf) => {
      let dist = Math.pow(xf + yf, 2);
      return dist;
    };
    let sy = analyse(accumulator, wf);
    let su = analyse(accumulator_chroma_u, wf);
    let sv = analyse(accumulator_chroma_v, wf);
    let ty = analyse(accumulator2, wf);
    let tu = analyse(accumulator_chroma_u2, wf);
    let tv = analyse(accumulator_chroma_v2, wf);
    cb({ y: ty, u: tu, v: tv });
};

let create_temp_dir = (cb: { (wd: string, id: string): void }): void => {
  let id = libcrypto.randomBytes(16).toString('hex');
  let wd = libpath.join('../temp/', id);
  libfs.mkdirSync(wd, { recursive: true });
  cb(wd, id);
};

let extract_frames = (path: string, id: string, cb: { (): void }): void => {
  let cp = libcp.spawn('ffmpeg', [
    '-i', path,
    '-f', 'segment',
    '-copyts',
    '-vsync', '0',
    '-vf', `select='between(mod(n\\,1500)\\,0\\,1)',hqdn3d=1:1:5:5`,
    '-an',
    '-segment_time', '0.01',
    `../temp/${id}/%08d.yuv`
  ]);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  process.stdin.pipe(cp.stdin);
  cp.on('exit', () => {
    cb();
  });
};

let process_file = (path: string, cb: { (n: any): void }): void => {
  create_temp_dir((wd, id) => {
    extract_frames(path, id, () => {
      format_detect(path, (frame) => {
        analyse_frames(wd, frame, (n) => {
          libdt.async(wd, () => {
            cb(n);
          });
        });
      });
    });
  });
};

if (process.argv[2]) {
  if (true /*mingw*/) {
    process.argv[2] = process.argv[2].split('/').join(libpath.sep);
  }
  process_file(process.argv[2], (n) => {
    console.log(n);
    process.exit(0);
  });
}

export default process_file;
