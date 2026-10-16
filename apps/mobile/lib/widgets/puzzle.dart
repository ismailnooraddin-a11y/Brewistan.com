import 'dart:math' as math;

import 'package:flutter/material.dart';

/// The hidden-score puzzle: one piece per stamp, no numbers shown.
class PuzzleGrid extends StatelessWidget {
  const PuzzleGrid({super.key, required this.filled, required this.total, required this.color, this.dim});

  final int filled;
  final int total;
  final Color color;
  final Color? dim;

  @override
  Widget build(BuildContext context) {
    final columns = total <= 8 ? 4 : (total / 2).ceil().clamp(4, 6);
    return LayoutBuilder(builder: (context, c) {
      final size = (c.maxWidth - (columns - 1) * 6) / columns;
      return Wrap(
        spacing: 6,
        runSpacing: 6,
        children: List.generate(total, (i) {
          final on = i < filled;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 400),
            width: size,
            height: size * 0.82,
            child: CustomPaint(painter: _PiecePainter(on ? color : (dim ?? color.withValues(alpha: 0.14)), seed: i, filled: on)),
          );
        }),
      );
    });
  }
}

class _PiecePainter extends CustomPainter {
  _PiecePainter(this.color, {required this.seed, required this.filled});
  final Color color;
  final int seed;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.height * 0.16;
    final body = RRect.fromRectAndRadius(Rect.fromLTWH(0, r, size.width - r, size.height - r), const Radius.circular(6));
    final path = Path()..addRRect(body);
    // Knobs: top and right, alternating so neighbouring pieces look interlocked.
    if (seed.isEven) path.addOval(Rect.fromCircle(center: Offset((size.width - r) / 2, r), radius: r));
    path.addOval(Rect.fromCircle(center: Offset(size.width - r, r + (size.height - r) / 2), radius: r * (seed.isEven ? 1 : 0.85)));
    final paint = Paint()
      ..color = color
      ..style = filled ? PaintingStyle.fill : PaintingStyle.stroke
      ..strokeWidth = 1.4;
    canvas.drawPath(path, paint);
    if (filled) {
      final shine = Paint()..color = Colors.white.withValues(alpha: 0.12);
      canvas.drawCircle(Offset(size.width * 0.28, size.height * 0.45), math.min(size.width, size.height) * 0.12, shine);
    }
  }

  @override
  bool shouldRepaint(covariant _PiecePainter old) => old.color != color || old.filled != filled;
}
