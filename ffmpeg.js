let libcp = require('child_process');
let libcrypto = require('crypto');
let libpath = require('path');
let libfs = require('fs');
let queue_metadata = require('../store/queue_metadata.json');
let quality_metadata = require('../store/quality_metadata.json');
let libdt = require('./delete_tree');
let config = require('../store/config.json');

let gcd = (a, b) => {
  if (!b) {
    return a;
  }
  return gcd(b, a % b);
};

let save_queue_metadata = (cb) => {
  let stats = queue_metadata;
  let sorted = [];
  for (let key of Object.keys(stats)) {
    sorted.push({
      key: key,
      value: stats[key]
    });
  }
  sorted = sorted.sort((a, b) => {
    if (a.key < b.key) {
      return -1;
    }
    if (a.key > b.key) {
      return 1;
    }
    return 0;
  });
  let out = {};
  sorted.forEach((entry) => {
    out[entry.key] = entry.value;
  });
  let fd = libfs.openSync('../store/queue_metadata.json', 'w');
  libfs.writeSync(fd, JSON.stringify(out, null, 2));
  libfs.closeSync(fd);
  cb();
};

let save_quality_metadata = (cb) => {
  let stats = quality_metadata;
  let sorted = [];
  for (let key of Object.keys(stats)) {
    sorted.push({
      key: key,
      value: stats[key]
    });
  }
  sorted = sorted.sort((a, b) => {
    if (a.key < b.key) {
      return -1;
    }
    if (a.key > b.key) {
      return 1;
    }
    return 0;
  });
  let out = {};
  sorted.forEach((entry) => {
    out[entry.key] = entry.value;
  });
  let fd = libfs.openSync('../store/quality_metadata.json', 'w');
  libfs.writeSync(fd, JSON.stringify(out, null, 2));
  libfs.closeSync(fd);
  cb();
};

let format_detect = (path, cb) => {
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
          fary: (stream.height / divisor),
          fpsx: parseInt(stream.r_frame_rate.split('/')[0]),
          fpsy: parseInt(stream.r_frame_rate.split('/')[1]),
          color_range: stream.color_range || null,
          color_space: stream.color_space || null,
          color_transfer: stream.color_transfer || null,
          color_primaries: stream.color_primaries || null,
          aspect_filter: ''
        };
        if (result.parx === 186 && result.pary === 157 && result.darx === 279 && result.dary === 157) {
          result.parx = 32;
          result.pary = 27;
          result.darx = 16;
          result.dary = 9;
          result.aspect_filter = `setsar=${result.parx}/${result.pary},setdar=${result.darx}/${result.dary},`;
        }
        cb(result);
        break;
      }
    }
  });
};

let interlace_detect = (path, cb) => {
  libcp.execFile('ffmpeg', [
      '-i', path,
      '-vf', `select='between(mod(n\\,15000)\\,0\\,1499)',idet`,
      '-vsync', '0',
      '-an',
      '-f', 'null',
      '-'
    ], (error, stdout, stderr) => {
    let re;
    let parts;
    let imode = 'unknown';
    re = /\[Parsed_idet_[0-9]+\s+@\s+[0-9a-fA-F]{16}\]\s+Multi\s+frame\s+detection:\s+TFF:\s*([0-9]+)\s+BFF:\s*([0-9]+)\s+Progressive:\s*([0-9]+)\s+Undetermined:\s*([0-9]+)/;
    parts = re.exec(stderr);
    if (parts !== null) {
      let tff = parseInt(parts[1]);
      let bff = parseInt(parts[2]);
      let prog = parseInt(parts[3]);
      let undet = parseInt(parts[4]);
      let sum = tff + bff + prog + undet;
      if (tff > bff && tff > sum*0.20) {
        imode = 'tff';
      } else if (bff > tff && bff > sum*0.20) {
        imode = 'bff';
      } else {
        imode = 'progressive';
      }
    }
    cb(imode);
  });
};

