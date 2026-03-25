#!/usr/bin/env python3
"""
Import static images from a CSV (exported from Google Apps Script) into MERCURIO.

Groups files by folder name → creates one Content per folder (grafica).
Uses the first .jpg link as drive_link and the earliest date as completed_at.

Usage:
  python3 import_statics.py
"""

import csv
import os
import requests
from collections import OrderedDict
from datetime import datetime

# ── Configuration ──────────────────────────────────────────
CSV_FILE = "Foglio di lavoro senza nome - Foglio1.csv"
MERCURIO_URL = "https://mercurio-jeb1.onrender.com"
BRAND = "guida-e-vai"
CONTENT_TYPE = "grafica"
CHANNEL = "organico"


# ── Parse CSV and group by folder ──────────────────────────
def load_and_group(csv_path):
    """Returns OrderedDict: folder_name -> { title, drive_link, completed_at }"""
    groups = OrderedDict()

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            folder = row["Cartella"].strip()
            file_name = row["File"].strip()
            link = row["Link"].strip()
            date_str = row["Data creazione"].strip()

            if not folder:
                folder = os.path.splitext(file_name)[0]
            if not folder:
                continue

            # Parse date: "24/03/2026 9.21.27" → datetime
            dt = None
            if date_str:
                try:
                    dt = datetime.strptime(date_str, "%d/%m/%Y %H.%M.%S")
                except Exception:
                    pass

            if folder not in groups:
                groups[folder] = {
                    "title": folder.replace("_", " "),
                    "drive_link": "",
                    "completed_at": None,
                    "file_count": 0,
                }

            g = groups[folder]
            g["file_count"] += 1

            # Prefer first .jpg link as drive_link
            if not g["drive_link"] and file_name.lower().endswith(".jpg"):
                g["drive_link"] = link
            # Fallback: any link
            if not g["drive_link"] and link:
                g["drive_link"] = link

            # Use earliest date
            if dt and (g["completed_at"] is None or dt < g["completed_at"]):
                g["completed_at"] = dt

    return groups


# ── MERCURIO API helpers ───────────────────────────────────
def mercurio_login():
    password = os.getenv("MERCURIO_PASS_FULVIO", "")
    if not password:
        password = input("Password MERCURIO (fulvio): ").strip()

    r = requests.post(f"{MERCURIO_URL}/api/auth/login", json={
        "user_id": "fulvio",
        "password": password,
    })
    r.raise_for_status()
    return r.json()["token"]


def create_content(token, title, drive_link, completed_at):
    headers = {"Authorization": f"Bearer {token}"}

    # 1) Create
    payload = {
        "title": title,
        "brand": BRAND,
        "content_type": CONTENT_TYPE,
        "channel": CHANNEL,
        "source": "interno",
    }
    r = requests.post(f"{MERCURIO_URL}/api/contents/", json=payload, headers=headers)
    r.raise_for_status()
    content_id = r.json()["id"]

    # 2) Patch to archived
    update = {
        "status": "archiviato",
    }
    if drive_link:
        update["drive_link"] = drive_link
    if completed_at:
        iso = completed_at.isoformat()
        update["completed_at"] = iso
        update["archived_at"] = iso

    r2 = requests.patch(
        f"{MERCURIO_URL}/api/contents/{content_id}",
        json=update,
        headers=headers,
    )
    r2.raise_for_status()
    return content_id


# ── Main ───────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("MERCURIO — Import statiche da CSV")
    print("=" * 60)
    print(f"CSV: {CSV_FILE}")
    print(f"Brand: {BRAND}  |  Tipo: {CONTENT_TYPE}  |  Canale: {CHANNEL}")
    print()

    # Load CSV
    groups = load_and_group(CSV_FILE)
    print(f"Trovate {len(groups)} grafiche (da {sum(g['file_count'] for g in groups.values())} file)")
    print()

    # Preview
    print("Anteprima:")
    for i, (folder, g) in enumerate(list(groups.items())[:10]):
        date_str = g["completed_at"].strftime("%d/%m/%Y") if g["completed_at"] else "N/A"
        print(f"  {i+1}. [{date_str}] {g['title']} ({g['file_count']} file)")
    if len(groups) > 10:
        print(f"  ... e altre {len(groups) - 10} grafiche")

    print()
    input(f"Premi INVIO per importare {len(groups)} grafiche in MERCURIO come archiviate...")

    # Login
    print()
    token = mercurio_login()
    print()

    # Import
    ok = 0
    errors = 0
    total = len(groups)
    for i, (folder, g) in enumerate(groups.items()):
        try:
            cid = create_content(token, g["title"], g["drive_link"], g["completed_at"])
            ok += 1
            print(f"  ✓ [{i+1}/{total}] {g['title']} (id={cid})")
        except Exception as e:
            errors += 1
            print(f"  ✗ [{i+1}/{total}] {g['title']} — ERRORE: {e}")

    print()
    print("=" * 60)
    print(f"Importazione completata: {ok} OK, {errors} errori su {total} grafiche")
    print("=" * 60)


if __name__ == "__main__":
    main()
