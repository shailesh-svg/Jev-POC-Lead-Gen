import json
from io import BytesIO
import pytest
import httpx2
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from typesafe_sdk import AsyncTypeSafeClient
from backend.main import app
from backend import storage, evaluation

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, 'DATA', tmp_path)
    monkeypatch.delenv('TYPESAFE_API_KEY', raising=False)
    return TestClient(app)

@pytest.fixture
def profile():
    return {'name':'Engineer', 'category':'Resume', 'description':'Build reliable Python services.', 'input_label':'Resume', 'accepted_types':['pdf'], 'criteria':[{'name':'Python', 'description':'Has shipped Python services.', 'weight':3},{'name':'Testing', 'description':'Writes automated tests.', 'weight':1}]}

def pdf_bytes(text='Candidate has five years of Python development and automated testing experience.'):
    writer = PdfWriter()
    page = writer.add_blank_page(612, 792)
    font = DictionaryObject({NameObject('/Type'):NameObject('/Font'), NameObject('/Subtype'):NameObject('/Type1'), NameObject('/BaseFont'):NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(f'BT /F1 12 Tf 50 700 Td ({text}) Tj ET'.encode())
    page[NameObject('/Contents')] = writer._add_object(stream)
    out = BytesIO(); writer.write(out); return out.getvalue()

def test_profile_crud_and_validation(client, profile):
    assert client.get('/api/profiles').json() == []
    created = client.post('/api/profiles',json=profile)
    assert created.status_code == 201
    id = created.json()['id']
    profile['name'] = 'Updated'
    assert client.put('/api/profiles/'+id,json=profile).json()['name'] == 'Updated'
    assert client.get('/api/profiles').json()[0]['name'] == 'Updated'
    profile['criteria'][0]['weight'] = 0
    assert client.put('/api/profiles/'+id,json=profile).status_code == 422
    assert client.delete('/api/profiles/'+id).status_code == 204
    assert client.delete('/api/profiles/'+id).status_code == 404

def test_key_encrypted_not_returned(client):
    assert not client.get('/api/settings').json()['configured']
    assert client.put('/api/settings',json={'api_key':'test-secret-value'}).status_code == 200
    assert storage.api_key() == 'test-secret-value'
    assert 'test-secret-value' not in client.get('/api/settings').text
    assert b'test-secret-value' not in (storage.DATA/'align.db').read_bytes()
    assert (storage.DATA/'secret.key').stat().st_mode & 0o777 == 0o600
    assert client.delete('/api/settings').status_code == 204
    assert not client.get('/api/settings').json()['configured']
    assert client.put('/api/settings',json={'api_key':'  '}).status_code == 422

def test_extract_real_pdf(client):
    r = client.post('/api/extract',files={'file':('resume.pdf',pdf_bytes(),'application/pdf')})
    assert r.status_code == 200
    assert 'five years of Python' in r.json()['text']
    assert r.json()['kind'] == 'pdf'

@pytest.mark.parametrize('name,data,status', [('x.png',b'no',415),('x.pdf',b'bad pdf',422),('x.pdf',pdf_bytes(''),422),('x.pdf',b'x'*(10*1024*1024+1),413)])
def test_bad_uploads(client,name,data,status):
    assert client.post('/api/extract',files={'file':(name,data)}).status_code == status

def test_review_requires_key(client,profile):
    id=client.post('/api/profiles',json=profile).json()['id']
    assert client.post('/api/reviews',json={'profile_id':id,'text':'Candidate has Python experience.','kind':'pdf'}).status_code == 409

def test_sdk_end_to_end(client,profile,monkeypatch):
    seen=[]
    def handle(request):
        payload=json.loads(request.content);seen.append(payload)
        return httpx2.Response(200,json={'model':'jev-test','usage':{'input_tokens':20,'output_tokens':2},'answers':{'criterion_0':{'type':'noul','noul':.9},'criterion_1':{'type':'noul','noul':.5}}})
    monkeypatch.setattr(evaluation,'AsyncTypeSafeClient',lambda **kw: AsyncTypeSafeClient(**kw,transport=httpx2.MockTransport(handle)))
    id=client.post('/api/profiles',json=profile).json()['id']
    client.put('/api/settings',json={'api_key':'test-key'})
    extracted=client.post('/api/extract',files={'file':('resume.pdf',pdf_bytes())}).json()
    r=client.post('/api/reviews',json={'profile_id':id,'text':extracted['text'],'kind':'pdf'})
    assert r.status_code == 200,r.text
    assert r.json()['score'] == 80
    assert r.json()['criteria'][0]['score'] == 90
    assert len(seen[0]['questions']) == 2
    assert seen[0]['state']['submitted_content'] == extracted['text']
    assert client.post('/api/reviews',json={'profile_id':id,'text':extracted['text'],'kind':'png'}).status_code == 422

def test_provider_errors_are_safe(client,profile,monkeypatch):
    monkeypatch.setattr(evaluation,'AsyncTypeSafeClient',lambda **kw: AsyncTypeSafeClient(**kw,transport=httpx2.MockTransport(lambda r: httpx2.Response(401,json={'error':'private provider detail'}))))
    id=client.post('/api/profiles',json=profile).json()['id']
    client.put('/api/settings',json={'api_key':'test-key'})
    r=client.post('/api/reviews',json={'profile_id':id,'text':'Candidate has Python experience.','kind':'pdf'})
    assert r.status_code == 502
    assert 'private provider detail' not in r.text

def test_cross_origin_write_rejected(client,profile):
    assert client.post('/api/profiles',json=profile,headers={'origin':'https://untrusted.example'}).status_code == 403

def test_untrusted_host_rejected(client):
    assert client.get('/api/settings',headers={'host':'attacker.example'}).status_code == 400
