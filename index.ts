import * as path from 'path';
import {layoutPlugin} from './plugin/layout';
import {tagPlugin} from './plugin/tagging-and-dates';

const Metalsmith = require('metalsmith');  //No types, use old syntax
const permalinks = require('metalsmith-permalinks');
const tags = require('metalsmith-tags');

function debugMetalsmithPlugin() {
  return async (files:any, metalsmith:any) => {
    Object.keys(files).forEach((file) => {
      console.log(`${file}: ${Object.keys(files[file])}`);
    });
  };
}

Metalsmith(path.resolve(__dirname, '..'))
  .metadata({
    sitename: "Example Metalsmith Site",
    author: "Walt Woods",
  })
  .source('./content')
  .destination('./build')
  //Delete everything in ./build?
  .clean(true)
  //This debug is here just to show how "files" looks in Metalsmith.  All
  //Metalsmith plugins do is manipulate the files array, which maps paths to
  //some metadata (including "contents", the file's contents).
  .use(debugMetalsmithPlugin())
  //Assign date and tag metadata, build tag sites
  .use(tagPlugin())
  .use((files:any, metalsmith:any) => {
    //Sets .path, as all paths are now fixed
    for (let k in files) {
      if (k.search(/index\.pug$/g) !== -1) {
        files[k].path = k.replace(/index\.pug$/g, 'index.html');
      }
      else {
        files[k].path = k.replace(/([^\/]+)\.pug$/g, '$1/index.html');
      }
    }

    //Attach files to their local index.pug
    //TODO: folders should be attached to parent index.pug.
    for (let k in files) {
      //Only index.pug has attachments.
      if (k.search(/index\.pug$/g) !== -1) {
        files[k].attachments = [];
      }
    }
    for (let k in files) {
      if (k.search(/index\.pug$/g) !== -1) continue;
      let folder = k.substring(0, k.lastIndexOf('/'));
      const f = files[`${folder}/index.pug`];
      if (f === undefined) continue;
      if (f.attachments === undefined) continue;
      f.attachments.push(k);
    }
  })
  /*.use(tags({
    handle: 'tags',
    path: 'tags/:tag.pug',
    layout: 'tag.pug',
    sortBy: 'date',
    reverse: true,
    slug: (tag:any) => tag
  }))*/
  .use(layoutPlugin({
    pattern: ['**/*.pug']
  }))
  .use(permalinks({
    //TODO
  }))
  .use(debugMetalsmithPlugin())
  .build((err:any) => {
    if (err) throw err;
  })
  ;
