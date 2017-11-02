import * as multimatch from 'multimatch';

let naturalSort = require('node-natural-sort');
naturalSort = naturalSort();

const ROOT_TAG = 'index'; // get it?

export interface TagPluginConfig {
  dateFields: {
    [name:string]: {tag?:true, tagPrefix?:string}
  },
  folders: Array<[Array<string>, {dateField?:string, tags?:Array<string>}]>,
  tagHierarchy: Array<string>,
  tagSettings: {[tag:string]: {sort?:Array<string>}},
}

export class TagData {
  children = new Array<string>();
  parents = new Array<string>();
  posts = new Array<any>();
  path:string;
  relatives = new Set<string>();  // includes self, ROOT_TAG
  rootPath:string;
  sort?:Array<string>;

  constructor(public name:string) {
    this.rootPath = `<unknown>/${name}`;
  }
}

export function tagPlugin(config:TagPluginConfig) {
  return async function(files:any, metalsmith:any) {
    const metadata = metalsmith.metadata();
    const noAutoIndex = new Set<string>();  // do not auto index these files
    const tagParents = new Map<string, Set<string>>();
    const tagParentsAdd = (p:string, c:string) => {
      let m = tagParents.get(c);
      if (m === undefined) {
        m = new Set<string>();
        tagParents.set(c, m);
      }
      m.add(p);
    };

    //FIRST assign dates and tags based on folder names {{{1
    for (let k in files) {
      const file = files[k];

      //Regularize tags
      if (file.tags === undefined) {
        file.tags = [];
      }
      else if (typeof file.tags === 'string') {
        file.tags = file.tags.split(/\s+/g);
      }
      //lowercase, strip surrounding whitespace
      file.tags = file.tags.map((v:string) => v.toLowerCase().replace(/^\s+|\s+$/g, ''));
      file.tags = new Set<string>(file.tags);

      //Find first matching folder
      for (let folder of config.folders) {
        if (multimatch([k], folder[0]).length === 0) continue;

        const fc = folder[1];
        //Found a match.  Do we even want to add metadata to this file?
        //TODO: Allow adding metadata to e.g. PDF automatically via config.
        if (k.match(/^.*\.pug$/) === null) {
          noAutoIndex.add(k);
          break;
        }

        //Add default title
        if (file.title === undefined) {
          if (k === 'index.pug') {
            file.title = metadata.sitename;
          }
          else {
            const m = k.match(/\/index\.pug$/);
            if (m !== null) {
              file.title = k.substring(0, m.index);
            }
            else {
              file.title = k.replace(/\.pug$/, '');
            }
          }
        }

        if (fc.tags !== undefined) {
          for (const t of fc.tags) file.tags.add(t);
        }
        if (fc.dateField !== undefined) {
          const m = k.match(/^.*(^|\/)(\d\d\d\d-\d\d)\/(\d\d)-.*$/);
          if (m !== null) {
            file[fc.dateField] = new Date(`${m[2]}-${m[3]}`);
          }
        }

        //Stop on first match.
        break;
      }
    }

    //SECOND cast date fields to Date type, assign tags based on Date. {{{1
    for (let k in files) {
      if (noAutoIndex.has(k)) continue;

      const file = files[k];
      for (let df in config.dateFields) {
        if (file[df] !== undefined && !(file[df] instanceof Date)) {
          file[df] = new Date(file[df]);
        }
        if (file[df] === undefined) continue;

        if (config.dateFields[df].tag) {
          const d = file[df];
          let p = config.dateFields[df].tagPrefix;
          let tagLast = `${d.getUTCFullYear()}`;
          let hierarchyEntry = [];
          if (p !== '' && p !== undefined) {
            hierarchyEntry.push(p);
            tagLast = `${p}-${tagLast}`;
          }
          hierarchyEntry.push(tagLast);

          tagLast = `${tagLast}-${d.getUTCMonth()+1}`;
          hierarchyEntry.push(tagLast);

          tagLast = `${tagLast}-${d.getUTCDate()}`;
          hierarchyEntry.push(tagLast);
          file.tags.add(tagLast);

          config.tagHierarchy.push(hierarchyEntry.join('/'));
        }
      }

      //No tags? Implicit root
      if (file.tags.length === 0) {
        file.tags.add(ROOT_TAG);
      }
    }

    //THIRD iterate tagHierarchy, collect all possible tags
    for (const path of config.tagHierarchy) {
      const parts = path.split(/\s*\/\s*/g).map((v) => v.toLowerCase().replace(/^\s+|\s+$/g, ''));
      //Part 0 becomes parent of root!
      tagParentsAdd(ROOT_TAG, parts[0]);
      for (let i = 0, m = parts.length; i < m - 1; i++) {
        tagParentsAdd(parts[i], parts[i+1]);
      }
    }

    //Convert each file's tags to a sorted array; ensure all tags have at least
    //one parent.
    for (const k in files) {
      const t = files[k].tags = Array.from(files[k].tags);
      t.sort(naturalSort);

      for (const t of files[k].tags) {
        if (tagParents.get(t) !== undefined) continue;

        //No parents for this tag.  Assume root parent.
        tagParentsAdd(ROOT_TAG, t);
      }
    }

    //Now all tags have a parent.
    if (tagParents.has(ROOT_TAG)) tagParents.delete(ROOT_TAG);
    const tagData = new Map<string, TagData>();
    metadata.tagArrayOfAll = Array.from(tagParents.keys());
    metadata.tagArrayOfAll.push(ROOT_TAG);
    metadata.tagArrayOfAll.sort(naturalSort);
    const tagGet = metadata.tagGet = (tag:string) => {
      const data = tagData.get(tag);
      if (data === undefined) {
        return new TagData(tag);
      }
      return data;
    };

    for (let k of metadata.tagArrayOfAll) {
      const tag = new TagData(k);
      tagData.set(k, tag);

      tag.path = `/tags/${k}`;

      const tp = tagParents.get(k);
      if (tp === undefined) {
        if (k !== ROOT_TAG) throw new Error("Bad assumption");
        tag.parents = [];
      }
      else {
        tag.parents = Array.from(tp);
      }
      tag.parents.sort(naturalSort);

      //Assign a sort pattern for posts?
      const ts = config.tagSettings[k];
      if (ts !== undefined) {
        if (ts.sort !== undefined) {
          tag.sort = ts.sort;
        }
      }
    }

    //Now that sorts have been set, find all relatives, and assume same sort
    //as first relative with specified sort.
    //Also iterate parents and add children.
    for (const [k, tag] of tagData.entries()) {
      for (const p of tag.parents) {
        tagGet(p).children.push(k);
      }
      //Resolve relatives to root (including shortest path for "rootName")
      const stack = new Array<[string, string]>();
      const seen = new Set<string>();
      stack.push([k, k]);
      seen.add(k);
      let done:string|undefined;
      //Root path for dates is the date.
      if (k.match(/(^|-)\d\d\d\d(-\d\d?(-\d\d?)?)?$/) !== null) done = k;
      //Breadth-first search...
      while (true) {
        const t = stack.shift();
        if (t === undefined) break;
        const [top, path] = t;
        if (top === ROOT_TAG) {
          //Root level.  Have a path.  Only happens once due to "seen"
          if (done === undefined) {
            done = path;
            //Omit '${ROOT_TAG}/' leader
            if (k !== top) done = done.substring(6);
          }
          //Root has no parents; continue, not break, because we still want
          //to gather all relatives.
          continue;
        }
        if (tag.sort === undefined) {
          const s = tagGet(top).sort;
          if (s !== undefined) {
            tag.sort = s;
          }
        }
        for (const p of tagParents.get(top) as Set<string>) {
          if (seen.has(p)) continue;
          seen.add(p);
          stack.push([p, `${p}/${path}`]);
        }
      }

      if (done === undefined) {
        done = k;
      }
      tag.relatives = seen;
      tag.rootPath = done;
    }

    //Add posts to each tag
    for (let k in files) {
      const file = files[k];
      const seen = new Set<string>();
      for (const t of file.tags) {
        for (const r of tagGet(t).relatives) {
          if (seen.has(r)) continue;
          seen.add(r);
          tagGet(r).posts.push(file);
        }
      }
    }

    //Sort each tag's posts and children
    for (let [k, tag] of tagData.entries()) {
      tag.children.sort(naturalSort);

      const sort = tag.sort || ['date', 'title'];
      const p = (a:any) => {
        const vals = new Array<any>();
        for (const s of sort) {
          let v:any = a[s];
          if (v instanceof Date) {
            v = -(+v);
          }
          vals.push(v);
        }
        return vals;
      };
      tag.posts.sort((a, b) => {
        return naturalSort(p(a), p(b));
      });
    }

    metalsmith.metadata(metadata);

    //Root's page is index
    if (files['index.pug'].layout === 'tag.pug') {
      //If index treated as tag, copy it to root tag page.
      files['index.pug'].tag = ROOT_TAG;
      files['index.pug'].tags = [];
      files[`tags/${ROOT_TAG}.pug`] = {
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
          title: t,
          tag: t,
          tags: [],
          path: path,
        };
      }
    }
  };
}

