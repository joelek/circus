"use strict";
exports.__esModule = true;
var libfs = require("fs");
var libpath = require("path");
function async(root, cb) {
    libfs.stat(root, function (error, stats) {
        if (stats.isDirectory()) {
            libfs.readdir(root, function (error, nodes) {
                nodes = nodes.map(function (node) {
                    return libpath.join(root, node);
                });
                var pick_next = function () {
                    if (nodes.length > 0) {
                        var node = nodes.pop();
                        async(node, function () {
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
}
exports.async = async;
;
function sync(root) {
    var stats = libfs.statSync(root);
    if (stats.isDirectory()) {
        var nodes = libfs.readdirSync(root).map(function (node) {
            return libpath.join(root, node);
        });
        nodes.forEach(sync);
        libfs.rmdirSync(root);
    }
    else if (stats.isFile()) {
        libfs.unlinkSync(root);
    }
    else {
        throw new Error();
    }
}
exports.sync = sync;
;
