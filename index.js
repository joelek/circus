let crypto = require('crypto');
let fs = require('fs');
let path = require('path');

let media_root = './private/media/';

let db = {
  audio: {
    artists: [],
    albums: [],
    discs: [],
    tracks: [],
    album_artists: [],
    track_artists: []
  },
  video: {
    movies: [],
    shows: [],
    seasons: [],
    episodes: [],
    subtitles: []
  },
  files: []
};

let movies_index = {};
let shows_index = {};
let seasons_index = {};
let episodes_index = {};

let artists_index = {};
let albums_index = {};
let discs_index = {};
let tracks_index = {};
let album_artists_index = {};
let track_artists_index = {};

let files_index = {};

let add_movie = (movie) => {
  if (!(movie.movie_id in movies_index)) {
    movies_index[movie.movie_id] = movie;
    db.video.movies.push(movie);
  }
};

let add_show = (show) => {
  if (!(show.show_id in shows_index)) {
    shows_index[show.show_id] = show;
    db.video.shows.push(show);
  }
};

let add_season = (season) => {
  if (!(season.season_id in seasons_index)) {
    seasons_index[season.season_id] = season;
    db.video.seasons.push(season);
  }
};

let add_episode = (episode) => {
  if (!(episode.episode_id in episodes_index)) {
    episodes_index[episode.episode_id] = episode;
    db.video.episodes.push(episode);
  }
};

let add_artist = (artist) => {
  if (!(artist.artist_id in artists_index)) {
    artists_index[artist.artist_id] = artist;
    db.audio.artists.push(artist);
  }
};

let add_album = (album) => {
  if (!(album.album_id in albums_index)) {
    albums_index[album.album_id] = album;
    db.audio.albums.push(album);
  }
};

let add_disc = (disc) => {
  if (!(disc.disc_id in discs_index)) {
    discs_index[disc.disc_id] = disc;
    db.audio.discs.push(disc);
  }
};

let add_track = (track) => {
  if (!(track.track_id in tracks_index)) {
    tracks_index[track.track_id] = track;
    db.audio.tracks.push(track);
  }
};

let add_album_artist = (album_artist) => {
  if (!(album_artist.album_id in album_artists_index)) {
    album_artists_index[album_artist.album_id] = [];
  }
  if (album_artists_index[album_artist.album_id].indexOf(album_artist.artist_id) === -1) {
    album_artists_index[album_artist.album_id].push(album_artist.artist_id);
    db.audio.album_artists.push(album_artist);
  }
};

let add_track_artist = (track_artist) => {
  if (!(track_artist.track_id in track_artists_index)) {
    track_artists_index[track_artist.track_id] = [];
  }
  if (track_artists_index[track_artist.track_id].indexOf(track_artist.artist_id) === -1) {
    track_artists_index[track_artist.track_id].push(track_artist.artist_id);
    db.audio.track_artists.push(track_artist);
  }
};

let add_subtitle = (subtitle) => {
  db.video.subtitles.push(subtitle);
};

let add_file = (file) => {
  if (!(file.file_id in files_index)) {
    files_index[file.file_id] = file;
    db.files.push(file);
  }
};

let decode_id3v24_synchsafe_integer = (b) => {
  return ((b[0] & 0x7F) << 21) | ((b[1] & 0x7F) << 14) | ((b[2] & 0x7F) << 7) | ((b[3] & 0x7F) << 0);
};

