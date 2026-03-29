#!/usr/bin/env python3
"""
KMALL mock orders generator
────────────────────────────────────────────────────────────
Features:
  • กำหนดช่วง order_date  --date-from / --date-to
  • เลือก store เป้าหมาย  --store-ids / --seller-kms-id / --stores-mode
  • กันซื้อร้านตัวเอง      ระบบตรวจ seller_user_id ≠ buyer_user_id อัตโนมัติ

ตัวอย่างคำสั่ง — ดูส่วน EXAMPLES ด้านล่าง หรือรัน: python gen_mock_orders.py --help
"""

import os
import argparse
import random
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Set
from datetime import datetime, timedelta, timezone

import psycopg2
from psycopg2.extras import RealDictCursor

# ── connection ───────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgres://postgres:postgres%2F25@localhost:5555/kmall_db?sslmode=disable",
)

# ── constants ────────────────────────────────────────────────────────────────
STATUS_PENDING   = "Pending"
STATUS_PROPOSED  = "Proposed"
STATUS_ACCEPTED  = "Accepted"
STATUS_COMPLETED = "Completed"
STATUS_CANCELLED = "Cancelled"

DM_ROUND_UNI = "ROUND_UNIVERSITY"
DM_CAMPUS    = "CAMPUS"


# ============================================================
# Args
# ============================================================

@dataclass
class Args:
    truncate: bool
    seed: Optional[int]

    # buyer
    buyers_mode: str          # "one" | "all"
    buyer_kms_id: str
    max_buyers: int

    # store / seller  ← ใหม่
    store_ids: List[int]      # ว่าง = ทุก store
    seller_kms_id: Optional[str]
    stores_mode: str          # "specific" | "all"
    no_self_purchase: bool    # True = กัน buyer ≠ seller (default True)

    campus_zone: str

    orders_per_product: int
    extra_completed: int
    extra_cancelled: int

    max_products_per_buyer: int
    shuffle_products: bool

    date_from: Optional[datetime]
    date_to:   Optional[datetime]


