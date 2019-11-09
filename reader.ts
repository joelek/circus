import * as libutils from "./utils";

class Reader {
	private string: string;
	private offset: number;
	private length: number;

	constructor(string: string) {
		this.string = string;
		this.offset = 0;
		this.length = string.length;
	}

	done(): boolean {
		return (this.offset === this.length);
	}

	line(): string {
		let string = "";
		while (!this.done()) {
			let one = this.string[this.offset];
			this.offset += 1;
			if (false) {
			} else if (one === "\r") {
				if (!this.done()) {
					let two = this.string[this.offset];
					if (two === "\n") {
						this.offset += 1;
					}
				}
				break;
			} else if (one === "\n") {
				if (!this.done()) {
					let two = this.string[this.offset];
					if (two === "\r") {
						this.offset += 1;
					}
				}
				break;
			} else {
				string += one;
			}
		}
		return string;
	}

	peek(length: number): string {
		let min = Math.min(this.offset, this.offset + length);
		let max = Math.max(this.offset, this.offset + length);
		if ((min < 0) || (min >= this.length) || (max < 0) || (max >= this.length)) {
			throw new Error(libutils.join("Unable to read between offsets ", min, " and ", max, "!", "Length is", this.length, "."));
		}
		return this.string.substring(min, max);
	}

	read(length: number): string {
		let string = this.peek(length);
		this.offset += length;
		return string;
	}
}

export {
	Reader
};
