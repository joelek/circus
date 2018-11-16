import * as libfs from 'fs';
import * as libcp from 'child_process';
import * as libpath from 'path';
import * as libcrypto from 'crypto';

type Image = {
  frame: Buffer,
  palette: Buffer,
  w: number,
  h: number,
  timestamp: Buffer
};

let read_file = (filename: string): Image => {
  let fd = libfs.openSync(filename, 'r');
  let size = libfs.statSync(filename).size;
  let offset = 0;
  let timestamp = Buffer.alloc(27);
  let properties = Buffer.alloc(14);
  let palette = Buffer.alloc(12);
  offset += libfs.readSync(fd, timestamp, 0, timestamp.length, offset);
  offset += libfs.readSync(fd, properties, 0, properties.length, offset);
  offset += libfs.readSync(fd, palette, 0, palette.length, offset);
  let w = properties.readUInt16LE(0);
  let h = properties.readUInt16LE(2);
  w = (((w + 1) >> 1) << 1);
  h = (((h + 1) >> 1) << 1);
  let x0 = properties.readUInt16LE(4);
  let y0 = properties.readUInt16LE(6);
  let x1 = properties.readUInt16LE(8);
  let y1 = properties.readUInt16LE(10);
  let l = properties.readUInt16LE(12);
  let remainder = Buffer.alloc(size - offset);
  offset += libfs.readSync(fd, remainder, 0, remainder.length, offset);
  libfs.closeSync(fd);
  let code_points = Buffer.alloc(remainder.length * 2);
  for (let i = 0; i < remainder.length; i++) {
    code_points[i * 2 + 0] = ((remainder[i] & 0xF0) >> 4);
    code_points[i * 2 + 1] = ((remainder[i] & 0x0F) >> 0);
  }
  let image = Buffer.alloc(w * h);
  let x = 0;
  let y = 0;
  let i = 0;
  while (i < code_points.length) {
    let c0 = code_points[i++];
    let l = 0;
    let p = 0;
    if (c0 >= 4) {
      l = ((c0 & 0x0C) >> 2);
      p = ((c0 & 0x03) >> 0);
    } else if (c0 >= 1) {
      let c1 = code_points[i++];
      l = (c0 << 2) | ((c1 & 0x0C) >> 2);
      p = ((c1 & 0x03) >> 0);
    } else {
      let c1 = code_points[i++];
      let c2 = code_points[i++];
      if (c1 >= 4) {
        l = (c1 << 2) | ((c2 & 0x0C) >> 2);
        p = ((c2 & 0x03) >> 0);
      } else if (c1 >= 1) {
        let c3 = code_points[i++];
        l = (c1 << 6) | (c2 << 2) | ((c3 & 0x0C) >> 2);
        p = ((c3 & 0x03) >> 0);
      } else {
        let c3 = code_points[i++];
        l = w - x;
        p = ((c3 & 0x03) >> 0);
      }
    }
    for (let i = (y * w) + x; i < (y * w) + x + l; i++) {
      image[i] = p;
    }
    x = x + l;
    if (x >= w) {
      x = 0;
      y = y + 1;
      i = (((i + 1) >> 1) << 1);
    }
  }
  let deinterlaced = Buffer.alloc(image.length);
  for (let y = 0; y < h; y++) {
    if ((y & 1) === 0) {
      let offset = (y >> 1) * w;
      image.copy(deinterlaced, y * w, offset, offset + w);
    } else {
      let offset = ((h >> 1) + (y >> 1)) * w;
      image.copy(deinterlaced, y * w, offset, offset + w);
    }
  }
  return {
    frame: deinterlaced,
    palette: palette,
    w: w,
    h: h,
    timestamp: timestamp
  };
};

let image_hist = (image: Image, palette: Buffer): Array<number> => {
  let palette_jump = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) {
    let r = palette[i*4+0];
    let g = palette[i*4+1];
    let b = palette[i*4+2];
    let o = palette[i*4+3];
    for (let j = 0; j <= i; j++) {
      let r2 = palette[j*4+0];
      let g2 = palette[j*4+1];
      let b2 = palette[j*4+2];
      let o2 = palette[j*4+3];
      if (r === r2 && g === g2 && b === b2 && o === o2) {
        palette_jump[i] = j;
        break;
      }
    }
  }
  let hist = new Array<number>(256);
  for (let i = 0; i < hist.length; i++) {
    hist[i] = 0;
  }
  for (let i = 0; i < image.frame.length; i++) {
     hist[palette_jump[image.frame[i]]]++;
  }
  return hist;
};