def parse_args() -> Args:
    ap = argparse.ArgumentParser(
        description="KMALL mock orders generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXAMPLES
────────
# 1) buyer คนเดียว ซื้อจากทุก store (กัน self-purchase อัตโนมัติ)
python gen_mock_orders.py --buyers-mode one --buyer-kms-id dev-buyer-1

# 2) ระบุ store เดียวด้วย store_id
python gen_mock_orders.py --buyer-kms-id dev-buyer-1 --store-ids 3

# 3) ระบุหลาย store
python gen_mock_orders.py --buyer-kms-id dev-buyer-1 --store-ids 1,2,5

# 4) ระบุ seller ด้วย kms_id (ดึง store ทั้งหมดของ seller คนนั้น)
python gen_mock_orders.py --buyer-kms-id dev-buyer-1 --seller-kms-id dev-seller-2

# 5) buyer ทุกคน × store ทุกร้าน (กัน self-purchase อัตโนมัติ)
python gen_mock_orders.py --buyers-mode all --stores-mode all --max-buyers 5

# 6) กระจาย order_date ในช่วง 6 เดือน
python gen_mock_orders.py \\
  --buyers-mode all --stores-mode all \\
  --date-from 2025-10-01 --date-to 2026-03-31

# 7) สร้างข้อมูลหนาขึ้น + ล้างของเก่าก่อน
python gen_mock_orders.py \\
  --truncate \\
  --buyers-mode all --stores-mode all \\
  --orders-per-product 2 --extra-completed 3 --extra-cancelled 2 \\
  --date-from 2026-01-01 --date-to 2026-03-31 \\
  --seed 42

# 8) ปิดการกัน self-purchase (ใช้สำหรับ test edge case)
python gen_mock_orders.py --buyer-kms-id dev-seller-1 --allow-self-purchase
""",
    )

    # ── general ──────────────────────────────────────────────
    ap.add_argument("--truncate",   action="store_true",
                    help="TRUNCATE orders + order_items ก่อนสร้าง")
    ap.add_argument("--seed",       type=int, default=None,
                    help="random seed เพื่อให้ reproduce ได้")

    # ── buyer ─────────────────────────────────────────────────
    ap.add_argument("--buyers-mode", choices=["one","all"], default="one",
                    help="one=ใช้ --buyer-kms-id, all=ทุก buyer")
    ap.add_argument("--buyer-kms-id", type=str, default="dev-buyer-1",
                    help="kms_id ของ buyer (ใช้เมื่อ --buyers-mode one)")
    ap.add_argument("--max-buyers",  type=int, default=0,
                    help="จำกัดจำนวน buyer (0=ไม่จำกัด)")

    # ── store / seller ← ใหม่ ─────────────────────────────────
    ap.add_argument("--store-ids",   type=str, default="",
                    help="store_id ที่ต้องการ คั่นด้วย comma เช่น 1,2,5  (default=ทุก store)")
    ap.add_argument("--seller-kms-id", type=str, default=None,
                    help="kms_id ของ seller — ดึงทุก store ที่ seller นั้นเป็นเจ้าของ")
    ap.add_argument("--stores-mode", choices=["specific","all"], default="specific",
                    help="specific=ใช้ --store-ids/--seller-kms-id, all=ทุก store")
    ap.add_argument("--allow-self-purchase", action="store_true",
                    help="ปิดการกัน buyer ≠ seller (ค่าเริ่มต้น: กัน)")

    # ── campus ────────────────────────────────────────────────
    ap.add_argument("--campus-zone", type=str, default="North")

    # ── volume ────────────────────────────────────────────────
    ap.add_argument("--orders-per-product",     type=int, default=1)
    ap.add_argument("--extra-completed",        type=int, default=1)
    ap.add_argument("--extra-cancelled",        type=int, default=1)
    ap.add_argument("--max-products-per-buyer", type=int, default=0)
    ap.add_argument("--shuffle-products",       action="store_true")

    # ── date range ────────────────────────────────────────────
    ap.add_argument("--date-from", type=str, default=None,
                    help="วันเริ่ม order_date  YYYY-MM-DD  (default=now)")
    ap.add_argument("--date-to",   type=str, default=None,
                    help="วันสุดท้าย order_date  YYYY-MM-DD  (default=now)")

    ns = ap.parse_args()

    def parse_date(s: Optional[str]) -> Optional[datetime]:
        if s is None:
            return None
        return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    def parse_store_ids(s: str) -> List[int]:
        if not s.strip():
            return []
        return [int(x.strip()) for x in s.split(",") if x.strip()]

    return Args(
        truncate=ns.truncate,
        seed=ns.seed,
        buyers_mode=ns.buyers_mode,
        buyer_kms_id=ns.buyer_kms_id,
        max_buyers=ns.max_buyers,
        store_ids=parse_store_ids(ns.store_ids),
        seller_kms_id=ns.seller_kms_id,
        stores_mode=ns.stores_mode,
        no_self_purchase=not ns.allow_self_purchase,
        campus_zone=ns.campus_zone,
        orders_per_product=ns.orders_per_product,
        extra_completed=ns.extra_completed,
        extra_cancelled=ns.extra_cancelled,
        max_products_per_buyer=ns.max_products_per_buyer,
        shuffle_products=ns.shuffle_products,
        date_from=parse_date(ns.date_from),
        date_to=parse_date(ns.date_to),
    )


# ============================================================
# Date helper
# ============================================================

def random_order_date(date_from: Optional[datetime], date_to: Optional[datetime]) -> datetime:
    now = datetime.now(timezone.utc)
    if date_from is None or date_to is None:
        return now
    if date_to < date_from:
        raise ValueError("--date-to ต้องมากกว่าหรือเท่ากับ --date-from")
    delta_secs = int((date_to - date_from).total_seconds())
    return date_from + timedelta(seconds=random.randint(0, delta_secs))


# ============================================================
# DB helpers — buyers
# ============================================================

def get_buyers_all(cur) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT DISTINCT u.user_id, u.kms_id
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.role_name = 'buyer'
        ORDER BY u.kms_id;
        """
    )
    return cur.fetchall()


