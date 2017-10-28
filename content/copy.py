import os
import shutil

def copy_and_overwrite(src, dst):
    if os.path.isdir(src):
        try:
            os.makedirs(dst)
        except:
            pass
        for f in os.listdir(src):
            s = os.path.join(src, f)
            d = os.path.join(dst, f)

            copy_and_overwrite(s, d)
    elif src.endswith('.rst'):
        with open(src, 'rt') as fs, open(dst[:-4] + '.pug', 'wt') as fd:
            fd.write("\n\nblock contents\n  p\n")
            for line in fs:
                fd.write(f"    | {line}")
    else:
        shutil.copy2(src, dst)

base = '../../tau_docs/content'
copy_and_overwrite(base, '.')
