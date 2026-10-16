"""Copy missing platform files only, then make narrowly scoped platform settings."""
from pathlib import Path
import re
import shutil
import sys

source, target = map(Path, sys.argv[1:3])
for platform in ("android", "ios"):
    for item in (source / platform).rglob("*"):
        relative = item.relative_to(source)
        destination = target / relative
        if item.is_file() and not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, destination)
for name in ("build.gradle", "build.gradle.kts"):
    path = target / "android/app" / name
    if path.exists():
        text = path.read_text()
        replacement = "minSdk = 23" if name.endswith(".kts") else "minSdkVersion 23"
        text = re.sub(r"minSdk(?:Version)?\s*=?\s*flutter\.minSdkVersion", replacement, text)
        # Never permit Flutter's generated release build to use a debug key.
        text = re.sub(r'^\s*signingConfig\s*(?:=\s*)?(?:signingConfigs\["debug"\]|signingConfigs\.debug)\s*$',
                      '\n            // Signing supplied only by configure-android-signing.py.', text, flags=re.M)
        path.write_text(text)
podfile = target / "ios/Podfile"
if podfile.exists():
    podfile.write_text(re.sub(r"^#?\s*platform :ios, '[0-9.]+'", "platform :ios, '13.0'", podfile.read_text(), flags=re.M))
