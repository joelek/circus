export function numberFromBigInt(bigint: bigint): number {
	if (bigint > Number.MAX_SAFE_INTEGER || bigint < Number.MIN_SAFE_INTEGER) {
		throw `Expected a safe integer but got ${bigint}!`;
	}
	return Number(bigint);
};

export type State = {
	buffer: Buffer,
	offset: number
};

export function readBytes(state: State, length: number): Buffer {
	let remaining = state.buffer.length - state.offset;
	if (length > remaining) {
		throw `Expected to read at most ${remaining} bytes but attempted to read ${length} bytes!`;
	}
	let buffer = state.buffer.slice(state.offset, state.offset + length);
	state.offset += length;
	return buffer;
};

export enum WireType {
	VARINT,
	FIXED_64_BIT,
	LENGTH_DELIMITED,
	START_GROUP,
	END_GROUP,
	FIXED_32_BIT
};

export function parseVarint(state: State): Buffer {
	let bytes = Buffer.alloc(10);
	for (let i = 0; i < 10; i++) {
		let byte = state.buffer.readUInt8(state.offset); state.offset += 1;
		bytes[i] = byte;
		if ((byte & 0x80) === 0) {
			if (i + 1 === 10) {
				if ((byte & 0x7E) !== 0) {
					throw "Expected a varint of at most 64 bits!";
				}
			}
			let value = BigInt(0);
			for (let j = i; j >= 0; j--) {
				value = (value << BigInt(7)) | BigInt(bytes[j] & 0x7F);
			}
			let buffer = Buffer.alloc(8);
			buffer.writeBigUInt64LE(value, 0);
			return buffer;
		}
	}
	throw "Expected a varint of at most 10 bytes!";
};

export type Key = {
	field_number: number,
	wire_type: WireType
};

export function parseKey(state: State): Key {
	let bigint = parseVarint(state).readBigUInt64LE(0);
	let field_number = numberFromBigInt(bigint >> BigInt(3));
	let wire_type = numberFromBigInt(bigint & BigInt(0x07));
	return {
		field_number,
		wire_type
	};
};

export type Field = {
	field_number: number,
	data: Buffer
};

export function parseField(state: State): Field {
	let key = parseKey(state);
	let field_number = key.field_number;
	if (key.wire_type === WireType.VARINT) {
		let data = parseVarint(state);
		return {
			field_number,
			data
		};
	}
	if (key.wire_type === WireType.FIXED_64_BIT) {
		let data = readBytes(state, 8);
		return {
			field_number,
			data
		};
	}
	if (key.wire_type === WireType.LENGTH_DELIMITED) {
		let bigint = parseVarint(state).readBigUInt64LE(0);
		let length = numberFromBigInt(bigint);
		let data = readBytes(state, length);
		console.log(data.toString());
		return {
			field_number,
			data
		};
	}
	if (key.wire_type === WireType.START_GROUP) {
		let data = Buffer.alloc(0);
		return {
			field_number,
			data
		};
	}
	if (key.wire_type === WireType.END_GROUP) {
		let data = Buffer.alloc(0);
		return {
			field_number,
			data
		};
	}
	if (key.wire_type === WireType.FIXED_32_BIT) {
		let data = readBytes(state, 4);
		return {
			field_number,
			data
		};
	}
	throw "Expected a recognized wire type!";
}

export function parseFields(state: State): Array<Field> {
	let fields = new Array<Field>();
	while (state.offset < state.buffer.length) {
		let field = parseField(state);
		fields.push(field);
	}
	return fields;
};

export function parseRequiredEnum(field_number: number, fields: Array<Field>): number {
	let candidates = fields.filter((field) => field.field_number === field_number);
	if (candidates.length === 0) {
		throw `Expected required field to be present!`;
	}
	let field = candidates[candidates.length - 1];
	let value = numberFromBigInt(field.data.readBigUInt64LE(0));
	return value;
};

export function parseRequiredString(field_number: number, fields: Array<Field>): string {
	let candidates = fields.filter((field) => field.field_number === field_number);
	if (candidates.length === 0) {
		throw `Expected required field to be present!`;
	}
	let field = candidates[candidates.length - 1];
	let value = field.data.toString();
	return value;
};

export function parseOptionalString(field_number: number, fields: Array<Field>): string | undefined {
	try {
		return parseRequiredString(field_number, fields);
	} catch (error) {
		return undefined;
	}
};

export function parseRequiredBuffer(field_number: number, fields: Array<Field>): Buffer {
	let candidates = fields.filter((field) => field.field_number === field_number);
	if (candidates.length === 0) {
		throw `Expected required field to be present!`;
	}
	let field = candidates[candidates.length - 1];
	let value = field.data;
	return value;
};

export function parseOptionalBuffer(field_number: number, fields: Array<Field>): Buffer | undefined {
	try {
		return parseRequiredBuffer(field_number, fields);
	} catch (error) {
		return undefined;
	}
};
