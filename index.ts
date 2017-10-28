import * as path from 'path';
import {layoutPlugin} from './plugin/layout';

const Metalsmith = require('metalsmith');  //No types, use old syntax
const layouts = require('metalsmith-layouts');
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
  .clean(true)
  .use(debugMetalsmithPlugin())
  .use((files:any, metalsmith:any) => {
    //Split tags like test/tag into test and test/tag (parent membership)
    for (let k in files) {
      if (files[k].tags === undefined) {
        files[k].tags = [];
      }
      else if (typeof files[k].tags === 'string') {
        files[k].tags = files[k].tags.split(',').map((v:string) => v.replace(/^\s+|\s+$/g, ''));
      }
      for (let t of files[k].tags.slice()) {
        while (true) {
          const lastSlash = t.lastIndexOf('/');
          if (lastSlash === -1) break;
          t = t.substring(0, lastSlash);
          files[k].tags.push(t);
        }
      }
    }
  })
  .use((files:any, metalsmith:any) => {
    for (let k in files) {
      files[k].path = k.replace(/([^\/]+)\.pug$/g, '$1/index.html');
    }
  })
  .use(tags({
    handle: 'tags',
    path: 'tags/:tag.pug',
    layout: 'tag.pug',
    sortBy: 'date',
    reverse: true,
    slug: (tag:any) => tag
  }))
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
