# Bundles index.html with its scripts into one self-contained file: ../out/index.html
import re
s=open('index.html').read()
for f in ['ephem.js','demcoarse.js','sites.js','engine.js']:
    tag='<script src="%s"></script>'%f
    assert tag in s
    s=s.replace(tag,'<script>\n'+open(f).read()+'\n</script>')
open('../index.html','w').write(s); print('bundle bytes',len(s))
