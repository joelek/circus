function isString(value: any): value is string {
	return value != null && value.constructor === String;
}

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

	keep(characters: string): string {
		let string = "";
		while (!this.done()) {
			if (characters.indexOf(this.peek(1)) >= 0) {
				break;
			}
			string += this.read(1);
		}
		return string;
	}

	peek(how: string | number): string {
		let length = isString(how) ? how.length : how;
		let min = Math.min(this.offset, this.offset + length);
		let max = Math.max(this.offset, this.offset + length);
		if ((min < 0) || (min >= this.length) || (max < 0) || (max > this.length)) {
			throw "Unable to read between offsets " + min + " and " + max + " because length is " + this.length + "!";
		}
		let string = this.string.substring(min, max);
		if (isString(how)) {
			if (string !== how) {
				throw "Expected \"" + how + "\" but read \"" + string + "\"!";
			}
		}
		return string;
	}

	read(how: string | number): string {
		let string = this.peek(how);
		this.offset += string.length;
		return string;
	}

	seek(offset: number): void {
		if ((offset < 0) || (offset >= this.length)) {
			throw "Unable to seek to offset " + offset + " because length is " + this.length + "!";
		}
		this.offset = offset;
	}

	skip(characters: string): string {
		let string = "";
		while (!this.done()) {
			if (characters.indexOf(this.peek(1)) < 0) {
				break;
			}
			string += this.read(1);
		}
		return string;
	}

	tell(): number {
		return this.offset;
	}
}

export {
	Reader
};
