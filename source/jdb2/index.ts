import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";
import { IntegerAssert } from "./asserts/integer";
import { StreamIterable } from "../jdb";
import { sorters } from "../jsondb";

const DEBUG = false;

export function open(path: Array<string>): number {
	let filename = path.join("/");
	let exists = libfs.existsSync(filename);
	libfs.mkdirSync(path.slice(0, -1).join("/"), { recursive: true });
	let fd = libfs.openSync(filename, exists ? "r+" : "w+");
	return fd;
};

export function read(fd: number, buffer: Buffer, offset: number): Buffer {
	let length = buffer.length;
	let bytes = libfs.readSync(fd, buffer, {
		position: offset
	});
	if (bytes !== length) {
		throw `Expected to read ${length} bytes but read ${bytes}!`;
	}
	return buffer;
};

export function size(fd: number): number {
	return libfs.fstatSync(fd).size;
};

export function write(fd: number, buffer: Buffer, offset: number): Buffer {
	let length = buffer.length;
	let bytes = libfs.writeSync(fd, buffer, 0, length, offset);
	if (bytes !== length) {
		throw `Expected to write ${length} bytes but wrote ${bytes}!`;
	}
	return buffer;
};

export class Chunk {
	readonly buffer: Buffer;

	constructor(buffer: Buffer) {
		this.buffer = buffer;
	}

	load(fd: number, offset: number): void {
		read(fd, this.buffer, offset);
	}

	save(fd: number, offset: number): void {
		write(fd, this.buffer, offset);
	}
};

export class Counter extends Chunk {
	static SIZE = 4;

	get count(): number {
		return this.buffer.readUInt32BE(0);
	}

	set count(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 0);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Counter.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Counter.SIZE);
		super(buffer);
	}
};

export class Pointer extends Chunk {
	static SIZE = 4;

	get index(): number {
		return this.buffer.readUInt32BE(0);
	}

	set index(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 0);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Pointer.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Pointer.SIZE);
		super(buffer);
	}
};

export class Entry extends Chunk {
	static SIZE = 16;

	get offset(): number {
		return Number(this.buffer.readBigUInt64BE(0));
	}

	set offset(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFFFFFF);
		this.buffer.writeBigUInt64BE(BigInt(value), 0);
	}

	get deleted(): boolean {
		return this.buffer.readUInt8(8) === 0x80;
	}

	set deleted(value: boolean) {
		this.buffer.writeUInt8(value ? 0x80 : 0x00, 8);
	}

	get length(): number {
		return Number(this.buffer.readBigUInt64BE(8) & BigInt(0xFFFFFFFFFFFF)) + 1;
	}

	set length(value: number) {
		value = value - 1;
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFFFFFF);
		let deleted = this.deleted;
		this.buffer.writeBigUInt64BE(BigInt(value), 8);
		this.deleted = deleted;
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Entry.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Entry.SIZE);
		super(buffer);
	}
};

export type WeightProvider<A> = (value: A) => number;
export type Value = boolean | string | number | null | undefined;

export class Cache<A extends Value, B> {
	private map: Map<A, B>;
	private weightProvider: WeightProvider<B>;
	private maxWeight?: number;
	private weight: number;

	private purge(): void {
		if (is.present(this.maxWeight)) {
			for (let [key, last] of this.map.entries()) {
				if (this.weight <= this.maxWeight) {
					break;
				}
				this.weight -= this.weightProvider(last);
				this.map.delete(key);
			}
		}
	}

	constructor(weightProvider: WeightProvider<B>, maxWeight?: number) {
		this.map = new Map<A, B>();
		this.weightProvider = weightProvider;
		this.maxWeight = maxWeight;
		this.weight = 0;
	}

	insert(key: A, value: B | undefined): void {
		this.remove(key);
		if (is.present(value)) {
			this.weight += this.weightProvider(value);
			this.map.set(key, value);
			this.purge();
		}
	}

	lookup(key: A): B | undefined {
		return this.map.get(key);
	}

	remove(key: A): B | undefined {
		let value = this.map.get(key);
		if (is.present(value)) {
			this.weight -= this.weightProvider(value);
			this.map.delete(key);
		}
		return value;
	}
};

