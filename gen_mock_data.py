#!/usr/bin/env python3
"""
KMALL mock data generator — users / stores / products (+ optional embeddings)
─────────────────────────────────────────────────────────────────────────────
ใหม่:
  --categories food,clothing,handmade
      กรอง main category ที่จะสร้าง product
      (ค่าว่าง = ทุก category)

  --seller-kms-ids mock-seller-1,mock-seller-2
      เลือก seller เฉพาะคนที่ระบุ (ต้องมีอยู่ใน DB แล้ว)
      ถ้าไม่ระบุ = สร้าง seller ใหม่ตาม --sellers

  --sellers-mode existing
      existing = ใช้ seller ที่มีใน DB ทั้งหมด (ไม่สร้างใหม่)
      new      = สร้าง seller ใหม่เสมอ (default เดิม)

EXAMPLES
────────
# สร้างทุกอย่างใหม่ ทุก category
python gen_mock_data.py --sellers 5 --buyers 20 --products 100

# เฉพาะ food category
python gen_mock_data.py --sellers 3 --buyers 10 --products 50 --categories food

# หลาย category
python gen_mock_data.py --sellers 5 --buyers 20 --products 100 --categories food,handmade

# ระบุ seller ที่จะเป็นคนสร้าง store/product
python gen_mock_data.py \\
  --seller-kms-ids mock-seller-1,mock-seller-3 \\
  --buyers 20 --products 80 --categories clothing

# ใช้ seller ที่มีใน DB ทั้งหมด (ไม่สร้างใหม่)
python gen_mock_data.py \\
  --sellers-mode existing \\
  --buyers 15 --products 60 --categories food,clothing

# ผสม: ระบุ seller + กรอง category + embeddings
python gen_mock_data.py \\
  --seller-kms-ids mock-seller-2,mock-seller-4 \\
  --buyers 10 --products 40 \\
  --categories handmade \\
  --with-embeddings --seed 42
"""

import os
import json
import time
import random
import argparse
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Any, Dict, Set

import requests
import psycopg2
from psycopg2.extras import RealDictCursor

# =============================
# Config
# =============================
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgres://postgres:postgres%2F25@localhost:5555/kmall_db?sslmode=disable",
)
OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "nomic-embed-text")
EMBED_DIM    = int(os.getenv("EMBED_DIM", "768"))

# ── valid main category slugs ────────────────────────────────────────────────
# map ชื่อย่อที่ user พิมพ์ → slug จริงใน DB
MAIN_CATEGORY_ALIASES: Dict[str, str] = {
    "food":     "food",
    "clothing": "clothing",
    "handmade": "handmade-products",
    "handmade-products": "handmade-products",
}


# =============================
# Helpers
# =============================
def rand_bool(p_true: float = 0.5) -> bool:
    return random.random() < p_true


def pick(xs):
    return random.choice(xs)


def fetch_scalar(row: Any, key: str):
    if row is None:
        return None
    if isinstance(row, dict):
        return row.get(key)
    return row[0]


def ensure_embed_dim(vec: list, dim: int) -> list:
    if not isinstance(vec, list):
        raise RuntimeError("embedding is not a list")
    if len(vec) == dim:
        return vec
    if len(vec) > dim:
        return vec[:dim]
    return vec + [0.0] * (dim - len(vec))


def wait_for_ollama(timeout_sec: int = 60) -> None:
    deadline  = time.time() + timeout_sec
    last_err  = None
    while time.time() < deadline:
        try:
            r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            if r.status_code == 200:
                return
            if r.status_code != 404:
                return
            last_err = f"status={r.status_code}"
        except Exception as e:
            last_err = str(e)
        time.sleep(1)
    raise RuntimeError(f"Ollama not reachable within {timeout_sec}s: {last_err}")


