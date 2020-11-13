import * as api from "../api/schema/objects";
import * as xnode from "../xnode";
import * as theme from "./theme";
import * as metadata from "./metadata";
import * as is from "../is";
import { EntityTitleFactory } from "./EntityTitleFactory";
import { EntityLinkFactory } from "./EntityLink";
import { ImageBoxFactory } from "./ImageBox";
import { PlaybackButtonFactory } from "./PlaybackButton";

const CSS = `
	.entity-card {
		align-items: start;
		display: grid;
		gap: 24px;
		grid-auto-rows: min-content;
		grid-template-columns: repeat(auto-fit, minmax(240px, auto));
	}

	.entity-card__artwork {
		border-radius: 2px;
		overflow: hidden;
		position: relative;
	}

	.entity-card__playback {
		position: absolute;
			bottom: 16px;
			right: 16px;
	}

	.entity-card__content {

	}

	.entity-card__pusher {
		width: 100vw;
	}

	.entity-card__metadata {
		display: grid;
		gap: 16px;
	}

	.entity-card__titles {
		display: grid;
		gap: 8px;
	}

	.entity-card__title {
		color: ${theme.TEXT_0};
		font-size: 20px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-card__subtitle {
		color: ${theme.TEXT_1};
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-card__tags {
		display: grid;
		gap: 8px;
		grid-auto-columns: minmax(auto, max-content);
		grid-auto-flow: column;
	}

	.entity-card__tag {
		background-color: ${theme.BACKGROUND_3};
		border-radius: 2px;
		color: ${theme.TEXT_1};
		font-size: 12px;
		padding: 4px 8px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-card__tag--accent {
		background-color: ${theme.BACKGROUND_ACCENT};
		color: ${theme.TEXT_ACCENT};
	}

	.entity-card__description {
		color: ${theme.TEXT_1};
		font-size: 16px;
		line-height: 1.25;
		word-break: break-word;
	}

	.entity-card__description--clamp {
		display: -webkit-box;
		max-height: 100px;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 5;
	}
`;

export class EntityCardFactory {
	private entityTitleFactory: EntityTitleFactory;
	private entityLinkFactory: EntityLinkFactory;
	private ImageBox: ImageBoxFactory;
	private PlaybackButton: PlaybackButtonFactory;

	private make(link: xnode.XElement, image: xnode.XElement, playbackButton: xnode.XElement | undefined, titles: xnode.XElement[], subtitles: xnode.XElement[], tags: xnode.XElement[], description?: string): xnode.XElement {
		return link.add(xnode.element("div.entity-card")
			.add(xnode.element("div.entity-card__artwork")
				.add(image)
				.add(xnode.element("div.entity-card__playback")
					.add(playbackButton)
				)
			)
			.add(xnode.element("div.entity-card__content")
				.add(xnode.element("div.entity-card__pusher"))
				.add(xnode.element("div.entity-card__metadata")
					.add(xnode.element("div.entity-card__titles")
						.add(titles.length === 0 ? undefined : xnode.element("div.entity-card__title")
							.add(...xnode.joinarray(titles))
						)
						.add(subtitles.length === 0 ? undefined : xnode.element("div.entity-card__subtitle")
							.add(...xnode.joinarray(subtitles))
						)
					)
					.add(tags.length === 0 ? undefined : xnode.element("div.entity-card__tags")
						.add(...tags)
					)
					.add(is.absent(description) ? undefined : xnode.element("div.entity-card__description.entity-card__description--clamp")
						.add(xnode.text(description))
					)
				)
			)
		);
	}

