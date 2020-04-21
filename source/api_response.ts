import * as libdb from "./database";

interface ApiRequest {

};

interface ApiResponse {

};

interface AuthWithTokenReponse extends ApiResponse {

}

interface AuthRequest extends ApiRequest {
	username: string;
	password: string;
}

interface AuthResponse extends ApiResponse {
	token: string
}

interface ChromeCastResponse extends ApiResponse {

}

interface ArtistResponse extends ApiResponse, libdb.ArtistEntry {
	albums: Array<libdb.AlbumEntry>;
}

interface ArtistsResponse extends ApiResponse {
	artists: Array<libdb.ArtistEntry>;
}

interface AlbumResponse extends ApiResponse, libdb.AlbumEntry {
	discs: Array<DiscResponse>;
}

interface AlbumsResponse extends ApiResponse {
	albums: Array<libdb.AlbumEntry>;
}

interface DiscResponse extends ApiResponse, libdb.DiscEntry {
	tracks: Array<libdb.TrackEntry>;
}

interface SubtitleResponse extends ApiResponse, libdb.SubtitleEntry {

}

interface EpisodeResponse extends ApiResponse, libdb.EpisodeEntry {
	streamed: boolean,
	subtitles: Array<SubtitleResponse>;
}

interface ShowResponse extends ApiResponse, libdb.ShowEntry {
	seasons: Array<SeasonResponse>;
}

interface SeasonResponse extends ApiResponse, libdb.SeasonEntry {
	episodes: Array<EpisodeResponse>;
}

interface ShowsResponse extends ApiResponse {
	shows: Array<libdb.ShowEntry>
}

interface MovieResponse extends ApiResponse, libdb.MovieEntry {
	movie_parts: Array<libdb.MoviePartEntry & {
		streamed: boolean,
		subtitles: Array<libdb.SubtitleEntry>
	}>;
}

interface MoviesResponse extends ApiResponse {
	movies: Array<libdb.MovieEntry>;
}

interface AudiolistItemResponse extends ApiResponse, libdb.AudiolistItemEntry {
	track: libdb.TrackEntry;
}

interface AudiolistResponse extends ApiResponse, libdb.AudiolistEntry {
	items: Array<AudiolistItemResponse>;
}

interface AudiolistsResponse extends ApiResponse {
	audiolists: Array<libdb.AudiolistEntry>;
}

interface CuesRequest extends ApiResponse {
	query: string;
}

interface CuesResponse extends ApiResponse {
	cues: Array<libdb.CueEntry & {
		subtitle: libdb.SubtitleEntry & {
			episode: undefined | (libdb.EpisodeEntry & {
				season: libdb.SeasonEntry & {
					show: libdb.ShowEntry
				}
			}),
			movie_part: undefined | (libdb.MoviePartEntry & {
				movie: libdb.MovieEntry
			})
		}
	}>;
}

interface Affinities {
	types: {
		show: number,
		movie: number
	},
	genres: Array<{
		name: string,
		weight: number
	}>
}

interface ChannelMetadata {
	channel_id: number,
	affinities: Affinities
}

interface ChannelsRequest extends ApiResponse {

}

interface ChannelsResponse extends ApiResponse {
	channels: Array<ChannelMetadata>;
}

interface ChannelRequest extends ApiResponse {

}

interface ChannelResponse extends ApiResponse, ChannelMetadata {

}

export {
	ApiRequest,
	ApiResponse,
	AuthWithTokenReponse,
	AuthRequest,
	AuthResponse,
	ChromeCastResponse,
	ArtistResponse,
	ArtistsResponse,
	AlbumResponse,
	AlbumsResponse,
	DiscResponse,
	SubtitleResponse,
	EpisodeResponse,
	ShowResponse,
	SeasonResponse,
	ShowsResponse,
	MovieResponse,
	MoviesResponse,
	AudiolistItemResponse,
	AudiolistResponse,
	AudiolistsResponse,
	CuesRequest,
	CuesResponse,
	Affinities,
	ChannelMetadata,
	ChannelsRequest,
	ChannelsResponse,
	ChannelRequest,
	ChannelResponse
};