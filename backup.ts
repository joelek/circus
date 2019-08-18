import * as libcp from 'child_process';
import * as libfs from 'fs';
import * as libpath from 'path';
import * as libcrypto from 'crypto';
import * as librl from 'readline';

// angles?

let a_type = 'unknown';
let a_show = '';
let a_season = 0;
let a_episode = null;
let a_title = '';
let a_year = 0;
let a_min = 0;
let a_max = Infinity;

let length_to_seconds = (string: string): number => {
	let parts;
	if ((parts = /^([0-9]):([0-9][0-9]):([0-9][0-9])$/.exec(string)) != null) {
		let h = Number.parseInt(parts[1]);
		let m = Number.parseInt(parts[2]);
		let s = Number.parseInt(parts[3]);
		return (((h * 60) + m) * 60) + s;
	}
	return 0;
};

process.argv.slice(2).forEach((arg) => {
	let parts;
	if (false) {
	} else if ((parts = /^--type=(episode|movie)$/.exec(arg)) != null) {
		a_type = parts[1];
	} else if ((parts = /^--minlength=([0-9]+)$/.exec(arg)) != null) {
		a_min = Number.parseInt(parts[1]);
	} else if ((parts = /^--maxlength=([0-9]+)$/.exec(arg)) != null) {
		a_max = Number.parseInt(parts[1]);
	} else if ((parts = /^--show=(.+)$/.exec(arg)) != null) {
		a_show = parts[1];
	} else if ((parts = /^--title=(.+)$/.exec(arg)) != null) {
		a_title = parts[1];
	} else if ((parts = /^--season=([0-9]+)$/.exec(arg)) != null) {
		a_season = Number.parseInt(parts[1]);
	} else if ((parts = /^--year=([0-9]+)$/.exec(arg)) != null) {
		a_year = Number.parseInt(parts[1]);
	} else if ((parts = /^--episode=([0-9]+)$/.exec(arg)) != null) {
		a_episode = Number.parseInt(parts[1]);
	}
});

let compute_hash = (root: string, cb: { (h: string): void }): void => {
	let hash = libcrypto.createHash('sha256');
	function async(root: string, cb: { (): void }): void {
		libfs.stat(root, (error, stats) => {
			if (stats.isDirectory()) {
				libfs.readdir(root, (error, nodes) => {
					nodes = nodes.sort((a, b) => {
						if (a < b) {
							return -1;
						}
						if (b > a) {
							return 1;
						}
						return 0;
					});
					nodes = nodes.map((node) => {
						return libpath.join(root, node);
					});
					let pick_next = () => {
						if (nodes.length > 0) {
							let node = nodes.shift() as string;
							let name = node.split(libpath.sep).slice(1).join(':');
							let ct = stats.ctimeMs;
							let mt = stats.mtimeMs;
							hash.update(`${name}\0${ct}\0{mt}\0`);
							async(node, () => {
								pick_next();
							});
						} else {
							cb();
						}
					};
					pick_next();
				});
			} else if (stats.isFile()) {
				cb();
			} else {
				throw new Error();
			}
		});
	};
	async(root, () => {
		cb(hash.digest('hex'));
	});
};

let db = require('../store/discdb.json');

let save_db = (filename: string, db: Record<string, any>, cb: { (): void }) => {
  let sorted = [];
  for (let key of Object.keys(db)) {
    sorted.push({
      key: key,
      value: db[key]
    });
  }
  sorted = sorted.sort((a, b) => {
    if (a.key < b.key) {
      return -1;
    }
    if (a.key > b.key) {
      return 1;
    }
    return 0;
  });
  let out = {} as Record<string, any>;
  sorted.forEach((entry) => {
    out[entry.key] = entry.value;
  });
  let fd = libfs.openSync(filename, 'w');
  libfs.writeSync(fd, JSON.stringify(out, null, 2));
  libfs.closeSync(fd);
  cb();
};