let write_file = (image: Image, directory: string): void => {
  let stride = (((image.w + 3) >> 2) << 2);
  let bmp_header = Buffer.alloc(14);
  bmp_header.set(Buffer.from('BM', 'binary'), 0);
  bmp_header.writeUInt32LE(14 + 40 + 256 * 4 + stride * image.h, 2);
  bmp_header.writeUInt16LE(0, 6);
  bmp_header.writeUInt16LE(0, 8);
  bmp_header.writeUInt32LE(14 + 40 + 256 * 4, 10);
  let dib_header = Buffer.alloc(40);
  dib_header.writeUInt32LE(40, 0);
  dib_header.writeUInt32LE(image.w, 4);
  dib_header.writeUInt32LE(image.h, 8);
  dib_header.writeUInt16LE(1, 12);
  dib_header.writeUInt16LE(8, 14);
  dib_header.writeUInt32LE(0, 16);
  dib_header.writeUInt32LE(stride * image.h, 20);
  dib_header.writeUInt32LE(2835, 24);
  dib_header.writeUInt32LE(2835, 28);
  dib_header.writeUInt32LE(0, 32);
  dib_header.writeUInt32LE(0, 36);
  let palette = Buffer.alloc(256 * 4);
  for (let i = 1; i < image.palette.length / 3; i++) {
    palette[i*4+0] = image.palette[i*3+2];
    palette[i*4+1] = image.palette[i*3+1];
    palette[i*4+2] = image.palette[i*3+0];
    palette[i*4+3] = 0xFF;
  }
  let hist = image_hist(image, palette);
  if (hist[0] === image.w*image.h) {
    return;
  }
  let filename = `${image.timestamp.toString('binary').split(':').join('_')}.bmp`;
  let fd = libfs.openSync(libpath.join(directory, filename), 'w');
  let offset = 0;
  offset += libfs.writeSync(fd, bmp_header, 0, bmp_header.length, offset);
  offset += libfs.writeSync(fd, dib_header, 0, dib_header.length, offset);
  offset += libfs.writeSync(fd, palette, 0, palette.length, offset);
  let row = Buffer.alloc(stride);
  for (let y = image.h - 1; y >= 0; y--) {
    let o = (y * image.w);
    image.frame.copy(row, 0, o, o + image.w);
    offset += libfs.writeSync(fd, row, 0, row.length, offset);
  }
  libfs.closeSync(fd);
};

let extract_xsub = (filename: string, subn: number, cb: { (code: number, jobid: string): void }): void => {
  let jobid = libcrypto.randomBytes(16).toString('hex');
  libfs.mkdirSync(libpath.join('../temp/', jobid, 'raw'), { recursive: true });
  libfs.mkdirSync(libpath.join('../temp/', jobid, 'bmp'), { recursive: true });
  let cp = libcp.spawn('ffmpeg', [
    '-i', filename,
    '-map', `0:s:${subn}`,
    '-vn',
    '-an',
    '-c:s', 'xsub',
    `../temp/${jobid}/raw/%d.raw`
  ]);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  process.stdin.pipe(cp.stdin);
  cp.on('exit', (code) => {
    cb(code, jobid);
  });
};

let convert_to_bmp = (jobid, cb: { (code: number): void }): void => {
  let node = libpath.join('../temp/', jobid, 'raw');
  libfs.readdirSync(node).map((subnode) => {
    let innode = libpath.join(node, subnode);
    let name = subnode.split('.').slice(0, -1).join('.');
    let outnode = libpath.join('../temp/', jobid, 'bmp');
    write_file(read_file(innode), outnode);
  });
  cb(0);
};

type Subtitle = { pts: string, text: string };