export class BlockHandler {
	static FIRST_APPLICATION_BLOCK = 64;

	private bin: number;
	private toc: number;
	private blockCache: Cache<number, Buffer>;
	private entryCache: Cache<number, Entry>;

	private computePool(minLength: number): number {
		if (DEBUG) IntegerAssert.atLeast(0, minLength);
		let lengthLog2 = Math.ceil(Math.log2(Math.max(1, minLength)));
		return lengthLog2;
	}

	private createNewBlock(minLength: number): number {
		let entry = new Entry();
		entry.offset = size(this.bin);
		entry.length = Math.pow(2, this.computePool(minLength));
		write(this.bin, Buffer.alloc(entry.length), entry.offset);
		write(this.toc, entry.buffer, size(this.toc));
		return this.getCount() - 1;
	}

	private createOldBlock(minLength: number): number {
		let pool = this.computePool(minLength);
		let counter = new Counter();
		this.readBlock(pool, counter.buffer, 0);
		if (counter.count === 0) {
			throw ``;
		}
		let pointer = new Pointer();
		this.readBlock(pool, pointer.buffer, Counter.SIZE + (counter.count - 1) * Pointer.SIZE);
		let index = pointer.index;
		pointer.index = 0;
		this.writeBlock(pool, pointer.buffer, Counter.SIZE + (counter.count - 1) * Pointer.SIZE);
		counter.count -= 1;
		this.writeBlock(pool, counter.buffer, 0);
		let entry = new Entry();
		this.readEntry(index, entry);
		entry.deleted = false;
		this.writeEntry(index, entry);
		return index;
	}

	private readEntry(index: number, entry: Entry): Entry {
		if (DEBUG) IntegerAssert.between(0, index, this.getCount() - 1);
		let cached = this.entryCache.lookup(index);
		if (is.absent(cached)) {
			cached = new Entry();
			read(this.toc, cached.buffer, index * Entry.SIZE);
			this.entryCache.insert(index, cached);
		}
		cached.buffer.copy(entry.buffer, 0, 0);
		return entry;
	}

	private writeEntry(index: number, entry: Entry): Entry {
		if (DEBUG) IntegerAssert.between(0, index, this.getCount() - 1);
		write(this.toc, entry.buffer, index * Entry.SIZE);
		let cached = new Entry();
		entry.buffer.copy(cached.buffer, 0, 0);
		this.entryCache.insert(index, cached);
		return entry;
	}

	constructor(path: Array<string>) {
		this.bin = open([...path, "bin"]);
		this.toc = open([...path, "toc"]);
		this.blockCache = new Cache<number, Buffer>((value) => value.length, 256 * 1024 * 1024);
		this.entryCache = new Cache<number, Entry>((value) => 1, 1 * 1000 * 1000);
		if (this.getCount() === 0) {
			for (let i = 0; i < BlockHandler.FIRST_APPLICATION_BLOCK; i++) {
				this.createNewBlock(16);
			}
		}
	}

	createBlock(minLength: number): number {
		try {
			return this.createOldBlock(minLength);
		} catch (error) {}
		try {
			return this.createNewBlock(minLength);
		} catch (error) {}
		throw `Unable to create block with length ${minLength}!`;
	}

	deleteBlock(index: number): void {
		let entry = new Entry();
		this.readEntry(index, entry);
		if (entry.deleted) {
			return;
		}
		let pool = this.computePool(entry.length);
		let counter = new Counter();
		this.readBlock(pool, counter.buffer, 0);
		let minLength = Counter.SIZE + (counter.count + 1) * Pointer.SIZE;
		let length = this.readEntry(pool, new Entry()).length;
		if (minLength > length) {
			this.resizeBlock(pool, minLength);
			this.readBlock(pool, counter.buffer, 0); // Resize can in theory consume one block.
		}
		let pointer = new Pointer();
		pointer.index = index;
		this.writeBlock(pool, pointer.buffer, Counter.SIZE + (counter.count * Pointer.SIZE));
		counter.count += 1;
		this.writeBlock(pool, counter.buffer, 0);
		let buffer = Buffer.alloc(entry.length);
		this.writeBlock(index, buffer, 0);
		entry.deleted = true;
		this.writeEntry(index, entry);
		this.blockCache.remove(index);
	}

