import * as libcrypto from "crypto";
import * as libhttp from "http";
import * as auth from "../server/auth";
import * as is from "../is";
import * as schema from "./schema/";
import * as database from "../database/indexer";
import * as typesockets from "../typesockets/";
import * as jsondb from "../jsondb/";
import * as api from "../api/";
import * as atlas from "../database/atlas";
import { ReadableQueue } from "@joelek/atlas";
import { binid, hexid } from "../api/handler";

type Session = {
	connections: Set<string>
};

export class PlaylistsServer {
	private tss: typesockets.TypeSocketServer<schema.messages.Autoguard.Guards>;
	private tokens = new Map<string, string>();
	private sessions = new Map<string, Session>();

	private getOrCreateSession(user_id: string): Session {
		let session = this.sessions.get(user_id);
		if (is.present(session)) {
			return session;
		}
		session = {
			connections: new Set<string>()
		};
		this.sessions.set(user_id, session);
		return session;
	}

	private async revokeAuthentication(queue: ReadableQueue, connection_id: string): Promise<void> {
		let token = this.tokens.get(connection_id);
		this.tokens.delete(connection_id);
		if (is.present(token)) {
			let user_id = await auth.getUserId(queue, token);
			let session = this.sessions.get(user_id);
			if (is.present(session)) {
				let connections = session.connections;
				connections.delete(connection_id);
			}
		}
	}

