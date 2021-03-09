import * as libcrypto from "crypto";
import * as libfs from "fs";
import { IntegerAssert } from "./asserts";

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

	get deleted(): boolean {
		return this.buffer.readUInt8(8) === 0x80;
	}

	set deleted(value: boolean) {
		this.buffer.writeUInt8(value ? 0x80 : 0x00, 8);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Entry.SIZE);
		IntegerAssert.exactly(buffer.length, Entry.SIZE);
		super(buffer);
	}
};

export class BlockHandler {
	static OVERHEAD_FACTOR = 1.25;

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
		entry.length = Math.pow(2, this.computePool(Math.ceil(minLength * BlockHandler.OVERHEAD_FACTOR)));
		write(this.bin, Buffer.alloc(entry.length), entry.offset);
		write(this.toc, entry.buffer, size(this.toc));
		return this.getCount() - 1;
	}

	private createOldBlock(minLength: number): number {
		let pool = this.computePool(Math.ceil(minLength * BlockHandler.OVERHEAD_FACTOR));
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
			for (let i = 0; i < 64; i++) {
				this.createNewBlock(8);
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
		IntegerAssert.atLeast(64, index);
		let entry = new Entry();
		this.readEntry(index, entry);
		if (entry.deleted) {
			return;
		}
		let pool = this.computePool(entry.length);
		let counter = new Counter();
		this.readBlock(pool, counter.buffer, 0);
		let minLength = Counter.SIZE + (counter.count + 1) * Pointer.SIZE;
		if (minLength > entry.length) {
			this.resizeBlock(pool, minLength);
		}
		let pointer = new Pointer();
		pointer.index = index;
		this.writeBlock(pool, pointer.buffer, Counter.SIZE + (counter.count * Pointer.SIZE));
		counter.count += 1;
		this.writeBlock(pool, counter.buffer, 0);
		entry.deleted = true;
		this.writeEntry(index, entry);
	}

	getCount(): number {
		let count = size(this.toc) / Entry.SIZE;
		IntegerAssert.atLeast(0, count);
		return count;
	}

	readBlock(index: number, buffer: Buffer, offset: number = 0): void {
		let length = buffer.length;
		let entry = new Entry();
		this.readEntry(index, entry);
		IntegerAssert.between(0, offset, entry.length - 1);
		IntegerAssert.between(0, length, entry.length - offset);
		read(this.bin, buffer, entry.offset + offset);
	}

	resizeBlock(indexOne: number, minLength: number): void {
		let entryOne = new Entry();
		this.readEntry(indexOne, entryOne);
		if (this.computePool(minLength) === this.computePool(entryOne.length)) {
			return;
		}
		let indexTwo = this.createBlock(minLength);
		let entryTwo = new Entry();
		this.readEntry(indexTwo, entryTwo);
		let length = Math.min(entryOne.length, entryTwo.length);
		let buffer = Buffer.alloc(length);
		read(this.bin, buffer, entryOne.offset);
		write(this.bin, buffer, entryTwo.offset);
		this.writeEntry(indexOne, entryTwo);
		this.writeEntry(indexTwo, entryOne);
		this.deleteBlock(indexTwo);
	}

	writeBlock(index: number, buffer: Buffer, offset: number = 0): void {
		let length = buffer.length;
		let entry = new Entry();
		this.readEntry(index, entry);
		IntegerAssert.between(0, offset, entry.length - 1);
		IntegerAssert.between(0, length, entry.length - offset);
		write(this.bin, buffer, entry.offset + offset);
	}
};

let bh = new BlockHandler([ ".", "private", "jdb2" ]);























/*
export type Key = Array<boolean | null | number | string | undefined>;
export type KeyProvider<A> = (record: A) => Key;
export type RecordSerializer<A> = (record: A) => Buffer;
export type SearchResult<A> = {
	record(): A;
	records(includePrefixMatches?: boolean): Array<A>;
};

export class Table<A> {
	private cat: number;
	private bin: number;
	private toc: number;
	private keyProvider: KeyProvider<A>;

	constructor(path: Array<string>, keyProvider: KeyProvider<A>) {
		this.cat = open([ ...path, "cat" ]);
		this.bin = open([ ...path, "bin" ]);
		this.toc = open([ ...path, "toc" ]);
		this.keyProvider = keyProvider;
	}

	delete(record: A): void {
		let key = this.keyProvider(record);
	}

	insert(record: A): void {
		let key = this.keyProvider(record);

	}

	search(...key: Key): SearchResult<A> {

	}
}; */