def embed_text(text: str, timeout: int = 30, max_retries: int = 5) -> list:
    backoff  = 1.0
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            payload = {"model": OLLAMA_MODEL, "input": text}
            r = requests.post(f"{OLLAMA_URL}/api/embed", json=payload, timeout=timeout)

            if r.status_code == 404:
                payload2 = {"model": OLLAMA_MODEL, "prompt": text}
                r2 = requests.post(f"{OLLAMA_URL}/api/embeddings", json=payload2, timeout=timeout)
                r2.raise_for_status()
                data2 = r2.json()
                vec2  = data2.get("embedding")
                if not isinstance(vec2, list) or not vec2:
                    raise RuntimeError(f"Invalid embeddings response: {json.dumps(data2)[:300]}")
                return ensure_embed_dim(vec2, EMBED_DIM)

            r.raise_for_status()
            data = r.json()
            vec  = None
            if isinstance(data.get("embeddings"), list) and data["embeddings"]:
                vec = data["embeddings"][0]
            elif isinstance(data.get("embedding"), list):
                vec = data["embedding"]
            if not isinstance(vec, list) or not vec:
                raise RuntimeError(f"Invalid embed response: {json.dumps(data)[:300]}")
            return ensure_embed_dim(vec, EMBED_DIM)

        except Exception as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(backoff)
                backoff = min(backoff * 2, 10.0)
                continue
            raise RuntimeError(f"Embedding failed after {max_retries} retries: {last_err}")


def vec_to_pgvector_literal(vec: list) -> str:
    return "[" + ",".join(f"{float(x):.8f}" for x in vec) + "]"


def apply_weight(vec: list, w: float) -> list:
    return [float(x) * float(w) for x in vec]


def normalize_weights(wn: float, wd: float, wc: float) -> Tuple[float, float, float]:
    s = float(wn) + float(wd) + float(wc)
    if s <= 0:
        return 1.0, 0.0, 0.0
    return wn / s, wd / s, wc / s


# =============================
# Data templates
# =============================
FOOD_NAMES     = ["Chocolate Brownie","Butter Croissant","Iced Latte","Mixed Berry Smoothie",
                  "Thai Milk Tea","Matcha Latte","Strawberry Cheesecake","Banana Muffin",
                  "Cold Brew Coffee","Lemon Soda"]
CLOTHING_NAMES = ["KMUTT Tee","Minimal Black T-Shirt","Oversized Hoodie","Windbreaker Jacket",
                  "Campus Polo Shirt","Jogger Pants","Denim Jacket","Beanie Hat"]
HANDMADE_NAMES = ["Acrylic Keychain","Cute Cat Keychain","Handmade Bracelet","Mini Woven Bag",
                  "Crochet Pouch","Canvas Tote Bag","Knitted Coaster Set","Sticker Pack"]

BEVERAGE_NAMES      = ["Iced Latte","Cold Brew Coffee","Matcha Latte","Thai Milk Tea",
                        "Mixed Berry Smoothie","Lemon Soda"]
SNACK_DESSERT_NAMES = ["Chocolate Brownie","Butter Croissant","Strawberry Cheesecake","Banana Muffin"]
TOPS_NAMES          = ["KMUTT Tee","Minimal Black T-Shirt","Campus Polo Shirt","Graphic Tee"]
OUTERWEAR_NAMES     = ["Oversized Hoodie","Windbreaker Jacket","Denim Jacket","Black Zip Hoodie"]
KEYCHAIN_NAMES      = ["Acrylic Keychain","Cute Cat Keychain"]
TEXTILE_NAMES       = ["Canvas Tote Bag","Knitted Coaster Set","Crochet Pouch","Mini Woven Bag"]

