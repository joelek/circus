let libpath = require('path');
let libfs = require('fs');
let libhttps = require('https');

let get = (uri, cb) =>  {
  libhttps.get(uri, (response) => {
    response.setEncoding('binary');
    let chunks = [];
    response.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk, 'binary'));
    });
    response.on('end', () => {
      let buffer = Buffer.concat(chunks);
      cb(buffer);
    });
  });
};

let get_json = (query, cb) => {
  get(query, (buffer) => {
    cb(JSON.parse(buffer.toString()));
  });
};

let get_metadata = (title, year, cb) => {
  let query = `https://www.omdbapi.com/?type=movie&s=${title.split(' ').join('+')}&y=${year}&apikey=BanMePlz`;
  get_json(query, (json) => {
    if (!(json && json.Search && json.Search.length > 0)) {
      console.log(title, year, json);
      if (json.Error === 'Request limit reached!') {
        return cb(null);
      } else {
        return cb({ query });
      }
    }
    setTimeout(() => {
      let query = `https://www.omdbapi.com/?type=movie&i=${json.Search[0].imdbID}&apikey=BanMePlz`;
      get_json(query, cb);
    }, 5000);
  });
};

let get_poster = (metadata, cb) => {
  if (!metadata.Poster) {
    return cb(null);
  }
  let uri = metadata.Poster;
  let pathsegs = uri.split('/');
  let filename = pathsegs.pop();
  filename = filename.split('.')[0] + '.jpg';
  uri = [ ...pathsegs, filename ].join('/');
  get(uri, (buffer) => {
    cb(buffer);
  });
};

let scrape_data = () => {
  let cache = require('./private/db/metadata.json');
  let media = require('./private/db/media.json');
  let queue = media.video.movies.slice();
  let done = () => {
    let sorted = [];
    for (let key of Object.keys(cache)) {
      sorted.push({
        key: key,
        value: cache[key]
      });
    }
    sorted = sorted.sort((a, b) => {
      if (a.key < b.key) {
        return -1;
      }
      if (a.key > b.key) {
        return 1;
      }
      return 0;
    });
    let out = {};
    sorted.forEach((entry) => {
      out[entry.key] = entry.value;
    });
    let fd = libfs.openSync('./private/db/metadata.json', 'w');
    libfs.writeSync(fd, JSON.stringify(out, null, 2));
    libfs.closeSync(fd);
    process.exit(0);
  };
  let fetch_poster = (movie_id, metadata, cb) => {
    let filename = `../queue/image/posters/${movie_id}.jpg`;
    if (libfs.existsSync(filename)) {
      return cb();
    }
    get_poster(metadata, (buffer) => {
      let fd = libfs.openSync(filename, 'w');
      libfs.writeSync(fd, buffer);
      libfs.closeSync(fd);
      return cb();
    });
  };
  let handle_next = () => {
    if (queue.length === 0) {
      return done();
    }
    let index = (Math.random() * queue.length) | 0;
    let movie = queue.splice(index, 1)[0];
    let movie_id = movie.movie_id;
    let title = movie.title;
    let year = movie.year;
    if (cache[movie_id]) {
      return setTimeout(() => {
        fetch_poster(movie_id, cache[movie_id], handle_next);
      }, 5000);
    }
    get_metadata(title, year, (metadata) => {
      if (!metadata) {
        return done();
      }
      cache[movie_id] = metadata;
      return fetch_poster(movie_id, cache[movie_id], () => {
        setTimeout(handle_next, 5000);
      });
    });
  };
  handle_next();
};

if (process.argv[2] === 'scrape') {
  scrape_data();
}

exports.get_metadata = get_metadata;
exports.get_poster = get_poster;
