var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var define = (function () {
    var moduleStates = new Map();
    var req = function (name) {
        // @ts-ignore
        return require(name);
    };
    var get = function (name) {
        var moduleState = moduleStates.get(name);
        if (moduleState === undefined) {
            return null;
        }
        return moduleState;
    };
    var resolve = function (name) {
        var moduleState = get(name);
        if (moduleState === null || moduleState.module !== null) {
            return;
        }
        var exports = Array();
        var module = {
            exports: {}
        };
        for (var _i = 0, _a = moduleState.dependencies; _i < _a.length; _i++) {
            var dependency = _a[_i];
            if (dependency === "require") {
                exports.push(req);
                continue;
            }
            if (dependency === "module") {
                exports.push(module);
                continue;
            }
            if (dependency === "exports") {
                exports.push(module.exports);
                continue;
            }
            try {
                exports.push(req(dependency));
                continue;
            }
            catch (error) { }
            var moduleState_1 = get(dependency);
            if (moduleState_1 === null || moduleState_1.module === null) {
                return;
            }
            exports.push(moduleState_1.module.exports);
        }
        moduleState.callback.apply(moduleState, exports);
        moduleState.module = module;
        for (var _b = 0, _c = moduleState.dependencies; _b < _c.length; _b++) {
            var dependency = _c[_b];
            resolve(dependency);
        }
    };
    var define = function (name, dependencies, callback) {
        var moduleState = get(name);
        if (moduleState !== null) {
            throw new Error(Array.of("Duplicate module found with name \"", name, "\"!").join(""));
        }
        moduleState = {
            callback: callback,
            dependencies: dependencies,
            module: null
        };
        moduleStates.set(name, moduleState);
        resolve(name);
    };
    return define;
})();
define("database", ["require", "exports"], function (require, exports) {
    "use strict";
    exports.__esModule = true;
});
define("api_response", ["require", "exports"], function (require, exports) {
    "use strict";
    exports.__esModule = true;
    ;
    ;
});
define("client", ["require", "exports"], function (require, exports) {
    "use strict";
    exports.__esModule = true;
    var style = document.createElement('style');
    style.innerText = "\n\t* {\n\t\tborder: none;\n\t\tmargin: 0px;\n\t\toutline: none;\n\t\tpadding: 0px;\n\t}\n\n\thtml {\n\t\theight: 100%;\n\t}\n\n\tbody {\n\t\theight: 100%;\n\t}\n\n\tbody {\n\t\toverflow-y: scroll;\n\t}\n";
    document.head.appendChild(style);
    var format_duration = function (ms) {
        var s = (ms / 1000) | 0;
        var m = (s / 60) | 0;
        var h = (m / 60) | 0;
        if (h > 0) {
            var tm = ("00" + m % 60).slice(-2);
            var ts = ("00" + s % 60).slice(-2);
            return h + ":" + tm + ":" + ts;
        }
        else {
            var ts = ("00" + s % 60).slice(-2);
            return m + ":" + ts;
        }
    };
    var req = function (uri, body, cb) {
        var xhr = new XMLHttpRequest();
        xhr.addEventListener('readystatechange', function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                cb(xhr.status, JSON.parse(xhr.responseText));
            }
        });
        xhr.open('POST', uri, true);
        xhr.send(JSON.stringify(body));
    };
    var token = localStorage.getItem('token');
    var logincontainer = document.createElement('div');
    document.body.appendChild(logincontainer);
    req("/api/auth/?token=" + token, {}, function (status, response) {
        if (!(status >= 200 && status < 300)) {
            localStorage.removeItem('token');
            var container_1 = document.createElement("div");
            var username_1 = document.createElement('input');
            username_1.setAttribute('type', 'text');
            container_1.appendChild(username_1);
            var password_1 = document.createElement('input');
            password_1.setAttribute('type', 'password');
            container_1.appendChild(password_1);
            var cb_1 = function () {
                req("/api/auth/", { username: username_1.value, password: password_1.value }, function (status, response) {
                    if (status === 200) {
                        token = response.token;
                        localStorage.setItem('token', token);
                        logincontainer.removeChild(container_1);
                    }
                });
            };
            password_1.addEventListener('keyup', function (event) {
                if (event.keyCode === 13) {
                    cb_1();
                }
            });
            var login = document.createElement('button');
            login.textContent = 'Login';
            login.addEventListener('click', function (event) {
                cb_1();
            });
            container_1.appendChild(login);
            logincontainer.appendChild(container_1);
        }
    });
    var video = document.createElement('video');
    video.setAttribute('controls', '');
    video.setAttribute('playsinline', '');
    video.style.setProperty('width', '100%');
    document.body.appendChild(video);
    var context = null;
    var metadata = null;
    var context_index = null;
    var play = function (index) {
        if (context === null) {
            return;
        }
        var fid = context.files[index];
        video.src = "/files/" + fid + "/?token=" + token;
        while (video.lastChild !== null) {
            video.removeChild(video.lastChild);
        }
        if (metadata !== null) {
            var md = metadata[fid];
            if (md !== undefined) {
                for (var i = 0; i < md.subtitles.length; i++) {
                    var st = md.subtitles[i];
                    var e = document.createElement('track');
                    e.src = "/files/" + st.file_id + "/?token=" + token;
                    video.appendChild(e);
                }
            }
        }
        video.play();
        context_index = index;
    };
    var seek = function (offset_ms) {
        video.currentTime = (offset_ms / 1000);
    };
    var next = function () {
        if (context !== null && context_index !== null && context_index >= 0 && context_index < context.files.length - 1) {
            play(context_index + 1);
        }
    };
    video.addEventListener('ended', next);
    var set_context = function (ctx) {
        context = ctx;
    };
    var set_context_metadata = function (md) {
        metadata = md;
    };
    var ccload = document.createElement('button');
    ccload.textContent = 'cast';
    ccload.addEventListener('click', function () {
        video.pause();
        req("/api/cc/load/", { context: context, index: context_index, token: token }, function (status, response) { });
    });
    document.body.appendChild(ccload);
    var ccpause = document.createElement('button');
    ccpause.textContent = 'pause';
    ccpause.addEventListener('click', function () {
        req("/api/cc/pause/", { token: token }, function (status, response) { });
    });
    document.body.appendChild(ccpause);
    var ccresume = document.createElement('button');
    ccresume.textContent = 'resume';
    ccresume.addEventListener('click', function () {
        req("/api/cc/resume/", { token: token }, function (status, response) { });
    });
    document.body.appendChild(ccresume);
    var ccseek = document.createElement('input');
    ccseek.setAttribute('type', 'range');
    ccseek.addEventListener('change', function () {
        req("/api/cc/seek/", { percentage: ccseek.value, token: token }, function (status, response) { });
    });
    document.body.appendChild(ccseek);
    var mount = document.createElement('div');
    document.body.appendChild(mount);
    var updateviewforuri = function (uri) {
        while (mount.lastChild !== null) {
            mount.removeChild(mount.lastChild);
        }
        var parts;
        if ((parts = /^audio[/]albums[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
            req("/api/audio/albums/" + parts[1] + "/", {}, function (status, response) {
                var e_1, _a, e_2, _b;
                var a = document.createElement('div');
                a.style.setProperty('font-size', '24px');
                a.innerText = "" + response.title;
                mount.appendChild(a);
                var wrap = document.createElement('div');
                var img = document.createElement('img');
                img.src = "/files/" + response.cover_file_id + "/?token=" + token;
                img.style.setProperty('width', '100%');
                wrap.appendChild(img);
                mount.appendChild(wrap);
                var context = {
                    files: response.discs.reduce(function (tracks, disc) {
                        tracks.push.apply(tracks, __spread(disc.tracks.map(function (track) { return track.file_id; })));
                        return tracks;
                    }, new Array())
                };
                try {
                    for (var _c = __values(response.discs), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var disc = _d.value;
                        var d = document.createElement('div');
                        d.innerText = "" + disc.number;
                        mount.appendChild(d);
                        var _loop_1 = function (track) {
                            var x = document.createElement('div');
                            x.innerText = track.title + " " + format_duration(track.duration);
                            x.addEventListener('click', function () {
                                set_context(context);
                                play(context.files.indexOf(track.file_id));
                            });
                            mount.appendChild(x);
                        };
                        try {
                            for (var _e = (e_2 = void 0, __values(disc.tracks)), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var track = _f.value;
                                _loop_1(track);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_b = _e["return"])) _b.call(_e);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c["return"])) _a.call(_c);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            });
        }
        else if ((parts = /^audio[/]albums[/]/.exec(uri)) !== null) {
            req("/api/audio/albums/", {}, function (status, response) {
                var e_3, _a;
                var _loop_2 = function (album) {
                    var d = document.createElement('div');
                    d.innerText = "" + album.title;
                    d.addEventListener('click', function () {
                        navigate("audio/albums/" + album.album_id + "/");
                    });
                    mount.appendChild(d);
                };
                try {
                    for (var _b = __values(response.albums), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var album = _c.value;
                        _loop_2(album);
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            });
        }
        else if ((parts = /^audio[/]artists[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
            req("/api/audio/artists/" + parts[1] + "/", {}, function (status, response) {
                var e_4, _a;
                var a = document.createElement('div');
                a.style.setProperty('font-size', '24px');
                a.innerText = "" + response.title;
                mount.appendChild(a);
                var _loop_3 = function (album) {
                    var d = document.createElement('div');
                    d.innerText = "" + album.title;
                    d.addEventListener('click', function () {
                        navigate("audio/albums/" + album.album_id + "/");
                    });
                    mount.appendChild(d);
                };
                try {
                    for (var _b = __values(response.albums), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var album = _c.value;
                        _loop_3(album);
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            });
        }
        else if ((parts = /^audio[/]artists[/]/.exec(uri)) !== null) {
            req("/api/audio/artists/", {}, function (status, response) {
                var e_5, _a;
                var _loop_4 = function (artist) {
                    var d = document.createElement('div');
                    d.innerText = "" + artist.title;
                    d.addEventListener('click', function () {
                        navigate("audio/artists/" + artist.artist_id + "/");
                    });
                    mount.appendChild(d);
                };
                try {
                    for (var _b = __values(response.artists), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var artist = _c.value;
                        _loop_4(artist);
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
            });
        }
        else if ((parts = /^audio[/]lists[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
            req("/api/audio/lists/" + parts[1] + "/", {}, function (status, response) {
                var e_6, _a;
                var a = document.createElement('div');
                a.style.setProperty('font-size', '24px');
                a.innerText = "" + response.title;
                mount.appendChild(a);
                var context = {
                    files: response.items.map(function (item) {
                        return item.track.file_id;
                    })
                };
                var _loop_5 = function (item) {
                    var d = document.createElement('div');
                    d.innerText = "" + item.track.title;
                    d.addEventListener('click', function () {
                        set_context(context);
                        play(context.files.indexOf(item.track.file_id));
                    });
                    mount.appendChild(d);
                };
                try {
                    for (var _b = __values(response.items), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var item = _c.value;
                        _loop_5(item);
                    }
                }
                catch (e_6_1) { e_6 = { error: e_6_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
                    }
                    finally { if (e_6) throw e_6.error; }
                }
            });
        }
        else if ((parts = /^audio[/]lists[/]/.exec(uri)) !== null) {
            req("/api/audio/lists/", {}, function (status, response) {
                var e_7, _a;
                var _loop_6 = function (list) {
                    var d = document.createElement('div');
                    d.innerText = "" + list.title;
                    d.addEventListener('click', function () {
                        navigate("audio/lists/" + list.audiolist_id + "/");
                    });
                    mount.appendChild(d);
                };
                try {
                    for (var _b = __values(response.audiolists), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var list = _c.value;
                        _loop_6(list);
                    }
                }
                catch (e_7_1) { e_7 = { error: e_7_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
                    }
                    finally { if (e_7) throw e_7.error; }
                }
            });
        }
        else if ((parts = /^audio[/]/.exec(uri)) !== null) {
            var d = document.createElement('div');
            d.innerText = 'Artists';
            d.addEventListener('click', function () {
                navigate('audio/artists/');
            });
            mount.appendChild(d);
            var d2 = document.createElement('div');
            d2.innerText = 'Albums';
            d2.addEventListener('click', function () {
                navigate('audio/albums/');
            });
            mount.appendChild(d2);
            var d3 = document.createElement('div');
            d3.innerText = 'Lists';
            d3.addEventListener('click', function () {
                navigate('audio/lists/');
            });
            mount.appendChild(d3);
        }
        else if ((parts = /^video[/]shows[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
            req("/api/video/shows/" + parts[1] + "/", {}, function (status, response) {
                var e_8, _a, e_9, _b;
                var d = document.createElement('div');
                d.innerText = "" + response.title;
                d.style.setProperty('font-size', '24px');
                mount.appendChild(d);
                var context = {
                    files: response.seasons.reduce(function (files, season) {
                        files.push.apply(files, __spread(season.episodes.map(function (episode) { return episode.file_id; })));
                        return files;
                    }, new Array())
                };
                var context_metadata = {};
                try {
                    for (var _c = __values(response.seasons), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var season = _d.value;
                        var d_1 = document.createElement('div');
                        d_1.innerText = "" + season.number;
                        mount.appendChild(d_1);
                        var _loop_7 = function (episode) {
                            context_metadata[episode.file_id] = {
                                subtitles: episode.subtitles
                            };
                            var d2 = document.createElement('div');
                            d2.innerText = episode.title + " " + format_duration(episode.duration);
                            d2.addEventListener('click', function () {
                                set_context(context);
                                set_context_metadata(context_metadata);
                                play(context.files.indexOf(episode.file_id));
                            });
                            mount.appendChild(d2);
                        };
                        try {
                            for (var _e = (e_9 = void 0, __values(season.episodes)), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var episode = _f.value;
                                _loop_7(episode);
                            }
                        }
                        catch (e_9_1) { e_9 = { error: e_9_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_b = _e["return"])) _b.call(_e);
                            }
                            finally { if (e_9) throw e_9.error; }
                        }
                    }
                }
                catch (e_8_1) { e_8 = { error: e_8_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c["return"])) _a.call(_c);
                    }
                    finally { if (e_8) throw e_8.error; }
                }
            });
        }
        else if ((parts = /^video[/]shows[/]/.exec(uri)) !== null) {
            req("/api/video/shows/", {}, function (status, response) {
                var e_10, _a;
                var _loop_8 = function (show) {
                    var d = document.createElement('div');
                    d.innerText = "" + show.title;
                    d.addEventListener('click', function () {
                        navigate("video/shows/" + show.show_id + "/");
                    });
                    mount.appendChild(d);
                };
                try {
                    for (var _b = __values(response.shows), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var show = _c.value;
                        _loop_8(show);
                    }
                }
                catch (e_10_1) { e_10 = { error: e_10_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
                    }
                    finally { if (e_10) throw e_10.error; }
                }
            });
        }
        else if ((parts = /^video[/]episodes[/]([0-9a-f]{32})[/](?:([0-9]+)[/])?/.exec(uri)) !== null) {
            req("/api/video/episodes/" + parts[1] + "/", {}, function (status, response) {
                var d = document.createElement('div');
                d.innerText = "" + response.title;
                d.style.setProperty('font-size', '24px');
                mount.appendChild(d);
                var d2 = document.createElement('div');
                d2.innerText = format_duration(response.duration);
                mount.appendChild(d2);
                var context = {
                    files: [response.file_id]
                };
                var context_metadata = {};
                context_metadata[response.file_id] = {
                    subtitles: response.subtitles
                };
                var d3 = document.createElement('div');
                d3.innerText = "load";
                d3.addEventListener('click', function () {
                    set_context(context);
                    set_context_metadata(context_metadata);
                    play(context.files.indexOf(response.file_id));
                    if (parts !== null && parts.length >= 3) {
                        var start_ms = Number.parseInt(parts[2], 10);
                        seek(start_ms);
                    }
                });
                mount.appendChild(d3);
            });
        }
        else if ((parts = /^video[/]movies[/]([0-9a-f]{32})[/](?:([0-9]+)[/])?/.exec(uri)) !== null) {
            req("/api/video/movies/" + parts[1] + "/", {}, function (status, response) {
                var d = document.createElement('div');
                d.innerText = response.title + " (" + response.year + ")";
                d.style.setProperty('font-size', '24px');
                mount.appendChild(d);
                var d2 = document.createElement('div');
                d2.innerText = format_duration(response.duration);
                mount.appendChild(d2);
                var context = {
                    files: [response.file_id]
                };
                var context_metadata = {};
                context_metadata[response.file_id] = {
                    subtitles: response.subtitles
                };
                var d3 = document.createElement('div');
                d3.innerText = "load";
                d3.addEventListener('click', function () {
                    set_context(context);
                    set_context_metadata(context_metadata);
                    play(context.files.indexOf(response.file_id));
                    if (parts !== null && parts.length >= 3) {
                        var start_ms = Number.parseInt(parts[2], 10);
                        seek(start_ms);
                    }
                });
                mount.appendChild(d3);
            });
        }
        else if ((parts = /^video[/]movies[/]/.exec(uri)) !== null) {
            req("/api/video/movies/", {}, function (status, response) {
                var e_11, _a;
                var _loop_9 = function (movie) {
                    var d = document.createElement('div');
                    d.innerText = "" + movie.title;
                    d.addEventListener('click', function () {
                        navigate("video/movies/" + movie.movie_id + "/");
                    });
                    mount.appendChild(d);
                };
                try {
                    for (var _b = __values(response.movies), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var movie = _c.value;
                        _loop_9(movie);
                    }
                }
                catch (e_11_1) { e_11 = { error: e_11_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
                    }
                    finally { if (e_11) throw e_11.error; }
                }
            });
        }
        else if ((parts = /^video[/]cues[/]/.exec(uri)) !== null) {
            var wrapper = document.createElement("div");
            var searchbox_1 = document.createElement("input");
            wrapper.appendChild(searchbox_1);
            var searchbutton = document.createElement("button");
            searchbutton.textContent = "Search";
            wrapper.appendChild(searchbutton);
            var results_1 = document.createElement("div");
            wrapper.appendChild(results_1);
            var cb_2 = function () {
                var query = searchbox_1.value;
                if (query !== "") {
                    req("/api/video/cues/", { query: query }, function (status, response) {
                        var e_12, _a;
                        while (results_1.lastChild !== null) {
                            results_1.removeChild(results_1.lastChild);
                        }
                        var _loop_10 = function (cue) {
                            var d = document.createElement('div');
                            var p = document.createElement("pre");
                            p.innerText = "" + cue.lines.join("\n");
                            d.appendChild(p);
                            d.addEventListener('click', function () {
                                var episode_id = cue.subtitle.episode_id;
                                var movie_id = cue.subtitle.movie_id;
                                if (episode_id !== null) {
                                    navigate("video/episodes/" + episode_id + "/" + cue.start_ms + "/");
                                }
                                else if (movie_id !== null) {
                                    navigate("video/movies/" + movie_id + "/" + cue.start_ms + "/");
                                }
                            });
                            results_1.appendChild(d);
                        };
                        try {
                            for (var _b = __values(response.cues), _c = _b.next(); !_c.done; _c = _b.next()) {
                                var cue = _c.value;
                                _loop_10(cue);
                            }
                        }
                        catch (e_12_1) { e_12 = { error: e_12_1 }; }
                        finally {
                            try {
                                if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
                            }
                            finally { if (e_12) throw e_12.error; }
                        }
                    });
                }
            };
            searchbox_1.addEventListener("keyup", function (event) {
                if (event.keyCode === 13) {
                    cb_2();
                }
            });
            searchbutton.addEventListener("click", function () {
                cb_2();
            });
            mount.appendChild(wrapper);
        }
        else if ((parts = /^video[/]/.exec(uri)) !== null) {
            var d = document.createElement('div');
            d.innerText = 'Shows';
            d.addEventListener('click', function () {
                navigate('video/shows/');
            });
            mount.appendChild(d);
            d = document.createElement('div');
            d.innerText = 'Movies';
            d.addEventListener('click', function () {
                navigate('video/movies/');
            });
            mount.appendChild(d);
            d = document.createElement('div');
            d.innerText = 'Cues';
            d.addEventListener('click', function () {
                navigate('video/cues/');
            });
            mount.appendChild(d);
        }
        else {
            var d = document.createElement('div');
            d.innerText = 'Audio';
            d.addEventListener('click', function () {
                navigate('audio/');
            });
            mount.appendChild(d);
            var v = document.createElement('div');
            v.innerText = 'Video';
            v.addEventListener('click', function () {
                navigate('video/');
            });
            mount.appendChild(v);
        }
    };
    var get_basehref = function () {
        var element = document.head.querySelector('base[href]');
        if (element !== null) {
            var attribute = element.getAttribute('href');
            if (attribute !== null) {
                return attribute;
            }
        }
        return "/";
    };
    var get_route = function (pathname, basehref) {
        if (pathname === void 0) { pathname = window.location.pathname; }
        if (basehref === void 0) { basehref = get_basehref(); }
        var pn = pathname.split('/');
        var bh = basehref.split('/');
        var i = 0;
        while (i < pn.length && i < bh.length && pn[i] === bh[i]) {
            i++;
        }
        var uri = pn.slice(i).join('/');
        //return uri === '' ? './' : uri;
        return uri;
    };
    var navigate = function (uri) {
        if (window.history.state === null) {
            window.history.replaceState({ 'uri': uri }, '', uri);
        }
        else {
            if (uri !== window.history.state.uri) {
                window.history.pushState({ 'uri': uri }, '', uri);
            }
        }
        updateviewforuri(uri);
    };
    navigate(get_route());
    window.addEventListener('popstate', function (event) {
        navigate(event.state.uri);
    });
});