	constructor() {
		this.tss = new typesockets.TypeSocketServer(schema.messages.Autoguard.Guards);
		this.tss.addEventListener("sys", "connect", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		}));
		this.tss.addEventListener("sys", "disconnect", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.revokeAuthentication(queue, message.connection_id);
		}));
		this.tss.addEventListener("app", "SetToken", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.revokeAuthentication(queue, message.connection_id);
			let token = message.data.token;
			if (is.present(token)) {
				let user_id = await auth.getUserId(queue, token);
				this.tokens.set(message.connection_id, token);
				let session = this.getOrCreateSession(user_id);
				session.connections.add(message.connection_id);
				for (let playlist of await atlas.links.user_playlists.filter(queue, { user_id: binid(user_id) })) {
					this.tss.send("CreatePlaylist", message.connection_id, {
						playlist: await api.handler.lookupPlaylistBase(queue, hexid(playlist.playlist_id), user_id)
					});
					for (let playlist_item of await atlas.links.playlist_playlist_items.filter(queue, playlist)) {
						this.tss.send("CreatePlaylistItem", message.connection_id, {
							playlist_item: await api.handler.lookupPlaylistItemBase(queue, hexid(playlist_item.playlist_item_id), user_id)
						});
					}
				}
			}
		}));
		this.tss.addEventListener("app", "PermissionsRequest", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = await auth.getUserId(queue, token);
				let playlist = await atlas.stores.playlists.lookup(queue, { playlist_id: binid(message.data.playlist.playlist_id) });
				if (hexid(playlist.user_id) === user_id) {
					this.tss.respond(message, "PermissionsResponse", {
						permissions: "write"
					});
				} else {
					this.tss.respond(message, "PermissionsResponse", {
						permissions: "read"
					});
				}
			}
		}));
		this.tss.addEventListener("app", "CreatePlaylistRequest", (message) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = await auth.getUserId(queue, token);
				let errors = new Array<string>();
				let title = message.data.playlist.title;
				if (Buffer.from(title).length >= 256) {
					errors.push(`The playlist title is too long!`);
				}
				let description = message.data.playlist.description;
				if (Buffer.from(description).length >= 256) {
					errors.push(`The playlist description is too long!`);
				}
				let playlist_id = libcrypto.randomBytes(8).toString("hex");
				this.tss.respond(message, "CreatePlaylistResponse", {
					errors,
					playlist_id
				});
				if (errors.length > 0) {
					return;
				}
				let playlist = {
					playlist_id: binid(playlist_id),
					title: title,
					description: description,
					user_id: binid(user_id)
				};
				await atlas.stores.playlists.insert(queue, playlist);
				let session = this.getOrCreateSession(user_id);
				this.tss.send("CreatePlaylist", Array.from(session.connections), {
					playlist: await api.handler.lookupPlaylistBase(queue, hexid(playlist.playlist_id), user_id)
				});
			}
		}));
		this.tss.addEventListener("app", "DeletePlaylistRequest", (message) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = await auth.getUserId(queue, token);
				let errors = new Array<string>();
				let playlist_id = message.data.playlist.playlist_id;
				let playlist = await atlas.stores.playlists.lookup(queue, { playlist_id: binid(message.data.playlist.playlist_id) });
				if (hexid(playlist.user_id) !== user_id) {
					errors.push(`You don't have sufficient rights to alter the desired playlist!`);
				}
				this.tss.respond(message, "DeletePlaylistResponse", {
					errors
				});
				if (errors.length > 0) {
					return;
				}
				let session = this.getOrCreateSession(user_id);
				this.tss.send("DeletePlaylist", Array.from(session.connections), {
					playlist: await api.handler.lookupPlaylistBase(queue, hexid(playlist.playlist_id), user_id)
				});
				await atlas.stores.playlists.remove(queue, playlist);
			}
		}));
		this.tss.addEventListener("app", "UpdatePlaylistRequest", (message) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = await auth.getUserId(queue, token);
				let errors = new Array<string>();
				let playlist_id = message.data.playlist.playlist_id;
				let playlist = await atlas.stores.playlists.lookup(queue, { playlist_id: binid(message.data.playlist.playlist_id) });
				if (hexid(playlist.user_id) !== user_id) {
					errors.push(`You don't have sufficient rights to alter the desired playlist!`);
				}
				let title = message.data.playlist.title;
				if (Buffer.from(title).length >= 256) {
					errors.push(`The playlist title is too long!`);
				}
				let description = message.data.playlist.description;
				if (Buffer.from(description).length >= 256) {
					errors.push(`The playlist description is too long!`);
				}
				this.tss.respond(message, "UpdatePlaylistResponse", {
					errors
				});
				if (errors.length > 0) {
					return;
				}
				await atlas.stores.playlists.update(queue, {
					...playlist,
					...message.data.playlist,
					playlist_id: binid(playlist_id)
				});
				let session = this.getOrCreateSession(user_id);
				this.tss.send("UpdatePlaylist", Array.from(session.connections), {
					playlist: await api.handler.lookupPlaylistBase(queue, hexid(playlist.playlist_id), user_id)
				});
			}
		}));
		this.tss.addEventListener("app", "CreatePlaylistItemRequest", (message) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = await auth.getUserId(queue, token);
				let errors = new Array<string>();
				let playlist_id = message.data.playlist_item.playlist_id;
				let playlist = await atlas.stores.playlists.lookup(queue, { playlist_id: binid(message.data.playlist_item.playlist_id) });
				if (hexid(playlist.user_id) !== user_id) {
					errors.push(`You don't have sufficient rights to alter the desired playlist!`);
				}
				let track_id = message.data.playlist_item.track_id;
				let track = await atlas.stores.tracks.lookup(queue, { track_id: binid(track_id) });
				let playlist_item_id = libcrypto.randomBytes(8).toString("hex");
				this.tss.respond(message, "CreatePlaylistItemResponse", {
					errors,
					playlist_item_id
				});
				if (errors.length > 0) {
					return;
				}
				let playlist_items = await atlas.links.playlist_playlist_items.filter(queue, playlist);
				let playlist_item = {
					playlist_item_id: binid(playlist_item_id),
					playlist_id: binid(playlist_id),
					track_id: binid(track_id),
					number: (playlist_items.pop()?.number ?? 0) + 1,
					added_ms: Date.now()
				};
				await atlas.stores.playlist_items.insert(queue, playlist_item);
				let session = this.getOrCreateSession(user_id);
				this.tss.send("CreatePlaylistItem", Array.from(session.connections), {
					playlist_item: await api.handler.lookupPlaylistItemBase(queue, hexid(playlist_item.playlist_item_id), user_id)
				});
			}
		}));
		this.tss.addEventListener("app", "DeletePlaylistItemRequest", (message) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = await auth.getUserId(queue, token);
				let errors = new Array<string>();
				let playlist_item_id = message.data.playlist_item.playlist_item_id;
				let playlist_item = await atlas.stores.playlist_items.lookup(queue, { playlist_item_id: binid(playlist_item_id) });
				let playlist = await atlas.stores.playlists.lookup(queue, playlist_item);
				if (hexid(playlist.user_id) !== user_id) {
					errors.push(`You don't have sufficient rights to alter the desired playlist!`);
				}
				this.tss.respond(message, "DeletePlaylistItemResponse", {
					errors
				});
				if (errors.length > 0) {
					return;
				}
				let number = playlist_item.number;
				let playlist_items = await atlas.links.playlist_playlist_items.filter(queue, playlist);
				for (let playlist_item of playlist_items) {
					if (playlist_item.number > number) {
						playlist_item.number -= 1;
						await atlas.stores.playlist_items.update(queue, playlist_item);
					}
				}
				let session = this.getOrCreateSession(user_id);
				this.tss.send("DeletePlaylistItem", Array.from(session.connections), {
					playlist_item: await api.handler.lookupPlaylistItemBase(queue, hexid(playlist_item.playlist_item_id), user_id)
				});
				await atlas.stores.playlist_items.remove(queue, playlist_item);
			}
		}));
		this.tss.addEventListener("app", "UpdatePlaylistItemRequest", (message) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = await auth.getUserId(queue, token);
				let errors = new Array<string>();
				let playlist_item_id = message.data.playlist_item.playlist_item_id;
				let playlist_item = await atlas.stores.playlist_items.lookup(queue, { playlist_item_id: binid(playlist_item_id) });
				let playlist = await atlas.stores.playlists.lookup(queue, playlist_item);
				if (hexid(playlist.user_id) !== user_id) {
					errors.push(`You don't have sufficient rights to alter the desired playlist!`);
				}
				let number = message.data.playlist_item.number;
				let playlist_items = await atlas.links.playlist_playlist_items.filter(queue, playlist);
				if (number < 1 || number > playlist_items.length) {
					errors.push(`Expected a position between ${1} and ${playlist_items.length} (${number})!`);
				}
				this.tss.respond(message, "UpdatePlaylistItemResponse", {
					errors
				});
				if (errors.length > 0) {
					return;
				}
				let old_index = number - 1;
				let new_index = message.data.playlist_item.number - 1;
				if (new_index > old_index) {
					for (let i = old_index + 1; i < new_index; i++) {
						let playlist_item = playlist_items[i];
						playlist_item.number -= 1;
						await atlas.stores.playlist_items.update(queue, playlist_item)
					}
				} else if (new_index < old_index) {
					for (let i = new_index; i < old_index; i++) {
						let playlist_item = playlist_items[i];
						playlist_item.number += 1;
						await atlas.stores.playlist_items.update(queue, playlist_item)
					}
				}
				playlist_item.number = number;
				await atlas.stores.playlist_items.update(queue, {
					...playlist_item,
					...message.data.playlist_item,
					playlist_item_id: binid(message.data.playlist_item.playlist_item_id)
				});
				let session = this.getOrCreateSession(user_id);
				this.tss.send("UpdatePlaylistItem", Array.from(session.connections), {
					playlist_item: await api.handler.lookupPlaylistItemBase(queue, hexid(playlist_item.playlist_item_id), user_id)
				});
			}
		}));
	}

	getRequestHandler(): libhttp.RequestListener {
		return this.tss.getRequestHandler();
	}
};
