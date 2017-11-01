import * as multimatch from 'multimatch';

let naturalSort = require('node-natural-sort');
naturalSort = naturalSort();

export class TagData {
  children = new Array<string>();
  parents = new Array<string>();
  posts = new Array<any>();
  rootPath:string;

  constructor(public name:string) {
    this.rootPath = `<unknown>/${name}`;
  }
}

export function tagPlugin(
    {dates, tagDates, folderDates}:{
      dates:Array<string>,
      tagDates:{[name:string]: string},
      folderDates:Array<[Array<string>, string]>}) {
  return async function(files:any, metalsmith:any) {
    //Assume tags specified as "a/b/c" denotes that c is a child of b, and
    //b is a child of a.  The document will be tagged as a, b, and c.
    //For tags without children or without parents, tagsChildren and tagsParent
    //will be undefined.
    const tagsChildren:any = {};
    const tagsParents:any = {};
    const tagsPosts:any = {};
    const tagsAny:any = {};

    const metadata = metalsmith.metadata();

    //Adds date information.  Anything with a date must have a title and tags.
    for (let k in files) {
      //Assign a date from folder path
      for (let possDate of folderDates) {
        if (multimatch([k], possDate[0]).length === 0) {
          continue;
        }

        const m = k.match(/^.*(^|\/)(\d\d\d\d-\d\d)\/(\d\d)-.*$/);
        if (m !== null) {
          files[k][possDate[1]] = new Date(`${m[2]}-${m[3]}`);
        }
        break;
      }
      if (k.match(/^.*\.pug$/) === null) continue;

      if (files[k].title === undefined) {
        files[k].title = (k === 'index.pug' ? metadata.sitename : k);
      }
      if (files[k].tags === undefined) {
        files[k].tags = [];
      }
      else if (typeof files[k].tags === 'string') {
        files[k].tags = files[k].tags.split(' ');
      }

      //Add _root and date tag, normalize tags
      let oldTags = files[k].tags;
      for (let dateName in tagDates) {
        const date = files[k][dateName];
        if (date !== undefined) {
          let prefix:string = '', fprefix:string = '';
          const p = tagDates[dateName];
          if (p !== '') {
            fprefix = `${p}/`;
            prefix = `${p}-`;
          }
          const ndate = new Date(date);
          files[k][dateName] = ndate;
          oldTags.push(
              `${fprefix}${prefix}${ndate.getUTCFullYear()}/`
              + `${prefix}${ndate.getUTCFullYear()}-${ndate.getUTCMonth()+1}/`
              + `${prefix}${ndate.getUTCFullYear()}-${ndate.getUTCMonth()+1}-${ndate.getUTCDate()}`);
        }
      }
      oldTags = oldTags
          .map((v:string) => v.toLowerCase().replace(/^\s+|\s+$/g, ''))
          ;

      //Sort out tag inheritance.  a/b/c becomes three tags (a, b, c), and
      //declares c as a child of b, and b as a child of a.
      const newTags = new Map<string, true>();
      newTags.set('_root', true);
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

      for (let t of newTags.keys()) {
        tagsAny[t] = true;
        tagsPosts[t] = tagsPosts[t] || {};
        tagsPosts[t][k] = files[k];
      }

      //Sort the tags
      files[k].tags = Array.from(newTags.keys());
      files[k].tags.sort();
    }

    //Sort parents and children
    const tagData = new Map<string, TagData>();
    metadata.tagArrayOfAll = Object.keys(tagsAny);
    metadata.tagArrayOfAll.sort(naturalSort);
    metadata.tagGet = (tag:string) => {
      const data = tagData.get(tag);
      if (data === undefined) {
        return new TagData(tag);
      }
      return data;
    };

    //Any tag without any explicit parent is implicitly parented by _root
    if (tagsChildren['_root'] === undefined) {
      tagsChildren['_root'] = {};
    }
    for (let k in tagsAny) {
      if (tagsParents[k] === undefined && k !== '_root') {
        tagsChildren['_root'][k] = true;
      }
    }

    for (let k in tagsAny) {
      const tag = new TagData(k);
      tagData.set(k, tag);

      if (tagsChildren[k] !== undefined) {
        tag.children = Object.keys(tagsChildren[k]);
        tag.children.sort(naturalSort);
      }
      if (tagsParents[k] !== undefined) {
        tag.parents = Object.keys(tagsParents[k]);
        tag.parents.sort(naturalSort);
      }
      else if (k !== '_root') {
        tag.parents.push('_root');
      }
      if (tagsPosts[k] !== undefined) {
        for (var fpath in tagsPosts[k]) {
          tag.posts.push(tagsPosts[k][fpath]);
        }
        tag.posts.sort((a, b) => {
          return naturalSort([-(+a.date), a.title], [-(+b.date), b.title]);
        });
      }
    }

    //Find the quickest path for each tag to the root (a tag with no parents).
    for (let k in tagsAny) {
      const stack = new Array<[string, string]>();
      const seen = new Set<string>();
      stack.push([k, k]);
      seen.add(k);
      let done:string|undefined;
      //Root path for dates is the date.
      if (k.match(/\d\d\d\d(-\d\d?(-\d\d?)?)?/) !== null) done = k;
      //Breadth-first search...
      while (done === undefined) {
        const t = stack.shift();
        if (t === undefined) break;
        const [top, path] = t;
        if (top === '_root' || tagsParents[top] === undefined) {
          //Root level.  Have a path.
          done = path;
          break;
        }
        for (const p in tagsParents[top]) {
          if (seen.has(p)) continue;
          seen.add(p);
          stack.push([p, `${p}/${path}`]);
        }
      }

      if (done === undefined) {
        done = k;
      }
      metadata.tagGet(k).rootPath = done;
    }

    metalsmith.metadata(metadata);

    //Root's page is index
    if (files['index.pug'].layout === 'tag.pug') {
      //If index treated as tag, copy it to root tag page.
      files['index.pug'].tag = '_root';
      files['index.pug'].tags = [];
      files['tags/_root.pug'] = {
        layout: null,
        contents: new Buffer(`
            <meta http-equiv="refresh" content="0; url=/">
            <link rel="canonical" href="/" />
        `),
      };
    }

    //Make homepages for each tag (that doesn't already have a page)
    for (const t of metadata.tagArrayOfAll) {
      const path = `tags/${t}.pug`;
      if (files[path] !== undefined) {
        //Custom page.
        files[path].tag = t;
      }
      else {
        files[path] = {
          layout: 'tag.pug',
          contents: '',
          tag: t,
          tags: [],
          path: path,
        };
      }
    }
  };
}

