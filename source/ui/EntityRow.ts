import * as api from "../api/schema/objects";
import * as xnode from "../xnode";
import * as theme from "./theme";
import * as metadata from "./metadata";
import * as is from "../is";
import { EntityLinkFactory } from "./EntityLink";
import { ImageBoxFactory } from "./ImageBox";
import { PlaybackButtonFactory } from "./PlaybackButton";

const CSS = `
	.entity-row {
		align-items: center;
		display: grid;
		gap: 16px;
		grid-template-columns: 72px 1fr;
	}

	.entity-row__artwork {
		border-radius: 2px;
		overflow: hidden;
		position: relative;
	}

	.entity-row__playback {
		position: absolute;
			top: 50%; left: 50%;
		transform: translate(-50%, -50%);
	}

	.entity-row__metadata {
		display: grid;
		gap: 16px;
	}

	.entity-row__titles {
		display: grid;
		gap: 8px;
	}

	.entity-row__title {
		color: ${theme.TEXT_0};
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-row__subtitle {
		color: ${theme.TEXT_1};
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-row__tags {
		display: grid;
		gap: 8px;
		grid-auto-columns: minmax(auto, max-content);
		grid-auto-flow: column;
	}

	.entity-row__tag {
		background-color: ${theme.BACKGROUND_4};
		border-radius: 2px;
		color: ${theme.TEXT_1};
		font-size: 12px;
		padding: 4px 8px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-row__tag--accent {
		background-color: ${theme.BACKGROUND_ACCENT};
		color: ${theme.TEXT_ACCENT};
	}
`;

export class EntityRowFactory {
	private EntityLink: EntityLinkFactory;
	private ImageBox: ImageBoxFactory;
	private PlaybackButton: PlaybackButtonFactory;

	private make(link: xnode.XElement, image: xnode.XElement, playbackButton: xnode.XElement | undefined, titles: xnode.XElement[], subtitles: xnode.XElement[], tags: string[]): xnode.XElement {
		return link
			.add(xnode.element("div.entity-row")
				.add(xnode.element("div.entity-row__artwork")
					.add(image)
					.add(xnode.element("div.entity-row__playback")
						.add(playbackButton)
					)
				)
				.add(xnode.element("div.entity-row__metadata")
					.add(xnode.element("div.entity-row__titles")
						.add(xnode.element("div.entity-row__title")
							.add(...xnode.joinarray(titles))
						)
						.add(subtitles.length === 0 ? undefined : xnode.element("div.entity-row__subtitle")
							.add(...xnode.joinarray(subtitles))
						)
					)
					.add(xnode.element("div.entity-row__tags")
						.add(...tags.map((tag) => xnode.element("div.entity-row__tag")
							.add(xnode.text(tag)))
						)
					)
				)
			);
	}

