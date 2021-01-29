import * as api from "../api/schema/objects";
import * as is from "../is";
import * as observers from "../observers";
import * as xnode from "../xnode";

const CSS = ``;

export class EntityLinkFactory {
	private navigator: (url: string) => void;
	private contextMenuEntity: observers.ObservableClass<api.EntityBase | undefined>;

	private make(url: string, entity?: api.EntityBase): xnode.XElement {
		let onclick = () => {
			this.navigator(url);
		};
		let oncontextmenu = () => {
			this.contextMenuEntity.updateState(undefined);
			this.contextMenuEntity.updateState(entity);
		};
		let timer: number | undefined;
		return xnode.element("a")
			.set("href", url)
			.on("click", onclick)
			.on("contextmenu", oncontextmenu)
			.on("touchstart", () => {
				timer = window.setTimeout(() => {
					window.clearTimeout(timer); timer = undefined;
					oncontextmenu();
				}, 500);
			}, false)
			.on("touchcancel", () => {
				window.clearTimeout(timer); timer = undefined;
			}, false)
			.on("touchmove", () => {
				window.clearTimeout(timer); timer = undefined;
			}, false)
			.on("touchend", () => {
				window.clearTimeout(timer); timer = undefined;
			}, false);
	}

	constructor(navigator: (url: string) => void, contextMenuEntity: observers.ObservableClass<api.EntityBase | undefined>) {
		this.navigator = navigator;
		this.contextMenuEntity = contextMenuEntity;
	}

	forAlbum(album: api.AlbumBase): xnode.XElement {
		return this.make(`audio/albums/${album.album_id}/`);
	}

	forAlbums(): xnode.XElement {
		return this.make(`audio/albums/`);
	}

	forArtist(artist: api.ArtistBase): xnode.XElement {
		return this.make(`audio/artists/${artist.artist_id}/`);
	}

	forArtists(): xnode.XElement {
		return this.make(`audio/artists/`);
	}

	forCue(cue: api.CueBase): xnode.XElement {
		return this.make(`video/cues/${cue.cue_id}/`);
	}

	forDisc(disc: api.DiscBase): xnode.XElement {
		return this.make(`audio/discs/${disc.disc_id}/`);
	}

	forDiscs(): xnode.XElement {
		return this.make(`audio/discs/`);
	}

	forEpisode(episode: api.EpisodeBase): xnode.XElement {
		return this.make(`video/episodes/${episode.episode_id}/`);
	}

	forEpisodes(): xnode.XElement {
		return this.make(`video/episodes/`);
	}

	forGenre(genre: api.GenreBase): xnode.XElement {
		return this.make(`video/genres/${genre.genre_id}/`);
	}

	forGenres(): xnode.XElement {
		return this.make(`video/genres/`);
	}

	forMovie(movie: api.MovieBase): xnode.XElement {
		return this.make(`video/movies/${movie.movie_id}/`);
	}

	forMovies(): xnode.XElement {
		return this.make(`video/movies/`);
	}

	forPerson(person: api.PersonBase): xnode.XElement {
		return this.make(`persons/${person.person_id}/`);
	}

	forPersons(): xnode.XElement {
		return this.make(`persons/`);
	}

	forPlaylist(playlist: api.PlaylistBase): xnode.XElement {
		return this.make(`audio/playlists/${playlist.playlist_id}/`);
	}

	forPlaylists(): xnode.XElement {
		return this.make(`audio/playlists/`);
	}

	forSeason(season: api.SeasonBase): xnode.XElement {
		return this.make(`video/seasons/${season.season_id}/`);
	}

	forSeasons(): xnode.XElement {
		return this.make(`video/seasons/`);
	}

	forShow(show: api.ShowBase): xnode.XElement {
		return this.make(`video/shows/${show.show_id}/`);
	}

	forShows(): xnode.XElement {
		return this.make(`video/shows/`);
	}

	forTrack(track: api.TrackBase): xnode.XElement {
		return this.make(`audio/tracks/${track.track_id}/`, track);
	}

	forTracks(): xnode.XElement {
		return this.make(`audio/tracks/`);
	}

	forUser(user: api.UserBase): xnode.XElement {
		return this.make(`users/${user.user_id}/`);
	}

	forUsers(): xnode.XElement {
		return this.make(`users/`);
	}

	forYear(year: api.YearBase): xnode.XElement {
		return this.make(`years/${year.year_id}/`);
	}

	forYears(): xnode.XElement {
		return this.make(`years/`);
	}

	forEntity(entity: api.EntityBase): xnode.XElement {
		if (api.AlbumBase.is(entity)) {
			return this.forAlbum(entity);
		}
		if (api.ArtistBase.is(entity)) {
			return this.forArtist(entity);
		}
		if (api.CueBase.is(entity)) {
			return this.forCue(entity);
		}
		if (api.DiscBase.is(entity)) {
			return this.forDisc(entity);
		}
		if (api.EpisodeBase.is(entity)) {
			return this.forEpisode(entity);
		}
		if (api.GenreBase.is(entity)) {
			return this.forGenre(entity);
		}
		if (api.PersonBase.is(entity)) {
			return this.forPerson(entity);
		}
		if (api.PlaylistBase.is(entity)) {
			return this.forPlaylist(entity);
		}
		if (api.MovieBase.is(entity)) {
			return this.forMovie(entity);
		}
		if (api.SeasonBase.is(entity)) {
			return this.forSeason(entity);
		}
		if (api.ShowBase.is(entity)) {
			return this.forShow(entity);
		}
		if (api.TrackBase.is(entity)) {
			return this.forTrack(entity);
		}
		if (api.UserBase.is(entity)) {
			return this.forUser(entity);
		}
		if (api.YearBase.is(entity)) {
			return this.forYear(entity);
		}
		throw `Expected code to be unreachable!`;
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
