/*
class Player {
	private audio: AudioContext;
	private context: Context | null;
	private index: number;
	private one: HTMLAudioElement;
	private two: HTMLAudioElement;

	constructor(document: Document) {
		// @ts-ignore
		this.audio = new (window.AudioContext || window.webkitAudioContext)();
		this.context = null;
		this.index = 0;
		let one = document.createElement("audio");
		one.setAttribute("preload", "auto");
		let two = document.createElement("audio");
		two.setAttribute("preload", "auto");
		this.one = one;
		this.two = two;
		this.one.addEventListener("ended", () => {
			this.index += 1;
			this.two.play();
			if (this.context) {
				let id = this.context[this.index + 1];
				this.one.src = `/files/${id.file_id}/?token=${token}`;
			}
		});
		this.two.addEventListener("ended", () => {
			this.index += 1;
			this.one.play();
			if (this.context) {
				let id = this.context[this.index + 1];
				this.two.src = `/files/${id.file_id}/?token=${token}`;
			}
		});
		let sourceOne = this.audio.createMediaElementSource(this.one);
		let sourceTwo = this.audio.createMediaElementSource(this.two);
		sourceOne.connect(this.audio.destination);
		sourceTwo.connect(this.audio.destination);
	}

	play(context: Context, index: number): void {
		this.audio.resume();
		this.context = context; // TODO: Copy.
		this.index = index;
		this.one.src = `/files/${this.context[this.index + 0].file_id}/?token=${token}`;
		this.two.src = `/files/${this.context[this.index + 1].file_id}/?token=${token}`;
		this.one.play();
	}
}

let player: Deferred<Player>;
*/
