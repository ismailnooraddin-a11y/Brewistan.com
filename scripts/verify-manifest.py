#!/usr/bin/env python3
"""Verify delivered source integrity. This does not certify correctness or a digital signature."""
from pathlib import Path
import hashlib,sys
root=Path(__file__).resolve().parent.parent
errors=[]
for line in (root/'MANIFEST.sha256').read_text().splitlines():
    digest,name=line.split('  ',1)
    target=(root/name).resolve()
    if root not in target.parents or not target.is_file():errors.append(name+': missing/unsafe');continue
    if hashlib.sha256(target.read_bytes()).hexdigest()!=digest:errors.append(name+': changed')
if errors:
    print('\n'.join(errors));sys.exit(1)
print('All listed file hashes match.')
