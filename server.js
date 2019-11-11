#!/usr/bin/env node
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
var define = (function () {
    var moduleStates = new Map();
    var require2 = function (name) {
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
                exports.push(require2);
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
                exports.push(require2(dependency));
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
define("cc", ["require", "exports"], function (require, exports) {
    "use strict";
    exports.__esModule = true;
    var Client = require('castv2-client').Client;
    var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
    var mDnsSd = require('node-dns-sd');
    var gcontext = null;
    var gindex = null;
    var gmedia = null;
    var gtoken = null;
    var gplayer = null;
    var media = require('./private/db/media.json');
    var lists = require('./private/db/lists.json');
    var tracks_index = {};
    for (var i = 0; i < media.audio.tracks.length; i++) {
        var track = media.audio.tracks[i];
        tracks_index[track.track_id] = track;
    }
    var discs_index = {};
    for (var i = 0; i < media.audio.discs.length; i++) {
        var disc = media.audio.discs[i];
        discs_index[disc.disc_id] = disc;
    }
    var albums_index = {};
    for (var i = 0; i < media.audio.albums.length; i++) {
        var album = media.audio.albums[i];
        albums_index[album.album_id] = album;
    }
    var artists_index = {};
    for (var i = 0; i < media.audio.artists.length; i++) {
        var artist = media.audio.artists[i];
        artists_index[artist.artist_id] = artist;
    }
    var shows_index = {};
    for (var i = 0; i < media.video.shows.length; i++) {
        var show = media.video.shows[i];
        shows_index[show.show_id] = show;
    }
    var episodes_index = {};
    for (var i = 0; i < media.video.episodes.length; i++) {
        var episode = media.video.episodes[i];
        episodes_index[episode.episode_id] = episode;
    }
    var seasons_index = {};
    for (var i = 0; i < media.video.seasons.length; i++) {
        var season = media.video.seasons[i];
        seasons_index[season.season_id] = season;
    }
    var movies_index = {};
    for (var i = 0; i < media.video.movies.length; i++) {
        var movie = media.video.movies[i];
        movies_index[movie.movie_id] = movie;
    }
    var subtitles_index = {};
    for (var i = 0; i < media.video.subtitles.length; i++) {
        var subtitle = media.video.subtitles[i];
        subtitles_index[subtitle.subtitle_id] = subtitle;
    }
    var cues_index = {};
    for (var i = 0; i < media.video.cues.length; i++) {
        var cue = media.video.cues[i];
        cues_index[cue.cue_id] = cue;
    }
    var audiolists_index = {};
    for (var i = 0; i < lists.audiolists.length; i++) {
        var audiolist = lists.audiolists[i];
        audiolists_index[audiolist.audiolist_id] = audiolist;
    }
    var files_index = {};
    for (var i = 0; i < media.files.length; i++) {
        var file = media.files[i];
        files_index[file.file_id] = file;
    }
    var make_media_object = function () {
        if (gcontext === null || gindex === null) {
            return null;
        }
        var file = files_index[gcontext.files[gindex]];
        if (file === undefined) {
            return null;
        }
        var file2 = file;
        var title = 'Title';
        var subtitle = 'Subtitle';
        var image = '';
        var sttracks = new Array();
        var langmap = {
            eng: 'en-US',
            swe: 'sv-SE'
        };
        var makesttrack = function (s, i) {
            return {
                trackId: i,
                type: 'TEXT',
                trackType: 'TEXT',
                trackContentId: "https://ap.joelek.se/files/" + s.file_id + "/?token=" + gtoken,
                trackContentType: 'text/vtt',
                subtype: 'SUBTITLES',
                language: s.language !== null ? langmap[s.language] || langmap.eng : langmap.eng,
                name: null,
                customData: null
            };
        };
        var track = media.audio.tracks.find(function (track) { return track.file_id === file2.file_id; });
        if (track !== undefined) {
            var disc = discs_index[track.disc_id];
            var album = albums_index[disc.album_id];
            var track_artists_1 = media.audio.track_artists
                .filter(function (track_artist) { return track_artist.track_id === track.track_id; });
            var artists = media.audio.artists.filter(function (artist) { return track_artists_1.find(function (tr) { return tr.artist_id === artist.artist_id; }) !== undefined; });
            title = track.title;
            subtitle = [artists.map(function (ar) { return ar.title; }).join(', '), album.title].join(' \u2022 ');
            image = "https://ap.joelek.se/files/" + album.cover_file_id + "/?token=" + gtoken;
        }
        else {
            var episode_1 = media.video.episodes.find(function (episode) { return episode.file_id === file2.file_id; });
            if (episode_1 !== undefined) {
                var season_1 = media.video.seasons.find(function (season) { return season.season_id === episode_1.season_id; });
                if (season_1 !== undefined) {
                    var show = media.video.shows.find(function (show) { return show.show_id === season_1.show_id; });
                    if (show !== undefined) {
                        title = episode_1.title;
                        subtitle = [show.title, "s" + season_1.number + "e" + episode_1.number].join(' \u2022 ');
                        sttracks = media.video.subtitles.filter(function (st) { return st.episode_id === episode_1.episode_id; }).map(makesttrack);
                    }
                }
            }
            else {
                var movie_1 = media.video.movies.find(function (movie) { return movie.file_id === file2.file_id; });
                if (movie_1 !== undefined) {
                    sttracks = media.video.subtitles.filter(function (st) { return st.movie_id === movie_1.movie_id; }).map(makesttrack);
                    title = movie_1.title;
                    subtitle = [].join(' \u2022 ');
                }
            }
        }
        var preftrack = sttracks.find(function (s) { return s.language === 'sv-SE'; }) || sttracks.find(function (s) { return s.language === 'en-US'; });
        var activeTrackIds = preftrack ? [sttracks[sttracks.indexOf(preftrack)].trackId] : [];
        return {
            contentId: "https://ap.joelek.se/files/" + file.file_id + "/?token=" + gtoken,
            contentType: file.mime,
            streamType: 'BUFFERED',
            metadata: {
                type: 0,
                metadataType: 0,
                title: title,
                subtitle: subtitle,
                images: [
                    { url: image }
                ]
            },
            tracks: sttracks,
            activeTrackIds: activeTrackIds
        };
    };
    var attempt_playback = function (player) {
        gmedia = null;
        var media = make_media_object();
        if (media === null) {
            return;
        }
        player.load(media, {
            autoplay: true,
            activeTrackIds: media.activeTrackIds
        }, function (error, status) {
            if (error) {
                console.log(error);
            }
            if (status) {
                gmedia = status.media;
            }
        });
    };
    var seek = function (_a, cb) {
        var percentage = _a.percentage;
        if (gplayer !== null && gmedia !== null) {
            gplayer.media.seek((gmedia.duration * percentage / 100) | 0);
        }
        cb();
    };
    exports.seek = seek;
    var pause = function (_a, cb) {
        if (gplayer !== null) {
            gplayer.media.pause();
        }
        cb();
    };
    exports.pause = pause;
    var resume = function (_a, cb) {
        if (gplayer !== null) {
            gplayer.media.play();
        }
        cb();
    };
    exports.resume = resume;
    var load = function (_a, cb) {
        var context = _a.context, index = _a.index, token = _a.token;
        mDnsSd.discover({
            name: '_googlecast._tcp.local'
        }).then(function (device_list) {
            if (device_list.length > 0)
                ondeviceup(device_list[0].address);
        })["catch"](function (error) {
            console.error(error);
        });
        function ondeviceup(host) {
            var client = new Client();
            client.connect(host, function () {
                console.log('connected, launching app ...');
                client.launch(DefaultMediaReceiver, function (error, player) {
                    gcontext = context;
                    gindex = index;
                    gtoken = token;
                    gplayer = player;
                    cb();
                    console.log('app launched');
                    attempt_playback(player);
                    player.on('status', function (status) {
                        console.log('status broadcast playerState=%s', status.playerState);
                        if (status.playerState === 'IDLE' && gmedia !== null) {
                            if (gindex !== null) {
                                gindex++;
                            }
                            attempt_playback(player);
                        }
                    });
                });
            });
            client.on('error', function (error) {
                console.log('Error: %s', error.message);
                client.close();
            });
        }
    };
    exports.load = load;
});
define("auth", ["require", "exports", "crypto"], function (require, exports, libcrypto) {
    "use strict";
    exports.__esModule = true;
    var tokens = new Array();
    var users = require('./private/db/users.json');
    function password_generate(password) {
        var cost = 14;
        var blockSize = 8;
        var paralellization = 1;
        var salt = libcrypto.randomBytes(16);
        var password_hash = libcrypto.scryptSync(Buffer.from(password, 'utf8'), salt, 32, {
            N: (1 << cost),
            r: blockSize,
            p: paralellization,
            maxmem: (256 << cost) * blockSize
        });
        var params = Buffer.alloc(4);
        params[0] = (cost >> 8);
        params[1] = (cost >> 0);
        params[2] = (blockSize >> 0);
        params[3] = (paralellization >> 0);
        return "$s0$" + params.toString('hex') + "$" + salt.toString('base64') + "$" + password_hash.toString('base64');
    }
    function password_verify(password, chunk) {
        var parts = /^\$s0\$([0-9a-fA-F]{8})\$([A-Za-z0-9+/]{22}==)\$([A-Za-z0-9+/]{43}=)$/.exec(chunk);
        if (parts === null) {
            throw new Error();
        }
        var parameters = Buffer.from(parts[1], 'hex');
        var salt = Buffer.from(parts[2], 'base64');
        var hash = Buffer.from(parts[3], 'base64');
        var cost = (parameters[0] << 8) | (parameters[1] << 0);
        var blockSize = (parameters[2] << 0);
        var paralellization = (parameters[3] << 0);
        var password_hash = libcrypto.scryptSync(Buffer.from(password, 'utf8'), salt, 32, {
            N: (1 << cost),
            r: blockSize,
            p: paralellization,
            maxmem: (256 << cost) * blockSize
        });
        return libcrypto.timingSafeEqual(hash, password_hash);
    }
    function generate_token(username) {
        var selector = libcrypto.randomBytes(16);
        var validator = libcrypto.randomBytes(16);
        var hash = libcrypto.createHash('sha256');
        hash.update(validator);
        var validator_hash = hash.digest('hex');
        tokens.push({
            username: username,
            selector: selector.toString('hex'),
            validator_hash: validator_hash
        });
        return "" + selector.toString('hex') + validator.toString('hex');
    }
    function getToken(username, password) {
        var user = users.find(function (user) { return user.username === username; });
        if (!user) {
            throw new Error();
        }
        if (!password_verify(password, user.password)) {
            throw new Error("Fak u dolan.");
        }
        return generate_token(username);
    }
    exports.getToken = getToken;
    function getUsername(chunk) {
        var parts = /^([0-9a-f]{32})([0-9a-f]{32})$/.exec(chunk);
        if (!parts) {
            throw new Error();
        }
        var selector = parts[1];
        var validator = parts[2];
        var token = tokens.find(function (token) { return token.selector === selector; });
        if (!token) {
            throw new Error();
        }
        var hash = libcrypto.createHash('sha256');
        hash.update(Buffer.from(validator, 'hex'));
        var validator_hash = hash.digest();
        if (!libcrypto.timingSafeEqual(Buffer.from(token.validator_hash, 'hex'), validator_hash)) {
            throw new Error();
        }
        return token.username;
    }
    exports.getUsername = getUsername;
});
define("api", ["require", "exports", "cc", "auth"], function (require, exports, libcc, libauth) {
    "use strict";
    exports.__esModule = true;
    var media = require('./private/db/media.json');
    var lists = require('./private/db/lists.json');
    var tracks_index = {};
    for (var i = 0; i < media.audio.tracks.length; i++) {
        var track = media.audio.tracks[i];
        tracks_index[track.track_id] = track;
    }
    var discs_index = {};
    for (var i = 0; i < media.audio.discs.length; i++) {
        var disc = media.audio.discs[i];
        discs_index[disc.disc_id] = disc;
    }
    var albums_index = {};
    for (var i = 0; i < media.audio.albums.length; i++) {
        var album = media.audio.albums[i];
        albums_index[album.album_id] = album;
    }
    var artists_index = {};
    for (var i = 0; i < media.audio.artists.length; i++) {
        var artist = media.audio.artists[i];
        artists_index[artist.artist_id] = artist;
    }
    var shows_index = {};
    for (var i = 0; i < media.video.shows.length; i++) {
        var show = media.video.shows[i];
        shows_index[show.show_id] = show;
    }
    var episodes_index = {};
    for (var i = 0; i < media.video.episodes.length; i++) {
        var episode = media.video.episodes[i];
        episodes_index[episode.episode_id] = episode;
    }
    var seasons_index = {};
    for (var i = 0; i < media.video.seasons.length; i++) {
        var season = media.video.seasons[i];
        seasons_index[season.season_id] = season;
    }
    var movies_index = {};
    for (var i = 0; i < media.video.movies.length; i++) {
        var movie = media.video.movies[i];
        movies_index[movie.movie_id] = movie;
    }
    var subtitles_index = {};
    for (var i = 0; i < media.video.subtitles.length; i++) {
        var subtitle = media.video.subtitles[i];
        subtitles_index[subtitle.subtitle_id] = subtitle;
    }
    var cues_index = {};
    for (var i = 0; i < media.video.cues.length; i++) {
        var cue = media.video.cues[i];
        cues_index[cue.cue_id] = cue;
    }
    var audiolists_index = {};
    for (var i = 0; i < lists.audiolists.length; i++) {
        var audiolist = lists.audiolists[i];
        audiolists_index[audiolist.audiolist_id] = audiolist;
    }
    var Router = /** @class */ (function () {
        function Router() {
            this.routes = new Array();
        }
        Router.prototype.registerRoute = function (route) {
            this.routes.push(route);
            return this;
        };
        Router.prototype.route = function (request, response) {
            for (var _i = 0, _a = this.routes; _i < _a.length; _i++) {
                var route = _a[_i];
                if (route.handlesRequest(request)) {
                    return route.handleRequest(request, response);
                }
            }
            response.writeHead(400);
            response.end('{}');
        };
        return Router;
    }());
    var ArtistRoute = /** @class */ (function () {
        function ArtistRoute() {
        }
        ArtistRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var parts = /^\/api\/audio\/artists\/([0-9a-f]{32})\//.exec(request.url);
            if (parts === null) {
                throw new Error();
            }
            var artist_id = parts[1];
            var artist = artists_index[artist_id];
            if (artist === undefined) {
                throw new Error();
            }
            // CREATE INDEX
            var album_artists = media.audio.album_artists.filter(function (album_artist) {
                return album_artist.artist_id === artist_id;
            });
            var albums = album_artists.map(function (album_artist) {
                return albums_index[album_artist.album_id];
            }).filter(function (album) { return album !== undefined; });
            var payload = __assign(__assign({}, artist), { albums: albums });
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        ArtistRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^\/api\/audio\/artists\/([0-9a-f]{32})\//.test(request.url);
        };
        return ArtistRoute;
    }());
    var ArtistsRoute = /** @class */ (function () {
        function ArtistsRoute() {
        }
        ArtistsRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var payload = {
                artists: media.audio.artists
            };
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        ArtistsRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^\/api\/audio\/artists\//.test(request.url);
        };
        return ArtistsRoute;
    }());
    var AlbumRoute = /** @class */ (function () {
        function AlbumRoute() {
        }
        AlbumRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var parts = /^\/api\/audio\/albums\/([0-9a-f]{32})\//.exec(request.url);
            if (parts === null) {
                throw new Error();
            }
            var album_id = parts[1];
            var album = albums_index[album_id];
            if (album === undefined) {
                throw new Error();
            }
            var discs = media.audio.discs.filter(function (disc) {
                return disc.album_id === album_id;
            }).map(function (disc) {
                var tracks = media.audio.tracks.filter(function (track) {
                    return track.disc_id === disc.disc_id;
                });
                return __assign(__assign({}, disc), { tracks: tracks });
            });
            var payload = __assign(__assign({}, album), { discs: discs });
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        AlbumRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^\/api\/audio\/albums\/([0-9a-f]{32})\//.test(request.url);
        };
        return AlbumRoute;
    }());
    var AlbumsRoute = /** @class */ (function () {
        function AlbumsRoute() {
        }
        AlbumsRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var payload = {
                albums: media.audio.albums
            };
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        AlbumsRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^\/api\/audio\/albums\//.test(request.url);
        };
        return AlbumsRoute;
    }());
    var CCRoute = /** @class */ (function () {
        function CCRoute() {
        }
        CCRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var rurl = request.url;
            var rbody = '';
            request.on('data', function (chunk) {
                rbody += chunk;
            }).on('end', function () {
                try {
                    var body = JSON.parse(rbody);
                    if (/^[/]api[/]cc[/]seek[/]/.test(rurl)) {
                        return libcc.seek(body, function () {
                            var payload = {};
                            response.writeHead(200);
                            response.end(JSON.stringify(payload));
                        });
                    }
                    if (/^[/]api[/]cc[/]pause[/]/.test(rurl)) {
                        return libcc.pause(body, function () {
                            var payload = {};
                            response.writeHead(200);
                            response.end(JSON.stringify(payload));
                        });
                    }
                    if (/^[/]api[/]cc[/]resume[/]/.test(rurl)) {
                        return libcc.resume(body, function () {
                            var payload = {};
                            response.writeHead(200);
                            response.end(JSON.stringify(payload));
                        });
                    }
                    if (/^[/]api[/]cc[/]load[/]/.test(rurl)) {
                        return libcc.load(body, function () {
                            var payload = {};
                            response.writeHead(200);
                            response.end(JSON.stringify(payload));
                        });
                    }
                }
                catch (error) {
                    console.log(error);
                }
                response.writeHead(400);
                response.end(JSON.stringify({}));
            });
        };
        CCRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^\/api\/cc\//.test(request.url);
        };
        return CCRoute;
    }());
    var ShowRoute = /** @class */ (function () {
        function ShowRoute() {
        }
        ShowRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var parts = /^[/]api[/]video[/]shows[/]([0-9a-f]{32})[/]/.exec(request.url);
            if (parts === null) {
                throw new Error();
            }
            var show_id = parts[1];
            var show = shows_index[show_id];
            if (show === undefined) {
                throw new Error();
            }
            var seasons = media.video.seasons
                .filter(function (season) {
                return season.show_id === show_id;
            })
                .map(function (season) {
                var episodes = media.video.episodes
                    .filter(function (episode) {
                    return episode.season_id === season.season_id;
                })
                    .map(function (episode) {
                    var subtitles = media.video.subtitles
                        .filter(function (subtitle) {
                        return subtitle.episode_id === episode.episode_id;
                    });
                    return __assign(__assign({}, episode), { subtitles: subtitles });
                });
                return __assign(__assign({}, season), { episodes: episodes });
            });
            var payload = __assign(__assign({}, show), { seasons: seasons });
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        ShowRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]shows[/]([0-9a-f]{32})[/]/.test(request.url);
        };
        return ShowRoute;
    }());
    var ShowsRoute = /** @class */ (function () {
        function ShowsRoute() {
        }
        ShowsRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var payload = {
                shows: media.video.shows
            };
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        ShowsRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]shows[/]/.test(request.url);
        };
        return ShowsRoute;
    }());
    var AuthWithTokenRoute = /** @class */ (function () {
        function AuthWithTokenRoute() {
        }
        AuthWithTokenRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var parts = /^[/]api[/]auth[/][?]token[=]([0-9a-f]{64})/.exec(request.url);
            if (parts === null) {
                throw new Error();
            }
            var chunk = parts[1];
            try {
                libauth.getUsername(chunk);
                response.writeHead(200);
                return response.end(JSON.stringify({}));
            }
            catch (error) { }
            response.writeHead(401);
            return response.end(JSON.stringify({}));
        };
        AuthWithTokenRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^[/]api[/]auth[/][?]token[=]([0-9a-f]{64})/.test(request.url);
        };
        return AuthWithTokenRoute;
    }());
    var AuthRoute = /** @class */ (function () {
        function AuthRoute() {
        }
        AuthRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var data = '';
            request.on('data', function (chunk) {
                data += chunk;
            }).on('end', function () {
                try {
                    var body = JSON.parse(data);
                    if (body == null || body.constructor !== Object) {
                        throw new Error();
                    }
                    var username = body.username;
                    if (username == null || username.constructor !== String) {
                        throw new Error();
                    }
                    var password = body.password;
                    if (password == null || password.constructor !== String) {
                        throw new Error();
                    }
                    var payload = {
                        token: libauth.getToken(username, password)
                    };
                    response.writeHead(200);
                    response.end(JSON.stringify(payload));
                }
                catch (error) {
                    response.writeHead(400);
                    response.end(JSON.stringify({ error: error.message }));
                }
            });
        };
        AuthRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^[/]api[/]auth[/]/.test(request.url);
        };
        return AuthRoute;
    }());
    var MovieRoute = /** @class */ (function () {
        function MovieRoute() {
        }
        MovieRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var parts = /^[/]api[/]video[/]movies[/]([0-9a-f]{32})[/]/.exec(request.url);
            if (parts === null) {
                throw new Error();
            }
            var movie_id = parts[1];
            var movie = movies_index[movie_id];
            if (movie === undefined) {
                throw new Error();
            }
            var subtitles = media.video.subtitles
                .filter(function (subtitle) {
                return subtitle.movie_id === movie_id;
            });
            var payload = __assign(__assign({}, movie), { subtitles: subtitles });
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        MovieRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]movies[/]([0-9a-f]{32})[/]/.test(request.url);
        };
        return MovieRoute;
    }());
    var MoviesRoute = /** @class */ (function () {
        function MoviesRoute() {
        }
        MoviesRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var payload = {
                movies: media.video.movies
            };
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        MoviesRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]movies[/]/.test(request.url);
        };
        return MoviesRoute;
    }());
    var AudiolistRoute = /** @class */ (function () {
        function AudiolistRoute() {
        }
        AudiolistRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var parts = /^[/]api[/]audio[/]lists[/]([0-9a-f]{32})[/]/.exec(request.url);
            if (parts === null) {
                throw new Error();
            }
            var audiolist_id = parts[1];
            var audiolist = audiolists_index[audiolist_id];
            if (audiolist === undefined) {
                throw new Error();
            }
            var items = lists.audiolist_items
                .filter(function (audiolist_item) {
                return audiolist_item.audiolist_id === audiolist_id;
            })
                .map(function (audiolist_item) {
                var track = tracks_index[audiolist_item.track_id];
                if (track !== undefined) {
                    var artists = media.audio.track_artists
                        .filter(function (track_artist) {
                        return track_artist.track_id === track.track_id;
                    }).map(function (track_artist) {
                        return artists_index[track_artist.artist_id];
                    }).filter(function (artist) {
                        return artist !== undefined;
                    });
                    var disc = discs_index[track.disc_id];
                    if (disc !== undefined) {
                        var album = albums_index[disc.album_id];
                        if (album !== undefined) {
                            return {
                                track: __assign({}, track)
                            };
                        }
                    }
                }
                return null;
            });
            var payload = __assign(__assign({}, audiolist), { items: items });
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        AudiolistRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^[/]api[/]audio[/]lists[/]([0-9a-f]{32})[/]/.test(request.url);
        };
        return AudiolistRoute;
    }());
    var AudiolistsRoute = /** @class */ (function () {
        function AudiolistsRoute() {
        }
        AudiolistsRoute.prototype.handleRequest = function (request, response) {
            if (request.url === undefined) {
                throw new Error();
            }
            var payload = {
                audiolists: lists.audiolists
            };
            response.writeHead(200);
            response.end(JSON.stringify(payload));
        };
        AudiolistsRoute.prototype.handlesRequest = function (request) {
            return request.method === 'POST' && request.url !== undefined && /^[/]api[/]audio[/]lists[/]/.test(request.url);
        };
        return AudiolistsRoute;
    }());
    var router = new Router()
        .registerRoute(new AuthWithTokenRoute())
        .registerRoute(new AuthRoute())
        .registerRoute(new CCRoute())
        .registerRoute(new MovieRoute())
        .registerRoute(new MoviesRoute())
        .registerRoute(new ArtistRoute())
        .registerRoute(new ArtistsRoute())
        .registerRoute(new AlbumRoute())
        .registerRoute(new AlbumsRoute())
        .registerRoute(new ShowRoute())
        .registerRoute(new ShowsRoute())
        .registerRoute(new AudiolistRoute())
        .registerRoute(new AudiolistsRoute());
    var handleRequest = function (request, response) {
        try {
            router.route(request, response);
        }
        catch (error) {
            response.writeHead(500);
            response.end(JSON.stringify({ error: error.message }));
        }
    };
    exports.handleRequest = handleRequest;
});
define("server", ["require", "exports", "fs", "http", "https", "path", "url", "api", "auth"], function (require, exports, libfs, libhttp, libhttps, libpath, liburl, api, auth) {
    "use strict";
    exports.__esModule = true;
    var media = require('./private/db/media.json');
    var files_index = {};
    for (var i = 0; i < media.files.length; i++) {
        var file = media.files[i];
        files_index[file.file_id] = file;
    }
    var get_path_segments = function (path) {
        var raw_path_segments = path.split('/');
        var path_segments = [];
        for (var _i = 0, raw_path_segments_1 = raw_path_segments; _i < raw_path_segments_1.length; _i++) {
            var raw_path_segment = raw_path_segments_1[_i];
            if (raw_path_segment === '') {
                continue;
            }
            if (raw_path_segment === '.') {
                continue;
            }
            if (raw_path_segment !== '..') {
                path_segments.push(decodeURIComponent(raw_path_segment));
                continue;
            }
            if (path_segments.length === 0) {
                throw new Error("bad req");
            }
            path_segments.pop();
        }
        return path_segments;
    };
    var filter_headers = function (headers, keys) {
        var out = {};
        for (var key in headers) {
            if (keys.indexOf(key) >= 0) {
                out[key] = headers[key];
            }
        }
        return out;
    };
    var send_data = function (file, request, response) {
        if (request.url === undefined) {
            throw new Error();
        }
        try {
            var url = liburl.parse(request.url, true);
            auth.getUsername(url.query.token);
        }
        catch (error) {
            response.writeHead(401, {});
            return response.end();
        }
        var filename = file.path.join(libpath.sep);
        var fd = libfs.openSync(filename, 'r');
        var size = libfs.fstatSync(fd).size;
        libfs.closeSync(fd);
        var parts2;
        var range = request.headers.range;
        if (range !== undefined && (parts2 = /^bytes\=((?:[0-9])|(?:[1-9][0-9]+))\-((?:[0-9])|(?:[1-9][0-9]+))?$/.exec(range)) != null) {
            var offset = parseInt(parts2[1]);
            var offset2 = parts2[2] ? parseInt(parts2[2]) : null;
            if (offset2 === null) {
                offset2 = Math.min(offset + 1048576, size) - 1;
            }
            if (offset >= size || offset2 >= size || offset2 < offset) {
                response.writeHead(416);
                response.end();
                return;
            }
            var length = offset2 - offset + 1;
            response.writeHead(206, {
                'Access-Control-Allow-Origin': '*',
                'Accept-Ranges': "bytes",
                'Content-Range': "bytes " + offset + "-" + offset2 + "/" + size,
                'Content-Type': file.mime,
                'Content-Length': "" + length
            });
            var s = libfs.createReadStream(filename, {
                start: offset,
                end: offset2
            });
            s.on('open', function () {
                s.pipe(response);
            });
            s.on('error', function (error) {
                response.end();
            });
        }
        else {
            var s = libfs.createReadStream(filename);
            s.on('open', function () {
                response.writeHead(200, {
                    'Access-Control-Allow-Origin': '*',
                    'Accept-Ranges': "bytes",
                    'Content-Type': file.mime,
                    'Content-Length': "" + size
                });
                s.pipe(response);
            });
            s.on('error', function (error) {
                response.writeHead(404, {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'text/plain'
                });
                response.end();
            });
        }
    };
    var httpServer = libhttp.createServer()
        .on('request', function (request, response) {
        response.writeHead(307, {
            'Location': "https://" + request.headers['host'] + request.url
        });
        response.end();
    })
        .listen(80);
    var httpsServer = libhttps.createServer({
        cert: libfs.readFileSync("./private/certs/live/ap.joelek.se/fullchain.pem"),
        dhparam: libfs.readFileSync("./private/certs/dhparam.pem"),
        key: libfs.readFileSync("./private/certs/live/ap.joelek.se/privkey.pem")
    }).on('request', function (request, response) {
        console.log(new Date().toUTCString() + ":" + request.method + ":" + request.url, JSON.stringify(filter_headers(request.headers, ['host', 'range']), null, "\t"));
        if (!/ap[.]joelek[.]se(:[0-9]+)?$/.test(request.headers.host)) {
            console.log('dropped', JSON.stringify(request.headers, null, "\t"));
            response.writeHead(400);
            response.end();
            return;
        }
        var parts;
        if (request.method === 'GET' && request.url === '/favicon.ico') {
            response.writeHead(404);
            response.end();
            return;
        }
        if (request.method === 'GET' && (parts = /^[/]files[/]([0-9a-f]{32})[/]/.exec(request.url)) !== null) {
            var file_id_1 = parts[1];
            var file = media.files.find(function (file) { return file.file_id === file_id_1; });
            if (file !== undefined) {
                return send_data(file, request, response);
            }
        }
        if (/^[/]api[/]/.test(request.url)) {
            return api.handleRequest(request, response);
        }
        if (request.method === 'GET') {
            response.writeHead(200);
            response.end("<!doctype html><html><head><base href=\"/\"/><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0\" name=\"viewport\"/></head><body><script>" + libfs.readFileSync('client.js') + "</script></body></html>");
            return;
        }
        console.log('unhandled', JSON.stringify(request.headers, null, "\t"));
        response.writeHead(400);
        response.end();
        return;
    })
        .listen(443);
});
