let style = document.createElement('style');
style.innerText = `
  * {
    border: none;
    margin: 0px;
    outline: none;
    padding: 0px;
  }

  html {
    height: 100%;
  }

  body {
    height: 100%;
  }

  body {
    overflow-y: scroll;
  }
`;
document.head.appendChild(style);

let format_duration = (ms) => {
  let s = (ms / 1000) | 0;
  let m = (s / 60) | 0;
  let h = (m / 60) | 0;
  if (h > 0) {
    m = `00${m % 60}`.slice(-2);
    s = `00${s % 60}`.slice(-2);
    return `${h}:${m}:${s}`;
  } else {
    s = `00${s % 60}`.slice(-2);
    return `${m}:${s}`;
  }
};
let req = (uri, body, cb) => {
  let xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', () => {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      cb(xhr.status, JSON.parse(xhr.responseText));
    }
  });
  xhr.open('POST', uri, true);
  xhr.send(JSON.stringify(body));
}
let token = localStorage.getItem('token');
let logincontainer = document.createElement('div');
document.body.appendChild(logincontainer);
req(`/api/auth/?token=${token}`, {}, (status, response) => {
  if (!(status >= 200 && status < 300)) {
    localStorage.removeItem('token');
    let cb = () => {
      req(`/api/auth/`, { username: username.value, password: password.value }, (status, response) => {
        if (response.token != null && response.token.constructor === String) {
          token = response.token;
          localStorage.setItem('token', token);
          username.parentNode.removeChild(username);
          password.parentNode.removeChild(password);
          login.parentNode.removeChild(login);
        }
      });
    };
    let username = document.createElement('input'); username.setAttribute('type', 'text');
    let password = document.createElement('input'); password.setAttribute('type', 'password');
    password.addEventListener('keyup', (event) => {
      if (event.keyCode === 13) {
        cb();
      }
    });
    let login = document.createElement('button'); login.textContent = 'Login';
    login.addEventListener('click', (event) => {
      cb();
    });
    logincontainer.appendChild(username);
    logincontainer.appendChild(password);
    logincontainer.appendChild(login);
  }
});

