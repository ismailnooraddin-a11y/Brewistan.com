"""Inject Gradle release signing before compilation; passwords are read from env."""
from pathlib import Path
import os
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'apps/mobile')
required = ['ANDROID_KEYSTORE_PATH', 'KEYSTORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']
if any(not os.environ.get(k) for k in required):
    raise SystemExit('All Android signing variables are required; refusing a debug/unsigned release.')
path = next((root/'android/app'/n for n in ('build.gradle.kts','build.gradle') if (root/'android/app'/n).exists()), None)
if path is None:
    raise SystemExit('Run scripts/setup-mobile.sh first.')
text = path.read_text()
marker = '// BREWISTAN_RELEASE_SIGNING'
if marker in text:
    raise SystemExit('Signing already configured; use a clean generated platform directory.')
if 'signingConfigs["debug"]' in text or 'signingConfig signingConfigs.debug' in text:
    raise SystemExit('Debug signing remains in the release configuration.')
if path.suffix == '.kts':
    addition = '''
// BREWISTAN_RELEASE_SIGNING
android {
    signingConfigs {
        create("brewistanRelease") {
            storeFile = file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KEY_ALIAS")
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes.getByName("release").signingConfig = signingConfigs.getByName("brewistanRelease")
}
'''
else:
    addition = '''
// BREWISTAN_RELEASE_SIGNING
android {
    signingConfigs {
        brewistanRelease {
            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
            storePassword System.getenv('KEYSTORE_PASSWORD')
            keyAlias System.getenv('KEY_ALIAS')
            keyPassword System.getenv('KEY_PASSWORD')
        }
    }
    buildTypes.release.signingConfig = signingConfigs.brewistanRelease
}
'''
path.write_text(text + addition)
