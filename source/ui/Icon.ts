import * as xnode from "../xnode";

const CSS = ``;

export class IconFactory {
	constructor() {

	}

	makeBackward(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 16 16")
			.add(xnode.element("path")
				.set("d", "M13,15.268c-0.173,0-0.346-0.045-0.5-0.134L1.645,8.867c-0.31-0.179-0.5-0.509-0.5-0.866s0.19-0.688,0.5-0.866L12.5,0.866c0.154-0.089,0.327-0.134,0.5-0.134s0.346,0.044,0.5,0.134C13.81,1.044,14,1.375,14,1.732v12.536c0,0.357-0.19,0.688-0.5,0.866C13.346,15.223,13.173,15.268,13,15.268z")
			);
	}

	makeCalendar(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M21,24H3c-1.654,0-3-1.346-3-3V6c0-1.654,1.346-3,3-3h18c1.654,0,3,1.346,3,3v15C24,22.654,22.654,24,21,24z M3,5C2.449,5,2,5.449,2,6v15c0,0.552,0.449,1,1,1h18c0.552,0,1-0.448,1-1V6c0-0.551-0.448-1-1-1H3z")
			)
			.add(xnode.element("path")
				.set("d", "M6,8C5.448,8,5,7.552,5,7V1c0-0.552,0.448-1,1-1s1,0.448,1,1v6C7,7.552,6.552,8,6,8z")
			)
			.add(xnode.element("path")
				.set("d", "M18,8c-0.553,0-1-0.448-1-1V1c0-0.552,0.447-1,1-1s1,0.448,1,1v6C19,7.552,18.553,8,18,8z")
			)
			.add(xnode.element("path")
				.set("d", "M23,12H1c-0.552,0-1-0.447-1-1s0.448-1,1-1h22c0.553,0,1,0.447,1,1S23.553,12,23,12z")
			);
	}

	makeChevron(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M8.414,24c-0.256,0-0.512-0.098-0.707-0.293l-1.414-1.414c-0.391-0.391-0.391-1.023,0-1.414L15.172,12L6.293,3.121c-0.391-0.391-0.391-1.023,0-1.414l1.414-1.414C7.902,0.098,8.158,0,8.414,0s0.512,0.098,0.707,0.293l11,11c0.391,0.391,0.391,1.023,0,1.414l-11,11C8.926,23.902,8.67,24,8.414,24z")
			);
	}

	makeCross(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M19.071,21.485c-0.256,0-0.512-0.098-0.707-0.293L12,14.828l-6.364,6.364c-0.188,0.188-0.442,0.293-0.707,0.293s-0.52-0.105-0.707-0.293l-1.414-1.414c-0.391-0.391-0.391-1.023,0-1.414L9.172,12L2.808,5.636c-0.391-0.391-0.391-1.023,0-1.414l1.414-1.414c0.195-0.195,0.451-0.293,0.707-0.293S5.44,2.612,5.636,2.808L12,9.172l6.364-6.364c0.195-0.195,0.451-0.293,0.707-0.293s0.512,0.098,0.707,0.293l1.414,1.414c0.391,0.391,0.391,1.023,0,1.414L14.828,12l6.364,6.364c0.391,0.391,0.391,1.023,0,1.414l-1.414,1.414C19.583,21.388,19.327,21.485,19.071,21.485z")
			);
	}

	makeBroadcast(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M6,24c-1.104,0-2-0.896-2-2c0-1.103-0.897-2-2-2c-1.104,0-2-0.896-2-2s0.896-2,2-2c3.309,0,6,2.691,6,6C8,23.104,7.104,24,6,24z")
			)
			.add(xnode.element("path")
				.set("d", "M14,24c-1.104,0-2-0.896-2-2c0-5.514-4.486-10-10-10c-1.104,0-2-0.896-2-2s0.896-2,2-2c7.72,0,14,6.28,14,14C16,23.104,15.104,24,14,24z")
			)
			.add(xnode.element("path")
				.set("d", "M22,24c-1.104,0-2-0.896-2-2c0-9.925-8.075-18-18-18C0.896,4,0,3.104,0,2s0.896-2,2-2c12.131,0,22,9.869,22,22C24,23.104,23.104,24,22,24z")
			);
	}

	makeDisc(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M12,24C5.383,24,0,18.617,0,12C0,5.383,5.383,0,12,0c6.617,0,12,5.383,12,12C24,18.617,18.617,24,12,24z M12,2C6.486,2,2,6.486,2,12c0,5.514,4.486,10,10,10c5.514,0,10-4.486,10-10C22,6.486,17.514,2,12,2z")
			)
			.add(xnode.element("circle")
				.set("cx", "12")
				.set("cy", "12")
				.set("r", "2")
			);
	}

	makeForward(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 16 16")
			.add(xnode.element("path")
				.set("d", "M3,15.268c-0.173,0-0.345-0.045-0.5-0.134C2.19,14.955,2,14.625,2,14.268V1.732c0-0.357,0.19-0.688,0.5-0.866C2.655,0.776,2.827,0.732,3,0.732s0.345,0.044,0.5,0.134l10.855,6.269c0.31,0.179,0.5,0.509,0.5,0.866s-0.19,0.688-0.5,0.866L3.5,15.134C3.345,15.223,3.173,15.268,3,15.268z")
			);
	}

	makeFullscreen(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 16 16")
			.add(xnode.element("path")
				.set("d", "M10.343,8.071c-0.266,0-0.52-0.105-0.707-0.293L8.222,6.364c-0.391-0.391-0.391-1.023,0-1.414l2.121-2.121L9.222,1.707C8.936,1.421,8.85,0.991,9.005,0.617C9.16,0.244,9.524,0,9.929,0H15c0.553,0,1,0.448,1,1v5.071c0,0.404-0.243,0.769-0.617,0.924C15.259,7.046,15.129,7.071,15,7.071c-0.26,0-0.516-0.102-0.707-0.293l-1.121-1.121L11.05,7.778C10.862,7.966,10.608,8.071,10.343,8.071L10.343,8.071z")
			)
			.add(xnode.element("path")
				.set("d", "M1,16c-0.552,0-1-0.447-1-1V9.929C0,9.524,0.244,9.16,0.617,9.005C0.741,8.954,0.871,8.929,1,8.929c0.26,0,0.516,0.102,0.707,0.293l1.122,1.121L4.95,8.222c0.195-0.195,0.451-0.293,0.707-0.293s0.512,0.098,0.707,0.293l1.415,1.414c0.188,0.188,0.293,0.441,0.293,0.707c0,0.265-0.105,0.52-0.293,0.707l-2.122,2.122l1.121,1.121c0.286,0.286,0.372,0.716,0.217,1.09S6.475,16,6.071,16H1z")
			);
	}

	makeHome(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 16 16")
			.add(xnode.element("path")
				.set("d", "M3,16c-0.552,0-1-0.447-1-1V9H1.334C0.929,9,0.563,8.755,0.409,8.38C0.255,8.005,0.342,7.574,0.631,7.289l6.662-6.59C7.488,0.506,7.742,0.41,7.996,0.41c0.256,0,0.512,0.098,0.707,0.293L11,3V2c0-0.552,0.447-1,1-1h1c0.553,0,1,0.448,1,1v4l1.293,1.293c0.286,0.286,0.372,0.716,0.217,1.09C15.355,8.756,14.99,9,14.586,9H14v6c0,0.553-0.447,1-1,1H3z")
			);
	}

	makeLast(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 16 16")
			.add(xnode.element("path")
				.set("d", "M15,15.268c-0.173,0-0.346-0.045-0.5-0.134L3.645,8.867c-0.31-0.179-0.5-0.509-0.5-0.866s0.19-0.688,0.5-0.866L14.5,0.866c0.154-0.089,0.327-0.134,0.5-0.134s0.346,0.044,0.5,0.134C15.81,1.044,16,1.375,16,1.732v12.536c0,0.357-0.19,0.688-0.5,0.866C15.346,15.223,15.173,15.268,15,15.268z")
			)
			.add(xnode.element("path")
				.set("d", "M1,16c-0.552,0-1-0.447-1-1V1c0-0.552,0.448-1,1-1h2c0.552,0,1,0.448,1,1v14c0,0.553-0.448,1-1,1H1z")
			);
	}

	makeList(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M22,5H10C9.447,5,9,4.552,9,4s0.447-1,1-1h12c0.553,0,1,0.448,1,1S22.553,5,22,5z")
			)
			.add(xnode.element("path")
				.set("d", "M4,7C2.346,7,1,5.654,1,4s1.346-3,3-3s3,1.346,3,3S5.654,7,4,7z M4,3C3.449,3,3,3.449,3,4s0.449,1,1,1s1-0.449,1-1S4.551,3,4,3z")
			)
			.add(xnode.element("path")
				.set("d", "M4,23c-1.654,0-3-1.346-3-3s1.346-3,3-3s3,1.346,3,3S5.654,23,4,23z M4,19c-0.551,0-1,0.448-1,1s0.449,1,1,1s1-0.448,1-1S4.551,19,4,19z")
			)
			.add(xnode.element("path")
				.set("d", "M4,15c-1.654,0-3-1.346-3-3s1.346-3,3-3s3,1.346,3,3S5.654,15,4,15z M4,11c-0.551,0-1,0.448-1,1s0.449,1,1,1s1-0.448,1-1S4.551,11,4,11z")
			)
			.add(xnode.element("path")
				.set("d", "M22,13H10c-0.553,0-1-0.447-1-1s0.447-1,1-1h12c0.553,0,1,0.447,1,1S22.553,13,22,13z")
			)
			.add(xnode.element("path")
				.set("d", "M22,21H10c-0.553,0-1-0.447-1-1s0.447-1,1-1h12c0.553,0,1,0.447,1,1S22.553,21,22,21z")
			);
	}

	makeLock(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M5,24c-0.552,0-1-0.447-1-1V11c0-0.553,0.448-1,1-1h1V6c0-3.309,2.691-6,6-6s6,2.691,6,6v4h1c0.553,0,1,0.447,1,1v12c0,0.553-0.447,1-1,1H5z M12,4c-1.103,0-2,0.897-2,2v4h4V6C14,4.897,13.103,4,12,4z")
			)
	}

	makeMagnifyingGlass(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M21.586,24c-0.256,0-0.512-0.098-0.707-0.293l-5.367-5.367C13.871,19.426,11.965,20,10,20C4.486,20,0,15.514,0,10C0,4.486,4.486,0,10,0c5.514,0,10,4.486,10,10c0,1.965-0.574,3.871-1.66,5.512l5.367,5.367c0.391,0.391,0.391,1.023,0,1.414l-1.414,1.414C22.098,23.902,21.842,24,21.586,24z M10,4c-3.309,0-6,2.691-6,6s2.691,6,6,6s6-2.691,6-6S13.309,4,10,4z")
			)
	}

	makeMagnifyingGlassLine(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M23.707,22.293l-5.966-5.966C19.152,14.604,20,12.401,20,10c0-5.523-4.478-10-10-10C4.477,0,0,4.477,0,10c0,5.522,4.477,10,10,10c2.401,0,4.604-0.848,6.327-2.259l5.966,5.966C22.488,23.902,22.744,24,23,24s0.512-0.098,0.707-0.293C24.098,23.316,24.098,22.684,23.707,22.293z M10,18c-4.418,0-8-3.582-8-8c0-4.418,3.582-8,8-8c4.418,0,8,3.582,8,8C18,14.418,14.418,18,10,18z")
			)
	}

	makeMinus(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M1,14c-0.552,0-1-0.447-1-1v-2c0-0.553,0.448-1,1-1h22c0.553,0,1,0.447,1,1v2c0,0.553-0.447,1-1,1H1z")
			)
	}

	makeMonitor(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M21,19H3c-1.654,0-3-1.346-3-3V4c0-1.654,1.346-3,3-3h18c1.654,0,3,1.346,3,3v12C24,17.654,22.654,19,21,19z M3,3C2.449,3,2,3.449,2,4v12c0,0.552,0.449,1,1,1h18c0.552,0,1-0.448,1-1V4c0-0.551-0.448-1-1-1H3z")
			)
			.add(xnode.element("path")
				.set("d", "M17,23H7c-0.552,0-1-0.447-1-1s0.448-1,1-1h10c0.553,0,1,0.447,1,1S17.553,23,17,23z")
			)
	}

	makeNext(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 16 16")
			.add(xnode.element("path")
				.set("d", "M1,15.268c-0.173,0-0.345-0.045-0.5-0.134C0.19,14.955,0,14.625,0,14.268V1.732c0-0.357,0.19-0.688,0.5-0.866C0.655,0.776,0.827,0.732,1,0.732s0.345,0.044,0.5,0.134l10.855,6.269c0.31,0.179,0.5,0.509,0.5,0.866s-0.19,0.688-0.5,0.866L1.5,15.134C1.345,15.223,1.173,15.268,1,15.268z")
			).add(xnode.element("path")
				.set("d", "M13,16c-0.553,0-1-0.447-1-1V1c0-0.552,0.447-1,1-1h2c0.553,0,1,0.448,1,1v14c0,0.553-0.447,1-1,1H13z")
			);
	}

	makePause(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 16 16")
			.add(xnode.element("path")
				.set("d", "M3,16c-0.552,0-1-0.447-1-1V1c0-0.552,0.448-1,1-1h2c0.552,0,1,0.448,1,1v14c0,0.553-0.448,1-1,1H3z")
			)
			.add(xnode.element("path")
				.set("d", "M11,16c-0.553,0-1-0.447-1-1V1c0-0.552,0.447-1,1-1h2c0.553,0,1,0.448,1,1v14c0,0.553-0.447,1-1,1H11z")
			);
	}

	makePerson(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M1.057,24c-0.286,0-0.559-0.123-0.749-0.337c-0.19-0.215-0.279-0.5-0.244-0.784c0.415-3.401,2.707-4.398,4.923-5.363c1.996-0.867,3.881-1.688,4-4.26C7.724,11.515,7,8.505,7,5c0-2.991,2.01-5,5-5s5,2.009,5,5c0,3.505-0.725,6.515-1.987,8.256c0.118,2.572,2.003,3.392,3.998,4.26c2.219,0.965,4.511,1.963,4.925,5.363c0.034,0.284-0.055,0.57-0.244,0.784C23.501,23.877,23.229,24,22.942,24H1.057z")
			)
	}

	makePersonLine(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M23,24H1c-0.552,0-1-0.447-1-1c0-4.931,2.929-6.02,5.067-6.813C7.048,15.45,8,15.008,8,13c0-0.466-0.157-0.734-0.513-1.297C6.859,10.711,6,9.353,6,6c0-3.533,2.467-6,6-6c3.532,0,6,2.467,6,6c0,3.353-0.859,4.711-1.487,5.703C16.157,12.266,16,12.534,16,13c0,2.008,0.952,2.45,2.933,3.187C21.071,16.98,24,18.069,24,23C24,23.553,23.553,24,23,24z M2.051,22h19.898c-0.295-2.669-1.826-3.237-3.713-3.938C16.349,17.36,14,16.487,14,13c0-1.064,0.418-1.726,0.823-2.365C15.375,9.762,16,8.773,16,6c0-2.43-1.57-4-4-4S8,3.57,8,6c0,2.773,0.625,3.762,1.177,4.635C9.582,11.274,10,11.936,10,13c0,3.487-2.349,4.36-4.236,5.062S2.345,19.331,2.051,22z")
			)
	}

	makePieChart(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M10,24C4.486,24,0,19.514,0,14C0,8.486,4.486,4,10,4c0.553,0,1,0.448,1,1v8h8c0.553,0,1,0.447,1,1C20,19.514,15.514,24,10,24z M9,6.062C5.059,6.556,2,9.928,2,14c0,4.411,3.589,8,8,8c4.072,0,7.444-3.06,7.938-7H10c-0.553,0-1-0.447-1-1V6.062z")
			)
			.add(xnode.element("path")
				.set("d", "M23,11h-9c-0.553,0-1-0.447-1-1V1c0-0.552,0.447-1,1-1c5.514,0,10,4.486,10,10C24,10.553,23.553,11,23,11z M15,9h6.938C21.485,5.387,18.613,2.515,15,2.062V9z")
			)
	}

	makePlay(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 16 16")
			.add(xnode.element("path")
				.set("d", "M3,15.268c-0.173,0-0.345-0.045-0.5-0.134C2.19,14.955,2,14.625,2,14.268V1.732c0-0.357,0.19-0.688,0.5-0.866C2.655,0.776,2.827,0.732,3,0.732s0.345,0.044,0.5,0.134l10.855,6.269c0.31,0.179,0.5,0.509,0.5,0.866s-0.19,0.688-0.5,0.866L3.5,15.134C3.345,15.223,3.173,15.268,3,15.268z")
			);
	}

	makePlus(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M11,24c-0.553,0-1-0.447-1-1v-9H1c-0.552,0-1-0.447-1-1v-2c0-0.553,0.448-1,1-1h9V1c0-0.552,0.447-1,1-1h2c0.553,0,1,0.448,1,1v9h9c0.553,0,1,0.447,1,1v2c0,0.553-0.447,1-1,1h-9v9c0,0.553-0.447,1-1,1H11z")
			);
	}

	makeStar(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M18.088,22.585c-0.159,0-0.319-0.038-0.466-0.115L12,19.514L6.377,22.47c-0.146,0.077-0.306,0.115-0.465,0.115c-0.207,0-0.414-0.064-0.588-0.191c-0.308-0.224-0.462-0.603-0.398-0.978L6,15.154L1.451,10.72c-0.272-0.266-0.371-0.663-0.253-1.024c0.118-0.362,0.431-0.626,0.807-0.681L8.292,8.1l2.812-5.696C11.271,2.063,11.619,1.847,12,1.847s0.729,0.216,0.896,0.558l2.812,5.696l6.287,0.914c0.377,0.055,0.689,0.318,0.808,0.681c0.117,0.361,0.02,0.759-0.253,1.024L18,15.154l1.073,6.262c0.064,0.375-0.09,0.754-0.397,0.978C18.501,22.521,18.295,22.585,18.088,22.585z")
			);
	}

	makeStarLine(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M18.088,23.585c-0.323,0-0.646-0.08-0.932-0.23L12,20.644l-5.158,2.711c-0.661,0.35-1.501,0.288-2.107-0.152c-0.619-0.45-0.924-1.199-0.795-1.954l0.985-5.745l-4.173-4.067c-0.541-0.527-0.739-1.332-0.505-2.05c0.236-0.729,0.855-1.25,1.614-1.361l5.767-0.839l2.579-5.224C10.545,1.274,11.232,0.847,12,0.847s1.455,0.428,1.794,1.116l2.578,5.224l5.767,0.838c0.758,0.11,1.377,0.631,1.615,1.36c0.236,0.731,0.043,1.517-0.506,2.051l-4.174,4.068l0.984,5.743c0.13,0.755-0.175,1.505-0.795,1.955C18.919,23.453,18.513,23.585,18.088,23.585z M12,2.847L9.188,8.543C9.043,8.838,8.762,9.042,8.436,9.09l-6.287,0.914l4.549,4.435c0.235,0.229,0.343,0.561,0.288,0.885l-1.074,6.262l5.624-2.956c0.291-0.154,0.638-0.154,0.931,0l5.622,2.956c0,0,0,0,0-0.001l-1.073-6.261c-0.056-0.324,0.052-0.655,0.287-0.885l4.55-4.435L15.564,9.09c-0.326-0.047-0.607-0.251-0.753-0.547L12,2.847z")
			);
	}

	makeSpeaker(): xnode.XElement {
		return xnode.element("svg")
			.set("width", "12px")
			.set("height", "12px")
			.set("viewBox", "0 0 24 24")
			.add(xnode.element("path")
				.set("d", "M18,24H6c-1.654,0-3-1.346-3-3V3c0-1.654,1.346-3,3-3h12c1.654,0,3,1.346,3,3v18C21,22.654,19.654,24,18,24z M6,2C5.449,2,5,2.449,5,3v18c0,0.552,0.449,1,1,1h12c0.552,0,1-0.448,1-1V3c0-0.551-0.448-1-1-1H6z")
			)
			.add(xnode.element("path")
				.set("d", "M12,20c-2.757,0-5-2.243-5-5s2.243-5,5-5s5,2.243,5,5S14.757,20,12,20z M12,12c-1.654,0-3,1.346-3,3s1.346,3,3,3s3-1.346,3-3S13.654,12,12,12z")
			)
			.add(xnode.element("circle")
				.set("cx", "12")
				.set("cy", "6")
				.set("r", "2")
			);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
