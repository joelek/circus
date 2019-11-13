declare type Exports = {};
declare type Module = {
    exports: Exports;
};
declare type ModuleCallback = {
    (...exports: Array<Exports>): void;
};
declare type ModuleState = {
    callback: ModuleCallback;
    dependencies: Array<string>;
    module: Module | null;
};
declare let define: (name: string, dependencies: string[], callback: ModuleCallback) => void;
declare module "database" {
    type Entry = {};
    type Index<T extends Entry> = {
        [id: string]: T | undefined;
    };
    type ArtistEntry = {
        artist_id: string;
        title: string;
    };
    type AlbumEntry = {
        album_id: string;
        title: string;
        year: number;
        cover_file_id: string | null;
    };
    type DiscEntry = {
        disc_id: string;
        album_id: string;
        number: number;
    };
    type TrackEntry = {
        track_id: string;
        disc_id: string;
        file_id: string;
        title: string;
        number: number;
        duration: number;
    };
    type AlbumArtistEntry = {
        album_id: string;
        artist_id: string;
    };
    type TrackArtistEntry = {
        track_id: string;
        artist_id: string;
    };
    type MovieEntry = {
        movie_id: string;
        file_id: string;
        title: string;
        year: number;
        duration: number;
    };
    type ShowEntry = {
        show_id: string;
        title: string;
    };
    type SeasonEntry = {
        season_id: string;
        show_id: string;
        number: number;
    };
    type EpisodeEntry = {
        episode_id: string;
        season_id: string;
        file_id: string;
        title: string;
        number: number;
        duration: number;
    };
    type SubtitleEntry = {
        subtitle_id: string;
        episode_id: string | null;
        movie_id: string | null;
        file_id: string;
        language: string | null;
    };
    type CueEntry = {
        cue_id: string;
        subtitle_id: string;
        start_ms: number;
        duration_ms: number;
        lines: Array<string>;
    };
    type FileEntry = {
        file_id: string;
        path: Array<string>;
        mime: string;
    };
    type MediaDatabase = {
        audio: {
            artists: Array<ArtistEntry>;
            albums: Array<AlbumEntry>;
            discs: Array<DiscEntry>;
            tracks: Array<TrackEntry>;
            album_artists: Array<AlbumArtistEntry>;
            track_artists: Array<TrackArtistEntry>;
        };
        video: {
            movies: Array<MovieEntry>;
            shows: Array<ShowEntry>;
            seasons: Array<SeasonEntry>;
            episodes: Array<EpisodeEntry>;
            subtitles: Array<SubtitleEntry>;
            cues: Array<CueEntry>;
        };
        files: Array<FileEntry>;
    };
    type SubtitlesDatabase = Map<string, Set<string>>;
    type UserEntry = {
        user_id: string;
        username: string;
        password: string;
    };
    type AudiolistItemEntry = {
        audiolist_id: string;
        track_id: string;
        number: number;
    };
    type AudiolistEntry = {
        audiolist_id: string;
        title: string;
    };
    type ListDatabase = {
        audiolists: Array<AudiolistEntry>;
        audiolist_items: Array<AudiolistItemEntry>;
    };
    export { Entry, Index, ArtistEntry, AlbumEntry, DiscEntry, TrackEntry, AlbumArtistEntry, TrackArtistEntry, MovieEntry, ShowEntry, SeasonEntry, EpisodeEntry, SubtitleEntry, CueEntry, FileEntry, MediaDatabase, SubtitlesDatabase, UserEntry, AudiolistItemEntry, AudiolistEntry, ListDatabase };
}
declare module "api_response" {
    import * as libdb from "database";
    interface ApiRequest {
    }
    interface ApiResponse {
    }
    interface AuthWithTokenReponse extends ApiResponse {
    }
    interface AuthRequest extends ApiRequest {
        username: string;
        password: string;
    }
    interface AuthResponse extends ApiResponse {
        token: string;
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
        shows: Array<libdb.ShowEntry>;
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
        cues: Array<libdb.CueEntry>;
    }
    export { ApiRequest, ApiResponse, AuthWithTokenReponse, AuthRequest, AuthResponse, ChromeCastResponse, ArtistResponse, ArtistsResponse, AlbumResponse, AlbumsResponse, DiscResponse, SubtitleResponse, EpisodeResponse, ShowResponse, SeasonResponse, ShowsResponse, MovieResponse, MoviesResponse, AudiolistItemResponse, AudiolistResponse, AudiolistsResponse, CuesRequest, CuesResponse };
}
declare module "client" { }
