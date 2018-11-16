"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var libcp = require("child_process");
var libpath = require("path");
var libstream = require("stream");
var queue_metadata = require('../store/queue_metadata.json');
var quality_metadata = require('../store/quality_metadata.json');
var dct = function (target, source, offset, stride) {
    for (var k = 0; k < 16; k++) {
        var sum = 0;
        for (var n = 0; n < 16; n++) {
            var s = source[offset + (n * stride)];
            sum += s * Math.cos(Math.PI * k / 16 * (n + 0.5));
        }
        target[offset + (k * stride)] = sum;
    }
};
var dctx = function (target, source) {
    for (var y = 0; y < 16; y++) {
        dct(target, source, y * 16, 1);
    }
};
var dcty = function (target, source) {
    for (var x = 0; x < 16; x++) {
        dct(target, source, x, 16);
    }
};
var dctxy = function (target, source) {
    dctx(target, source);
    dcty(source, target);
};
var AStream = /** @class */ (function (_super) {
    __extends(AStream, _super);
    function AStream() {
        var _this = _super.call(this) || this;
        _this.buffer = Buffer.alloc(720 * 576 + 2 * (360 * 288));
        _this.offset = 0;
        _this.frame = new Float32Array(720 * 576);
        return _this;
    }
    AStream.prototype._filter = function () {
        for (var i = 0; i < 720 * 576; i++) {
            this.frame[i] = (this.buffer[i] / 255.0 - 0.5) * 2.0;
        }
        var dcta = new Float32Array(16 * 16);
        var dctb = new Float32Array(16 * 16);
        for (var y = 0; y < 576 - 16; y += 8) {
            for (var x = 0; x < 720 - 16; x += 8) {
                for (var by = 0; by < 16; by++) {
                    for (var bx = 0; bx < 16; bx++) {
                        dcta[(by * 16) + bx] = this.frame[((y + by) * 720) + (x + bx)];
                    }
                }
                dctxy(dctb, dcta);
                dctxy(dctb, dcta);
                for (var by = 0; by < 16; by++) {
                    for (var bx = 0; bx < 16; bx++) {
                        this.frame[((y + by) * 720) + (x + bx)] = dcta[(by * 16) + bx];
                    }
                }
            }
        }
        for (var i = 0; i < 720 * 576; i++) {
            this.buffer[i] = (this.frame[i] * 0.5 + 0.5) * 255.0;
        }
    };
    AStream.prototype._transform = function (chunk, encoding, cb) {
        var consumed = 0;
        while (true) {
            var left_in_chunk = chunk.length - consumed;
            var missing_in_buffer = this.buffer.length - this.offset;
            if (left_in_chunk < missing_in_buffer) {
                this.buffer.set(chunk.slice(consumed), this.offset);
                consumed += left_in_chunk;
                this.offset += left_in_chunk;
                break;
            }
            else {
                this.buffer.set(chunk.slice(consumed, missing_in_buffer), this.offset);
                consumed += missing_in_buffer;
                this.offset = 0;
                this._filter();
                this.push(this.buffer);
            }
        }
        cb();
    };
    AStream.prototype._flush = function (cb) {
        cb();
    };
    return AStream;
}(libstream.Transform));
var handle = function (filename, cb) {
    var md = queue_metadata[filename.split(libpath.sep).slice(2).join(':')];
    var qmd = quality_metadata[filename.split(libpath.sep).slice(2).join(':')];
    var rect = md.rect;
    var farx = rect.darx;
    var fary = rect.dary;
    var fh = 540;
    var den = (((1 - qmd.quality) / 0.3) * 10) | 0;
    var hh = (fh >> 1);
    var wh = ((fh * farx / fary) >> 1);
    var w = (wh << 1);
    var h = (hh << 1);
    var cp = libcp.spawn('ffmpeg', [
        '-ss', '0:6:40',
        '-t', '30',
        '-i', filename,
        '-f', 'rawvideo',
        '-vf', "format=yuv420p16le,crop=" + rect.w + ":" + rect.h + ":" + rect.x + ":" + rect.y + ",scale=" + w + ":" + h,
        '-an',
        'pipe:'
    ]);
    var x264 = 'crf=20:nr=0:psy=1:psy-rd=1.0,1.0:trellis=2:dct-decimate=0:qcomp=1.0:deadzone-intra=0:deadzone-inter=0:fast-pskip=1:aq-strength=1.0';
    var cpx = libcp.spawn('filter', ["" + wh, "" + hh, "" + den]);
    cpx.stderr.pipe(process.stderr);
    cp.stdout.pipe(cpx.stdin);
    var cp2 = libcp.spawn('ffmpeg', [
        '-f', 'rawvideo',
        '-pix_fmt', 'yuv420p16le',
        '-s', w + ":" + h,
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
    cp2.on('exit', function () {
        cb();
    });
};
if (process.argv[2]) {
    if (true) {
        process.argv[2] = process.argv[2].split('/').join(libpath.sep);
    }
    handle(process.argv[2], function () {
        process.exit(0);
    });
}
exports["default"] = handle;
