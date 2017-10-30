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

      promises.push(_doLayout(k, data, metadata));
    }
    await Promise.all(promises);
  };
}


async function _doLayout(fname:string, v:{contents:Buffer}, metadata:any) {
  let params = Object.assign({layout: 'default.pug'}, metadata, v);

  let contentsStr = v.contents.toString();
  //if (contentsStr.search(/^block /m) === -1) {
  //  contentsStr = `block contents\n${contentsStr.replace(/^/gm, '  ')}`;
  //}
  if (contentsStr.search(/^extends /m) === -1) {
    contentsStr = `extends ${path.resolve('/layouts', params.layout)}\n\n${contentsStr}`;
  }
  const renderer = pug.compile(contentsStr, {
      basedir: path.resolve(__dirname, '../..'),
      filename: fname,
  });
  try {
    v.contents = new Buffer(renderer(params));
  }
  catch (e) {
    console.error(e, `During ${fname}`);
  }
}