let read_id3v24_tag = (file) => {
  let fd = fs.openSync(file, 'r');
  let headerid3 = Buffer.alloc(10);
  fs.readSync(fd, headerid3, 0, headerid3.length, null);
  if (headerid3.slice(0, 5).toString() !== 'ID3\4\0') {
    throw new Error();
  }
  let length = decode_id3v24_synchsafe_integer(headerid3.slice(6, 6 + 4));
  let body = Buffer.alloc(length);
  fs.readSync(fd, body, 0, body.length, null);
  let tag = {
    track_title: null,
    album_name: null,
    year: null,
    track: null,
    tracks: null,
    disc: null,
    discs: null,
    track_artist_name: null,
    album_artist_name: null,
    duration: null
  };
  let offset = 0;
  while (offset < body.length) {
    let frame_id = body.slice(offset, offset + 4).toString();
    let length = decode_id3v24_synchsafe_integer(body.slice(offset + 4, offset + 4 + 4));
    let flags = body.slice(offset + 8, offset + 8 + 2);
    let data = body.slice(offset + 10, offset + 10 + length);
    offset += 10 + length;
    if (frame_id === '\0\0\0\0') {
      break;
    } else if (frame_id === 'TIT2') {
      tag.track_title = data.slice(1, -1).toString();
    } else if (frame_id === 'TALB') {
      tag.album_name = data.slice(1, -1).toString();
    } else if (frame_id === 'TDRC') {
      let string = data.slice(1, -1).toString();
      let parts = /^([0-9]{4})$/.exec(string);
      if (parts !== null) {
        tag.year = parseInt(parts[1]);
      }
    } else if (frame_id === 'TRCK') {
      let string = data.slice(1, -1).toString();
      let parts = /^([0-9]{2})\/([0-9]{2})$/.exec(string);
      if (parts !== null) {
        tag.track = parseInt(parts[1]);
        tag.tracks = parseInt(parts[2]);
      }
    } else if (frame_id === 'TPOS') {
      let string = data.slice(1, -1).toString();
      let parts = /^([0-9]{2})\/([0-9]{2})$/.exec(string);
      if (parts !== null) {
        tag.disc = parseInt(parts[1]);
        tag.discs = parseInt(parts[2]);
      }
    } else if (frame_id === 'TPE1') {
      tag.track_artist_name = data.slice(1, -1).toString();
    } else if (frame_id === 'TPE2') {
      tag.album_artist_name = data.slice(1, -1).toString();
    } else if (frame_id === 'TXXX') {
      let string = data.slice(1, -1).toString();
      let parts = /^ALBUM ARTIST\0(.+)$/.exec(string);
      if (parts !== null) {
        tag.album_artist_name = parts[1];
      }
    }
  }
  let header = Buffer.alloc(4);
  fs.readSync(fd, header, 0, header.length, null);
  let sync = ((header[0] & 0xFF) << 3) | ((header[1] & 0xE0) >> 5);
  let version = ((header[1] & 0x18) >> 3);
  let layer = ((header[1] & 0x06) >> 1);
  let skip_crc = ((header[1] & 0x01) >> 0);
  let bitrate = ((header[2] & 0xF0) >> 4);
  let sample_rate = ((header[2] & 0x0C) >> 2);
  let padded = ((header[2] & 0x02) >> 1);
  let private = ((header[2] & 0x01) >> 0);
  let channels = ((header[3] & 0xC0) >> 6);
  let modext = ((header[3] & 0x30) >> 4);
  let copyrighted = ((header[3] & 0x08) >> 3);
  let original = ((header[3] & 0x04) >> 2);
  let emphasis = ((header[3] & 0x03) >> 0);
  if (sync === 0x07FF && version === 3 && layer === 1) {
    let samples_per_frame = 1152;
    if (bitrate === 9 && sample_rate === 0) {
      let slots = (samples_per_frame * 128000 / 8 / 44100) | 0;
      if (padded) slots++;
      let bytes = slots * 1;
      let body = Buffer.alloc(bytes - 4);
      fs.readSync(fd, body, 0, body.length, null);
      let zeroes = body.slice(0, 0 + 32);
      let xing = body.slice(32, 32 + 4);
      if (xing.toString('binary') === 'Xing') {
        let flags = body.slice(36, 36 + 4);
        let has_quality = ((flags[3] & 0x08) >> 3);
        let has_toc = ((flags[3] & 0x04) >> 2);
        let has_bytes = ((flags[3] & 0x02) >> 1);
        let has_frames = ((flags[3] & 0x01) >> 0);
        offset = 40;
        if (has_frames) {
          let num_frames = body.readUInt32BE(offset); offset += 4;
          tag.duration = ((num_frames * 1152 / 44100) * 1000) | 0;
        }
        if (has_bytes) {
          let num_bytes = body.readUInt32BE(offset); offset += 4;
        }
        if (has_toc) {
          offset += 100;
        }
        if (has_quality) {
          let quality = body.readUInt32BE(offset); offset += 4;
        }
      }
    }
  }
  return tag;
};

let get_id_for = (string) => {
  const hash = crypto.createHash('md5');
  hash.update(string);
  return hash.digest('hex');
};

let visit_audio = (node) => {
  let tag = read_id3v24_tag(node);
  node = node.split(path.sep);
  let file_id = get_id_for(`${node.join(':')}`);
  let album_artist_id = get_id_for(`${tag.album_artist_name}`);
  let track_artist_id = get_id_for(`${tag.track_artist_name}`);
  let album_id = get_id_for(`${tag.album_artist_name}:${tag.album_name}:${tag.year}`);
  let disc_id = get_id_for(`${tag.album_artist_name}:${tag.album_name}:${tag.year}:${tag.disc}`);
  let track_id = get_id_for(`${tag.album_artist_name}:${tag.album_name}:${tag.year}:${tag.disc}:${tag.track}`);
  add_artist({
    artist_id: album_artist_id,
    title: tag.album_artist_name
  });
  add_artist({
    artist_id: track_artist_id,
    title: tag.track_artist_name
  });
  add_album({
    album_id: album_id,
    title: tag.album_name,
    year: tag.year,
    cover_file_id: null
  });
  add_disc({
    disc_id: disc_id,
    album_id: album_id,
    number: tag.disc
  });
  add_track({
    track_id: track_id,
    disc_id: disc_id,
    file_id: file_id,
    title: tag.track_title,
    number: tag.track,
    duration: tag.duration
  });
  add_album_artist({
    album_id: album_id,
    artist_id: album_artist_id
  });
  add_track_artist({
    track_id: track_id,
    artist_id: track_artist_id
  });
  add_file({
    file_id: file_id,
    path: node,
    mime: 'audio/mp3'
  });
};

