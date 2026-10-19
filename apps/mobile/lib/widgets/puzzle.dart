import 'package:flutter/material.dart';

// =============================================================================
// ALL STAMP-MARK LOOKS LIVE IN THIS FILE.
//
// A collected stamp fills in; an uncollected one shows only an outline.
// Three styles a Signature or Bespoke cafe can pick between (set in
// cafes.brand.stamp, validated by the database): 'cup', 'dot', 'bean'.
// Classic cafes always get 'cup', the default, and cannot change it.
// To ADD a style: add its id to [stampStyles], a case in [_painterFor], and
// the matching id to the database check in the latest migration that
// validates cafes.brand.stamp.
// =============================================================================

const String defaultStampStyle = 'cup';
const List<String> stampStyles = ['cup', 'dot', 'bean'];

/// The stamp grid: one mark per stamp, like a real paper loyalty card.
class PuzzleGrid extends StatelessWidget {
  const PuzzleGrid({
    super.key,
    required this.filled,
    required this.total,
    required this.color,
    required this.name,
    this.style = defaultStampStyle,
    this.dim,
  });

  final int filled;
  final int total;
  final Color color;
  /// The cafe's name, used only to read its first letter for the 'cup' style.
  final String name;
  /// One of [stampStyles]; an unrecognised value falls back to the default.
  final String style;
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
    final resolvedStyle = stampStyles.contains(style) ? style : defaultStampStyle;
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
              CustomPaint(size: Size(size, size), painter: _painterFor(resolvedStyle, fill, filled: on)),
              if (on && resolvedStyle == 'cup')
                Text(
                  initial,
                  style: TextStyle(color: _readableOn(fill), fontSize: size * 0.32, fontWeight: FontWeight.w700, height: 1),
                ),
            ]),
          );
        }),
      );
    });
  }
}

CustomPainter _painterFor(String style, Color color, {required bool filled}) {
  switch (style) {
    case 'dot':
      return _DotPainter(color, filled: filled);
    case 'bean':
      return _BeanPainter(color, filled: filled);
    case 'cup':
    default:
      return _CupPainter(color, filled: filled);
  }
}

/// White or near-black, whichever reads better on the given colour.
Color _readableOn(Color background) => background.computeLuminance() > 0.45 ? const Color(0xFF1C1A18) : Colors.white;

/// 'cup': an espresso-cup silhouette with the cafe's initial inside once collected.
class _CupPainter extends CustomPainter {
  _CupPainter(this.color, {required this.filled});
  final Color color;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
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

/// 'dot': the classic punch-card look, a plain filled or outlined circle.
class _DotPainter extends CustomPainter {
  _DotPainter(this.color, {required this.filled});
  final Color color;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.shortestSide * 0.36;
    if (filled) {
      canvas.drawCircle(center, radius, Paint()..color = color..style = PaintingStyle.fill);
      canvas.drawCircle(
        Offset(center.dx - radius * 0.32, center.dy - radius * 0.32),
        radius * 0.28,
        Paint()..color = Colors.white.withValues(alpha: 0.18),
      );
    } else {
      canvas.drawCircle(center, radius, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = size.shortestSide * 0.07);
    }
  }

  @override
  bool shouldRepaint(covariant _DotPainter old) => old.color != color || old.filled != filled;
}

/// 'bean': a stylised coffee bean, two lobes with the central crease.
class _BeanPainter extends CustomPainter {
  _BeanPainter(this.color, {required this.filled});
  final Color color;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final rect = Rect.fromCenter(center: Offset(w / 2, h / 2), width: w * 0.58, height: h * 0.82);
    final bean = Path()
      ..moveTo(rect.center.dx, rect.top)
      ..quadraticBezierTo(rect.right + w * 0.06, rect.top + rect.height * 0.28, rect.center.dx, rect.center.dy)
      ..quadraticBezierTo(rect.right + w * 0.06, rect.bottom - rect.height * 0.28, rect.center.dx, rect.bottom)
      ..quadraticBezierTo(rect.left - w * 0.06, rect.bottom - rect.height * 0.28, rect.center.dx, rect.center.dy)
      ..quadraticBezierTo(rect.left - w * 0.06, rect.top + rect.height * 0.28, rect.center.dx, rect.top)
      ..close();

    final creaseTop = Offset(rect.center.dx - w * 0.02, rect.top + rect.height * 0.14);
    final creaseBottom = Offset(rect.center.dx - w * 0.02, rect.bottom - rect.height * 0.14);
    final crease = Path()
      ..moveTo(creaseTop.dx, creaseTop.dy)
      ..quadraticBezierTo(rect.center.dx + w * 0.07, rect.center.dy, creaseBottom.dx, creaseBottom.dy);

    if (filled) {
      canvas.drawPath(bean, Paint()..color = color..style = PaintingStyle.fill);
      canvas.drawPath(crease, Paint()..color = Colors.white.withValues(alpha: 0.4)..style = PaintingStyle.stroke..strokeWidth = w * 0.045..strokeCap = StrokeCap.round);
    } else {
      final stroke = Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = w * 0.045..strokeCap = StrokeCap.round;
      canvas.drawPath(bean, stroke);
      canvas.drawPath(crease, stroke);
    }
  }

  @override
  bool shouldRepaint(covariant _BeanPainter old) => old.color != color || old.filled != filled;
}
