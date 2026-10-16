import 'package:flutter_test/flutter_test.dart';
import 'package:brewistan/services/payload_cipher.dart';
void main() {
 test('payloads encrypt with unique nonces and round-trip', () async {
  final cipher=PayloadCipher(List<int>.generate(32,(i)=>i));
  final a=await cipher.seal('customer-qr','queue:event:user:qr');
  final b=await cipher.seal('customer-qr','queue:event:user:qr');
  expect(a,isNot(b));expect(a.contains('customer-qr'),isFalse);
  expect(await cipher.open(a,'queue:event:user:qr'),'customer-qr');
 });
 test('cipher rejects wrong account/context and wrong key', () async {
  final c=PayloadCipher(List<int>.filled(32,1));final value=await c.seal('payload','user-a:event-a');
  await expectLater(c.open(value,'user-b:event-a'),throwsA(anything));
  await expectLater(PayloadCipher(List<int>.filled(32,2)).open(value,'user-a:event-a'),throwsA(anything));
 });
 test('plaintext is never silently treated as an authenticated payload', () async {
  await expectLater(PayloadCipher(List<int>.filled(32,1)).open('plaintext','record'),throwsFormatException);
 });
}
