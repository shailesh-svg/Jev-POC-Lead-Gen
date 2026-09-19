import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from cryptography.fernet import Fernet

DATA = Path(os.getenv('ALIGN_DATA_DIR', Path(__file__).parent / 'data'))

SCHEMA = (
    'CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, body TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS lead_profiles (id TEXT PRIMARY KEY, body TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, secret TEXT NOT NULL)',
)

# Table names are module constants, never request input, so they are safe to format into SQL.
PROFILES = 'profiles'
LEAD_PROFILES = 'lead_profiles'

_prepared = set()
_ciphers = {}


def _prepare(path):
    """Create the data directory and schema once per data path, not once per request."""
    if path in _prepared:
        return
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(path / 'align.db')
    try:
        with db:
            for statement in SCHEMA:
                db.execute(statement)
    finally:
        db.close()
    _prepared.add(path)


@contextmanager
def connect():
    """Open a connection that commits on success, rolls back on error, and always closes."""
    path = DATA
    _prepare(path)
    db = sqlite3.connect(path / 'align.db')
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


def cipher():
    path = DATA / 'secret.key'
    existing = _ciphers.get(path)
    if existing:
        return existing
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(fd, 'wb') as f:
            f.write(Fernet.generate_key())
    _ciphers[path] = Fernet(path.read_bytes())
    return _ciphers[path]


def _record(id, body):
    return dict(id=id, **json.loads(body))


def _rows(table):
    with connect() as db:
        rows = db.execute(f'SELECT id, body FROM {table} ORDER BY rowid').fetchall()
    return [_record(r['id'], r['body']) for r in rows]


def _row(table, id):
    with connect() as db:
        row = db.execute(f'SELECT id, body FROM {table} WHERE id=?', (id,)).fetchone()
    return _record(row['id'], row['body']) if row else None


def _save(table, id, profile):
    body = profile.model_dump_json()
    with connect() as db:
        db.execute(f'INSERT OR REPLACE INTO {table} VALUES (?, ?)', (id, body))
    return _record(id, body)


def _delete(table, id):
    with connect() as db:
        return db.execute(f'DELETE FROM {table} WHERE id=?', (id,)).rowcount > 0


def profiles():
    return _rows(PROFILES)


def get_profile(id):
    return _row(PROFILES, id)


def save_profile(id, profile):
    return _save(PROFILES, id, profile)


def delete_profile(id):
    return _delete(PROFILES, id)


def lead_profiles():
    return _rows(LEAD_PROFILES)


def get_lead_profile(id):
    return _row(LEAD_PROFILES, id)


def save_lead_profile(id, profile):
    return _save(LEAD_PROFILES, id, profile)


def delete_lead_profile(id):
    return _delete(LEAD_PROFILES, id)


def api_key():
    with connect() as db:
        row = db.execute('SELECT secret FROM settings WHERE id=1').fetchone()
    return cipher().decrypt(row['secret'].encode()).decode() if row else os.getenv('TYPESAFE_API_KEY', '').strip()


def set_key(key):
    with connect() as db:
        db.execute('INSERT OR REPLACE INTO settings VALUES (1, ?)', (cipher().encrypt(key.encode()).decode(),))


def clear_key():
    with connect() as db:
        db.execute('DELETE FROM settings')