let crop_detect = (path, picture, cb) => {
  libcp.execFile('ffmpeg', [
      '-i', `${path}`,
      '-vf', 'framestep=250,crop=iw-4:ih-4,bbox=24',
      '-an',
      '-f', 'null',
      '-'
    ], (error, stdout, stderr) => {
    let re;
    let parts;
    let x1s = new Array(picture.dimx - 4).fill(0);
    let x2s = new Array(picture.dimx - 4).fill(0);
    let y1s = new Array(picture.dimy - 4).fill(0);
    let y2s = new Array(picture.dimy - 4).fill(0);
    re = /\[Parsed_bbox_[0-9]+\s+@\s+[0-9a-fA-F]{16}\]\s+n:[0-9]+\s+pts:[0-9]+\s+pts_time:[0-9]+(?:\.[0-9]+)?\s+x1:([0-9]+)\s+x2:([0-9]+)\s+y1:([0-9]+)\s+y2:([0-9]+)/g;
    let samples = 0;
    while ((parts = re.exec(stderr)) !== null) {
      samples++;
      let x1 = parseInt(parts[1]);
      let x2 = parseInt(parts[2]);
      let y1 = parseInt(parts[3]);
      let y2 = parseInt(parts[4]);
      x1s[x1]++;
      x2s[x2]++;
      y1s[y1]++;
      y2s[y2]++;
    }
    if (samples === 0) {
      throw new Error();
    }
    let crop = {
      x1: 0,
      x2: (picture.dimx - 4),
      y1: 0,
      y2: (picture.dimy - 4)
    };
    for (let i = 0, sum = 0; i < x1s.length && sum < 0.75*samples; i++) {
      crop.x1 = i;
      sum += x1s[i];
    }
    for (let i = x2s.length - 1, sum = 0; i >= 0 && sum < 0.75*samples; i--) {
      crop.x2 = i;
      sum += x2s[i];
    }
    for (let i = 0, sum = 0; i < y1s.length && sum < 0.75*samples; i++) {
      crop.y1 = i;
      sum += y1s[i];
    }
    for (let i = y2s.length - 1, sum = 0; i >= 0 && sum < 0.75*samples; i--) {
      crop.y2 = i;
      sum += y2s[i];
    }
    crop.x1 += 2;
    crop.x2 += 2;
    crop.y1 += 2;
    crop.y2 += 2;
    crop.x1 += 4;
    crop.x2 -= 4;
    crop.y1 += 4;
    crop.y2 -= 4;
    let w = (crop.x2 - crop.x1 + 1);
    let h = (crop.y2 - crop.y1 + 1);
    let ar = (w*picture.parx/picture.pary/h);
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
    let darx = deltas[0].w;
    let dary = deltas[0].h;
    let dimx = darx*picture.pary;
    let dimy = dary*picture.parx;
    let dim_gcd = gcd(dimx, dimy);
    let cx = dimx / dim_gcd;
    let cy = dimy / dim_gcd;
    let virtualw = picture.dimx*cx/picture.farx;
    let virtualh = picture.dimy*cy/picture.fary;
    let tx = ((virtualw - w) / cx);
    let ty = ((virtualh - h) / cy);
    let t = tx > ty ? tx : ty;
    t = Math.ceil(t * 0.5) << 1;
    let nw = (virtualw - t*cx);
    let nh = (virtualh - t*cy);
    let mx = crop.x1 + (w * 0.5) - (nw * 0.5);
    let my = crop.y1 + (h * 0.5) - (nh * 0.5);
    let final = {
      w: nw,
      h: nh,
      x: mx | 0,
      y: my | 0,
      darx,
      dary
    };
    cb(final);
  });
};

let create_temp_dir = (cb) => {
  let id = libcrypto.randomBytes(16).toString('hex');
  let wd = libpath.join('../temp/', id);
  libfs.mkdirSync(wd, { recursive: true });
  cb(wd, id);
};

