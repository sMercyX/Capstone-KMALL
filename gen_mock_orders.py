#!/usr/bin/env python3
"""
KMALL mock orders generator — with date-range spreading
--------------------------------------------------------
ใหม่: --date-from / --date-to
  กำหนดช่วงเวลาที่ order_date จะถูก random กระจายไป
  ถ้าไม่ส่ง = ใช้ปัจจุบัน (พฤติกรรมเดิม)

ตัวอย่าง:
  รายวัน (ดูกราฟในเดือนนี้):
    --date-from 2026-03-01 --date-to 2026-03-31

  รายเดือน (6 เดือนย้อนหลัง):
    --date-from 2025-10-01 --date-to 2026-03-31

  รายปี (3 ปี):
    --date-from 2024-01-01 --date-to 2026-12-31
"""

import os
import argparse
import random
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone

import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgres://postgres:postgres%2F25@localhost:5555/kmall_db?sslmode=disable",
)

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

    buyers_mode: str
    buyer_kms_id: str
    campus_zone: str

    orders_per_product: int
    extra_completed: int
    extra_cancelled: int

    max_buyers: int
    max_products_per_buyer: int
    shuffle_products: bool

    # ใหม่
    date_from: Optional[datetime]
    date_to:   Optional[datetime]


def parse_args() -> Args:
    ap = argparse.ArgumentParser(
        description="KMALL mock orders generator (orders + order_items, date-range aware)"
    )

    ap.add_argument("--truncate",          action="store_true")
    ap.add_argument("--seed",              type=int, default=None)
    ap.add_argument("--buyers-mode",       choices=["one","all"], default="one")
    ap.add_argument("--buyer-kms-id",      type=str, default="dev-buyer-1")
    ap.add_argument("--campus-zone",       type=str, default="North")
    ap.add_argument("--orders-per-product",type=int, default=1)
    ap.add_argument("--extra-completed",   type=int, default=1)
    ap.add_argument("--extra-cancelled",   type=int, default=1)
    ap.add_argument("--max-buyers",        type=int, default=0)
    ap.add_argument("--max-products-per-buyer", type=int, default=0)
    ap.add_argument("--shuffle-products",  action="store_true")

    # ── date range ──────────────────────────────────────────
    ap.add_argument(
        "--date-from",
        type=str,
        default=None,
        help="วันเริ่ม order_date  รูปแบบ YYYY-MM-DD  (default = now)",
    )
    ap.add_argument(
        "--date-to",
        type=str,
        default=None,
        help="วันสุดท้าย order_date  รูปแบบ YYYY-MM-DD  (default = now)",
    )

    ns = ap.parse_args()

    def parse_date(s: Optional[str]) -> Optional[datetime]:
        if s is None:
            return None
        return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    return Args(
        truncate=ns.truncate,
        seed=ns.seed,
        buyers_mode=ns.buyers_mode,
        buyer_kms_id=ns.buyer_kms_id,
        campus_zone=ns.campus_zone,
        orders_per_product=ns.orders_per_product,
        extra_completed=ns.extra_completed,
        extra_cancelled=ns.extra_cancelled,
        max_buyers=ns.max_buyers,
        max_products_per_buyer=ns.max_products_per_buyer,
        shuffle_products=ns.shuffle_products,
        date_from=parse_date(ns.date_from),
        date_to=parse_date(ns.date_to),
    )


# ============================================================
# Date helper — สุ่ม datetime ในช่วงที่กำหนด
# ============================================================

def random_order_date(date_from: Optional[datetime], date_to: Optional[datetime]) -> datetime:
    """
    ถ้าไม่ระบุ date_from/date_to → คืน NOW() (พฤติกรรมเดิม)
    ถ้าระบุ → สุ่ม datetime สม่ำเสมอในช่วง [date_from, date_to]
    """
    now = datetime.now(timezone.utc)
    if date_from is None or date_to is None:
        return now
    if date_to < date_from:
        raise ValueError("--date-to ต้องมากกว่าหรือเท่ากับ --date-from")

    delta_secs = int((date_to - date_from).total_seconds())
    return date_from + timedelta(seconds=random.randint(0, delta_secs))