let video = document.createElement('video');
video.setAttribute('controls', '');
video.setAttribute('playsinline', '');
video.style.setProperty('width', '100%');
document.body.appendChild(video);
let ctrl = document.createElement('div');
document.body.appendChild(ctrl);
let context = null;
let metadata = null;
let context_index = null;
let ccload = document.createElement('button');
ccload.textContent = 'cast';
document.body.appendChild(ccload);
ccload.addEventListener('click', () => {
  video.pause();
  req(`/api/cc/load/`, { context, index: context_index, token: token }, (status, response) => {});
});
let ccpause = document.createElement('button');
ccpause.textContent = 'pause';
document.body.appendChild(ccpause);
ccpause.addEventListener('click', () => {
  req(`/api/cc/pause/`, { token: token }, (status, response) => {});
});
let ccresume = document.createElement('button');
ccresume.textContent = 'resume';
document.body.appendChild(ccresume);
ccresume.addEventListener('click', () => {
  req(`/api/cc/resume/`, { token: token }, (status, response) => {});
});
let ccseek = document.createElement('input');
ccseek.setAttribute('type', 'range');
document.body.appendChild(ccseek);
ccseek.addEventListener('change', () => {
  req(`/api/cc/seek/`, { percentage: ccseek.value, token: token }, (status, response) => {});
});
video.addEventListener('timeupdate', () => {
  ctrl.innerText = `${video.currentTime}`;
});
let next = () => {
  if (context_index >= 0 && context_index < context.files.length - 1) {
    play(context_index + 1);
  }
};
video.addEventListener('ended', () => {
  next();
});
let mount = document.createElement('div');
document.body.appendChild(mount);
let play = (index) => {
  let fid = context.files[index];
  video.src = `/files/${fid}/?token=${token}`;
  while (video.hasChildNodes()) {
    video.removeChild(video.lastChild);
  }
  if (metadata && metadata[fid]) {
    if (metadata[fid].subtitles) {
      for (let i = 0; i < metadata[fid].subtitles.length; i++) {
        let st = metadata[fid].subtitles[i];
        let e = document.createElement('track');
        e.src = `/files/${st.file_id}/?token=${token}`;
        video.appendChild(e);
      }
    }
  }
  video.play();
  context_index = index;
};
let set_context = (ctx) => {
  context = ctx;
};
let set_context_metadata = (md) => {
  metadata = md;
};
let get_route = (pathname = window.location.pathname, basehref = document.head.querySelector('base[href]').getAttribute('href')) => {
  let pn = pathname.split('/');
  let bh = basehref.split('/');
  let i = 0;
  while (i < pn.length && i < bh.length && pn[i] === bh[i]) {
    i++;
  }
  let uri = pn.slice(i).join('/');
  //return uri === '' ? './' : uri;
  return uri;
};
let updateviewforuri = (uri) => {
  while (mount.hasChildNodes()) {
    mount.removeChild(mount.lastChild);
  }
  let parts;
  if ((parts = /^audio[/]albums[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
    req(`/api/audio/albums/${parts[1]}/`, {}, (status, response) => {
      let a = document.createElement('div');
      a.style.setProperty('font-size', '24px');
      a.innerText = `${response.title}`;
      mount.appendChild(a);
      let wrap = document.createElement('div');
      let img = document.createElement('img');
      img.src = `/files/${response.cover_file_id}/?token=${token}`;
      img.style.setProperty('width', '100%');
      wrap.appendChild(img);
      mount.appendChild(wrap);
      let context = {
        files: response.discs.reduce((tracks, disc) => {
          tracks.push(...disc.tracks.map(track => track.file_id));
          return tracks;
        }, [])
      };
      for (let disc of response.discs) {
        let d = document.createElement('div');
        d.innerText = `${disc.number}`;
        mount.appendChild(d);
        for (let track of disc.tracks) {
          let x = document.createElement('div');
          x.innerText = `${track.title} ${format_duration(track.duration)}`;
          x.addEventListener('click', () => {
            set_context(context);
            play(context.files.indexOf(track.file_id));
          });
          mount.appendChild(x);
        }
      }

    });
  } else if ((parts = /^audio[/]albums[/]/.exec(uri)) !== null) {
    req(`/api/audio/albums/`, {}, (status, response) => {
      for (let album of response.albums) {
        let d = document.createElement('div');
        d.innerText = `${album.title}`;
        d.addEventListener('click', () => {
          navigate(`audio/albums/${album.album_id}/`);
        });
        mount.appendChild(d);
      }
    });
  } else if ((parts = /^audio[/]artists[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
    req(`/api/audio/artists/${parts[1]}/`, {}, (status, response) => {
      let a = document.createElement('div');
      a.style.setProperty('font-size', '24px');
      a.innerText = `${response.title}`;
      mount.appendChild(a);
      for (let album of response.albums) {
        let d = document.createElement('div');
        d.innerText = `${album.title}`;
        d.addEventListener('click', () => {
          navigate(`audio/albums/${album.album_id}/`);
        });
        mount.appendChild(d);
      }
    });
  } else if ((parts = /^audio[/]artists[/]/.exec(uri)) !== null) {
    req(`/api/audio/artists/`, {}, (status, response) => {
      for (let artist of response.artists) {
        let d = document.createElement('div');
        d.innerText = `${artist.title}`;
        d.addEventListener('click', () => {
          navigate(`audio/artists/${artist.artist_id}/`);
        });
        mount.appendChild(d);
      }
    });
  } else if ((parts = /^audio[/]lists[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
    req(`/api/audio/lists/${parts[1]}/`, {}, (status, response) => {
      let a = document.createElement('div');
      a.style.setProperty('font-size', '24px');
      a.innerText = `${response.title}`;
      mount.appendChild(a);
      let context = {
        files: response.items.map((item) => {
          return item.track.file_id;
        })
      };
      for (let item of response.items) {
        let d = document.createElement('div');
        d.innerText = `${item.track.title}`;
        d.addEventListener('click', () => {
          set_context(context);
          play(context.files.indexOf(item.track.file_id));
        });
        mount.appendChild(d);
      }
    });
  } else if ((parts = /^audio[/]lists[/]/.exec(uri)) !== null) {
    req(`/api/audio/lists/`, {}, (status, response) => {
      for (let list of response.audiolists) {
        let d = document.createElement('div');
        d.innerText = `${list.title}`;
        d.addEventListener('click', () => {
          navigate(`audio/lists/${list.audiolist_id}/`);
        });
        mount.appendChild(d);
      }
    });
  } else if ((parts = /^audio[/]/.exec(uri)) !== null) {
    let d = document.createElement('div');
    d.innerText = 'Artists';
    d.addEventListener('click', () => {
      navigate('audio/artists/');
    });
    mount.appendChild(d);
    let d2 = document.createElement('div');
    d2.innerText = 'Albums';
    d2.addEventListener('click', () => {
      navigate('audio/albums/');
    });
    mount.appendChild(d2);
    let d3 = document.createElement('div');
    d3.innerText = 'Lists';
    d3.addEventListener('click', () => {
      navigate('audio/lists/');
    });
    mount.appendChild(d3);
  } else if ((parts = /^video[/]shows[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
    req(`/api/video/shows/${parts[1]}/`, {}, (status, response) => {
      let d = document.createElement('div');
      d.innerText = `${response.title}`;
      d.style.setProperty('font-size', '24px');
      mount.appendChild(d);
      let context = {
        files: response.seasons.reduce((files, season) => {
          files.push(...season.episodes.map(episode => episode.file_id));
          return files;
        }, [])
      };
      let context_metadata = {};
      for (let season of response.seasons) {
        let d = document.createElement('div');
        d.innerText = `${season.number}`;
        mount.appendChild(d);
        for (let episode of season.episodes) {
          context_metadata[episode.file_id] = {
            subtitles: episode.subtitles
          };
          let d2 = document.createElement('div');
          d2.innerText = `${episode.title} ${format_duration(episode.duration)}`;
          d2.addEventListener('click', () => {
            set_context(context);
            set_context_metadata(context_metadata);
            play(context.files.indexOf(episode.file_id));
          });
          mount.appendChild(d2);
        }
      }
    });
  } else if ((parts = /^video[/]shows[/]/.exec(uri)) !== null) {
    req(`/api/video/shows/`, {}, (status, response) => {
      for (let show of response.shows) {
        let d = document.createElement('div');
        d.innerText = `${show.title}`;
        d.addEventListener('click', () => {
          navigate(`video/shows/${show.show_id}/`);
        });
        mount.appendChild(d);
      }
    });
  } else if ((parts = /^video[/]movies[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
    req(`/api/video/movies/${parts[1]}/`, {}, (status, response) => {
      let d = document.createElement('div');
      d.innerText = `${response.title} (${response.year})`;
      d.style.setProperty('font-size', '24px');
      mount.appendChild(d);
      let d2 = document.createElement('div');
      d2.innerText = format_duration(response.duration);
      mount.appendChild(d2);
      let context = {
        files: [ response.file_id ]
      };
      let context_metadata = {};
      context_metadata[response.file_id] = {
        subtitles: response.subtitles
      };
      let d3 = document.createElement('div');
      d3.innerText = `load`;
      d3.addEventListener('click', () => {
        set_context(context);
        set_context_metadata(context_metadata);
        play(context.files.indexOf(response.file_id));
      });
      mount.appendChild(d3);
    });
  } else if ((parts = /^video[/]movies[/]/.exec(uri)) !== null) {
    req(`/api/video/movies/`, {}, (status, response) => {
      for (let movie of response.movies) {
        let d = document.createElement('div');
        d.innerText = `${movie.title}`;
        d.addEventListener('click', () => {
          navigate(`video/movies/${movie.movie_id}/`);
        });
        mount.appendChild(d);
      }
    });
  } else if ((parts = /^video[/]/.exec(uri)) !== null) {
    let d = document.createElement('div');
    d.innerText = 'Shows';
    d.addEventListener('click', () => {
      navigate('video/shows/');
    });
    mount.appendChild(d);
    d = document.createElement('div');
    d.innerText = 'Movies';
    d.addEventListener('click', () => {
      navigate('video/movies/');
    });
    mount.appendChild(d);
  } else {
    let d = document.createElement('div');
    d.innerText = 'Audio';
    d.addEventListener('click', () => {
      navigate('audio/');
    });
    mount.appendChild(d);
    let v = document.createElement('div');
    v.innerText = 'Video';
    v.addEventListener('click', () => {
      navigate('video/');
    });
    mount.appendChild(v);
  }
};
let navigate = (uri) => {
  if (window.history.state === null) {
    window.history.replaceState({ 'uri': uri }, '', uri);
  } else {
    if (uri !== window.history.state.uri) {
      window.history.pushState({ 'uri': uri }, '', uri);
    }
  }
  updateviewforuri(uri);
};
navigate(get_route());
window.addEventListener('popstate', (event) => {
  navigate(event.state.uri);
});
