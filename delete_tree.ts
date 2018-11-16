import * as libfs from 'fs';
import * as libpath from 'path';

export function async(root: string, cb: { (): void }): void {
  libfs.stat(root, (error, stats) => {
    if (stats.isDirectory()) {
      libfs.readdir(root, (error, nodes) => {
        nodes = nodes.map((node) => {
          return libpath.join(root, node);
        });
        let pick_next = () => {
          if (nodes.length > 0) {
            let node = nodes.pop();
            async(node, () => {
              pick_next();
            });
          } else {
            libfs.rmdir(root, (error) => {
              cb();
            });
          }
        };
        pick_next();
      });
    } else if (stats.isFile()) {
      libfs.unlink(root, (error) => {
        cb();
      });
    } else {
      throw new Error();
    }
  });
};

export function sync(root: string): void {
  let stats = libfs.statSync(root);
  if (stats.isDirectory()) {
    let nodes = libfs.readdirSync(root).map((node) => {
      return libpath.join(root, node);
    });
    nodes.forEach(sync);
    libfs.rmdirSync(root);
  } else if (stats.isFile()) {
    libfs.unlinkSync(root);
  } else {
    throw new Error();
  }
};
