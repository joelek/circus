let libcp = require('child_process');
let libpath = require('path');
let libfs = require('fs');
let ffmpeg = require('./ffmpeg');

let queue = [];

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

let stats = require('../store/queue_metadata.json');

let pick_from_queue = () => {
  if (queue.length > 0) {
    let index = (Math.random() * queue.length) | 0;
    let input = queue.splice(index, 1)[0];
    let key = input.split(libpath.sep).slice(2).join(':');
    if (stats[key]) {
      if (queue.length > 0) {
        pick_from_queue();
      } else {
        process.exit(0);
      }
    } else {
      console.log(key);
      ffmpeg.determine_metadata(input, (n) => {
        stats[key] = n;
        let sorted = [];
        for (let key of Object.keys(stats)) {
          sorted.push({
            key: key,
            value: stats[key]
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
        let out = {};
        sorted.forEach((entry) => {
          out[entry.key] = entry.value;
        });
        let fd = libfs.openSync('../store/queue_metadata.json', 'w');
        libfs.writeSync(fd, JSON.stringify(out, null, 2));
        libfs.closeSync(fd);
        if (queue.length > 0) {
          pick_from_queue();
        } else {
          process.exit(0);
        }
      });
    }
  } else {
    setTimeout(() => {
      queue = generate_queue([], '../queue/');
      pick_from_queue();
    }, 1000*10);
  }
};

pick_from_queue();
