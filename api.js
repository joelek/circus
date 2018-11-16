let media = require('../store/media.json');
let cc = require('./cc.js');
let auth = require('./auth.js');
let lists = require('../store/lists.json');

let tracks_index = {};

for (let i = 0; i < media.audio.tracks.length; i++) {
  let track = media.audio.tracks[i];
  tracks_index[track.track_id] = track;
}

let discs_index = {};

for (let i = 0; i < media.audio.discs.length; i++) {
  let disc = media.audio.discs[i];
  discs_index[disc.disc_id] = disc;
}

let albums_index = {};

for (let i = 0; i < media.audio.albums.length; i++) {
  let album = media.audio.albums[i];
  albums_index[album.album_id] = album;
}

let artists_index = {};

for (let i = 0; i < media.audio.artists.length; i++) {
  let artist = media.audio.artists[i];
  artists_index[artist.artist_id] = artist;
}

let album_artists_index = {};

for (let i = 0; i < media.audio.album_artists.length; i++) {
  let album_artist = media.audio.album_artists[i];
  let artists = album_artists_index[album_artist.album_id];
  if (artists === undefined) {
    artists = new Array();
    album_artists_index[album_artist.album_id] = artists;
  }
  artists.push(album_artist.artist_id);
}

let artist_albums_index = {};

for (let i = 0; i < media.audio.album_artists.length; i++) {
  let album_artist = media.audio.album_artists[i];
  let albums = artist_albums_index[album_artist.artist_id];
  if (albums === undefined) {
    albums = new Array();
    artist_albums_index[album_artist.artist_id] = albums;
  }
  albums.push(album_artist.album_id);
}

let track_artists_index = {};

for (let i = 0; i < media.audio.track_artists.length; i++) {
  let track_artist = media.audio.track_artists[i];
  let artists = track_artists_index[track_artist.track_id];
  if (artists === undefined) {
    artists = new Array();
    track_artists_index[track_artist.track_id] = artists;
  }
  artists.push(track_artist.artist_id);
}

let artist_tracks_index = {};

for (let i = 0; i < media.audio.track_artists.length; i++) {
  let track_artist = media.audio.track_artists[i];
  let tracks = artist_tracks_index[track_artist.artist_id];
  if (tracks === undefined) {
    tracks = new Array();
    artist_tracks_index[track_artist.artist_id] = tracks;
  }
  tracks.push(track_artist.track_id);
}



class Route {
  constructor() {

  }
}

class Router {
  constructor() {
    this.routes = new Array();
  }

  registerRoute(route) {
    this.routes.push(route);
    return this;
  }

  route(request, response) {
    for (let route of this.routes) {
      if (route.handlesRequest(request)) {
        return route.handleRequest(request, response);
      }
    }
    response.writeHead(400);
    response.end('{}');
  }
}

class ArtistRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let parts = /^\/api\/audio\/artists\/([0-9a-f]{32})\//.exec(request.url);
    let payload = media.audio.artists.find((artist) => {
      return artist.artist_id === parts[1];
    });
    payload = { ...payload };
    let album_artists = media.audio.album_artists.filter((album_artist) => {
      return album_artist.artist_id === parts[1];
    });
    payload.albums = media.audio.albums.filter((album) => {
      return album_artists.find((album_artist) => {
        return album.album_id === album_artist.album_id;
      }) !== undefined;
    });
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^\/api\/audio\/artists\/([0-9a-f]{32})\//.test(request.url);
  }
}
class ArtistsRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let payload = {
      artists: []
    };
    for (let artist of media.audio.artists) {
      payload.artists.push({ ...artist });
    }
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^\/api\/audio\/artists\//.test(request.url);
  }
}

class AlbumRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let parts = /^\/api\/audio\/albums\/([0-9a-f]{32})\//.exec(request.url);
    let payload = media.audio.albums.find((album) => {
      return album.album_id === parts[1];
    });
    payload = { ...payload };
    payload.discs = media.audio.discs.filter((disc) => {
      return disc.album_id === parts[1];
    }).map((disc) => {
      disc = {...disc};
      disc.tracks = media.audio.tracks.filter((track) => {
        return track.disc_id === disc.disc_id;
      });
      return disc;
    });
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^\/api\/audio\/albums\/([0-9a-f]{32})\//.test(request.url);
  }
}
class AlbumsRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let payload = {
      albums: []
    };
    for (let album of media.audio.albums) {
      payload.albums.push({ ...album });
    }
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^\/api\/audio\/albums\//.test(request.url);
  }
}
class CCRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let rbody = '';
    request.on('data', (chunk) => {
      rbody += chunk;
    }).on('end', () => {
      try {
        let body = JSON.parse(rbody);
        if (/^[/]api[/]cc[/]seek[/]/.test(request.url)) {
          return cc.seek(body, () => {
            let payload = {};
            response.writeHead(200);
            response.end(JSON.stringify(payload));
          });
        }
        if (/^[/]api[/]cc[/]pause[/]/.test(request.url)) {
          return cc.pause(body, () => {
            let payload = {};
            response.writeHead(200);
            response.end(JSON.stringify(payload));
          });
        }
        if (/^[/]api[/]cc[/]resume[/]/.test(request.url)) {
          return cc.resume(body, () => {
            let payload = {};
            response.writeHead(200);
            response.end(JSON.stringify(payload));
          });
        }
        if (/^[/]api[/]cc[/]load[/]/.test(request.url)) {
          return cc.load(body, () => {
            let payload = {};
            response.writeHead(200);
            response.end(JSON.stringify(payload));
          });
        }
      } catch (error) { console.log(error); }
      response.writeHead(400);
      response.end(JSON.stringify({}));
    });
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^\/api\/cc\//.test(request.url);
  }
}
class ShowRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let parts = /^[/]api[/]video[/]shows[/]([0-9a-f]{32})[/]/.exec(request.url);
    let payload = media.video.shows.find(show => show.show_id === parts[1]);
    payload = { ...payload };
    payload.seasons = media.video.seasons.filter(season => season.show_id === parts[1]).map(season => {
      season = { ...season };
      season.episodes = media.video.episodes.filter((ep) => ep.season_id === season.season_id).map(ep => ({...ep}));
      season.episodes.forEach((ep) => {
        ep.subtitles = media.video.subtitles.filter(st => st.episode_id === ep.episode_id);
      });
      return season;
    });
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^[/]api[/]video[/]shows[/]([0-9a-f]{32})[/]/.test(request.url);
  }
}

class ShowsRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let payload = {
      shows: []
    };
    for (let show of media.video.shows) {
      payload.shows.push({ ...show });
    }
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^[/]api[/]video[/]shows[/]/.test(request.url);
  }
}

class AuthWithTokenRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let parts = /^[/]api[/]auth[/][?]token[=]([0-9a-f]{64})/.exec(request.url);
    try {
      auth.getUsername(parts[1]);
      response.writeHead(200);
      return response.end(JSON.stringify({}));
    } catch (error) {}
    response.writeHead(401);
    return response.end(JSON.stringify({}));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^[/]api[/]auth[/][?]token[=]([0-9a-f]{64})/.test(request.url);
  }
}

class AuthRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    }).on('end', () => {
      try {
        body = JSON.parse(body);
        if (body == null || body.constructor !== Object) {
          throw new Error();
        }
        let username = body.username;
        if (username == null || username.constructor !== String) {
          throw new Error();
        }
        let password = body.password;
        if (password == null || password.constructor !== String) {
          throw new Error();
        }
        let payload = {
          token: auth.getToken(username, password)
        };
        response.writeHead(200);
        response.end(JSON.stringify(payload));
      } catch (error) {
        response.writeHead(400);
        response.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^[/]api[/]auth[/]/.test(request.url);
  }
}

class MovieRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let parts = /^[/]api[/]video[/]movies[/]([0-9a-f]{32})[/]/.exec(request.url);
    let payload = media.video.movies.find(movie => movie.movie_id === parts[1]);
    payload = { ...payload };
    payload.subtitles = media.video.subtitles.filter(st => st.movie_id === parts[1]);
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^[/]api[/]video[/]movies[/]([0-9a-f]{32})[/]/.test(request.url);
  }
}

class MoviesRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let payload = {
      movies: []
    };
    for (let movie of media.video.movies) {
      payload.movies.push({ ...movie });
    }
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^[/]api[/]video[/]movies[/]/.test(request.url);
  }
}

class AudiolistRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let parts = /^[/]api[/]audio[/]lists[/]([0-9a-f]{32})[/]/.exec(request.url);
    let payload = lists.audiolists.find(audiolist => audiolist.audiolist_id === parts[1]);
    payload = { ...payload };
    payload.items = lists.audiolist_items.filter((it) => it.audiolist_id === parts[1]).map(it => ({...it}));
    payload.items.map((item) => {
      item.track = {
        ...tracks_index[item.track_id],
        artists: new Array(track_artists_index[item.track_id])
      };
      item.track.disc = {
        ...discs_index[item.track.disc_id],
      };
      item.track.disc.album = {
        ...albums_index[item.track.disc.album_id],
      };
    });
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^[/]api[/]audio[/]lists[/]([0-9a-f]{32})[/]/.test(request.url);
  }
}

class AudiolistsRoute extends Route {
  constructor() {
    super();
  }

  handleRequest(request, response) {
    let payload = {
      audiolists: []
    };
    for (let audiolist of lists.audiolists) {
      payload.audiolists.push({ ...audiolist });
    }
    response.writeHead(200);
    response.end(JSON.stringify(payload));
  }

  handlesRequest(request) {
    return request.method === 'POST' && /^[/]api[/]audio[/]lists[/]/.test(request.url);
  }
}

let router = new Router()
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

module.exports = (request, response) => {
  try {
    router.route(request, response);
  } catch (error) {
    response.writeHead(500);
    response.end(JSON.stringify({ error: error.message }));
  }
};
