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
	let varint = parseVarint(state);
	let bigint = varint.readBigUInt64LE(0);
	if (bigint > (BigInt(Number.MAX_SAFE_INTEGER) << BigInt(3))) {
		throw "Expected a safe integer!";
	}
	let field_number = Number(bigint >> BigInt(3));
	let wire_type = Number(bigint & BigInt(0x07));
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
		let length = Number(parseVarint(state));
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

export type Message = {
	fields: Array<Field>
};

export function parseMessage(state: State): Message {
	let fields = new Array<Field>();
	while (state.offset < state.buffer.length) {
		let field = parseField(state);
		fields.push(field);
	}
	return {
		fields
	};
};

let message = parseMessage({
	buffer: Buffer.of(0x08,0x00,0x12,0x0b,0x54,0x72,0x40,0x6e,0x24,0x70,0x30,0x72,0x74,0x2d,0x30),
	offset: 0
});
console.log(message);









// little endian
// signed ints are zig-zagged, (n << 1) ^ (n >> 31),
// use last value for non-repeated field
// merge non-repeated object fields occuring more than once before computing final field value, parse concatenated buffers
// packed repeated, wire type 2 lengthdelim bytes, no key, only primitive numeric
// int32 and int64 always use 10 bytes,
