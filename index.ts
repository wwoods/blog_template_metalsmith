import * as child_process from 'child_process';
import * as fs from 'fs';
import * as program from 'commander';
import * as path from 'path';
import * as process from 'process';
const highlightjs = require('highlight.js');
import {inkscapePlugin} from './plugin/inkscape';
import {layoutPlugin} from './plugin/layout';
import {tagPlugin} from './plugin/tagging-and-dates';

import * as indexConfig from './indexConfig';

const Metalsmith = require('metalsmith');  //No types, use old syntax
const metalsmithDomTransform = require('metalsmith-dom-transform');
const metalsmithSass = require('metalsmith-sass');
const metalsmithWatch = require('metalsmith-watch');

function wrap<T>(fn:any):{(...args:any[]):Promise<T>} {
  return async (...args:any[]) => {
    return await new Promise<T>((resolve, reject) => {
      fn(...args, (err:any, result:T) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };
}

function asyncMaybeCallback<T>(fn:{(...args:any[]):Promise<T>}):{(...args:any[]):Promise<T>} {
  //Only works with single-result-object callbacks.
  //Partly from https://github.com/matthewmueller/unyield/blob/master/index.js
  return async function(this:any) {
    let args = [].slice.call(arguments);
    let last = args[args.length - 1];
    let cb = 'function' === typeof last && last;

    if (cb) {
      args.pop();
      try {
        let r = await fn.apply(this, args);
        return cb(undefined, r);
      }
      catch (e) {
        return cb(e);
      }
    }
    else {
      return await fn.apply(this, arguments);
    }
  }
}

/** PATCH METALSMITH!  We want to read symlinks as a link, not as actual content.
 *
 * Note that metalsmith only points files here, not folders, so we must check
 * each path part.
 * */
const _old_read:any = Metalsmith.prototype.readFile;
const linksSeen = new Map<string, string>(); // link -> linked path.
//Must use asyncMaybeCallback to work with metalsmith-watch
Metalsmith.prototype.readFile = asyncMaybeCallback(async function(this:any, file:string, ...args:any[]) {
  const src = this.source();
  const ret:any = {};  //object seen by metalsmith

  //Absolute path, easy version
  if (file[0] !== '/') file = path.resolve(src, file);

  //Check links only in source directory.
  const relFileParts = path.relative(src, file).split(path.sep);

  for (let i = 0, m = relFileParts.length; i < m; i++) {
    if (relFileParts[i] === '..') break;  //Parents of source never linked.

    const partPath = relFileParts.slice(0, i+1).join(path.sep);

    //Cache
    if (linksSeen.has(partPath)) {
      return {__isLink:linksSeen.get(partPath)};
    }

    const partFsPath = path.resolve(src, partPath);

    const partStats = await wrap<fs.Stats>(fs.lstat)(partFsPath);
    if (partStats.isSymbolicLink()) {
      //New link!
      const linkDest = await wrap<string>(fs.readlink)(partFsPath);
      const linkDestAbs = path.resolve(path.resolve(partFsPath, '..'), linkDest);
      const linkDestRel = path.relative(src, linkDestAbs);

      if (linkDestRel.indexOf('..' + path.sep) !== 0) {
        //Local symlink.
        //
        //Since we have multiple threads doing this at once, flag may already
        //be set, but that's OK as linkDestRel should also be same.
        linksSeen.set(partPath, linkDestRel);
        return {__isLink:linkDestRel};
      }
    }
  }

  //Not a symlink'd file or version of a file, use normal method
  return await wrap<any>(_old_read.bind(this))(file);
});

let naturalSort = require('node-natural-sort');
naturalSort = naturalSort();

function debugMetalsmithPlugin() {
  return async (files:any, metalsmith:any) => {
    Object.keys(files).forEach((file) => {
      console.log(`${file}: ${Object.keys(files[file])}`);
    });
  };
}

//Main program!

program;

program
    .command('build')
    .description('Build the Metalsmith website')
    .action(() => {
      _build((metalsmith) => metalsmith);
    })
;

program
  .command('serve')
  .description('Build the Metalsmith website')
  .option('--incremental', 'Incremental rebuilds')
  .option('--non-local', 'Use non-local address 0.0.0.0 for binding')
  .action((cmd) => {
    const serverArgs = ['-c-1'];
    if (cmd.nonLocal) {
      serverArgs.push('-a');
      serverArgs.push('0.0.0.0');
    }
    else {
      serverArgs.push('-a');
      serverArgs.push('127.0.0.1');
    }
    serverArgs.push('build/')
    const server = child_process.spawn('http-server', serverArgs);
    server.stdout.on('data', (data) => console.log(data.toString()));
    server.stderr.on('data', (data) => console.error(data.toString()));
    server.on('error', (err) => {
      console.error('Failed to start http-server');
    });
    process.on('exit', () => {
      //Auto-shutdown server when we exit on e.g. an error.
      server.kill();
    });
    const paths:any = {
      "${source}/**": "**",
      "layouts/**": "**",
    };
    if (cmd.incremental) {
      paths["${source}/**"] = true;
    }
    _build((metalsmith) => metalsmith.use(metalsmithWatch({
      paths: paths,
      livereload: true,
    })));
  })
;

program.parse(process.argv);


/** Perform the build. */
function _build(finalStep:{(metalsmith:any):any}) {
  let firstBuild = true;

  //Track attachments across builds
  type IncrementalAttached = [Map<string, any>, Map<string, any> | undefined];
  const incrementalAttached = new Map<string, IncrementalAttached>();
  const nongenFiles = new Map<string, any>();

  let ms = Metalsmith(path.resolve(__dirname, '..'))
    .metadata(indexConfig.siteMetadata)
    .source('./contents')
    .destination('./build')
    //Delete everything in ./build?
    .clean(true)
    .use(function(files:any, metalsmith:any) {
      metalsmith.metadata().incremental = !firstBuild;
      for (let k in files) {
        files[k].id = k;
        //Copy new versions of index pages for incremental builds
        if (/(^|\/)index.pug$/.test(k)) {
          //Index page
          nongenFiles.set(k, _fileCopy(files[k]));
        }
        if (files[k].__isLink) {
          //A symlink; we represent these through the "linksSeen" variable.
          delete files[k];
        }
      }
    })
    //This debug is here just to show how "files" looks in Metalsmith.  All
    //Metalsmith plugins do is manipulate the files array, which maps paths to
    //some metadata (including "contents", the file's contents).
    .use(debugMetalsmithPlugin())
    //Apply Inkscape transformations as needed.  Since Inkscape supports nice
    //WYSIWYG editing and arranging of images, trying to use that as a blog
    //component editor.
    .use(inkscapePlugin({ pattern: '**/*.multi.svg' }))
    //Replicate the file system hierarchy as "attachments" and "attachedTo"
    .use(function(files:any, metalsmith:any) {
      //TODO: file date via name (YYYY-MM-DD-<name>).  Git LFS support / instructions.
      //TODO: teaser implementation.  Should pre-render ALL blocks in contents to e.g. "blocks.contents" as HTML.  Useful for e.g. text scanning and for using HTML attributes to apply local tags (see later).  Replaces "contents" with blocks that unescaped HTML (!= blocks.contents, etc) in template.
      //TODO: Local tags: long pages may only have a couple paragraphs or a region of interest to mark with a tag.  Should apply tag to document, but use e.g. footnote^{1,2} markers to quick-link the reference points.
      //TODO: MathJax pre-rendered as https://joashc.github.io/posts/2015-09-14-prerender-mathjax.html
      //TODO: Multi-depth, like scaled concepts.  Need a way of making infinite outlines, or a trick that approximates them on FS.
      //TODO: git submodule integration!!! This would allow us to use a single metalsmith repository to describe
      //    a whole host of other projects in context of one another.  Also allows access controls, etc.
      //    Proposed usage: folder w/ repository should have an index.pug that specifies how repo should be treated.
      //      Default is same as this website - load indexConfig, optionally prefix EVERY tag with something, then merge
      //      data from that website into this one.
      //TODO: TeX integration?
      //TODO: cache each folder's build date, and when any file in folder changed, update siblings only.
      //TODO:     Corollary: consider if siblings only will always be sufficient through e.g. tags.
      //TODO:     Corollary: may want database integration for this.
      //TODO: plugin abstraction that plays well with above cache, can be used for e.g. indexing text, PDF files, etc.
      const metadata = metalsmith.metadata();
      const ensureDefaultFolderIndex = (folderWithTrailingSlash:string) => {
        const folderIndex = `${folderWithTrailingSlash}index.pug`;
        if (files[folderIndex] !== undefined) return;

        const g = nongenFiles.get(folderIndex);
        if (metadata.incremental && g !== undefined) {
          //Re-build, as attachments may have changed.
          files[folderIndex] = _fileCopy(g);
        }
        else {
          let folderParts = folderWithTrailingSlash.split('/');
          let folderName:string;
          if (folderParts.length <= 1) {
            folderName = metadata.sitename;
          }
          else {
            folderName = folderParts[folderParts.length - 2];
          }
          let attached = incrementalAttached.get(folderIndex);
          if (attached === undefined) {
            attached = [new Map<string, any>(), new Map<string, any>()];
            incrementalAttached.set(folderIndex, attached);
          }
          files[folderIndex] = {
            generated: true,
            title: folderName,
            contents: '',
          };
        }
      };
      ensureDefaultFolderIndex('');
      for (let k in files) {
        let attached = incrementalAttached.get(k);
        const hasAttached = k.search(/(^|\/)index\.pug$/g) !== -1;
        if (attached === undefined) {
          attached = [new Map<string, any>(),
              hasAttached ? new Map<string, any>() : undefined];
          incrementalAttached.set(k, attached);
        }

        //Ensure there is a corresponding index.pug for each file folder, as we
        //want to represent the file system hierarchy
        const parts = k.split('/');
        for (let i = 0, m = parts.length-1; i < m; i++) {
          ensureDefaultFolderIndex(`${parts.slice(0, i+1).join('/')}/`);
        }
      }
      for (let [k, v] of linksSeen.entries()) {
        //k, v means k is a link to v.  In other words, the parent of k should
        //attach v.
        const kParent = k.substring(0, k.lastIndexOf(path.sep)) + `${path.sep}index.pug`;
        if (fs.statSync(path.resolve(metalsmith.source(), v)).isDirectory()) {
          //Target is directory, use our index file for that directory.
          v = v + `${path.sep}index.pug`;
        }

        //Make sure that, at least when first built, both parts of the link
        //exist.
        if (firstBuild) {
          if (files[kParent] === undefined)
            throw new Error(`Could not find link part ${kParent}`);
          if (files[v] === undefined)
            throw new Error(`Could not find link part ${v}`);

          let iv:IncrementalAttached = (
              incrementalAttached.get(v) as IncrementalAttached);
          (iv as IncrementalAttached)[0].set(kParent, files[kParent]);
          iv = incrementalAttached.get(kParent) as IncrementalAttached;
          ((iv as IncrementalAttached)[1] as Map<string, any>).set(v, files[v]);
        }
      }
      firstBuild = false;
      for (let k in files) {
        if (k.search(/(^|\/)index\.pug$/g) !== -1) {
          //Add to parent folder, that's it.
          let folder = k.substring(0, k.lastIndexOf('/'));
          folder = folder.substring(0, folder.lastIndexOf('/'));
          folder = `${folder}/index.pug`;
          if (folder[0] === '/') folder = folder.substring(1);
          if (folder === k) continue; //root

          let attach = incrementalAttached.get(folder);
          if (attach !== undefined) {
            const j = attach[1];
            if (j !== undefined) {
              j.set(k, files[k]);
            }
          }

          attach = incrementalAttached.get(k);
          if (attach !== undefined) {
            attach[0].set(folder, files[folder]);
          }

          continue;
        }

        let folder = k.substring(0, k.lastIndexOf('/')+1);  //includes "/"
        const fname = `${folder}index.pug`;
        const f = files[fname];
        if (f === undefined) continue;
        const fAttached = incrementalAttached.get(fname);
        if (fAttached === undefined) continue;
        const j = fAttached[1];
        if (j === undefined) continue;
        j.set(k, files[k]);
        (incrementalAttached.get(k) as IncrementalAttached)[0].set(fname, f);
      }
      for (let k in files) {
        const f = files[k];
        const attach = incrementalAttached.get(k);
        if (attach !== undefined) {
          f.attachedTo = [...attach[0].values()];
          {
            const j = attach[1];
            if (j !== undefined) {
              f.attachments = [...j.values()];
              f.attachments.sort((a:any, b:any) => naturalSort(a.title, b.title));
            }
          }
        }
      }
    })
    //Assign date and tag metadata, build tag sites (configured via indexConfig.ts)
    .use(tagPlugin(indexConfig.tagConfig))
    .use((files:any, metalsmith:any) => {
      //Sets .path, as all paths are now fixed
      for (let k in files) {
        let kAbs = '/' + k;
        if (kAbs.search(/\/index\.pug$/g) !== -1) {
          files[k].path = kAbs.replace(/\/index\.pug$/g, '/');
        }
        else {
          //Permalinks plugin redirection
          files[k].path = kAbs.replace(/([^\/]+)\.pug$/g, '$1');
        }
      }
    })
    .use(layoutPlugin({
      pattern: ['**/*.pug']
    }))
    //DOM transformations
    .use(metalsmithDomTransform({
      transforms: [
        (dom:any, file:any, {files, metalsmith}:{files:any, metalsmith:any}, done:any) => {
          //Code highlighting
          for (const q of ['code', '.code']) {
            for (const el of dom.querySelectorAll(q)) {
              highlightjs.highlightBlock(el);
              if (q === 'code' && el.parentNode && el.parentNode.classList) {
                el.parentNode.classList.add('lang-highlight');
              }
            }
          }

          done();
        }
      ]
    }))
    .use(metalsmithSass({
    }))
  ;
  finalStep(ms)
    .build((err:any) => {
      if (err) throw err;
    });
}


/** Copy a Metalsmith file object in a way that is safe from transformers.
 * */
function _fileCopy(file:any):any {
  const copy = Object.assign({}, file);
  if (copy.contents !== undefined)
    copy.contents = Buffer.from(copy.contents);
  return copy;
}