	constructor(entityTitleFactory: EntityTitleFactory, entityLinkFactory: EntityLinkFactory, ImageBox: ImageBoxFactory, PlaybackButton: PlaybackButtonFactory) {
		this.entityTitleFactory = entityTitleFactory;
		this.entityLinkFactory = entityLinkFactory;
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
		if (api.Genre.is(entity)) {
			return this.forGenre(entity);
		}
		if (api.Person.is(entity)) {
			return this.forPerson(entity);
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
				duration_ms += track.media.duration_ms;
			}
		}
		let link = this.entityLinkFactory.forAlbum(album);
		let image = this.ImageBox.forSquare(album.artwork.map((image) => `/files/${image.file_id}/`).shift());
		let titles = [
			this.entityTitleFactory.forAlbum(album)
		];
		let subtitles = album.artists.map((artist) => this.entityTitleFactory.forArtist(artist));
		let tags = [
			"Album",
			is.present(album.year) ? `${album.year}` : undefined,
			metadata.formatDuration(duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forArtist(artist: api.Artist, playbackButton: xnode.XElement = this.PlaybackButton.forArtist(artist)): xnode.XElement {
		let duration_ms = 0;
		for (let album of artist.albums) {
			for (let disc of album.discs) {
				for (let track of disc.tracks) {
					duration_ms += track.media.duration_ms;
				}
			}
		}
		let link = this.entityLinkFactory.forArtist(artist);
		let image = this.ImageBox.forSquare(artist.albums[0]?.artwork.map((image) => `/files/${image.file_id}/`).shift());
		let titles = [
			this.entityTitleFactory.forArtist(artist)
		];
		let subtitles = new Array<xnode.XElement>();
		let tags = [
			"Artist",
			metadata.formatDuration(duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forDisc(disc: api.Disc, playbackButton: xnode.XElement = this.PlaybackButton.forDisc(disc)): xnode.XElement {
		let duration_ms = 0;
		for (let track of disc.tracks) {
			duration_ms += track.media.duration_ms;
		}
		let link = this.entityLinkFactory.forDisc(disc);
		let image = this.ImageBox.forSquare(disc.album.artwork.map((image) => `/files/${image.file_id}/`).shift());
		let titles = [
			this.entityTitleFactory.forDisc(disc)
		];
		let subtitles = [
			this.entityTitleFactory.forAlbum(disc.album)
		];
		let tags = [
			"Disc",
			metadata.formatDuration(duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forEpisode(episode: api.Episode, playbackButton: xnode.XElement = this.PlaybackButton.forEpisode(episode)): xnode.XElement {
		let duration_ms = 0;
		duration_ms += episode.media.duration_ms;
		let link = this.entityLinkFactory.forEpisode(episode);
		let image = this.ImageBox.forVideo(`/media/stills/${episode.media.file_id}/`);
		let titles = [
			this.entityTitleFactory.forEpisode(episode)
		];
		let subtitles = [
			this.entityTitleFactory.forShow(episode.season.show),
			this.entityTitleFactory.forSeason(episode.season)
		];
		let tags = [
			"Episode",
			is.present(episode.year) ? `${episode.year}` : undefined,
			metadata.formatDuration(duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		if (episode.media.height >= 720) {
			tags.unshift(xnode.element("div.entity-card__tag.entity-card__tag--accent").add(xnode.text("HD")));
		}
		if (is.present(episode.last_stream_date)) {
			tags.unshift(xnode.element("div.entity-card__tag.entity-card__tag--accent").add(xnode.text("\u2713")));
		}
		return this.make(link, image, playbackButton, titles, subtitles, tags, episode.summary);
	}

	forGenre(genre: api.Genre): xnode.XElement {
		let link = this.entityLinkFactory.forGenre(genre);
		let image = this.ImageBox.forSquare();
		let titles = [
			this.entityTitleFactory.forGenre(genre)
		];
		let subtitles = [] as xnode.XElement[];
		let tags = [
			"Genre"
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, undefined, titles, subtitles, tags);
	}

	forMovie(movie: api.Movie, playbackButton: xnode.XElement = this.PlaybackButton.forMovie(movie)): xnode.XElement {
		let duration_ms = 0;
		duration_ms += movie.media.duration_ms;
		let link = this.entityLinkFactory.forMovie(movie);
		let image = this.ImageBox.forPoster(movie.artwork.map((image) => `/files/${image.file_id}/`).shift());
		let titles = [
			this.entityTitleFactory.forMovie(movie)
		];
		let subtitles = movie.genres.map((genre) => this.entityTitleFactory.forGenre(genre));
		let tags = [
			"Movie",
			is.present(movie.year) ? `${movie.year}` : undefined,
			metadata.formatDuration(duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		if (movie.media.height >= 720) {
			tags.unshift(xnode.element("div.entity-card__tag.entity-card__tag--accent").add(xnode.text("HD")));
		}
		if (is.present(movie.last_stream_date)) {
			tags.unshift(xnode.element("div.entity-card__tag.entity-card__tag--accent").add(xnode.text("\u2713")));
		}
		return this.make(link, image, playbackButton, titles, subtitles, tags, movie.summary);
	}

	forPerson(person: api.Person): xnode.XElement {
		let link = this.entityLinkFactory.forPerson(person);
		let image = this.ImageBox.forSquare();
		let titles = [
			this.entityTitleFactory.forPerson(person)
		];
		let subtitles = [] as xnode.XElement[];
		let tags = [
			"Person"
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, undefined, titles, subtitles, tags);
	}

	forPlaylist(playlist: api.Playlist, playbackButton: xnode.XElement = this.PlaybackButton.forPlaylist(playlist)): xnode.XElement {
		let duration_ms = 0;
		for (let item of playlist.items) {
			duration_ms += item.track.media.duration_ms;
		}
		let link = this.entityLinkFactory.forPlaylist(playlist);
		let image = this.ImageBox.forSquare(playlist.items[0]?.track.disc.album.artwork.map((image) => `/files/${image.file_id}/`).shift());
		let titles = [
			this.entityTitleFactory.forPlaylist(playlist)
		];
		let subtitles = [
			this.entityTitleFactory.forUser(playlist.user)
		];
		let tags = [
			"Playlist",
			metadata.formatDuration(duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, playbackButton, titles, subtitles, tags, playlist.description);
	}

	forSeason(season: api.Season, playbackButton: xnode.XElement = this.PlaybackButton.forSeason(season)): xnode.XElement {
		let duration_ms = 0;
		for (let episode of season.episodes) {
			duration_ms += episode.media.duration_ms;
		}
		let link = this.entityLinkFactory.forSeason(season);
		let image = this.ImageBox.forPoster(season.show.artwork.map((image) => `/files/${image.file_id}/`).shift());
		let titles = [
			this.entityTitleFactory.forSeason(season)
		];
		let subtitles = [
			this.entityTitleFactory.forShow(season.show)
		];
		let tags = [
			"Season",
			metadata.formatDuration(duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forShow(show: api.Show, playbackButton: xnode.XElement = this.PlaybackButton.forShow(show)): xnode.XElement {
		let duration_ms = 0;
		for (let season of show.seasons) {
			for (let episode of season.episodes) {
				duration_ms += episode.media.duration_ms;
			}
		}
		let link = this.entityLinkFactory.forShow(show);
		let image = this.ImageBox.forPoster(show.artwork.map((image) => `/files/${image.file_id}/`).shift());
		let titles = [
			this.entityTitleFactory.forShow(show)
		];
		let subtitles = show.genres.map((genre) => this.entityTitleFactory.forGenre(genre));
		let tags = [
			"Show",
			metadata.formatDuration(duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, playbackButton, titles, subtitles, tags, show.summary);
	}

	forTrack(track: api.Track, playbackButton: xnode.XElement = this.PlaybackButton.forTrack(track)): xnode.XElement {
		let duration_ms = 0;
		duration_ms += track.media.duration_ms;
		let link = this.entityLinkFactory.forTrack(track);
		let image = this.ImageBox.forSquare(track.disc.album.artwork.map((image) => `/files/${image.file_id}/`).shift());
		let titles = [
			this.entityTitleFactory.forTrack(track)
		];
		let subtitles = [
			...track.artists.map((artist) => this.entityTitleFactory.forArtist(artist)),
			this.entityTitleFactory.forAlbum(track.disc.album)
		];
		let tags = [
			"Track",
			metadata.formatDuration(duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, playbackButton, titles, subtitles, tags);
	}

	forUser(user: api.User): xnode.XElement {
		let link = this.entityLinkFactory.forUser(user);
		let image = this.ImageBox.forSquare();
		let titles = [
			this.entityTitleFactory.forUser(user)
		];
		let subtitles = [
			xnode.element("span").add(xnode.text(user.username))
		];
		let tags = [
			"User"
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, undefined, titles, subtitles, tags);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
