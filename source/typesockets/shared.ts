import * as autoguard from "@joelek/autoguard";
import * as stdlib from "@joelek/stdlib";
import * as schema from "./schema";
import * as is from "../is";

export class Serializer<A extends stdlib.routing.MessageMap<A>> {
	private guards: autoguard.serialization.MessageGuardMap<A>;

	constructor(guards: autoguard.serialization.MessageGuardMap<A>) {
		this.guards = guards;
	}

	deserialize<B extends keyof A>(string: string, cb: (type: B, data: A[B], id?: string) => void): void {
		let envelope = schema.Envelope.as(JSON.parse(string));
		let id = envelope.id;
		let type = envelope.type as B;
		let data = envelope.data;
		let guard = this.guards[type] as autoguard.serialization.MessageGuard<A[B]> | undefined;
		if (is.absent(guard)) {
			throw `Unknown message type "${String(type)}"!`;
		}
		cb(type, guard.as(data), id);
	}

	serialize<B extends keyof A>(type: B, data: A[B], id?: string): string {
		return JSON.stringify({
			type,
			data,
			id
		});
	}
};