# ============================================================
# DB helpers (เหมือนเดิม ยกเว้น insert รับ order_date เพิ่ม)
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


def get_campus_location_id(cur, zone: str) -> int:
    cur.execute(
        "SELECT campus_location_id FROM campus_locations WHERE zone=%s ORDER BY campus_location_id LIMIT 1;",
        (zone,),
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"no campus_locations found for zone={zone}")
    return int(row["campus_location_id"])


def list_products(cur) -> List[Dict[str, Any]]:
    cur.execute("SELECT product_id, store_id, price FROM products ORDER BY product_id;")
    return cur.fetchall()


def gen_proposed_at(pid: int, order_date: datetime) -> datetime:
    """proposed_at = order_date + 1 วัน + (pid % 5) ชั่วโมง"""
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
    cur,
    status: str,
    buyer_id: str,
    store_id: int,
    total_price: float,
    addr_id: int,
    order_date: datetime,                  # ← ใหม่
    cancelled_by: Optional[str] = None,
    cancelled_reason: Optional[str] = None,
) -> int:
    if status == STATUS_CANCELLED:
        cur.execute(
            """
            INSERT INTO orders (
              status, total_price, delivery_method,
              delivery_address_id, campus_location_id, campus_detail_note,
              order_date,
              cancelled_at, cancelled_by, cancelled_reason,
              user_id, store_id
            )
            VALUES (%s,%s,%s, %s,NULL,NULL, %s, %s,%s,%s, %s,%s)
            RETURNING order_id;
            """,
            (
                status, total_price, DM_ROUND_UNI,
                addr_id,
                order_date,
                order_date + timedelta(hours=random.randint(1, 12)),
                cancelled_by, cancelled_reason,
                buyer_id, store_id,
            ),
        )
        return int(cur.fetchone()["order_id"])

    cur.execute(
        """
        INSERT INTO orders (
          status, total_price, delivery_method,
          delivery_address_id, campus_location_id, campus_detail_note,
          order_date,
          user_id, store_id
        )
        VALUES (%s,%s,%s, %s,NULL,NULL, %s, %s,%s)
        RETURNING order_id;
        """,
        (status, total_price, DM_ROUND_UNI, addr_id, order_date, buyer_id, store_id),
    )
    return int(cur.fetchone()["order_id"])


