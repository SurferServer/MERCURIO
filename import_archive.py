"""
Importa l'archivio video da Google Sheet (CSV) in MERCURIO.
Uso: python3 import_archive.py import.csv
"""
import csv
import sys
import re
import requests
from datetime import datetime

BASE = "https://mercurio-jeb1.onrender.com/api"

if len(sys.argv) < 2:
    print("Uso: python3 import_archive.py import.csv")
    sys.exit(1)

csv_file = sys.argv[1]

# Login
password = input("Password di Fulvio: ").strip()
r = requests.post(f"{BASE}/auth/login", json={"user_id": "fulvio", "password": password})
if r.status_code != 200:
    print("Login fallito:", r.text)
    sys.exit(1)

token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print("Login OK\n")


def extract_drive_file_id(link):
    """Estrae il file ID da un link Google Drive."""
    if not link:
        return None
    # https://drive.google.com/file/d/XXXXX/view
    m = re.search(r'/d/([a-zA-Z0-9_-]+)', link)
    if m:
        return m.group(1)
    # https://drive.google.com/open?id=XXXXX
    m = re.search(r'id=([a-zA-Z0-9_-]+)', link)
    if m:
        return m.group(1)
    return None


def parse_date(date_str):
    """Converte la data dal CSV in formato ISO."""
    if not date_str or not date_str.strip():
        return None
    try:
        dt = datetime.strptime(date_str.strip(), "%Y-%m-%d %H:%M:%S")
        return dt.isoformat()
    except ValueError:
        try:
            dt = datetime.strptime(date_str.strip(), "%d/%m/%Y %H:%M:%S")
            return dt.isoformat()
        except ValueError:
            return None


# Leggi CSV
with open(csv_file, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Righe trovate nel CSV: {len(rows)}\n")

if not rows:
    print("Nessuna riga trovata. Verifica il file CSV.")
    sys.exit(1)

# Mostra prima riga di esempio
first = rows[0]
print(f"Esempio prima riga:")
for k, v in first.items():
    print(f"  {k}: {v[:80] if v else '(vuoto)'}")
print()

input("Premi INVIO per avviare l'importazione (Ctrl+C per annullare)...")
print()

ok = 0
errori = 0

for i, row in enumerate(rows):
    cartella = (row.get('Cartella') or '').strip()
    nome_video = (row.get('Nome Video') or '').strip()
    link = (row.get('Link') or '').strip()
    data = (row.get('Data caricamento') or '').strip()

    # Usa il nome della cartella come titolo (più descrittivo), fallback al nome file
    title = cartella if cartella else nome_video
    if not title:
        print(f"  [{i+1}] SKIP - nessun titolo")
        errori += 1
        continue

    drive_file_id = extract_drive_file_id(link)
    completed_at = parse_date(data)

    payload = {
        "title": title[:255],
        "brand": "guida-e-vai",
        "content_type": "video",
        "channel": "organico",
        "source": "interno",
        "notes": nome_video if nome_video != title else None,
    }

    try:
        # 1. Crea il contenuto
        r = requests.post(f"{BASE}/contents/", json=payload, headers=headers)
        if r.status_code not in (200, 201):
            print(f"  [{i+1}] ERRORE creazione '{title[:40]}': {r.text[:100]}")
            errori += 1
            continue

        content_id = r.json()["id"]

        # 2. Archivia e collega il link Drive con la data originale
        update = {"status": "archiviato"}
        if link:
            update["drive_link"] = link
        if completed_at:
            update["completed_at"] = completed_at
            update["archived_at"] = completed_at
        r2 = requests.patch(f"{BASE}/contents/{content_id}", json=update, headers=headers)

        if r2.status_code == 200:
            ok += 1
            if (ok % 50) == 0:
                print(f"  ... {ok} importati")
        else:
            print(f"  [{i+1}] ERRORE archiviazione #{content_id}: {r2.text[:100]}")
            errori += 1

    except Exception as e:
        print(f"  [{i+1}] ERRORE: {e}")
        errori += 1

print(f"\n{'='*40}")
print(f"Importazione completata!")
print(f"  Importati: {ok}")
print(f"  Errori:    {errori}")
print(f"  Totale:    {len(rows)}")