	getBlockSize(index: number): number {
		let entry = new Entry();
		this.readEntry(index, entry);
		return entry.length;
	}

	getCount(): number {
		let count = size(this.toc) / Entry.SIZE;
		if (DEBUG) IntegerAssert.atLeast(0, count);
		return count;
	}

	readBlock(index: number, buffer?: Buffer, skipLength?: number): Buffer {
		let entry = new Entry();
		this.readEntry(index, entry);
		buffer = buffer ?? Buffer.alloc(entry.length);
		let offset = skipLength ?? 0;
		let length = buffer.length;
		if (DEBUG) IntegerAssert.between(0, offset, entry.length - 1);
		if (DEBUG) IntegerAssert.between(0, length, entry.length - offset);
		let cached = this.blockCache.lookup(index);
		if (is.absent(cached)) {
			cached = Buffer.alloc(entry.length);
			read(this.bin, cached, entry.offset);
			this.blockCache.insert(index, cached);
		}
		cached.copy(buffer, 0, offset);
		return buffer;
	}

	resizeBlock(index: number, minLength: number): void {
		let entry = new Entry();
		this.readEntry(index, entry);
		if (this.computePool(minLength) === this.computePool(entry.length)) {
			return;
		}
		let indexTwo = this.createBlock(minLength);
		let entryTwo = new Entry();
		this.readEntry(indexTwo, entryTwo);
		let length = Math.min(entry.length, entryTwo.length);
		let buffer = Buffer.alloc(length);
		this.readBlock(index, buffer);
		this.writeBlock(indexTwo, buffer);
		this.swapBlocks(index, indexTwo);
		this.deleteBlock(indexTwo);
	}

	swapBlocks(indexOne: number, indexTwo: number): void {
		let entryOne = new Entry();
		this.readEntry(indexOne, entryOne);
		let entryTwo = new Entry();
		this.readEntry(indexTwo, entryTwo);
		this.writeEntry(indexOne, entryTwo);
		this.writeEntry(indexTwo, entryOne);
		let blockOne = this.blockCache.remove(indexOne);
		let blockTwo = this.blockCache.remove(indexTwo);
		this.blockCache.insert(indexOne, blockTwo);
		this.blockCache.insert(indexTwo, blockOne);
	}

	writeBlock(index: number, buffer?: Buffer, skipLength?: number): Buffer {
		let entry = new Entry();
		this.readEntry(index, entry);
		buffer = buffer ?? Buffer.alloc(entry.length);
		let offset = skipLength ?? 0;
		let length = buffer.length;
		if (DEBUG) IntegerAssert.between(0, offset, entry.length - 1);
		if (DEBUG) IntegerAssert.between(0, length, entry.length - offset);
		write(this.bin, buffer, entry.offset + offset);
		if (is.absent(skipLength)) {
			write(this.bin, Buffer.alloc(entry.length - buffer.length), entry.offset + buffer.length);
		}
		let cached = this.blockCache.lookup(index);
		if (is.present(cached)) {
			cached.set(buffer, offset);
			if (is.absent(skipLength)) {
				cached.set(Buffer.alloc(entry.length - buffer.length), buffer.length);
			}
		}
		return buffer
	}
};

export class Node extends Chunk {
	static MAX_PREFIX_LENGTH = 7;
	static SIZE = 16;

	get prefixBytes(): Buffer {
		let length = this.buffer.readUInt8(0);
		let buffer = Buffer.alloc(length);
		buffer.set(this.buffer.slice(1, 1 + length), 0);
		return buffer;
	}

	set prefixBytes(value: Buffer) {
		let length = value.length;
		if (DEBUG) IntegerAssert.between(0, length, Node.MAX_PREFIX_LENGTH);
		this.buffer.writeUInt8(length, 0);
		this.buffer.set(value, 1);
		this.buffer.fill(0, 1 + length, 1 + Node.MAX_PREFIX_LENGTH);
	}

	get pointersIndex(): number {
		return this.buffer.readUInt32BE(8);
	}

	set pointersIndex(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 8);
	}

	get residentIndex(): number {
		return this.buffer.readUInt32BE(12);
	}

	set residentIndex(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 12);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Node.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Node.SIZE);
		super(buffer);
	}
};

