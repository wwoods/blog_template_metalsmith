import * as path from 'path';
import {layoutPlugin} from './plugin/layout';
import {tagPlugin} from './plugin/tagging-and-dates';

import * as indexConfig from './indexConfig';

const Metalsmith = require('metalsmith');  //No types, use old syntax
const metalsmithSass = require('metalsmith-sass');
const metalsmithWatch = require('metalsmith-watch');

let naturalSort = require('node-natural-sort');
naturalSort = naturalSort();

function debugMetalsmithPlugin() {
  return async (files:any, metalsmith:any) => {
    Object.keys(files).forEach((file) => {
      console.log(`${file}: ${Object.keys(files[file])}`);
    });
  };
}

Metalsmith(path.resolve(__dirname, '..'))
  .metadata(indexConfig.siteMetadata)
  .source('./content')
  .destination('./build')
  //Delete everything in ./build?
  .clean(true)
  //This debug is here just to show how "files" looks in Metalsmith.  All
  //Metalsmith plugins do is manipulate the files array, which maps paths to
  //some metadata (including "contents", the file's contents).
  .use(debugMetalsmithPlugin())
  //Replicate the file system hierarchy as "attachments" and "attachedTo"
  .use(function(files:any, metalsmith:any) {
    //TODO: Post list should have dates and tags.
    //TODO: teaser implementation
    //TODO: MathJax pre-rendered as https://joashc.github.io/posts/2015-09-14-prerender-mathjax.html
    //TODO: Support symlinks in file system hierarchy (attached / attachedTo).
    //TODO: Multi-depth, like scaled concepts.  Need a way of making infinite outlines, or a trick that approximates them on FS.
    //TODO: git submodule integration!!! This would allow us to use a single metalsmith repository to describe
    //    a whole host of other projects in context of one another.
    //TODO: TeX integration?
    //TODO: cache each folder's build date, and when any file in folder changed, update siblings only.
    //TODO:     Corollary: consider if siblings only will always be sufficient through e.g. tags.
    //TODO: plugin abstraction that plays well with above cache, can be used for e.g. indexing text, PDF files, etc.
    const metadata = metalsmith.metadata();
    const ensureDefaultFolderIndex = (folderWithTrailingSlash:string) => {
      const folderIndex = `${folderWithTrailingSlash}index.pug`;
      if (files[folderIndex] === undefined) {
        let folderParts = folderWithTrailingSlash.split('/');
        let folderName:string;
        if (folderParts.length <= 1) {
          folderName = metadata.sitename;
        }
        else {
          folderName = folderParts[folderParts.length - 2];
        }
        files[folderIndex] = {
          generated: true,
          title: folderName,
          contents: '',
          attachedTo: [],
          attachments: [],
        };
      }
    };
    ensureDefaultFolderIndex('');
    for (let k in files) {
      //Anything can be attached
      files[k].attachedTo = files[k].attachedTo || [];
      //Only index.pug has attachments.
      if (k.search(/(^|\/)index\.pug$/g) !== -1) {
        files[k].attachments = files[k].attachments || [];
      }

      //Ensure there is a corresponding index.pug for each file folder, as we
      //want to represent the file system hierarchy
      const parts = k.split('/');
      for (let i = 0, m = parts.length-1; i < m; i++) {
        ensureDefaultFolderIndex(`${parts.slice(0, i+1).join('/')}/`);
      }
    }
    for (let k in files) {
      if (k.search(/(^|\/)index\.pug$/g) !== -1) {
        //Add to parent folder, that's it.
        let folder = k.substring(0, k.lastIndexOf('/'));
        folder = folder.substring(0, folder.lastIndexOf('/'));
        folder = `${folder}/index.pug`;
        if (folder[0] === '/') folder = folder.substring(1);
        if (folder === k) continue; //root
        const f = files[folder];
        if (f !== undefined && f.attachments !== undefined) {
          f.attachments.push(files[k]);
          files[k].attachedTo.push(f);
        }
        continue;
      }

      let folder = k.substring(0, k.lastIndexOf('/')+1);  //includes "/"
      const f = files[`${folder}index.pug`];
      if (f === undefined) continue;
      if (f.attachments === undefined) continue;
      f.attachments.push(files[k]);
      files[k].attachedTo.push(f);
    }
    for (let k in files) {
      const att = files[k].attachments;
      att !== undefined && att.sort((a:any, b:any) => naturalSort(a.title, b.title));
    }
  })
  //Assign date and tag metadata, build tag sites (configured via content/tags.json)
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
  .use(metalsmithSass({
  }))
  .use(metalsmithWatch({
    paths: { "content/**/*": "**", "layouts/**/*": "**" },
    livereload: true,
  }))
  .build((err:any) => {
    if (err) throw err;
  })
  ;
