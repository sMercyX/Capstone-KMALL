#!/usr/bin/env python3
import os
import json
import time
import random
import argparse
from dataclasses import dataclass
from typing import List, Optional, Tuple, Any

import requests
import psycopg2
from psycopg2.extras import RealDictCursor

import time
import json
import requests

# =============================
# Config
# =============================
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgres://postgres:postgres%2F25@localhost:5555/kmall_db?sslmode=disable",
)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "nomic-embed-text")
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))

# =============================
# Helpers
# =============================
def rand_bool(p_true: float = 0.5) -> bool:
    return random.random() < p_true


def pick(xs):
    return random.choice(xs)


def fetch_scalar(row: Any, key: str):
    """
    Make fetchone() usable for both RealDictCursor (dict) and normal cursor (tuple/list).
    """
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
    """
    Wait until Ollama is reachable.
    We try endpoints that usually exist across versions.
    """
    deadline = time.time() + timeout_sec
    last_err = None

    while time.time() < deadline:
        try:
            # /api/tags is commonly available
            r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            if r.status_code == 200:
                return
            # Some setups might not expose /api/tags; still treat non-404 as "reachable"
            if r.status_code != 404:
                return
            last_err = f"status={r.status_code}"
        except Exception as e:
            last_err = str(e)

        time.sleep(1)

    raise RuntimeError(f"Ollama not reachable within {timeout_sec}s: {last_err}")


def embed_text(text: str, timeout: int = 30, max_retries: int = 5) -> list:
    backoff = 1.0
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
                vec2 = data2.get("embedding")
                if not isinstance(vec2, list) or not vec2:
                    raise RuntimeError(f"Invalid embeddings response: {json.dumps(data2)[:300]}")
                return ensure_embed_dim(vec2, EMBED_DIM)

            r.raise_for_status()
            data = r.json()

            vec = None
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


def build_embed_text(name: str, desc: str, store: str, category: str) -> str:
    return (
        f"Product: {name}\n"
        f"Description: {desc}\n"
        f"Store: {store}\n"
        f"Category: {category}"
    ).strip()


