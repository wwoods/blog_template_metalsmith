import * as path from 'path';
import {layoutPlugin} from './plugin/layout';
import {tagPlugin} from './plugin/tagging-and-dates';

import * as indexConfig from './indexConfig';

const Metalsmith = require('metalsmith');  //No types, use old syntax
const metalsmithSass = require('metalsmith-sass');

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
    //TODO: folders should be attached to parent index.pug.
    //TODO: folder should generate a blank index.pug, hierarchy similar to tags
    //TODO: attachments and attachedTo.  Same as parent / children for file system hierarchy.  Support symlinks???
    //TODO: attach things without an index.pug.  Basically, make it impossible to "lose" a file.
    //TODO: cache each folder's build date, and when any file in folder changed, update siblings only.
    //  TODO Corollary: consider if siblings only will always be sufficient through e.g. tags.
    //TODO: plugin abstraction that plays well with above cache, can be used for e.g. indexing text, PDF files, etc.
    //TODO: MathJax pre-rendered as https://joashc.github.io/posts/2015-09-14-prerender-mathjax.html
    for (let k in files) {
      //Anything can be attached
      files[k].attachedTo = files[k].attachedTo || [];
      //Only index.pug has attachments.
      if (k.search(/index\.pug$/g) !== -1) {
        files[k].attachments = [];
      }
    }
    for (let k in files) {
      if (k.search(/index\.pug$/g) !== -1) {
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

      let folder = k.substring(0, k.lastIndexOf('/'));
      const f = files[`${folder}/index.pug`];
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
      if (k.search(/\/index\.pug$/g) !== -1) {
        files[k].path = k.replace(/\/index\.pug$/g, '/');
      }
      else {
        //Permalinks plugin redirection
        files[k].path = k.replace(/([^\/]+)\.pug$/g, '$1');
      }
    }
  })
  .use(layoutPlugin({
    pattern: ['**/*.pug']
  }))
  .use(metalsmithSass({
  }))
  .build((err:any) => {
    if (err) throw err;
  })
  ;
