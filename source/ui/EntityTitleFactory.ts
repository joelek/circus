import * as api from "../api/schema/objects";
import * as xnode from "../xnode";
import { EntityLinkFactory } from "./EntityLink";

const CSS = ``;

export class EntityTitleFactory {
	private entityLinkFactory: EntityLinkFactory;

	private make(link: xnode.XElement, title: string): xnode.XElement {
		return link.add(xnode.text(title));
	}

	constructor(entityLinkFactory: EntityLinkFactory) {
		this.entityLinkFactory = entityLinkFactory;
	}

	forEntity(entity: api.Entity): xnode.XElement {
		if (api.Album.is(entity)) {
			return this.forAlbum(entity);
		}
		if (api.Artist.is(entity)) {
			return this.forArtist(entity);
		}
		if (api.Disc.is(entity)) {
			return this.forDisc(entity);
		}
		if (api.Episode.is(entity)) {
			return this.forEpisode(entity);
		}
		if (api.Genre.is(entity)) {
			return this.forGenre(entity);
		}
		if (api.Movie.is(entity)) {
			return this.forMovie(entity);
		}
		if (api.Person.is(entity)) {
			return this.forPerson(entity);
		}
		if (api.Playlist.is(entity)) {
			return this.forPlaylist(entity);
		}
		if (api.Season.is(entity)) {
			return this.forSeason(entity);
		}
		if (api.Show.is(entity)) {
			return this.forShow(entity);
		}
		if (api.Track.is(entity)) {
			return this.forTrack(entity);
		}
		if (api.User.is(entity)) {
			return this.forUser(entity);
		}
		throw `Expected code to be unreachable!`;
	}

	forAlbum(album: api.AlbumBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forAlbum(album), album.title);
	}

	forArtist(artist: api.ArtistBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forArtist(artist), artist.title);
	}

	forDisc(disc: api.DiscBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forDisc(disc), `Disc ${disc.number}`);
	}

	forEpisode(episode: api.EpisodeBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forEpisode(episode), episode.title);
	}

	forGenre(genre: api.GenreBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forGenre(genre), genre.title);
	}

	forMovie(movie: api.MovieBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forMovie(movie), movie.title);
	}

	forPerson(person: api.PersonBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forPerson(person), person.name);
	}

	forPlaylist(playlist: api.PlaylistBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forPlaylist(playlist), playlist.title);
	}

	forSeason(season: api.SeasonBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forSeason(season), `Season ${season.number}`);
	}

	forShow(show: api.ShowBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forShow(show), show.title);
	}

	forTrack(track: api.TrackBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forTrack(track), track.title);
	}

	forUser(user: api.UserBase): xnode.XElement {
		return this.make(this.entityLinkFactory.forUser(user), user.name);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