CATEGORY_NAME_POOLS: Dict[str, List[str]] = {
    "single-dish-meals":   ["Pad Kra Pao","Fried Rice","Hainanese Chicken Rice","Tom Yum Noodles",
                             "Green Curry Rice","Pork Basil Rice","Chicken Teriyaki Rice","Veggie Bento"],
    "snacks-desserts":     SNACK_DESSERT_NAMES,
    "beverages":           BEVERAGE_NAMES,
    "healthy-food":        ["Chicken Breast Salad","Greek Yogurt Bowl","Oatmeal Cup","Tuna Sandwich",
                             "Protein Smoothie","Fruit Salad"],
    "fruits-fresh-produce":["Banana","Apple","Orange","Grapes","Strawberries","Avocado",
                             "Cherry Tomato","Mixed Fruit Box"],
    "tops":                TOPS_NAMES,
    "pants":               ["Jogger Pants","Chino Pants","Cargo Pants","Denim Jeans","Shorts"],
    "skirts-dresses":      ["Pleated Skirt","Denim Skirt","Midi Skirt","Casual Dress","Summer Dress"],
    "outerwear-jackets":   OUTERWEAR_NAMES,
    "unisex-clothing":     ["Unisex Tee","Unisex Hoodie","Unisex Jacket","Unisex Shorts"],
    "secondhand-vintage":  ["Vintage Tee","Second-hand Jacket","Vintage Jeans","Retro Hoodie"],
    "university-uniforms": ["University Uniform Shirt","University Uniform Skirt",
                             "University Belt","KMUTT Uniform Set"],
    "accessories":         ["Canvas Tote Bag","Mini Woven Bag","Handmade Bracelet","Crochet Pouch"],
    "art-artwork":         ["Art Print","Mini Painting","Sticker Pack","Postcard Set"],
    "home-decor":          ["Knitted Coaster Set","Candle Holder","Mini Vase","Wall Decor"],
    "textile-knitting":    TEXTILE_NAMES,
    "keychains":           KEYCHAIN_NAMES,
    "gifts-custom-orders": ["Custom Name Bracelet","Gift Box Set","Custom Tote Bag","Custom Sticker Pack"],
}

ADJ       = ["Minimal","Cute","Premium","Handmade","Local","Limited","Classic","Fresh"]
DESC_BITS = ["perfect for daily use","made with care","popular among students",
             "budget-friendly","high quality materials","limited batch","great as a gift"]
MATERIALS = ["cotton","polyester","acrylic","canvas","rubber","paper","mixed"]
COLORS    = ["black","white","navy","pink","green","brown","cream"]
SIZES     = ["XS","S","M","L","XL"]

ROUND_UNI_BASE_FEE = 15.00   # ค่า base fee เมื่อ delivery_round_university_enabled = TRUE


# =============================
# Args
# =============================
@dataclass
class Args:
    # users
    sellers: int
    buyers: int
    admins: int
    sellers_mode: str               # "new" | "existing"
    seller_kms_ids: List[str]       # ← ใหม่

    # products
    products: int
    images_per_product: int
    categories: List[str]           # ← ใหม่ (main category slugs)

    # embeddings
    with_embeddings: bool
    batch_size: int
    sleep_sec: float
    seed: Optional[int]
    w_name: float
    w_desc: float
    w_category: float


