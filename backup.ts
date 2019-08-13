import * as libcp from 'child_process';
import * as libfs from 'fs';
import * as libpath from 'path';
import * as libcrypto from 'crypto';
import * as librl from 'readline';

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

let analyze = (dir: string, cb: { (content: Array<Content>): void }) => {
	libcp.exec(`makemkvcon info disc:0 --robot --minlength=0`, (error, stdout, stderr) => {
		let content = new Array<Content>();
		let lines = stdout.split(/\r?\n/);
		lines.map((line) => {
			let parts = line.split(':');
			let type = parts.shift() as string;
			let args = JSON.parse(`[${parts.join(':')}]`);
			if (false) {
			} else if (type === 'SINFO') {
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
				} else if (args[2] === 40) {
					process.stdout.write(` stereo:${args[4]}\n`);
				} else if (args[2] === 42) {
					process.stdout.write(` unknown:${args[4]}\n`);
				} else {
					process.stdout.write(` unhandled:${line}\n`);
				}
			} else if (type === 'TINFO') {
				if (!content[args[0]]) {
					content[args[0]] = {
						"type": "unknown",
						"selector": "",
						"title": "",
						"year": 0
					}
				}
				process.stdout.write(`title:${args[0]} attribute:${args[1]}`);
				if (false) {
				} else if (args[1] === 8) {
					process.stdout.write(` chapters:${args[3]}\n`);
				} else if (args[1] === 9) {
					process.stdout.write(` length:${args[3]}\n`);
				} else if (args[1] === 11) {
					process.stdout.write(` bytes:${args[3]}\n`);
				} else if (args[1] === 24) {
					process.stdout.write(` dvdtitle:${args[3]}\n`);
					content[args[0]].selector = `${args[3]}:`
				} else if (args[1] === 25) {
					process.stdout.write(` segment_count:${args[3]}\n`);
				} else if (args[1] === 26) {
					let str = args[3].split(',').map((run) => run.split('-').map(f => `@${f}`).join('-')).join(',');
					process.stdout.write(` cells:${args[3]}\n`);
					content[args[0]].selector += str;
				} else if (args[1] === 27) {
					process.stdout.write(` filename:${args[3]}\n`);
				} else {
					process.stdout.write(` unhandled:${line}\n`);
				}
			} else {
				process.stdout.write(`${line}\n`);
			}
		});
		cb(content);
	});
};






let dir = 'F:\\VIDEO_TS'

interface Content {
	type: string,
	selector: string,
	title: string,
	year: number
}

let get_content = (dir, cb: { (hash: string, c: Array<Content>): void }): void => {
	compute_hash(dir, (hash) => {
		let val = db[hash] as undefined | { type: string, content: Array<Content> };
		if (val) {
			cb(hash, val.content);
		} else {
			analyze(dir, (content) => {
				db[hash] = {
					type: "dvd",
					content: content
				};
				save_db('../store/discdb.json', db, () => {
					cb(hash, content);
				});
			});
		}
	});
};

get_content(dir, (hash, content) => {
	let index = 0;
	let done = () => {
		process.exit();
	};
	let next = () => {
		if (index < content.length) {
			let ct = content[index];
			let cp = libcp.spawn('makemkvcon', [
				'mkv',
				`disc:0`,
				'',
				`--manual=${ct.selector}`,
				'--robot',
				'../temp/'
			]);
			cp.stdout.pipe(process.stdout);
			process.stdin.pipe(process.stdin);
			cp.on('close', () => {
				libfs.rename(`../temp/title_t${('00' + index).slice(-2)}.mkv`, `../temp/${hash}.${('000' + index).slice(-3)}.mkv`, () => {
					index++;
					next();
				});
			});
		} else {
			done();
		}
	};
	next();
});
