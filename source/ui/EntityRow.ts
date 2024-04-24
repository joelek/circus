import * as api from "../api/schema/objects";
import * as xnode from "../xnode";
import * as theme from "./theme";
import * as is from "../is";
import { EntityTitleFactory } from "./EntityTitleFactory";
import { EntityLinkFactory } from "./EntityLink";
import { ImageBoxFactory } from "./ImageBox";
import { PlaybackButtonFactory } from "./PlaybackButton";

const CSS = `
	.entity-row {
		align-items: center;
		display: grid;
		gap: 16px;
		grid-template-columns: 40px 1fr;
	}

	.entity-row__artwork {
		position: relative;
	}

	.entity-row__playback {
		position: absolute;
			top: 50%; left: 50%;
		transform: translate(-50%, -50%);
	}

	.entity-row__content {

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
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

type Options = Partial<{
	link: xnode.XElement;
	playbackButton: xnode.XElement;
}>;

export class EntityRowFactory {
	private entityTitleFactory: EntityTitleFactory;
	private entityLinkFactory: EntityLinkFactory;
	private ImageBox: ImageBoxFactory;
	private PlaybackButton: PlaybackButtonFactory;

	private make(link: xnode.XElement, image: xnode.XElement, playbackButton: xnode.XElement | undefined, titles: xnode.XElement[], subtitles: xnode.XElement[]): xnode.XElement {
		return link.add(xnode.element("div.entity-row")
			.add(xnode.element("div.entity-row__artwork")
				.add(image)
				.add(xnode.element("div.entity-row__playback")
					.add(playbackButton)
				)
			)
			.add(xnode.element("div.entity-row__content")
				.add(xnode.element("div.entity-row__metadata")
					.add(xnode.element("div.entity-row__titles")
						.add(titles.length === 0 ? undefined : xnode.element("div.entity-row__title")
							.add(...xnode.joinarray(titles))
						)
						.add(subtitles.length === 0 ? undefined : xnode.element("div.entity-row__subtitle")
							.add(...xnode.joinarray(subtitles))
						)
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
		if (api.Directory.is(entity)) {
			return this.forDirectory(entity, options);
		}
		if (api.Disc.is(entity)) {
			return this.forDisc(entity, options);
		}
		if (api.Episode.is(entity)) {
			return this.forEpisode(entity, options);
		}
		if (api.File.is(entity)) {
			return this.forFile(entity, options);
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

	forActor(actor: api.ActorBase, options: Options = {}): xnode.XElement {
		let link = options.link ?? this.entityLinkFactory.forActor(actor);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forActor(actor)
		];
		let subtitles = [] as xnode.XElement[];
		return this.make(link, image, undefined, titles, subtitles);
	}

	forAlbum(album: api.Album, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forAlbum(album);
		let link = options.link ?? this.entityLinkFactory.forAlbum(album);
		let image = this.ImageBox.forSquare(album.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forAlbum(album)
		];
		let subtitles = album.artists.map((artist) => this.entityTitleFactory.forArtist(artist));
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forArtist(artist: api.Artist, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forArtist(artist);
		let link = options.link ?? this.entityLinkFactory.forArtist(artist);
		let image = this.ImageBox.forSquare(artist.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forArtist(artist)
		];
		let subtitles = new Array<xnode.XElement>();
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forCue(cue: api.Cue, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forCue(cue);
		if (false) {
		} else if (api.Episode.is(cue.media)) {
			return this.forEpisode(cue.media, { ...options, playbackButton });
		} else if (api.Movie.is(cue.media)) {
			return this.forMovie(cue.media, { ...options, playbackButton });
		} else {
			throw `Expected code to be unreachable!`;
		}
	}

	forDirectory(directory: api.Directory, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forDirectory(directory);
		let link = options.link ?? this.entityLinkFactory.forDirectory(directory);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forDirectory(directory)
		];
		let subtitles = is.present(directory.parent) ? [
			this.entityTitleFactory.forDirectory(directory.parent)
		] : [] as xnode.XElement[];
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forDisc(disc: api.Disc, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forDisc(disc);
		let link = options.link ?? this.entityLinkFactory.forDisc(disc);
		let image = this.ImageBox.forSquare(disc.album.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forDisc(disc)
		];
		let subtitles = [
			this.entityTitleFactory.forAlbum(disc.album)
		]
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forEpisode(episode: api.Episode, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forEpisode(episode);
		let link = options.link ?? this.entityLinkFactory.forEpisode(episode);
		let image = this.ImageBox.forSquare([`/media/stills/${episode.media.file_id}/`]);
		let titles = [
			this.entityTitleFactory.forEpisode(episode)
		];
		let subtitles = [
			this.entityTitleFactory.forShow(episode.season.show),
			this.entityTitleFactory.forSeason(episode.season)
		];
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forFile(file: api.File, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forFile(file);
		let link = options.link ?? this.entityLinkFactory.forFile(file);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forFile(file)
		];
		let subtitles = is.present(file.parent) ? [
			this.entityTitleFactory.forDirectory(file.parent)
		] : [] as xnode.XElement[];
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forGenre(genre: api.GenreBase, options: Options = {}): xnode.XElement {
		let link = options.link ?? this.entityLinkFactory.forGenre(genre);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forGenre(genre)
		];
		let subtitles = [] as xnode.XElement[];
		return this.make(link, image, undefined, titles, subtitles);
	}

	forMovie(movie: api.Movie, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forMovie(movie);
		let link = options.link ?? this.entityLinkFactory.forMovie(movie);
		let image = this.ImageBox.forSquare(movie.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forMovie(movie)
		];
		let subtitles = movie.genres.map((genre) => this.entityTitleFactory.forGenre(genre));
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forPlaylist(playlist: api.Playlist, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forPlaylist(playlist);
		let link = options.link ?? this.entityLinkFactory.forPlaylist(playlist);
		let image = this.ImageBox.forLandscape(playlist.artwork.map((image) => `/api/files/${image.file_id}/content/`), true);
		let titles = [
			this.entityTitleFactory.forPlaylist(playlist)
		];
		let subtitles = [
			this.entityTitleFactory.forUser(playlist.user)
		];
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forSeason(season: api.Season, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forSeason(season);
		let link = options.link ?? this.entityLinkFactory.forSeason(season);
		let image = this.ImageBox.forSquare(season.show.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forSeason(season)
		];
		let subtitles = [
			this.entityTitleFactory.forShow(season.show)
		];
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forShow(show: api.Show, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forShow(show);
		let link = options.link ?? this.entityLinkFactory.forShow(show);
		let image = this.ImageBox.forSquare(show.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forShow(show)
		];
		let subtitles = show.genres.map((genre) => this.entityTitleFactory.forGenre(genre));
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forTrack(track: api.Track, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forTrack(track);
		let link = options.link ?? this.entityLinkFactory.forTrack(track);
		let image = this.ImageBox.forSquare(track.disc.album.artwork.map((image) => `/api/files/${image.file_id}/content/`));
		let titles = [
			this.entityTitleFactory.forTrack(track)
		];
		let subtitles = [
			...track.artists.map((artist) => this.entityTitleFactory.forArtist(artist)),
			this.entityTitleFactory.forAlbum(track.disc.album)
		];
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	forUser(user: api.User, options: Options = {}): xnode.XElement {
		let link = options.link ?? this.entityLinkFactory.forUser(user);
		let image = this.ImageBox.forSquare([]);
		let titles = [
			this.entityTitleFactory.forUser(user)
		];
		let subtitles = [
			this.entityTitleFactory.forUser(user, {
				title: user.username
			})
		];
		return this.make(link, image, undefined, titles, subtitles);
	}

	forYear(year: api.Year, options: Options = {}): xnode.XElement {
		let playbackButton = "playbackButton" in options ? options.playbackButton : this.PlaybackButton.forYear(year);
		let link = options.link ?? this.entityLinkFactory.forYear(year);
		let image = this.ImageBox.forLandscape(year.artwork.map((image) => `/api/files/${image.file_id}/content/`), true);
		let titles = [
			this.entityTitleFactory.forYear(year)
		];
		let subtitles = [] as xnode.XElement[];
		return this.make(link, image, playbackButton, titles, subtitles);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