	constructor(EntityLink: EntityLinkFactory, ImageBox: ImageBoxFactory, PlaybackButton: PlaybackButtonFactory) {
		this.EntityLink = EntityLink;
		this.ImageBox = ImageBox;
		this.PlaybackButton = PlaybackButton;
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
		if (api.Playlist.is(entity)) {
			return this.forPlaylist(entity);
		}
		if (api.Movie.is(entity)) {
			return this.forMovie(entity);
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

	forAlbum(album: api.Album, playbackButton: xnode.XElement = this.PlaybackButton.forAlbum(album)): xnode.XElement {
		let duration_ms = 0;
		for (let disc of album.discs) {
			for (let track of disc.tracks) {
				duration_ms += track.segment.file.duration_ms;
			}
		}
		let link = this.EntityLink.forAlbum(album);
		let image = this.ImageBox.forSquare(is.absent(album.artwork) ? undefined : `/files/${album.artwork.file_id}/`);
		let titles = [
			this.EntityLink.forAlbum(album)
		];
		let subtitles = album.artists.map((artist) => this.EntityLink.forArtist(artist));
		let tags = [
			"Album",
			`${album.year}`,
			metadata.formatDuration(duration_ms)
		];
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forArtist(artist: api.Artist, playbackButton: xnode.XElement = this.PlaybackButton.forArtist(artist)): xnode.XElement {
		let duration_ms = 0;
		for (let album of artist.albums) {
			for (let disc of album.discs) {
				for (let track of disc.tracks) {
					duration_ms += track.segment.file.duration_ms;
				}
			}
		}
		let link = this.EntityLink.forArtist(artist);
		let image = this.ImageBox.forSquare();
		let titles = [
			this.EntityLink.forArtist(artist)
		];
		let subtitles = new Array<xnode.XElement>();
		let tags = [
			"Artist",
			metadata.formatDuration(duration_ms)
		];
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forDisc(disc: api.Disc, playbackButton: xnode.XElement = this.PlaybackButton.forDisc(disc)): xnode.XElement {
		let duration_ms = 0;
		for (let track of disc.tracks) {
			duration_ms += track.segment.file.duration_ms;
		}
		let link = this.EntityLink.forDisc(disc);
		let image = this.ImageBox.forSquare(is.absent(disc.album.artwork) ? undefined : `/files/${disc.album.artwork.file_id}/`);
		let titles = [
			this.EntityLink.forAlbum(disc.album),
			this.EntityLink.forDisc(disc)
		];
		let subtitles = disc.album.artists.map((artist) => this.EntityLink.forArtist(artist));
		let tags = [
			"Disc",
			`${disc.album.year}`,
			metadata.formatDuration(duration_ms)
		];
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forEpisode(episode: api.Episode, playbackButton: xnode.XElement = this.PlaybackButton.forEpisode(episode)): xnode.XElement {
		let duration_ms = 0;
		duration_ms += episode.segment.file.duration_ms;
		let link = this.EntityLink.forEpisode(episode);
		let image = this.ImageBox.forSquare();
		//let image = this.ImageBox.forSquare(`/media/stills/${episode.file.file_id}/`);
		let titles = [
			this.EntityLink.forEpisode(episode)
		];
		let subtitles = [
			this.EntityLink.forShow(episode.season.show),
			this.EntityLink.forSeason(episode.season)
		];
		let tags = [
			"Episode",
			`${episode.year}`,
			metadata.formatDuration(duration_ms)
		];
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forMovie(movie: api.Movie, playbackButton: xnode.XElement = this.PlaybackButton.forMovie(movie)): xnode.XElement {
		let duration_ms = 0;
		duration_ms += movie.segment.file.duration_ms;
		let link = this.EntityLink.forMovie(movie);
		let image = this.ImageBox.forSquare(is.absent(movie.artwork) ? undefined : `/files/${movie.artwork.file_id}/`);
		let titles = [
			this.EntityLink.forMovie(movie)
		];
		let subtitles = movie.genres.map((genre) => this.EntityLink.forGenre(genre));
		let tags = [
			"Movie",
			`${movie.year}`,
			metadata.formatDuration(duration_ms)
		];
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forPlaylist(playlist: api.Playlist, playbackButton: xnode.XElement = this.PlaybackButton.forPlaylist(playlist)): xnode.XElement {
		let duration_ms = 0;
		for (let item of playlist.items) {
			duration_ms += item.track.segment.file.duration_ms;
		}
		let link = this.EntityLink.forPlaylist(playlist);
		let image = this.ImageBox.forSquare();
		let titles = [
			this.EntityLink.forPlaylist(playlist)
		];
		let subtitles = [
			this.EntityLink.forUser(playlist.user)
		];
		let tags = [
			"Playlist",
			metadata.formatDuration(duration_ms)
		];
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forSeason(season: api.Season, playbackButton: xnode.XElement = this.PlaybackButton.forSeason(season)): xnode.XElement {
		let duration_ms = 0;
		for (let episode of season.episodes) {
			duration_ms += episode.segment.file.duration_ms;
		}
		let link = this.EntityLink.forSeason(season);
		let image = this.ImageBox.forSquare(is.absent(season.show.artwork) ? undefined : `/files/${season.show.artwork.file_id}/`);
		let titles = [
			this.EntityLink.forShow(season.show),
			this.EntityLink.forSeason(season)
		];
		let subtitles = season.show.genres.map((genre) => this.EntityLink.forGenre(genre));
		let tags = [
			"Season",
			metadata.formatDuration(duration_ms)
		];
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forShow(show: api.Show, playbackButton: xnode.XElement = this.PlaybackButton.forShow(show)): xnode.XElement {
		let duration_ms = 0;
		for (let season of show.seasons) {
			for (let episode of season.episodes) {
				duration_ms += episode.segment.file.duration_ms;
			}
		}
		let link = this.EntityLink.forShow(show);
		let image = this.ImageBox.forSquare(is.absent(show.artwork) ? undefined : `/files/${show.artwork.file_id}/`);
		let titles = [
			this.EntityLink.forShow(show)
		];
		let subtitles = show.genres.map((genre) => this.EntityLink.forGenre(genre));
		let tags = [
			"Show",
			metadata.formatDuration(duration_ms)
		];
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forTrack(track: api.Track, playbackButton: xnode.XElement = this.PlaybackButton.forTrack(track)): xnode.XElement {
		let duration_ms = 0;
		duration_ms += track.segment.file.duration_ms;
		let link = this.EntityLink.forTrack(track);
		let image = this.ImageBox.forSquare(is.absent(track.disc.album.artwork) ? undefined : `/files/${track.disc.album.artwork.file_id}/`);
		let titles = [
			this.EntityLink.forTrack(track)
		];
		let subtitles = [
			...track.artists.map((artist) => this.EntityLink.forArtist(artist)),
			this.EntityLink.forAlbum(track.disc.album)
		];
		let tags = [
			"Track",
			`${track.disc.album.year}`,
			metadata.formatDuration(duration_ms)
		];
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forUser(user: api.User): xnode.XElement {
		let link = this.EntityLink.forUser(user);
		let image = this.ImageBox.forSquare();
		let titles = [
			this.EntityLink.forUser(user)
		];
		let subtitles = [
			xnode.element("span").add(xnode.text(user.username))
		];
		let tags = [
			"User"
		];
		return this.make(link, image, undefined, titles, subtitles, tags);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