let encode_hardware = (filename, outfile, picture, rect, imode, bm, cb, frameselection = '', extraopts = [], overrides = [], q = 1, opt_content = null) => {
  picture = {...picture};
  let is_dvd_pal = picture.dimx === 720 && picture.dimy === 576 && picture.fpsx === 25 && picture.fpsy === 1;
  let is_dvd_ntsc = picture.dimx === 720 && picture.dimy === 480 && picture.fpsx === 30000 && picture.fpsy === 1001;
	let is_fhd = picture.dimx === 1920 && picture.dimy === 1080;
  if (is_dvd_pal) {
    picture.color_space = 'bt470bg'; // kr = 0.299, kb = 0.114 [bt709 is 0.2126, 0.0722]
    picture.color_transfer = 'bt470bg'; // gamma 2.8 (often too dark) bt470m is 2.2
    picture.color_primaries = 'bt470bg'; // 0.29 0.60 0.15 0.06 0.64 0.33       0.3127 0.3290   almost identicla to bt709 (0.30...)
    picture.color_range = 'tv';
  } else if (is_dvd_ntsc) {
    picture.color_space = 'smpte170m'; // kr = 0.299, kb = 0.114
    picture.color_transfer = 'smpte170m'; // 4.5l (l < 0.018), 1.099l^0.45 - 0.099 (else) [identical to bt709]
    picture.color_primaries = 'smpte170m'; // 0.310 0.595 0.155 0.070 0.630 0.340      0.3127 0.3290
    picture.color_range = 'tv';
  } else {
	  picture.color_space = 'unknown';
	  picture.color_transfer = 'unknown';
	  picture.color_primaries = 'unknown';
    picture.color_range = 'tv';
	}
  let md = [];
	if (opt_content == null) {
	  let path = filename.split(libpath.sep);
	  let file = path.pop();
	  let name = file.split('.').slice(0, -1).join('.');
	  let parts;
	  parts = /^([a-z0-9_]+)-s([0-9]+)e([0-9]+)-([a-z0-9_]+)-/.exec(name);

	  if (parts !== null) {
	    let show = parts[1].split('_').join(' ');
	    let season_number = parseInt(parts[2]);
	    let episode_number = parseInt(parts[3]);
	    let episode_title = parts[4].split('_').join(' ');
	    md = [
	      '-metadata', `show=${show}`,
	      '-metadata', `season_number=${season_number}`,
	      '-metadata', `episode_sort=${episode_number}`,
	      '-metadata', `episode_id=${episode_title}`
	    ];
	  } else {
	    parts = /^([a-z0-9_]+)-([0-9]{4})-/.exec(name);
	    if (parts !== null) {
	      let title = parts[1].split('_').join(' ');
	      let year = parseInt(parts[2]);
	      md = [
	        '-metadata', `title=${title}`,
	        '-metadata', `date=${year}`
	      ];
	    }
	  }
	  let comment = config.comment;
	  md.push('-metadata', `comment=${comment}`);
	} else {
		if (opt_content.type === 'episode') {
	    md = [
	      '-metadata', `show=${opt_content.show}`,
	      '-metadata', `season_number=${opt_content.season}`,
	      '-metadata', `episode_sort=${opt_content.episode}`,
	      '-metadata', `episode_id=${opt_content.title}`
	    ];
		} else if (opt_content.type === 'movie') {
      md = [
        '-metadata', `title=${opt_content.title}`,
        '-metadata', `date=${opt_content.year}`
      ];
		}
	}
  let interlace = '';
  if (imode === 'tff') {
    interlace = 'yadif=0:0:0,';
  } else if (imode === 'bff') {
    interlace = 'yadif=0:1:0,';
  }
  let farx = rect.darx;
  let fary = rect.dary;
  let fh = is_fhd ? picture.dimx*fary/farx : 540;
  if (rect.darx === 64 && rect.dary === 27) {
    //farx = 16;
    //fary = 9;
  }
  let den = (((1 - q)/0.2)*5 + 0.5) | 0;
  den = bm/100.0;
  let hh = (fh >> 1);
  let wh = ((fh*farx/fary) >> 1);
  let w = (wh << 1);
  let h = (hh << 1);
  if (picture.color_transfer === 'bt470bg') {
    picture.color_transfer = 'smpte170m';
  }
  let cp = libcp.spawn('ffmpeg', [
    ...extraopts,
    '-color_range', picture.color_range,
    '-color_primaries', picture.color_primaries,
    '-color_trc', picture.color_transfer,
    '-colorspace', picture.color_space,
    '-i', filename,
    '-vf', `format=yuv420p16le,${interlace}crop=${rect.w}:${rect.h}:${rect.x}:${rect.y},hqdn3d=1:1:5:5,scale=${w}:${h}`,
    '-an',
    '-v', 'quiet',
    '-f', 'rawvideo',
    'pipe:'
  ]);
  let mbx = ((w + 16 - 1) / 16) | 0;
  let mby = ((h + 16 - 1) / 16) | 0;
  let ref = (32768 / mbx / mby) | 0;
  ref = (ref > 16) ? 16 : ref;
  let x264 = `me=umh:subme=10:ref=${ref}:me-range=24:chroma-me=1:bframes=8:crf=20:nr=0:psy=1:psy-rd=1.0,1.0:trellis=2:dct-decimate=0:qcomp=0.8:deadzone-intra=0:deadzone-inter=0:fast-pskip=1:aq-mode=1:aq-strength=1.0`;
  let cpx = libcp.spawn('filter', [`${wh}`, `${hh}`, `${den}`]);
  let cp2 = libcp.spawn('ffmpeg', [
    '-f', 'rawvideo',
    '-pix_fmt', 'yuv420p16le',
    '-s', `${w}:${h}`,
    '-r', `${picture.fpsx}/${picture.fpsy}`,
    '-color_range', picture.color_range,
    '-color_primaries', picture.color_primaries,
    '-color_trc', picture.color_transfer,
    '-colorspace', picture.color_space,
    '-i', 'pipe:',
    ...extraopts,
    '-i', filename,
    '-aspect', `${rect.darx}:${rect.dary}`,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-f', 'mp4',
    '-map_chapters', '-1',
    '-map_metadata', '-1',
    '-fflags', '+bitexact',
    '-movflags', '+faststart',
    '-vf', `gradfun=1:16`,
    '-c:v', 'libx264',
    '-preset', 'veryslow',
    '-x264-params', x264,
    '-ac', '2',
    '-c:a', 'aac',
    '-q:a', '2',
    '-color_range', picture.color_range,
    '-color_primaries', picture.color_primaries,
    '-color_trc', picture.color_transfer,
    '-colorspace', picture.color_space,
    ...md,
    ...overrides,
    outfile,
    '-y'
  ]);
  cp.stdout.pipe(cpx.stdin);
  cp.stderr.pipe(process.stderr);
  cpx.stderr.pipe(process.stderr);
  cpx.stdout.pipe(cp2.stdin);
  cp2.stdout.pipe(process.stdout);
  cp2.stderr.pipe(process.stderr);
  cp2.on('exit', (code) => {
    cb(code, outfile);
  });
};


