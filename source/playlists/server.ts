import * as libcrypto from "crypto";
import * as libhttp from "http";
import * as auth from "../server/auth";
import * as is from "../is";
import * as schema from "./schema/";
import * as database from "../database/indexer";
import * as typesockets from "../typesockets/";
import * as jsondb from "../jsondb/";
import * as api from "../api/";

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

	private revokeAuthentication(connection_id: string): void {
		let token = this.tokens.get(connection_id);
		this.tokens.delete(connection_id);
		if (is.present(token)) {
			let user_id = auth.getUserId(token);
			let session = this.sessions.get(user_id);
			if (is.present(session)) {
				let connections = session.connections;
				connections.delete(connection_id);
			}
		}
	}

	constructor() {
		this.tss = new typesockets.TypeSocketServer(schema.messages.Autoguard.Guards);
		this.tss.addEventListener("sys", "connect", (message) => {
		});
		this.tss.addEventListener("sys", "disconnect", (message) => {
			this.revokeAuthentication(message.connection_id);
		});
		this.tss.addEventListener("app", "SetToken", (message) => {
			this.revokeAuthentication(message.connection_id);
			let token = message.data.token;
			if (is.present(token)) {
				let user_id = auth.getUserId(token);
				this.tokens.set(message.connection_id, token);
				let session = this.getOrCreateSession(user_id);
				session.connections.add(message.connection_id);
				for (let playlist of database.getPlaylistsFromUser.lookup(user_id)) {
					this.tss.send("CreatePlaylist", message.connection_id, {
						playlist: api.handler.lookupPlaylistBase(playlist.playlist_id, user_id)
					});
					for (let playlist_item of database.getPlaylistsItemsFromPlaylist.lookup(playlist.playlist_id)) {
						this.tss.send("CreatePlaylistItem", message.connection_id, {
							playlist_item: api.handler.lookupPlaylistItemBase(playlist_item.playlist_item_id, user_id)
						});
					}
				}
			}
		});
		this.tss.addEventListener("app", "PermissionsRequest", (message) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = auth.getUserId(token);
				let playlist = database.playlists.lookup(message.data.playlist.playlist_id);
				if (playlist.user_id === user_id) {
					this.tss.respond(message, "PermissionsResponse", {
						permissions: "write"
					});
				} else {
					this.tss.respond(message, "PermissionsResponse", {
						permissions: "read"
					});
				}
			}
		});
		this.tss.addEventListener("app", "CreatePlaylistRequest", (message) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = auth.getUserId(token);
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
					playlist_id: playlist_id,
					title: title,
					description: description,
					user_id: user_id
				};
				database.playlists.insert(playlist);
				let session = this.getOrCreateSession(user_id);
				this.tss.send("CreatePlaylist", Array.from(session.connections), {
					playlist: api.handler.lookupPlaylistBase(playlist.playlist_id, user_id)
				});
			}
		});
		this.tss.addEventListener("app", "DeletePlaylistRequest", (message) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = auth.getUserId(token);
				let errors = new Array<string>();
				let playlist_id = message.data.playlist.playlist_id;
				let playlist = database.playlists.lookup(playlist_id);
				if (playlist.user_id !== user_id) {
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
					playlist: api.handler.lookupPlaylistBase(playlist.playlist_id, user_id)
				});
				database.playlists.remove(playlist);
			}
		});
		this.tss.addEventListener("app", "UpdatePlaylistRequest", (message) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = auth.getUserId(token);
				let errors = new Array<string>();
				let playlist_id = message.data.playlist.playlist_id;
				let playlist = database.playlists.lookup(playlist_id);
				if (playlist.user_id !== user_id) {
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
				database.playlists.update({
					...playlist,
					...message.data.playlist
				});
				let session = this.getOrCreateSession(user_id);
				this.tss.send("UpdatePlaylist", Array.from(session.connections), {
					playlist: api.handler.lookupPlaylistBase(playlist.playlist_id, user_id)
				});
			}
		});
		this.tss.addEventListener("app", "CreatePlaylistItemRequest", (message) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = auth.getUserId(token);
				let errors = new Array<string>();
				let playlist_id = message.data.playlist_item.playlist_id;
				let playlist = database.playlists.lookup(playlist_id);
				if (playlist.user_id !== user_id) {
					errors.push(`You don't have sufficient rights to alter the desired playlist!`);
				}
				let track_id = message.data.playlist_item.track_id;
				let track = database.tracks.lookup(track_id);
				let playlist_item_id = libcrypto.randomBytes(8).toString("hex");
				this.tss.respond(message, "CreatePlaylistItemResponse", {
					errors,
					playlist_item_id
				});
				if (errors.length > 0) {
					return;
				}
				let playlist_items = database.getPlaylistsItemsFromPlaylist.lookup(playlist_id)
					.sort(jsondb.NumericSort.increasing((record) => record.number))
					.collect();
				let playlist_item = {
					playlist_item_id: playlist_item_id,
					playlist_id: playlist_id,
					track_id: track_id,
					number: (playlist_items.pop()?.number ?? 0) + 1,
					added_ms: Date.now()
				};
				database.playlist_items.insert(playlist_item);
				let session = this.getOrCreateSession(user_id);
				this.tss.send("CreatePlaylistItem", Array.from(session.connections), {
					playlist_item: api.handler.lookupPlaylistItemBase(playlist_item.playlist_item_id, user_id)
				});
			}
		});
		this.tss.addEventListener("app", "DeletePlaylistItemRequest", (message) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = auth.getUserId(token);
				let errors = new Array<string>();
				let playlist_item_id = message.data.playlist_item.playlist_item_id;
				let playlist_item = database.playlist_items.lookup(playlist_item_id);
				let playlist = database.playlists.lookup(playlist_item.playlist_id);
				if (playlist.user_id !== user_id) {
					errors.push(`You don't have sufficient rights to alter the desired playlist!`);
				}
				this.tss.respond(message, "DeletePlaylistItemResponse", {
					errors
				});
				if (errors.length > 0) {
					return;
				}
				let number = playlist_item.number;
				let playlist_items = database.getPlaylistsItemsFromPlaylist.lookup(playlist.playlist_id)
					.sort(jsondb.NumericSort.increasing((record) => record.number));
				for (let playlist_item of playlist_items) {
					if (playlist_item.number > number) {
						playlist_item.number -= 1;
						database.playlist_items.update(playlist_item);
					}
				}
				let session = this.getOrCreateSession(user_id);
				this.tss.send("DeletePlaylistItem", Array.from(session.connections), {
					playlist_item: api.handler.lookupPlaylistItemBase(playlist_item.playlist_item_id, user_id)
				});
				database.playlist_items.remove(playlist_item);
			}
		});
		this.tss.addEventListener("app", "UpdatePlaylistItemRequest", (message) => {
			let token = this.tokens.get(message.connection_id);
			if (is.present(token)) {
				let user_id = auth.getUserId(token);
				let errors = new Array<string>();
				let playlist_item_id = message.data.playlist_item.playlist_item_id;
				let playlist_item = database.playlist_items.lookup(playlist_item_id);
				let playlist = database.playlists.lookup(playlist_item.playlist_id);
				if (playlist.user_id !== user_id) {
					errors.push(`You don't have sufficient rights to alter the desired playlist!`);
				}
				let number = message.data.playlist_item.number;
				let playlist_items = database.getPlaylistsItemsFromPlaylist.lookup(playlist.playlist_id)
					.sort(jsondb.NumericSort.increasing((record) => record.number))
					.collect();
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
						database.playlist_items.update(playlist_item)
					}
				} else if (new_index < old_index) {
					for (let i = new_index; i < old_index; i++) {
						let playlist_item = playlist_items[i];
						playlist_item.number += 1;
						database.playlist_items.update(playlist_item)
					}
				}
				playlist_item.number = number;
				database.playlist_items.update({
					...playlist_item,
					...message.data.playlist_item
				});
				let session = this.getOrCreateSession(user_id);
				this.tss.send("UpdatePlaylistItem", Array.from(session.connections), {
					playlist_item: api.handler.lookupPlaylistItemBase(playlist_item.playlist_item_id, user_id)
				});
			}
		});
	}

	getRequestHandler(): libhttp.RequestListener {
		return this.tss.getRequestHandler();
	}
};
