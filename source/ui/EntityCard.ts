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

	.entity-card__description--compact {
		display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 3;
		max-height: 60px;
		overflow: hidden;
	}

	.entity-card__footer {
		color: ${theme.TEXT_2};
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

function isHighDefinition(width: number, height: number): boolean {
	let is_ultrawide = width * 9 > 16 * height;
	if (is_ultrawide) {
		return width >= 1280;
	} else {
		return height >= 720;
	}
}

type Options = Partial<{
	playbackButton: xnode.XElement,
	compactDescription: boolean,
	image: xnode.XElement
}>;

export class EntityCardFactory {
	private entityTitleFactory: EntityTitleFactory;
	private entityLinkFactory: EntityLinkFactory;
	private ImageBox: ImageBoxFactory;
	private PlaybackButton: PlaybackButtonFactory;

	private make(link: xnode.XElement, image: xnode.XElement, titles: xnode.XElement[], subtitles: xnode.XElement[], tags: xnode.XElement[], description: string | undefined, footer: string | undefined, options: Options = {}): xnode.XElement {
		return link.add(xnode.element("div.entity-card")
			.add(xnode.element("div.entity-card__artwork")
				.add(options.image ?? image)
				.add(xnode.element("div.entity-card__playback")
					.add(options.playbackButton)
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
					.add(is.absent(description) ? undefined : xnode.element(options.compactDescription === false ? "div.entity-card__description" : "div.entity-card__description.entity-card__description--compact")
						.add(xnode.text(description))
					)
					.add(is.absent(footer) ? undefined : xnode.element("div.entity-card__footer")
						.add(xnode.text(footer))
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

	forEntity(entity: api.Entity, options: Options = {}): xnode.XElement {
		if (api.Actor.is(entity)) {
			return this.forActor(entity, options);
		}
		if (api.Album.is(entity)) {
			return this.forAlbum(entity, options);
		}
		if (api.Artist.is(entity)) {
			return this.forArtist(entity, options);
		}
		if (api.Cue.is(entity)) {
			return this.forCue(entity, options);
		}
		if (api.Disc.is(entity)) {
			return this.forDisc(entity, options);
		}
		if (api.Episode.is(entity)) {
			return this.forEpisode(entity, options);
		}
		if (api.Genre.is(entity)) {
			return this.forGenre(entity, options);
		}
		if (api.Playlist.is(entity)) {
			return this.forPlaylist(entity, options);
		}
		if (api.Movie.is(entity)) {
			return this.forMovie(entity, options);
		}
		if (api.Season.is(entity)) {
			return this.forSeason(entity, options);
		}
		if (api.Show.is(entity)) {
			return this.forShow(entity, options);
		}
		if (api.Track.is(entity)) {
			return this.forTrack(entity, options);
		}
		if (api.User.is(entity)) {
			return this.forUser(entity, options);
		}
		if (api.Year.is(entity)) {
			return this.forYear(entity, options);
		}
		throw `Expected code to be unreachable!`;
	}

	forActor(actor: api.Actor, options: Options = {}): xnode.XElement {
		let link = this.entityLinkFactory.forActor(actor);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forActor(actor)
		];
		let subtitles = [] as xnode.XElement[];
		let tags = [
			"Actor"
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, undefined, options);
	}

	forAlbum(album: api.Album, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forAlbum(album);
		let link = this.entityLinkFactory.forAlbum(album);
		let image = this.ImageBox.forSquare(album.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forAlbum(album)
		];
		let subtitles = album.artists.map((artist) => this.entityTitleFactory.forArtist(artist));
		let tags = [
			"Album",
			is.present(album.year) ? `${album.year.year}` : undefined,
			metadata.formatDuration(album.duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, album.copyright, options);
	}

	forArtist(artist: api.Artist, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forArtist(artist);
		let link = this.entityLinkFactory.forArtist(artist);
		let image = this.ImageBox.forSquare(artist.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forArtist(artist)
		];
		let subtitles = new Array<xnode.XElement>();
		let tags = [
			"Artist",
			metadata.formatDuration(artist.duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, undefined, options);
	}

	forCue(cue: api.Cue, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forCue(cue);
		options.image = this.ImageBox.forVideo([`/media/gifs/${cue.cue_id}/`]);
		if (false) {
		} else if (api.Episode.is(cue.media)) {
			return this.forEpisode(cue.media, options);
		} else if (api.Movie.is(cue.media)) {
			return this.forMovie(cue.media, options);
		} else {
			throw `Expected code to be unreachable!`;
		}
	}

	forDirectory(directory: api.Directory, options: Options = {}): xnode.XElement {
		//options.playbackButton = options.playbackButton ?? this.PlaybackButton.forDirectory(directory);
		let link = this.entityLinkFactory.forDirectory(directory);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forDirectory(directory)
		];
		let subtitles = [] as xnode.XElement[];
		let tags = [
			"Directory"
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, undefined, options);
	}

	forDisc(disc: api.Disc, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forDisc(disc);
		let link = this.entityLinkFactory.forDisc(disc);
		let image = this.ImageBox.forSquare(disc.album.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forDisc(disc)
		];
		let subtitles = [
			this.entityTitleFactory.forAlbum(disc.album)
		];
		let tags = [
			"Disc",
			metadata.formatDuration(disc.duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, undefined, options);
	}

	forEpisode(episode: api.Episode, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forEpisode(episode);
		let link = this.entityLinkFactory.forEpisode(episode);
		let image = this.ImageBox.forVideo([`/media/stills/${episode.media.file_id}/`]);
		let titles = [
			this.entityTitleFactory.forEpisode(episode)
		];
		let subtitles = [
			this.entityTitleFactory.forShow(episode.season.show),
			this.entityTitleFactory.forSeason(episode.season)
		];
		let tags = [
			"Episode",
			is.present(episode.year) ? `${episode.year.year}` : undefined,
			metadata.formatDuration(episode.duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		if (isHighDefinition(episode.media.width, episode.media.height)) {
			tags.unshift(xnode.element("div.entity-card__tag.entity-card__tag--accent").add(xnode.text("HD")));
		}
		if (is.present(episode.last_stream_date)) {
			tags.unshift(xnode.element("div.entity-card__tag.entity-card__tag--accent").add(xnode.text("\u2713")));
		}
		return this.make(link, image, titles, subtitles, tags, episode.summary, episode.copyright, options);
	}

	forFile(file: api.File, options: Options = {}): xnode.XElement {
		//options.playbackButton = options.playbackButton ?? this.PlaybackButton.forDirectory(directory);
		let link = this.entityLinkFactory.forFile(file);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forFile(file)
		];
		let subtitles = [] as xnode.XElement[];
		let tags = [
			"File"
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, undefined, options);
	}

	forGenre(genre: api.Genre, options: Options = {}): xnode.XElement {
		let link = this.entityLinkFactory.forGenre(genre);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forGenre(genre)
		];
		let subtitles = [] as xnode.XElement[];
		let tags = [
			"Genre"
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, undefined, options);
	}

	forMovie(movie: api.Movie, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forMovie(movie);
		let link = this.entityLinkFactory.forMovie(movie);
		let image = this.ImageBox.forPoster(movie.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forMovie(movie)
		];
		let subtitles = movie.genres.map((genre) => this.entityTitleFactory.forGenre(genre));
		let tags = [
			"Movie",
			is.present(movie.year) ? `${movie.year.year}` : undefined,
			metadata.formatDuration(movie.duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		if (isHighDefinition(movie.media.width, movie.media.height)) {
			tags.unshift(xnode.element("div.entity-card__tag.entity-card__tag--accent").add(xnode.text("HD")));
		}
		if (is.present(movie.last_stream_date)) {
			tags.unshift(xnode.element("div.entity-card__tag.entity-card__tag--accent").add(xnode.text("\u2713")));
		}
		return this.make(link, image, titles, subtitles, tags, movie.summary, movie.copyright, options);
	}

	forPlaylist(playlist: api.Playlist, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forPlaylist(playlist);
		let link = this.entityLinkFactory.forPlaylist(playlist);
		let image = this.ImageBox.forLandscape(playlist.artwork.map((image) => `/api/files/${image.file_id}/content/`), true);
		let titles = [
			this.entityTitleFactory.forPlaylist(playlist)
		];
		let subtitles = [
			this.entityTitleFactory.forUser(playlist.user)
		];
		let tags = [
			"Playlist",
			metadata.formatDuration(playlist.duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, playlist.description, undefined, options);
	}

	forSeason(season: api.Season, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forSeason(season);
		let link = this.entityLinkFactory.forSeason(season);
		let image = this.ImageBox.forPoster(season.show.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forSeason(season)
		];
		let subtitles = [
			this.entityTitleFactory.forShow(season.show)
		];
		let tags = [
			"Season",
			metadata.formatDuration(season.duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, undefined, options);
	}

	forShow(show: api.Show, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forShow(show);
		let link = this.entityLinkFactory.forShow(show);
		let image = this.ImageBox.forPoster(show.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forShow(show)
		];
		let subtitles = show.genres.map((genre) => this.entityTitleFactory.forGenre(genre));
		let tags = [
			"Show",
			metadata.formatDuration(show.duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, show.summary, undefined, options);
	}

	forTrack(track: api.Track, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forTrack(track);
		let link = this.entityLinkFactory.forTrack(track);
		let image = this.ImageBox.forSquare(track.disc.album.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forTrack(track)
		];
		let subtitles = [
			...track.artists.map((artist) => this.entityTitleFactory.forArtist(artist)),
			this.entityTitleFactory.forAlbum(track.disc.album)
		];
		let tags = [
			"Track",
			metadata.formatDuration(track.duration_ms)
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, track.copyright, options);
	}

	forUser(user: api.User, options: Options = {}): xnode.XElement {
		let link = this.entityLinkFactory.forUser(user);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forUser(user)
		];
		let subtitles = [
			this.entityTitleFactory.forUser(user, {
				title: user.username
			})
		];
		let tags = [
			"User"
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, undefined, options);
	}

	forYear(year: api.Year, options: Options = {}): xnode.XElement {
		options.playbackButton = options.playbackButton ?? this.PlaybackButton.forYear(year);
		let link = this.entityLinkFactory.forYear(year);
		let image = this.ImageBox.forLandscape(year.artwork.map((image) => `/api/files/${image.file_id}/content/`), true);
		let titles = [
			this.entityTitleFactory.forYear(year)
		];
		let subtitles = [] as xnode.XElement[];
		let tags = [
			"Year"
		].filter(is.present).map((tag) => xnode.element("div.entity-card__tag").add(xnode.text(tag)));
		return this.make(link, image, titles, subtitles, tags, undefined, undefined, options);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
