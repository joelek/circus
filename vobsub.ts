import * as libfs from 'fs';
import * as libcp from 'child_process';
import * as libpath from 'path';
import * as libcrypto from 'crypto';
import * as pgssub from './pgssub';
import * as bmp from './bmp';

type Image = {
  frame: Buffer,
  palette: Buffer | null,
  opacity: Buffer | null,
  w: number,
  h: number,
  pts_start: number,
  pts_end: number
};

let read_file = (filename: string, tb: string): Image => {
  let tf: number = 0;
  let bf: number = 0;
  let w: number = 0;
  let h: number = 0;
  let pts = parseInt(filename.split(libpath.sep).pop().split('.')[0], 10);
  let pts_start = pts;
  let pts_end = pts;
  let offset = 0;
  let fd = libfs.openSync(filename, 'r');
  let size = libfs.statSync(filename).size;
  let subtitle_packet = Buffer.alloc(size);
  offset += libfs.readSync(fd, subtitle_packet, 0, subtitle_packet.length, offset);
  libfs.closeSync(fd);
  offset = subtitle_packet.readUInt16BE(2);
  let last_command_sequence = false;
  let palette: Buffer | null;
  let opacity: Buffer | null;
  while (!last_command_sequence) {
    let timestamp = ((subtitle_packet.readUInt16BE(offset) << 10) / 90) | 0;
    let next_offset = subtitle_packet.readUInt16BE(offset + 2);
    last_command_sequence = (offset === next_offset);
    offset += 4;
    while (true) {
      let cmd = subtitle_packet.readUInt8(offset);
      offset += 1;
      if (false) {
      } else if (cmd === 0x00) {
      } else if (cmd === 0x01) {
        pts_start = pts + timestamp;
      } else if (cmd === 0x02) {
        pts_end = pts + timestamp;
      } else if (cmd === 0x03) {
        let values = subtitle_packet.slice(offset, offset + 2);
        offset += 2;
        let a = ((values[0] & 0xF0) >> 4);
        let b = ((values[0] & 0x0F) >> 0);
        let c = ((values[1] & 0xF0) >> 4);
        let d = ((values[1] & 0x0F) >> 0);
        palette = Buffer.alloc(4);
        palette[0] = d;
        palette[1] = c;
        palette[2] = b;
        palette[3] = a;
      } else if (cmd === 0x04) {
        let values = subtitle_packet.slice(offset, offset + 2);
        offset += 2;
        let a = ((values[0] & 0xF0) >> 4);
        let b = ((values[0] & 0x0F) >> 0);
        let c = ((values[1] & 0xF0) >> 4);
        let d = ((values[1] & 0x0F) >> 0);
        opacity = Buffer.alloc(4);
        opacity[0] = d*255/15;
        opacity[1] = c*255/15;
        opacity[2] = b*255/15;
        opacity[3] = a*255/15;
      } else if (cmd === 0x05) {
        let values = subtitle_packet.slice(offset, offset + 6);
        offset += 6;
        let x1 = (((values[0] & 0xFF) >> 0) << 4) | ((values[1] & 0xF0) >> 4);
        let x2 = (((values[1] & 0x0F) >> 0) << 8) | ((values[2] & 0xFF) >> 0);
        let y1 = (((values[3] & 0xFF) >> 0) << 4) | ((values[4] & 0xF0) >> 4);
        let y2 = (((values[4] & 0x0F) >> 0) << 8) | ((values[5] & 0xFF) >> 0);
        w = (x2 - x1 + 1);
        h = (y2 - y1 + 1);
      } else if (cmd === 0x06) {
        let values = subtitle_packet.slice(offset, offset + 4);
        offset += 4;
        tf = values.readUInt16BE(0);
        bf = values.readUInt16BE(2);
      } else if (cmd === 0xFF) {
        break;
      } else {
        throw new Error(`Unhandled command in command sequence.`);
      }
    }
    offset = next_offset;
  }
  let code_points = Buffer.alloc(subtitle_packet.length * 2);
  for (let i = 0; i < subtitle_packet.length; i++) {
    code_points[(i << 1) + 0] = ((subtitle_packet[i] & 0xF0) >> 4);
    code_points[(i << 1) + 1] = ((subtitle_packet[i] & 0x0F) >> 0);
  }
  let image = new Buffer(w * h);
  let decode = (i: number, y: number, ymax: number): void => {
    let x = 0;
    while (y < ymax) {
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
  }
  decode(tf << 1, 0, (h + 1) >> 1);
  decode(bf << 1, (h + 1) >> 1, h);
  let deinterlaced = Buffer.alloc(image.length);
  for (let y = 0; y < h; y++) {
    if ((y & 1) === 0) {
      let offset = (y >> 1) * w;
      image.copy(deinterlaced, y * w, offset, offset + w);
    } else {
      let offset = (((h + 1) >> 1) + (y >> 1)) * w;
      image.copy(deinterlaced, y * w, offset, offset + w);
    }
  }
  return {
    frame: deinterlaced,
    palette: palette,
    opacity: opacity,
    w: w,
    h: h,
    pts_start: pts_start,
    pts_end: pts_end
  }
};

let palette_from_ed = (ed: string): Buffer => {
  let buffer = Buffer.alloc(16*4);
  ed.split('\n').forEach((line) => {
    let parts: Array<string> | null;
    parts = /^palette: ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6})$/.exec(line);
    if (parts !== null) {
      for (let i = 0; i < 16; i++) {
        let rgb = parseInt(parts[i+1], 16);
        buffer[i*4+0] = ((rgb >> 16) & 0xFF);
        buffer[i*4+1] = ((rgb >>  8) & 0xFF);
        buffer[i*4+2] = ((rgb >>  0) & 0xFF);
        buffer[i*4+3] = 0xFF;
      }
    }
    parts = /^custom colors: (ON|OFF), tridx: ([0-1]{4}), colors: ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6})$/.exec(line);
    if (parts !== null) {
      console.log({ parts });
      let onoff = parts[1];
      if (onoff === 'ON') {
        let tridx = parts[2];
        for (let i = 0; i < 4; i++) {
          let rgb = parseInt(parts[i+3], 16);
          buffer[i*4+0] = ((rgb >> 16) & 0xFF);
          buffer[i*4+1] = ((rgb >>  8) & 0xFF);
          buffer[i*4+2] = ((rgb >>  0) & 0xFF);
          buffer[i*4+3] = (tridx[i] === '0') ? 0xFF : 0x00;
        }
      }
    }
  });
  return buffer;
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