let analyze = (dir: string, cb: { (type: string, content: Array<Content>): void }) => {
	libcp.exec(`makemkvcon info disc:0 --robot --minlength=0`, (error, stdout, stderr) => {
		let dtype = 'unknown';
		let content = new Array<Content>();
		let lines = stdout.split(/\r?\n/);
		lines.map((line) => {
			let parts = line.split(':');
			let type = parts.shift() as string;
			let args = JSON.parse(`[${parts.join(':')}]`);
			if (false) {
			} else if (type === 'MSG') {
			} else if (type === 'DRV') {
			} else if (type === 'TCOUNT') {
			} else if (type === 'CINFO') {
				if (false) {
				} else if (args[0] === 1) {
					process.stdout.write(` disc_type:${args[2]}\n`);
					if (false) {
					} else if (args[2] === 'Blu-ray disc') {
						dtype = 'bluray';
					} else if (args[2] === 'DVD disc') {
						dtype = 'dvd';
					}
				} else if (args[0] === 2) {
					process.stdout.write(` title:${args[2]}\n`);
				} else if (args[0] === 28) {
					process.stdout.write(` language_code:${args[2]}\n`);
				} else if (args[0] === 29) {
					process.stdout.write(` language:${args[2]}\n`);
				} else if (args[0] === 30) {
					process.stdout.write(` title:${args[2]}\n`);
				} else if (args[0] === 31) {
					process.stdout.write(` html:${args[2]}\n`);
				} else if (args[0] === 32) {
					process.stdout.write(` media_title:${args[2]}\n`);
				} else if (args[0] === 33) {
					process.stdout.write(` unknown:${args[2]}\n`);
				} else {
					process.stdout.write(` unhandled:${line}\n`);
				}
			} else if (type === 'SINFO') {
/*
				process.stdout.write(`title:${args[0]} stream:${args[1]}`);
				if (false) {
				} else if (args[2] === 1) {
					process.stdout.write(` stream_type:${args[4]}\n`);
				} else if (args[2] === 2) {
					process.stdout.write(` stream_name:${args[4]}\n`);
				} else if (args[2] === 3) {
					process.stdout.write(` language_code:${args[4]}\n`);
				} else if (args[2] === 4) {
					process.stdout.write(` language:${args[4]}\n`);
				} else if (args[2] === 5) {
					process.stdout.write(` codec_id:${args[4]}\n`);
				} else if (args[2] === 6) {
					process.stdout.write(` codec_short_name:${args[4]}\n`);
				} else if (args[2] === 7) {
					process.stdout.write(` codec_name:${args[4]}\n`);
				} else if (args[2] === 13) {
					process.stdout.write(` bitrate:${args[4]}\n`);
				} else if (args[2] === 14) {
					process.stdout.write(` channels:${args[4]}\n`);
				} else if (args[2] === 17) {
					process.stdout.write(` samplerate:${args[4]}\n`);
				} else if (args[2] === 19) {
					process.stdout.write(` resolution:${args[4]}\n`);
				} else if (args[2] === 20) {
					process.stdout.write(` aspect_ratio:${args[4]}\n`);
				} else if (args[2] === 21) {
					process.stdout.write(` framerate:${args[4]}\n`);
				} else if (args[2] === 22) {
					process.stdout.write(` unknown:${args[4]}\n`);
				} else if (args[2] === 30) {
					process.stdout.write(` stream_description:${args[4]}\n`);
				} else if (args[2] === 31) {
					process.stdout.write(` unknown:${args[4]}\n`);
				} else if (args[2] === 33) {
					process.stdout.write(` stream_delay_ms:${args[4]}\n`);
				} else if (args[2] === 38) {
					process.stdout.write(` default_flag:${args[4]}\n`);
				} else if (args[2] === 39) {
					process.stdout.write(` unknown:${args[4]}\n`);
				} else if (args[2] === 40) {
					process.stdout.write(` stereo:${args[4]}\n`);
				} else if (args[2] === 42) {
					process.stdout.write(` unknown:${args[4]}\n`);
				} else {
					process.stdout.write(` unhandled:${line}\n`);
				}
*/
			} else if (type === 'TINFO') {
				if (!content[args[0]]) {
					content[args[0]] = {
						"type": a_type,
						"filename": "title",
						"selector": "",
						"length": 0,
						"title": a_title,
						"year": a_year,
						"show": a_show,
						"season": a_season,
						"episode": a_episode === null ? 0 : a_episode++
					}
				}
				process.stdout.write(`title:${args[0]} attribute:${args[1]}`);
				if (false) {
				} else if (args[1] === 2) {
					process.stdout.write(` filename_base:${args[3]}\n`);
					content[args[0]].filename = args[3];
				} else if (args[1] === 8) {
					process.stdout.write(` chapters:${args[3]}\n`);
				} else if (args[1] === 9) {
					process.stdout.write(` length:${args[3]}\n`);
					content[args[0]].length = length_to_seconds(args[3]);
				} else if (args[1] === 10) {
					process.stdout.write(` size:${args[3]}\n`);
				} else if (args[1] === 11) {
					process.stdout.write(` bytes:${args[3]}\n`);
				} else if (args[1] === 16) {
					process.stdout.write(` bluray_playlist:${args[3]}\n`);
				} else if (args[1] === 24) {
					process.stdout.write(` dvdtitle:${args[3]}\n`);
					content[args[0]].selector = `${args[3]}:`;
				} else if (args[1] === 25) {
					process.stdout.write(` segment_count:${args[3]}\n`);
				} else if (args[1] === 26) {
					process.stdout.write(` cells:${args[3]}\n`);
					let ranges = args[3].split(',').map((run) => run.split('-').map(k => `@${k}`).join('-')).join(',');
					content[args[0]].selector += ranges;
				} else if (args[1] === 27) {
					process.stdout.write(` filename:${args[3]}\n`);
				} else if (args[1] === 28) {
					process.stdout.write(` language_code:${args[3]}\n`);
				} else if (args[1] === 29) {
					process.stdout.write(` language:${args[3]}\n`);
				} else if (args[1] === 30) {
					process.stdout.write(` string:${args[3]}\n`);
				} else if (args[1] === 31) {
					process.stdout.write(` html:${args[3]}\n`);
				} else if (args[1] === 33) {
					process.stdout.write(` unknown:${args[3]}\n`);
				} else {
					process.stdout.write(` unhandled:${line}\n`);
				}
			} else {
				process.stdout.write(`${line}\n`);
			}
		});
		if (dtype === 'bluray') {
			content.forEach((ct, index) => ct.selector = '' + index);
		}
		content = content.filter((ct) => ct.length <= a_max && ct.length >= a_min);
		cb(dtype, content);
	});
};

