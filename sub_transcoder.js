let libcp = require('child_process');
let libpath = require('path');
let libfs = require('fs');
let ffmpeg = require('./ffmpeg');
let vobsub = require('./vobsub');

let queue = [];

let archive_file = (filename) => {
  let paths = ['..', 'queue', ...filename.split(libpath.sep).slice(2) ];
  let file = paths.pop();
  libfs.mkdirSync(libpath.join(...paths), { recursive: true });
  libfs.renameSync(filename, libpath.join(...paths, file));
};

let move_file = (filename) => {
  let paths = ['..', 'media', ...filename.split(libpath.sep).slice(2) ];
  let file = paths.pop();
  libfs.mkdirSync(libpath.join(...paths), { recursive: true });
  libfs.renameSync(filename, libpath.join(...paths, file));
};

let generate_queue = (files, node) => {
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

let pick_from_queue = () => {
  if (queue.length > 0) {
    let index = (Math.random() * queue.length) | 0;
    let input = queue.splice(index, 1)[0];
    vobsub(input, (subtitle_files) => {
      for (let i = 0; i < subtitle_files.length; i++) {
        move_file(subtitle_files[i]);
      }
      archive_file(input);
      pick_from_queue();
    });
  } else {
    setTimeout(() => {
      queue = generate_queue([], '../nosubs/');
      pick_from_queue();
    }, 1000*10);
  }
};

pick_from_queue();
