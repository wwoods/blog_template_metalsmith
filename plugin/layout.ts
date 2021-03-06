import * as multimatch from 'multimatch';
import * as path from 'path';
import * as pug from 'pug';

export function layoutPlugin(opts:{pattern:Array<string>}) {
  return async (files:any, metalsmith:any) => {
    const metadata = metalsmith.metadata();
    let promises = new Array<Promise<void>>();
    for (let k in files) {
      if (multimatch([k], opts.pattern).length === 0) {
        continue;
      }

      //Change to .html
      let data = files[k];
      delete files[k];
      let fileInfo = path.parse(k);
      let newPath = path.join(fileInfo.dir, fileInfo.name + '.html');
      files[newPath] = data;

      if (data.layout === null) {
        //No layout
        continue;
      }

      promises.push(_doLayout(k, data, metadata, metalsmith.source()));
    }
    await Promise.all(promises);
  };
}


async function _doLayout(fname:string, v:{contents:Buffer}, metadata:any,
    sourceDir:string) {
  let params = Object.assign({layout: 'default.pug'}, metadata, v);

  let contentsStr = v.contents.toString();
  if (contentsStr.search(/^extends /m) === -1) {
    contentsStr = `extends ${path.resolve('/layouts', params.layout)}\n\n${contentsStr}`;
  }
  const renderer = pug.compile(contentsStr, {
    basedir: path.dirname(sourceDir),
    cache: true,
    compileDebug: false,
    filename: path.relative(path.dirname(sourceDir), path.resolve(sourceDir, fname)),
    filters: {
      escape: (contents:string) => contents.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    }
  });
  try {
    v.contents = new Buffer(renderer(params));
  }
  catch (e) {
    console.error(e, `During ${fname}`);
  }
}

