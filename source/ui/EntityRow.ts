import * as api from "../api/schema/objects";
import * as xnode from "../xnode";
import * as theme from "./theme";
import * as metadata from "./metadata";
import * as is from "../is";
import { EntityLinkFactory } from "./EntityLink";
import { ImageBoxFactory } from "./ImageBox";

const CSS = `
	.entity-row {
		align-items: start;
		background-color: ${theme.BACKGROUND_3};
		border-radius: 2px;
		display: grid;
		gap: 16px;
		grid-template-columns: 72px 1fr;
		overflow: hidden;
	}

	.entity-row__artwork {
		position: relative;
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

	constructor(EntityLink: EntityLinkFactory, ImageBox: ImageBoxFactory) {
		this.EntityLink = EntityLink;
		this.ImageBox = ImageBox;
	}

	forAlbum(album: api.Album): xnode.XElement {
		let duration_ms = 0;
		for (let disc of album.discs) {
			for (let track of disc.tracks) {
				duration_ms += track.file.duration_ms;
			}
		}
		return xnode.element("div.entity-row")
			.add(xnode.element("div.entity-row__artwork")
				.add(this.ImageBox.forSquare(is.absent(album.artwork) ? undefined : `/files/${album.artwork.file_id}/?token=${null}`))
			)
			.add(xnode.element("div.entity-row__metadata")
				.add(xnode.element("div.entity-row__titles")
					.add(xnode.element("div.entity-row__title")
						.add(xnode.text(album.title))
					)
					.add(xnode.element("div.entity-row__subtitle")
						.add(...xnode.joinarray(album.artists.map((artist) => this.EntityLink.forArtist(artist))))
					)
				)
				.add(xnode.element("div.entity-row__tags")
					.add(xnode.element("div.entity-row__tag")
						.add(xnode.text("Album"))
					)
					.add(xnode.element("div.entity-row__tag")
						.add(xnode.text(`${album.year}`))
					)
					.add(xnode.element("div.entity-row__tag")
						.add(xnode.text(metadata.formatDuration(duration_ms)))
					)
				)
			);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