let encode = (filename, outfile, picture, rect, imode, bm, cb, frameselection = '', extraopts = [], overrides = [], q = 1) => {
  picture = {...picture};

  let is_dvd_pal = picture.dimx === 720 && picture.dimy === 576 && picture.fpsx === 25 && picture.fpsy === 1;
  let is_dvd_ntsc = picture.dimx === 720 && picture.dimy === 480 && picture.fpsx === 30000 && picture.fpsy === 1001;
  if (is_dvd_pal) {
    picture.color_space = 'bt470bg'; // kr = 0.299, kb = 0.114 [bt709 is 0.2126, 0.0722]
    picture.color_transfer = 'bt470bg'; // gamma 2.8 (often too dark) bt470m is 2.2
    picture.color_primaries = 'bt470bg'; // 0.29 0.60 0.15 0.06 0.64 0.33 0.3127 0.3290
    picture.color_range = 'tv';
  } else if (is_dvd_ntsc) {
    picture.color_space = 'smpte170m'; // kr = 0.299, kb = 0.114
    picture.color_transfer = 'smpte170m'; // 4.5l (l < 0.018), 1.099l^0.45 - 0.099 (else) [identical to bt709]
    picture.color_primaries = 'smpte170m'; // 0.310 0.595 0.155 0.070 0.630 0.340 0.3127 0.3290
    picture.color_range = 'tv';
  } else {
	  picture.color_space = 'unknown';
	  picture.color_transfer = 'unknown';
	  picture.color_primaries = 'unknown';
    picture.color_range = 'tv';
	}
  let path = filename.split(libpath.sep);
  let file = path.pop();
  let name = file.split('.').slice(0, -1).join('.');
  let parts;
  parts = /^([a-z0-9_]+)-s([0-9]+)e([0-9]+)-([a-z0-9_]+)-/.exec(name);
  let md = [];
  if (parts !== null) {
    let show = parts[1].split('_').join(' ');
    let season_number = parseInt(parts[2]);
    let episode_number = parseInt(parts[3]);
    let episode_title = parts[4].split('_').join(' ');
    md = [
      '-metadata', `show=${show}`,
      '-metadata', `season_number=${season_number}`,
      '-metadata', `episode_sort=${episode_number}`,
      '-metadata', `episode_id=${episode_title}`
    ];
  } else {
    parts = /^([a-z0-9_]+)-([0-9]{4})-/.exec(name);
    if (parts !== null) {
      let title = parts[1].split('_').join(' ');
      let year = parseInt(parts[2]);
      md = [
        '-metadata', `title=${title}`,
        '-metadata', `date=${year}`
      ];
    }
  }
  let besth = (((rect.h)/108 + 0.5) | 0)*108;
  let fh = besth;
  let farx = rect.darx;
  let fary = rect.dary;
  fh = 540;
  if (!(rect.darx === 4 && rect.dary === 3)) {
    //farx = 16;
    //fary = 9;
  }
  let fw = fh*farx/fary;
  let interlace = '';
  if (imode === 'tff') {
    interlace = 'yadif=0:0:0,';
  } else if (imode === 'bff') {
    interlace = 'yadif=0:1:0,';
  } else {
    interlace = 'setfield=prog,';
  }
  if (picture.color_transfer === 'bt470bg') {
    picture.color_transfer = 'smpte170m';
  }
  let mbx = ((fw + 16 - 1) / 16) | 0;
  let mby = ((fh + 16 - 1) / 16) | 0;
  let ref = (32768 / mbx / mby) | 0;
  ref = (ref > 16) ? 16 : ref;
  ref = frameselection ? 16 : ref;
  let remfilter = frameselection ? '' : `bm3d=${bm}:4:8,`;
  let x264 = `me=umh:subme=10:ref=${ref}:me-range=24:chroma-me=1:bframes=8:crf=20:nr=0:psy=1:psy-rd=1.0,1.0:trellis=2:dct-decimate=0:qcomp=0.8:deadzone-intra=0:deadzone-inter=0:fast-pskip=1:aq-mode=1:aq-strength=1.0`;
  let filter = `format=yuv420p16le,${picture.aspect_filter}${interlace}${frameselection}crop=${rect.w}:${rect.h}:${rect.x}:${rect.y},hqdn3d=1:1:5:5,scale=${fw}:${fh},${remfilter}gradfun=1:16`;
  let comment = JSON.stringify({
    source: {
      w: picture.dimx,
      h: picture.dimy,
      sar: {
        n: picture.parx,
        d: picture.pary
      }
    },
    filters: filter.split(',')
  });
  let cp = libcp.spawn('ffmpeg', [
    ...extraopts,
    '-i', filename,
    '-f', 'h264',
    '-map_chapters', '-1',
    '-map_metadata', '-1',
    '-fflags', '+bitexact',
    '-movflags', '+faststart',
    '-color_range', picture.color_range,
    '-color_primaries', picture.color_primaries,
    '-color_trc', picture.color_transfer,
    '-colorspace', picture.color_space,
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', 'veryslow',
    '-x264-params', x264,
    '-ac', '2',
    '-c:a', 'aac',
    '-q:a', '2',
    ...md,
    '-metadata', `comment=${comment}`,
    ...overrides,
    outfile,
    '-y'
  ]);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  process.stdin.pipe(cp.stdin);
  cp.on('exit', (code) => {
    cb(code, outfile);
  });
};

