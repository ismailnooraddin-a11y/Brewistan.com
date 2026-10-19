import 'package:flutter/material.dart';

/// The stamp grid: one coffee-cup mark per stamp, like a real paper loyalty card.
/// A collected stamp is a solid cup with the cafe's first letter inside it; an
/// uncollected one is just the cup's outline, empty.
class PuzzleGrid extends StatelessWidget {
  const PuzzleGrid({super.key, required this.filled, required this.total, required this.color, required this.name, this.dim});

  final int filled;
  final int total;
  final Color color;
  /// The cafe's name, used only to read its first letter for the stamp mark.
  final String name;
  final Color? dim;

  // dart:core only (no `characters` package dependency): take the first Unicode
  // code point, which is correct for Latin and Arabic/Sorani letters alike.
  String get _initial {
    final trimmed = name.trim();
    return trimmed.isEmpty ? '?' : String.fromCharCode(trimmed.runes.first).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final columns = total <= 8 ? 4 : (total / 2).ceil().clamp(4, 6);
    final initial = _initial;
    return LayoutBuilder(builder: (context, c) {
      final size = (c.maxWidth - (columns - 1) * 8) / columns;
      return Wrap(
        spacing: 8,
        runSpacing: 8,
        children: List.generate(total, (i) {
          final on = i < filled;
          final fill = on ? color : (dim ?? color.withValues(alpha: 0.16));
          return AnimatedContainer(
            duration: const Duration(milliseconds: 400),
            width: size,
            height: size,
            child: Stack(alignment: Alignment.center, children: [
              CustomPaint(size: Size(size, size), painter: _CupPainter(fill, filled: on)),
              if (on)
                Text(
                  initial,
                  style: TextStyle(
                    color: _readableOn(fill),
                    fontSize: size * 0.32,
                    fontWeight: FontWeight.w700,
                    height: 1,
                  ),
                ),
            ]),
          );
        }),
      );
    });
  }
}

/// White or near-black, whichever reads better on the given cup colour.
Color _readableOn(Color background) => background.computeLuminance() > 0.45 ? const Color(0xFF1C1A18) : Colors.white;

class _CupPainter extends CustomPainter {
  _CupPainter(this.color, {required this.filled});
  final Color color;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    // A simple espresso-cup silhouette: a slightly tapered body, a thin rim at
    // the top, and an open handle on the right, sized to sit inside the cell
    // with room for the saucer line beneath it.
    final top = h * 0.16;
    final bottom = h * 0.74;
    final bodyLeft = w * 0.18, bodyRight = w * 0.82;
    final bottomLeft = w * 0.26, bottomRight = w * 0.74;

    final body = Path()
      ..moveTo(bodyLeft, top)
      ..lineTo(bodyRight, top)
      ..quadraticBezierTo(bodyRight, bottom, bottomRight, bottom)
      ..lineTo(bottomLeft, bottom)
      ..quadraticBezierTo(bodyLeft, bottom, bodyLeft, top)
      ..close();

    final rim = Rect.fromLTWH(bodyLeft, top - h * 0.035, bodyRight - bodyLeft, h * 0.07);
    final handle = Rect.fromLTWH(bodyRight - w * 0.02, top + h * 0.06, w * 0.22, h * 0.30);
    final saucer = Rect.fromCenter(center: Offset(w / 2, bottom + h * 0.07), width: w * 0.62, height: h * 0.05);

    if (filled) {
      final fill = Paint()..color = color..style = PaintingStyle.fill;
      canvas.drawPath(body, fill);
      canvas.drawOval(rim, fill);
      canvas.drawArc(handle, -1.2, 2.3, false, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = w * 0.09..strokeCap = StrokeCap.round);
      canvas.drawOval(saucer, Paint()..color = color.withValues(alpha: 0.5)..style = PaintingStyle.fill);
      // A soft highlight on the body, so a filled stamp doesn't read as a flat silhouette.
      canvas.drawOval(
        Rect.fromCenter(center: Offset(w * 0.37, h * 0.42), width: w * 0.16, height: h * 0.22),
        Paint()..color = Colors.white.withValues(alpha: 0.16),
      );
    } else {
      final stroke = Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = w * 0.045;
      canvas.drawPath(body, stroke);
      canvas.drawOval(rim, stroke);
      canvas.drawArc(handle, -1.2, 2.3, false, stroke..strokeCap = StrokeCap.round);
      canvas.drawOval(saucer, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = w * 0.03);
    }
  }

  @override
  bool shouldRepaint(covariant _CupPainter old) => old.color != color || old.filled != filled;
}
