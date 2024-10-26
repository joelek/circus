import * as observers from "../observers/";
import * as jsondb from "../jsondb/";
import * as messages from "./schema/messages";
import * as typesockets from "../typesockets/client";
import * as api from "../api/schema/objects";
import { ImageFile } from "../database/schema";

export class PlaylistsClient {
	private tsc: typesockets.TypeSocketClient<messages.Autoguard.Guards>;
	private token = new observers.ObservableClass(undefined as string | undefined);
	private online = new observers.ObservableClass(false);
	readonly playlists = new observers.ArrayObservable(new Array<observers.ObservableClass<api.PlaylistContext>>());

	constructor(url: string, factory: typesockets.WebSocketFactory = (url) => new WebSocket(url)) {
		this.tsc = new typesockets.TypeSocketClient(url, factory, messages.Autoguard.Guards);
		this.tsc.addEventListener("sys", "connect", () => {
			this.online.updateState(true);
		});
		this.tsc.addEventListener("sys", "disconnect", () => {
			this.online.updateState(false);
		});
		observers.computed((isOnline, token) => {
			if (isOnline) {
				this.tsc.send("SetToken", {
					token
				});
			}
		}, this.online, this.token);
		this.tsc.addEventListener("app", "CreatePlaylist", (message) => {
			let deletions = 0;
			for (let [index, playlist] of this. playlists.getState().entries()) {
				let state = playlist.getState();
				if (state.playlist_id === message.playlist.playlist_id) {
					this.playlists.splice(index - deletions);
				}
			}
			let playlist = {
				...message.playlist,
				items: new Array<api.PlaylistItem>(),
				affinity: 0,
				duration_ms: 0,
				artwork: [] as Array<ImageFile>
			};
			this.playlists.append(new observers.ObservableClass(playlist));
		});
		this.tsc.addEventListener("app", "DeletePlaylist", (message) => {
			let deletions = 0;
			for (let [index, playlist] of this. playlists.getState().entries()) {
				let state = playlist.getState();
				if (state.playlist_id === message.playlist.playlist_id) {
					this.playlists.splice(index - deletions);
				}
			}
		});
		this.tsc.addEventListener("app", "UpdatePlaylist", (message) => {
			for (let [index, playlist] of this. playlists.getState().entries()) {
				let state = playlist.getState();
				if (state.playlist_id === message.playlist.playlist_id) {
					playlist.updateState({
						...state,
						...message.playlist
					});
				}
			}
		});
		this.tsc.addEventListener("app", "CreatePlaylistItem", (message) => {
			for (let [index, playlist] of this. playlists.getState().entries()) {
				let state = playlist.getState();
				if (state.playlist_id === message.playlist_item.playlist.playlist_id) {
					let items = state.items.filter((item) => item.playlist_item_id !== message.playlist_item.playlist_item_id);
					let deletions = state.items.length - items.length;
					items.push(message.playlist_item);
					let additions = 1;
					items = items
						.map((item) => ({
							...item,
							number: item.number + (item.number > message.playlist_item.number ? additions - deletions : 0)
						}))
						.sort(jsondb.NumericSort.increasing((record) => record.number));
					state = {
						...state,
						items: items
					};
					playlist.updateState(state);
				}
			}
		});
		this.tsc.addEventListener("app", "DeletePlaylistItem", (message) => {
			for (let [index, playlist] of this. playlists.getState().entries()) {
				let state = playlist.getState();
				if (state.playlist_id === message.playlist_item.playlist.playlist_id) {
					let items = state.items.filter((item) => item.playlist_item_id !== message.playlist_item.playlist_item_id);
					let deletions = state.items.length - items.length;
					let additions = 0;
					items = items
						.map((item) => ({
							...item,
							number: item.number + (item.number > message.playlist_item.number ? additions - deletions : 0)
						}))
						.sort(jsondb.NumericSort.increasing((record) => record.number));
					state = {
						...state,
						items: items
					};
					playlist.updateState(state);
				}
			}
		});
		this.tsc.addEventListener("app", "UpdatePlaylistItem", (message) => {
			for (let [index, playlist] of this. playlists.getState().entries()) {
				let state = playlist.getState();
				if (state.playlist_id === message.playlist_item.playlist.playlist_id) {
					let old_index = state.items.findIndex((item) => item.playlist_item_id === message.playlist_item.playlist_item_id);
					if (old_index >= 0) {
						let new_index = message.playlist_item.number - 1;
						if (new_index > old_index) {
							for (let i = old_index + 1; i < new_index; i++) {
								state.items[i].number -= 1;
							}
							state.items.splice(new_index, 0, ...state.items.splice(old_index, 1));
						} else if (new_index < old_index) {
							for (let i = new_index; i < old_index; i++) {
								state.items[i].number += 1;
							}
							state.items.splice(new_index, 0, ...state.items.splice(old_index, 1));
						}
						state.items[new_index] = {
							...state.items[new_index],
							...message.playlist_item
						};
						playlist.updateState({
							...state
						});
					}
				}
			}
		});
	}

	authenticate(token?: string): void {
		this.token.updateState(token);
	}

	isOnline(): boolean {
		return this.online.getState();
	}

	getPermissions(request: messages.PermissionsRequest): Promise<messages.PermissionsResponse> {
		return this.tsc.request("PermissionsRequest", "PermissionsResponse", request);
	}

	createPlaylist(request: messages.CreatePlaylistRequest): Promise<messages.CreatePlaylistResponse> {
		return this.tsc.request("CreatePlaylistRequest", "CreatePlaylistResponse", request);
	}

	deletePlaylist(request: messages.DeletePlaylistRequest): Promise<messages.DeletePlaylistResponse> {
		return this.tsc.request("DeletePlaylistRequest", "DeletePlaylistResponse", request);
	}

	updatePlaylist(request: messages.UpdatePlaylistRequest): Promise<messages.UpdatePlaylistResponse> {
		return this.tsc.request("UpdatePlaylistRequest", "UpdatePlaylistResponse", request);
	}

	createPlaylistItem(request: messages.CreatePlaylistItemRequest): Promise<messages.CreatePlaylistItemResponse> {
		return this.tsc.request("CreatePlaylistItemRequest", "CreatePlaylistItemResponse", request);
	}

	deletePlaylistItem(request: messages.DeletePlaylistItemRequest): Promise<messages.DeletePlaylistItemResponse> {
		return this.tsc.request("DeletePlaylistItemRequest", "DeletePlaylistItemResponse", request);
	}

	updatePlaylistItem(request: messages.UpdatePlaylistItemRequest): Promise<messages.UpdatePlaylistItemResponse> {
		return this.tsc.request("UpdatePlaylistItemRequest", "UpdatePlaylistItemResponse", request);
	}

	close(): void {
		this.tsc.close();
	}

	reconnect(): void {
		this.tsc.reconnect();
	}
};
