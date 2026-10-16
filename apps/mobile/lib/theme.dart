import 'package:flutter/material.dart';

class BrewColors {
  static const ink = Color(0xFF151311);
  static const inkSoft = Color(0xFF2A2622);
  static const cream = Color(0xFFF7F3EC);
  static const gold = Color(0xFFC8A96A);
  static const goldDeep = Color(0xFF8A6B3D);
  static const muted = Color(0xFF9A9086);
  static const good = Color(0xFF4FA36F);
  static const bad = Color(0xFFD0564C);
}

Color? parseHex(String? hex) {
  if (hex == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) return null;
  return Color(int.parse('FF${hex.substring(1)}', radix: 16));
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: BrewColors.gold,
      brightness: Brightness.dark,
      surface: BrewColors.ink,
      primary: BrewColors.gold,
    ),
    scaffoldBackgroundColor: BrewColors.ink,
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: BrewColors.cream, displayColor: BrewColors.cream),
    appBarTheme: const AppBarTheme(backgroundColor: BrewColors.ink, foregroundColor: BrewColors.cream, elevation: 0),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: BrewColors.inkSoft,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BrewColors.gold, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: BrewColors.gold,
        foregroundColor: BrewColors.ink,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: BrewColors.inkSoft,
      indicatorColor: Color(0x33C8A96A),
    ),
  );
}