let decode_mp4_length = (b) => {
  return (b[0] * 256*256*256) + ((b[1] << 16) | (b[2] << 8) | (b[3] << 0));
};

let read_mp4_atom = (fds) => {
  let header = Buffer.alloc(8);
  fds.offset += fs.readSync(fds.fd, header, 0, header.length, fds.offset);
  let length = decode_mp4_length(header.slice(0, 0 + 4));
  let kind = header.slice(4, 4 + 4).toString('binary');
  return { kind, length };
};

let read_mp4_atom_body = (fds, atom) => {
  let body = Buffer.alloc(atom.length - 8);
  fds.offset += fs.readSync(fds.fd, body, 0, body.length, fds.offset);
  return body;
};

let visit_atom = (tag, fds, path, maxlength) => {
  let length = 0;
  while (length < maxlength) {
    let atom = read_mp4_atom(fds);
    if (atom.length === 0) {
      break;
    }
    length += atom.length;
    if (path === '' && atom.kind === 'moov') {
      visit_atom(tag, fds, `${path}.${atom.kind}`, atom.length);
    } else if (path === '.moov' && atom.kind === 'udta') {
      visit_atom(tag, fds, `${path}.${atom.kind}`, atom.length);
    } else if (path === '.moov.udta' && atom.kind === 'meta') {
      fds.offset += 4;
      visit_atom(tag, fds, `${path}.${atom.kind}`, atom.length);
    } else if (path === '.moov.udta.meta' && atom.kind === 'ilst') {
      visit_atom(tag, fds, `${path}.${atom.kind}`, atom.length);
    } else if (path === '.moov' && atom.kind === 'mvhd') {
      let buffer = read_mp4_atom_body(fds, atom);
      let offset = 12;
      let ts = buffer.readUInt32BE(offset); offset += 4;
      let tsdur = buffer.readUInt32BE(offset); offset += 4;
      tag.duration = (tsdur / ts * 1000) | 0;
    } else if (path === '.moov.udta.meta.ilst') {
      if (atom.kind === 'tvsh') {
        let buffer = read_mp4_atom_body(fds, atom);
        tag.show = buffer.slice(16).toString();
      } else if (atom.kind === 'tven') {
        let buffer = read_mp4_atom_body(fds, atom);
        tag.title = buffer.slice(16).toString();
      } else if (atom.kind === 'tves') {
        let buffer = read_mp4_atom_body(fds, atom);
        tag.episode = decode_mp4_length(buffer.slice(16));
      } else if (atom.kind === 'tvsn') {
        let buffer = read_mp4_atom_body(fds, atom);
        tag.season = decode_mp4_length(buffer.slice(16));
      } else if (atom.kind === '\u00A9nam') {
        let buffer = read_mp4_atom_body(fds, atom);
        tag.title = buffer.slice(16).toString();
      } else if (atom.kind === '\u00A9day') {
        let buffer = read_mp4_atom_body(fds, atom);
        tag.year = parseInt(buffer.slice(16).toString());
      } else {
        fds.offset += atom.length - 8;
      }
    } else {
      fds.offset += atom.length - 8;
    }
  }
};

let read_mp4_tag = (file) => {
  let fds = {
    fd: fs.openSync(file, 'r'),
    offset: 0
  };
  let header = read_mp4_atom(fds);
  if (header.kind !== 'ftyp' || header.length !== 32) {
    throw new Error();
  }
  read_mp4_atom_body(fds, header);
  let tag = {
    show: null,
    season: null,
    episode: null,
    title: null,
    year: null,
    duration: null
  };
  visit_atom(tag, fds, '', header.length);
  return tag;
};

let visit_video = (node) => {
  let tag = read_mp4_tag(node);
  node = node.split(path.sep);
  let file_id = get_id_for(`${node.join(':')}`);
  add_file({
    file_id: file_id,
    path: node,
    mime: 'video/mp4'
  });
  if (tag.show === null || tag.season === null || tag.episode === null) {
    let movie_id = get_id_for(`${tag.title}:${tag.year}`);
    add_movie({
      movie_id: movie_id,
      file_id: file_id,
      title: tag.title,
      year: tag.year,
      duration: tag.duration
    });
    return;
  }
  let show_id = get_id_for(`${tag.show}`);
  let season_id = get_id_for(`${tag.show}:${tag.season}`);
  let episode_id = get_id_for(`${tag.show}:${tag.season}:${tag.episode}`);
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
};

