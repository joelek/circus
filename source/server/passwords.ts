import * as libcrypto from "crypto";

export function generate(password: string): string {
	let cost = 14;
	let blockSize = 8;
	let paralellization = 1;
	let salt = libcrypto.randomBytes(16);
	let password_hash = libcrypto.scryptSync(password, salt, 32, {
		N: (1 << cost),
		r: blockSize,
		p: paralellization,
		maxmem: (256 << cost) * blockSize
	});
	let params = Buffer.alloc(4);
	params[0] = (cost >> 8);
	params[1] = (cost >> 0);
	params[2] = (blockSize >> 0);
	params[3] = (paralellization >> 0);
	return `$s0$${params.toString("hex")}$${salt.toString("base64")}$${password_hash.toString("base64")}`;
}

export function verify(password: string, chunk: string): boolean {
	let parts = /^\$s0\$([0-9a-fA-F]{8})\$([A-Za-z0-9+/]{22}==)\$([A-Za-z0-9+/]{43}=)$/.exec(chunk);
	if (parts == null) {
		throw `Expected a valid scrypt chunk!`;
	}
	let parameters = Buffer.from(parts[1], "hex");
	let salt = Buffer.from(parts[2], "base64");
	let hash = Buffer.from(parts[3], "base64");
	let cost = (parameters[0] << 8) | (parameters[1] << 0);
	let blockSize = (parameters[2] << 0);
	let paralellization = (parameters[3] << 0);
	let password_hash = libcrypto.scryptSync(password, salt, 32, {
		N: (1 << cost),
		r: blockSize,
		p: paralellization,
		maxmem: (256 << cost) * blockSize
	});
	return libcrypto.timingSafeEqual(hash, password_hash);
}
