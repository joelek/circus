let storedMetadata: MediaMetadata | undefined;
let storedHandlers: { [key: string]: MediaSessionActionHandler | null } | undefined;

export function setMetadata(metadata: MediaMetadataInit) {
	if (navigator.mediaSession) {
		storedMetadata = new MediaMetadata(metadata);
	}
}

export function setHandlers(handlers: { [key: string]: MediaSessionActionHandler | null }) {
	if (navigator.mediaSession) {
		storedHandlers = handlers;
	}
}

export function update() {
	if (navigator.mediaSession) {
		navigator.mediaSession.metadata = storedMetadata ?? null;
		for (let key in storedHandlers) {
			navigator.mediaSession.setActionHandler(key as MediaSessionAction, storedHandlers[key as MediaSessionAction]);
		}
	}
}
