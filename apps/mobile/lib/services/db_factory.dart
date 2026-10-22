// Picks the SQLite engine for the platform: the native plugin on Android/iOS,
// a WebAssembly build of SQLite in the browser (the PWA).
export 'db_factory_native.dart' if (dart.library.js_interop) 'db_factory_web.dart';
