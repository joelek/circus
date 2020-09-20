import * as protobuf from "./protobuf";

export enum ProtocolVersion {
	CASTV2_1_0
};

export enum PayloadType {
	STRING,
	BINARY
};

export type CastMessage = {
	protocol_version: ProtocolVersion,
	source_id: string;
	destination_id: string,
	namespace: string,
	payload_type: PayloadType,
	payload_utf8?: string,
	payload_binary?: Buffer
};

export function parseCastMessage(buffer: Buffer): CastMessage {
	let fields = protobuf.parseFields({
		buffer: buffer,
		offset: 0
	});
	let protocol_version = protobuf.parseRequiredEnum(1, fields);
	let source_id = protobuf.parseRequiredString(2, fields);
	let destination_id = protobuf.parseRequiredString(3, fields);
	let namespace = protobuf.parseRequiredString(4, fields);
	let payload_type = protobuf.parseRequiredEnum(5, fields);
	let payload_utf8 = protobuf.parseOptionalString(6, fields);
	let payload_binary = protobuf.parseOptionalBuffer(7, fields);
	return {
		protocol_version,
		source_id,
		destination_id,
		namespace,
		payload_type,
		payload_utf8,
		payload_binary
	};
};

export function serializeCastMessage(message: CastMessage): Buffer {
	return Buffer.concat([
		protobuf.serializeRequiredEnum(1, message.protocol_version),
		protobuf.serializeRequiredString(2, message.source_id),
		protobuf.serializeRequiredString(3, message.destination_id),
		protobuf.serializeRequiredString(4, message.namespace),
		protobuf.serializeRequiredEnum(5, message.payload_type),
		protobuf.serializeOptionalString(6, message.payload_utf8),
		protobuf.serializeOptionalBuffer(7, message.payload_binary),
	]);
};