let dir = 'F:\\'

interface Content {
	type: string;
	filename: string;
	selector: string;
	length: number;
	title: string;
	year: number;
	show: string;
	season: number;
	episode: number;
}

let get_content = (dir, cb: { (hash: string, type: string, c: Array<Content>): void }): void => {
	compute_hash(dir, (hash) => {
		process.stdout.write(`Determined disc id as "${hash}".\n`);
		let val = db[hash] as undefined | { type: string, content: Array<Content> };
		if (val) {
			cb(hash, val.type, val.content);
		} else {
			analyze(dir, (type, content) => {
				db[hash] = {
					type: type,
					content: content
				};
				save_db('../store/discdb.json', db, () => {
					cb(hash, type, content);
				});
			});
		}
	});
};

let backup_dvd = (hash: string, content: Array<Content>, cb: { (): void }) => {
	let selector = content.map(ct => ct.selector).join(' ');
	let cp = libcp.spawn('makemkvcon', [
		'mkv',
		`disc:0`,
		'all',
		`--manual=${selector}`,
		'--minlength=0',
		'../temp/'
	]);
	cp.stdout.pipe(process.stdout);
	process.stdin.pipe(process.stdin);
	cp.on('close', () => {
		for (let i = 0; i < content.length; i++) {
			let dvdtitle = content[i].selector.split(':')[0];
			libfs.renameSync(`../temp/${content[i].filename}_t${('00' + i).slice(-2)}.mkv`, `../temp/${hash}.${('000' + dvdtitle).slice(-3)}.mkv`);
		}
		cb();
	});
};

let backup_bluray = (hash: string, content: Array<Content>, cb: { (): void }) => {
	let index = 0;
	let next = () => {
		if (index < content.length) {
			let ct = content[index++];
			let cp = libcp.spawn('makemkvcon', [
				'mkv',
				`disc:0`,
				`${ct.selector}`,
				'--minlength=0',
				'../temp/'
			]);
			cp.stdout.pipe(process.stdout);
			process.stdin.pipe(process.stdin);
			cp.on('close', () => {
				next();
			});
		} else {
		for (let i = 0; i < content.length; i++) {
			let dvdtitle = content[i].selector.split(':')[0];
			libfs.renameSync(`../temp/${content[i].filename}_t${('00' + dvdtitle).slice(-2)}.mkv`, `../temp/${hash}.${('000' + dvdtitle).slice(-3)}.mkv`);
		}
			cb();
		}
	};
	next();
};

get_content(dir, (hash, type, content) => {
	let content_to_rip = content.filter((ct) => ['movie', 'episode'].indexOf(ct.type) >= 0);
	let callback = () => {
		process.exit(0);
	};
	if (false) {
	} else if (type === 'dvd') {
		backup_dvd(hash, content_to_rip, callback);
	} else if (type === 'bluray') {
		backup_bluray(hash, content_to_rip, callback);
	} else {
		process.stdout.write('bad disc type!\n');
	}
});
