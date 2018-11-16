"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var libcp = require("child_process");
var libcrypto = require("crypto");
var libfs = require("fs");
var libpath = require("path");
var libdt = require("./delete_tree");
var SIZE = 8;
var gcd = function (a, b) {
    if (!b) {
        return a;
    }
    return gcd(b, a % b);
};
;
var format_detect = function (path, cb) {
    libcp.exec("ffprobe -v quiet -print_format json -show_streams " + path, function (error, stdout, stderr) {
        var json = JSON.parse(stdout);
        for (var i = 0; json.streams && i < json.streams.length; i++) {
            var stream = json.streams[i];
            if (stream.codec_type === 'video') {
                var divisor = gcd(stream.width, stream.height);
                var result = {
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
var analyse_frames = function (path, finfo, cb) {
    var w = finfo.dimx;
    var h = finfo.dimy;
    var files = libfs.readdirSync(path).map(function (file) {
        return libpath.join(path, file);
    });
    var frame = Buffer.alloc(w * h);
    var chroma_u = Buffer.alloc((w >> 1) * (h >> 1));
    var chroma_v = Buffer.alloc((w >> 1) * (h >> 1));
    var frame2 = Buffer.alloc(w * h);
    var chroma_u2 = Buffer.alloc((w >> 1) * (h >> 1));
    var chroma_v2 = Buffer.alloc((w >> 1) * (h >> 1));
    var accumulator3 = new Array(w * h);
    for (var i = 0; i < accumulator3.length; i++) {
        accumulator3[i] = 0;
    }
    files.forEach(function (file) {
        var offset = 0;
        var fd = libfs.openSync(file, 'r');
        offset += libfs.readSync(fd, frame, 0, frame.length, offset);
        libfs.closeSync(fd);
        for (var i = 0; i < accumulator3.length; i++) {
            var s = frame[i] / 255;
            accumulator3[i] += s;
        }
    });
    for (var i = 0; i < accumulator3.length; i++) {
        accumulator3[i] /= (files.length);
    }
    var crop = {
        x1: 2,
        x2: (w - 2),
        y1: 2,
        y2: (h - 2),
        w: 0,
        h: 0
    };
    var threshold = 0.125;
    for (; crop.x1 < crop.x2; crop.x1++) {
        var sum = 0;
        for (var y = 0; y < h; y++) {
            var s = accumulator3[(y * w) + crop.x1];
            sum += s;
        }
        sum /= h;
        if (sum >= threshold) {
            break;
        }
    }
    for (; crop.x1 < crop.x2; crop.x2--) {
        var sum = 0;
        for (var y = 0; y < h; y++) {
            var s = accumulator3[(y * w) + crop.x2 - 1];
            sum += s;
        }
        sum /= h;
        if (sum >= threshold) {
            break;
        }
    }
    for (; crop.y1 < crop.y2; crop.y1++) {
        var sum = 0;
        for (var x = 0; x < w; x++) {
            var s = accumulator3[(crop.y1 * w) + x];
            sum += s;
        }
        sum /= w;
        if (sum >= threshold) {
            break;
        }
    }
    for (; crop.y1 < crop.y2; crop.y2--) {
        var sum = 0;
        for (var x = 0; x < w; x++) {
            var s = accumulator3[((crop.y2 - 1) * w) + x];
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
    crop.x1 = (((crop.x1 + SIZE * 2 - 1) / (SIZE * 2)) | 0) * (SIZE * 2);
    crop.y1 = (((crop.y1 + SIZE * 2 - 1) / (SIZE * 2)) | 0) * (SIZE * 2);
    crop.x2 = (((crop.x2) / (SIZE * 2)) | 0) * (SIZE * 2);
    crop.y2 = (((crop.y2) / (SIZE * 2)) | 0) * (SIZE * 2);
    crop.w = crop.x2 - crop.x1;
    crop.h = crop.y2 - crop.y1;
    var ar = (crop.w * finfo.parx / finfo.pary / crop.h);
    var candidates = [
        { w: 64, h: 27 },
        { w: 16, h: 9 },
        { w: 4, h: 3 }
    ];
    var deltas = candidates.map(function (candidate) {
        return __assign({}, candidate, { delta: Math.abs(candidate.w / candidate.h - ar) });
    }).sort(function (a, b) {
        if (a.delta < b.delta)
            return -1;
        if (a.delta > b.delta)
            return 1;
        return 0;
    });
    console.log({ path: path, finfo: finfo, crop: crop, ar: ar, deltas: deltas });
    var nbx = ((crop.w / SIZE) | 0);
    var nby = ((crop.h / SIZE) | 0);
    var nbx_uv = nbx >> 1;
    var nby_uv = nby >> 1;
    var block = Buffer.alloc(SIZE * SIZE);
    var block2 = Buffer.alloc(SIZE * SIZE);
    var dct = new Array(SIZE * SIZE);
    var dct2 = new Array(SIZE * SIZE);
    var dct3 = new Array(SIZE * SIZE);
    var collect_frequencies = function (nby, nbx, frame, x1, y1, w, h, accumulator, mse) {
        var weight = 1;
        var c = 0;
        if (mse > 2) {
            //return 0;
        }
        for (var by = 0; by < nby; by++) {
            for (var bx = 0; bx < nbx; bx++) {
                for (var y = 0; y < SIZE; y++) {
                    for (var x = 0; x < SIZE; x++) {
                        var s = frame[((by * SIZE + y + y1) * w) + (bx * SIZE + x + x1)];
                        block[(y * SIZE) + x] = s;
                    }
                }
                for (var y = 0; y < SIZE; y++) {
                    for (var x = 0; x < SIZE; x++) {
                        var k = x;
                        var sum = 0;
                        var f = k === 0 ? Math.sqrt(1 / SIZE) : Math.sqrt(2 / SIZE);
                        for (var n = 0; n < SIZE; n++) {
                            var s = block[(y * SIZE) + n] / 255 * 2 - 1;
                            sum += f * s * Math.cos(Math.PI * k / SIZE * (n + 0.5));
                        }
                        dct[(y * SIZE) + x] = sum / SIZE;
                    }
                }
                for (var x = 0; x < SIZE; x++) {
                    for (var y = 0; y < SIZE; y++) {
                        var k = y;
                        var sum = 0;
                        var f = k === 0 ? Math.sqrt(1 / SIZE) : Math.sqrt(2 / SIZE);
                        for (var n = 0; n < SIZE; n++) {
                            var s = dct[(n * SIZE) + x];
                            sum += f * s * Math.cos(Math.PI * k / SIZE * (n + 0.5));
                        }
                        dct2[(y * SIZE) + x] = sum / SIZE;
                    }
                }
                for (var i = 0; i < accumulator.length; i++) {
                    accumulator[i] += (dct2[i] > 0 ? dct2[i] : 0 - dct2[i]) * weight;
                }
                c++;
            }
        }
        return c * weight;
    };
    var analyse = function (accumulator, wf) {
        var dc = accumulator[0];
        var ac = 0;
        for (var y = 0; y < SIZE; y++) {
            for (var x = 0; x < SIZE; x++) {
                if (x !== 0 && y !== 0) {
                    ac += accumulator[(y * SIZE) + x];
                }
            }
        }
        return ac;
    };
    var accumulator = new Array(SIZE * SIZE);
    var accumulator_chroma_u = new Array(SIZE * SIZE);
    var accumulator_chroma_v = new Array(SIZE * SIZE);
    var accumulator2 = new Array(SIZE * SIZE);
    var accumulator_chroma_u2 = new Array(SIZE * SIZE);
    var accumulator_chroma_v2 = new Array(SIZE * SIZE);
    for (var i = 0; i < accumulator.length; i++) {
        accumulator[i] = 0;
    }
    for (var i = 0; i < accumulator_chroma_u.length; i++) {
        accumulator_chroma_u[i] = 0;
    }
    for (var i = 0; i < accumulator_chroma_v.length; i++) {
        accumulator_chroma_v[i] = 0;
    }
    var ycount = 0;
    var ucount = 0;
    var vcount = 0;
    files.forEach(function (file, index) {
        if ((index & 1) === 1) {
            return;
        }
        var offset = 0;
        var fd = libfs.openSync(file, 'r');
        offset += libfs.readSync(fd, frame, 0, frame.length, offset);
        offset += libfs.readSync(fd, chroma_u, 0, chroma_u.length, offset);
        offset += libfs.readSync(fd, chroma_v, 0, chroma_v.length, offset);
        libfs.closeSync(fd);
        var mse = 0;
        ycount += collect_frequencies(nby, nbx, frame, crop.x1, crop.y1, w, h, accumulator, mse);
        ucount += collect_frequencies(nby_uv, nbx_uv, chroma_u, crop.x1 >> 1, crop.y1 >> 1, w >> 1, h >> 1, accumulator_chroma_u, mse);
        vcount += collect_frequencies(nby_uv, nbx_uv, chroma_v, crop.x1 >> 1, crop.y1 >> 1, w >> 1, h >> 1, accumulator_chroma_v, mse);
    });
    for (var i = 0; i < accumulator.length; i++) {
        accumulator[i] /= (ycount);
    }
    for (var i = 0; i < accumulator_chroma_u.length; i++) {
        accumulator_chroma_u[i] /= (ucount);
    }
    for (var i = 0; i < accumulator_chroma_v.length; i++) {
        accumulator_chroma_v[i] /= (vcount);
    }
    for (var i = 0; i < accumulator2.length; i++) {
        accumulator2[i] = 0;
    }
    for (var i = 0; i < accumulator_chroma_u2.length; i++) {
        accumulator_chroma_u2[i] = 0;
    }
    for (var i = 0; i < accumulator_chroma_v2.length; i++) {
        accumulator_chroma_v2[i] = 0;
    }
    ycount = 0;
    ucount = 0;
    vcount = 0;
    files.forEach(function (file, index) {
        if ((index & 1) === 1) {
            return;
        }
        var offset = 0;
        var fd = libfs.openSync(file, 'r');
        offset += libfs.readSync(fd, frame, 0, frame.length, offset);
        offset += libfs.readSync(fd, chroma_u, 0, chroma_u.length, offset);
        offset += libfs.readSync(fd, chroma_v, 0, chroma_v.length, offset);
        libfs.closeSync(fd);
        var offset2 = 0;
        var fd2 = libfs.openSync(files[index + 1], 'r');
        offset2 += libfs.readSync(fd2, frame2, 0, frame2.length, offset2);
        offset2 += libfs.readSync(fd2, chroma_u2, 0, chroma_u2.length, offset2);
        offset2 += libfs.readSync(fd2, chroma_v2, 0, chroma_v2.length, offset2);
        libfs.closeSync(fd2);
        for (var i = 0; i < frame.length; i++) {
            var k = frame[i] - frame2[i];
            k = (k + 255) >> 1;
            frame2[i] = k;
        }
        for (var i = 0; i < chroma_u.length; i++) {
            var k = chroma_u[i] - chroma_u2[i];
            k = (k + 255) >> 1;
            chroma_u2[i] = k;
        }
        for (var i = 0; i < chroma_v.length; i++) {
            var k = chroma_v[i] - chroma_v2[i];
            k = (k + 255) >> 1;
            chroma_v2[i] = k;
        }
        var mse = 0;
        ycount += collect_frequencies(nby, nbx, frame2, crop.x1, crop.y1, w, h, accumulator2, mse);
        ucount += collect_frequencies(nby_uv, nbx_uv, chroma_u2, crop.x1 >> 1, crop.y1 >> 1, w >> 1, h >> 1, accumulator_chroma_u2, mse);
        vcount += collect_frequencies(nby_uv, nbx_uv, chroma_v2, crop.x1 >> 1, crop.y1 >> 1, w >> 1, h >> 1, accumulator_chroma_v2, mse);
    });
    for (var i = 0; i < accumulator2.length; i++) {
        accumulator2[i] /= (ycount);
    }
    for (var i = 0; i < accumulator_chroma_u2.length; i++) {
        accumulator_chroma_u2[i] /= (ucount);
    }
    for (var i = 0; i < accumulator_chroma_v2.length; i++) {
        accumulator_chroma_v2[i] /= (vcount);
    }
    var data = [];
    var wf = function (xf, yf) {
        var dist = Math.pow(xf + yf, 2);
        return dist;
    };
    var sy = analyse(accumulator, wf);
    var su = analyse(accumulator_chroma_u, wf);
    var sv = analyse(accumulator_chroma_v, wf);
    var ty = analyse(accumulator2, wf);
    var tu = analyse(accumulator_chroma_u2, wf);
    var tv = analyse(accumulator_chroma_v2, wf);
    cb({ y: ty, u: tu, v: tv });
};
var create_temp_dir = function (cb) {
    var id = libcrypto.randomBytes(16).toString('hex');
    var wd = libpath.join('../temp/', id);
    libfs.mkdirSync(wd, { recursive: true });
    cb(wd, id);
};
var extract_frames = function (path, id, cb) {
    var cp = libcp.spawn('ffmpeg', [
        '-i', path,
        '-f', 'segment',
        '-copyts',
        '-vsync', '0',
        '-vf', "select='between(mod(n\\,1500)\\,0\\,1)',hqdn3d=1:1:5:5",
        '-an',
        '-segment_time', '0.01',
        "../temp/" + id + "/%08d.yuv"
    ]);
    cp.stdout.pipe(process.stdout);
    cp.stderr.pipe(process.stderr);
    process.stdin.pipe(cp.stdin);
    cp.on('exit', function () {
        cb();
    });
};
var process_file = function (path, cb) {
    create_temp_dir(function (wd, id) {
        extract_frames(path, id, function () {
            format_detect(path, function (frame) {
                analyse_frames(wd, frame, function (n) {
                    libdt.async(wd, function () {
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
    process_file(process.argv[2], function (n) {
        console.log(n);
        process.exit(0);
    });
}
exports["default"] = process_file;
