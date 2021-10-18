export class StringAssert {
	private constructor() {}

	static identical(value: string, expected: string): string {
		if (value !== expected) {
			throw `Expected "${value}" to be identical to ${expected}!`;
		}
		return value;
	}
};
