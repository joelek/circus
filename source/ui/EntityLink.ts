import * as api from "../api/schema/objects";
import * as xnode from "../xnode";

const CSS = ``;

export class EntityLinkFactory {
	private navigator: (url: string) => void;

	constructor(navigator: (url: string) => void) {
		this.navigator = navigator;
	}

	for(url: string, title: string): xnode.XElement {
		return xnode.element("a")
			.set("href", url)
			.on("click", () => {
				this.navigator(url);
			})
			.add(xnode.text(title));
	}

	forAlbum(album: api.AlbumBase): xnode.XElement {
		return this.for(`audio/albums/${album.album_id}/`, album.title);
	}

	forArtist(artist: api.ArtistBase): xnode.XElement {
		return this.for(`audio/artists/${artist.artist_id}/`, artist.title);
	}

	forDisc(disc: api.DiscBase): xnode.XElement {
		return this.for(`audio/discs/${disc.disc_id}/`, `Disc ${disc.number} of ${disc.album.title}`);
	}

	forEpisode(episode: api.EpisodeBase): xnode.XElement {
		return this.for(`video/episodes/${episode.episode_id}/`, episode.title);
	}

	forGenre(genre: api.GenreBase): xnode.XElement {
		return this.for(`video/genres/${genre.genre_id}/`, genre.title);
	}

	forMovie(movie: api.MovieBase): xnode.XElement {
		return this.for(`video/movies/${movie.movie_id}/`, movie.title);
	}

	forPlaylist(playlist: api.PlaylistBase): xnode.XElement {
		return this.for(`audio/playlists/${playlist.playlist_id}/`, playlist.title);
	}

	forSeason(season: api.SeasonBase): xnode.XElement {
		return this.for(`video/seasons/${season.season_id}/`, `Season ${season.number} of ${season.show.title}`);
	}

	forShow(show: api.ShowBase): xnode.XElement {
		return this.for(`video/shows/${show.show_id}/`, show.title);
	}

	forTrack(track: api.TrackBase): xnode.XElement {
		return this.for(`audio/tracks/${track.track_id}/`, track.title);
	}

	forUser(user: api.UserBase): xnode.XElement {
		return this.for(`users/${user.user_id}/`, user.username);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
