import * as libdb from "./database";
import * as data from "./data";
import * as languages from "./languages";
import { ArrayObservable, Observable, ObservableClass } from "./simpleobs";

class Controller {
	readonly context = new ObservableClass<Context | undefined>(undefined);
	readonly contextIndex = new ObservableClass<number | undefined>(undefined);
	readonly currentItem = new ObservableClass<ContextItem | undefined>(undefined);
	readonly shouldPlay = new ObservableClass(false);
	readonly isPlaying = new ObservableClass(false);
	readonly isLaunched = new ObservableClass(false);
	readonly isLoaded = new ObservableClass(false);
}

export const controller = new Controller();

function computeCurrentItem(context?: Context, contextIndex?: number) {
	return context != null && contextIndex != null ? context[contextIndex] : undefined;
}
controller.context.addObserver((context) => {
	controller.currentItem.updateState(computeCurrentItem(context, controller.contextIndex.getState()));
});
controller.contextIndex.addObserver((contextIndex) => {
	controller.currentItem.updateState(computeCurrentItem(controller.context.getState(), contextIndex));
});

function computeSomething(currentItem?: ContextItem, isLaunched?: boolean) {
	if (currentItem != null && isLaunched) {
		attempt_playback();
	}
}
controller.currentItem.addObserver((currentItem) => {
	computeSomething(currentItem, controller.isLaunched.getState());
});
controller.isLaunched.addObserver((isLaunched) => {
	computeSomething(controller.currentItem.getState(), isLaunched);
});









var Client  = require('castv2-client').Client;
var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;

type Status = {
	playerState: "IDLE" | "PLAYING" | "BUFFERING";
	media: Media;
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

type ContextItem = {
	file_id: string
};

type Context = ContextItem[];

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

let gmedia: Media | null = null;
let ghost: string | null = null;
let gtoken: string | null = null;
let gorigin: string | null = null;
let gplayer: Player | null = null;

export function getSession() {
	if (ghost && gtoken && gorigin) {
		return {
			device: ghost,
			token: gtoken,
			origin: gorigin
		};
	}
	return undefined;
}

function getLanguage(language: string | null): string {
	let entry = languages.db[language || "eng"] || languages.db["eng"];
	return [
		entry.iso639_1,
		entry.iso3166_1
	].join("-");
}

let make_media_object = (): MediaObject | null => {
	let contextItem = controller.currentItem.getState();
	if (contextItem == null) {
		return null;
	}
	let file = data.files_index[contextItem.file_id];
	if (file == undefined) {
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
	if (track != undefined) {
		let disc =  data.discs_index[track.disc_id] as libdb.DiscEntry;
		let album =  data.albums_index[disc.album_id] as libdb.AlbumEntry;
		let track_artists =  data.media.audio.track_artists
			.filter((track_artist) => track_artist.track_id === (track as libdb.TrackEntry).track_id);
		let artists =  data.media.audio.artists.filter(artist => track_artists.find(tr => tr.artist_id === artist.artist_id) != undefined);
		title = track.title;
		subtitle = [ artists.map(ar => ar.title).join(', '), album.title ].join(' \u2022 ');
		image = `${gorigin}/files/${album.cover_file_id}/?token=${gtoken}`;
	} else {
		let episode =  data.media.video.episodes.find(episode => episode.file_id === file2.file_id);
		if (episode != undefined) {
			let season =  data.media.video.seasons.find(season => season.season_id === (episode as libdb.EpisodeEntry).season_id);
			if (season != undefined) {
				let show =  data.media.video.shows.find(show => show.show_id === (season as libdb.SeasonEntry).show_id);
				if (show != undefined){
					title = episode.title;
					subtitle = [ show.title, `s${("00" + season.number).slice(-2)}e${("00" + episode.number).slice(-2)}`].join(' \u2022 ');
					sttracks =  data.lookupSubtitles(episode.file_id).map(makesttrack);
				}
			}
		} else {
			let movie_part =  data.media.video.movie_parts.find(movie_part => movie_part.file_id === file2.file_id);
			if (movie_part != undefined) {
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

let attempt_playback = (): void => {
	gmedia = null;
	let media = make_media_object();
	if (media == null) {
		return;
	}
	if (gplayer == null) {
		return;
	}
	gplayer.load(media, {
		autoplay: controller.shouldPlay.getState(),
		activeTrackIds: media.activeTrackIds
	}, (error, status) => {
		if (error) {
			console.log(error);
		}
		if (status) {
			gmedia = status.media;
			controller.isLoaded.updateState(true);
		}
	});
};

let seek = (percentage: number): void => {
	if (gplayer != null && gmedia != null) {
		gplayer.media.seek((gmedia.duration*percentage/100) | 0);
	}
};

let pause = (): void => {
	if (gplayer != null && gmedia != null) {
		gplayer.media.pause();
	}
};

let resume = (): void => {
	if (gplayer != null && gmedia != null) {
		gplayer.media.play();
	}
};

export const load = (host: string, token: string, origin: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		var client = new Client();
		client.connect(host, () => {
			console.log('connected, launching app ...');
			client.launch(DefaultMediaReceiver, (error: Error, player: Player) => {
				ghost = host;
				gplayer = player;
				gtoken = token;
				gorigin = origin;
				console.log('app launched');
				controller.isLaunched.updateState(true);
				player.on('status', (status) => {
					console.log('status broadcast playerState=%s', status.playerState);
					if (status.playerState === "PLAYING") {
						controller.isPlaying.updateState(true);
					} else {
						controller.isPlaying.updateState(false);
					}
					if (status.playerState === 'IDLE' && gmedia != null) {
						let context = controller.context.getState();
						let contextIndex = controller.contextIndex.getState();
						if (context != null && contextIndex != null && contextIndex + 1 < context.length) {
							controller.contextIndex.updateState(contextIndex + 1);
						}
					}
				});
				return resolve();
			});
		});
		client.on('error', (error: Error) => {
			console.log('Error: %s', error.message);
			controller.isLaunched.updateState(false);
			client.close();
		});
	});
};


controller.shouldPlay.addObserver((shouldPlay) => {
	let isPlaying = controller.isPlaying.getState();
	if (shouldPlay) {
		if (!isPlaying) {
			resume();
		}
	} else {
		if (isPlaying) {
			pause();
		}
	}
});
