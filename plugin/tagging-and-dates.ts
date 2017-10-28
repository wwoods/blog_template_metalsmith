
export function tagPlugin() {
  return async function(files:any, metalsmith:any) {
    //Assume tags specified as "a/b/c" denotes that c is a child of b, and
    //b is a child of a.  The document will be tagged as a, b, and c.
    //For tags without children or without parents, tagsChildren and tagsParent
    //will be undefined.
    const tagsChildren:any = {};
    const tagsParents:any = {};
    const tagsAny:any = {};

    //Adds date information.  Anything with a date must have a title and tags.
    for (let k in files) {
      const m = k.match(/^.*(^|\/)(\d\d\d\d-\d\d)\/(\d\d)-.*$/);
      if (m === null) continue;

      const date = files[k].date = new Date(`${m[2]}-${m[3]}`);
      if (k.match(/^.*\.pug$/) === null) continue;

      if (files[k].title === undefined) {
        files[k].title = k;
      }
      if (files[k].tags === undefined) {
        files[k].tags = [];
      }
      else if (typeof files[k].tags === 'string') {
        files[k].tags = files[k].tags.split(',');
      }

      //Add _all and date tag, normalize tags
      let oldTags = files[k].tags;
      oldTags.push(
          `${date.getUTCFullYear()}/`
          + `${date.getUTCFullYear()}-${date.getUTCMonth()+1}/`
          + `${date.getUTCFullYear()}-${date.getUTCMonth()+1}-${date.getUTCDate()}`);
      oldTags = oldTags
          .map((v:string) => v.toLowerCase().replace(/^\s+|\s+$/g, ''))
          ;

      //Sort out tag inheritance.  a/b/c becomes three tags (a, b, c), and
      //declares c as a child of b, and b as a child of a.
      const newTags = new Map<string, true>();
      newTags.set('_all', true);
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
          tagsAny[tsplits[i]] = true;
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

    //Find the quickest path for each tag to the root (a tag with no parents).
    metadata.tagsRootPath = {};
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
        if (metadata.tagsParents[top] === undefined) {
          //Root level.  Have a path.
          done = path;
          break;
        }
        for (const p of metadata.tagsParents[k]) {
          if (seen.has(p)) continue;
          seen.add(p);
          stack.push([p, `${p}/${path}`]);
        }
      }

      if (done === undefined) {
        done = k;
      }
      metadata.tagsRootPath[k] = done;
    }

    metalsmith.metadata(metadata);
  };
}

