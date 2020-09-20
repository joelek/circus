export enum WireType {
	VARINT,
	FIXED_64_BIT,
	LENGTH_DELIMITED,
	START_GROUP,
	END_GROUP,
	FIXED_32_BIT
};

export type Message = {

};

export function parseFrom(buffer: Buffer): Message {

};

// key  = (field_number << 3) | wire_type

// key is varint

// wire_Type> 0:varint,1:64bit,2:lengthdeli,3:startgr,4:endgr:5:32bit
// little endian
// lengthdeli = variintlength, bytes
// message in message i lengtdeli (2)
// auth is optional from sender, its for copy control
// signed ints are zig-zagged, (n << 1) ^ (n >> 31),
// use last value for non-repeated field
// merge non-repeated object fields occuring more than once before computing final field value, parse concatenated buffers
// packed repeated, wire type 2 lengthdelim bytes, no key, only primitive numeric

/* https://localhost:443
http://localhost:80
192.168.1.105
<Buffer 08 00 12 0b 54 72 40 6e 24 70 30 72 74 2d 30 1a 0b 54 72 40 6e 24 70 30 72 74 2d 30 22 27 75 72 6e 3a 78 2d 63 61 73 74 3a 63 6f 6d 2e 67 6f 6f 67 6c ...
38 more bytes>
               Tr@n$p0rt-0
                          Tr@n$p0rt-0"'urn:x-cast:com.google.cast.tp.heartbea
t( 2{"type":"PING"}
192.168.1.105 */
