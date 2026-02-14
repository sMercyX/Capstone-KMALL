import os
import argparse
import random
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd

DEFAULT_DB = os.getenv(
    "DATABASE_URL",
    "postgres://postgres:postgres%2F25@localhost:5555/kmall_db?sslmode=disable",
)

@dataclass
class Case:
    case_id: int
    order_id: int
    event_id: int
    holdout_product_id: int
    holdout_parent_id: Optional[int]
    cancelled_items_count: int
    k: int
    is_hit: bool
    hit_rank: Optional[int]
    hit_reason: str
    long_tail_check: str
    cross_store_check: str
    constraint_pass: bool
    dist_stats_sanity_check: str

def parse_args():
    ap = argparse.ArgumentParser(description="Hold-out HitRate@K (Offline) for ORDER_CANCELLED recommendations")
    ap.add_argument("--db", default=DEFAULT_DB, help="Postgres connection string (DATABASE_URL)")
    ap.add_argument("--k", type=int, default=10, help="Top-K for HitRate@K (default 10)")
    ap.add_argument("--max-orders", type=int, default=50, help="Max cancelled orders to evaluate")
    ap.add_argument("--seed", type=int, default=42, help="Random seed for holdout selection")
    ap.add_argument("--match-mode", choices=["parent", "product"], default="parent",
                    help="Hit definition: parent=category.parent_id match, product=product_id match")
    ap.add_argument("--out", default="offline_eval_hit_rate.xlsx", help="Output Excel filename")
    return ap.parse_args()

# ---------- SQL helpers ----------

def fetch_eval_orders(cur, max_orders: int) -> List[Dict[str, Any]]:
    cur.execute(
        """
        WITH latest AS (
          SELECT DISTINCT ON (re.order_id)
            re.order_id,
            re.event_id,
            re.created_at
          FROM recommendation_events re
          WHERE re.trigger_type = 'ORDER_CANCELLED'
            AND re.order_id IS NOT NULL
          ORDER BY re.order_id, re.created_at DESC, re.event_id DESC
        )
        SELECT
          o.order_id,
          latest.event_id
        FROM latest
        JOIN orders o ON o.order_id = latest.order_id
        WHERE o.status = 'Cancelled'
        ORDER BY o.order_id DESC
        LIMIT %s;
        """,
        (max_orders, ),
    )
    return cur.fetchall()


def fetch_cancelled_items(cur, order_id: int) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT
          oi.order_item_id,
          oi.product_id,
          p.name,
          p.price,
          oi.unit_price,
          oi.subtotal,
          p.category_id,
          c.parent_id,
          p.store_id
        FROM order_items oi
        JOIN products p ON p.product_id = oi.product_id
        JOIN categories c ON c.category_id = p.category_id
        WHERE oi.order_id = %s
        ORDER BY oi.order_item_id ASC;
        """,
        (order_id, ),
    )
    return cur.fetchall()

def fetch_topk_recs(cur, event_id: int, k: int) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT
          rei.rank_no,
          rei.score,
          rei.reason,
          p.product_id,
          p.name,
          p.price,
          p.category_id,
          c.parent_id,
          p.store_id
        FROM recommendation_event_items rei
        JOIN products p ON p.product_id = rei.product_id
        JOIN categories c ON c.category_id = p.category_id
        WHERE rei.event_id = %s
        ORDER BY rei.rank_no ASC
        LIMIT %s;
        """,
        (event_id, k),
    )
    return cur.fetchall()

# ---------- Evaluation ----------

def is_hit(holdout: Dict[str, Any], recs: List[Dict[str, Any]], match_mode: str) -> Tuple[bool, Optional[int], str]:
    if match_mode == "product":
        target = int(holdout["product_id"])
        for r in recs:
            if int(r["product_id"]) == target:
                return True, int(r["rank_no"]), "product_id match"
        return False, None, "no product match in TopK"

    # parent mode
    target_parent = holdout.get("parent_id")
    if target_parent is None:
        return False, None, "holdout has no parent_id"

    target_parent = int(target_parent)
    for r in recs:
        rp = r.get("parent_id")
        if rp is not None and int(rp) == target_parent:
            return True, int(r["rank_no"]), "parent_id match"
    return False, None, "no parent match in TopK"

def constraint_pass_check(holdout: Dict[str, Any], recs: List[Dict[str, Any]]) -> bool:
    """Check if the recommendation passes constraints (e.g., same store vs cross store)."""
    holdout_store_id = holdout["store_id"]  # Fetch the store_id of the holdout product
    rec_store_id = recs[0]["store_id"]  # Fetch the store_id of the recommended product
    return holdout_store_id != rec_store_id

def dist_stats_sanity_check(recs: List[Dict[str, Any]]) -> str:
    """Check for distribution sanity: ensure score range is reasonable."""
    scores = [r["score"] for r in recs]
    min_score = min(scores)
    max_score = max(scores)
    return f"min: {min_score}, max: {max_score}"

