export class IntegerAssert {
	private constructor() {}

	static atLeast(min: number, value: number): void {
		this.integer(min);
		this.integer(value);
		if (value < min) {
			throw `Expected ${value} to be at least ${min}!`;
		}
	}

	static atMost(max: number, value: number): void {
		this.integer(value);
		this.integer(max);
		if (value > max) {
			throw `Expected ${value} to be at most ${max}!`;
		}
	}

	static between(min: number, value: number, max: number): void {
		this.atLeast(min, value);
		this.atMost(max, value);
	}

	static exactly(value: number, expected: number): void {
		this.integer(expected);
		this.integer(value);
		if (value !== expected) {
			throw `Expected ${value} to be exactly ${expected}!`;
		}
	}

	static integer(value: number): void {
		if (!Number.isInteger(value)) {
			throw `Expected ${value} to be an integer!`;
		}
	}
};
