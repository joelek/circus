export class StringAssert {
	private constructor() {}

	static identical(value: string, expected: string): void {
		if (value !== expected) {
			throw `Expected "${value}" to be identical to ${expected}!`;
		}
	}
};
