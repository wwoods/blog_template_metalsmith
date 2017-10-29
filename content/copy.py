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
        if src.endswith('content.rst'):
            dst = dst[:-len('content.rst')] + 'index.rst'
        with open(src, 'rt') as fs, open(dst[:-4] + '.pug', 'wt') as fd:
            fd.write("\n\nblock contents\n")
            in_el = []
            for line in fs:
                if not line.strip():
                    if in_el:
                        in_el.pop()
                elif line.strip().startswith('*'):
                    if not (in_el and in_el[-1] == 'ul'):
                        in_el.append('ul')
                        fd.write(f"  {'  '*len(in_el)}ul\n")
                    fd.write(f"  {'  '*len(in_el)}li {line}")
                else:
                    if in_el:
                        in_el.pop()
                    fd.write(f"  {'  '*len(in_el)}p {line}")
    else:
        shutil.copy2(src, dst)

base = '../../tau_docs/content'
copy_and_overwrite(base, '.')
