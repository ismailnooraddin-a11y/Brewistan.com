import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart';

/// SQLite compiled to WebAssembly. The build step `dart run sqflite_common_ffi_web:setup`
/// copies sqlite3.wasm and sqflite_sw.js into web/ (see .github/workflows/web-app.yml).
DatabaseFactory platformDatabaseFactory() => databaseFactoryFfiWeb;
