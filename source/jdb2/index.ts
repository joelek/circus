import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as is from "../is";
import { IntegerAssert } from "./asserts";
import { Person } from "./schema";

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
	static SIZE = 8;

	get count(): number {
		return this.buffer.readUInt32BE(4);
	}

	set count(value: number) {
		IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 4);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Counter.SIZE);
		IntegerAssert.exactly(buffer.length, Counter.SIZE);
		super(buffer);
	}
};

export class Pointer extends Chunk {
	static SIZE = 8;

	get index(): number {
		return this.buffer.readUInt32BE(4);
	}

	set index(value: number) {
		IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 4);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Pointer.SIZE);
		IntegerAssert.exactly(buffer.length, Pointer.SIZE);
		super(buffer);
	}
};

export class Entry extends Chunk {
	static SIZE = 16;

	get deleted(): boolean {
		return this.buffer.readUInt8(0) === 0x80;
	}

	set deleted(value: boolean) {
		this.buffer.writeUInt8(value ? 0x80 : 0x00, 0);
	}

	get offset(): number {
		return this.buffer.readUInt32BE(4);
	}

	set offset(value: number) {
		IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 4);
	}

	get length(): number {
		return this.buffer.readUInt32BE(12) + 1;
	}

	set length(value: number) {
		value = value - 1;
		IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 12);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Entry.SIZE);
		IntegerAssert.exactly(buffer.length, Entry.SIZE);
		super(buffer);
	}
};

export class BlockHandler {
	static FIRST_APPLICATION_BLOCK = 256;

	private bin: number;
	private toc: number;

	private computePool(minLength: number): number {
		IntegerAssert.atLeast(0, minLength);
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
		IntegerAssert.between(0, index, this.getCount() - 1);
		read(this.toc, entry.buffer, index * Entry.SIZE);
		return entry;
	}

	private writeEntry(index: number, entry: Entry): Entry {
		IntegerAssert.between(0, index, this.getCount() - 1);
		write(this.toc, entry.buffer, index * Entry.SIZE);
		return entry;
	}

	constructor(path: Array<string>) {
		this.bin = open([ ...path, "bin" ]);
		this.toc = open([ ...path, "toc" ]);
		if (this.getCount() === 0) {
			for (let i = 0; i < BlockHandler.FIRST_APPLICATION_BLOCK; i++) {
				this.createNewBlock(16);
			}
		}
	}

	clearBlock(index: number): void {
		this.writeBlock(index);
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
	}

	getBlockSize(index: number): number {
		let entry = new Entry();
		this.readEntry(index, entry);
		return entry.length;
	}

	getCount(): number {
		let count = size(this.toc) / Entry.SIZE;
		IntegerAssert.atLeast(0, count);
		return count;
	}

	readBlock(index: number, buffer?: Buffer, skipLength?: number): Buffer {
		let entry = new Entry();
		this.readEntry(index, entry);
		buffer = buffer ?? Buffer.alloc(entry.length);
		let offset = skipLength ?? 0;
		let length = buffer.length;
		IntegerAssert.between(0, offset, entry.length - 1);
		IntegerAssert.between(0, length, entry.length - offset);
		read(this.bin, buffer, entry.offset + offset);
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
		read(this.bin, buffer, entry.offset);
		write(this.bin, buffer, entryTwo.offset);
		this.writeEntry(index, entryTwo);
		this.writeEntry(indexTwo, entry);
		this.deleteBlock(indexTwo);
	}

	swapBlocks(indexOne: number, indexTwo: number): void {
		let entryOne = new Entry();
		this.readEntry(indexOne, entryOne);
		let entryTwo = new Entry();
		this.readEntry(indexTwo, entryTwo);
		this.writeEntry(indexOne, entryTwo);
		this.writeEntry(indexTwo, entryOne);
	}

	writeBlock(index: number, buffer?: Buffer, skipLength?: number): Buffer {
		let entry = new Entry();
		this.readEntry(index, entry);
		buffer = buffer ?? Buffer.alloc(entry.length);
		let offset = skipLength ?? 0;
		let length = buffer.length;
		IntegerAssert.between(0, offset, entry.length - 1);
		IntegerAssert.between(0, length, entry.length - offset);
		write(this.bin, buffer, entry.offset + offset);
		if (is.absent(skipLength)) {
			write(this.bin, Buffer.alloc(entry.length - buffer.length), buffer.length);
		}
		return buffer
	}
};

export type Keys = Array<string | undefined>;
export type KeysProvider<A> = (record: A) => Keys;
export type RecordSerializer<A> = (record: A) => Buffer;
export type RecordDeserializer<A> = (buffer: Buffer) => A;



