import * as libdb from "./database";
import * as data from "./data";
import * as languages from "./languages";

var Client  = require('castv2-client').Client;
var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;

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

type Context = [{
	file_id: string;
}];

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
let gorigin: string | null = null;
let gplayer: Player | null = null;

function getLanguage(language: string | null): string {
	let entry = languages.db[language || "eng"] || languages.db["eng"];
	return [
		entry.iso639_1,
		entry.iso3166_1
	].join("-");
}

let make_media_object = (): MediaObject | null => {
	if (gcontext === null || gindex === null) {
		return null;
	}
	let file = data.files_index[gcontext[gindex].file_id];
	if (file === undefined) {
		return null;
	}
	let file2 = file;
	let title = 'Title';
	let subtitle = 'Subtitle';
	let image = '';
	let sttracks = new Array<STTrack>();
	let makesttrack = (s: libdb.SubtitleEntry, i: number): STTrack => {
		return {
			trackId: i,
			type: 'TEXT',
			trackType: 'TEXT',
			trackContentId: `${gorigin}/files/${s.file_id}/?token=${gtoken}`,
			trackContentType: 'text/vtt',
			subtype: 'SUBTITLES',
			language: getLanguage(s.language),
			name: null,
			customData: null
		};
	};
	let track = data.media.audio.tracks.find(track => track.file_id === file2.file_id);
	if (track !== undefined) {
		let disc =  data.discs_index[track.disc_id] as libdb.DiscEntry;
		let album =  data.albums_index[disc.album_id] as libdb.AlbumEntry;
		let track_artists =  data.media.audio.track_artists
			.filter((track_artist) => track_artist.track_id === (track as libdb.TrackEntry).track_id);
		let artists =  data.media.audio.artists.filter(artist => track_artists.find(tr => tr.artist_id === artist.artist_id) !== undefined);
		title = track.title;
		subtitle = [ artists.map(ar => ar.title).join(', '), album.title ].join(' \u2022 ');
		image = `${gorigin}/files/${album.cover_file_id}/?token=${gtoken}`;
	} else {
		let episode =  data.media.video.episodes.find(episode => episode.file_id === file2.file_id);
		if (episode !== undefined) {
			let season =  data.media.video.seasons.find(season => season.season_id === (episode as libdb.EpisodeEntry).season_id);
			if (season !== undefined) {
				let show =  data.media.video.shows.find(show => show.show_id === (season as libdb.SeasonEntry).show_id);
				if (show !== undefined){
					title = episode.title;
					subtitle = [ show.title, `s${("00" + season.number).slice(-2)}e${("00" + episode.number).slice(-2)}`].join(' \u2022 ');
					sttracks =  data.lookupSubtitles(episode.file_id).map(makesttrack);
				}
			}
		} else {
			let movie_part =  data.media.video.movie_parts.find(movie_part => movie_part.file_id === file2.file_id);
			if (movie_part !== undefined) {
				let movie = data.media.video.movies.find((movie) => movie.movie_id === movie_part?.movie_id);
				if (movie != null) {
					sttracks = data.lookupSubtitles(movie_part.file_id).map(makesttrack);
					title = movie.title;
					subtitle = [("0000" + movie.year).slice(-4)].join(' \u2022 ');
					if (movie.poster_file_id != null) {
						image = `${gorigin}/files/${movie.poster_file_id}/?token=${gtoken}`;
					}
				}
			}
		}
	}
	let preftrack = sttracks.find(s => s.language === 'sv-SE') || sttracks.find(s => s.language === 'en-US');
	let activeTrackIds = preftrack ? [ sttracks[sttracks.indexOf(preftrack)].trackId ] : [];
	return {
		contentId: `${gorigin}/files/${file.file_id}/?token=${gtoken}`,
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

let load = ({ context, index, token, origin, host }: { context: Context, index: number, token: string, origin: string, host: string }, cb: { (): void }): void => {
	var client = new Client();
	client.connect(host, () => {
		console.log('connected, launching app ...');
		client.launch(DefaultMediaReceiver, (error: Error, player: Player) => {
			gcontext = context;
			gindex = index;
			gtoken = token;
			gorigin = origin;
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
};

export {
	seek,
	pause,
	resume,
	load
};