def parse_args() -> Args:
    ap = argparse.ArgumentParser(
        description="KMALL mock data generator (users / stores / products + optional embeddings)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # ── users ─────────────────────────────────────────────────
    ap.add_argument("--sellers",      type=int, default=10,
                    help="จำนวน seller ที่จะสร้าง (ใช้เมื่อ --sellers-mode new)")
    ap.add_argument("--buyers",       type=int, default=30)
    ap.add_argument("--admins",       type=int, default=1)
    ap.add_argument("--sellers-mode", choices=["new","existing"], default="new",
                    help="new=สร้าง seller ใหม่, existing=ใช้ seller ที่มีใน DB (ไม่ระบุ --sellers)")
    ap.add_argument("--seller-kms-ids", type=str, default="",
                    help="kms_id ของ seller ที่ต้องการ คั่นด้วย comma เช่น mock-seller-1,mock-seller-3")

    # ── products ─────────────────────────────────────────────
    ap.add_argument("--products",           type=int, default=200)
    ap.add_argument("--images-per-product", type=int, default=2)
    ap.add_argument("--categories",         type=str, default="",
                    help="main category ที่ต้องการ คั่นด้วย comma: food,clothing,handmade  (ว่าง=ทุก category)")

    # ── embeddings ────────────────────────────────────────────
    ap.add_argument("--with-embeddings", action="store_true")
    ap.add_argument("--batch-size",      type=int,   default=50)
    ap.add_argument("--sleep-sec",       type=float, default=0.0)
    ap.add_argument("--seed",            type=int,   default=None)
    ap.add_argument("--w-name",          type=float, default=1.0)
    ap.add_argument("--w-desc",          type=float, default=1.0)
    ap.add_argument("--w-category",      type=float, default=1.0)

    ns = ap.parse_args()

    def parse_list(s: str) -> List[str]:
        return [x.strip() for x in s.split(",") if x.strip()]

    # แปลง category aliases → slug จริง
    raw_cats = parse_list(ns.categories)
    resolved_cats: List[str] = []
    for c in raw_cats:
        slug = MAIN_CATEGORY_ALIASES.get(c.lower())
        if slug is None:
            ap.error(f"ไม่รู้จัก category '{c}'  ใช้: {', '.join(MAIN_CATEGORY_ALIASES.keys())}")
        resolved_cats.append(slug)
    # deduplicate แต่รักษาลำดับ
    seen: Set[str] = set()
    unique_cats = [x for x in resolved_cats if not (x in seen or seen.add(x))]

    return Args(
        sellers=ns.sellers,
        buyers=ns.buyers,
        admins=ns.admins,
        sellers_mode=ns.sellers_mode,
        seller_kms_ids=parse_list(ns.seller_kms_ids),
        products=ns.products,
        images_per_product=ns.images_per_product,
        categories=unique_cats,
        with_embeddings=ns.with_embeddings,
        batch_size=ns.batch_size,
        sleep_sec=ns.sleep_sec,
        seed=ns.seed,
        w_name=ns.w_name,
        w_desc=ns.w_desc,
        w_category=ns.w_category,
    )


# =============================
# DB — roles & users
# =============================
def ensure_roles(cur):
    cur.execute(
        """
        INSERT INTO roles (role_name, role_desc) VALUES
          ('buyer',  'Default role for all users who can purchase products'),
          ('seller', 'Role for users who can sell products'),
          ('admin',  'System administrator with full permissions')
        ON CONFLICT (role_name) DO NOTHING;
        """
    )


def get_role_id(cur, role_name: str) -> int:
    cur.execute("SELECT role_id FROM roles WHERE role_name=%s;", (role_name,))
    row = cur.fetchone()
    rid = fetch_scalar(row, "role_id")
    if rid is None:
        raise RuntimeError(f"role not found: {role_name}")
    return int(rid)


def create_user(cur, kms_id: str, email: str, display_name: str) -> str:
    cur.execute(
        """
        INSERT INTO users (kms_id, email, display_name)
        VALUES (%s, %s, %s)
        ON CONFLICT (kms_id) DO UPDATE
          SET email = EXCLUDED.email,
              display_name = EXCLUDED.display_name
        RETURNING user_id;
        """,
        (kms_id, email, display_name),
    )
    row = cur.fetchone()
    uid = fetch_scalar(row, "user_id")
    if uid is None:
        raise RuntimeError("create_user: user_id is NULL")
    return str(uid)


def add_user_role(cur, user_id: str, role_id: int):
    cur.execute(
        """
        INSERT INTO user_roles (user_id, role_id)
        VALUES (%s, %s)
        ON CONFLICT DO NOTHING;
        """,
        (user_id, role_id),
    )


def get_existing_sellers(cur) -> List[Dict[str, Any]]:
    """ดึง seller ที่มีอยู่ใน DB ทั้งหมด"""
    cur.execute(
        """
        SELECT DISTINCT u.user_id, u.kms_id, u.display_name
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.role_name = 'seller'
        ORDER BY u.kms_id;
        """
    )
    return cur.fetchall()


def get_sellers_by_kms_ids(cur, kms_ids: List[str]) -> List[Dict[str, Any]]:
    """ดึง seller ตาม kms_id ที่ระบุ"""
    cur.execute(
        """
        SELECT DISTINCT u.user_id, u.kms_id, u.display_name
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.role_name = 'seller'
          AND u.kms_id = ANY(%s)
        ORDER BY u.kms_id;
        """,
        (kms_ids,),
    )
    rows = cur.fetchall()
    found = {r["kms_id"] for r in rows}
    missing = set(kms_ids) - found
    if missing:
        raise RuntimeError(f"seller(s) not found in DB: {sorted(missing)}")
    return rows


# =============================
# DB — stores
# =============================
def get_or_create_store(cur, user_id: str, store_name: str, store_desc: str,
                         round_uni: bool, campus: bool) -> int:
    """
    สร้าง store ใหม่ หรืออัปเดตถ้ามีชื่อซ้ำ
    ปรับให้ตรง constraint: ถ้า round_uni=True ต้องใส่ round_uni_base_fee
    """
    base_fee = ROUND_UNI_BASE_FEE if round_uni else None
    cur.execute(
        """
        INSERT INTO stores (
          store_name, store_desc, profile_url,
          delivery_round_university_enabled, round_uni_base_fee,
          campus_enabled,
          is_active, user_id
        )
        VALUES (%s, %s, NULL, %s, %s, %s, 'YES', %s)
        ON CONFLICT (store_name) DO UPDATE
          SET store_desc  = EXCLUDED.store_desc,
              delivery_round_university_enabled = EXCLUDED.delivery_round_university_enabled,
              round_uni_base_fee = EXCLUDED.round_uni_base_fee,
              campus_enabled = EXCLUDED.campus_enabled,
              is_active = 'YES',
              user_id   = EXCLUDED.user_id
        RETURNING store_id;
        """,
        (store_name, store_desc, round_uni, base_fee, campus, user_id),
    )
    row = cur.fetchone()
    sid = fetch_scalar(row, "store_id")
    if sid is None:
        raise RuntimeError("get_or_create_store: store_id is NULL")
    return int(sid)


def add_store_primary_image(cur, store_id: int):
    cur.execute(
        """
        INSERT INTO store_images (store_id, image_url, sort_order, is_primary)
        VALUES (%s, %s, 1, TRUE)
        ON CONFLICT (store_id, sort_order) DO UPDATE
          SET image_url  = EXCLUDED.image_url,
              is_primary = TRUE;
        """,
        (store_id, f"/uploads/stores/{store_id}/profile-1.jpg"),
    )


# =============================
# DB — categories
# =============================
def list_subcategories(cur, parent_slugs: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    ดึง subcategory (parent_id IS NOT NULL)
    ถ้า parent_slugs ระบุ → กรองเฉพาะ main category ที่ต้องการ
    """
    if parent_slugs:
        cur.execute(
            """
            SELECT
              c.category_id,
              c.name,
              c.slug,
              p.category_id AS parent_id,
              p.name        AS parent_name,
              p.slug        AS parent_slug
            FROM categories c
            JOIN categories p ON p.category_id = c.parent_id
            WHERE c.parent_id IS NOT NULL
              AND c.is_active = 'YES'
              AND p.is_active = 'YES'
              AND p.slug = ANY(%s)
            ORDER BY p.slug, c.category_id;
            """,
            (parent_slugs,),
        )
    else:
        cur.execute(
            """
            SELECT
              c.category_id,
              c.name,
              c.slug,
              p.category_id AS parent_id,
              p.name        AS parent_name,
              p.slug        AS parent_slug
            FROM categories c
            JOIN categories p ON p.category_id = c.parent_id
            WHERE c.parent_id IS NOT NULL
              AND c.is_active = 'YES'
              AND p.is_active = 'YES'
            ORDER BY p.slug, c.category_id;
            """
        )
    return cur.fetchall()


# =============================
# DB — products & attributes
# =============================
def create_or_update_product(cur, store_id: int, category_id: int,
                              name: str, desc: str, price: float, image_url: str) -> int:
    cur.execute(
        """
        INSERT INTO products
          (name, product_desc, price, image_url, product_type, is_active, store_id, category_id)
        VALUES (%s, %s, %s, %s, 'PREORDER', 'YES', %s, %s)
        ON CONFLICT (name) DO UPDATE
          SET product_desc = EXCLUDED.product_desc,
              price        = EXCLUDED.price,
              image_url    = EXCLUDED.image_url,
              product_type = 'PREORDER',
              is_active    = 'YES',
              store_id     = EXCLUDED.store_id,
              category_id  = EXCLUDED.category_id
        RETURNING product_id;
        """,
        (name, desc, price, image_url, store_id, category_id),
    )
    row = cur.fetchone()
    pid = fetch_scalar(row, "product_id")
    if pid is None:
        raise RuntimeError("create_or_update_product: product_id is NULL")
    return int(pid)


def mock_product_image_path(sub_slug: str) -> str:
    return f"/uploads/products/mockup/{sub_slug.strip().lower()}/img-1.jpg"


def add_product_primary_image(cur, product_id: int, sub_slug: str):
    path = mock_product_image_path(sub_slug)
    cur.execute(
        """
        INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
        VALUES (%s, %s, 1, TRUE)
        ON CONFLICT (product_id, sort_order) DO UPDATE
          SET image_url  = EXCLUDED.image_url,
              is_primary = TRUE;
        """,
        (product_id, path),
    )


def ensure_attr_key(cur, key_name: str) -> int:
    cur.execute(
        """
        INSERT INTO product_attribute_keys (key_name)
        VALUES (%s)
        ON CONFLICT (key_name) DO UPDATE SET key_name = EXCLUDED.key_name
        RETURNING attr_key_id;
        """,
        (key_name,),
    )
    row = cur.fetchone()
    kid = fetch_scalar(row, "attr_key_id")
    if kid is None:
        raise RuntimeError(f"ensure_attr_key: NULL for {key_name}")
    return int(kid)


def add_attr_value(cur, product_id: int, attr_key_id: int, value_text: str):
    cur.execute(
        """
        INSERT INTO product_attribute_values (product_id, attr_key_id, value_text)
        VALUES (%s, %s, %s)
        ON CONFLICT DO NOTHING;
        """,
        (product_id, attr_key_id, value_text),
    )


def update_split_embeddings(cur, product_id: int,
                             emb_name: str, emb_desc: str, emb_cat: str):
    cur.execute(
        """
        UPDATE products
        SET embedding_name     = %s::vector,
            embedding_desc     = %s::vector,
            embedding_category = %s::vector
        WHERE product_id = %s;
        """,
        (emb_name, emb_desc, emb_cat, product_id),
    )


# =============================
# Generators
# =============================
def category_profile(sub_slug: str, parent_slug: str) -> Dict[str, Any]:
    s = sub_slug.lower()
    p = parent_slug.lower()

    if "beverage"  in s: return {"domain": "food",     "pool": BEVERAGE_NAMES,      "desc_kind": "beverage"}
    if "snack"     in s or "dessert" in s:
                         return {"domain": "food",     "pool": SNACK_DESSERT_NAMES, "desc_kind": "snack"}
    if "top"       in s: return {"domain": "clothing", "pool": TOPS_NAMES,          "desc_kind": "tops"}
    if "outerwear" in s or "jacket" in s:
                         return {"domain": "clothing", "pool": OUTERWEAR_NAMES,     "desc_kind": "outerwear"}
    if "keychain"  in s: return {"domain": "handmade", "pool": KEYCHAIN_NAMES,      "desc_kind": "keychain"}
    if "textile"   in s or "knitting" in s:
                         return {"domain": "handmade", "pool": TEXTILE_NAMES,       "desc_kind": "textile"}

    # fallback ตาม parent
    if p == "food":
        return {"domain": "food",     "pool": FOOD_NAMES,     "desc_kind": "food"}
    if p == "clothing":
        return {"domain": "clothing", "pool": CLOTHING_NAMES, "desc_kind": "clothing"}
    return {"domain": "handmade", "pool": HANDMADE_NAMES, "desc_kind": "handmade"}


def base_name_from_subcat(sub_slug: str, parent_slug: str) -> str:
    pool = CATEGORY_NAME_POOLS.get(sub_slug)
    if pool:
        return pick(pool)
    return pick(category_profile(sub_slug, parent_slug)["pool"])


def gen_desc_by_kind(kind: str) -> str:
    m   = pick(MATERIALS)
    bit = pick(DESC_BITS)
    mapping = {
        "beverage":  f"{pick(ADJ)} drink, {bit}. Served chilled.",
        "snack":     f"{pick(ADJ)} snack/dessert, {bit}. Freshly prepared.",
        "tops":      f"{pick(ADJ)} top, made from {m}, {bit}.",
        "outerwear": f"{pick(ADJ)} outerwear, made from {m}, {bit}.",
        "keychain":  f"{pick(ADJ)} keychain, made from {m}, {bit}.",
        "textile":   f"{pick(ADJ)} textile item, made from {m}, {bit}.",
        "food":      f"{pick(ADJ)} menu item, {bit}. Freshly prepared.",
        "clothing":  f"{pick(ADJ)} apparel, made from {m}, {bit}.",
    }
    return mapping.get(kind, f"{pick(ADJ)} handmade item, made from {m}, {bit}.")


def gen_price(domain: str) -> int:
    if domain == "food":     return random.randint(25,  120)
    if domain == "clothing": return random.randint(99,  799)
    return                          random.randint(29,  399)


# =============================
# Main
# =============================
def main():
    args = parse_args()
    if args.seed is not None:
        random.seed(args.seed)

    if args.with_embeddings:
        wait_for_ollama(timeout_sec=90)

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    created_products: List[Tuple[int, str]] = []

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:

            # ── roles ────────────────────────────────────────
            ensure_roles(cur)
            role_admin  = get_role_id(cur, "admin")
            role_seller = get_role_id(cur, "seller")
            role_buyer  = get_role_id(cur, "buyer")

            # ── attribute keys ───────────────────────────────
            key_color    = ensure_attr_key(cur, "color")
            key_size     = ensure_attr_key(cur, "size")
            key_material = ensure_attr_key(cur, "material")

            # ── subcategories (กรอง main category) ───────────
            parent_filter = args.categories if args.categories else None
            subcats = list_subcategories(cur, parent_filter)
            if not subcats:
                cat_hint = ", ".join(args.categories) if args.categories else "ทั้งหมด"
                raise RuntimeError(
                    f"ไม่พบ subcategory สำหรับ category: {cat_hint}  "
                    f"(ตรวจสอบว่า seed categories แล้ว)"
                )

            print(f"[CAT]   subcategory ที่ใช้ = {len(subcats)} rows"
                  + (f"  (filter: {', '.join(args.categories)})" if args.categories else "  (ทุก category)"))

            # ── admins ───────────────────────────────────────
            admin_ids: List[str] = []
            for i in range(args.admins):
                kms = f"mock-admin-{i+1}"
                uid = create_user(cur, kms, f"{kms}@example.com", f"Mock Admin {i+1}")
                add_user_role(cur, uid, role_admin)
                admin_ids.append(uid)

            # ── buyers ───────────────────────────────────────
            buyer_ids: List[str] = []
            for i in range(args.buyers):
                kms = f"mock-buyer-{i+1}"
                uid = create_user(cur, kms, f"{kms}@example.com", f"Mock Buyer {i+1}")
                add_user_role(cur, uid, role_buyer)
                buyer_ids.append(uid)

            # ── sellers (3 modes) ────────────────────────────
            seller_rows: List[Dict[str, Any]] = []

            if args.seller_kms_ids:
                # mode A: ระบุ kms_id ตรงๆ
                seller_rows = get_sellers_by_kms_ids(cur, args.seller_kms_ids)
                print(f"[SELLER] mode=specified  kms_ids={[r['kms_id'] for r in seller_rows]}")

            elif args.sellers_mode == "existing":
                # mode B: ใช้ seller ทั้งหมดใน DB
                seller_rows = get_existing_sellers(cur)
                if not seller_rows:
                    raise RuntimeError("ไม่มี seller ใน DB  ลอง --sellers-mode new ก่อน")
                print(f"[SELLER] mode=existing  count={len(seller_rows)}")

            else:
                # mode C: สร้างใหม่
                new_ids: List[str] = []
                for i in range(args.sellers):
                    kms = f"mock-seller-{i+1}"
                    uid = create_user(cur, kms, f"{kms}@example.com", f"Mock Seller {i+1}")
                    add_user_role(cur, uid, role_seller)
                    new_ids.append(uid)
                # ดึงกลับเป็น dict format เดียวกัน
                conn.commit()
                seller_rows = get_sellers_by_kms_ids(
                    cur, [f"mock-seller-{i+1}" for i in range(args.sellers)]
                )
                print(f"[SELLER] mode=new  created={len(seller_rows)}")

            conn.commit()
            print(f"[OK]    users — admin={len(admin_ids)} seller={len(seller_rows)} buyer={len(buyer_ids)}")

            # ── stores (1 store ต่อ 1 seller) ────────────────
            stores: List[Dict[str, Any]] = []
            for idx, s in enumerate(seller_rows, start=1):
                seller_uid          = str(s["user_id"])
                seller_kms          = str(s["kms_id"])
                seller_display_name = str(s["display_name"])
                store_name  = f"Store of {seller_display_name}"
                store_desc  = f"Mock store for {seller_display_name} — generated for testing"

                round_uni = rand_bool(0.6)
                campus    = rand_bool(0.6)
                if not (round_uni or campus):
                    campus = True

                st_id = get_or_create_store(cur, seller_uid, store_name, store_desc, round_uni, campus)
                add_store_primary_image(cur, st_id)
                stores.append({"store_id": st_id, "store_name": store_name, "seller_kms": seller_kms})

            conn.commit()
            print(f"[OK]    stores = {len(stores)}")

            if not stores:
                raise RuntimeError("ไม่มี store  ตรวจสอบ seller")

            # ── products ─────────────────────────────────────
            base_per_store = args.products // len(stores)
            extra          = args.products % len(stores)
            global_idx     = 0

            for si, st in enumerate(stores):
                n = base_per_store + (1 if si < extra else 0)
                store_id = st["store_id"]

                for _ in range(n):
                    global_idx += 1
                    cat        = pick(subcats)
                    sub_slug   = cat["slug"]
                    parent_slug = cat["parent_slug"]

                    profile   = category_profile(sub_slug, parent_slug)
                    base      = base_name_from_subcat(sub_slug, parent_slug)
                    domain    = profile["domain"]

                    pname = f"{pick(ADJ)} {base} #{global_idx:06d}-{random.randint(10,99)}"[:100]
                    pdesc = gen_desc_by_kind(profile["desc_kind"])
                    price = gen_price(domain)
                    img_url = mock_product_image_path(sub_slug)

                    pid = create_or_update_product(cur, store_id, cat["category_id"],
                                                   pname, pdesc, price, img_url)
                    add_product_primary_image(cur, pid, sub_slug)

                    add_attr_value(cur, pid, key_material, pick(MATERIALS))
                    add_attr_value(cur, pid, key_color,    pick(COLORS))
                    if domain == "clothing":
                        add_attr_value(cur, pid, key_size, pick(SIZES))

                    created_products.append((pid, pname))

                conn.commit()
                print(f"  [OK]  store_id={store_id} ({st['seller_kms']})  products={n}"
                      + (f"  cat_filter={', '.join(args.categories)}" if args.categories else ""))

            print(f"[OK]    total products created = {len(created_products)}")

        # ── embeddings (อยู่นอก with-cursor block) ───────────
        if args.with_embeddings and created_products:
            wn, wd, wc = normalize_weights(args.w_name, args.w_desc, args.w_category)
            updated = failed = 0

            for i in range(0, len(created_products), args.batch_size):
                batch = created_products[i : i + args.batch_size]
                with conn.cursor() as cur2:
                    for (pid, pname) in batch:
                        try:
                            cur2.execute(
                                """
                                SELECT COALESCE(p.product_desc,''), c.name
                                FROM products p
                                JOIN categories c ON c.category_id = p.category_id
                                WHERE p.product_id = %s;
                                """,
                                (pid,),
                            )
                            row   = cur2.fetchone()
                            pdesc = row[0] if row else ""
                            cname = row[1] if row and row[1] else ""

                            v_name = apply_weight(embed_text(f"Name: {pname}"), wn)
                            v_desc = apply_weight(embed_text(f"Description: {pdesc}"), wd)
                            v_cat  = apply_weight(embed_text(f"Category: {cname}"), wc)

                            update_split_embeddings(
                                cur2, pid,
                                vec_to_pgvector_literal(v_name),
                                vec_to_pgvector_literal(v_desc),
                                vec_to_pgvector_literal(v_cat),
                            )
                            updated += 1
                        except Exception as e:
                            failed += 1
                            print(f"  [WARN] embedding failed product_id={pid}: {e}")

                    conn.commit()
                print(f"  [EMB] batch {i // args.batch_size + 1}: updated={updated} failed={failed}")
                if args.sleep_sec > 0:
                    time.sleep(args.sleep_sec)

            print(f"[OK]    embeddings updated={updated} failed={failed}")

        print("[ALL DONE] mock data generated successfully.")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()