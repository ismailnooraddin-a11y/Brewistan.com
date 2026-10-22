import 'dart:convert';
import 'package:path/path.dart' as p;
import 'payload_cipher.dart';
import 'secure_session_storage.dart';
import 'b64.dart';
import 'db_factory.dart';
import 'package:sqflite/sqflite.dart';

/// Queue payloads are account-bound. Final results are retained without customer QR data.
class LocalDb {
  LocalDb._(this._db, this._cipher);
  final PayloadCipher _cipher;
  final Database _db;
  static const maxQueue = 5000;
  static const warnQueue = 4000;

  static Future<void> _v2(Database db) async {
    await db.execute('ALTER TABLE queue ADD COLUMN staff_id TEXT');
    await db.execute('ALTER TABLE queue ADD COLUMN scanner_device_id TEXT');
    await db.execute('ALTER TABLE queue ADD COLUMN snapshot TEXT');
    await db.execute('ALTER TABLE queue ADD COLUMN available_at INTEGER NOT NULL DEFAULT 0');
    await db.execute('ALTER TABLE recent_scans ADD COLUMN event_id TEXT');
    await db.execute('ALTER TABLE used_vouchers ADD COLUMN event_id TEXT');
    await db.execute('ALTER TABLE used_vouchers ADD COLUMN scanner_device_id TEXT');
    await db.execute('ALTER TABLE used_vouchers ADD COLUMN offline INTEGER NOT NULL DEFAULT 1');
    await db.execute('CREATE INDEX queue_account_idx ON queue(staff_id, available_at, scanned_at)');
    await db.execute('CREATE TABLE sync_results (event_id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, reason TEXT, completed_at INTEGER NOT NULL)');
    // Legacy wallet/snapshot keys have no trustworthy account owner. Do not display
    // them to the next login. Legacy queue rows remain quarantined (staff_id IS NULL).
    await db.delete('kv', where: 'key IN (?, ?)', whereArgs: ['wallet', 'staff_snapshot']);
  }

