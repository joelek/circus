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
declare module "utils" {
    function join(...parameters: any): string;
    function getSearchTerms(string: string): Array<string>;
    function formatTimestamp(ms: number): string;
    export { join, getSearchTerms, formatTimestamp };
}
declare module "reader" {
    class Reader {
        private string;
        private offset;
        private length;
        constructor(string: string);
        done(): boolean;
        line(): string;
        peek(length: number): string;
        read(length: number): string;
    }
    export { Reader };
}
declare module "vtt" {
    import * as libreader from "reader";
    type Cue = {
        start_ms: number;
        duration_ms: number;
        lines: Array<string>;
    };
    type Body = {
        cues: Array<Cue>;
    };
    type Head = {
        metadata: string;
    };
    type Track = {
        head: Head;
        body: Body;
    };
    function readTrack(reader: libreader.Reader): Track;
    export { Cue, Body, Head, Track, readTrack };
}
declare module "index" { }