let parse_png = (node) => {
  let fds = {
    fd: fs.openSync(node, 'r'),
    offset: 0
  };
  let buffer = Buffer.alloc(8);
  fds.offset += fs.readSync(fds.fd, buffer, 0, buffer.length, fds.offset);
  if (buffer.toString('binary') !== '\u0089PNG\u000D\u000A\u001A\u000A') {
    throw new Error();
  }
  node = node.split(path.sep);
  let file_id = get_id_for(`${node.join(':')}`);
  add_file({
    file_id: file_id,
    path: node,
    mime: 'image/png'
  });
};

let parse_jpeg = (node) => {
  let fds = {
    fd: fs.openSync(node, 'r'),
    offset: 0
  };
  let buffer = Buffer.alloc(10);
  fds.offset += fs.readSync(fds.fd, buffer, 0, buffer.length, fds.offset);
  if (buffer.toString('binary') !== '\u00FF\u00D8\u00FF\u00E0\u0000\u0010JFIF') {
    throw new Error();
  }
  node = node.split(path.sep);
  let file_id = get_id_for(`${node.join(':')}`);
  add_file({
    file_id: file_id,
    path: node,
    mime: 'image/jpeg'
  });
};

let parse_vtt = (node) => {
  let fds = {
    fd: fs.openSync(node, 'r'),
    offset: 0
  };
  let buffer = Buffer.alloc(1024);
  fds.offset += fs.readSync(fds.fd, buffer, 0, buffer.length, fds.offset);
  let str = buffer.toString('utf8');
  let lines = str.split('\r\n').reduce((lines, line) => {
    lines.push(...line.split('\n'));
    return lines;
  }, []);
  if (lines[0].substr(0, 6) !== 'WEBVTT') {
    throw new Error();
  }
  let metadata = lines[0].substr(7);
  node = node.split(path.sep);
  let file_id = get_id_for(`${node.join(':')}`);
  add_file({
    file_id: file_id,
    path: node,
    mime: 'text/vtt'
  });
};

let visit_image = (node) => {
  try {
    return parse_png(node);
  } catch (error) {}
  try {
    return parse_jpeg(node);
  } catch (error) {}
  throw new Error();
};

let visit_subtitle = (node) => {
  try {
    return parse_vtt(node);
  } catch (error) {}
  throw new Error();
};

let visit = (node) => {
  let stat = fs.statSync(node);
  if (stat.isDirectory()) {
    fs.readdirSync(node).map((subnode) => {
      return path.join(node, subnode);
    }).map(visit);
  } else if (stat.isFile()) {
    try {
      return visit_audio(node);
    } catch (error) {}
    try {
      return visit_video(node);
    } catch (error) {}
    try {
      return visit_subtitle(node);
    } catch (error) {}
    try {
      return visit_image(node);
    } catch (error) {}
  }
};

visit(media_root);

let image_files = db.files.filter(im => /^image[/]/.test(im.mime));

db.audio.tracks.forEach((track) => {
  let track_file = files_index[track.file_id];
  for (let i = track_file.path.length - 2; i >= 0; i--) {
    let path = track_file.path[i];
    let image_file = image_files.find((im) => im.path.slice(-1)[0].split('.')[0] === path);
    if (image_file) {
      let disc = discs_index[track.disc_id];
      let album = albums_index[disc.album_id];
      album.cover_file_id = image_file.file_id;
      break;
    }
  }
});

let vtt_files = db.files.filter(file => /^text[/]vtt$/.test(file.mime));

db.video.episodes.forEach((episode) => {
  let episode_file = files_index[episode.file_id];
  let filename = episode_file.path[episode_file.path.length-1];
  let basename = filename.split('.').slice(0, -1).join('.');
  for (let i = 0; i < vtt_files.length; i++) {
    let vttbasename = vtt_files[i].path[vtt_files[i].path.length-1].split('.')[0];
    if (basename === vttbasename) {
      add_subtitle({
        episode_id: episode.episode_id,
        movie_id: null,
        file_id: vtt_files[i].file_id
      });
    }
  }
});

db.video.movies.forEach((movie) => {
  let movie_file = files_index[movie.file_id];
  let filename = movie_file.path[movie_file.path.length-1];
  let basename = filename.split('.').slice(0, -1).join('.');
  for (let i = 0; i < vtt_files.length; i++) {
    let vttbasename = vtt_files[i].path[vtt_files[i].path.length-1].split('.')[0];
    if (basename === vttbasename) {
      add_subtitle({
        episode_id: null,
        movie_id: movie.movie_id,
        file_id: vtt_files[i].file_id
      });
    }
  }
});

console.log(JSON.stringify(db, null, 2));