export class Pointers extends Chunk {
	static SIZE = 256 * Pointer.SIZE;

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Pointers.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Pointers.SIZE);
		super(buffer);
	}

	get(index: number): number {
		if (DEBUG) IntegerAssert.between(0, index, 255);
		return this.buffer.readUInt32BE(index * Pointer.SIZE);
	}

	set(index: number, value: number): void {
		if (DEBUG) IntegerAssert.between(0, index, 255);
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, index * Pointer.SIZE);
	}
};

export type ValueProvider<A> = (record: A) => Value;
export type ValuesProvider<A> = (record: A) => Array<Value>;
export type RecordParser<A> = (json: any) => A;
export type Tokenizer = (value: Value) => Array<Value>;

export type SearchResult<A> = {
	keyBytes: Buffer,
	rank: number;
	lookup: () => A;
};

export type TableEventMap<A> = {
	"insert": {
		key: Value,
		record: A
	},
	"remove": {
		key: Value,
		record: A
	}
};

export function computeCommonPrefixLength(prefixBytes: Buffer, keyBytes: Buffer, keyByteIndex: number): number {
	let length = Math.min(prefixBytes.length, keyBytes.length - keyByteIndex);
	for (let i = 0; i < length; i++) {
		let prefixByte = prefixBytes[i];
		let keyByte = keyBytes[keyByteIndex + i];
		if (prefixByte !== keyByte) {
			return i;
		}
	}
	return length;
};

export function serializeKey(key: Value): Buffer {
	if (typeof key === "boolean") {
		return Buffer.of(key ? 1 : 0);
	}
	if (typeof key === "number") {
		return Buffer.from(`${key}`);
	}
	if (typeof key === "string") {
		if (/^[0-9a-f]{8,}$/i.test(key)) {
			return Buffer.from(key, "hex");
		} else {
			return Buffer.from(key, "binary");
		}
	}
	return Buffer.alloc(0);
};

export function deserializeKey(buffer: Buffer): Value {
	return buffer.toString("binary");
};

export class Table<A> extends stdlib.routing.MessageRouter<TableEventMap<A>> {
	static ROOT_NODE_INDEX = BlockHandler.FIRST_APPLICATION_BLOCK;
	static NODE_SIZE = 8 + Pointer.SIZE * 2;
	static TABLE_SIZE = Pointer.SIZE * 256;

	private blockHandler: BlockHandler;
	private recordParser: RecordParser<A>;
	private keyProvider?: ValueProvider<A>;

	private getRecord(index: number): A {
		let block = this.blockHandler.readBlock(index);
		let string = block.toString().replace(/[\0]*$/, "");
		let json = JSON.parse(string);
		let record = this.recordParser(json);
		return record;
	}

	private *createIterable(nodeIndex: number, options?: Partial<{ path: Array<Buffer>, rank: number, recursive: boolean }>): Iterable<{ keyBytes: Buffer, index: number, rank: number }> {
		let rank = options?.rank ?? 0;
		let recursive = options?.recursive ?? false;
		let path = options?.path?.slice() ?? new Array<Buffer>();
		let node = new Node();
		this.blockHandler.readBlock(nodeIndex, node.buffer);
		path.push(node.prefixBytes);
		if (node.residentIndex !== 0) {
			yield {
				keyBytes: Buffer.concat(path),
				index: node.residentIndex,
				rank: rank
			};
		}
		if (recursive) {
			if (node.pointersIndex !== 0) {
				let pointer = new Pointer();
				for (let i = 0; i < 256; i++) {
					this.blockHandler.readBlock(node.pointersIndex, pointer.buffer, i * Pointer.SIZE);
					if (pointer.index !== 0) {
						yield* this.createIterable(pointer.index, {
							...options,
							path: [...path, Buffer.of(i)],
							rank: rank - 1
						});
					}
				}
			}
		}
	}

	constructor(blockHandler: BlockHandler, recordParser: RecordParser<A>, keyProvider?: ValueProvider<A>) {
		super();
		this.blockHandler = blockHandler;
		this.recordParser = recordParser;
		this.keyProvider = keyProvider;
		if (blockHandler.getCount() === Table.ROOT_NODE_INDEX) {
			blockHandler.createBlock(Table.NODE_SIZE);
		}
	}

