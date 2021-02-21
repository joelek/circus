import * as xnode from "../xnode";

const CSS = `
	.icon--right {
		transform: rotate(0deg);
	}

	.icon--down {
		transform: rotate(90deg);
	}

	.icon--left {
		transform: rotate(180deg);
	}

	.icon--up {
		transform: rotate(270deg);
	}
`;

type Options = Partial<{
	direction: "right" | "down" | "left" | "up"
}>;

function getClass(direction: Options["direction"]): string {
	if (direction === "right") {
		return "icon--right";
	}
	if (direction === "down") {
		return "icon--down";
	}
	if (direction === "left") {
		return "icon--left";
	}
	if (direction === "up") {
		return "icon--up";
	}
	return "";
}

export class IconFactory {
	constructor() {

	}

	makeBroadcast(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M2,16c-1.1,0-2,0.9-2,2s0.9,2,2,2c1.1,0,2,0.9,2,2c0,1.1,0.9,2,2,2s2-0.9,2-2C8,18.7,5.3,16,2,16z")
			)
			.add(xnode.element("path")
				.set("d", "M2,8c-1.1,0-2,0.9-2,2s0.9,2,2,2c5.5,0,10,4.5,10,10c0,1.1,0.9,2,2,2s2-0.9,2-2C16,14.3,9.7,8,2,8z")
			)
			.add(xnode.element("path")
				.set("d", "M2,0C0.9,0,0,0.9,0,2s0.9,2,2,2c9.9,0,18,8.1,18,18c0,1.1,0.9,2,2,2s2-0.9,2-2C24,9.9,14.1,0,2,0z")
			);
	}

	makeBulletList(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M7,4h16c0.6,0,1-0.4,1-1s-0.4-1-1-1H7C6.4,2,6,2.4,6,3S6.4,4,7,4z")
			)
			.add(xnode.element("path")
				.set("d", "M23,8H7C6.4,8,6,8.4,6,9s0.4,1,1,1h16c0.6,0,1-0.4,1-1S23.6,8,23,8z")
			)
			.add(xnode.element("path")
				.set("d", "M23,20H7c-0.6,0-1,0.4-1,1s0.4,1,1,1h16c0.6,0,1-0.4,1-1S23.6,20,23,20z")
			)
			.add(xnode.element("path")
				.set("d", "M23,14H7c-0.6,0-1,0.4-1,1s0.4,1,1,1h16c0.6,0,1-0.4,1-1S23.6,14,23,14z")
			)
			.add(xnode.element("path")
				.set("d", "M2,1C0.9,1,0,1.9,0,3s0.9,2,2,2s2-0.9,2-2S3.1,1,2,1z")
			)
			.add(xnode.element("path")
				.set("d", "M2,7C0.9,7,0,7.9,0,9c0,1.1,0.9,2,2,2s2-0.9,2-2C4,7.9,3.1,7,2,7z")
			)
			.add(xnode.element("path")
				.set("d", "M2,13c-1.1,0-2,0.9-2,2s0.9,2,2,2s2-0.9,2-2S3.1,13,2,13z")
			)
			.add(xnode.element("path")
				.set("d", "M2,19c-1.1,0-2,0.9-2,2s0.9,2,2,2s2-0.9,2-2S3.1,19,2,19z")
			);
	}

	makeCalendar(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M21,2h-3V1c0-0.6-0.4-1-1-1s-1,0.4-1,1v1H8V1c0-0.6-0.4-1-1-1S6,0.4,6,1v1H3C1.3,2,0,3.3,0,5v4c0,0,0,0,0,0s0,0,0,0v12c0,1.7,1.3,3,3,3h18c1.7,0,3-1.3,3-3V5C24,3.3,22.7,2,21,2z M3,4h3v1c0,0.6,0.4,1,1,1s1-0.4,1-1V4h8v1c0,0.6,0.4,1,1,1s1-0.4,1-1V4h3c0.6,0,1,0.4,1,1v3H2V5C2,4.4,2.4,4,3,4z M21,22H3c-0.6,0-1-0.4-1-1V10h20v11C22,21.6,21.6,22,21,22z")
			);
	}

	makeChevron(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M19.4,10.6l-10-10c-0.8-0.8-2-0.8-2.8,0c-0.8,0.8-0.8,2,0,2.8l8.6,8.6l-8.6,8.6c-0.8,0.8-0.8,2,0,2.8C7,23.8,7.5,24,8,24s1-0.2,1.4-0.6l10-10C20.2,12.6,20.2,11.4,19.4,10.6z")
			);
	}

	makeCross(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M14.8,12l6.6-6.6c0.8-0.8,0.8-2,0-2.8c-0.8-0.8-2-0.8-2.8,0L12,9.2L5.4,2.6c-0.8-0.8-2-0.8-2.8,0c-0.8,0.8-0.8,2,0,2.8L9.2,12l-6.6,6.6c-0.8,0.8-0.8,2,0,2.8C3,21.8,3.5,22,4,22s1-0.2,1.4-0.6l6.6-6.6l6.6,6.6C19,21.8,19.5,22,20,22s1-0.2,1.4-0.6c0.8-0.8,0.8-2,0-2.8L14.8,12z")
			);
	}

	makeDisc(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M12,0C5.4,0,0,5.4,0,12c0,6.6,5.4,12,12,12c6.6,0,12-5.4,12-12C24,5.4,18.6,0,12,0z M12,22C6.5,22,2,17.5,2,12C2,6.5,6.5,2,12,2c5.5,0,10,4.5,10,10C22,17.5,17.5,22,12,22z")
			)
			.add(xnode.element("path")
				.set("d", "M12,10c-1.1,0-2,0.9-2,2s0.9,2,2,2s2-0.9,2-2S13.1,10,12,10z")
			);
	}

	makeMagnifyingGlass(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M23.7,22.3l-6-6c1.4-1.7,2.3-3.9,2.3-6.3c0-5.5-4.5-10-10-10C4.5,0,0,4.5,0,10c0,5.5,4.5,10,10,10c2.4,0,4.6-0.8,6.3-2.3l6,6c0.2,0.2,0.5,0.3,0.7,0.3s0.5-0.1,0.7-0.3C24.1,23.3,24.1,22.7,23.7,22.3z M10,18c-4.4,0-8-3.6-8-8s3.6-8,8-8s8,3.6,8,8S14.4,18,10,18z")
			)
	}

	makeMinus(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M22,10H2c-1.1,0-2,0.9-2,2s0.9,2,2,2h20c1.1,0,2-0.9,2-2S23.1,10,22,10z")
			)
	}

	makeMonitor(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M21,2H3C1.3,2,0,3.3,0,5v12c0,1.7,1.3,3,3,3h18c1.7,0,3-1.3,3-3V5C24,3.3,22.7,2,21,2z M22,17c0,0.6-0.4,1-1,1H3c-0.6,0-1-0.4-1-1V5c0-0.6,0.4-1,1-1h18c0.6,0,1,0.4,1,1V17z")
			)
			.add(xnode.element("path")
				.set("d", "M17,22H7c-0.6,0-1,0.4-1,1s0.4,1,1,1h10c0.6,0,1-0.4,1-1S17.6,22,17,22z")
			)
	}

	makePadlock(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M19,10h-1V6c0-3.3-2.7-6-6-6C8.7,0,6,2.7,6,6v4H5c-0.6,0-1,0.4-1,1v12c0,0.6,0.4,1,1,1h14c0.6,0,1-0.4,1-1V11C20,10.4,19.6,10,19,10z M8,6c0-2.2,1.8-4,4-4c2.2,0,4,1.8,4,4v4H8V6z M18,22H6V12h12V22z")
			)
	}

	makePause(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M6,0C4.9,0,4,0.9,4,2v20c0,1.1,0.9,2,2,2s2-0.9,2-2V2C8,0.9,7.1,0,6,0z")
			)
			.add(xnode.element("path")
				.set("d", "M18,0c-1.1,0-2,0.9-2,2v20c0,1.1,0.9,2,2,2s2-0.9,2-2V2C20,0.9,19.1,0,18,0z")
			);
	}

	makePerson(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M18.9,16.2C17,15.5,16,15,16,13c0-0.5,0.2-0.7,0.5-1.3c0.6-1,1.5-2.4,1.5-5.7c0-3.5-2.5-6-6-6C8.5,0,6,2.5,6,6c0,3.4,0.9,4.7,1.5,5.7C7.8,12.3,8,12.5,8,13c0,2-1,2.5-2.9,3.2C2.9,17,0,18.1,0,23c0,0.6,0.4,1,1,1h22c0.6,0,1-0.4,1-1C24,18.1,21.1,17,18.9,16.2z M2.1,22c0.3-2.7,1.8-3.2,3.7-3.9S10,16.5,10,13c0-1.1-0.4-1.7-0.8-2.4C8.6,9.8,8,8.8,8,6c0-2.4,1.6-4,4-4s4,1.6,4,4c0,2.8-0.6,3.8-1.2,4.6C14.4,11.3,14,11.9,14,13c0,3.5,2.3,4.4,4.2,5.1c1.9,0.7,3.4,1.3,3.7,3.9H2.1z")
			)
	}

	makePieChart(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M17,14h-7V7c0-0.6-0.4-1-1-1c-5,0-9,4-9,9s4,9,9,9c5,0,9-4,9-9C18,14.4,17.6,14,17,14z M9,22c-3.9,0-7-3.1-7-7c0-3.5,2.6-6.4,6-6.9V15c0,0.6,0.4,1,1,1h6.9C15.4,19.4,12.5,22,9,22z")
			)
			.add(xnode.element("path")
				.set("d", "M13,0c-0.6,0-1,0.4-1,1v10c0,0.6,0.4,1,1,1h10c0.6,0,1-0.4,1-1C24,4.9,19.1,0,13,0z M14,10V2.1c4.2,0.5,7.5,3.8,7.9,7.9H14z")
			)
	}

	makePlay(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M21.1,11L3.7,1C2.8,0.5,2,0.9,2,2v20c0,1.1,0.8,1.5,1.7,1l17.3-10C22,12.5,22,11.5,21.1,11z")
			);
	}

	makePlus(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M22,10h-8V2c0-1.1-0.9-2-2-2s-2,0.9-2,2v8H2c-1.1,0-2,0.9-2,2s0.9,2,2,2h8v8c0,1.1,0.9,2,2,2s2-0.9,2-2v-8h8c1.1,0,2-0.9,2-2S23.1,10,22,10z")
			);
	}

	makeReload(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M19.1,8.9c2.2,0,4-1.8,4-4s-1.8-4-4-4c-0.6,0-1.2,0.1-1.7,0.4C12.9-1,7.3-0.2,3.5,3.5c-4.7,4.7-4.7,12.3,0,17C5.9,22.8,8.9,24,12,24c3.1,0,6.1-1.2,8.5-3.5c0.8-0.8,0.8-2,0-2.8s-2-0.8-2.8,0c-3.1,3.1-8.2,3.1-11.3,0c-3.1-3.1-3.1-8.2,0-11.3c2.4-2.4,5.9-2.9,8.8-1.7c0,0.1,0,0.2,0,0.3C15.1,7.1,16.9,8.9,19.1,8.9z")
			);
	}

	makeSkip(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M19.1,11L1.7,1C0.8,0.5,0,0.9,0,2v20c0,1.1,0.8,1.5,1.7,1l17.3-10C20,12.5,20,11.5,19.1,11z")
			).add(xnode.element("path")
				.set("d", "M22,0c-1.1,0-2,0.9-2,2v20c0,1.1,0.9,2,2,2s2-0.9,2-2V2C24,0.9,23.1,0,22,0z")
			);
	}

	makeSpeaker(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M19,0H5C3.3,0,2,1.3,2,3v18c0,1.7,1.3,3,3,3h14c1.7,0,3-1.3,3-3V3C22,1.3,20.7,0,19,0z M20,21c0,0.6-0.4,1-1,1H5c-0.6,0-1-0.4-1-1V3c0-0.6,0.4-1,1-1h14c0.6,0,1,0.4,1,1V21z")
			)
			.add(xnode.element("path")
				.set("d", "M12,10c-2.8,0-5,2.2-5,5s2.2,5,5,5s5-2.2,5-5S14.8,10,12,10z M12,18c-1.7,0-3-1.3-3-3s1.3-3,3-3s3,1.3,3,3S13.7,18,12,18z")
			)
			.add(xnode.element("path")
				.set("d", "M12,8c1.1,0,2-0.9,2-2s-0.9-2-2-2s-2,0.9-2,2S10.9,8,12,8z")
			);
	}

	makeStar(options?: Options): xnode.XElement {
		return xnode.element("svg")
			.set("class", getClass(options?.direction))
			.set("width", "16px")
			.set("height", "16px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M23.8,9.4c-0.2-0.7-0.9-1.2-1.6-1.4l-5.8-0.8L13.8,2c-0.3-0.7-1-1.1-1.8-1.1S10.5,1.3,10.2,2L7.6,7.2L1.9,8C1.1,8.1,0.5,8.7,0.2,9.4c-0.2,0.7,0,1.5,0.5,2l4.2,4.1l-1,5.7c-0.1,0.8,0.2,1.5,0.8,2c0.6,0.4,1.4,0.5,2.1,0.2l5.2-2.7l5.2,2.7c0.3,0.2,0.6,0.2,0.9,0.2c0.4,0,0.8-0.1,1.2-0.4c0.6-0.5,0.9-1.2,0.8-2l-1-5.7l4.2-4.1C23.8,10.9,24,10.1,23.8,9.4z M17.3,14.4C17.1,14.7,17,15,17,15.3l1.1,6.3c0,0,0,0,0,0l-5.6-3c-0.3-0.2-0.6-0.2-0.9,0l-5.6,3L7,15.3C7,15,6.9,14.7,6.7,14.4L2.1,10l6.3-0.9C8.8,9,9,8.8,9.2,8.5L12,2.8l2.8,5.7C15,8.8,15.2,9,15.6,9.1l6.3,0.9L17.3,14.4z")
			);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
