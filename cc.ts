import * as libdb from "./database";
import * as libfs from "fs";
import * as data from "./data";
import * as utils from "./utils";

let media = data.media;
let lists = data.lists;

var Client  = require('castv2-client').Client;
var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
var mDnsSd = require('node-dns-sd');

type Status = {
	playerState: "IDLE";
	media: Media;
};

type Device = {
	address: string;
};

type Media = {
	duration: number;
	seek(position: number): void;
	play(): void;
	pause(): void;
};

type MediaObject = {
	contentId: string;
	contentType: string;
	streamType: 'BUFFERED';
	metadata: {
		type: 0;
		metadataType: 0;
		title: string;
		subtitle: string;
		images: [
			{
				url: string;
			}
		];
	};
	tracks: Array<STTrack>;
	activeTrackIds: Array<number>;
};

type Player = {
	load(media: MediaObject, data: {}, cb: { (error: Error | null, status: Status | null): void }): void;
	media: Media;
	on(kind: "status", cb: { (status: Status): void }): void;
};

type Context = {
	files: Array<string>;
};

type STTrack = {
	trackId: number;
	type: 'TEXT';
	trackType: 'TEXT';
	trackContentId: string;
	trackContentType: string;
	subtype: 'SUBTITLES',
	language: string;
	name: null,
	customData: null
};

let gcontext: Context | null = null;
let gindex: number | null = null;
let gmedia: Media | null = null;
let gtoken: string | null = null;
let gplayer: Player | null = null;

let tracks_index: utils.Index<libdb.TrackEntry> = {};

for (let i = 0; i < media.audio.tracks.length; i++) {
	let track = media.audio.tracks[i];
	tracks_index[track.track_id] = track;
}

let discs_index: utils.Index<libdb.DiscEntry> = {};

for (let i = 0; i < media.audio.discs.length; i++) {
	let disc = media.audio.discs[i];
	discs_index[disc.disc_id] = disc;
}

let albums_index: utils.Index<libdb.AlbumEntry> = {};

for (let i = 0; i < media.audio.albums.length; i++) {
	let album = media.audio.albums[i];
	albums_index[album.album_id] = album;
}

let artists_index: utils.Index<libdb.ArtistEntry> = {};

for (let i = 0; i < media.audio.artists.length; i++) {
	let artist = media.audio.artists[i];
	artists_index[artist.artist_id] = artist;
}

let shows_index: utils.Index<libdb.ShowEntry> = {};

for (let i = 0; i < media.video.shows.length; i++) {
	let show = media.video.shows[i];
	shows_index[show.show_id] = show;
}

let episodes_index: utils.Index<libdb.EpisodeEntry> = {};

for (let i = 0; i < media.video.episodes.length; i++) {
	let episode = media.video.episodes[i];
	episodes_index[episode.episode_id] = episode;
}

let seasons_index: utils.Index<libdb.SeasonEntry> = {};

for (let i = 0; i < media.video.seasons.length; i++) {
	let season = media.video.seasons[i];
	seasons_index[season.season_id] = season;
}

let movies_index: utils.Index<libdb.MovieEntry> = {};

for (let i = 0; i < media.video.movies.length; i++) {
	let movie = media.video.movies[i];
	movies_index[movie.movie_id] = movie;
}

let subtitles_index: utils.Index<libdb.SubtitleEntry> = {};

for (let i = 0; i < media.video.subtitles.length; i++) {
	let subtitle = media.video.subtitles[i];
	subtitles_index[subtitle.subtitle_id] = subtitle;
}

let cues_index: utils.Index<libdb.CueEntry> = {};

for (let i = 0; i < media.video.cues.length; i++) {
	let cue = media.video.cues[i];
	cues_index[cue.cue_id] = cue;
}

let audiolists_index: utils.Index<libdb.AudiolistEntry> = {};

for (let i = 0; i < lists.audiolists.length; i++) {
	let audiolist = lists.audiolists[i];
	audiolists_index[audiolist.audiolist_id] = audiolist;
}

let files_index: utils.Index<libdb.FileEntry> = {};

for (let i = 0; i < media.files.length; i++) {
	let file = media.files[i];
	files_index[file.file_id] = file;
}

