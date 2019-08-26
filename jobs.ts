import * as libcp from 'child_process';
import * as libfs from 'fs';
import * as libpath from 'path';
import * as libcrypto from 'crypto';
import * as librl from 'readline';
import * as vobsub from './vobsub';
import * as ffmpeg from './ffmpeg';
let config = require('../store/config.json');

let move_files = (filenames: string[], basename: string): void => {
	filenames.forEach((filename) => {
	  let dirs = filename.split(libpath.sep);
	  let file = dirs.pop();
		let parts = file.split('.');
		let ending = parts.slice(2).join('.');
		let targetdir = basename.split(libpath.sep);
		targetdir.pop();
	  libfs.mkdirSync(targetdir.join(libpath.sep), { recursive: true });
	  libfs.renameSync(filename, basename + '.' + ending);
	});
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
	return encodeURIComponent(string.split(' ').join('_').split('-').join('_').split('ñ').join('n').toLowerCase());
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

let archive_file = (path: string): void => {
  let dirs = path.split(libpath.sep);
  let file = dirs.pop();
  libfs.renameSync(path, libpath.join('../jobs/archive/', file));
};

let pick_from_queue = (): void => {
  if (queue.length > 0) {
    let index = (Math.random() * queue.length) | 0;
    let input = queue.splice(index, 1)[0];
		let mi = get_media_info(input);
		if (mi) {
			let basename = null;
			let ct = mi.content;
			if (ct.type === 'episode') {
				basename = `../media/video/shows/${pathify(ct.show)}-${pathify(config.suffix)}/s${('00' + ct.season).slice(-2)}/${pathify(ct.show)}-s${('00' + ct.season).slice(-2)}e${('00' + ct.episode).slice(-2)}-${pathify(ct.title)}-${pathify(config.suffix)}`;
				basename = libpath.join(basename);
			} else if (ct.type === 'movie') {
				basename = `../media/video/movies/${pathify(ct.title)}-${('0000' + ct.year).slice(-4)}}-${pathify(config.suffix)}/${pathify(ct.title)}-${('0000' + ct.year).slice(-4)}}-${pathify(config.suffix)}`;
				basename = libpath.join(basename);
			}
			process.stdout.write(`Basename set to ${basename}\n`);
			if (mi.type === 'dvd' || mi.type === 'bluray') {
				vobsub(input, (outputs) => {
					ffmpeg.transcode(input, (code, output) => {
						if (basename) {
							move_files([...outputs, output], basename);
						}
						archive_file(input);
						pick_from_queue();
					}, ct, basename);
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