def insert_order_campus(
    cur,
    status: str,
    buyer_id: str,
    store_id: int,
    total_price: float,
    campus_id: int,
    order_date: datetime,                  # ← ใหม่
    proposed_at: datetime,
    cancelled_by: Optional[str] = None,
    cancelled_reason: Optional[str] = None,
) -> int:
    if status in (STATUS_PROPOSED, STATUS_ACCEPTED):
        cur.execute(
            """
            INSERT INTO orders (
              status, total_price, delivery_method,
              delivery_address_id, campus_location_id, campus_detail_note,
              order_date,
              proposed_at, meeting_location_id, meeting_note,
              user_id, store_id
            )
            VALUES (%s,%s,%s, NULL,%s,%s, %s, %s,%s,%s, %s,%s)
            RETURNING order_id;
            """,
            (
                status, total_price, DM_CAMPUS,
                campus_id, "Meet at Zone (mock)",
                order_date,
                proposed_at, campus_id, "Mock proposal note",
                buyer_id, store_id,
            ),
        )
        return int(cur.fetchone()["order_id"])

    if status == STATUS_CANCELLED:
        cur.execute(
            """
            INSERT INTO orders (
              status, total_price, delivery_method,
              delivery_address_id, campus_location_id, campus_detail_note,
              order_date,
              cancelled_at, cancelled_by, cancelled_reason,
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
        return int(cur.fetchone()["order_id"])

    cur.execute(
        """
        INSERT INTO orders (
          status, total_price, delivery_method,
          delivery_address_id, campus_location_id, campus_detail_note,
          order_date,
          user_id, store_id
        )
        VALUES (%s,%s,%s, NULL,%s,%s, %s, %s,%s)
        RETURNING order_id;
        """,
        (status, total_price, DM_CAMPUS, campus_id, "Meet at Zone (mock)", order_date, buyer_id, store_id),
    )
    return int(cur.fetchone()["order_id"])


# ============================================================
# Core: สร้าง order ครบทุก status สำหรับ 1 product
# ============================================================

def create_full_status_set_for_product(
    cur,
    buyer_id: str,
    addr_id: int,
    campus_id: int,
    pid: int,
    store_id: int,
    unit_price: float,
    orders_per_product: int,
    extra_completed: int,
    extra_cancelled: int,
    date_from: Optional[datetime],   # ← ใหม่
    date_to:   Optional[datetime],   # ← ใหม่
):
    created_orders = 0
    created_items  = 0

    dm = DM_ROUND_UNI if (pid % 2 == 0) else DM_CAMPUS

    for _ in range(max(1, orders_per_product)):
        qty   = 1
        total = round(unit_price * qty, 2)

        # สุ่ม order_date ใหม่ต่อแต่ละ loop
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
            qty2  = (pid % 3) + 2
            total2 = round(unit_price * qty2, 2)
            odate2 = random_order_date(date_from, date_to)
            proposed_at2 = gen_proposed_at(pid, odate2)
            if dm == DM_ROUND_UNI:
                oid = insert_order_round_uni(cur, STATUS_COMPLETED, buyer_id, store_id, total2, addr_id, odate2)
            else:
                oid = insert_order_campus(cur, STATUS_COMPLETED, buyer_id, store_id, total2, campus_id, odate2, proposed_at2)
            insert_order_item(cur, oid, pid, qty2, unit_price)
            created_orders += 1; created_items += 1

        # extra cancelled
        for _ in range(max(0, extra_cancelled)):
            qty3  = (pid % 2) + 1
            total3 = round(unit_price * qty3, 2)
            odate3 = random_order_date(date_from, date_to)
            proposed_at3 = gen_proposed_at(pid, odate3)
            if dm == DM_ROUND_UNI:
                oid = insert_order_round_uni(
                    cur, STATUS_CANCELLED, buyer_id, store_id, total3, addr_id, odate3,
                    cancelled_by="SELLER", cancelled_reason="Mock seller cancel",
                )
            else:
                oid = insert_order_campus(
                    cur, STATUS_CANCELLED, buyer_id, store_id, total3, campus_id, odate3, proposed_at3,
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

    # แสดง date range ที่ใช้
    if args.date_from and args.date_to:
        print(f"[DATE] spreading orders from {args.date_from.date()} to {args.date_to.date()}")
    else:
        print("[DATE] no date range set → all orders use NOW()")

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if args.truncate:
                cur.execute("TRUNCATE order_items, orders RESTART IDENTITY CASCADE;")
                conn.commit()
                print("[TRUNCATE] orders + order_items cleared")

            campus_id = get_campus_location_id(cur, args.campus_zone)
            products  = list_products(cur)
            if not products:
                raise RuntimeError("no products found")

            buyers = get_buyers_all(cur) if args.buyers_mode == "all" else [get_buyer_one(cur, args.buyer_kms_id)]
            if not buyers:
                raise RuntimeError("no buyers found")
            if args.max_buyers > 0:
                buyers = buyers[: args.max_buyers]

            total_orders = 0
            total_items  = 0

            for b in buyers:
                buyer_id  = str(b["user_id"])
                buyer_kms = str(b["kms_id"])
                addr_id   = ensure_buyer_default_address(cur, buyer_id)

                buyer_products = list(products)
                if args.shuffle_products:
                    random.shuffle(buyer_products)
                if args.max_products_per_buyer > 0:
                    buyer_products = buyer_products[: args.max_products_per_buyer]

                b_orders = b_items = 0

                for p in buyer_products:
                    co, ci = create_full_status_set_for_product(
                        cur=cur,
                        buyer_id=buyer_id,
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
                    b_orders += co; b_items += ci

                conn.commit()
                total_orders += b_orders
                total_items  += b_items
                print(f"[OK] buyer={buyer_kms} orders={b_orders} items={b_items}")

            print(f"[DONE] total_orders={total_orders} total_items={total_items} buyers={len(buyers)}")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()