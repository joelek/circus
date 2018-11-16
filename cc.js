var Client                = require('castv2-client').Client;
var DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver;
var mDnsSd = require('node-dns-sd');

let gcontext = null;
let gindex = null;
let gmedia = null;
let gtoken = null;
let gplayer = null;

let media = require('../store/media.json');

let make_media_object = () => {
  if (gcontext === null || gindex === null) {
    return null;
  }
  let file = media.files.find((file) => file.file_id === gcontext.files[gindex]);
  if (!file) {
    return null;
  }
  let title = 'Title';
  let subtitle = 'Subtitle';
  let image = '';
  let track = media.audio.tracks.find(track => track.file_id === file.file_id);
  let sttracks = [];
  let langmap = {
    eng: 'en-US',
    swe: 'sv-SE'
  };
  let makesttrack = (s, i) => {
    return {
      trackId: i,
      type: 'TEXT',
      trackType: 'TEXT',
      trackContentId: `https://ap.joelek.se/files/${s.file_id}/?token=${gtoken}`,
      trackContentType: 'text/vtt',
      subtype: 'SUBTITLES',
      language: langmap[s.language] || 'en-US',
      name: null,
      customData: null
    };
  };
  if (track) {
    let disc = media.audio.discs.find(disc => disc.disc_id === track.disc_id);
    let album = media.audio.albums.find(album => album.album_id === disc.album_id);
    let track_artists = media.audio.track_artists.filter(track_artist => track_artist.track_id === track.track_id);
    let artists = media.audio.artists.filter(artist => track_artists.find(tr => tr.artist_id === artist.artist_id) !== undefined);
    title = track.title;
    subtitle = [ artists.map(ar => ar.title).join(', '), album.title ].join(' \u2022 ');
    image = `https://ap.joelek.se/files/${album.cover_file_id}/?token=${gtoken}`;
  } else {
    let episode = media.video.episodes.find(episode => episode.file_id === file.file_id);
    if (episode) {
      let season = media.video.seasons.find(season => season.season_id === episode.season_id);
      let show = media.video.shows.find(show => show.show_id === season.show_id);
      title = episode.title;
      subtitle = [ show.title, `s${season.number}e${episode.number}`].join(' \u2022 ');
      sttracks = media.video.subtitles.filter(st => st.episode_id === episode.episode_id).map(makesttrack);
    } else {
      let movie = media.video.movies.find(movie => movie.file_id === file.file_id);
      sttracks = media.video.subtitles.filter(st => st.movie_id === movie.movie_id).map(makesttrack);
      title = movie.title;
      subtitle = [].join(' \u2022 ');
    }
  }
  let preftrack = sttracks.find(s => s.language === 'sv-SE') || sttracks.find(s => s.language === 'en-US');
  let activeTrackIds = preftrack ? [ sttracks[sttracks.indexOf(preftrack)].trackId ] : [];
  return {
    contentId: `https://ap.joelek.se/files/${file.file_id}/?token=${gtoken}`,
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
    textTrackStyle: {
      backgroundColor: null,
      customData: null,
      edgeColor: '#000000FF',
      edgeType: 'OUTLINE',
      fontFamily: 'Arial',
      fontGenericFamily: 'sans-serif',
      fontScale: 1.0,
      fontStyle: 'NORMAL',
      foregroundColor: '#FFFFFFFF',
      windowColor: null,
      windowRoundedCornerRadius: null,
      windowType: 'NONE'
    },
    tracks: sttracks,
    activeTrackIds: activeTrackIds
  };
};

let attempt_playback = (player) => {
  gmedia = null;
  let media = make_media_object();
  if (media === null) { return; }
  player.load(media, {
      autoplay: true,
      activeTrackIds: media.activeTrackIds
    }, function(err, status) {
    if (err) {
      console.log(err);
    }
    if (status) {
      gmedia = status.media;
    }
  });
};

exports.seek = ({percentage}, cb) => {
  gplayer.media.seek((gmedia.duration*percentage/100) | 0);
  cb();
};

exports.pause = ({}, cb) => {
  gplayer.media.pause();
  cb();
};

exports.resume = ({}, cb) => {
  gplayer.media.play();
  cb();
};

exports.load = ({context, index, token}, cb) => {
  mDnsSd.discover({
    name: '_googlecast._tcp.local'
  }).then((device_list) =>{
    if (device_list.length > 0)
    ondeviceup(device_list[0].address);
  }).catch((error) => {
    console.error(error);
  });
  function ondeviceup(host) {
    var client = new Client();
    client.connect(host, function() {
      console.log('connected, launching app ...');
      client.launch(DefaultMediaReceiver, function(err, player) {
        gcontext = context;
        gindex = index;
        gtoken = token;
        gplayer = player;
        cb();
        console.log('app launched');
        attempt_playback(player);
        player.on('status', function(status) {
          console.log('status broadcast playerState=%s', status.playerState);
          if (status.playerState === 'IDLE' && gmedia) {
            gindex++;
            attempt_playback(player);
          }
        });
      });
    });
    client.on('error', function(err) {
      console.log('Error: %s', err.message);
      client.close();
    });
  }
};
