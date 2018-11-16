"use strict";
var libfs = require("fs");
var libcp = require("child_process");
var libpath = require("path");
var libcrypto = require("crypto");
var read_file = function (filename) {
    var fd = libfs.openSync(filename, 'r');
    var size = libfs.statSync(filename).size;
    var offset = 0;
    var timestamp = Buffer.alloc(27);
    var properties = Buffer.alloc(14);
    var palette = Buffer.alloc(12);
    offset += libfs.readSync(fd, timestamp, 0, timestamp.length, offset);
    offset += libfs.readSync(fd, properties, 0, properties.length, offset);
    offset += libfs.readSync(fd, palette, 0, palette.length, offset);
    var w = properties.readUInt16LE(0);
    var h = properties.readUInt16LE(2);
    w = (((w + 1) >> 1) << 1);
    h = (((h + 1) >> 1) << 1);
    var x0 = properties.readUInt16LE(4);
    var y0 = properties.readUInt16LE(6);
    var x1 = properties.readUInt16LE(8);
    var y1 = properties.readUInt16LE(10);
    var l = properties.readUInt16LE(12);
    var remainder = Buffer.alloc(size - offset);
    offset += libfs.readSync(fd, remainder, 0, remainder.length, offset);
    libfs.closeSync(fd);
    var code_points = Buffer.alloc(remainder.length * 2);
    for (var i_1 = 0; i_1 < remainder.length; i_1++) {
        code_points[i_1 * 2 + 0] = ((remainder[i_1] & 0xF0) >> 4);
        code_points[i_1 * 2 + 1] = ((remainder[i_1] & 0x0F) >> 0);
    }
    var image = Buffer.alloc(w * h);
    var x = 0;
    var y = 0;
    var i = 0;
    while (i < code_points.length) {
        var c0 = code_points[i++];
        var l_1 = 0;
        var p = 0;
        if (c0 >= 4) {
            l_1 = ((c0 & 0x0C) >> 2);
            p = ((c0 & 0x03) >> 0);
        }
        else if (c0 >= 1) {
            var c1 = code_points[i++];
            l_1 = (c0 << 2) | ((c1 & 0x0C) >> 2);
            p = ((c1 & 0x03) >> 0);
        }
        else {
            var c1 = code_points[i++];
            var c2 = code_points[i++];
            if (c1 >= 4) {
                l_1 = (c1 << 2) | ((c2 & 0x0C) >> 2);
                p = ((c2 & 0x03) >> 0);
            }
            else if (c1 >= 1) {
                var c3 = code_points[i++];
                l_1 = (c1 << 6) | (c2 << 2) | ((c3 & 0x0C) >> 2);
                p = ((c3 & 0x03) >> 0);
            }
            else {
                var c3 = code_points[i++];
                l_1 = w - x;
                p = ((c3 & 0x03) >> 0);
            }
        }
        for (var i_2 = (y * w) + x; i_2 < (y * w) + x + l_1; i_2++) {
            image[i_2] = p;
        }
        x = x + l_1;
        if (x >= w) {
            x = 0;
            y = y + 1;
            i = (((i + 1) >> 1) << 1);
        }
    }
    var deinterlaced = Buffer.alloc(image.length);
    for (var y_1 = 0; y_1 < h; y_1++) {
        if ((y_1 & 1) === 0) {
            var offset_1 = (y_1 >> 1) * w;
            image.copy(deinterlaced, y_1 * w, offset_1, offset_1 + w);
        }
        else {
            var offset_2 = ((h >> 1) + (y_1 >> 1)) * w;
            image.copy(deinterlaced, y_1 * w, offset_2, offset_2 + w);
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
var write_file = function (image, directory) {
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
    var palette = Buffer.alloc(256 * 4);
    for (var i = 1; i < image.palette.length / 3; i++) {
        palette[i * 4 + 0] = image.palette[i * 3 + 2];
        palette[i * 4 + 1] = image.palette[i * 3 + 1];
        palette[i * 4 + 2] = image.palette[i * 3 + 0];
        palette[i * 4 + 3] = 0xFF;
    }
    var hist = image_hist(image, palette);
    if (hist[0] === image.w * image.h) {
        return;
    }
    var filename = image.timestamp.toString('binary').split(':').join('_') + ".bmp";
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
var extract_xsub = function (filename, subn, cb) {
    var jobid = libcrypto.randomBytes(16).toString('hex');
    libfs.mkdirSync(libpath.join('../temp/', jobid, 'raw'), { recursive: true });
    libfs.mkdirSync(libpath.join('../temp/', jobid, 'bmp'), { recursive: true });
    var cp = libcp.spawn('ffmpeg', [
        '-i', filename,
        '-map', "0:s:" + subn,
        '-vn',
        '-an',
        '-c:s', 'xsub',
        "../temp/" + jobid + "/raw/%d.raw"
    ]);
    cp.stdout.pipe(process.stdout);
    cp.stderr.pipe(process.stderr);
    process.stdin.pipe(cp.stdin);
    cp.on('exit', function (code) {
        cb(code, jobid);
    });
};
var convert_to_bmp = function (jobid, cb) {
    var node = libpath.join('../temp/', jobid, 'raw');
    libfs.readdirSync(node).map(function (subnode) {
        var innode = libpath.join(node, subnode);
        var name = subnode.split('.').slice(0, -1).join('.');
        var outnode = libpath.join('../temp/', jobid, 'bmp');
        write_file(read_file(innode), outnode);
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
            text = text.split('|').join('I').split('~').join('-').split('«').join('-').split('{').join('(').split('}').join(')').split('»').join('-');
            var name = subnode.split('.').slice(0, -1).join('.');
            var pts = name.substr(1, name.length - 2).split('_').join(':').split('-').join(' --> ');
            process.stdout.write(pts + '\r\n');
            process.stdout.write(text);
            subtitles.push({ pts: pts, text: text });
        });
    }
    catch (error) { }
    cb(subtitles);
};
var list_subs = function (filename, cb) {
    libcp.exec("ffprobe -v quiet -print_format json -show_streams " + filename, function (error, stdout, stderr) {
        var json = JSON.parse(stdout);
        var subs = json.streams.filter(function (stream) { return stream.codec_type === 'subtitle'; }).filter(function (s) { return s.tags; }).map(function (s) { return s.tags.language; });
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
var get_supported_languages = function (cb) {
    var stdout = libcp.execSync("tesseract --list-langs").toString('utf8');
    var lines = stdout.split('\r\n').reduce(function (lines, line) {
        lines.push.apply(lines, line.split('\n'));
        return lines;
    }, []);
    lines = lines.slice(1, -1);
    cb(lines);
};
var extract = function (filename, cb) {
    get_supported_languages(function (supported_languages) {
        list_subs(filename, function (subs) {
            var indices_to_extract = [];
            for (var _i = 0, supported_languages_1 = supported_languages; _i < supported_languages_1.length; _i++) {
                var supported_language = supported_languages_1[_i];
                var index = subs.indexOf(supported_language);
                if (index >= 0) {
                    indices_to_extract.push(index);
                }
            }
            var outputs = [];
            var handle_next = function () {
                if (indices_to_extract.length === 0) {
                    return cb(outputs);
                }
                var i = indices_to_extract.pop();
                var lang = subs[i];
                extract_xsub(filename, i, function (code, jobid) {
                    convert_to_bmp(jobid, function (code) {
                        ocr(jobid, lang, function (subtitles) {
                            var webvtt = "WEBVTT { \"language\": \"" + lang + "\" }\r\n\r\n";
                            for (var i_3 = 0; i_3 < subtitles.length; i_3++) {
                                if (subtitles[i_3].text) {
                                    webvtt += subtitles[i_3].pts + '\r\n';
                                    webvtt += subtitles[i_3].text;
                                }
                                else {
                                    console.log(subtitles[i_3].pts + ': tesseract failed to produce text from bitmap!');
                                    throw new Error();
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
