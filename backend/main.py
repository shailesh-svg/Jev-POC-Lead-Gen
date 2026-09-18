import asyncio
from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.concurrency import run_in_threadpool
from typesafe_sdk import TypeSafeAPIError, TypeSafeError
from .models import Profile, Settings, LeadProfile
from . import storage
from .extraction import extract, MAX_BYTES
from .evaluation import evaluate

app = FastAPI(title='Align Review API', version='1.0.0')
app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', 'testserver'])

@app.middleware('http')
async def local_write_guard(request: Request, call_next):
    origin = request.headers.get('origin')
    if request.method not in ('GET', 'HEAD', 'OPTIONS') and origin and origin not in (f'http://{request.headers.get("host")}', f'https://{request.headers.get("host")}'):
        return JSONResponse({'detail': 'Cross-origin writes are not allowed.'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'no-store'
    return response

@app.get('/api/health')
def health():
    return {'status': 'ok'}

@app.get('/api/profile-templates')
def profile_templates():
    import json
    return json.loads(Path(__file__).with_name('profile_templates.json').read_text())

@app.get('/api/profiles')
def list_profiles():
    return storage.profiles()

@app.post('/api/profiles', status_code=201)
def create_profile(profile: Profile):
    return storage.save_profile(str(uuid4()), profile)

@app.put('/api/profiles/{id}')
def update_profile(id: str, profile: Profile):
    if not storage.get_profile(id):
        raise HTTPException(404, 'Profile not found.')
    return storage.save_profile(id, profile)

@app.delete('/api/profiles/{id}', status_code=204)
def delete_profile(id: str):
    with storage.connect() as db:
        if db.execute('DELETE FROM profiles WHERE id=?', (id,)).rowcount == 0:
            raise HTTPException(404, 'Profile not found.')

from .prompts import catalog

@app.get('/api/prompts')
def prompt_catalog():
    return catalog()

@app.get('/api/settings')
def settings():
    return {'configured': bool(storage.api_key()), 'environment_key': bool(__import__('os').getenv('TYPESAFE_API_KEY'))}

@app.put('/api/settings')
def save_settings(settings: Settings):
    key = settings.api_key.strip()
    if not key:
        raise HTTPException(422, 'Enter a valid API key.')
    storage.set_key(key)
    return {'configured': True}

@app.delete('/api/settings', status_code=204)
def clear_settings():
    with storage.connect() as db:
        db.execute('DELETE FROM settings')

@app.post('/api/extract')
async def extract_file(file: UploadFile = File(...)):
    data = await file.read(MAX_BYTES + 1)
    await file.close()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, 'Use a file smaller than 10 MB.')
    text, kind = await run_in_threadpool(extract, data, file.filename or '')
    return {'text': text, 'kind': kind, 'filename': Path(file.filename or 'Upload').name}

from pydantic import BaseModel, Field
class ReviewInput(BaseModel):
    profile_id: str
    text: str = Field(min_length=20, max_length=60000)
    kind: str

@app.post('/api/reviews')
async def review(body: ReviewInput):
    profile = storage.get_profile(body.profile_id)
    if not profile:
        raise HTTPException(404, 'Profile not found.')
    if body.kind not in profile['accepted_types']:
        raise HTTPException(422, 'This profile does not accept this file type.')
    key = storage.api_key()
    if not key:
        raise HTTPException(409, 'Add your TypeSafe API key in Settings first.')
    try:
        return await asyncio.wait_for(evaluate(profile, body.text, key), timeout=90)
    except TypeSafeAPIError as e:
        status = getattr(e, 'status', None)
        if status in (401, 403):
            raise HTTPException(502, 'TypeSafe rejected the API key. Check Settings.')
        if status == 429:
            raise HTTPException(503, 'TypeSafe is busy or the request limit was reached. Try again later.')
        raise HTTPException(502, 'TypeSafe could not complete the review. Check your account and try again.')
    except (TimeoutError, TypeSafeError):
        raise HTTPException(502, 'Could not reach TypeSafe. Check your connection and try again.')
    except (KeyError, ValueError, AttributeError):
        raise HTTPException(502, 'TypeSafe returned an incomplete result. Please try again.')

from .classification import classify, CATEGORIES

@app.get('/api/classification/categories')
def classification_categories():
    return [{'id': id, **item} for id, item in CATEGORIES.items()]

@app.post('/api/classification')
async def classify_pdf(file: UploadFile = File(...)):
    key = storage.api_key()
    if not key:
        await file.close()
        raise HTTPException(409, 'Add your TypeSafe API key in Settings first.')
    extracted = await extract_file(file)
    try:
        result = await asyncio.wait_for(classify(extracted['text'], key), timeout=90)
        return {**result, 'filename': extracted['filename'], 'characters': len(extracted['text'])}
    except TypeSafeAPIError as e:
        if getattr(e, 'status', None) in (401, 403):
            raise HTTPException(502, 'TypeSafe rejected the API key. Check Settings.')
        if getattr(e, 'status', None) == 429:
            raise HTTPException(503, 'TypeSafe request limit reached. Try again later.')
        raise HTTPException(502, 'TypeSafe could not classify this PDF. Try again.')
    except (TimeoutError, TypeSafeError):
        raise HTTPException(502, 'Could not complete the TypeSafe request. Try again.')
    except (KeyError, AttributeError, ValueError):
        raise HTTPException(502, 'TypeSafe returned an incomplete classification. Try again.')

from .lead_gen import score_lead

@app.get('/api/lead-profile-templates')
def lead_profile_templates():
    import json
    return json.loads(Path(__file__).with_name('lead_profile_templates.json').read_text())

@app.get('/api/lead-profiles')
def list_lead_profiles():
    return storage.lead_profiles()

@app.post('/api/lead-profiles', status_code=201)
def create_lead_profile(profile: LeadProfile):
    return storage.save_lead_profile(str(uuid4()), profile)

@app.put('/api/lead-profiles/{id}')
def update_lead_profile(id: str, profile: LeadProfile):
    if not storage.get_lead_profile(id):
        raise HTTPException(404, 'Lead profile not found.')
    return storage.save_lead_profile(id, profile)

@app.delete('/api/lead-profiles/{id}', status_code=204)
def delete_lead_profile(id: str):
    with storage.connect() as db:
        if db.execute('DELETE FROM lead_profiles WHERE id=?', (id,)).rowcount == 0:
            raise HTTPException(404, 'Lead profile not found.')

class LeadScoreInput(BaseModel):
    lead_profile_id: str
    text: str = Field(min_length=20, max_length=20000)

@app.post('/api/lead-scores')
async def lead_score(body: LeadScoreInput):
    profile = storage.get_lead_profile(body.lead_profile_id)
    if not profile:
        raise HTTPException(404, 'Lead profile not found.')
    key = storage.api_key()
    if not key:
        raise HTTPException(409, 'Add your TypeSafe API key in Settings first.')
    try:
        return await asyncio.wait_for(score_lead(profile, body.text, key), timeout=90)
    except TypeSafeAPIError as e:
        status = getattr(e, 'status', None)
        if status in (401, 403):
            raise HTTPException(502, 'TypeSafe rejected the API key. Check Settings.')
        if status == 429:
            raise HTTPException(503, 'TypeSafe is busy or the request limit was reached. Try again later.')
        raise HTTPException(502, 'TypeSafe could not score this lead. Check your account and try again.')
    except (TimeoutError, TypeSafeError):
        raise HTTPException(502, 'Could not reach TypeSafe. Check your connection and try again.')
    except (KeyError, ValueError, AttributeError):
        raise HTTPException(502, 'TypeSafe returned an incomplete result. Please try again.')

DIST = Path(__file__).parent.parent / 'frontend' / 'dist'
if DIST.exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')
    @app.get('/')
    def index():
        return FileResponse(DIST / 'index.html')
