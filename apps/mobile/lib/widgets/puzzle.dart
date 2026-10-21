import 'package:flutter/material.dart';

// =============================================================================
// THE STAMP GRID.
//
// Every stamp is a coffee cup sitting in a slot pressed into the card. A
// collected stamp shows a solid cup; an empty slot shows a faint one, so the
// customer can see at a glance how many are left.
// =============================================================================

class PuzzleGrid extends StatelessWidget {
  const PuzzleGrid({
    super.key,
    required this.filled,
    required this.total,
    required this.color,
    this.onLightCard = false,
  });

  final int filled;
  final int total;

  /// Colour of the cups (the card's accent / text colour).
  final Color color;

  /// True when the card itself is light (for example the Marble design), so the
  /// pressed-in slots are drawn with a soft grey instead of a dark shade.
  final bool onLightCard;

  @override
  Widget build(BuildContext context) {
    final columns = total <= 8 ? 4 : (total / 2).ceil().clamp(4, 6);
    return LayoutBuilder(builder: (context, c) {
      const gap = 10.0;
      final cell = (c.maxWidth - (columns - 1) * gap) / columns;
      final slot = cell.clamp(0.0, 46.0);
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: List.generate(total, (i) {
          final on = i < filled;
          return SizedBox(
            width: cell,
            height: slot,
            child: Center(child: _Slot(size: slot, on: on, color: color, onLightCard: onLightCard)),
          );
        }),
      );
    });
  }
}

class _Slot extends StatelessWidget {
  const _Slot({required this.size, required this.on, required this.color, required this.onLightCard});
  final double size;
  final bool on;
  final Color color;
  final bool onLightCard;

  @override
  Widget build(BuildContext context) {
    // Darker at the top, lighter at the bottom: reads as a slot pressed into the card.
    final top = onLightCard ? Colors.black.withValues(alpha: 0.10) : Colors.black.withValues(alpha: 0.34);
    final bottom = onLightCard ? Colors.black.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.14);
    final rim = on
        ? color.withValues(alpha: 0.38)
        : (onLightCard ? Colors.white.withValues(alpha: 0.70) : Colors.white.withValues(alpha: 0.06));
    return AnimatedContainer(
      duration: const Duration(milliseconds: 350),
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [top, bottom]),
        border: Border.all(color: rim, width: 1),
      ),
      child: Padding(
        padding: EdgeInsets.all(size * 0.2),
        child: CustomPaint(painter: _CupPainter(color.withValues(alpha: on ? 1 : 0.16))),
      ),
    );
  }
}

/// A simple, flat coffee cup: body, handle and saucer line.
class _CupPainter extends CustomPainter {
  _CupPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final fill = Paint()..color = color..style = PaintingStyle.fill;
    final line = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = w * 0.09;

    // Body: flat top, rounded bottom.
    final left = w * 0.10, right = w * 0.68, top = h * 0.18, bottom = h * 0.74;
    final radius = (right - left) * 0.32;
    final body = Path()
      ..moveTo(left, top)
      ..lineTo(right, top)
      ..lineTo(right, bottom - radius)
      ..quadraticBezierTo(right, bottom, right - radius, bottom)
      ..lineTo(left + radius, bottom)
      ..quadraticBezierTo(left, bottom, left, bottom - radius)
      ..close();
    canvas.drawPath(body, fill);

    // Handle on the right.
    final handle = Rect.fromLTWH(right - w * 0.08, top + h * 0.08, w * 0.28, h * 0.30);
    canvas.drawArc(handle, -1.35, 2.7, false, line);

    // Saucer.
    canvas.drawLine(Offset(w * 0.02, h * 0.88), Offset(w * 0.78, h * 0.88), line..strokeWidth = w * 0.07);
  }

  @override
  bool shouldRepaint(covariant _CupPainter old) => old.color != color;
}