# =============================
# Data templates
# =============================
FOOD_NAMES = [
    "Chocolate Brownie", "Butter Croissant", "Iced Latte", "Mixed Berry Smoothie",
    "Thai Milk Tea", "Matcha Latte", "Strawberry Cheesecake", "Banana Muffin",
    "Cold Brew Coffee", "Lemon Soda"
]
CLOTHING_NAMES = [
    "KMUTT Tee", "Minimal Black T-Shirt", "Oversized Hoodie", "Windbreaker Jacket",
    "Campus Polo Shirt", "Jogger Pants", "Denim Jacket", "Beanie Hat"
]
HANDMADE_NAMES = [
    "Acrylic Keychain", "Cute Cat Keychain", "Handmade Bracelet", "Mini Woven Bag",
    "Crochet Pouch", "Canvas Tote Bag", "Knitted Coaster Set", "Sticker Pack"
]
CATEGORY_NAME_POOLS = {
  # ===== FOOD =====
  "single-dish-meals": [
    "Pad Kra Pao", "Fried Rice", "Hainanese Chicken Rice", "Tom Yum Noodles",
    "Green Curry Rice", "Pork Basil Rice", "Chicken Teriyaki Rice", "Veggie Bento"
  ],
  "snacks-desserts": [
    "Chocolate Brownie", "Butter Croissant", "Strawberry Cheesecake", "Banana Muffin",
    "Cookie Box", "Donut", "Crepe", "Pancake"
  ],
  "beverages": [
    "Iced Latte", "Cold Brew Coffee", "Thai Milk Tea", "Matcha Latte",
    "Lemon Soda", "Mixed Berry Smoothie"
  ],
  "healthy-food": [
    "Chicken Breast Salad", "Greek Yogurt Bowl", "Oatmeal Cup", "Tuna Sandwich",
    "Protein Smoothie", "Fruit Salad"
  ],
  "fruits-fresh-produce": [
    "Banana", "Apple", "Orange", "Grapes", "Strawberries", "Avocado",
    "Cherry Tomato", "Mixed Fruit Box"
  ],

  # ===== CLOTHING =====
  "tops": [
    "KMUTT Tee", "Minimal Black T-Shirt", "Campus Polo Shirt", "Long Sleeve Shirt",
    "Graphic Tee", "Crop Top"
  ],
  "pants": [
    "Jogger Pants", "Chino Pants", "Cargo Pants", "Denim Jeans", "Shorts"
  ],
  "skirts-dresses": [
    "Pleated Skirt", "Denim Skirt", "Midi Skirt", "Casual Dress", "Summer Dress"
  ],
  "outerwear-jackets": [
    "Windbreaker Jacket", "Denim Jacket", "Hoodie", "Bomber Jacket", "Cardigan"
  ],
  "unisex-clothing": [
    "Unisex Tee", "Unisex Hoodie", "Unisex Jacket", "Unisex Shorts"
  ],
  "secondhand-vintage": [
    "Vintage Tee", "Second-hand Jacket", "Vintage Jeans", "Retro Hoodie"
  ],
  "university-uniforms": [
    "University Uniform Shirt", "University Uniform Skirt", "University Belt",
    "KMUTT Uniform Set"
  ],

  # ===== HANDMADE =====
  "accessories": [
    "Canvas Tote Bag", "Mini Woven Bag", "Handmade Bracelet", "Crochet Pouch"
  ],
  "art-artwork": [
    "Art Print", "Mini Painting", "Sticker Pack", "Postcard Set"
  ],
  "home-decor": [
    "Knitted Coaster Set", "Candle Holder", "Mini Vase", "Wall Decor"
  ],
  "textile-knitting": [
    "Crochet Pouch", "Knitted Coaster Set", "Handmade Scarf", "Crochet Hat"
  ],
  "keychains": [
    "Acrylic Keychain", "Cute Cat Keychain", "Name Keychain", "Resin Keychain"
  ],
  "gifts-custom-orders": [
    "Custom Name Bracelet", "Gift Box Set", "Custom Tote Bag", "Custom Sticker Pack"
  ],
}
ADJ = ["Minimal", "Cute", "Premium", "Handmade", "Local", "Limited", "Classic", "Fresh"]
DESC_BITS = [
    "perfect for daily use", "made with care", "popular among students",
    "budget-friendly", "high quality materials", "limited batch", "great as a gift"
]
MATERIALS = ["cotton", "polyester", "acrylic", "canvas", "rubber", "paper", "mixed"]
COLORS = ["black", "white", "navy", "pink", "green", "brown", "cream"]
SIZES = ["XS", "S", "M", "L", "XL"]
BEVERAGE_NAMES = [
    "Iced Latte", "Cold Brew Coffee", "Matcha Latte", "Thai Milk Tea",
    "Mixed Berry Smoothie", "Lemon Soda"
]
SNACK_DESSERT_NAMES = [
    "Chocolate Brownie", "Butter Croissant", "Strawberry Cheesecake", "Banana Muffin"
]

TOPS_NAMES = ["KMUTT Tee", "Minimal Black T-Shirt", "Campus Polo Shirt", "Graphic Tee"]
OUTERWEAR_NAMES = ["Oversized Hoodie", "Windbreaker Jacket", "Denim Jacket", "Black Zip Hoodie"]

KEYCHAIN_NAMES = ["Acrylic Keychain", "Cute Cat Keychain"]
TEXTILE_NAMES = ["Canvas Tote Bag", "Knitted Coaster Set", "Crochet Pouch", "Mini Woven Bag"]

# =============================
# Args
# =============================
@dataclass
class Args:
    sellers: int
    buyers: int
    admins: int
    products: int
    images_per_product: int
    with_embeddings: bool
    batch_size: int
    sleep_sec: float
    seed: Optional[int]


def parse_args() -> Args:
    ap = argparse.ArgumentParser(description="KMALL mock data generator (users/stores/products + optional embeddings)")
    ap.add_argument("--sellers", type=int, default=10)
    ap.add_argument("--buyers", type=int, default=30)
    ap.add_argument("--admins", type=int, default=1)
    ap.add_argument("--products", type=int, default=200)
    ap.add_argument("--images-per-product", type=int, default=2)
    ap.add_argument("--with-embeddings", action="store_true")
    ap.add_argument("--batch-size", type=int, default=50)
    ap.add_argument("--sleep-sec", type=float, default=0.0)
    ap.add_argument("--seed", type=int, default=None)
    ns = ap.parse_args()
    return Args(
        sellers=ns.sellers,
        buyers=ns.buyers,
        admins=ns.admins,
        products=ns.products,
        images_per_product=ns.images_per_product,
        with_embeddings=ns.with_embeddings,
        batch_size=ns.batch_size,
        sleep_sec=ns.sleep_sec,
        seed=ns.seed,
    )