	*[Symbol.iterator](): Iterator<A> {
		yield* StreamIterable.of(this.createIterable(Table.ROOT_NODE_INDEX, { recursive: true }))
			.map((node) => this.getRecord(node.index))
			.slice();
	}

	debug(index: number = Table.ROOT_NODE_INDEX, depth: number = 0): void {
		let node = new Node();
		this.blockHandler.readBlock(index, node.buffer);
		console.log("\t".repeat(depth), `${node.prefixBytes.toString("hex")}`);
		if (node.residentIndex !== 0) {
			console.log("\t".repeat(depth), JSON.stringify(this.getRecord(node.residentIndex)));
		}
		if (node.pointersIndex !== 0) {
			let pointer = new Pointer();
			for (let i = 0; i < 256; i++) {
				this.blockHandler.readBlock(node.pointersIndex, pointer.buffer, i * Pointer.SIZE);
				if (pointer.index !== 0) {
					console.log("\t".repeat(depth), `${Buffer.of(i).toString("hex")} =>`);
					this.debug(pointer.index, depth + 1);
				}
			}
		}
	}

	entries(): Iterable<[Value, A]> {
		return StreamIterable.of(this.createIterable(Table.ROOT_NODE_INDEX, { recursive: true }))
			.map<[Value, A]>((node) => [deserializeKey(node.keyBytes), this.getRecord(node.index)])
			.slice();
	}

	insert(record: A, options?: Partial<{ key: Value, index: number }>): void {
		let serializedRecord = Buffer.from(JSON.stringify(record));
		let key = this.keyProvider?.(record) ?? options?.key;
		let keyBytes = serializeKey(key);
		let keyByteIndex = 0;
		let currentNodeIndex = options?.index ?? Table.ROOT_NODE_INDEX;
		let currentNode = new Node();
		let newNode = new Node();
		let pointer = new Pointer();
		while (true) {
			this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
			let prefixBytes = currentNode.prefixBytes;
			let commonPrefixLength = computeCommonPrefixLength(prefixBytes, keyBytes, keyByteIndex);
			if (commonPrefixLength < prefixBytes.length) {
				pointer.index = this.blockHandler.createBlock(Node.SIZE);
				newNode.prefixBytes = prefixBytes.slice(commonPrefixLength + 1);
				newNode.pointersIndex = currentNode.pointersIndex;
				newNode.residentIndex = currentNode.residentIndex;
				this.blockHandler.writeBlock(pointer.index, newNode.buffer);
				currentNode.prefixBytes = prefixBytes.slice(0, commonPrefixLength);
				currentNode.pointersIndex = this.blockHandler.createBlock(Pointers.SIZE);
				currentNode.residentIndex = 0;
				this.blockHandler.writeBlock(currentNodeIndex, currentNode.buffer);
				this.blockHandler.writeBlock(currentNode.pointersIndex, pointer.buffer, prefixBytes[commonPrefixLength] * Pointer.SIZE);
			}
			let keyBytesLeft = keyBytes.length - keyByteIndex;
			if (keyBytesLeft === commonPrefixLength) {
				break;
			}
			keyByteIndex += commonPrefixLength;
			if (currentNode.pointersIndex === 0) {
				currentNode.pointersIndex = this.blockHandler.createBlock(Pointers.SIZE);
				this.blockHandler.writeBlock(currentNodeIndex, currentNode.buffer);
			}
			this.blockHandler.readBlock(currentNode.pointersIndex, pointer.buffer, keyBytes[keyByteIndex] * Pointer.SIZE);
			if (pointer.index === 0) {
				pointer.index = this.blockHandler.createBlock(Node.SIZE);
				newNode.prefixBytes = keyBytes.slice(keyByteIndex + 1, keyByteIndex + 1 + Node.MAX_PREFIX_LENGTH);
				newNode.pointersIndex = 0;
				newNode.residentIndex = 0;
				this.blockHandler.writeBlock(pointer.index, newNode.buffer);
				this.blockHandler.writeBlock(currentNode.pointersIndex, pointer.buffer, keyBytes[keyByteIndex] * Pointer.SIZE);
			}
			keyByteIndex += 1;
			currentNodeIndex = pointer.index;
		}
		this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
		if (currentNode.residentIndex === 0) {
			pointer.index = this.blockHandler.createBlock(serializedRecord.length);
			this.blockHandler.writeBlock(pointer.index, serializedRecord);
			currentNode.residentIndex = pointer.index;
			this.blockHandler.writeBlock(currentNodeIndex, currentNode.buffer);
		} else {
			this.blockHandler.resizeBlock(currentNode.residentIndex, serializedRecord.length);
			this.blockHandler.writeBlock(currentNode.residentIndex, serializedRecord);
		}
		this.route("insert", {
			key: key,
			record: record
		});
	}