let make_media_object = (): MediaObject | null => {
	if (gcontext === null || gindex === null) {
		return null;
	}
	let file = files_index[gcontext.files[gindex]];
	if (file === undefined) {
		return null;
	}
	let file2 = file;
	let title = 'Title';
	let subtitle = 'Subtitle';
	let image = '';
	let sttracks = new Array<STTrack>();
	let langmap: { [id: string]: string } = {
		eng: 'en-US',
		swe: 'sv-SE'
	};
	let makesttrack = (s: libdb.SubtitleEntry, i: number): STTrack => {
		return {
			trackId: i,
			type: 'TEXT',
			trackType: 'TEXT',
			trackContentId: `https://ap.joelek.se/files/${s.file_id}/?token=${gtoken}`,
			trackContentType: 'text/vtt',
			subtype: 'SUBTITLES',
			language: s.language !== null ? langmap[s.language] || langmap.eng : langmap.eng,
			name: null,
			customData: null
		};
	};
	let track = media.audio.tracks.find(track => track.file_id === file2.file_id);
	if (track !== undefined) {
		let disc = discs_index[track.disc_id] as libdb.DiscEntry;
		let album = albums_index[disc.album_id] as libdb.AlbumEntry;
		let track_artists = media.audio.track_artists
			.filter((track_artist) => track_artist.track_id === (track as libdb.TrackEntry).track_id);
		let artists = media.audio.artists.filter(artist => track_artists.find(tr => tr.artist_id === artist.artist_id) !== undefined);
		title = track.title;
		subtitle = [ artists.map(ar => ar.title).join(', '), album.title ].join(' \u2022 ');
		image = `https://ap.joelek.se/files/${album.cover_file_id}/?token=${gtoken}`;
	} else {
		let episode = media.video.episodes.find(episode => episode.file_id === file2.file_id);
		if (episode !== undefined) {
			let season = media.video.seasons.find(season => season.season_id === (episode as libdb.EpisodeEntry).season_id);
			if (season !== undefined) {
				let show = media.video.shows.find(show => show.show_id === (season as libdb.SeasonEntry).show_id);
				if (show !== undefined){
					title = episode.title;
					subtitle = [ show.title, `s${season.number}e${episode.number}`].join(' \u2022 ');
					sttracks = media.video.subtitles.filter(st => st.episode_id === (episode as libdb.EpisodeEntry).episode_id).map(makesttrack);
				}
			}
		} else {
			let movie = media.video.movies.find(movie => movie.file_id === file2.file_id);
			if (movie !== undefined) {
				sttracks = media.video.subtitles.filter(st => st.movie_id === (movie as libdb.MovieEntry).movie_id).map(makesttrack);
				title = movie.title;
				subtitle = [].join(' \u2022 ');
			}
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
		tracks: sttracks,
		activeTrackIds: activeTrackIds
	};
};

let attempt_playback = (player: Player): void => {
	gmedia = null;
	let media = make_media_object();
	if (media === null) {
		return;
	}
	player.load(media, {
		autoplay: true,
		activeTrackIds: media.activeTrackIds
	}, (error, status) => {
		if (error) {
			console.log(error);
		}
		if (status) {
			gmedia = status.media;
		}
	});
};

let seek = ({ percentage }: { percentage: number; }, cb: { (): void }): void => {
	if (gplayer !== null && gmedia !== null) {
		gplayer.media.seek((gmedia.duration*percentage/100) | 0);
	}
	cb();
};

let pause = ({}, cb: { (): void }): void => {
	if (gplayer !== null) {
		gplayer.media.pause();
	}
	cb();
};

let resume = ({}, cb: { (): void }): void => {
	if (gplayer !== null) {
		gplayer.media.play();
	}
	cb();
};

let load = ({ context, index, token }: { context: Context, index: number, token: string }, cb: { (): void }): void => {
	mDnsSd.discover({
		name: '_googlecast._tcp.local'
	}).then((device_list: Array<Device>) =>{
		if (device_list.length > 0)
		ondeviceup(device_list[0].address);
	}).catch((error: Error) => {
		console.error(error);
	});
	function ondeviceup(host: string) {
		var client = new Client();
		client.connect(host, () => {
			console.log('connected, launching app ...');
			client.launch(DefaultMediaReceiver, (error: Error, player: Player) => {
				gcontext = context;
				gindex = index;
				gtoken = token;
				gplayer = player;
				cb();
				console.log('app launched');
				attempt_playback(player);
				player.on('status', (status) => {
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
		client.on('error', (error: Error) => {
			console.log('Error: %s', error.message);
			client.close();
		});
	}
};

export {
	seek,
	pause,
	resume,
	load
};
