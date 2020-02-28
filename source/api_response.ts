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
	subtitles: Array<libdb.SubtitleEntry>;
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
			movie: undefined | (libdb.MovieEntry)
		}
	}>;
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
	CuesResponse
};
