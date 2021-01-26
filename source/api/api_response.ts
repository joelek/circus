import * as objects from "./schema/objects";

type YearResponse = {
	year: objects.Year,
	movies: objects.Movie[],
	albums: objects.Album[]
};

type YearsResponse = {
	years: objects.Year[]
};

type AlbumResponse = {
	album: objects.Album
};

type AlbumsResponse = {
	albums: objects.Album[]
};

type ArtistResponse = {
	artist: objects.Artist,
	tracks: objects.Track[],
	appearances: objects.Album[]
};

type ArtistsResponse = {
	artists: objects.Artist[]
};

type DiscResponse = {
	disc: objects.Disc,
	next?: objects.Disc,
	last?: objects.Disc
};

type DiscsResponse = {
	discs: objects.Disc[]
};

type EpisodeResponse = {
	episode: objects.Episode,
	last?: objects.Episode,
	next?: objects.Episode
};

type EpisodesResponse = {
	episodes: objects.Episode[]
};

type GenreShowsResponse = {
	shows: objects.Show[]
};

type GenreMoviesResponse = {
	movies: objects.Movie[]
};

type GenreResponse = {
	genre: objects.Genre
};

type GenresResponse = {
	genres: objects.Genre[]
};

type MovieMovieSuggestionsResponse = {
	movies: objects.Movie[]
};

type MovieResponse = {
	movie: objects.Movie
};

type MoviesResponse = {
	movies: objects.Movie[]
};

type PersonResponse = {
	person: objects.Person
};

type PersonShowsResponse = {
	shows: objects.Show[]
};

type PersonMoviesResponse = {
	movies: objects.Movie[]
};

type PersonsResponse = {
	persons: objects.Person[]
};

type PlaylistResponse = {
	playlist: objects.Playlist
};

type PlaylistsResponse = {
	playlists: objects.Playlist[]
};

type SeasonResponse = {
	season: objects.Season,
	last?: objects.Season,
	next?: objects.Season
};

type SeasonsResponse = {
	seasons: objects.Season[]
};

type ShowResponse = {
	show: objects.Show
};

type ShowsResponse = {
	shows: objects.Show[]
};

type TrackPlaylistsResponse = {
	playlists: objects.Playlist[]
};

type TrackResponse = {
	track: objects.Track,
	last?: objects.Track,
	next?: objects.Track
};

type TracksResponse = {
	tracks: objects.Track[]
};

type UserResponse = {
	user: objects.User,
	playlists: objects.Playlist[]
};

type UsersResponse = {
	users: objects.User[]
};

type CueResponse = {
	cue: objects.Cue & {
		media: objects.Episode | objects.Movie
	}
};

type CuesResponse = {
	cues: (objects.Cue & {
		media: objects.Episode | objects.Movie
	})[];
};

type SearchResponse = {
	entities: objects.Entity[],
};










interface ApiRequest {

};

interface ApiResponse {

};

interface AuthWithTokenReponse extends ApiResponse {
	token?: string
}

interface AuthRequest extends ApiRequest {
	username: string;
	password: string;
}

interface AuthResponse extends ApiResponse {
	token: string
}

export {
	YearResponse,
	YearsResponse,
	AlbumResponse,
	AlbumsResponse,
	ArtistResponse,
	ArtistsResponse,
	DiscResponse,
	DiscsResponse,
	EpisodeResponse,
	EpisodesResponse,
	GenreShowsResponse,
	GenreMoviesResponse,
	GenreResponse,
	GenresResponse,
	SeasonResponse,
	SeasonsResponse,
	ShowResponse,
	ShowsResponse,
	MovieMovieSuggestionsResponse,
	MovieResponse,
	MoviesResponse,
	PersonShowsResponse,
	PersonMoviesResponse,
	PersonResponse,
	PersonsResponse,
	PlaylistResponse,
	PlaylistsResponse,
	TrackPlaylistsResponse,
	TrackResponse,
	TracksResponse,
	UserResponse,
	UsersResponse,
	CueResponse,
	CuesResponse,
	SearchResponse,

	ApiRequest,
	ApiResponse,
	AuthWithTokenReponse,
	AuthRequest,
	AuthResponse
};