let ocr = (jobid: string, lang: string, cb: { (st: Subtitle[]): void }): void => {
  process.stdout.write(`Recognizing "${lang}" subtitles...\n`);
  let node = libpath.join('../temp/', jobid, 'bmp');
  let subtitles: Array<Subtitle> = [];
  try {
    libfs.readdirSync(node).map((subnode) => {
      let input = libpath.join(node, subnode);
      let text = libcp.execSync(`tesseract ${input} stdout --psm 6 --oem 1 -l ${lang}`).toString('utf8');
      text = text.split('|').join('I').split('~').join('-').split('«').join('-').split('{').join('(').split('}').join(')').split('»').join('-');
      let name = subnode.split('.').slice(0, -1).join('.');
      let pts = name.substr(1, name.length - 2).split('_').join(':').split('-').join(' --> ');
      process.stdout.write(pts + '\r\n');
      process.stdout.write(text);
      subtitles.push({ pts, text });
    });
  } catch (error) {}
  cb(subtitles);
};

let list_subs = (filename: string, cb: { (subs: string[]): void }): void => {
  libcp.exec(`ffprobe -v quiet -print_format json -show_streams ${filename}`, (error, stdout, stderr) => {
    let json = JSON.parse(stdout);
    let subs = json.streams.filter(stream => stream.codec_type === 'subtitle').filter(s => s.tags).map(s => s.tags.language);
    cb(subs);
  });
};

let delete_tree = (root: string): void => {
  let stats = libfs.statSync(root);
  if (stats.isDirectory()) {
    let nodes = libfs.readdirSync(root).map((node) => {
      return libpath.join(root, node);
    });
    nodes.forEach(delete_tree);
    libfs.rmdirSync(root);
  } else if (stats.isFile()) {
    libfs.unlinkSync(root);
  } else {
    throw new Error();
  }
};

let delete_tree_async = (root: string, cb: { (): void }): void => {
  libfs.stat(root, (error, stats) => {
    if (stats.isDirectory()) {
      libfs.readdir(root, (error, nodes) => {
        nodes = nodes.map((node) => {
          return libpath.join(root, node);
        });
        let pick_next = () => {
          if (nodes.length > 0) {
            let node = nodes.pop();
            delete_tree_async(node, () => {
              pick_next();
            });
          } else {
            libfs.rmdir(root, (error) => {
              cb();
            });
          }
        };
        pick_next();
      });
    } else if (stats.isFile()) {
      libfs.unlink(root, (error) => {
        cb();
      });
    } else {
      throw new Error();
    }
  });
};

let get_supported_languages = (cb: { (languages: Array<string>): void }): void => {
  let stdout = libcp.execSync(`tesseract --list-langs`).toString('utf8');
  let lines = stdout.split('\r\n').reduce((lines, line) => {
    lines.push(...line.split('\n'));
    return lines;
  }, []);
  lines = lines.slice(1, -1);
  cb(lines);
};

let extract = (filename: string, cb: { (outputs: string[]): void }): void => {
  get_supported_languages((supported_languages) => {
    list_subs(filename, (subs) => {
      let indices_to_extract: Array<number> = [];
      for (let supported_language of supported_languages) {
        let index = subs.indexOf(supported_language);
        if (index >= 0) {
          indices_to_extract.push(index);
        }
      }
      let outputs = [];
      let handle_next = () => {
        if (indices_to_extract.length === 0) {
          return cb(outputs);
        }
        let i = indices_to_extract.pop();
        let lang = subs[i];
        extract_xsub(filename, i, (code, jobid) => {
          convert_to_bmp(jobid, (code) => {
            ocr(jobid, lang, (subtitles) => {
              let webvtt = `WEBVTT { "language": "${lang}" }\r\n\r\n`;
              for (let i = 0; i < subtitles.length; i++) {
                if (subtitles[i].text) {
                  webvtt += subtitles[i].pts + '\r\n';
                  webvtt += subtitles[i].text;
                } else {
                  console.log(subtitles[i].pts + ': tesseract failed to produce text from bitmap!');
                  throw new Error();
                }
              }
              let directories = filename.split(libpath.sep);
              let file = directories.pop();
              let basename = file.split('.').slice(0, -1).join('.');
              let outfile = libpath.join(...directories, `${basename}.sub.${lang}.vtt`);
              let fd = libfs.openSync(outfile, 'w');
              libfs.writeSync(fd, webvtt);
              libfs.closeSync(fd);
              outputs.push(outfile);
              delete_tree_async(libpath.join('../temp/', jobid), () => {
                handle_next();
              });
            });
          });
        });
      };
      handle_next();
    });
  });
};

if (process.argv[2]) {
  extract(process.argv[2], (outputs) => {
    process.exit(0);
  });
}

export = extract;
