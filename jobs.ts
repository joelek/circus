import * as libcp from 'child_process';
import * as libfs from 'fs';
import * as libpath from 'path';
import * as libcrypto from 'crypto';
import * as librl from 'readline';
import * as vobsub from './vobsub';
import * as ffmpeg from './ffmpeg';
let config = require('../store/config.json');

let move_file = (filename: string): void => {
  let paths = ['..', 'media', ...filename.split(libpath.sep).slice(2) ];
  let file = paths.pop();
  libfs.mkdirSync(libpath.join(...paths), { recursive: true });
  libfs.renameSync(filename, libpath.join(...paths, file));
};

let generate_queue = (files: Array<string>, node: string): Array<string> => {
  let stat = libfs.statSync(node);
  if (stat.isDirectory()) {
    libfs.readdirSync(node).map((subnode) => {
      return libpath.join(node, subnode);
    }).map((node) => {
      return generate_queue(files, node);
    });
  } else if (stat.isFile()) {
    files.push(node);
  }
  return files;
};

let queue = generate_queue([], '../jobs/queue/');

interface Metadata {
	asEpisode(): EpisodeMetadata;
	asMovie(): MovieMetadata;
}

interface EpisodeMetadata extends Metadata {
	season: number;
	episode: number;
	show: string;
	title: string;
	basename: string;
}

interface MovieMetadata extends Metadata {
	title: string;
	year: number;
	basename: string;
}

interface Content {
  type: string;
  selector: string;
  title: string;
  year: number;
  show: string;
  season: number;
  episode: number;
}

interface DatabaseEntry {
	type: string;
	content: Array<Content>;
}

interface Database {
	[key: string]: DatabaseEntry;
}

let pathify = (string: string): string => {
	return encodeURIComponent(string.split(' ').join('_').split('-').join('_').toLowerCase());
};

let get_media_info = (path: string): { type: string, content: Content } | undefined => {
	let filename = path.split(libpath.sep).pop();
	let string = libfs.readFileSync('../store/discdb.json', 'utf8');
	let database = JSON.parse(string) as Database;
	let parts = filename.split('.');
	let hash = parts[0];
	let title = Number.parseInt(parts[1]);
	let entry = database[hash];
	let mi = entry.content.find(ct => Number.parseInt(ct.selector.split(':')[0]) === title);
	if (mi) {
		return {
			type: entry.type,
			content: mi
		}
	} else {
		return {
			type: "unknown",
			content: null
		}
	}
};

let pick_from_queue = (): void => {
  if (queue.length > 0) {
    let index = (Math.random() * queue.length) | 0;
    let input = queue.splice(index, 1)[0];
		let mi = get_media_info(input);
		if (mi) {
			let basename = input;
			let ct = mi.content;
			if (mi.type === 'episode') {
				basename = `../jobs/media/shows/${pathify(ct.show)}-${pathify(config.suffix)}/s${('00' + ct.season).slice(-2)}/${pathify(ct.show)}-s${('00' + ct.season).slice(-2)}e${('00' + ct.episode).slice(-2)}-${pathify(ct.title)}-${pathify(config.suffix)}`;
			} else if (mi.type === 'movie') {
				basename = `../jobs/media/movies/${pathify(ct.title)}-${('0000' + ct.year).slice(-4)}}-${pathify(config.suffix)}/${pathify(ct.title)}-${('0000' + ct.year).slice(-4)}}-${pathify(config.suffix)}`;
			}
			if (mi.type === 'dvd') {
				vobsub(input, (outputs) => {
					ffmpeg.transcode(input, (output) => {
						pick_from_queue();
					}, mi);
				});
			}
			return;
		}
		pick_from_queue();
  } else {
    process.exit(0);
  }
};

pick_from_queue();