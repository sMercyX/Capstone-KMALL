#!/usr/bin/env python3
import os
import json
import time
import argparse
import requests
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres%2F25@localhost:5555/kmall_db?sslmode=disable")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "nomic-embed-text")

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))
SLEEP_SEC = float(os.getenv("SLEEP_SEC", "0.0"))

EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))


def parse_args():
    ap = argparse.ArgumentParser(description="Backfill split embeddings for products (with weights)")
    ap.add_argument("--w-name", type=float, default=1.0)
    ap.add_argument("--w-desc", type=float, default=1.0)
    ap.add_argument("--w-category", type=float, default=1.0)
    ap.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    ap.add_argument("--sleep-sec", type=float, default=SLEEP_SEC)
    return ap.parse_args()


def ensure_embed_dim(vec: list, dim: int = EMBED_DIM) -> list:
    if not isinstance(vec, list):
        raise RuntimeError("embedding is not a list")
    if len(vec) == dim:
        return vec
    if len(vec) > dim:
        return vec[:dim]
    return vec + [0.0] * (dim - len(vec))


def embed_text(text: str) -> list[float]:
    payload = {"model": OLLAMA_MODEL, "prompt": text}
    resp = requests.post(f"{OLLAMA_URL}/api/embeddings", json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    vec = data.get("embedding")
    if not isinstance(vec, list) or len(vec) == 0:
        raise RuntimeError(f"Invalid embedding response: {json.dumps(data)[:300]}")
    return ensure_embed_dim(vec, EMBED_DIM)


def apply_weight(vec: list[float], w: float) -> list[float]:
    w = float(w)
    return [float(x) * w for x in vec]


def vec_to_pgvector_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{float(x):.8f}" for x in vec) + "]"


def update_split_embeddings(cur, product_id: int, emb_name: str, emb_desc: str, emb_cat: str):
    cur.execute(
        """
        UPDATE products
        SET
          embedding_name=%s::vector,
          embedding_desc=%s::vector,
          embedding_category=%s::vector,
          updated_at=NOW()
        WHERE product_id=%s;
        """,
        (emb_name, emb_desc, emb_cat, product_id),
    )

def normalize_weights(w_name: float, w_desc: float, w_cat: float):
    s = float(w_name) + float(w_desc) + float(w_cat)
    if s <= 0:
        return 1.0, 0.0, 0.0
    return w_name/s, w_desc/s, w_cat/s

def main():
    args = parse_args()
    batch_size = args.batch_size
    sleep_sec = args.sleep_sec
    wn, wd, wc = normalize_weights(args.w_name, args.w_desc, args.w_category)
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    # 1) ตรวจว่ามี null split embeddings เท่าไหร่ (ถือว่า “ต้องเติม” ถ้า name ยัง NULL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT count(*) AS total,
                   count(*) FILTER (WHERE embedding_name IS NULL) AS null_split
            FROM products;
        """)
        stat = cur.fetchone()
        print(f"[INFO] products total={stat['total']}, null_split(embedding_name)={stat['null_split']}")

        # 2) ดึงรายการที่ต้องเติม (embedding_name IS NULL)
        cur.execute("""
            SELECT
                p.product_id,
                p.name,
                COALESCE(p.product_desc,'') AS product_desc,
                COALESCE(c.name,'') AS category_name
            FROM products p
            JOIN categories c ON c.category_id = p.category_id
            WHERE p.embedding_name IS NULL
            ORDER BY p.product_id ASC;
        """)
        rows = cur.fetchall()

    if not rows:
        print("[INFO] No products need split embeddings. Done.")
        conn.close()
        return

    updated = 0
    failed = 0

    # 3) เติม embeddings ทีละ batch
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        with conn.cursor() as cur:
            for r in batch:
                pid = int(r["product_id"])
                pname = (r["name"] or "").strip()
                pdesc = (r["product_desc"] or "").strip()
                cname = (r["category_name"] or "").strip()

                try:
                    name_text = f"Name: {pname}".strip()
                    desc_text = f"Description: {pdesc}".strip()
                    cat_text = f"Category: {cname}".strip()

                    v_name = apply_weight(embed_text(name_text), wn)
                    v_desc = apply_weight(embed_text(desc_text), wd)
                    v_cat  = apply_weight(embed_text(cat_text), wc)

                    lit_name = vec_to_pgvector_literal(v_name)
                    lit_desc = vec_to_pgvector_literal(v_desc)
                    lit_cat = vec_to_pgvector_literal(v_cat)

                    update_split_embeddings(cur, pid, lit_name, lit_desc, lit_cat)
                    updated += 1

                except Exception as e:
                    failed += 1
                    print(f"[WARN] product_id={pid} failed: {e}")

            conn.commit()

        print(f"[INFO] batch {i//batch_size + 1} done. updated={updated}, failed={failed}")
        if sleep_sec > 0:
            time.sleep(sleep_sec)

    # 4) สรุป
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT count(*) FILTER (WHERE embedding_name IS NULL) AS null_split
            FROM products;
        """)
        stat2 = cur.fetchone()
        print(f"[DONE] updated={updated}, failed={failed}, remaining_null_split={stat2['null_split']}")

    conn.close()


if __name__ == "__main__":
    main()