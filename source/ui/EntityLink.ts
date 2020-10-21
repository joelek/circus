import * as api from "../api/schema/objects";
import * as xnode from "../xnode";

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

	forGenre(genre: api.GenreBase): xnode.XElement {
		return this.for(`video/genres/${genre.genre_id}/`, genre.title);
	}

	forMovie(movie: api.MovieBase): xnode.XElement {
		return this.for(`video/movies/${movie.movie_id}/`, movie.title);
	}

	forPlaylist(playlist: api.PlaylistBase): xnode.XElement {
		return this.for(`audio/playlists/${playlist.playlist_id}/`, playlist.title);
	}

	forShow(show: api.ShowBase): xnode.XElement {
		return this.for(`video/shows/${show.show_id}/`, show.title);
	}

	forUser(user: api.UserBase): xnode.XElement {
		return this.for(`users/${user.user_id}/`, user.username);
	}
};
