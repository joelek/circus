import * as libcp from 'child_process';
import * as libcrypto from 'crypto';
import * as libfs from 'fs';
import * as libpath from 'path';
import * as libstream from 'stream';

let queue_metadata = require('../store/queue_metadata.json');
let quality_metadata = require('../store/quality_metadata.json');

let dct = (target: Float32Array, source: Float32Array, offset: number, stride: number): void => {
  for (let k = 0; k < 16; k++) {
    let sum = 0;
    for (let n = 0; n < 16; n++) {
      let s = source[offset + (n * stride)];
      sum += s*Math.cos(Math.PI*k/16*(n + 0.5));
    }
    target[offset + (k * stride)] = sum;
  }
};

let dctx = (target: Float32Array, source: Float32Array): void => {
  for (let y = 0; y < 16; y++) {
    dct(target, source, y * 16, 1);
  }
};

let dcty = (target: Float32Array, source: Float32Array): void => {
  for (let x = 0; x < 16; x++) {
    dct(target, source, x, 16);
  }
};

let dctxy = (target: Float32Array, source: Float32Array): void => {
  dctx(target, source);
  dcty(source, target);
};

class AStream extends libstream.Transform {
  private buffer: Buffer;
  private offset: number;
  private frame: Float32Array;

  constructor() {
    super();
    this.buffer = Buffer.alloc(720 * 576 + 2 * (360 * 288));
    this.offset = 0;
    this.frame = new Float32Array(720 * 576);
  }

  _filter(): void {
    for (let i = 0; i < 720 * 576; i++) {
      this.frame[i] = (this.buffer[i]/255.0 - 0.5)*2.0;
    }
    let dcta = new Float32Array(16 * 16);
    let dctb = new Float32Array(16 * 16);
    for (let y = 0; y < 576 - 16; y += 8) {
      for (let x = 0; x < 720 - 16; x += 8) {
        for (let by = 0; by < 16; by++) {
          for (let bx = 0; bx < 16; bx++) {
            dcta[(by * 16) + bx] = this.frame[((y + by) * 720) + (x + bx)];
          }
        }
        dctxy(dctb, dcta);
        dctxy(dctb, dcta);
        for (let by = 0; by < 16; by++) {
          for (let bx = 0; bx < 16; bx++) {
            this.frame[((y + by) * 720) + (x + bx)] = dcta[(by * 16) + bx];
          }
        }
      }
    }
    for (let i = 0; i < 720 * 576; i++) {
      this.buffer[i] = (this.frame[i]*0.5 + 0.5)*255.0;
    }
  }

  _transform(chunk, encoding, cb): void {
    let consumed = 0;
    while (true) {
      let left_in_chunk = chunk.length - consumed;
      let missing_in_buffer = this.buffer.length - this.offset;
      if (left_in_chunk < missing_in_buffer) {
        this.buffer.set(chunk.slice(consumed), this.offset);
        consumed += left_in_chunk;
        this.offset += left_in_chunk;
        break;
      } else {
        this.buffer.set(chunk.slice(consumed, missing_in_buffer), this.offset);
        consumed += missing_in_buffer;
        this.offset = 0;
        this._filter();
        this.push(this.buffer);
      }
    }
    cb();
  }

  _flush(cb): void {
    cb();
  }
}


let handle = (filename: string, cb: { (): void }): void => {
  let md = queue_metadata[filename.split(libpath.sep).slice(2).join(':')];
  let qmd = quality_metadata[filename.split(libpath.sep).slice(2).join(':')];
  let rect = md.rect;
  let farx = rect.darx;
  let fary = rect.dary;
  let fh = 540;
  let den = (((1 - qmd.quality)/0.3)*10) | 0;

  let hh = (fh >> 1);
  let wh = ((fh*farx/fary) >> 1);
  let w = (wh << 1);
  let h = (hh << 1);

  let cp = libcp.spawn('ffmpeg', [
    '-ss', '0:6:40',
    '-t', '30',
    '-i', filename,
    '-f', 'rawvideo',
    '-vf', `format=yuv420p16le,crop=${rect.w}:${rect.h}:${rect.x}:${rect.y},scale=${w}:${h}`,
    '-an',
    'pipe:'
  ]);
  let x264 = 'crf=20:nr=0:psy=1:psy-rd=1.0,1.0:trellis=2:dct-decimate=0:qcomp=1.0:deadzone-intra=0:deadzone-inter=0:fast-pskip=1:aq-strength=1.0';
  let cpx = libcp.spawn('filter', [`${wh}`, `${hh}`, `${den}`]);
  cpx.stderr.pipe(process.stderr);
  cp.stdout.pipe(cpx.stdin);
  let cp2 = libcp.spawn('ffmpeg', [
    '-f', 'rawvideo',
    '-pix_fmt', 'yuv420p16le',
    '-s', `${w}:${h}`,
    '-i', 'pipe:',
    '-ss', '0:6:40',
    '-t', '30',
    '-i', filename,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-f', 'mp4',
    '-map_chapters', '-1',
    '-map_metadata', '-1',
    '-fflags', '+bitexact',
    '-movflags', '+faststart',
    '-vf', 'gradfun=2:16',
    '-c:v', 'libx264',
    '-preset', 'veryslow',
    '-x264-params', x264,
    '-ac', '2',
    '-c:a', 'aac',
    '-q:a', '2',
    'test.mp4',
    '-y'
  ]);
  cp2.stderr.pipe(process.stderr);
  cpx.stdout.pipe(cp2.stdin);
  cp2.on('exit', () => {
    cb();
  });
};

if (process.argv[2]) {
  if (true) {
    process.argv[2] = process.argv[2].split('/').join(libpath.sep);
  }
  handle(process.argv[2], () => {
    process.exit(0);
  });
}

export default handle;
