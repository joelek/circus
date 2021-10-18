export class IntegerAssert {
	private constructor() {}

	static atLeast(min: number, value: number): number {
		this.integer(min);
		this.integer(value);
		if (value < min) {
			throw `Expected ${value} to be at least ${min}!`;
		}
		return value;
	}

	static atMost(max: number, value: number): number {
		this.integer(value);
		this.integer(max);
		if (value > max) {
			throw `Expected ${value} to be at most ${max}!`;
		}
		return value;
	}

	static between(min: number, value: number, max: number): number {
		this.integer(min);
		this.integer(value);
		this.integer(max);
		if (value < min || value > max) {
			throw `Expected ${value} to be between ${min} and ${max}!`;
		}
		return value;
	}

	static exactly(value: number, expected: number): number {
		this.integer(expected);
		this.integer(value);
		if (value !== expected) {
			throw `Expected ${value} to be exactly ${expected}!`;
		}
		return value;
	}

	static integer(value: number): number {
		if (!Number.isInteger(value)) {
			throw `Expected ${value} to be an integer!`;
		}
		return value;
	}
};
