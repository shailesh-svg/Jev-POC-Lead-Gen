import asyncio
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Annotated
from uuid import uuid4
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.concurrency import run_in_threadpool
from typesafe_sdk import TypeSafeAPIError, TypeSafeError
from . import storage
from .classification import classify, CATEGORIES
from .evaluation import evaluate
from .extraction import extract, MAX_BYTES
from .lead_gen import score_lead
from .models import Profile, Settings, LeadProfile
from .prompts import catalog

REQUEST_TIMEOUT = 90
# A lead scores in about a second and three run at a time, so 25 lands in
# roughly ten seconds. The cap exists to bound one request, not to ration.
MAX_BATCH = 25
BATCH_CONCURRENCY = 3

app = FastAPI(title='Align Workbench API', version='1.0.0')
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

@lru_cache(maxsize=None)
def templates(filename):
    """Read a bundled template file once; the files never change while the server runs."""
    return json.loads(Path(__file__).with_name(filename).read_text())

def require_key():
    key = storage.api_key()
    if not key:
        raise HTTPException(409, 'Add your TypeSafe API key in Settings first.')
    return key

async def typesafe_call(coroutine, failure):
    """Await one TypeSafe feature call, mapping provider faults to safe client errors."""
    try:
        return await asyncio.wait_for(coroutine, timeout=REQUEST_TIMEOUT)
    except TypeSafeAPIError as e:
        status = getattr(e, 'status', None)
        if status in (401, 403):
            raise HTTPException(502, 'TypeSafe rejected the API key. Check Settings.')
        if status == 429:
            raise HTTPException(503, 'TypeSafe is busy or the request limit was reached. Try again later.')
        raise HTTPException(502, failure)
    except (TimeoutError, TypeSafeError):
        raise HTTPException(502, 'Could not reach TypeSafe. Check your connection and try again.')
    except (KeyError, ValueError, AttributeError):
        raise HTTPException(502, 'TypeSafe returned an incomplete result. Please try again.')

@app.get('/api/health')
def health():
    return {'status': 'ok'}

@app.get('/api/profile-templates')
def profile_templates():
    return templates('profile_templates.json')

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
    if not storage.delete_profile(id):
        raise HTTPException(404, 'Profile not found.')

@app.get('/api/prompts')
def prompt_catalog():
    return catalog()

@app.get('/api/settings')
def settings():
    return {'configured': bool(storage.api_key()), 'environment_key': bool(os.getenv('TYPESAFE_API_KEY'))}

@app.put('/api/settings')
def save_settings(settings: Settings):
    key = settings.api_key.strip()
    if not key:
        raise HTTPException(422, 'Enter a valid API key.')
    storage.set_key(key)
    return {'configured': True}

@app.delete('/api/settings', status_code=204)
def clear_settings():
    storage.clear_key()

@app.post('/api/extract')
async def extract_file(file: UploadFile = File(...)):
    data = await file.read(MAX_BYTES + 1)
    await file.close()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, 'Use a file smaller than 10 MB.')
    text, kind = await run_in_threadpool(extract, data, file.filename or '')
    return {'text': text, 'kind': kind, 'filename': Path(file.filename or 'Upload').name}

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
    key = require_key()
    return await typesafe_call(
        evaluate(profile, body.text, key),
        'TypeSafe could not complete the review. Check your account and try again.',
    )

@app.get('/api/classification/categories')
def classification_categories():
    return [{'id': id, **item} for id, item in CATEGORIES.items()]

@app.post('/api/classification')
async def classify_pdf(file: UploadFile = File(...)):
    try:
        key = require_key()
    except HTTPException:
        await file.close()
        raise
    extracted = await extract_file(file)
    result = await typesafe_call(
        classify(extracted['text'], key),
        'TypeSafe could not classify this PDF. Try again.',
    )
    return {**result, 'filename': extracted['filename'], 'characters': len(extracted['text'])}

@app.get('/api/lead-profile-templates')
def lead_profile_templates():
    return templates('lead_profile_templates.json')

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
    if not storage.delete_lead_profile(id):
        raise HTTPException(404, 'Lead profile not found.')

LeadText = Annotated[str, Field(min_length=20, max_length=20000)]
SCORE_FAILED = 'TypeSafe could not score this lead. Check your account and try again.'

class LeadScoreInput(BaseModel):
    lead_profile_id: str
    text: LeadText

class LeadBatchInput(BaseModel):
    lead_profile_id: str
    leads: list[LeadText] = Field(min_length=1, max_length=MAX_BATCH)

def require_lead_profile(id):
    profile = storage.get_lead_profile(id)
    if not profile:
        raise HTTPException(404, 'Lead profile not found.')
    return profile

@app.post('/api/lead-scores')
async def lead_score(body: LeadScoreInput):
    profile = require_lead_profile(body.lead_profile_id)
    key = require_key()
    return await typesafe_call(score_lead(profile, body.text, key), SCORE_FAILED)

@app.post('/api/lead-scores/batch')
async def lead_score_batch(body: LeadBatchInput):
    """Score a queue of leads, ranked by priority. One bad lead does not sink the batch."""
    profile = require_lead_profile(body.lead_profile_id)
    key = require_key()
    limit = asyncio.Semaphore(BATCH_CONCURRENCY)

    async def score_one(index, text):
        async with limit:
            try:
                return {'index': index, 'result': await typesafe_call(score_lead(profile, text, key), SCORE_FAILED)}
            except HTTPException as e:
                return {'index': index, 'error': e.detail}

    scored = await asyncio.gather(*(score_one(i, text) for i, text in enumerate(body.leads)))
    ranked = sorted(scored, key=lambda s: s['result']['priority'] if 'result' in s else -1, reverse=True)
    return {'leads': ranked, 'scored': sum('result' in s for s in scored), 'failed': sum('error' in s for s in scored)}

DIST = Path(__file__).parent.parent / 'frontend' / 'dist'
if DIST.exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')
    @app.get('/')
    def index():
        return FileResponse(DIST / 'index.html')