let get_x264_quality = (filename, picture, rect, imode, cb) => {
  let fh = 540;
  let fw = fh*rect.darx/rect.dary;
  let deinterlace = '';
  if (imode === 'tff') {
    deinterlace = 'yadif=0:0:0,';
  } else if (imode === 'bff') {
    deinterlace = 'yadif=0:1:0,';
  }
  let mbx = ((fw + 16 - 1) / 16) | 0;
  let mby = ((fh + 16 - 1) / 16) | 0;
  let ref = (32768 / mbx / mby) | 0;
  ref = (ref > 16) ? 16 : ref;
  let x264 = `me=umh:subme=10:ref=${ref}:me-range=24:chroma-me=1:bframes=8:crf=20:nr=0:psy=1:psy-rd=1.0,1.0:trellis=2:dct-decimate=0:qcomp=0.8:deadzone-intra=0:deadzone-inter=0:fast-pskip=1:aq-mode=1:aq-strength=1.0`;
  let filter = `format=yuv420p16le,${deinterlace}select='between(mod(n\\,15000)\\,0\\,249)',crop=${rect.w}:${rect.h}:${rect.x}:${rect.y},hqdn3d=1:1:5:5,scale=${fw}:${fh},gradfun=1:16`;
  let cp = libcp.execFile('ffmpeg', [
    '-i', filename,
    '-f', 'null',
    '-vf', filter,
    '-vsync', '0',
    '-c:v', 'libx264',
    '-preset', 'veryslow',
    '-x264-params', x264,
    '-an',
    '-'
  ], (error, stdout, stderr) => {
    let re = /\[libx264\s+@\s+[0-9a-fA-F]{16}\]\s+coded\s+y,uvDC,uvAC\s+intra:\s+([0-9]+\.[0-9]+)%\s+([0-9]+\.[0-9]+)%\s+([0-9]+\.[0-9]+)%\s+inter:\s+([0-9]+\.[0-9]+)%\s+([0-9]+\.[0-9]+)%\s+([0-9]+\.[0-9]+)%/
    let parts = re.exec(stderr);
    let val = 0;
    if (parts !== null) {
      val = parseFloat(parts[4]);
    }
    cb(val);
  });
};

