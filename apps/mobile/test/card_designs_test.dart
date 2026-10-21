import 'package:brewistan/cards/card_designs.dart';
import 'package:brewistan/state/models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  _tierTests();
  _signatureLookTests();
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

void _tierTests() {
  test('every tier has a gradient with at least two colours', () {
    for (final tier in ['bronze', 'silver', 'gold', 'matte_black']) {
      expect(tierGradients[tier], isNotNull);
      expect(tierGradients[tier]!.length, greaterThanOrEqualTo(2));
    }
  });

  test('shadow grows from bronze to the top tier', () {
    expect(tierShadowFor('matte_black').blur, greaterThan(tierShadowFor('bronze').blur));
    expect(tierShadowFor('matte_black').color.a, greaterThan(tierShadowFor('bronze').color.a));
  });

  test('an unknown tier falls back to bronze', () {
    expect(tierShadowFor('made_up_tier').blur, tierShadowFor('bronze').blur);
  });
}


void _signatureLookTests() {
  test('a Signature card uses the cafe\'s own colours as a solid colour', () {
    final card = CafeCard(
      cafeId: 'c1', name: 'Nana\'s Tea', tier: 'signature',
      brand: {'template': 'noir', 'primary': '#123c33', 'accent': '#e5d3a1'},
      logoUrl: null, archived: false, stampsInCurrent: 5, stampsRequired: 8,
      rewardLabel: const {'en': 'Free Coffee'}, completedPuzzles: 0, muted: false, rewards: const [],
    );
    final look = resolveCardLook(card, 'bronze');
    expect(look.branded, isTrue);
    expect(look.background.first, const Color(0xFF123C33));
    expect(look.background.first, look.background.last);
    expect(look.foreground, const Color(0xFFE5D3A1));
  });

  test('a Classic card keeps the metallic status colours', () {
    final card = CafeCard(
      cafeId: 'c2', name: 'Cafe', tier: 'classic', brand: const {},
      logoUrl: null, archived: false, stampsInCurrent: 0, stampsRequired: 8,
      rewardLabel: const {'en': 'Free Coffee'}, completedPuzzles: 0, muted: false, rewards: const [],
    );
    final look = resolveCardLook(card, 'gold');
    expect(look.branded, isFalse);
    expect(look.background, tierGradients['gold']);
  });
}
