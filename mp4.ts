import * as libfs from "fs";

type Scope = {
	offset: number,
	length: number
};

class Atom {
	private fd: number;
	private type: string;
	private body: Scope;

	constructor(fd: number, type: string, body: Scope) {
		this.fd = fd;
		this.type = type;
		this.body = body;
	}

	getAllChildren(): Array<Atom> {
		let scope = {
			...this.body
		};
		let atoms = new Array<Atom>();
		while (scope.length > 0) {
			let atom = Atom.parse(this.fd, scope);
			atoms.push(atom);
			scope.offset = atom.body.offset + atom.body.length;
			scope.length = this.body.offset + this.body.length - scope.offset;
		}
		return atoms;
	}

	getBodyScope(): Scope {
		return this.body;
	}

	getChild(type: string): Atom {
		let children = this.getChildren(type);
		if (children.length === 0) {
			throw "Expected at least one child!";
		}
		return children[0];
	}

	getChildren(type: string): Array<Atom> {
		return this.getAllChildren().filter((atom) => {
			return atom.type === type;
		});
	}

	readBody(): Buffer {
		let buffer = Buffer.alloc(this.body.length);
		if (libfs.readSync(this.fd, buffer, 0, buffer.length, this.body.offset) !== buffer.length) {
			throw "Expected exactly " + buffer.length + " bytes!";
		}
		return buffer;
	}

	static parse(fd: number, scope: Scope): Atom {
		let offset = scope.offset;
		let buffer = Buffer.alloc(8);
		if (libfs.readSync(fd, buffer, 0, buffer.length, offset) !== buffer.length) {
			throw "Expected exactly " + buffer.length + " bytes!";
		}
		offset += buffer.length;
		let length = buffer.readUInt32BE(0);
		let type = buffer.slice(4, 4 + 4).toString("binary");
		if (length === 0) {
			length = scope.length - offset;
		} else if (length === 1) {
			if (libfs.readSync(fd, buffer, 0, buffer.length, offset) !== buffer.length) {
				throw "Expected exactly " + buffer.length + " bytes!";
			}
			offset += buffer.length;
			length = Number(buffer.readBigUInt64BE(0));
		}
		// TODO: Figure out how to detect full atoms.
		if (["meta"].indexOf(type) >= 0) {
			offset += 4;
			length -= 4;
		}
		if (length < 8) {
			throw "Expected a length of at least 8 bytes, got " + length + "!";
		} else if (length > scope.length) {
			throw "Expected a length of at most " + scope.length + " bytes, got " + length + "!";
		}
		length -= 8;
		return new Atom(fd, type, {
			offset,
			length
		});
	}
}

function parseFile(fd: number): void {
	let atom = new Atom(fd, "root", {
		offset: 0,
		length: libfs.fstatSync(fd).size
	});
	let moov = atom.getChild("moov");
	try {
		let mvhd = moov.getChild("mvhd");
		let buffer = mvhd.readBody();
		let offset = 12;
		let ts = buffer.readUInt32BE(offset);
		offset += 4;
		let tsdur = buffer.readUInt32BE(offset);
		offset += 4;
		let duration = Math.floor(tsdur / ts * 1000);
		console.log(duration);
	} catch (error) {}
	let udta = moov.getChild("udta");
	let meta = udta.getChild("meta");
	let ilst = meta.getChild("ilst");
	try {
		let buffer = ilst.getChild("tvsh").getChild("data").readBody();
		let show = buffer.slice(8).toString();
		console.log(show);
	} catch (error) {}
	try {
		let buffer = ilst.getChild("tven").getChild("data").readBody();
		let title = buffer.slice(8).toString();
		console.log(title);
	} catch (error) {}
	try {
		let buffer = ilst.getChild("tves").getChild("data").readBody();
		let episode = buffer.readUInt32BE(8);
		console.log(episode);
	} catch (error) {}
	try {
		let buffer = ilst.getChild("tvsn").getChild("data").readBody();
		let season = buffer.readUInt32BE(8);
		console.log(season);
	} catch (error) {}
	try {
		let buffer = ilst.getChild("\u00A9nam").getChild("data").readBody();
		let title = buffer.slice(8).toString();
		console.log(title);
	} catch (error) {}
	try {
		let buffer = ilst.getChild("\u00A9day").getChild("data").readBody();
		let year = Number.parseInt(buffer.slice(8).toString());
		console.log(year);
	} catch (error) {}
	try {
		let buffer = ilst.getChild("\u00A9cmt").getChild("data").readBody();
		let comment = buffer.slice(8).toString();
		console.log(comment);
	} catch (error) {}
}
