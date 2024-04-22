export function formatSize(b: number): string {
	let kb = Math.floor(b / 1024);
	let mb = Math.floor(kb / 1024);
	let gb = Math.floor(mb / 1024);
	let tb = Math.floor(gb / 1024);
	if (tb >= 10) {
		return `${tb} TB`;
	} else if (gb >= 10) {
		return `${gb} GB`;
	} else if (mb >= 10) {
		return `${mb} MB`;
	} else if (kb >= 10) {
		return `${kb} kB`;
	} else {
		return `${b} B`;
	}
};

export function formatTimestamp(timestamp: number): string {
	let iso = new Date(timestamp).toISOString();
	let date = iso.slice(0, 10);
	let time = iso.slice(11, 19);
	return `${date} ${time}`;
};

type Duration = {
	ms: number,
	s: number,
	m: number,
	h: number,
	d: number
};

export function computeDuration(ms: number): Duration {
	let s = Math.floor(ms / 1000);
	ms -= s * 1000;
	let m = Math.floor(s / 60);
	s -= m * 60;
	let h = Math.floor(m / 60);
	m -= h * 60;
	let d = Math.floor(h / 24);
	h -= d * 24;
	return {
		ms,
		s,
		m,
		h,
		d
	};
};

export function formatDuration(ms: number): string {
	let duration = computeDuration(ms);
	if (duration.d >= 10) {
		return `${duration.d}d`;
	} else if (duration.d >= 1) {
		return `${duration.d}d ${duration.h}h`;
	} else if (duration.h >= 10) {
		return `${duration.h}h`;
	} else if (duration.h >= 1) {
		return `${duration.h}h ${duration.m}m`;
	} else if (duration.m >= 10) {
		return `${duration.m}m`;
	} else if (duration.m >= 1) {
		return `${duration.m}m ${duration.s}s`;
	} else {
		return `${duration.s}s`;
	}
};