# =============================
# DB functions
# =============================
def ensure_roles(cur):
    cur.execute(
        """
        INSERT INTO roles (role_name, role_desc)
        VALUES
          ('buyer','Default role for all users who can purchase products'),
          ('seller','Role for users who can sell products'),
          ('admin','System administrator with full permissions')
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


def create_store(cur, user_id: str, store_name: str, store_desc: str, round_uni: bool, campus: bool) -> int:
    cur.execute(
        """
        INSERT INTO stores (
          store_name, store_desc, profile_url,
          delivery_round_university_enabled, campus_enabled,
          is_active, user_id
        )
        VALUES (%s,%s,NULL,%s,%s,'YES',%s)
        ON CONFLICT (store_name) DO UPDATE
          SET store_desc = EXCLUDED.store_desc,
              delivery_round_university_enabled = EXCLUDED.delivery_round_university_enabled,
              campus_enabled = EXCLUDED.campus_enabled,
              is_active = 'YES',
              user_id = EXCLUDED.user_id
        RETURNING store_id;
        """,
        (store_name, store_desc, round_uni, campus, user_id),
    )
    row = cur.fetchone()
    sid = fetch_scalar(row, "store_id")
    if sid is None:
        raise RuntimeError("create_store: store_id is NULL")
    return int(sid)


def add_store_primary_image(cur, store_id: int):
    cur.execute(
        """
        INSERT INTO store_images (store_id, image_url, sort_order, is_primary)
        VALUES (%s, %s, 1, TRUE)
        ON CONFLICT (store_id, sort_order) DO UPDATE
          SET image_url = EXCLUDED.image_url,
              is_primary = TRUE;
        """,
        (store_id, f"/uploads/stores/{store_id}/profile-1.jpg"),
    )


def list_subcategories(cur) -> List[dict]:
    cur.execute(
        """
        SELECT
          c.category_id,
          c.name,
          c.slug,
          p.category_id AS parent_id,
          p.name       AS parent_name,
          p.slug       AS parent_slug
        FROM categories c
        JOIN categories p ON p.category_id = c.parent_id
        WHERE c.parent_id IS NOT NULL
          AND c.is_active='YES'
          AND p.is_active='YES'
        ORDER BY c.category_id;
        """
    )
    return cur.fetchall()


def create_or_update_product(cur, store_id: int, category_id: int, name: str, desc: str, price: float) -> int:
    cur.execute(
        """
        INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
        VALUES (%s,%s,%s,NULL,'YES',%s,%s)
        ON CONFLICT (name) DO UPDATE
          SET product_desc = EXCLUDED.product_desc,
              price = EXCLUDED.price,
              is_active = 'YES',
              store_id = EXCLUDED.store_id,
              category_id = EXCLUDED.category_id
        RETURNING product_id;
        """,
        (name, desc, price, store_id, category_id),
    )
    row = cur.fetchone()
    pid = fetch_scalar(row, "product_id")
    if pid is None:
        raise RuntimeError("create_or_update_product: product_id is NULL")
    return int(pid)


def add_product_images(cur, product_id: int, n: int):
    n = max(1, min(n, 5))
    for i in range(1, n + 1):
        cur.execute(
            """
            INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (product_id, sort_order) DO UPDATE
              SET image_url = EXCLUDED.image_url,
                  is_primary = EXCLUDED.is_primary;
            """,
            (
                product_id,
                f"/uploads/products/{product_id}/img-{i}.jpg",
                i,
                True if i == 1 else False,
            ),
        )


def ensure_attr_key(cur, key_name: str) -> int:
    cur.execute(
        """
        INSERT INTO product_attribute_keys (key_name)
        VALUES (%s)
        ON CONFLICT (key_name) DO UPDATE SET key_name=EXCLUDED.key_name
        RETURNING attr_key_id;
        """,
        (key_name,),
    )
    row = cur.fetchone()
    kid = fetch_scalar(row, "attr_key_id")
    if kid is None:
        raise RuntimeError(f"ensure_attr_key: attr_key_id is NULL for {key_name}")
    return int(kid)


def add_attr_value(cur, product_id: int, attr_key_id: int, value_text: str):
    cur.execute(
        """
        INSERT INTO product_attribute_values (product_id, attr_key_id, value_text)
        VALUES (%s,%s,%s)
        ON CONFLICT DO NOTHING;
        """,
        (product_id, attr_key_id, value_text),
    )


def update_embedding(cur, product_id: int, vec_literal: str):
    cur.execute(
        "UPDATE products SET embedding=%s::vector WHERE product_id=%s;",
        (vec_literal, product_id),
    )

def base_name_from_subcat_slug(sub_slug: str, parent_slug: str) -> str:
    pool = CATEGORY_NAME_POOLS.get(sub_slug)
    if pool:
        return pick(pool)

    # fallback เผื่อ slug ใหม่ในอนาคต
    return base_name_from_domain(domain_from_parent_slug(parent_slug))

# =============================
# Generators
# =============================
def gen_desc(domain: str) -> str:
    m = pick(MATERIALS)
    bit = pick(DESC_BITS)
    if domain == "food":
        return f"{pick(ADJ)} menu item, {bit}. Freshly prepared."
    if domain == "clothing":
        return f"{pick(ADJ)} apparel, made from {m}, {bit}."
    return f"{pick(ADJ)} handmade item, made from {m}, {bit}."


def gen_price(domain: str) -> float:
    if domain == "food":
        return round(random.uniform(25, 120), 2)
    if domain == "clothing":
        return round(random.uniform(99, 799), 2)
    return round(random.uniform(29, 399), 2)


def base_name_from_domain(domain: str) -> str:
    base_pool = FOOD_NAMES if domain == "food" else CLOTHING_NAMES if domain == "clothing" else HANDMADE_NAMES
    return pick(base_pool)


def domain_from_parent_slug(parent_slug: str) -> str:
    s = (parent_slug or "").lower()
    if s == "food":
        return "food"
    if s == "clothing":
        return "clothing"
    if s == "handmade-products":
        return "handmade"
    return "handmade"

def category_profile(cat_slug: str, parent_slug: str) -> dict:
    s = (cat_slug or "").lower()
    p = (parent_slug or "").lower()

    # Food subcategories
    if "beverage" in s:
        return {"domain": "food", "pool": BEVERAGE_NAMES, "desc_kind": "beverage"}
    if "snack" in s or "dessert" in s:
        return {"domain": "food", "pool": SNACK_DESSERT_NAMES, "desc_kind": "snack"}

    # Clothing subcategories
    if "top" in s:
        return {"domain": "clothing", "pool": TOPS_NAMES, "desc_kind": "tops"}
    if "outerwear" in s or "jacket" in s:
        return {"domain": "clothing", "pool": OUTERWEAR_NAMES, "desc_kind": "outerwear"}

    # Handmade subcategories
    if "keychain" in s:
        return {"domain": "handmade", "pool": KEYCHAIN_NAMES, "desc_kind": "keychain"}
    if "textile" in s or "knitting" in s:
        return {"domain": "handmade", "pool": TEXTILE_NAMES, "desc_kind": "textile"}

    # Fallback: ใช้ parent เป็นตัวช่วย ถ้า slug ไม่เข้ากฎ
    if p == "food":
        return {"domain": "food", "pool": FOOD_NAMES, "desc_kind": "food"}
    if p == "clothing":
        return {"domain": "clothing", "pool": CLOTHING_NAMES, "desc_kind": "clothing"}
    if p == "handmade-products":
        return {"domain": "handmade", "pool": HANDMADE_NAMES, "desc_kind": "handmade"}

    return {"domain": "handmade", "pool": HANDMADE_NAMES, "desc_kind": "handmade"}


def gen_desc_by_kind(kind: str) -> str:
    m = pick(MATERIALS)
    bit = pick(DESC_BITS)

    if kind == "beverage":
        return f"{pick(ADJ)} drink, {bit}. Served chilled."
    if kind == "snack":
        return f"{pick(ADJ)} snack/dessert, {bit}. Freshly prepared."
    if kind == "tops":
        return f"{pick(ADJ)} top, made from {m}, {bit}."
    if kind == "outerwear":
        return f"{pick(ADJ)} outerwear, made from {m}, {bit}."
    if kind == "keychain":
        return f"{pick(ADJ)} keychain, made from {m}, {bit}."
    if kind == "textile":
        return f"{pick(ADJ)} textile item, made from {m}, {bit}."

    # fallback
    if kind in ("food",):
        return f"{pick(ADJ)} menu item, {bit}. Freshly prepared."
    if kind in ("clothing",):
        return f"{pick(ADJ)} apparel, made from {m}, {bit}."
    return f"{pick(ADJ)} handmade item, made from {m}, {bit}."

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

    created_products: List[Tuple[int, str, str, str]] = []

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            ensure_roles(cur)
            role_admin = get_role_id(cur, "admin")
            role_seller = get_role_id(cur, "seller")
            role_buyer = get_role_id(cur, "buyer")

            key_color = ensure_attr_key(cur, "color")
            key_size = ensure_attr_key(cur, "size")
            key_material = ensure_attr_key(cur, "material")

            subcats = list_subcategories(cur)
            if not subcats:
                raise RuntimeError("No subcategories found (categories where parent_id IS NOT NULL). Seed categories first.")

            admin_ids: List[str] = []
            seller_ids: List[str] = []
            buyer_ids: List[str] = []

            for i in range(args.admins):
                kms_id = f"mock-admin-{i+1}"
                uid = create_user(cur, kms_id, f"{kms_id}@example.com", f"Mock Admin {i+1}")
                add_user_role(cur, uid, role_admin)
                admin_ids.append(uid)

            for i in range(args.sellers):
                kms_id = f"mock-seller-{i+1}"
                uid = create_user(cur, kms_id, f"{kms_id}@example.com", f"Mock Seller {i+1}")
                add_user_role(cur, uid, role_seller)
                seller_ids.append(uid)

            for i in range(args.buyers):
                kms_id = f"mock-buyer-{i+1}"
                uid = create_user(cur, kms_id, f"{kms_id}@example.com", f"Mock Buyer {i+1}")
                add_user_role(cur, uid, role_buyer)
                buyer_ids.append(uid)

            conn.commit()
            print(f"[OK] users created (admin={len(admin_ids)} seller={len(seller_ids)} buyer={len(buyer_ids)})")

            stores: List[dict] = []
            for idx, seller_uid in enumerate(seller_ids, start=1):
                name = f"Mock Store {idx}"
                desc = f"Generated demo store #{idx} for testing embeddings & recommendations."

                round_uni = rand_bool(0.6)
                campus = rand_bool(0.6)
                if not (round_uni or campus):
                    campus = True

                st_id = create_store(cur, seller_uid, name, desc, round_uni, campus)
                add_store_primary_image(cur, st_id)
                stores.append({"store_id": st_id, "store_name": name})

            conn.commit()
            print(f"[OK] stores created = {len(stores)}")

            if not stores:
                raise RuntimeError("No stores created. Check --sellers.")

            base_per_store = args.products // len(stores)
            extra = args.products % len(stores)
            global_idx = 0

            for si, st in enumerate(stores):
                n = base_per_store + (1 if si < extra else 0)

                for _ in range(n):
                    global_idx += 1
                    cat = pick(subcats)
                    sub_slug = cat["slug"]
                    parent_slug = cat["parent_slug"]

                    profile = category_profile(sub_slug, parent_slug)

                    base = base_name_from_subcat_slug(sub_slug, parent_slug)
                    domain = profile["domain"]

                    pname = f"{pick(ADJ)} {base} #{global_idx:06d}-{random.randint(10,99)}"[:100]
                    pdesc = gen_desc_by_kind(profile["desc_kind"])
                    price = gen_price(domain)

                    pid = create_or_update_product(
                        cur,
                        st["store_id"],
                        cat["category_id"],
                        pname,
                        pdesc,
                        price,
                    )

                    add_product_images(cur, pid, args.images_per_product)

                    add_attr_value(cur, pid, key_material, pick(MATERIALS))
                    add_attr_value(cur, pid, key_color, pick(COLORS))
                    if domain == "clothing":
                        add_attr_value(cur, pid, key_size, pick(SIZES))

                    created_products.append((pid, pname, st["store_name"], cat["name"]))

                conn.commit()
                print(f"[OK] products for store_id={st['store_id']} count={n}")

            if args.with_embeddings and created_products:
                updated = 0
                failed = 0

                for i in range(0, len(created_products), args.batch_size):
                    batch = created_products[i:i + args.batch_size]
                    with conn.cursor() as cur2:
                        for (pid, pname, sname, cname) in batch:
                            try:
                                cur2.execute("SELECT product_desc FROM products WHERE product_id=%s;", (pid,))
                                row = cur2.fetchone()
                                pdesc = row[0] if row and row[0] else ""

                                text = build_embed_text(pname, pdesc, sname, cname)
                                vec = embed_text(text)
                                vec_lit = vec_to_pgvector_literal(vec)
                                update_embedding(cur2, pid, vec_lit)
                                updated += 1
                            except Exception as e:
                                failed += 1
                                print(f"[WARN] embedding failed product_id={pid}: {e}")

                        conn.commit()

                    print(f"[EMB] batch {i//args.batch_size+1}: updated={updated} failed={failed}")
                    if args.sleep_sec > 0:
                        time.sleep(args.sleep_sec)

                print(f"[DONE] embeddings updated={updated} failed={failed}")

            print("[ALL DONE] mock data generated successfully.")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()