export type SearchResult<A> = {
	record(): A;
	records(includePrefixMatches?: boolean): Array<A>;
};

export class Table<A> {
	private blockHandler: BlockHandler;
	private keysProvider: KeysProvider<A>;
	private recordSerializer: RecordSerializer<A>;
	private recordDeserializer: RecordDeserializer<A>;

	private getKeyBytes(keys: Keys): Array<number | undefined> {
		let bytes = new Array<number | undefined>();
		for (let [index, key] of keys.entries()) {
			if (index > 0) {
				bytes.push(undefined);
			}
			if (typeof key === "string") {
				let buffer = Buffer.from(key);
				bytes.push(...buffer);
			} else {
				bytes.push(undefined);
			}
		}
		return bytes;
	}

	private compareKeys(one: Keys, two: Keys): boolean {
		if (one.length !== two.length) {
			return false;
		}
		for (let i = 0; i < one.length; i++) {
			if (one[i] !== two[i]) {
				return false;
			}
		}
		return true;
	}

	private getTableIndex(keyBytes: Array<number | undefined>, keyBytesIndex: number): number {
		return keyBytesIndex < keyBytes.length ? keyBytes[keyBytesIndex] ?? 256 : 257;
	}

	constructor(blockHandler: BlockHandler, keysProvider: KeysProvider<A>, recordSerializer: RecordSerializer<A>, recordDeserializer: RecordDeserializer<A>) {
		this.blockHandler = blockHandler;
		this.keysProvider = keysProvider;
		this.recordSerializer = recordSerializer;
		this.recordDeserializer = recordDeserializer;
		if (blockHandler.getCount() === BlockHandler.FIRST_APPLICATION_BLOCK) {
			blockHandler.createBlock(Pointer.SIZE);
		}
	}

	delete(record: A): void {
		throw ``;
	}

	insert(record: A): void {
		let serializedRecord = this.recordSerializer(record);
		let keys = this.keysProvider(record);
		let keyBytes = this.getKeyBytes(keys);
		let keyBytesIndex = 0;
		let nodeIndex = BlockHandler.FIRST_APPLICATION_BLOCK;
		let pointer = new Pointer();
		while (true) {
			if (this.blockHandler.getBlockSize(nodeIndex) === Pointer.SIZE) {
				this.blockHandler.readBlock(nodeIndex, pointer.buffer, 0);
				if (pointer.index === 0) {
					pointer.index = this.blockHandler.createBlock(serializedRecord.length);
					this.blockHandler.writeBlock(pointer.index, serializedRecord);
					this.blockHandler.writeBlock(nodeIndex, pointer.buffer, 0);
					// TODO: Emit insert event.
					break;
				} else {
					let recordTwo = this.recordDeserializer(this.blockHandler.readBlock(pointer.index));
					let keysTwo = this.keysProvider(recordTwo);
					if (this.compareKeys(keys, keysTwo)) {
						this.blockHandler.resizeBlock(pointer.index, serializedRecord.length);
						this.blockHandler.writeBlock(pointer.index, serializedRecord);
						// TODO: Emit update event.
						break;
					} else {
						let otherNodeIndex = this.blockHandler.createBlock(Pointer.SIZE * 256 + Pointer.SIZE + Pointer.SIZE);
						this.blockHandler.writeBlock(otherNodeIndex, pointer.buffer);
						this.blockHandler.swapBlocks(nodeIndex, otherNodeIndex);
						let keyBytesTwo = this.getKeyBytes(keysTwo);
						let tableIndex = this.getTableIndex(keyBytesTwo, keyBytesIndex);
						pointer.index = otherNodeIndex;
						this.blockHandler.writeBlock(nodeIndex, pointer.buffer, Pointer.SIZE * tableIndex);
					}
				}
			}
			let tableIndex = this.getTableIndex(keyBytes, keyBytesIndex);
			keyBytesIndex += 1;
			this.blockHandler.readBlock(nodeIndex, pointer.buffer, Pointer.SIZE * tableIndex);
			if (pointer.index === 0) {
				pointer.index = this.blockHandler.createBlock(Pointer.SIZE);
				this.blockHandler.writeBlock(nodeIndex, pointer.buffer, Pointer.SIZE * tableIndex);
			}
			nodeIndex = pointer.index;
		}
	}

	search(...keys: Keys): SearchResult<A> {
		throw ``;
	}
};

let blockHandler = new BlockHandler([ ".", "private", "jdb2" ]);
let table = new Table<Person>(blockHandler, (record) => [ record.person_id ], (record) => Buffer.from(JSON.stringify(record)), (buffer) => Person.as(JSON.parse(Buffer.toString())));
table.insert({
	person_id: "a",
	name: "Joel"
});