	lookup(key: Value, options?: Partial<{ index: number }>): A {
		let results = this.search(key, options);
		for (let result of results) {
			let record = result.lookup();
			if (result.keyBytes.equals(serializeKey(key))) {
				return record;
			}
			break;
		}
		throw `Expected a record for ${key}!`;
	}

	remove(record: A, options?: Partial<{ key: Value, index: number }>): void {
		let key = this.keyProvider?.(record) ?? options?.key;
		let keyBytes = serializeKey(key);
		let keyByteIndex = 0;
		let currentNodeIndex = options?.index ?? Table.ROOT_NODE_INDEX;
		let currentNode = new Node();
		let pointer = new Pointer();
		while (true) {
			this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
			let prefixBytes = currentNode.prefixBytes;
			let commonPrefixLength = computeCommonPrefixLength(prefixBytes, keyBytes, keyByteIndex);
			if (commonPrefixLength < prefixBytes.length) {
				return;
			}
			let keyBytesLeft = keyBytes.length - keyByteIndex;
			if (keyBytesLeft === commonPrefixLength) {
				break;
			}
			keyByteIndex += commonPrefixLength;
			if (currentNode.pointersIndex === 0) {
				return;
			}
			this.blockHandler.readBlock(currentNode.pointersIndex, pointer.buffer, keyBytes[keyByteIndex] * Pointer.SIZE);
			if (pointer.index === 0) {
				return;
			}
			keyByteIndex += 1;
			currentNodeIndex = pointer.index;
		}
		this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
		if (currentNode.residentIndex !== 0) {
			this.blockHandler.deleteBlock(currentNode.residentIndex);
			currentNode.residentIndex = 0;
			this.blockHandler.writeBlock(currentNodeIndex, currentNode.buffer);
			this.route("remove", {
				key: key,
				record: record
			});
		}
	}

	search(key: Value, options?: Partial<{ index: number, prefix: boolean }>): StreamIterable<SearchResult<A>> {
		let keyBytes = serializeKey(key);
		let keyByteIndex = 0;
		let currentNodeIndex = options?.index ?? Table.ROOT_NODE_INDEX;
		let currentNode = new Node();
		let pointer = new Pointer();
		while (true) {
			this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
			let prefixBytes = currentNode.prefixBytes;
			let commonPrefixLength = computeCommonPrefixLength(prefixBytes, keyBytes, keyByteIndex);
			if (commonPrefixLength < prefixBytes.length) {
				return StreamIterable.of([]);
			}
			let keyBytesLeft = keyBytes.length - keyByteIndex;
			if (keyBytesLeft === commonPrefixLength) {
				break;
			}
			keyByteIndex += commonPrefixLength;
			if (currentNode.pointersIndex === 0) {
				return StreamIterable.of([]);
			}
			this.blockHandler.readBlock(currentNode.pointersIndex, pointer.buffer, keyBytes[keyByteIndex] * Pointer.SIZE);
			if (pointer.index === 0) {
				return StreamIterable.of([]);
			}
			keyByteIndex += 1;
			currentNodeIndex = pointer.index;
		}
		let prefix = options?.prefix ?? false;
		return StreamIterable.of(this.createIterable(currentNodeIndex, { path: [keyBytes.slice(0, keyByteIndex)], recursive: prefix }))
			.map((node) => ({
				...node,
				lookup: () => this.getRecord(node.index)
			}));
	}

	update(record: A): void {
		this.insert(record);
	}
};