  static Future<LocalDb> open() async {
    final factory = platformDatabaseFactory();
    final path = p.join(await factory.getDatabasesPath(), 'brewistan.db');
    final db = await factory.openDatabase(path, options: OpenDatabaseOptions(version: 2, onCreate: (db, version) async {
      await db.execute('CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      await db.execute('CREATE TABLE queue (event_id TEXT PRIMARY KEY, type TEXT NOT NULL, qr TEXT NOT NULL, cafe_id TEXT NOT NULL, branch_id TEXT, reward_id TEXT, scanned_at TEXT NOT NULL, created_at INTEGER NOT NULL)');
      await db.execute('CREATE TABLE recent_scans (user_id TEXT NOT NULL, cafe_id TEXT NOT NULL, at INTEGER NOT NULL)');
      await db.execute('CREATE INDEX recent_scans_idx ON recent_scans (user_id, cafe_id, at)');
      await db.execute('CREATE TABLE used_vouchers (reward_id TEXT PRIMARY KEY, used_at INTEGER NOT NULL)');
      await _v2(db);
    }, onUpgrade: (db, oldVersion, newVersion) async {
      if (oldVersion < 2) await _v2(db);
    }));
    await db.rawQuery('PRAGMA secure_delete = ON');
    var storedKey = await secureStorage.read(key: 'bw_payload_key_v1');
    if (storedKey == null) {
      final encrypted = Sqflite.firstIntValue(await db.rawQuery("SELECT (SELECT COUNT(*) FROM queue WHERE qr LIKE 'BWENC1.%' OR snapshot LIKE 'BWENC1.%') + (SELECT COUNT(*) FROM kv WHERE value LIKE 'BWENC1.%')")) ?? 0;
      if (encrypted > 0) { await db.close(); throw StateError('local_key_unavailable'); }
      final key = await PayloadCipher.algorithm.newSecretKey();
      storedKey = b64urlEncode(await key.extractBytes());
      await secureStorage.write(key: 'bw_payload_key_v1', value: storedKey);
    }
    final local = LocalDb._(db, PayloadCipher(b64urlDecode(storedKey)));
    await local._encryptLegacyPayloads();
    return local;
  }

  static bool _sensitiveKey(String key) => key.startsWith('wallet:') || key.startsWith('staff_snapshot:') || key.startsWith('push_seen:');
  static String _queueContext(Map<String, Object?> row, String column) => jsonEncode(['queue', row['event_id'], row['staff_id'], column]);

  Future<void> _encryptLegacyPayloads() async {
    var changed = false;
    await _db.transaction((tx) async {
      final rows = await tx.query('queue');
      for (final row in rows) {
        final updates = <String, Object?>{};
        for (final column in ['qr', 'snapshot']) {
          final value = row[column] as String?;
          if (value != null && !PayloadCipher.isEncrypted(value)) {
            updates[column] = await _cipher.seal(value, _queueContext(row, column));
          }
        }
        if (updates.isNotEmpty) { await tx.update('queue', updates, where: 'event_id = ?', whereArgs: [row['event_id']]); changed = true; }
      }
      for (final row in await tx.query('kv')) {
        final key = row['key'] as String; final value = row['value'] as String;
        if (_sensitiveKey(key) && !PayloadCipher.isEncrypted(value)) {
          await tx.update('kv', {'value': await _cipher.seal(value, 'kv:$key')}, where: 'key = ?', whereArgs: [key]); changed = true;
        }
      }
    });
    if (changed) {
      // Best-effort page cleanup. This is not a claim of forensic erasure of flash storage/backups.
      await _db.rawQuery('PRAGMA wal_checkpoint(TRUNCATE)');
      await _db.execute('VACUUM');
    }
  }

  Future<String?> kvGet(String key) async {
    final rows = await _db.query('kv', where: 'key = ?', whereArgs: [key], limit: 1);
    if (rows.isEmpty) return null;
    final value = rows.first['value'] as String;
    return _sensitiveKey(key) ? await _cipher.open(value, 'kv:$key') : value;
  }
  Future<void> kvSet(String key, String? value) async {
    if (value == null) { await _db.delete('kv', where: 'key = ?', whereArgs: [key]); }
    else { final stored = _sensitiveKey(key) ? await _cipher.seal(value, 'kv:$key') : value; await _db.insert('kv', {'key': key, 'value': stored}, conflictAlgorithm: ConflictAlgorithm.replace); }
  }
  Future<int> pendingCount([String? staffId]) async => Sqflite.firstIntValue(await _db.rawQuery(
    staffId == null ? 'SELECT COUNT(*) FROM queue' : 'SELECT COUNT(*) FROM queue WHERE staff_id = ?',
    staffId == null ? null : [staffId])) ?? 0;
  Future<int> legacyPendingCount() async => Sqflite.firstIntValue(await _db.rawQuery('SELECT COUNT(*) FROM queue WHERE staff_id IS NULL')) ?? 0;

  Future<void> enqueue({required String eventId, required String type, required String qr,
    required String cafeId, required String branchId, String? rewardId,
    required DateTime scannedAt, required String staffId, required String scannerDeviceId,
    required String snapshot, required String customerId, required bool offline,
    required int cooldownMs, required int dayStartMs}) async {
    final at = scannedAt.millisecondsSinceEpoch;
    await _db.transaction((tx) async {
      if ((await tx.query('queue', where: 'event_id = ?', whereArgs: [eventId])).isNotEmpty) return;
      if ((Sqflite.firstIntValue(await tx.rawQuery('SELECT COUNT(*) FROM queue')) ?? 0) >= maxQueue) throw StateError('queue_full');
      if (type == 'stamp') {
        final last = Sqflite.firstIntValue(await tx.rawQuery('SELECT MAX(at) FROM recent_scans WHERE user_id = ? AND cafe_id = ?', [customerId, cafeId]));
        if (last != null && at - last < cooldownMs) throw StateError('cooldown');
      } else {
        if (rewardId == null) throw StateError('voucher_required');
        if ((await tx.query('used_vouchers', where: 'reward_id = ?', whereArgs: [rewardId])).isNotEmpty) throw StateError('reward_redeemed');
        final count = Sqflite.firstIntValue(await tx.rawQuery('SELECT COUNT(*) FROM used_vouchers WHERE used_at >= ? AND offline = 1 AND (scanner_device_id = ? OR scanner_device_id IS NULL)', [dayStartMs, scannerDeviceId])) ?? 0;
        if (offline && count >= 2) throw StateError('offline_cap');
      }
      final localNow = DateTime.now().millisecondsSinceEpoch;
      final context = <String, Object?>{'event_id': eventId, 'staff_id': staffId};
      await tx.insert('queue', {'event_id': eventId, 'type': type, 'qr': await _cipher.seal(qr, _queueContext(context, 'qr')), 'cafe_id': cafeId,
        'branch_id': branchId, 'reward_id': rewardId, 'scanned_at': scannedAt.toUtc().toIso8601String(),
        'created_at': localNow, 'staff_id': staffId, 'scanner_device_id': scannerDeviceId,
        'snapshot': await _cipher.seal(snapshot, _queueContext(context, 'snapshot')), 'available_at': offline ? 0 : localNow + 30000});
      if (type == 'stamp') {
        await tx.insert('recent_scans', {'user_id': customerId, 'cafe_id': cafeId, 'at': at, 'event_id': eventId});
      } else {
        await tx.insert('used_vouchers', {'reward_id': rewardId, 'used_at': at, 'event_id': eventId,
          'scanner_device_id': scannerDeviceId, 'offline': offline ? 1 : 0});
      }
    });
  }

  Future<void> releaseForSync(String id, String staffId) async {
    await _db.transaction((tx) async {
      await tx.update('queue', {'available_at': 0}, where: 'event_id = ? AND staff_id = ?', whereArgs: [id, staffId]);
      await tx.update('used_vouchers', {'offline': 1}, where: 'event_id = ?', whereArgs: [id]);
    });
  }
  Future<List<Map<String, Object?>>> pendingEvents(int limit, String staffId) async {
    final rows = await _db.query('queue', where: 'staff_id = ? AND snapshot IS NOT NULL AND available_at <= ?',
      whereArgs: [staffId, DateTime.now().millisecondsSinceEpoch], orderBy: 'scanned_at ASC, event_id ASC', limit: limit);
    final result = <Map<String, Object?>>[];
    for (final row in rows) {
      final decoded = Map<String, Object?>.from(row);
      for (final column in ['qr', 'snapshot']) {
        decoded[column] = await _cipher.open(row[column] as String, _queueContext(row, column));
      }
      result.add(decoded);
    }
    return result;
  }

  Future<void> completeEvents(List<Map<String, dynamic>> results, String staffId) async {
    await _db.transaction((tx) async {
      for (final result in results) {
        if (result['final'] != true || result['eventId'] is! String) continue;
        final id = result['eventId'] as String;
        final rows = await tx.query('queue', where: 'event_id = ? AND staff_id = ?', whereArgs: [id, staffId]);
        if (rows.isEmpty) continue;
        final status = result['status'];
        if (status is! String || !['accepted','duplicate','rejected','voided','quarantined'].contains(status)) continue;
        await tx.insert('sync_results', {'event_id': id, 'staff_id': staffId, 'type': rows.first['type'],
          'status': status, 'reason': result['reason'] as String?, 'completed_at': DateTime.now().millisecondsSinceEpoch},
          conflictAlgorithm: ConflictAlgorithm.replace);
        if (!['accepted', 'duplicate'].contains(status)) {
          await tx.delete('recent_scans', where: 'event_id = ?', whereArgs: [id]);
          await tx.delete('used_vouchers', where: 'event_id = ?', whereArgs: [id]);
        }
        await tx.delete('queue', where: 'event_id = ? AND staff_id = ?', whereArgs: [id, staffId]);
      }
    });
  }
  Future<List<Map<String, Object?>>> recentResults(String staffId) =>
    _db.query('sync_results', where: 'staff_id = ?', whereArgs: [staffId], orderBy: 'completed_at DESC', limit: 100);
  Future<bool> isVoucherUsed(String rewardId) async => (await _db.query('used_vouchers', where: 'reward_id = ?', whereArgs: [rewardId], limit: 1)).isNotEmpty;
  /// Deduplicate in-app push handling transactionally across message/open callbacks.
  Future<bool> acceptPushDelivery(String userId, String deliveryId) async {
    if (deliveryId.length > 100 || deliveryId.isEmpty) return false;
    final key = 'push_seen:$userId'; final now = DateTime.now().millisecondsSinceEpoch;
    return _db.transaction((tx) async {
      final rows = await tx.query('kv', where: 'key = ?', whereArgs: [key], limit: 1);
      final items = <Map<String, dynamic>>[];
      if (rows.isNotEmpty) {
        final raw = await _cipher.open(rows.first['value'] as String, 'kv:$key');
        items.addAll((jsonDecode(raw) as List).map((x) => Map<String,dynamic>.from(x as Map)));
      }
      items.removeWhere((x) => (x['at'] as int) < now - 7*86400000);
      if (items.any((x) => x['id'] == deliveryId)) return false;
      items.add({'id':deliveryId,'at':now});
      if (items.length > 200) items.removeRange(0,items.length-200);
      await tx.insert('kv', {'key':key,'value':await _cipher.seal(jsonEncode(items),'kv:$key')}, conflictAlgorithm:ConflictAlgorithm.replace);
      return true;
    });
  }

  Future<void> purge() async {
    final cutoff = DateTime.now().subtract(const Duration(days: 30)).millisecondsSinceEpoch;
    await _db.delete('recent_scans', where: 'at < ? AND (event_id IS NULL OR event_id NOT IN (SELECT event_id FROM queue))', whereArgs: [cutoff]);
    await _db.delete('used_vouchers', where: 'used_at < ? AND (event_id IS NULL OR event_id NOT IN (SELECT event_id FROM queue))', whereArgs: [cutoff]);
    await _db.delete('sync_results', where: 'completed_at < ?', whereArgs: [cutoff]);
  }
}
