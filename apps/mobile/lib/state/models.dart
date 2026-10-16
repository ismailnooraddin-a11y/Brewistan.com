class RewardInfo {
  RewardInfo({required this.id, required this.expiresAt, required this.voucher, this.rewardLabel = const {'en': 'Free Coffee'}});
  final String id;
  final DateTime expiresAt;
  final String voucher;
  final Map<String, dynamic> rewardLabel;

  factory RewardInfo.fromJson(Map<String, dynamic> j) => RewardInfo(
        id: j['id'] as String,
        expiresAt: DateTime.parse(j['expiresAt'] as String),
        voucher: j['voucher'] as String,
        rewardLabel: Map<String,dynamic>.from(j['rewardLabel'] as Map? ?? const {'en':'Free Coffee'}),
      );
}

class CafeCard {
  CafeCard({
    required this.cafeId,
    required this.name,
    required this.tier,
    required this.brand,
    required this.logoUrl,
    required this.archived,
    required this.stampsInCurrent,
    required this.stampsRequired,
    required this.rewardLabel,
    required this.completedPuzzles,
    required this.muted,
    required this.rewards,
  });

  final String cafeId;
  final String name;
  final String tier; // cafe plan: classic | signature | bespoke
  final Map<String, dynamic> brand;
  final String? logoUrl;
  final bool archived;
  final int stampsInCurrent;
  final int stampsRequired;
  final Map<String, dynamic> rewardLabel;
  final int completedPuzzles;
  final bool muted;
  final List<RewardInfo> rewards;

  String label(String lang, {DateTime? at}) {
    final available = rewards.where((r)=>r.expiresAt.isAfter(at??DateTime.now())).toList();
    final labels = available.isNotEmpty ? available.first.rewardLabel : rewardLabel;
    return (labels[lang] as String?)?.isNotEmpty == true ? labels[lang] as String : (labels['en'] as String? ?? 'Free Coffee');
  }

  factory CafeCard.fromJson(Map<String, dynamic> j) => CafeCard(
        cafeId: j['cafeId'] as String,
        name: j['name'] as String,
        tier: j['tier'] as String? ?? 'classic',
        brand: Map<String, dynamic>.from(j['brand'] as Map? ?? const {}),
        logoUrl: j['logoUrl'] as String?,
        archived: j['archived'] as bool? ?? false,
        stampsInCurrent: (j['stampsInCurrent'] as num?)?.toInt() ?? 0,
        stampsRequired: (j['stampsRequired'] as num?)?.toInt() ?? 8,
        rewardLabel: Map<String, dynamic>.from(j['rewardLabel'] as Map? ?? const {'en': 'Free Coffee'}),
        completedPuzzles: (j['completedPuzzles'] as num?)?.toInt() ?? 0,
        muted: j['muted'] as bool? ?? false,
        rewards: ((j['rewards'] as List?) ?? const [])
            .map((r) => RewardInfo.fromJson(Map<String, dynamic>.from(r as Map)))
            .toList(),
      );
}

class WalletData {
  WalletData({
    required this.firstName,
    required this.tier,
    required this.completedTotal,
    required this.cards,
  });

  final String? firstName;
  final String tier; // customer status: bronze | silver | gold | matte_black
  final int completedTotal;
  final List<CafeCard> cards;

  factory WalletData.fromJson(Map<String, dynamic> j) {
    final profile = Map<String, dynamic>.from(j['profile'] as Map? ?? const {});
    return WalletData(
      firstName: profile['firstName'] as String?,
      tier: profile['tier'] as String? ?? 'bronze',
      completedTotal: (profile['completedTotal'] as num?)?.toInt() ?? 0,
      cards: ((j['cards'] as List?) ?? const [])
          .map((c) => CafeCard.fromJson(Map<String, dynamic>.from(c as Map)))
          .toList(),
    );
  }
}

/// Status thresholds in completed puzzles (match the server's tier_for).
const tierThresholds = {'bronze': 0, 'silver': 3, 'gold': 10, 'matte_black': 25};

String? nextTier(String tier) {
  const order = ['bronze', 'silver', 'gold', 'matte_black'];
  final i = order.indexOf(tier);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}