let write_file = (image: Image, directory: string, ed: string): void => {
  let palette = Buffer.alloc(256 * 4);
  let std_palette = palette_from_ed(ed);
  for (let i = 0; i < std_palette.length / 4; i++) {
    palette[i*4+0] = std_palette[i*4+0];
    palette[i*4+1] = std_palette[i*4+1];
    palette[i*4+2] = std_palette[i*4+2];
    palette[i*4+3] = std_palette[i*4+3];
  }
  if (image.palette) {
    for (let i = 0; i < image.palette.length; i++) {
      let k = image.palette[i];
      palette[i*4+0] = std_palette[k*4+0];
      palette[i*4+1] = std_palette[k*4+1];
      palette[i*4+2] = std_palette[k*4+2];
    }
  }
  if (image.opacity) {
    for (let i = 0; i < image.opacity.length; i++) {
      let k = image.opacity[i];
      palette[i*4+3] = k;
    }
  }
  let y0 = 0;
  outer: for (; y0 < image.h; y0++) {
    inner: for (let x = 0; x < image.w; x++) {
      let k = image.frame[(y0 * image.w) + x];
      if (palette[k*4+3] !== 0x00) {
        break outer;
      }
    }
  }
  let y1 = image.h - 1;
  outer: for (; y1 > y0; y1--) {
    inner: for (let x = 0; x < image.w; x++) {
      let k = image.frame[(y1 * image.w) + x];
      if (palette[k*4+3] !== 0x00) {
        break outer;
      }
    }
  }
  let x0 = 0;
  outer: for (; x0 < image.w; x0++) {
    inner: for (let y = 0; y < image.h; y++) {
      let k = image.frame[(y * image.w) + x0];
      if (palette[k*4+3] !== 0x00) {
        break outer;
      }
    }
  }
  let x1 = image.w - 1;
  outer: for (; x1 > x0; x1--) {
    inner: for (let y = 0; y < image.h; y++) {
      let k = image.frame[(y * image.w) + x1];
      if (palette[k*4+3] !== 0x00) {
        break outer;
      }
    }
  }
  x0 -= 4;
  y0 -= 4;
  x1 += 4;
  y1 += 4;
  x0 = (x0 > 0) ? x0 : 0;
  y0 = (y0 > 0) ? y0 : 0;
  x1 = (x1 < image.w) ? x1 : image.w - 1;
  y1 = (y1 < image.h) ? y1 : image.h - 1;
  let neww = x1 - x0 + 1;
  let newh = y1 - y0 + 1;
  if (!(neww > 0 && newh > 0)) {
    return;
  }
  let newi = Buffer.alloc(neww * newh);
  for (let y = 0; y < newh; y++) {
    for (let x = 0; x < neww; x++) {
      newi[((y)*neww)+x] = image.frame[(y+y0)*image.w + (x+x0)];
    }
  }
  image.frame = newi;
  image.w = neww;
  image.h = newh;
  for (let i = 0; i < palette.length / 4; i++) {
    let o = palette[i*4+3];
    if (o !== 0xFF) {
      let r = palette[i*4+0];
      let g = palette[i*4+1];
      let b = palette[i*4+2];
      palette[i*4+0] = (r*o/255) | 0;
      palette[i*4+1] = (g*o/255) | 0;
      palette[i*4+2] = (b*o/255) | 0;
      palette[i*4+3] = 0xFF;
    }
  }
  for (let i = 0; i < palette.length / 4; i++) {
    let r = palette[i*4+0];
    let g = palette[i*4+1];
    let b = palette[i*4+2];
    let y = (r * 0.3 + g * 0.6 + b * 0.1) | 0;
    //y = (Math.pow(y/255, 1.5)*255) | 0;
    y = 255 - y;
    palette[i*4+0] = y;
    palette[i*4+1] = y;
    palette[i*4+2] = y;
  }
  let hist = image_hist(image, palette);
  if (hist[0] === image.w*image.h) {
    return;
  }
/*
  for (let i = 0; i < palette.length / 4; i++) {
    let r = palette[i*4+0];
    let g = palette[i*4+1];
    let b = palette[i*4+2];
    if (r < 128 && g < 128 && b < 128) {
      palette[i*4+0] = 0;
      palette[i*4+1] = 0;
      palette[i*4+2] = 0;
    }
  }
*/
  let ts0 = `00000000${image.pts_start}`.slice(-8);
  let ts1 = `00000000${image.pts_end}`.slice(-8);
  let filename = `${ts0}_${ts1}.bmp`;
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

let extract_vobsub = (filename: string, subn: number, cb: { (jobid: string): void }): void => {
  let jobid = libcrypto.randomBytes(16).toString('hex');
  libfs.mkdirSync(libpath.join('../temp/', jobid, 'raw'), { recursive: true });
  libfs.mkdirSync(libpath.join('../temp/', jobid, 'bmp'), { recursive: true });
  let cp = libcp.spawn('ffmpeg', [
    '-i', filename,
    '-map', `0:s:${subn}`,
    '-vn',
    '-an',
    '-c:s', 'copy',
    '-frame_pts', '1',
    `../temp/${jobid}/raw/%08d.raw`
  ]);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  process.stdin.pipe(cp.stdin);
  cp.on('exit', () => {
    cb(jobid);
  });
};

let convert_to_bmp = (jobid: string, ed: string, tb: string, codec: string, cb: { (code: number): void }): void => {
  let node = libpath.join('../temp/', jobid, 'raw');
  libfs.readdirSync(node).map((subnode) => {
    let innode = libpath.join(node, subnode);
    let name = subnode.split('.').slice(0, -1).join('.');
	let outnode = libpath.join('../temp/', jobid, 'bmp');
	if (codec === 'hdmv_pgs_subtitle') {
		let buffer = libfs.readFileSync(innode);
		let bitmap = pgssub.parse_pgssub_as_bmp(buffer);
		let pts = parseInt(innode.split(libpath.sep).pop().split('.')[0], 10);
		let output_filename = `${('00000000' + pts).slice(-8)}_${('00000000' + pts).slice(-8)}.bmp`;
		let output_path = libpath.join(outnode, output_filename);
		let bmp_file = bmp.write_to(bitmap);
		let fd = libfs.openSync(output_path, 'w');
		libfs.writeSync(fd, bmp_file);
		libfs.closeSync(fd);
	} else {
		write_file(read_file(innode, tb), outnode, ed);
	}
  });
  cb(0);
};

type Subtitle = { pts_start: number, pts_end: number, text: string, lines: string[] };

let ocr = (jobid: string, lang: string, duration: number, postprocess: boolean, cb: { (st: Subtitle[]): void }): void => {
  process.stdout.write(`Recognizing "${lang}" subtitles... postprocessing:${postprocess}\n`);
  let node = libpath.join('../temp/', jobid, 'bmp');
  let subtitles: Array<Subtitle> = [];
  try {
    libfs.readdirSync(node).map((subnode) => {
		let input = libpath.join(node, subnode);
		let fd = libfs.openSync(input, 'r');
		let head = Buffer.alloc(8);
		libfs.readSync(fd, head, 0, 8, 18);
		libfs.closeSync(fd);
		let w = head.readUInt32LE(0);
		let h = head.readUInt32LE(4);
		let text = ''
		if (w > 0 && h > 0) {
			text = libcp.execSync(`tesseract ${input} stdout --psm 6 --oem 1 -l ${lang}`).toString('utf8');
			if (postprocess) {
				text = text.split('|').join('I').split('=').join('-').split('~').join('-').split('«').join('-').split('{').join('(').split('}').join(')').split('»').join('-').split('--').join('-');
			}
		}
		let lines = text.split('\r\n').reduce((lines, line) => {
			lines.push(...line.split('\n'));
			return lines;
		}, []).filter((line) => line.length > 0);
		let name = subnode.split('.').slice(0, -1).join('.');
		let pts_start = parseInt(name.split('_')[0], 10);
		let pts_end = parseInt(name.split('_')[1], 10);
		process.stdout.write(pts_start + ' to ' + pts_end + '\r\n' + text);
		subtitles.push({ pts_start, pts_end, text, lines });
    });
  } catch (error) {}
  subtitles = subtitles.sort((a, b) => {
	return a.pts_start - b.pts_start;
  });
  if (subtitles.length > 0) {
	for (let i = 0; i < subtitles.length - 1; i++) {
	  if (subtitles[i].pts_start === subtitles[i].pts_end) {
		subtitles[i].pts_end = subtitles[i+1].pts_start;
	  }
	}
	if (subtitles[subtitles.length - 1].pts_start === subtitles[subtitles.length - 1].pts_end) {
	  subtitles[subtitles.length - 1].pts_end = duration;
	}
  }
  subtitles = subtitles.filter(st => st.lines.length > 0);
  cb(subtitles);
};

let parse_extradata = (ed: string): string => {
  let hex = ed.split('\n').map(line => line.substr(9, 42).split(' ').join('')).join('');
  let string = Buffer.from(hex, 'hex').toString('utf8');
  return string;
};

let parse_duration = (dur: string): number => {
  let re = /^([0-9]{2})[:]([0-9]{2})[:]([0-9]{2})[.]([0-9]+)$/;
  let parts = re.exec(dur);
  if (parts == null) {
    return 0;
  }
  let h = parseInt(parts[1]);
  let m = parseInt(parts[2]);
  let s = parseInt(parts[3]);
  let ms = (parseFloat(`0.${parts[4]}`)*1000 + 0.5) | 0;
  return ms + 1000*(s + 60*(m + 60*h));
};

let list_subs = (filename: string, cb: { (subs: Array<{ codec: string, lang: string, extra: string, tb: string, dur: number, frames: number }>): void }): void => {
  libcp.exec(`ffprobe -v quiet -print_format json -show_streams -show_data ${filename}`, (error, stdout, stderr) => {
    let json = JSON.parse(stdout);
    let subs = json.streams.filter(stream => stream.codec_type === 'subtitle').filter(s => s.tags).map(s => ({ codec: s.codec_name, lang: s.tags.language, extra: parse_extradata(s.extradata), tb: s.time_base, dur: parse_duration(s.tags['DURATION-eng']), frames: parseInt(s.tags['NUMBER_OF_FRAMES-eng']) }));
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

let to_timecode = (ms: number): string => {
  let s = (ms / 1000) | 0;
  ms -= s * 1000;
  let m = (s / 60) | 0;
  s -= m * 60;
  let h = (m / 60) | 0;
  m -= h * 60;
  let tch = `00${h}`.slice(-2);
  let tcm = `00${m}`.slice(-2);
  let tcs = `00${s}`.slice(-2);
  let tcms = `000${ms}`.slice(-3);
  return `${tch}:${tcm}:${tcs}.${tcms}`;
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

let find = <T>(array: Array<T>, test: { (value: T): boolean }): number => {
  for (let i = 0; i < array.length; i++) {
    if (test(array[i])) {
      return i;
    }
  }
  return -1;
};

let extract = (filename: string, cb: { (outputs: string[]): void }): void => {
  get_supported_languages((supported_languages) => {
    list_subs(filename, (subs) => {
      let indices_to_extract: Array<number> = [];
      outer: for (let supported_language of supported_languages) {
        inner: for (let i = 0; i < subs.length; i++) {
          let s = subs[i];
          if (s.lang === supported_language && s.dur > 0 && s.frames/s.dur > 1/(60*1000)) {
            indices_to_extract.push(i);
            break inner;
          }
        }
      }
      let outputs = [];
      let handle_next = () => {
        if (indices_to_extract.length === 0) {
          return cb(outputs);
        }
        let i = indices_to_extract.pop();
        let lang = subs[i].lang;
        let ed = subs[i].extra;
        let time_base = subs[i].tb;
        let duration = subs[i].dur;
        extract_vobsub(filename, i, (jobid) => {
          convert_to_bmp(jobid, ed, time_base, subs[i].codec, (code) => {
            ocr(jobid, lang, duration, subs[i].codec === 'dvd_subtitle', (subtitles) => {
              let webvtt = `WEBVTT { "language": "${lang}", "count": ${subtitles.length} }\r\n\r\n`;
              for (let i = 0; i < subtitles.length; i++) {
                webvtt += to_timecode(subtitles[i].pts_start) + ' --> ' + to_timecode(subtitles[i].pts_end) + '\r\n';
                webvtt += subtitles[i].lines.join('\r\n') + '\r\n\r\n';
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