def get_buyer_one(cur, kms_id: str) -> Dict[str, Any]:
    cur.execute("SELECT user_id, kms_id FROM users WHERE kms_id=%s LIMIT 1;", (kms_id,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"buyer not found: kms_id={kms_id}")
    return row


def ensure_buyer_default_address(cur, buyer_user_id: str) -> int:
    cur.execute(
        """
        SELECT address_id FROM user_addresses
        WHERE user_id=%s AND is_default=TRUE
        ORDER BY address_id DESC LIMIT 1;
        """,
        (buyer_user_id,),
    )
    row = cur.fetchone()
    if row:
        return int(row["address_id"])

    cur.execute(
        """
        INSERT INTO user_addresses
          (user_id, label, address_line1, district, province, postal_code, phone, is_default)
        VALUES (%s,'Dorm','KMUTT Dorm A','Thung Khru','Bangkok','10140','0800000000',TRUE)
        RETURNING address_id;
        """,
        (buyer_user_id,),
    )
    return int(cur.fetchone()["address_id"])


# ============================================================
# DB helpers — stores & products  ← ใหม่
# ============================================================

def get_seller_user_id_by_kms(cur, kms_id: str) -> str:
    """คืน user_id ของ seller จาก kms_id"""
    cur.execute("SELECT user_id FROM users WHERE kms_id=%s LIMIT 1;", (kms_id,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"seller not found: kms_id={kms_id}")
    return str(row["user_id"])


def get_store_ids_by_seller(cur, seller_user_id: str) -> List[int]:
    """ดึง store_id ทั้งหมดที่ seller เป็นเจ้าของ"""
    cur.execute(
        "SELECT store_id FROM stores WHERE user_id=%s ORDER BY store_id;",
        (seller_user_id,),
    )
    return [int(r["store_id"]) for r in cur.fetchall()]


def get_store_seller_map(cur, store_ids: Optional[List[int]] = None) -> Dict[int, str]:
    """
    คืน dict  { store_id: seller_user_id }
    ถ้า store_ids=None → ดึงทุก store
    """
    if store_ids:
        cur.execute(
            "SELECT store_id, user_id FROM stores WHERE store_id = ANY(%s) ORDER BY store_id;",
            (store_ids,),
        )
    else:
        cur.execute("SELECT store_id, user_id FROM stores ORDER BY store_id;")
    return {int(r["store_id"]): str(r["user_id"]) for r in cur.fetchall()}


def list_products_for_stores(cur, store_ids: List[int]) -> List[Dict[str, Any]]:
    """ดึง product เฉพาะ store ที่กำหนด"""
    if not store_ids:
        return []
    cur.execute(
        "SELECT product_id, store_id, price FROM products WHERE store_id = ANY(%s) ORDER BY product_id;",
        (store_ids,),
    )
    return cur.fetchall()


def list_products_all(cur) -> List[Dict[str, Any]]:
    cur.execute("SELECT product_id, store_id, price FROM products ORDER BY product_id;")
    return cur.fetchall()


# ============================================================
# DB helpers — campus & order insert
# ============================================================

def get_campus_location_id(cur, zone: str) -> int:
    cur.execute(
        "SELECT campus_location_id FROM campus_locations WHERE zone=%s ORDER BY campus_location_id LIMIT 1;",
        (zone,),
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"no campus_locations found for zone={zone}")
    return int(row["campus_location_id"])


def gen_proposed_at(pid: int, order_date: datetime) -> datetime:
    return order_date + timedelta(days=1, hours=(pid % 5))


def insert_order_item(cur, order_id: int, product_id: int, qty: int, unit_price: float):
    subtotal = round(unit_price * qty, 2)
    cur.execute(
        """
        INSERT INTO order_items
          (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
        VALUES (%s, %s, 'STANDARD', %s, %s, %s);
        """,
        (qty, unit_price, subtotal, order_id, product_id),
    )
    return subtotal


def insert_order_round_uni(
    cur, status, buyer_id, store_id, total_price, addr_id, order_date,
    cancelled_by=None, cancelled_reason=None,
) -> int:
    if status == STATUS_CANCELLED:
        cur.execute(
            """
            INSERT INTO orders (
              status, total_price, delivery_method,
              delivery_address_id, campus_location_id, campus_detail_note,
              order_date, cancelled_at, cancelled_by, cancelled_reason,
              user_id, store_id
            )
            VALUES (%s,%s,%s, %s,NULL,NULL, %s, %s,%s,%s, %s,%s)
            RETURNING order_id;
            """,
            (
                status, total_price, DM_ROUND_UNI, addr_id,
                order_date,
                order_date + timedelta(hours=random.randint(1, 12)),
                cancelled_by, cancelled_reason,
                buyer_id, store_id,
            ),
        )
    else:
        cur.execute(
            """
            INSERT INTO orders (
              status, total_price, delivery_method,
              delivery_address_id, campus_location_id, campus_detail_note,
              order_date, user_id, store_id
            )
            VALUES (%s,%s,%s, %s,NULL,NULL, %s, %s,%s)
            RETURNING order_id;
            """,
            (status, total_price, DM_ROUND_UNI, addr_id, order_date, buyer_id, store_id),
        )
    return int(cur.fetchone()["order_id"])


def insert_order_campus(
    cur, status, buyer_id, store_id, total_price, campus_id, order_date, proposed_at,
    cancelled_by=None, cancelled_reason=None,
) -> int:
    if status in (STATUS_PROPOSED, STATUS_ACCEPTED):
        cur.execute(
            """
            INSERT INTO orders (
              status, total_price, delivery_method,
              delivery_address_id, campus_location_id, campus_detail_note,
              order_date, proposed_at, meeting_location_id, meeting_note,
              user_id, store_id
            )
            VALUES (%s,%s,%s, NULL,%s,%s, %s, %s,%s,%s, %s,%s)
            RETURNING order_id;
            """,
            (
                status, total_price, DM_CAMPUS,
                campus_id, "Meet at Zone (mock)",
                order_date, proposed_at, campus_id, "Mock proposal note",
                buyer_id, store_id,
            ),
        )
    elif status == STATUS_CANCELLED:
        cur.execute(
            """
            INSERT INTO orders (
              status, total_price, delivery_method,
              delivery_address_id, campus_location_id, campus_detail_note,
              order_date, cancelled_at, cancelled_by, cancelled_reason,
              user_id, store_id
            )
            VALUES (%s,%s,%s, NULL,%s,%s, %s, %s,%s,%s, %s,%s)
            RETURNING order_id;
            """,
            (
                status, total_price, DM_CAMPUS,
                campus_id, "Cancelled meetup (mock)",
                order_date,
                order_date + timedelta(hours=random.randint(1, 12)),
                cancelled_by, cancelled_reason,
                buyer_id, store_id,
            ),
        )
    else:
        cur.execute(
            """
            INSERT INTO orders (
              status, total_price, delivery_method,
              delivery_address_id, campus_location_id, campus_detail_note,
              order_date, user_id, store_id
            )
            VALUES (%s,%s,%s, NULL,%s,%s, %s, %s,%s)
            RETURNING order_id;
            """,
            (
                status, total_price, DM_CAMPUS,
                campus_id, "Meet at Zone (mock)",
                order_date, buyer_id, store_id,
            ),
        )
    return int(cur.fetchone()["order_id"])


# ============================================================
# Core: สร้าง order ครบทุก status สำหรับ 1 product
# ============================================================

def create_full_status_set_for_product(
    cur, buyer_id, addr_id, campus_id,
    pid, store_id, unit_price,
    orders_per_product, extra_completed, extra_cancelled,
    date_from, date_to,
):
    created_orders = 0
    created_items  = 0
    dm = DM_ROUND_UNI if (pid % 2 == 0) else DM_CAMPUS

    for _ in range(max(1, orders_per_product)):
        qty   = 1
        total = round(unit_price * qty, 2)

        odate       = random_order_date(date_from, date_to)
        proposed_at = gen_proposed_at(pid, odate)

        if dm == DM_ROUND_UNI:
            for status in (STATUS_PENDING, STATUS_ACCEPTED, STATUS_COMPLETED):
                oid = insert_order_round_uni(cur, status, buyer_id, store_id, total, addr_id, odate)
                insert_order_item(cur, oid, pid, qty, unit_price)
                created_orders += 1; created_items += 1

            oid = insert_order_round_uni(
                cur, STATUS_CANCELLED, buyer_id, store_id, total, addr_id, odate,
                cancelled_by="BUYER", cancelled_reason="Mock cancel for testing",
            )
            insert_order_item(cur, oid, pid, qty, unit_price)
            created_orders += 1; created_items += 1

        else:
            for status in (STATUS_PENDING, STATUS_PROPOSED, STATUS_ACCEPTED, STATUS_COMPLETED):
                oid = insert_order_campus(cur, status, buyer_id, store_id, total, campus_id, odate, proposed_at)
                insert_order_item(cur, oid, pid, qty, unit_price)
                created_orders += 1; created_items += 1

            oid = insert_order_campus(
                cur, STATUS_CANCELLED, buyer_id, store_id, total, campus_id, odate, proposed_at,
                cancelled_by="BUYER", cancelled_reason="Mock cancel for testing",
            )
            insert_order_item(cur, oid, pid, qty, unit_price)
            created_orders += 1; created_items += 1

        # extra completed
        for _ in range(max(0, extra_completed)):
            qty2   = (pid % 3) + 2
            total2 = round(unit_price * qty2, 2)
            odate2 = random_order_date(date_from, date_to)
            pa2    = gen_proposed_at(pid, odate2)
            if dm == DM_ROUND_UNI:
                oid = insert_order_round_uni(cur, STATUS_COMPLETED, buyer_id, store_id, total2, addr_id, odate2)
            else:
                oid = insert_order_campus(cur, STATUS_COMPLETED, buyer_id, store_id, total2, campus_id, odate2, pa2)
            insert_order_item(cur, oid, pid, qty2, unit_price)
            created_orders += 1; created_items += 1

        # extra cancelled
        for _ in range(max(0, extra_cancelled)):
            qty3   = (pid % 2) + 1
            total3 = round(unit_price * qty3, 2)
            odate3 = random_order_date(date_from, date_to)
            pa3    = gen_proposed_at(pid, odate3)
            if dm == DM_ROUND_UNI:
                oid = insert_order_round_uni(
                    cur, STATUS_CANCELLED, buyer_id, store_id, total3, addr_id, odate3,
                    cancelled_by="SELLER", cancelled_reason="Mock seller cancel",
                )
            else:
                oid = insert_order_campus(
                    cur, STATUS_CANCELLED, buyer_id, store_id, total3, campus_id, odate3, pa3,
                    cancelled_by="SELLER", cancelled_reason="Mock seller cancel",
                )
            insert_order_item(cur, oid, pid, qty3, unit_price)
            created_orders += 1; created_items += 1

    return created_orders, created_items


# ============================================================
# Main
# ============================================================

def main():
    args = parse_args()
    if args.seed is not None:
        random.seed(args.seed)

    # ── date range summary ───────────────────────────────────
    if args.date_from and args.date_to:
        print(f"[DATE]  spreading orders {args.date_from.date()} → {args.date_to.date()}")
    else:
        print("[DATE]  no range → all orders use NOW()")

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:

            # ── truncate ─────────────────────────────────────
            if args.truncate:
                cur.execute("TRUNCATE order_items, orders RESTART IDENTITY CASCADE;")
                conn.commit()
                print("[TRUNCATE] orders + order_items cleared")

            # ── resolve target store_ids ─────────────────────
            if args.stores_mode == "all":
                store_seller_map = get_store_seller_map(cur)
                print(f"[STORE]  mode=all → {len(store_seller_map)} stores")
            else:
                target_ids: List[int] = list(args.store_ids)

                if args.seller_kms_id:
                    sel_uid = get_seller_user_id_by_kms(cur, args.seller_kms_id)
                    ids_from_seller = get_store_ids_by_seller(cur, sel_uid)
                    if not ids_from_seller:
                        raise RuntimeError(f"seller {args.seller_kms_id} has no stores")
                    target_ids = list(set(target_ids) | set(ids_from_seller))
                    print(f"[STORE]  seller={args.seller_kms_id} → store_ids={ids_from_seller}")

                if not target_ids:
                    # ไม่ระบุเลย → ทุก store (เหมือน all)
                    store_seller_map = get_store_seller_map(cur)
                    print(f"[STORE]  no filter → {len(store_seller_map)} stores")
                else:
                    store_seller_map = get_store_seller_map(cur, target_ids)
                    missing = set(target_ids) - set(store_seller_map.keys())
                    if missing:
                        print(f"[WARN]  store_ids not found: {sorted(missing)}")
                    print(f"[STORE]  target store_ids={sorted(store_seller_map.keys())}")

            if not store_seller_map:
                raise RuntimeError("no stores to process")

            all_store_ids = list(store_seller_map.keys())

            # ── products ─────────────────────────────────────
            products = list_products_for_stores(cur, all_store_ids)
            if not products:
                raise RuntimeError(f"no products found for stores {all_store_ids}")

            # ── campus ───────────────────────────────────────
            campus_id = get_campus_location_id(cur, args.campus_zone)

            # ── buyers ───────────────────────────────────────
            buyers = (
                get_buyers_all(cur)
                if args.buyers_mode == "all"
                else [get_buyer_one(cur, args.buyer_kms_id)]
            )
            if not buyers:
                raise RuntimeError("no buyers found")
            if args.max_buyers > 0:
                buyers = buyers[: args.max_buyers]

            print(f"[BUYER]  count={len(buyers)}")
            print(f"[SELF]   no_self_purchase={args.no_self_purchase}")

            total_orders = 0
            total_items  = 0
            total_skipped_products = 0

            for b in buyers:
                buyer_uid = str(b["user_id"])
                buyer_kms = str(b["kms_id"])
                addr_id   = ensure_buyer_default_address(cur, buyer_uid)

                # กรอง product ที่ buyer ไม่ใช่เจ้าของ store (no_self_purchase)
                buyer_products = list(products)
                if args.no_self_purchase:
                    filtered = []
                    skipped  = 0
                    for p in buyer_products:
                        sid = int(p["store_id"])
                        seller_uid = store_seller_map.get(sid)
                        if seller_uid and seller_uid == buyer_uid:
                            skipped += 1
                        else:
                            filtered.append(p)
                    if skipped:
                        print(f"  [SKIP]  buyer={buyer_kms} skipped {skipped} product(s) "
                              f"(self-owned store)")
                        total_skipped_products += skipped
                    buyer_products = filtered

                if not buyer_products:
                    print(f"  [SKIP]  buyer={buyer_kms} — no eligible products (all self-owned)")
                    continue

                if args.shuffle_products:
                    random.shuffle(buyer_products)
                if args.max_products_per_buyer > 0:
                    buyer_products = buyer_products[: args.max_products_per_buyer]

                b_orders = b_items = 0
                for p in buyer_products:
                    co, ci = create_full_status_set_for_product(
                        cur=cur,
                        buyer_id=buyer_uid,
                        addr_id=addr_id,
                        campus_id=campus_id,
                        pid=int(p["product_id"]),
                        store_id=int(p["store_id"]),
                        unit_price=float(p["price"]),
                        orders_per_product=args.orders_per_product,
                        extra_completed=args.extra_completed,
                        extra_cancelled=args.extra_cancelled,
                        date_from=args.date_from,
                        date_to=args.date_to,
                    )
                    b_orders += co
                    b_items  += ci

                conn.commit()
                total_orders += b_orders
                total_items  += b_items
                print(f"  [OK]    buyer={buyer_kms} orders={b_orders} items={b_items}")

            print("─" * 55)
            print(f"[DONE]  total_orders={total_orders}  total_items={total_items}")
            print(f"        buyers={len(buyers)}  "
                  f"skipped_products(self)={total_skipped_products}")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()