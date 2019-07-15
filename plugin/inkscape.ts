
import {spawn as spawnSynchronous} from 'child_process';
import * as multimatch from 'multimatch';
import {toJson, toXml} from 'xml2json';

export interface InkscapePluginConfig {
  pattern: string;
}

export function inkscapePlugin(config:InkscapePluginConfig) {
  return async function(files:any, metalsmith:any) {
    let promises = new Array<Promise<void>>();
    for (let k in files) {
      if (multimatch([k], config.pattern).length === 0) continue;
      promises.push(_doInkscapeSplit(files, k, files[k]));
      delete files[k];
    }
    await Promise.all(promises);
  };
}


/** Split the inkscape file ``k`` into several files based on the layers
 * within the file.
 *
 * Code based partially on https://github.com/berteh/svg-objects-export/blob/master/svg-objects-export.py
 *
 * */
async function _doInkscapeSplit(files:any, k:string, filesKData:any) {
  console.log(`Splitting ${k}`);

  let json:any = toJson(filesKData.contents, {object: true, reversible: true});

  //Find layers - for each, output an image with the given name.
  for (const obj of json.svg.g) {
    if (obj['inkscape:groupmode'] === 'layer') {
      const parts = k.split('/');
      const c = parts[parts.length - 1].split('.', 1)[0];
      const p = parts.slice(0, parts.length - 1).join('/') + '/' + c + '/' + obj['inkscape:label'] + '.png';

      const inkscapeResult = await _spawn('inkscape', ['--export-png', '-',
        '--export-id', obj.id, '--export-id-only', '--export-dpi', '200',
        '-'], {stdin: filesKData.contents});
      const pngFile = inkscapeResult.stdout;

      files[p] = {
        generated: true,
        contents: pngFile,
      };
      console.log(`Added ${p}`);
    }
  }
}


type _spawnResult = {stdout: Buffer, stderr: Buffer};
async function _spawn(cmd:string, args:Array<string>, options:any = {}):Promise<_spawnResult> {
  return new Promise<_spawnResult>((resolve, reject) => {
    const stdout = new Array<Buffer>();
    const stderr = new Array<Buffer>();
    let stdin = options.stdin;
    delete options.stdin;
    const p = spawnSynchronous(cmd, args, options);
    p.stdout.on('data', (data:Buffer) => stdout.push(data));
    p.stderr.on('data', (data:Buffer) => stderr.push(data));
    if (stdin !== undefined) {
      p.stdin.write(stdin);
      p.stdin.end();
    }
    p.on('close', (code) => {
      const sStdout = Buffer.concat(stdout);
      const sStderr = Buffer.concat(stderr);
      if (code === 0) {
        resolve({stdout: sStdout, stderr: sStderr});
      }
      else {
        reject(new Error(`${cmd} with args ${args} failed with ${code}: ${sStderr}`));
      }
    });
  });
}


