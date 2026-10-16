"""Dependency-light fixture tests. Not a substitute for Flutter/Gradle/Postgres integration."""
from pathlib import Path
import os
import re
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / 'apps/mobile/lib/services/local_db.dart').read_text()
CREATE = SOURCE[SOURCE.index('onCreate:'):SOURCE.index('}, onUpgrade:')]
UPGRADE = SOURCE[SOURCE.index('static Future<void> _v2'):SOURCE.index('static Future<LocalDb> open')]

def execute_literals(db, source):
    for statement in re.findall(r"await db\.execute\('([^']+)'\)", source):
        db.execute(statement)

def schema(legacy=False):
    db = sqlite3.connect(':memory:')
    execute_literals(db, CREATE)
    if legacy:
        db.execute("INSERT INTO queue VALUES ('old','stamp','qr','cafe',NULL,NULL,'2026-10-16',1)")
        db.executemany('INSERT INTO kv VALUES (?,?)', [('wallet','old-wallet'),('staff_snapshot','old-staff'),('language','ar')])
    execute_literals(db, UPGRADE)
    db.execute("DELETE FROM kv WHERE key IN (?, ?)", ('wallet','staff_snapshot'))
    db.commit()
    return db

class PlatformChecks(unittest.TestCase):
    def test_fresh_sqlite_schema(self):
        db=schema(); columns={x[1] for x in db.execute('PRAGMA table_info(queue)')}
        self.assertTrue({'staff_id','snapshot','scanner_device_id','available_at'}.issubset(columns))
        self.assertEqual(db.execute('SELECT COUNT(*) FROM sync_results').fetchone()[0],0)

    def test_legacy_queue_retained_but_not_assigned_to_new_user(self):
        db=schema(True)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM queue WHERE staff_id IS NULL').fetchone()[0],1)
        self.assertEqual(list(db.execute("SELECT * FROM queue WHERE staff_id='new-user' AND snapshot IS NOT NULL")),[])
        self.assertEqual(list(db.execute('SELECT * FROM kv')),[('language','ar')])

    def test_account_filter_and_inflight_delay(self):
        db=schema()
        for event,staff,available in [('a','user-a',0),('b','user-b',0),('c','user-a',30000)]:
            db.execute("INSERT INTO queue(event_id,type,qr,cafe_id,scanned_at,created_at,staff_id,snapshot,available_at) VALUES (?,'stamp','qr','cafe','2026-10-16',0,?,'signed',?)",(event,staff,available))
        actual=list(db.execute('SELECT event_id FROM queue WHERE staff_id = ? AND snapshot IS NOT NULL AND available_at <= ? ORDER BY scanned_at ASC, event_id ASC',('user-a',1000)))
        self.assertEqual(actual,[('a',)])

    def test_transaction_rollback_does_not_consume_voucher(self):
        db=schema()
        with self.assertRaises(sqlite3.IntegrityError):
            with db:
                db.execute("INSERT INTO used_vouchers VALUES ('r',100,'e','d',1)")
                db.execute("INSERT INTO queue(event_id,type,qr,cafe_id,scanned_at,created_at) VALUES ('e','redeem',NULL,'cafe','date',0)")
        self.assertEqual(list(db.execute('SELECT * FROM used_vouchers')),[])

    def test_offline_cap_excludes_other_devices_and_online(self):
        db=schema()
        db.executemany('INSERT INTO used_vouchers VALUES (?,?,?,?,?)', [('r1',100,'a','d1',1),('r2',110,'b','d1',0),('r3',110,'c','d2',1),('r4',50,'d',None,1)])
        query='SELECT COUNT(*) FROM used_vouchers WHERE used_at >= ? AND offline = 1 AND (scanner_device_id = ? OR scanner_device_id IS NULL)'
        self.assertEqual(db.execute(query,(0,'d1')).fetchone()[0],2)
        self.assertEqual(db.execute(query,(60,'d1')).fetchone()[0],1)

    def test_results_retain_reason_without_customer_payload(self):
        db=schema();cols={x[1] for x in db.execute('PRAGMA table_info(sync_results)')}
        self.assertIn('reason',cols);self.assertFalse({'qr','customer_id','snapshot'} & cols)
        db.execute("INSERT INTO sync_results VALUES ('e','a','redeem','rejected','offline_cap',1)")
        self.assertEqual(db.execute('SELECT reason FROM sync_results WHERE staff_id=?',('a',)).fetchone()[0],'offline_cap')

    def test_scaffold_merge_preserves_app_files_and_fixes_both_gradle_dialects(self):
        for suffix,content,expected in [('.kts','minSdk = flutter.minSdkVersion\nsigningConfig = signingConfigs["debug"]','minSdk = 23'),('', 'minSdkVersion flutter.minSdkVersion\nsigningConfig signingConfigs.debug','minSdkVersion 23')]:
            with self.subTest(dialect=suffix), tempfile.TemporaryDirectory() as tmp:
                temp=Path(tmp);src=temp/'source';dst=temp/'app'
                for platform in ('android','ios'): (src/platform).mkdir(parents=True)
                (src/'android/app').mkdir();(dst/'android/app').mkdir(parents=True)
                (src/'android/app/AndroidManifest.xml').write_text('template')
                (dst/'android/app/AndroidManifest.xml').write_text('original-permissions')
                (src/('android/app/build.gradle'+suffix)).write_text(content)
                (dst/'lib').mkdir();(dst/'lib/main.dart').write_text('my app')
                subprocess.run(['python3',str(ROOT/'scripts/merge-mobile-platforms.py'),str(src),str(dst)],check=True)
                self.assertEqual((dst/'android/app/AndroidManifest.xml').read_text(),'original-permissions')
                self.assertEqual((dst/'lib/main.dart').read_text(),'my app')
                text=(dst/('android/app/build.gradle'+suffix)).read_text();self.assertIn(expected,text);self.assertNotIn('signingConfigs["debug"]',text);self.assertNotIn('signingConfigs.debug',text)

    def test_signing_rejects_missing_keys_and_uses_environment_not_embedded_passwords(self):
        with tempfile.TemporaryDirectory() as tmp:
            app=Path(tmp);(app/'android/app').mkdir(parents=True);gradle=app/'android/app/build.gradle.kts';gradle.write_text('android {}\n')
            command=['python3',str(ROOT/'scripts/configure-android-signing.py'),str(app)]
            environment={k:v for k,v in os.environ.items() if k not in ['ANDROID_KEYSTORE_PATH','KEYSTORE_PASSWORD','KEY_ALIAS','KEY_PASSWORD']}
            self.assertNotEqual(subprocess.run(command,env=environment,capture_output=True).returncode,0)
            environment.update(ANDROID_KEYSTORE_PATH='/tmp/fixture.jks',KEYSTORE_PASSWORD='not-written',KEY_ALIAS='upload',KEY_PASSWORD='not-written')
            self.assertEqual(subprocess.run(command,env=environment,capture_output=True).returncode,0)
            text=gradle.read_text();self.assertIn('brewistanRelease',text);self.assertNotIn('not-written',text)

    def test_shell_scripts_parse(self):
        for file in (ROOT/'scripts').glob('*.sh'): subprocess.run(['bash','-n',str(file)],check=True)

    def test_deployment_requires_successful_ci_commit(self):
        source=(ROOT/'.github/workflows/deploy-supabase.yml').read_text()
        self.assertIn('workflow_run:',source);self.assertIn("conclusion == 'success'",source)
        self.assertIn('ref: ${{ github.event.workflow_run.head_sha }}',source);self.assertNotIn('workflow_dispatch:',source)
        self.assertIn('environment: production',source);self.assertIn('umask 077',source)

    def test_migration_lexical_integrity_only(self):
        # Check accidental unclosed dollar strings; does NOT parse SQL/PLpgSQL.
        for file in (ROOT/'supabase/migrations').glob('*.sql'):
            text=file.read_text();self.assertEqual(text.count('$$')%2,0,file.name)
            self.assertNotIn('\x00',text)

if __name__=='__main__': unittest.main(verbosity=2)
