import * as libfs from "fs";

export class Binary {
	private fd: number;
	private offset: number;

	private read(buffer: Buffer): Buffer {
		let bytes = libfs.readSync(this.fd, buffer, 0, buffer.length, this.offset);
		if (bytes !== buffer.length) {
			throw `Expected to read ${buffer.length} bytes but read ${bytes}!`;
		}
		this.offset += bytes;
		return buffer;
	}

	private skip(length: number): void {
		this.offset += length;
	}

	constructor(fd: number) {
		this.fd = fd;
		this.offset = 0;
	}

	newContext<A>(context: (read: (buffer: Buffer) => Buffer, skip: (length: number) => void) => A): A {
		let offset = this.offset;
		try {
			return context((buffer) => this.read(buffer), (length) => this.skip(length));
		} catch (error) {
			this.offset = offset;
			throw error;
		}
	}
};