let determine_quality2 = (filename, cb) => {
  get_metadata(filename, (picture, rect, imode) => {
    get_x264_quality(filename, picture, rect, imode, cb)
  });
};

let determine_quality = (filename, cb) => {
  let id1 = libcrypto.randomBytes(16).toString('hex');
  let id2 = libcrypto.randomBytes(16).toString('hex');
  create_temp_dir((wd, id) => {
    get_metadata(filename, (picture, rect, imode) => {
      encode(filename, libpath.join(wd, id1), picture, rect, imode, 0, (code1, outfile1) => {
        encode(filename, libpath.join(wd, id2), picture, rect, imode, 0, (code2, outfile2) => {
          let s1 = libfs.statSync(outfile1).size;
          let s2 = libfs.statSync(outfile2).size;
          libdt.async(wd, () => {
            cb({ quality: s1/s2 });
          });
        }, `select='between(mod(n\\,250)\\,0\\,1)',`, [ '-vsync', '0' ], ['-an']);
      }, `select='between(mod(n\\,250)\\,0\\,0)',`, [ '-vsync', '0' ], ['-an']);
    });
  });
};

let determine_metadata = (filename, cb) => {
  format_detect(filename, (picture) => {
    crop_detect(filename, picture, (rect) => {
      interlace_detect(filename, (imode) => {
        cb({picture, rect, imode});
      });
    });
  });
};

let get_metadata = (filename, cb, basename = null) => {
	if (basename == null) {
		basename = filename;
	}
  let key = basename.split(libpath.sep).slice(2).join(':');
  let md = queue_metadata[key];
  if (md) {
    cb(md.picture, md.rect, md.imode);
  } else {
    determine_metadata(filename, (n) => {
      queue_metadata[key] = n;
      save_queue_metadata(() => {
        cb(n.picture, n.rect, n.imode);
      });
    });
  }
};

let get_qmetadata = (filename, cb, basename = null) => {
	if (basename == null) {
		basename = filename;
	}
  let key = basename.split(libpath.sep).slice(2).join(':');
  let md = quality_metadata[key];
  if (md) {
    cb(md.quality);
  } else {
    determine_quality(filename, (stats) => {
      quality_metadata[key] = stats;
      save_quality_metadata(() => {
        cb(stats.quality);
      });
    });
  }
};

let transcode = (filename, cb, opt_content_info = null, basename = null) => {
  let path = filename.split(libpath.sep);
  let file = path.pop();
  let name = file.split('.').slice(0, -1).join('.');
  let outfile = libpath.join(...path, `${name}.mp4`);
  get_metadata(filename, (picture, rect, imode) => {
    get_qmetadata(filename, (quality) => {
      let bm = (1 - quality)/0.05;
      let extraopts = []; // ['-ss', '10:00', '-t', '30'];
      encode_hardware(filename, outfile, picture, rect, imode, bm, cb, '', extraopts, [], quality, opt_content_info);
    }, basename);
  }, basename);
};

if (process.argv[2] && process.argv[3]) {
  if (true /*mingw*/) {
    process.argv[3] = process.argv[3].split('/').join(libpath.sep);
  }
  if (process.argv[2] === 'q') {
    determine_quality(process.argv[3], (n) => {
      console.log(n);
      process.exit(0);
    });
  } else if (process.argv[2] === 'e') {
    transcode(process.argv[3], (code, outfile) => {
      console.log(outfile);
      process.exit(code);
    });
  } else if (process.argv[2] === 'm') {
    determine_metadata(process.argv[3], (n) => {
      console.log(n);
      process.exit(0);
    });
  }
}

exports.determine_metadata = determine_metadata;
exports.determine_quality = determine_quality;
exports.transcode = transcode;
