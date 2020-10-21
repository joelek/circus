import * as libdb from "./database";
import { Episode, Genre, Movie, Playlist, Show } from "./api/schema/objects";

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
	albums: Array<AlbumResponse>;
	appearances: Array<AlbumResponse>;
}

interface ArtistsResponse extends ApiResponse {
	artists: Array<ArtistResponse>;
}

interface AlbumResponse extends ApiResponse, libdb.AlbumEntry {
	artists: Array<libdb.ArtistEntry>;
	discs: Array<DiscResponse>;
}

interface AlbumsResponse extends ApiResponse {
	albums: Array<AlbumResponse>;
}

interface DiscResponse extends ApiResponse, libdb.DiscEntry {
	tracks: Array<libdb.TrackEntry & {
		artists: Array<libdb.ArtistEntry>
	}>;
}

interface SubtitleResponse extends ApiResponse, libdb.SubtitleEntry {

}

interface EpisodeResponse extends ApiResponse, libdb.EpisodeEntry {
	streamed: number | null,
	subtitles: Array<SubtitleResponse>;
}

type EpisodeResponseV2 = {
	episode: Episode
}

interface ShowResponse extends ApiResponse, libdb.ShowEntry {
	seasons: Array<SeasonResponse>;
}

interface SeasonResponse extends ApiResponse, libdb.SeasonEntry {
	episodes: Array<EpisodeResponse>;
}

interface ShowsResponse extends ApiResponse {
	shows: Array<ShowResponse & {
		genres: Array<libdb.VideoGenreEntry>
	}>
}

type MovieResponse = {
	movie: Movie,
	suggestions: Movie[]
};

type MoviesResponse = {
	movies: Movie[]
};

interface AudiolistItemResponse extends ApiResponse, libdb.AudiolistItemEntry {
	track: libdb.TrackEntry;
}

type PlaylistResponse = {
	playlist: Playlist
};

type PlaylistsResponse = {
	playlists: Playlist[]
};

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

interface Segment {
	episode?: libdb.EpisodeEntry & {
		subtitles: Array<libdb.SubtitleEntry>,
		season: libdb.SeasonEntry & {
			show: libdb.ShowEntry
		}
	},
	movie?: libdb.MovieEntry & {
		movie_parts: Array<libdb.MoviePartEntry & {
			subtitles: Array<libdb.SubtitleEntry>
		}>
	}
}

interface ChannelEntry {
	channel_id: number,
	title: string
}

interface ChannelsRequest extends ApiResponse {

}

interface ChannelsResponse extends ApiResponse {
	channels: Array<ChannelEntry>;
}

interface ChannelRequest extends ApiResponse {

}

interface ChannelResponse extends ApiResponse {
	segments: Array<Segment>
}

interface GenresRequest extends ApiRequest {

}

type GenresResponse = {
	genres: Genre[]
};

interface GenreRequest extends ApiRequest {

}

type GenreResponse = {
	genre: Genre,
	shows: Show[],
	movies: Movie[]
};

interface SearchRequest extends ApiRequest {

}

interface SearchResponse extends ApiResponse {
	artists: Array<libdb.ArtistEntry>,
	albums: Array<libdb.AlbumEntry & {
		artists: Array<libdb.ArtistEntry>
	}>,
	tracks: Array<libdb.TrackEntry & {
		disc: libdb.DiscEntry & {
			album: libdb.AlbumEntry & {
				artists: Array<libdb.ArtistEntry>
			}
		},
		artists: Array<libdb.ArtistEntry>
	}>,
	shows: Array<libdb.ShowEntry>,
	movies: Array<libdb.MovieEntry>,
	episodes: Array<libdb.EpisodeEntry & {
		season: libdb.SeasonEntry & {
			show: libdb.ShowEntry
		}
	}>
}

interface TokensRequest extends ApiRequest {

}

interface TokensResponse extends ApiResponse {
	tokens: Array<libdb.AuthToken>
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
	EpisodeResponseV2,
	ShowResponse,
	SeasonResponse,
	ShowsResponse,
	MovieResponse,
	MoviesResponse,
	AudiolistItemResponse,
	PlaylistResponse,
	PlaylistsResponse,
	CuesRequest,
	CuesResponse,
	Segment,
	ChannelEntry,
	ChannelsRequest,
	ChannelsResponse,
	ChannelRequest,
	ChannelResponse,
	GenresRequest,
	GenresResponse,
	GenreRequest,
	GenreResponse,
	SearchRequest,
	SearchResponse,
	TokensRequest,
	TokensResponse
};
