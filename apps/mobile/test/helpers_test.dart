import 'package:brewistan/screens/auth/phone_screen.dart';
import 'package:brewistan/services/b64.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:brewistan/state/models.dart';

void main() {
  test('Arabic and Persian telephone digits normalize', () {
    expect(toE164('\u0660\u0667\u0665\u0660 \u0661\u0662\u0663 \u0664\u0665\u0666\u0667'), '+9647501234567');
    expect(toE164('\u06f0\u06f7\u06f5\u06f0 \u06f1\u06f2\u06f3 \u06f4\u06f5\u06f6\u06f7'), '+9647501234567');
  });
  test('earned reward keeps its original label after campaign changes', () {
    final card = CafeCard.fromJson({'cafeId':'c','name':'Cafe','rewardLabel':{'en':'New reward'},
      'rewards':[{'id':'r','expiresAt':'2099-01-01T00:00:00Z','voucher':'signed','rewardLabel':{'en':'Original reward'}}]});
    expect(card.label('en'), 'Original reward');
    expect(card.label('ar'), 'Original reward');
  });

  test('Iraqi numbers normalise to E.164', () {
    expect(toE164('0750 123 4567'), '+9647501234567');
    expect(toE164('7501234567'), '+9647501234567');
    expect(toE164('+964 750 123 4567'), '+9647501234567');
    expect(toE164('00964 750 123 4567'), '+9647501234567');
  });

  test('base64url round trip without padding', () {
    final bytes = List<int>.generate(33, (i) => i * 7 % 256);
    final encoded = b64urlEncode(bytes);
    expect(encoded.contains('='), isFalse);
    expect(b64urlDecode(encoded), bytes);
  });
}
