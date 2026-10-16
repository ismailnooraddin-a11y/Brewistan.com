import 'package:brewistan/cards/card_designs.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('design ids are unique and use the allowed format', () {
    final ids = cardDesigns.map((d) => d.id).toList();
    expect(ids.toSet().length, ids.length);
    for (final id in ids) {
      expect(RegExp(r'^[a-z][a-z0-9_]{1,23}$').hasMatch(id), isTrue);
    }
  });

  test('the default design exists', () {
    expect(cardDesigns.any((d) => d.id == defaultCardDesignId), isTrue);
  });

  test('unknown or missing ids fall back to the default design', () {
    expect(cardDesignById('removed_design').id, defaultCardDesignId);
    expect(cardDesignById(null).id, defaultCardDesignId);
    expect(cardDesignById('emerald').id, 'emerald');
  });
}
