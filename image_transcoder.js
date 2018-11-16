let libcp = require('child_process');
let libpath = require('path');
let libfs = require('fs');

let queue = [];

let archive_file = (filename) => {
  let paths = ['..', 'archive', ...filename.split(libpath.sep).slice(2) ];
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

let transcode = (filename, size, cb) => {
  let path = filename.split(libpath.sep);
  let file = path.pop();
  let name = file.split('.').slice(0, -1).join('.');
  let outdir = ['..', 'temp', ...path.slice(2)];
  let outfile = libpath.join(...outdir, `${name}.${size}.jpg`);
  libfs.mkdirSync(libpath.join(...outdir), { recursive: true });
  let cp = libcp.spawn('ffmpeg', [
    '-i', filename,
    '-vf', `format=yuv420p16le,crop=iw-4:ih-4,scale=${size}:${size},bm3d=10:4:1,gradfun=1:16`,
    '-q:v', '1',
    '-f', 'singlejpeg',
    outfile,
    '-y'
  ]);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  process.stdin.pipe(cp.stdin);
  cp.on('exit', (code) => {
    cb(outfile);
  });
};

let transcode_all = (filename, cb) => {
  transcode(filename, 270, (output270) => {
    transcode(filename, 540, (output540) => {
      transcode(filename, 1080, (output1080) => {
        cb([ output270, output540, output1080 ]);
      });
    });
  });
};

let pick_from_queue = () => {
  if (queue.length > 0) {
    let index = (Math.random() * queue.length) | 0;
    let input = queue.splice(index, 1)[0];
    transcode_all(input, (outputs) => {
      archive_file(input);
      outputs.forEach((output) => {
        move_file(output);
      });
      pick_from_queue();
    });
  } else {
    setTimeout(() => {
      queue = generate_queue([], '../queue/image/');
      pick_from_queue();
    }, 1000*10);
  }
};

if (process.argv[2]) {
  process.argv[2] = process.argv[2].split('/').join(libpath.sep);
  transcode_all(process.argv[2], (outputs) => {
    console.log(outputs);
    process.exit(0);
  });
} else {
  pick_from_queue();
}
