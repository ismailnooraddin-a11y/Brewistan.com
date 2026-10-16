from pathlib import Path
import re, subprocess, json, yaml, sys
root=Path(__file__).resolve().parent.parent
count=0
for file in sorted((root/'.github/workflows').glob('*.yml')):
    doc=yaml.safe_load(file.read_text())
    assert isinstance(doc,dict) and 'jobs' in doc, file
    for job in doc['jobs'].values():
        for step in job.get('steps',[]):
            if 'run' in step:
                block=re.sub(r'\$\{\{.*?\}\}', 'EXPRESSION',str(step['run']),flags=re.S)
                result=subprocess.run(['bash','-n'],input=block,text=True,capture_output=True)
                assert result.returncode==0,(file,step.get('name'),result.stderr)
                count+=1
print('4 workflow YAML files parsed; '+str(count)+' embedded shell blocks pass bash -n.')
js=list(root.rglob('*.mjs'))+list(root.rglob('*.cjs'))
for file in js: subprocess.run(['node','--check',str(file)],check=True,capture_output=True)
print(str(len(js))+' JavaScript modules pass node --check.')
for file in root.rglob('*.json'):
    json.loads(file.read_text())
print('All JSON files parse.')
s=(root/'apps/mobile/lib/l10n/strings.dart').read_text()
keys={}
for lang in ('en','ar','ckb'):
    block=s.split("  '"+lang+"': {",1)[1].split('\n  },',1)[0]
    ks=re.findall(r'''["']([^"']+)["']\s*:''',block)
    assert len(ks)==len(set(ks)),(lang,'duplicate translation keys')
    keys[lang]=set(ks)
    print(lang+': '+str(len(ks))+' UI keys')
assert keys['en']==keys['ar']==keys['ckb'], {k:sorted(keys['en']-v) for k,v in keys.items()}
for file in (root/'apps/mobile/lib').rglob('*.dart'):
    for key in re.findall(r'''\.t\(['"]([^'"]+)['"]\)''',file.read_text()):
        if '$' not in key: assert key in keys['en'],(file,key)
print('English/Arabic/Sorani UI key parity and literal AppState.t() references pass; no native copy review claimed.')
