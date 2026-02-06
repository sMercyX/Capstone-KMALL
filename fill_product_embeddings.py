#!/usr/bin/env python3
import os
import json
import time
import requests
import psycopg2
from psycopg2.extras import RealDictCursor


DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres%2F25@localhost:5555/kmall_db?sslmode=disable")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "nomic-embed-text")

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))
SLEEP_SEC = float(os.getenv("SLEEP_SEC", "0.0"))  # เผื่ออยากหน่วงระหว่าง batch


def embed_text(text: str) -> list[float]:
    """
    Call Ollama embeddings API.
    Compatible with Ollama endpoint: POST /api/embeddings
    """
    payload = {"model": OLLAMA_MODEL, "prompt": text}
    resp = requests.post(f"{OLLAMA_URL}/api/embeddings", json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    vec = data.get("embedding")
    if not isinstance(vec, list) or not vec:
        raise RuntimeError(f"Invalid embedding response: {json.dumps(data)[:300]}")
    return vec


def build_embed_text(row: dict) -> str:
    # รวมข้อความให้ embedding มีบริบท (แนะนำ)
    name = row["name"] or ""
    desc = row.get("product_desc") or ""
    store = row.get("store_name") or ""
    cat = row.get("category_name") or ""
    return f"Product: {name}\nDescription: {desc}\nStore: {store}\nCategory: {cat}".strip()


def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # 1) ตรวจว่ามี null embedding เท่าไหร่
        cur.execute("""
            SELECT count(*) AS total,
                   count(*) FILTER (WHERE embedding IS NULL) AS null_embedding
            FROM products;
        """)
        stat = cur.fetchone()
        print(f"[INFO] products total={stat['total']}, null_embedding={stat['null_embedding']}")

        # 2) ดึงรายการที่ต้องเติม (embedding IS NULL)
        cur.execute("""
            SELECT
                p.product_id,
                p.name,
                p.product_desc,
                s.store_name,
                c.name AS category_name
            FROM products p
            JOIN stores s ON s.store_id = p.store_id
            JOIN categories c ON c.category_id = p.category_id
            WHERE p.embedding IS NULL
            ORDER BY p.product_id ASC;
        """)
        rows = cur.fetchall()

    if not rows:
        print("[INFO] No products need embeddings. Done.")
        conn.close()
        return

    updated = 0
    failed = 0

    # 3) เติม embedding ทีละ batch
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i+BATCH_SIZE]
        with conn.cursor() as cur:
            for r in batch:
                pid = r["product_id"]
                try:
                    text = build_embed_text(r)
                    vec = embed_text(text)

                    # IMPORTANT: pgvector รับรูปแบบ array ได้: '[1,2,3]'::vector หรือ ARRAY แล้ว cast
                    # วิธีนี้ง่ายสุด:
                    vec_str = "[" + ",".join(f"{x:.8f}" for x in vec) + "]"

                    cur.execute(
                        "UPDATE products SET embedding = %s::vector WHERE product_id = %s;",
                        (vec_str, pid),
                    )
                    updated += 1
                except Exception as e:
                    failed += 1
                    print(f"[WARN] product_id={pid} failed: {e}")

            conn.commit()

        print(f"[INFO] batch {i//BATCH_SIZE+1} done. updated={updated}, failed={failed}")

        if SLEEP_SEC > 0:
            time.sleep(SLEEP_SEC)

    # 4) สรุป
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT count(*) FILTER (WHERE embedding IS NULL) AS null_embedding
            FROM products;
        """)
        stat2 = cur.fetchone()
        print(f"[DONE] updated={updated}, failed={failed}, remaining_null={stat2['null_embedding']}")

    conn.close()


if __name__ == "__main__":
    main()