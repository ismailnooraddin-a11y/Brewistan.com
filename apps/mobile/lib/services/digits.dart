String asciiDigits(String input) => input.replaceAllMapped(RegExp(r'[\u0660-\u0669\u06f0-\u06f9]'), (m) {
  final code = m[0]!.codeUnitAt(0);
  return '${code >= 0x06f0 ? code - 0x06f0 : code - 0x0660}';
});
