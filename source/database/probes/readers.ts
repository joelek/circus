import * as libfs from "fs";

export class Binary {
	private fd: number;
	private cursor: number;
	private size: number;

	private read(buffer: Buffer): Buffer {
		let bytes = libfs.readSync(this.fd, buffer, 0, buffer.length, this.cursor);
		if (bytes !== buffer.length) {
			throw `Expected to read ${buffer.length} bytes but read ${bytes}!`;
		}
		this.cursor += bytes;
		return buffer;
	}

	private skip(length: number): void {
		this.cursor += length;
	}

	private tell(): { cursor: number, size: number } {
		return {
			cursor: this.cursor,
			size: this.size
		};
	}

	constructor(fd: number) {
		this.fd = fd;
		this.cursor = 0;
		this.size = libfs.fstatSync(fd).size;
	}

	newContext<A>(context: (read: (buffer: Buffer) => Buffer, skip: (length: number) => void, tell: () => { cursor: number, size: number }) => A): A {
		let cursor = this.cursor;
		try {
			return context((buffer) => this.read(buffer), (length) => this.skip(length), () => this.tell());
		} catch (error) {
			this.cursor = cursor;
			throw error;
		}
	}
};
