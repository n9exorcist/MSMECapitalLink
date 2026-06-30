# backend/services/migration.py
# Migration-pathway analysis — turns the component scorecard into a prioritised set of
# moves that lift a file toward Band A / bank-ready, and projects the resulting score.
# Drives the Migration Pathway Plan document. Pure function of the read-model; no I/O.
#
# Impact model: raising a component to the 80 target adds  weight × (80 − score)  to the
# weighted composite. Moves are ranked by that impact, so the plan leads with the biggest
# lever (often a heavily-weighted, unevidenced component — e.g. banking discipline for a
# provisional file). Unevidenced components are "unlock/certify" moves; their score impact
# is indicative (the evidence could land anywhere, but ≥ target is the working assumption).

from dataclasses import dataclass
from typing import List

from services.scoring_engine import COMPONENT_WEIGHTS, _band

TARGET = 80

NAMES = {
    "banking_discipline": "Banking discipline", "liquidity_ratios": "Liquidity ratios",
    "gst_consistency": "GST consistency", "leverage_quality": "Leverage quality",
    "profitability": "Profitability", "compliance_discipline": "Compliance discipline",
    "documentation_readiness": "Documentation readiness", "repayment_behavior": "Repayment behavior",
}


@dataclass
class Move:
    component: str
    name: str
    current: float
    target: int
    weight: int          # whole-percent weight
    impact: float        # composite points added if raised to target
    evidenced: bool      # False → an "unlock/certify" move (provide evidence)


@dataclass
class MigrationPlan:
    current_score: int
    current_band: str
    current_tier: str
    provisional: bool
    completeness: int
    target_band: str
    target_tier: str
    projected_score: int
    gap_to_target: int          # 80 − current (0 if already ≥ 80)
    moves: List[Move]           # ranked by impact desc
    flags: List[str]


def build_plan(rm) -> MigrationPlan:
    r = rm.score
    comps = r["component_breakdown"]
    evid = r.get("evidenced", {})

    moves: List[Move] = []
    for k, score in comps.items():
        if score < TARGET:
            impact = COMPONENT_WEIGHTS[k] * (TARGET - score)
            moves.append(Move(
                component=k, name=NAMES.get(k, k), current=score, target=TARGET,
                weight=round(COMPONENT_WEIGHTS[k] * 100), impact=round(impact, 1),
                evidenced=evid.get(k, True),
            ))
    moves.sort(key=lambda mv: mv.impact, reverse=True)

    current = r["currentScore"]
    projected = min(100, round(current + sum(mv.impact for mv in moves)))
    target_band, target_tier = _band(TARGET)     # Band A reference tier

    return MigrationPlan(
        current_score=current,
        current_band=r["band"],
        current_tier=r["recommended_lender_tier"],
        provisional=r["provisional"],
        completeness=r["data_completeness"],
        target_band=target_band,
        target_tier=target_tier,
        projected_score=projected,
        gap_to_target=max(0, TARGET - current),
        moves=moves,
        flags=r.get("flags", []),
    )