def main():
    args = parse_args()
    random.seed(args.seed)

    conn = psycopg2.connect(args.db)
    conn.autocommit = True

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch cancelled orders
            orders = fetch_eval_orders(cur, args.max_orders)

            cases: List[Case] = []
            rows_cases: List[Dict[str, Any]] = []
            rows_topk: List[Dict[str, Any]] = []

            case_id = 0
            total_long_tail = 0
            total_cross_store = 0

            for o in orders:
                order_id = int(o["order_id"])
                event_id = int(o["event_id"])

                cancelled_items = fetch_cancelled_items(cur, order_id)
                if len(cancelled_items) == 0:
                    continue

                holdout = random.choice(cancelled_items)

                recs = fetch_topk_recs(cur, event_id, args.k)
                if len(recs) == 0:
                    hit, hit_rank, hit_reason = False, None, "no recommendations found"
                else:
                    hit, hit_rank, hit_reason = is_hit(holdout, recs, args.match_mode)

                case_id += 1

                # Long-Tail Exposure check
                long_tail_check = "long-tail" if float(holdout["price"]) < 100 else "popular"
                if long_tail_check == "long-tail":
                    total_long_tail += 1

                # Cross-store exposure check: Compare store_id between holdout and recommended
                cross_store_check = "cross-store" if constraint_pass_check(holdout, recs) else "same-store"
                if cross_store_check == "cross-store":
                    total_cross_store += 1

                # Constraint Pass check
                constraint_pass = constraint_pass_check(holdout, recs)

                # Distribution Stats Sanity check
                dist_stats = dist_stats_sanity_check(recs)

                # Save case data
                c = Case(
                    case_id=case_id,
                    order_id=order_id,
                    event_id=event_id,
                    holdout_product_id=int(holdout["product_id"]),
                    holdout_parent_id=(int(holdout["parent_id"]) if holdout.get("parent_id") is not None else None),
                    cancelled_items_count=len(cancelled_items),
                    k=args.k,
                    is_hit=hit,
                    hit_rank=hit_rank,
                    hit_reason=hit_reason,
                    long_tail_check=long_tail_check,
                    cross_store_check=cross_store_check,
                    constraint_pass=constraint_pass,
                    dist_stats_sanity_check=dist_stats
                )
                cases.append(c)

                # Add case data to rows
                rows_cases.append({
                    "case_id": c.case_id,
                    "order_id": c.order_id,
                    "event_id": c.event_id,
                    "holdout_product_id": c.holdout_product_id,
                    "holdout_parent_id": c.holdout_parent_id,
                    "cancelled_items_count": c.cancelled_items_count,
                    "K": c.k,
                    "is_hit": c.is_hit,
                    "hit_rank": c.hit_rank,
                    "hit_reason": c.hit_reason,
                    "long_tail_check": c.long_tail_check,
                    "cross_store_check": c.cross_store_check,
                    "constraint_pass": c.constraint_pass,
                    "dist_stats_sanity_check": c.dist_stats_sanity_check
                })

                # Add recommendation data to rows
                for r in recs:
                    rows_topk.append({
                        "case_id": c.case_id,
                        "order_id": c.order_id,
                        "event_id": c.event_id,
                        "holdout_product_id": c.holdout_product_id,
                        "holdout_parent_id": c.holdout_parent_id,
                        "rank": int(r["rank_no"]),
                        "rec_product_id": int(r["product_id"]),
                        "rec_parent_id": (int(r["parent_id"]) if r.get("parent_id") is not None else None),
                        "score": float(r["score"]) if r.get("score") is not None else None,
                        "reason": r.get("reason"),
                        "price": float(r["price"]) if r.get("price") is not None else None,
                        "name": r.get("name"),
                        "is_hit_row": (
                            (args.match_mode == "product" and int(r["product_id"]) == c.holdout_product_id)
                            or (args.match_mode == "parent" and c.holdout_parent_id is not None and r.get("parent_id") is not None
                                and int(r["parent_id"]) == c.holdout_parent_id)
                        ),
                        "long_tail_check": long_tail_check,
                        "cross_store_check": cross_store_check
                    })

            df_cases = pd.DataFrame(rows_cases)
            df_topk = pd.DataFrame(rows_topk)

            # Summary metrics
            hit_cases = sum(1 for c in cases if c.is_hit)
            total_cases = len(cases)
            hit_rate = hit_cases / total_cases if total_cases > 0 else 0

            constraint_pass_count = sum(1 for c in cases if c.constraint_pass)
            constraint_pass_rate = constraint_pass_count / total_cases if total_cases > 0 else 0

            long_tail_count = sum(1 for c in cases if c.long_tail_check == "long-tail")
            long_tail_exposure = long_tail_count / total_cases if total_cases > 0 else 0

            min_score = df_topk['score'].min()
            max_score = df_topk['score'].max()

            df_summary = pd.DataFrame([{
                "metric": f"HitRate@{args.k}",
                "match_mode": args.match_mode,
                "total_cases": len(cases),
                "hit_cases": hit_cases,
                "hit_rate": round(hit_rate, 4),
                "constraint_pass_rate": round(constraint_pass_rate, 4),
                "long_tail_exposure": round(long_tail_exposure, 4),
                "dist_stats_sanity_check": f"Min: {min_score}, Max: {max_score}",
                "random_seed": args.seed,
                "note": "Pseudo hold-out (recommendations generated from full cancelled order items). Dev-stage sanity check."
            }])

            # Export to Excel
            with pd.ExcelWriter(args.out, engine="openpyxl") as writer:
                df_cases.to_excel(writer, sheet_name="cases", index=False)
                df_topk.to_excel(writer, sheet_name="topk", index=False)
                df_summary.to_excel(writer, sheet_name="summary", index=False)

            print(f"[OK] wrote: {args.out}")
            print(df_summary.to_string(index=False))

    finally:
        conn.close()


if __name__ == "__main__":
    main()