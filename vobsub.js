"use strict";
var libfs = require("fs");
var libcp = require("child_process");
var libpath = require("path");
var libcrypto = require("crypto");
var read_file = function (filename, tb) {
    var tf = 0;
    var bf = 0;
    var w = 0;
    var h = 0;
    var pts = parseInt(filename.split(libpath.sep).pop().split('.')[0], 10);
    var pts_start = pts;
    var pts_end = pts;
    var offset = 0;
    var fd = libfs.openSync(filename, 'r');
    var size = libfs.statSync(filename).size;
    var subtitle_packet = Buffer.alloc(size);
    offset += libfs.readSync(fd, subtitle_packet, 0, subtitle_packet.length, offset);
    libfs.closeSync(fd);
    offset = subtitle_packet.readUInt16BE(2);
    var last_command_sequence = false;
    var palette;
    var opacity;
    while (!last_command_sequence) {
        var timestamp = ((subtitle_packet.readUInt16BE(offset) << 10) / 90) | 0;
        var next_offset = subtitle_packet.readUInt16BE(offset + 2);
        last_command_sequence = (offset === next_offset);
        offset += 4;
        while (true) {
            var cmd = subtitle_packet.readUInt8(offset);
            offset += 1;
            if (false) {
            }
            else if (cmd === 0x00) {
            }
            else if (cmd === 0x01) {
                pts_start = pts + timestamp;
            }
            else if (cmd === 0x02) {
                pts_end = pts + timestamp;
            }
            else if (cmd === 0x03) {
                var values = subtitle_packet.slice(offset, offset + 2);
                offset += 2;
                var a = ((values[0] & 0xF0) >> 4);
                var b = ((values[0] & 0x0F) >> 0);
                var c = ((values[1] & 0xF0) >> 4);
                var d = ((values[1] & 0x0F) >> 0);
                palette = Buffer.alloc(4);
                palette[0] = d;
                palette[1] = c;
                palette[2] = b;
                palette[3] = a;
            }
            else if (cmd === 0x04) {
                var values = subtitle_packet.slice(offset, offset + 2);
                offset += 2;
                var a = ((values[0] & 0xF0) >> 4);
                var b = ((values[0] & 0x0F) >> 0);
                var c = ((values[1] & 0xF0) >> 4);
                var d = ((values[1] & 0x0F) >> 0);
                opacity = Buffer.alloc(4);
                opacity[0] = d * 255 / 15;
                opacity[1] = c * 255 / 15;
                opacity[2] = b * 255 / 15;
                opacity[3] = a * 255 / 15;
            }
            else if (cmd === 0x05) {
                var values = subtitle_packet.slice(offset, offset + 6);
                offset += 6;
                var x1 = (((values[0] & 0xFF) >> 0) << 4) | ((values[1] & 0xF0) >> 4);
                var x2 = (((values[1] & 0x0F) >> 0) << 8) | ((values[2] & 0xFF) >> 0);
                var y1 = (((values[3] & 0xFF) >> 0) << 4) | ((values[4] & 0xF0) >> 4);
                var y2 = (((values[4] & 0x0F) >> 0) << 8) | ((values[5] & 0xFF) >> 0);
                w = (x2 - x1 + 1);
                h = (y2 - y1 + 1);
            }
            else if (cmd === 0x06) {
                var values = subtitle_packet.slice(offset, offset + 4);
                offset += 4;
                tf = values.readUInt16BE(0);
                bf = values.readUInt16BE(2);
            }
            else if (cmd === 0xFF) {
                break;
            }
            else {
                throw new Error("Unhandled command in command sequence.");
            }
        }
        offset = next_offset;
    }
    var code_points = Buffer.alloc(subtitle_packet.length * 2);
    for (var i = 0; i < subtitle_packet.length; i++) {
        code_points[(i << 1) + 0] = ((subtitle_packet[i] & 0xF0) >> 4);
        code_points[(i << 1) + 1] = ((subtitle_packet[i] & 0x0F) >> 0);
    }
    var image = new Buffer(w * h);
    var decode = function (i, y, ymax) {
        var x = 0;
        while (y < ymax) {
            var c0 = code_points[i++];
            var l = 0;
            var p = 0;
            if (c0 >= 4) {
                l = ((c0 & 0x0C) >> 2);
                p = ((c0 & 0x03) >> 0);
            }
            else if (c0 >= 1) {
                var c1 = code_points[i++];
                l = (c0 << 2) | ((c1 & 0x0C) >> 2);
                p = ((c1 & 0x03) >> 0);
            }
            else {
                var c1 = code_points[i++];
                var c2 = code_points[i++];
                if (c1 >= 4) {
                    l = (c1 << 2) | ((c2 & 0x0C) >> 2);
                    p = ((c2 & 0x03) >> 0);
                }
                else if (c1 >= 1) {
                    var c3 = code_points[i++];
                    l = (c1 << 6) | (c2 << 2) | ((c3 & 0x0C) >> 2);
                    p = ((c3 & 0x03) >> 0);
                }
                else {
                    var c3 = code_points[i++];
                    l = w - x;
                    p = ((c3 & 0x03) >> 0);
                }
            }
            for (var i_1 = (y * w) + x; i_1 < (y * w) + x + l; i_1++) {
                image[i_1] = p;
            }
            x = x + l;
            if (x >= w) {
                x = 0;
                y = y + 1;
                i = (((i + 1) >> 1) << 1);
            }
        }
    };
    decode(tf << 1, 0, (h + 1) >> 1);
    decode(bf << 1, (h + 1) >> 1, h);
    var deinterlaced = Buffer.alloc(image.length);
    for (var y = 0; y < h; y++) {
        if ((y & 1) === 0) {
            var offset_1 = (y >> 1) * w;
            image.copy(deinterlaced, y * w, offset_1, offset_1 + w);
        }
        else {
            var offset_2 = (((h + 1) >> 1) + (y >> 1)) * w;
            image.copy(deinterlaced, y * w, offset_2, offset_2 + w);
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
    };
};
var palette_from_ed = function (ed) {
    var buffer = Buffer.alloc(16 * 4);
    ed.split('\n').forEach(function (line) {
        var parts;
        parts = /^palette: ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6})$/.exec(line);
        if (parts !== null) {
            for (var i = 0; i < 16; i++) {
                var rgb = parseInt(parts[i + 1], 16);
                buffer[i * 4 + 0] = ((rgb >> 16) & 0xFF);
                buffer[i * 4 + 1] = ((rgb >> 8) & 0xFF);
                buffer[i * 4 + 2] = ((rgb >> 0) & 0xFF);
                buffer[i * 4 + 3] = 0xFF;
            }
        }
        parts = /^custom colors: (ON|OFF), tridx: ([0-1]{4}), colors: ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6}), ([0-9a-f]{6})$/.exec(line);
        if (parts !== null) {
            console.log({ parts: parts });
            var onoff = parts[1];
            if (onoff === 'ON') {
                var tridx = parts[2];
                for (var i = 0; i < 4; i++) {
                    var rgb = parseInt(parts[i + 3], 16);
                    buffer[i * 4 + 0] = ((rgb >> 16) & 0xFF);
                    buffer[i * 4 + 1] = ((rgb >> 8) & 0xFF);
                    buffer[i * 4 + 2] = ((rgb >> 0) & 0xFF);
                    buffer[i * 4 + 3] = (tridx[i] === '0') ? 0xFF : 0x00;
                }
            }
        }
    });
    return buffer;
};
var image_hist = function (image, palette) {
    var palette_jump = Buffer.alloc(256);
    for (var i = 0; i < 256; i++) {
        var r = palette[i * 4 + 0];
        var g = palette[i * 4 + 1];
        var b = palette[i * 4 + 2];
        var o = palette[i * 4 + 3];
        for (var j = 0; j <= i; j++) {
            var r2 = palette[j * 4 + 0];
            var g2 = palette[j * 4 + 1];
            var b2 = palette[j * 4 + 2];
            var o2 = palette[j * 4 + 3];
            if (r === r2 && g === g2 && b === b2 && o === o2) {
                palette_jump[i] = j;
                break;
            }
        }
    }
    var hist = new Array(256);
    for (var i = 0; i < hist.length; i++) {
        hist[i] = 0;
    }
    for (var i = 0; i < image.frame.length; i++) {
        hist[palette_jump[image.frame[i]]]++;
    }
    return hist;
};
var write_file = function (image, directory, ed) {
    var palette = Buffer.alloc(256 * 4);
    var std_palette = palette_from_ed(ed);
    for (var i = 0; i < std_palette.length / 4; i++) {
        palette[i * 4 + 0] = std_palette[i * 4 + 0];
        palette[i * 4 + 1] = std_palette[i * 4 + 1];
        palette[i * 4 + 2] = std_palette[i * 4 + 2];
        palette[i * 4 + 3] = std_palette[i * 4 + 3];
    }
    if (image.palette) {
        for (var i = 0; i < image.palette.length; i++) {
            var k = image.palette[i];
            palette[i * 4 + 0] = std_palette[k * 4 + 0];
            palette[i * 4 + 1] = std_palette[k * 4 + 1];
            palette[i * 4 + 2] = std_palette[k * 4 + 2];
        }
    }
    if (image.opacity) {
        for (var i = 0; i < image.opacity.length; i++) {
            var k = image.opacity[i];
            palette[i * 4 + 3] = k;
        }
    }
    var y0 = 0;
    outer: for (; y0 < image.h; y0++) {
        inner: for (var x = 0; x < image.w; x++) {
            var k = image.frame[(y0 * image.w) + x];
            if (palette[k * 4 + 3] !== 0x00) {
                break outer;
            }
        }
    }
    var y1 = image.h - 1;
    outer: for (; y1 > y0; y1--) {
        inner: for (var x = 0; x < image.w; x++) {
            var k = image.frame[(y1 * image.w) + x];
            if (palette[k * 4 + 3] !== 0x00) {
                break outer;
            }
        }
    }
    var x0 = 0;
    outer: for (; x0 < image.w; x0++) {
        inner: for (var y = 0; y < image.h; y++) {
            var k = image.frame[(y * image.w) + x0];
            if (palette[k * 4 + 3] !== 0x00) {
                break outer;
            }
        }
    }
    var x1 = image.w - 1;
    outer: for (; x1 > x0; x1--) {
        inner: for (var y = 0; y < image.h; y++) {
            var k = image.frame[(y * image.w) + x1];
            if (palette[k * 4 + 3] !== 0x00) {
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
    var neww = x1 - x0 + 1;
    var newh = y1 - y0 + 1;
    if (!(neww > 0 && newh > 0)) {
        return;
    }
    var newi = Buffer.alloc(neww * newh);
    for (var y = 0; y < newh; y++) {
        for (var x = 0; x < neww; x++) {
            newi[((y) * neww) + x] = image.frame[(y + y0) * image.w + (x + x0)];
        }
    }
    image.frame = newi;
    image.w = neww;
    image.h = newh;
    for (var i = 0; i < palette.length / 4; i++) {
        var o = palette[i * 4 + 3];
        if (o !== 0xFF) {
            var r = palette[i * 4 + 0];
            var g = palette[i * 4 + 1];
            var b = palette[i * 4 + 2];
            palette[i * 4 + 0] = (r * o / 255) | 0;
            palette[i * 4 + 1] = (g * o / 255) | 0;
            palette[i * 4 + 2] = (b * o / 255) | 0;
            palette[i * 4 + 3] = 0xFF;
        }
    }
    for (var i = 0; i < palette.length / 4; i++) {
        var r = palette[i * 4 + 0];
        var g = palette[i * 4 + 1];
        var b = palette[i * 4 + 2];
        var y = (r * 0.3 + g * 0.6 + b * 0.1) | 0;
        //y = (Math.pow(y/255, 1.5)*255) | 0;
        y = 255 - y;
        palette[i * 4 + 0] = y;
        palette[i * 4 + 1] = y;
        palette[i * 4 + 2] = y;
    }
    var hist = image_hist(image, palette);
    if (hist[0] === image.w * image.h) {
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
    var ts0 = ("00000000" + image.pts_start).slice(-8);
    var ts1 = ("00000000" + image.pts_end).slice(-8);
    var filename = ts0 + "_" + ts1 + ".bmp";
    var stride = (((image.w + 3) >> 2) << 2);
    var bmp_header = Buffer.alloc(14);
    bmp_header.set(Buffer.from('BM', 'binary'), 0);
    bmp_header.writeUInt32LE(14 + 40 + 256 * 4 + stride * image.h, 2);
    bmp_header.writeUInt16LE(0, 6);
    bmp_header.writeUInt16LE(0, 8);
    bmp_header.writeUInt32LE(14 + 40 + 256 * 4, 10);
    var dib_header = Buffer.alloc(40);
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
    var fd = libfs.openSync(libpath.join(directory, filename), 'w');
    var offset = 0;
    offset += libfs.writeSync(fd, bmp_header, 0, bmp_header.length, offset);
    offset += libfs.writeSync(fd, dib_header, 0, dib_header.length, offset);
    offset += libfs.writeSync(fd, palette, 0, palette.length, offset);
    var row = Buffer.alloc(stride);
    for (var y = image.h - 1; y >= 0; y--) {
        var o = (y * image.w);
        image.frame.copy(row, 0, o, o + image.w);
        offset += libfs.writeSync(fd, row, 0, row.length, offset);
    }
    libfs.closeSync(fd);
};
var extract_vobsub = function (filename, subn, cb) {
    var jobid = libcrypto.randomBytes(16).toString('hex');
    libfs.mkdirSync(libpath.join('../temp/', jobid, 'raw'), { recursive: true });
    libfs.mkdirSync(libpath.join('../temp/', jobid, 'bmp'), { recursive: true });
    var cp = libcp.spawn('ffmpeg', [
        '-i', filename,
        '-map', "0:s:" + subn,
        '-vn',
        '-an',
        '-c:s', 'copy',
        '-frame_pts', '1',
        "../temp/" + jobid + "/raw/%08d.raw"
    ]);
    cp.stdout.pipe(process.stdout);
    cp.stderr.pipe(process.stderr);
    process.stdin.pipe(cp.stdin);
    cp.on('exit', function () {
        cb(jobid);
    });
};
var convert_to_bmp = function (jobid, ed, tb, cb) {
    var node = libpath.join('../temp/', jobid, 'raw');
    libfs.readdirSync(node).map(function (subnode) {
        var innode = libpath.join(node, subnode);
        var name = subnode.split('.').slice(0, -1).join('.');
        var outnode = libpath.join('../temp/', jobid, 'bmp');
        write_file(read_file(innode, tb), outnode, ed);
    });
    cb(0);
};
var ocr = function (jobid, lang, cb) {
    process.stdout.write("Recognizing \"" + lang + "\" subtitles...\n");
    var node = libpath.join('../temp/', jobid, 'bmp');
    var subtitles = [];
    try {
        libfs.readdirSync(node).map(function (subnode) {
            var input = libpath.join(node, subnode);
            var text = libcp.execSync("tesseract " + input + " stdout --psm 6 --oem 1 -l " + lang).toString('utf8');
            text = text.split('|').join('I').split('=').join('-').split('~').join('-').split('«').join('-').split('{').join('(').split('}').join(')').split('»').join('-').split('--').join('-');
            var lines = text.split('\r\n').reduce(function (lines, line) {
                lines.push.apply(lines, line.split('\n'));
                return lines;
            }, []).filter(function (line) { return line.length > 0; });
            var name = subnode.split('.').slice(0, -1).join('.');
            var pts_start = parseInt(name.split('_')[0], 10);
            var pts_end = parseInt(name.split('_')[1], 10);
            process.stdout.write(pts_start + ' to ' + pts_end + '\r\n' + text);
            subtitles.push({ pts_start: pts_start, pts_end: pts_end, text: text, lines: lines });
        });
    }
    catch (error) { }
    cb(subtitles);
};
var parse_extradata = function (ed) {
    var hex = ed.split('\n').map(function (line) { return line.substr(9, 42).split(' ').join(''); }).join('');
    var string = Buffer.from(hex, 'hex').toString('utf8');
    return string;
};
var parse_duration = function (dur) {
    var re = /^([0-9]{2})[:]([0-9]{2})[:]([0-9]{2})[.]([0-9]+)$/;
    var parts = re.exec(dur);
    if (parts == null) {
        return 0;
    }
    var h = parseInt(parts[1]);
    var m = parseInt(parts[2]);
    var s = parseInt(parts[3]);
    var ms = (parseFloat("0." + parts[4]) * 1000 + 0.5) | 0;
    return ms + 1000 * (s + 60 * (m + 60 * h));
};
var list_subs = function (filename, cb) {
    libcp.exec("ffprobe -v quiet -print_format json -show_streams -show_data " + filename, function (error, stdout, stderr) {
        var json = JSON.parse(stdout);
        var subs = json.streams.filter(function (stream) { return stream.codec_type === 'subtitle'; }).filter(function (s) { return s.tags; }).map(function (s) { return ({ lang: s.tags.language, extra: parse_extradata(s.extradata), tb: s.time_base, dur: parse_duration(s.tags['DURATION-eng']), frames: parseInt(s.tags['NUMBER_OF_FRAMES-eng']) }); });
        cb(subs);
    });
};
var delete_tree = function (root) {
    var stats = libfs.statSync(root);
    if (stats.isDirectory()) {
        var nodes = libfs.readdirSync(root).map(function (node) {
            return libpath.join(root, node);
        });
        nodes.forEach(delete_tree);
        libfs.rmdirSync(root);
    }
    else if (stats.isFile()) {
        libfs.unlinkSync(root);
    }
    else {
        throw new Error();
    }
};
var delete_tree_async = function (root, cb) {
    libfs.stat(root, function (error, stats) {
        if (stats.isDirectory()) {
            libfs.readdir(root, function (error, nodes) {
                nodes = nodes.map(function (node) {
                    return libpath.join(root, node);
                });
                var pick_next = function () {
                    if (nodes.length > 0) {
                        var node = nodes.pop();
                        delete_tree_async(node, function () {
                            pick_next();
                        });
                    }
                    else {
                        libfs.rmdir(root, function (error) {
                            cb();
                        });
                    }
                };
                pick_next();
            });
        }
        else if (stats.isFile()) {
            libfs.unlink(root, function (error) {
                cb();
            });
        }
        else {
            throw new Error();
        }
    });
};
var to_timecode = function (ms) {
    var s = (ms / 1000) | 0;
    ms -= s * 1000;
    var m = (s / 60) | 0;
    s -= m * 60;
    var h = (m / 60) | 0;
    m -= h * 60;
    var tch = ("00" + h).slice(-2);
    var tcm = ("00" + m).slice(-2);
    var tcs = ("00" + s).slice(-2);
    var tcms = ("000" + ms).slice(-3);
    return tch + ":" + tcm + ":" + tcs + "." + tcms;
};
var get_supported_languages = function (cb) {
    var stdout = libcp.execSync("tesseract --list-langs").toString('utf8');
    var lines = stdout.split('\r\n').reduce(function (lines, line) {
        lines.push.apply(lines, line.split('\n'));
        return lines;
    }, []);
    lines = lines.slice(1, -1);
    cb(lines);
};
var find = function (array, test) {
    for (var i = 0; i < array.length; i++) {
        if (test(array[i])) {
            return i;
        }
    }
    return -1;
};
var extract = function (filename, cb) {
    get_supported_languages(function (supported_languages) {
        list_subs(filename, function (subs) {
            var indices_to_extract = [];
            outer: for (var _i = 0, supported_languages_1 = supported_languages; _i < supported_languages_1.length; _i++) {
                var supported_language = supported_languages_1[_i];
                inner: for (var i = 0; i < subs.length; i++) {
                    var s = subs[i];
                    if (s.lang === supported_language && s.dur > 0 && s.frames / s.dur > 1 / (60 * 1000)) {
                        indices_to_extract.push(i);
                        break inner;
                    }
                }
            }
            var outputs = [];
            var handle_next = function () {
                if (indices_to_extract.length === 0) {
                    return cb(outputs);
                }
                var i = indices_to_extract.pop();
                var lang = subs[i].lang;
                var ed = subs[i].extra;
                var time_base = subs[i].tb;
                var duration = subs[i].dur;
                extract_vobsub(filename, i, function (jobid) {
                    convert_to_bmp(jobid, ed, time_base, function (code) {
                        ocr(jobid, lang, function (subtitles) {
                            subtitles = subtitles.sort(function (a, b) {
                                return a.pts_start - b.pts_start;
                            });
                            if (subtitles.length > 0) {
                                for (var i_2 = 0; i_2 < subtitles.length - 1; i_2++) {
                                    if (subtitles[i_2].pts_start === subtitles[i_2].pts_end) {
                                        subtitles[i_2].pts_end = subtitles[i_2 + 1].pts_start;
                                    }
                                }
                                if (subtitles[subtitles.length - 1].pts_start === subtitles[subtitles.length - 1].pts_end) {
                                    subtitles[subtitles.length - 1].pts_end = duration;
                                }
                            }
                            var webvtt = "WEBVTT { \"language\": \"" + lang + "\", \"count\": " + subtitles.length + " }\r\n\r\n";
                            for (var i_3 = 0; i_3 < subtitles.length; i_3++) {
                                webvtt += to_timecode(subtitles[i_3].pts_start) + ' --> ' + to_timecode(subtitles[i_3].pts_end) + '\r\n';
                                if (subtitles[i_3].lines.length > 0) {
                                    webvtt += subtitles[i_3].lines.join('\r\n') + '\r\n\r\n';
                                }
                                else {
                                    webvtt += '???\r\n\r\n';
                                }
                            }
                            var directories = filename.split(libpath.sep);
                            var file = directories.pop();
                            var basename = file.split('.').slice(0, -1).join('.');
                            var outfile = libpath.join.apply(libpath, directories.concat([basename + ".sub." + lang + ".vtt"]));
                            var fd = libfs.openSync(outfile, 'w');
                            libfs.writeSync(fd, webvtt);
                            libfs.closeSync(fd);
                            outputs.push(outfile);
                            delete_tree_async(libpath.join('../temp/', jobid), function () {
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
    extract(process.argv[2], function (outputs) {
        process.exit(0);
    });
}
module.exports = extract;