export class Index<A, B> {
	static NUMBER_TOKENIZER: Tokenizer = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFC");
		return Array.from(normalized.match(/(\p{N}+)/gu) ?? []);
	};
	static QUERY_TOKENIZER: Tokenizer = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFC");
		return Array.from(normalized.match(/(\p{L}+|\p{N}+)/gu) ?? []);
	};
	static VALUE_TOKENIZER: Tokenizer = (value) => {
		return [value];
	};
	static WORD_TOKENIZER: Tokenizer = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFC");
		return Array.from(normalized.match(/(\p{L}+)/gu) ?? []);
	};

	private tokenTable: Table<number>;
	private keyTable: Table<{}>;
	private parentTable: Table<A>;
	private childTable: Table<B>;
	private getIndexedValues: ValuesProvider<B>;
	private getTokens: Tokenizer;

	constructor(blockHandler: BlockHandler, parentTable: Table<A>, childTable: Table<B>, getIndexedValues: ValuesProvider<B>, getTokens: Tokenizer = Index.VALUE_TOKENIZER) {
		let tokenTable = new Table<number>(blockHandler, autoguard.guards.Number.as);
		let keyTable = new Table<{}>(blockHandler, autoguard.guards.Object.of({}).as);
		function insert(key: Value, record: B) {
			let values = getIndexedValues(record);
			for (let value of values) {
				let tokens = getTokens(value);
				for (let token of tokens) {
					let index: number | undefined;
					try {
						index = tokenTable.lookup(token);
					} catch (error) {}
					if (is.absent(index)) {
						index = blockHandler.createBlock(Table.NODE_SIZE);
						tokenTable.insert(index, {
							key: token
						});
					}
					keyTable.insert({}, {
						index,
						key: key
					});
				}
			}
		}
		function remove(key: Value, record: B) {
			let values = getIndexedValues(record);
			for (let value of values) {
				let tokens = getTokens(value);
				for (let token of tokens) {
					let index: number | undefined;
					try {
						index = tokenTable.lookup(token);
					} catch (error) {
						continue;
					}
					keyTable.remove({}, {
						index,
						key: key
					});
				}
			}
		}
		childTable.addObserver("insert", (event) => {
			insert(event.key, event.record)
		});
		childTable.addObserver("remove", (event) => {
			remove(event.key, event.record);
		});
		parentTable.addObserver("remove", (event) => {
			let token = event.key;
			let results = tokenTable.search(token);
			for (let result of results) {
				let index = result.lookup();
				let keyEntries = keyTable.search(undefined, { index, prefix: true });
				for (let keyEntry of keyEntries) {
					let child = childTable.lookup(deserializeKey(keyEntry.keyBytes));
					childTable.remove(child);
				}
			}
		});
		if (blockHandler.getCount() === Table.ROOT_NODE_INDEX + 1) {
			for (let [key, record] of childTable.entries()) {
				insert(key, record);
			}
		}
		this.tokenTable = tokenTable;
		this.keyTable = keyTable;
		this.parentTable = parentTable;
		this.childTable = childTable;
		this.getIndexedValues = getIndexedValues;
		this.getTokens = getTokens;
	}

	debug(index?: number): void {
		if (is.absent(index)) {
			this.tokenTable.debug();
		} else {
			this.keyTable.debug(index);
		}
	}

	lookup(query: Value): StreamIterable<B> {
		return this.search(query)
			.map((result) => result.lookup())
			.slice();
	}

	search(query: Value): StreamIterable<SearchResult<B>> {
		let tokens = this.getTokens(query);
		let map = new Map<Value, number>();
		for (let token of tokens) {
			let results = this.tokenTable.search(token);
			for (let result of results) {
				let index = result.lookup();
				let keyEntries = this.keyTable.search(undefined, { index, prefix: true });
				for (let keyEntry of keyEntries) {
					let key = deserializeKey(keyEntry.keyBytes);
					let rank = map.get(key) ?? (0 - tokens.length);
					map.set(key, rank + 2);
				}
			}
		}
		return StreamIterable.of(map.entries())
			.filter((result) => result[1] >= 0)
			.sort(sorters.NumericSort.decreasing((result) => result[1]))
			.map((entry) => ({
				keyBytes: serializeKey(entry[0]),
				rank: entry[1],
				lookup: () => this.childTable.lookup(entry[0])
			}));
	}
};
