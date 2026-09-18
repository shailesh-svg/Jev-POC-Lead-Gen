import json
import os
import sqlite3
from pathlib import Path
from cryptography.fernet import Fernet

DATA = Path(os.getenv('ALIGN_DATA_DIR', Path(__file__).parent / 'data'))

def connect():
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(DATA / 'align.db')
    db.row_factory = sqlite3.Row
    db.execute('CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, body TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS lead_profiles (id TEXT PRIMARY KEY, body TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, secret TEXT NOT NULL)')
    return db

def cipher():
    path = DATA / 'secret.key'
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(fd, 'wb') as f:
            f.write(Fernet.generate_key())
    return Fernet(path.read_bytes())

def profiles():
    with connect() as db:
        return [dict(id=r['id'], **json.loads(r['body'])) for r in db.execute('SELECT * FROM profiles ORDER BY rowid')]

def get_profile(id):
    return next((p for p in profiles() if p['id'] == id), None)

def save_profile(id, profile):
    with connect() as db:
        db.execute('INSERT OR REPLACE INTO profiles VALUES (?, ?)', (id, profile.model_dump_json()))
    return get_profile(id)

def lead_profiles():
    with connect() as db:
        return [dict(id=r['id'], **json.loads(r['body'])) for r in db.execute('SELECT * FROM lead_profiles ORDER BY rowid')]

def get_lead_profile(id):
    return next((p for p in lead_profiles() if p['id'] == id), None)

def save_lead_profile(id, profile):
    with connect() as db:
        db.execute('INSERT OR REPLACE INTO lead_profiles VALUES (?, ?)', (id, profile.model_dump_json()))
    return get_lead_profile(id)

def api_key():
    with connect() as db:
        row = db.execute('SELECT secret FROM settings WHERE id=1').fetchone()
    return cipher().decrypt(row['secret'].encode()).decode() if row else os.getenv('TYPESAFE_API_KEY', '').strip()

def set_key(key):
    with connect() as db:
        db.execute('INSERT OR REPLACE INTO settings VALUES (1, ?)', (cipher().encrypt(key.encode()).decode(),))
