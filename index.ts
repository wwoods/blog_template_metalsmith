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
    //Assume tags specified as "a/b/c" denotes that c is a child of b, and
    //b is a child of a.  The document will be tagged as a, b, and c.
    const tagsChildren:any = {};
    const tagsParents:any = {};

    for (let k in files) {
      if (files[k].tags === undefined) {
        files[k].tags = [];
      }
      else if (typeof files[k].tags === 'string') {
        files[k].tags = files[k].tags.split(',');
      }
      const oldTags = files[k].tags
          .map((v:string) => v.toLowerCase().replace(/^\s+|\s+$/g, ''))
          ;
      const newTags = new Map<string, true>();
      for (let t of oldTags) {
        const tsplits = t.split(/\s*\/\s*/g);
        for (let i = 0, m = tsplits.length - 1; i < m; i++) {
          const p = tsplits[i];
          const c = tsplits[i+1];
          tagsParents[c] = tagsParents[c] || {};
          tagsParents[c][p] = true;
          tagsChildren[p] = tagsChildren[p] || {};
          tagsChildren[p][c] = true;
        }
        for (let i = 0, m = tsplits.length; i < m; i++) {
          newTags.set(tsplits[i], true);
        }
      }

      //Sort the tags
      files[k].tags = Array.from(newTags.keys());
      files[k].tags.sort();
    }

    //Sort parents and children
    const metadata = metalsmith.metadata();
    metadata.tagsChildren = {};
    metadata.tagsParents = {};
    for (let k in tagsChildren) {
      metadata.tagsChildren[k] = Object.keys(tagsChildren[k]);
      metadata.tagsChildren[k].sort();
    }
    for (let k in tagsParents) {
      metadata.tagsParents[k] = Object.keys(tagsParents[k]);
      metadata.tagsParents[k].sort();
    }

    metalsmith.metadata(metadata);
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
  .use((files:any, metalsmith:any) => {
    let metadata = metalsmith.metadata();
    metadata.tagsOrdered = Object.keys(metadata.tags);
    metadata.tagsOrdered.sort();
    metadata.tagsOrdered = metadata.tagsOrdered.map((tag:string) => {
      return {
        name: tag,
        path: `tags/${tag}/index.html`,
      };
    });
    metalsmith.metadata(metadata);
  })
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
