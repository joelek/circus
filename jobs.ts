import * as libcp from 'child_process';
import * as libfs from 'fs';
import * as libpath from 'path';
import * as libcrypto from 'crypto';
import * as librl from 'readline';

let queue = new Array<string>();

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

interface EpisodeMetadata {
	season: number;
	episode: number;
	show: string;
	title: string;
}

interface MovieMetadata {
	title: string;
	year: number;
}

interface DatabaseEntry {
	type: string;
	content: Array<{
    type: string;
    selector: string;
    title: string;
    year: number;
    show: string;
    season: number;
    episode: number;
	}>;
}

interface Database {
	[key: string]: DatabaseEntry;
}

let get_media_info = (path: string): null | EpisodeMetadata | MovieMetadata => {
	let filename = path.split(libpath.sep).pop();
	let string = libfs.readFileSync('../store/discdb.json', 'utf8');
	let database = JSON.parse(string) as Database;
	let parts = filename.split('.');
	let hash = parts[0];
	let title = Number.parseInt(parts[1]);
	let entry = database[hash];
	if (entry) {
		let ct = entry.content.find(ct => Number.parseInt(ct.selector.split(':')[0]) === title);
		if (ct) {
			if (ct.type === 'episode') {
				return {
					season: ct.season,
					episode: ct.episode,
					show: ct.show,
					title: ct.title
				};
			} else if (ct.type === 'movie') {
				return {
					title: ct.title,
					year: ct.year
				};
			}
		}
	}
	return null;
};

let pick_from_queue = (): void => {
  if (queue.length > 0) {
    let index = (Math.random() * queue.length) | 0;
    let input = queue.splice(index, 1)[0];
		let mi = get_media_info(input);
		console.log(mi);
		pick_from_queue();
  } else {
    setTimeout(() => {
      queue = generate_queue([], '../temp/ready/');
      pick_from_queue();
    }, 1000*10);
  }
};

pick_from_queue();
