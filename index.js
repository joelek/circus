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
define("index", ["require", "exports", "crypto", "fs", "path"], function (require, exports, libcrypto, libfs, libpath) {
    "use strict";
    exports.__esModule = true;
    var media_root = './private/media/';
    var db = {
        audio: {
            artists: new Array(),
            albums: new Array(),
            discs: new Array(),
            tracks: new Array(),
            album_artists: new Array(),
            track_artists: new Array()
        },
        video: {
            movies: new Array(),
            shows: new Array(),
            seasons: new Array(),
            episodes: new Array(),
            subtitles: new Array(),
            cues: new Array()
        },
        files: new Array()
    };
    var movies_index = {};
    var shows_index = {};
    var seasons_index = {};
    var episodes_index = {};
    var subtitles_index = {};
    var cues_index = {};
    var artists_index = {};
    var albums_index = {};
    var discs_index = {};
    var tracks_index = {};
    var album_artists_index = {};
    var track_artists_index = {};
    var files_index = {};
    var add_movie = function (movie) {
        if (!(movie.movie_id in movies_index)) {
            movies_index[movie.movie_id] = movie;
            db.video.movies.push(movie);
        }
    };
    var add_show = function (show) {
        if (!(show.show_id in shows_index)) {
            shows_index[show.show_id] = show;
            db.video.shows.push(show);
        }
    };
    var add_season = function (season) {
        if (!(season.season_id in seasons_index)) {
            seasons_index[season.season_id] = season;
            db.video.seasons.push(season);
        }
    };
    var add_episode = function (episode) {
        if (!(episode.episode_id in episodes_index)) {
            episodes_index[episode.episode_id] = episode;
            db.video.episodes.push(episode);
        }
    };
    var add_artist = function (artist) {
        if (!(artist.artist_id in artists_index)) {
            artists_index[artist.artist_id] = artist;
            db.audio.artists.push(artist);
        }
    };
    var add_album = function (album) {
        if (!(album.album_id in albums_index)) {
            albums_index[album.album_id] = album;
            db.audio.albums.push(album);
        }
    };
    var add_disc = function (disc) {
        if (!(disc.disc_id in discs_index)) {
            discs_index[disc.disc_id] = disc;
            db.audio.discs.push(disc);
        }
    };
    var add_track = function (track) {
        if (!(track.track_id in tracks_index)) {
            tracks_index[track.track_id] = track;
            db.audio.tracks.push(track);
        }
    };
    var add_album_artist = function (album_artist) {
        var key = Array.of(album_artist.album_id, album_artist.artist_id).join(":");
        if (!(key in album_artists_index)) {
            album_artists_index[key] = album_artist;
            db.audio.album_artists.push(album_artist);
        }
    };
    var add_track_artist = function (track_artist) {
        var key = Array.of(track_artist.track_id, track_artist.artist_id).join(":");
        if (!(key in track_artists_index)) {
            track_artists_index[key] = track_artist;
            db.audio.track_artists.push(track_artist);
        }
    };
    var add_subtitle = function (subtitle) {
        db.video.subtitles.push(subtitle);
    };
    var add_file = function (file) {
        if (!(file.file_id in files_index)) {
            files_index[file.file_id] = file;
            db.files.push(file);
        }
    };
    var decode_id3v24_syncsafe_integer = function (b) {
        return ((b[0] & 0x7F) << 21) | ((b[1] & 0x7F) << 14) | ((b[2] & 0x7F) << 7) | ((b[3] & 0x7F) << 0);
    };
    var read_id3v24_tag = function (file) {
        var fd = libfs.openSync(file, 'r');
        var headerid3 = Buffer.alloc(10);
        libfs.readSync(fd, headerid3, 0, headerid3.length, null);
        if (headerid3.slice(0, 5).toString() !== 'ID3\x04\x00') {
            throw new Error();
        }
        var length = decode_id3v24_syncsafe_integer(headerid3.slice(6, 6 + 4));
        var body = Buffer.alloc(length);
        libfs.readSync(fd, body, 0, body.length, null);
        var tag = {
            track_title: null,
            album_name: null,
            year: null,
            track: null,
            tracks: null,
            disc: null,
            discs: null,
            track_artist_name: null,
            album_artist_name: null,
            duration: 0
        };
        var offset = 0;
        while (offset < body.length) {
            var frame_id = body.slice(offset, offset + 4).toString();
            var length_1 = decode_id3v24_syncsafe_integer(body.slice(offset + 4, offset + 4 + 4));
            var flags = body.slice(offset + 8, offset + 8 + 2);
            var data = body.slice(offset + 10, offset + 10 + length_1);
            offset += 10 + length_1;
            if (frame_id === '\0\0\0\0') {
                break;
            }
            else if (frame_id === 'TIT2') {
                tag.track_title = data.slice(1, -1).toString();
            }
            else if (frame_id === 'TALB') {
                tag.album_name = data.slice(1, -1).toString();
            }
            else if (frame_id === 'TDRC') {
                var string = data.slice(1, -1).toString();
                var parts = /^([0-9]{4})$/.exec(string);
                if (parts !== null) {
                    tag.year = parseInt(parts[1]);
                }
            }
            else if (frame_id === 'TRCK') {
                var string = data.slice(1, -1).toString();
                var parts = /^([0-9]{2})\/([0-9]{2})$/.exec(string);
                if (parts !== null) {
                    tag.track = parseInt(parts[1]);
                    tag.tracks = parseInt(parts[2]);
                }
            }
            else if (frame_id === 'TPOS') {
                var string = data.slice(1, -1).toString();
                var parts = /^([0-9]{2})\/([0-9]{2})$/.exec(string);
                if (parts !== null) {
                    tag.disc = parseInt(parts[1]);
                    tag.discs = parseInt(parts[2]);
                }
            }
            else if (frame_id === 'TPE1') {
                tag.track_artist_name = data.slice(1, -1).toString();
            }
            else if (frame_id === 'TPE2') {
                tag.album_artist_name = data.slice(1, -1).toString();
            }
            else if (frame_id === 'TXXX') {
                var string = data.slice(1, -1).toString();
                var parts = /^ALBUM ARTIST\0(.+)$/.exec(string);
                if (parts !== null) {
                    tag.album_artist_name = parts[1];
                }
            }
        }
        var header = Buffer.alloc(4);
        libfs.readSync(fd, header, 0, header.length, null);
        var sync = ((header[0] & 0xFF) << 3) | ((header[1] & 0xE0) >> 5);
        var version = ((header[1] & 0x18) >> 3);
        var layer = ((header[1] & 0x06) >> 1);
        var skip_crc = ((header[1] & 0x01) >> 0);
        var bitrate = ((header[2] & 0xF0) >> 4);
        var sample_rate = ((header[2] & 0x0C) >> 2);
        var padded = ((header[2] & 0x02) >> 1);
        var priv = ((header[2] & 0x01) >> 0);
        var channels = ((header[3] & 0xC0) >> 6);
        var modext = ((header[3] & 0x30) >> 4);
        var copyrighted = ((header[3] & 0x08) >> 3);
        var original = ((header[3] & 0x04) >> 2);
        var emphasis = ((header[3] & 0x03) >> 0);
        if (sync === 0x07FF && version === 3 && layer === 1) {
            var samples_per_frame = 1152;
            if (bitrate === 9 && sample_rate === 0) {
                var slots = (samples_per_frame * 128000 / 8 / 44100) | 0;
                if (padded)
                    slots++;
                var bytes = slots * 1;
                var body_1 = Buffer.alloc(bytes - 4);
                libfs.readSync(fd, body_1, 0, body_1.length, null);
                var zeroes = body_1.slice(0, 0 + 32);
                var xing = body_1.slice(32, 32 + 4);
                if (xing.toString('binary') === 'Xing') {
                    var flags = body_1.slice(36, 36 + 4);
                    var has_quality = ((flags[3] & 0x08) >> 3);
                    var has_toc = ((flags[3] & 0x04) >> 2);
                    var has_bytes = ((flags[3] & 0x02) >> 1);
                    var has_frames = ((flags[3] & 0x01) >> 0);
                    offset = 40;
                    if (has_frames) {
                        var num_frames = body_1.readUInt32BE(offset);
                        offset += 4;
                        tag.duration = ((num_frames * 1152 / 44100) * 1000) | 0;
                    }
                    if (has_bytes) {
                        var num_bytes = body_1.readUInt32BE(offset);
                        offset += 4;
                    }
                    if (has_toc) {
                        offset += 100;
                    }
                    if (has_quality) {
                        var quality = body_1.readUInt32BE(offset);
                        offset += 4;
                    }
                }
            }
        }
        return tag;
    };
    var get_id_for = function (string) {
        var hash = libcrypto.createHash('md5');
        hash.update(string);
        return hash.digest('hex');
    };
    var visit_audio = function (node) {
        var tag = read_id3v24_tag(node);
        var nodes = node.split(libpath.sep);
        var file_id = get_id_for("" + nodes.join(':'));
        add_file({
            file_id: file_id,
            path: nodes,
            mime: 'audio/mp3'
        });
        if (tag.album_artist_name !== null && tag.album_name !== null && tag.year !== null && tag.disc !== null && tag.track !== null && tag.track_title !== null) {
            var album_id = get_id_for(tag.album_artist_name + ":" + tag.album_name + ":" + tag.year);
            add_album({
                album_id: album_id,
                title: tag.album_name,
                year: tag.year,
                cover_file_id: null
            });
            var album_artist_id = get_id_for("" + tag.album_artist_name);
            add_artist({
                artist_id: album_artist_id,
                title: tag.album_artist_name
            });
            add_album_artist({
                album_id: album_id,
                artist_id: album_artist_id
            });
            var disc_id = get_id_for(tag.album_artist_name + ":" + tag.album_name + ":" + tag.year + ":" + tag.disc);
            add_disc({
                disc_id: disc_id,
                album_id: album_id,
                number: tag.disc
            });
            var track_id = get_id_for(tag.album_artist_name + ":" + tag.album_name + ":" + tag.year + ":" + tag.disc + ":" + tag.track);
            add_track({
                track_id: track_id,
                disc_id: disc_id,
                file_id: file_id,
                title: tag.track_title,
                number: tag.track,
                duration: tag.duration
            });
            if (tag.track_artist_name !== null) {
                var track_artist_id = get_id_for("" + tag.track_artist_name);
                add_artist({
                    artist_id: track_artist_id,
                    title: tag.track_artist_name
                });
                add_track_artist({
                    track_id: track_id,
                    artist_id: track_artist_id
                });
            }
        }
    };
    var decode_mp4_length = function (b) {
        return (b[0] * 256 * 256 * 256) + ((b[1] << 16) | (b[2] << 8) | (b[3] << 0));
    };
    var read_mp4_atom = function (fds) {
        var header = Buffer.alloc(8);
        fds.offset += libfs.readSync(fds.fd, header, 0, header.length, fds.offset);
        var length = decode_mp4_length(header.slice(0, 0 + 4));
        var kind = header.slice(4, 4 + 4).toString('binary');
        return { kind: kind, length: length };
    };
    var read_mp4_atom_body = function (fds, atom) {
        var body = Buffer.alloc(atom.length - 8);
        fds.offset += libfs.readSync(fds.fd, body, 0, body.length, fds.offset);
        return body;
    };
    var visit_atom = function (tag, fds, path, maxlength) {
        var length = 0;
        while (length < maxlength) {
            var atom = read_mp4_atom(fds);
            if (atom.length === 0) {
                break;
            }
            length += atom.length;
            if (path === '' && atom.kind === 'moov') {
                visit_atom(tag, fds, path + "." + atom.kind, atom.length);
            }
            else if (path === '.moov' && atom.kind === 'udta') {
                visit_atom(tag, fds, path + "." + atom.kind, atom.length);
            }
            else if (path === '.moov.udta' && atom.kind === 'meta') {
                fds.offset += 4;
                visit_atom(tag, fds, path + "." + atom.kind, atom.length);
            }
            else if (path === '.moov.udta.meta' && atom.kind === 'ilst') {
                visit_atom(tag, fds, path + "." + atom.kind, atom.length);
            }
            else if (path === '.moov' && atom.kind === 'mvhd') {
                var buffer = read_mp4_atom_body(fds, atom);
                var offset = 12;
                var ts = buffer.readUInt32BE(offset);
                offset += 4;
                var tsdur = buffer.readUInt32BE(offset);
                offset += 4;
                tag.duration = (tsdur / ts * 1000) | 0;
            }
            else if (path === '.moov.udta.meta.ilst') {
                if (atom.kind === 'tvsh') {
                    var buffer = read_mp4_atom_body(fds, atom);
                    tag.show = buffer.slice(16).toString();
                }
                else if (atom.kind === 'tven') {
                    var buffer = read_mp4_atom_body(fds, atom);
                    tag.title = buffer.slice(16).toString();
                }
                else if (atom.kind === 'tves') {
                    var buffer = read_mp4_atom_body(fds, atom);
                    tag.episode = decode_mp4_length(buffer.slice(16));
                }
                else if (atom.kind === 'tvsn') {
                    var buffer = read_mp4_atom_body(fds, atom);
                    tag.season = decode_mp4_length(buffer.slice(16));
                }
                else if (atom.kind === '\u00A9nam') {
                    var buffer = read_mp4_atom_body(fds, atom);
                    tag.title = buffer.slice(16).toString();
                }
                else if (atom.kind === '\u00A9day') {
                    var buffer = read_mp4_atom_body(fds, atom);
                    tag.year = parseInt(buffer.slice(16).toString());
                }
                else {
                    fds.offset += atom.length - 8;
                }
            }
            else {
                fds.offset += atom.length - 8;
            }
        }
    };
    var read_mp4_tag = function (file) {
        var fds = {
            fd: libfs.openSync(file, 'r'),
            offset: 0
        };
        var header = read_mp4_atom(fds);
        if (header.kind !== 'ftyp' || header.length !== 32) {
            throw new Error();
        }
        read_mp4_atom_body(fds, header);
        var tag = {
            show: null,
            season: null,
            episode: null,
            title: null,
            year: null,
            duration: 0
        };
        visit_atom(tag, fds, '', header.length);
        return tag;
    };
    var visit_video = function (node) {
        var tag = read_mp4_tag(node);
        var nodes = node.split(libpath.sep);
        var file_id = get_id_for("" + nodes.join(':'));
        add_file({
            file_id: file_id,
            path: nodes,
            mime: 'video/mp4'
        });
        if (tag.show !== null && tag.season !== null && tag.episode !== null && tag.title !== null) {
            var show_id = get_id_for("" + tag.show);
            var season_id = get_id_for(tag.show + ":" + tag.season);
            var episode_id = get_id_for(tag.show + ":" + tag.season + ":" + tag.episode);
            add_show({
                show_id: show_id,
                title: tag.show
            });
            add_season({
                season_id: season_id,
                show_id: show_id,
                number: tag.season
            });
            add_episode({
                episode_id: episode_id,
                season_id: season_id,
                file_id: file_id,
                title: tag.title,
                number: tag.episode,
                duration: tag.duration
            });
            return;
        }
        if (tag.title !== null && tag.year !== null) {
            var movie_id = get_id_for(tag.title + ":" + tag.year);
            add_movie({
                movie_id: movie_id,
                file_id: file_id,
                title: tag.title,
                year: tag.year,
                duration: tag.duration
            });
            return;
        }
    };
    var parse_png = function (node) {
        var fds = {
            fd: libfs.openSync(node, 'r'),
            offset: 0
        };
        var buffer = Buffer.alloc(8);
        fds.offset += libfs.readSync(fds.fd, buffer, 0, buffer.length, fds.offset);
        if (buffer.toString('binary') !== '\u0089PNG\u000D\u000A\u001A\u000A') {
            throw new Error();
        }
        var nodes = node.split(libpath.sep);
        var file_id = get_id_for("" + nodes.join(':'));
        add_file({
            file_id: file_id,
            path: nodes,
            mime: 'image/png'
        });
    };
    var parse_jpeg = function (node) {
        var fds = {
            fd: libfs.openSync(node, 'r'),
            offset: 0
        };
        var buffer = Buffer.alloc(10);
        fds.offset += libfs.readSync(fds.fd, buffer, 0, buffer.length, fds.offset);
        if (buffer.toString('binary') !== '\u00FF\u00D8\u00FF\u00E0\u0000\u0010JFIF') {
            throw new Error();
        }
        var nodes = node.split(libpath.sep);
        var file_id = get_id_for("" + nodes.join(':'));
        add_file({
            file_id: file_id,
            path: nodes,
            mime: 'image/jpeg'
        });
    };
    var parse_vtt = function (node) {
        var fds = {
            fd: libfs.openSync(node, 'r'),
            offset: 0
        };
        var buffer = Buffer.alloc(1024);
        fds.offset += libfs.readSync(fds.fd, buffer, 0, buffer.length, fds.offset);
        var str = buffer.toString('utf8');
        var lines = str.split('\r\n').reduce(function (lines, line) {
            lines.push.apply(lines, line.split('\n'));
            return lines;
        }, new Array());
        if (lines[0].substr(0, 6) !== 'WEBVTT') {
            throw new Error();
        }
        var metadata = lines[0].substr(7);
        var nodes = node.split(libpath.sep);
        var file_id = get_id_for("" + nodes.join(':'));
        add_file({
            file_id: file_id,
            path: nodes,
            mime: 'text/vtt'
        });
    };
    var visit_image = function (node) {
        try {
            return parse_png(node);
        }
        catch (error) { }
        try {
            return parse_jpeg(node);
        }
        catch (error) { }
        throw new Error();
    };
    var visit_subtitle = function (node) {
        try {
            return parse_vtt(node);
        }
        catch (error) { }
        throw new Error();
    };
    var visit = function (node) {
        var stat = libfs.statSync(node);
        if (stat.isDirectory()) {
            libfs.readdirSync(node).map(function (subnode) {
                return libpath.join(node, subnode);
            }).map(visit);
        }
        else if (stat.isFile()) {
            try {
                return visit_audio(node);
            }
            catch (error) { }
            try {
                return visit_video(node);
            }
            catch (error) { }
            try {
                return visit_subtitle(node);
            }
            catch (error) { }
            try {
                return visit_image(node);
            }
            catch (error) { }
        }
    };
    visit(media_root);
    var image_files = db.files.filter(function (im) { return /^image[/]/.test(im.mime); });
    db.audio.tracks.forEach(function (track) {
        var track_file = files_index[track.file_id];
        if (track_file === undefined) {
            return;
        }
        var _loop_1 = function (i) {
            var path = track_file.path[i];
            var image_file = image_files.find(function (im) { return im.path.slice(-1)[0].split('.')[0] === path; });
            if (image_file !== undefined) {
                var disc = discs_index[track.disc_id];
                if (disc === undefined) {
                    return "continue";
                }
                var album = albums_index[disc.album_id];
                if (album === undefined) {
                    return "continue";
                }
                album.cover_file_id = image_file.file_id;
                return "break";
            }
        };
        for (var i = track_file.path.length - 2; i >= 0; i--) {
            var state_1 = _loop_1(i);
            if (state_1 === "break")
                break;
        }
    });
    var vtt_files = db.files.filter(function (file) { return /^text[/]vtt$/.test(file.mime); });
    db.video.episodes.forEach(function (episode) {
        var episode_file = files_index[episode.file_id];
        if (episode_file === undefined) {
            return;
        }
        var filename = episode_file.path[episode_file.path.length - 1];
        var basename = filename.split('.').slice(0, -1).join('.');
        for (var i = 0; i < vtt_files.length; i++) {
            var vttbasename = vtt_files[i].path[vtt_files[i].path.length - 1].split('.')[0];
            if (basename === vttbasename) {
                var subtitle_id = get_id_for(vtt_files[i].file_id);
                add_subtitle({
                    subtitle_id: subtitle_id,
                    episode_id: episode.episode_id,
                    movie_id: null,
                    file_id: vtt_files[i].file_id,
                    language: null
                });
            }
        }
    });
    db.video.movies.forEach(function (movie) {
        var movie_file = files_index[movie.file_id];
        if (movie_file === undefined) {
            return;
        }
        var filename = movie_file.path[movie_file.path.length - 1];
        var basename = filename.split('.').slice(0, -1).join('.');
        for (var i = 0; i < vtt_files.length; i++) {
            var vttbasename = vtt_files[i].path[vtt_files[i].path.length - 1].split('.')[0];
            if (basename === vttbasename) {
                var subtitle_id = get_id_for(vtt_files[i].file_id);
                add_subtitle({
                    subtitle_id: subtitle_id,
                    episode_id: null,
                    movie_id: movie.movie_id,
                    file_id: vtt_files[i].file_id,
                    language: null
                });
            }
        }
    });
    console.log(JSON.stringify(db, null, "\t"));
});
