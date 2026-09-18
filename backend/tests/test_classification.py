import json
import pytest
import httpx2
from typesafe_sdk import AsyncTypeSafeClient
from backend import classification
from backend.prompts import CLASSIFY, REVIEW
from test_app import client, pdf_bytes

@pytest.fixture
def provider(monkeypatch):
    seen=[]
    def handle(request):
        body=json.loads(request.content);seen.append(body)
        category='invoice' if 'INVOICE' in body['state']['document'] else 'resume'
        probabilities={id: .09/(len(classification.CATEGORIES)-1) for id in classification.CATEGORIES}
        probabilities[category]=.91
        return httpx2.Response(200,json={'model':'jev-test','usage':{},'answers':{'document_type':{'type':'choice','choice':category,'confidence':.94,'probabilities':probabilities}}})
    monkeypatch.setattr(classification,'AsyncTypeSafeClient',lambda **kw:AsyncTypeSafeClient(**kw,transport=httpx2.MockTransport(handle)))
    return seen

def test_categories_and_form_removal(client):
    categories=client.get('/api/classification/categories').json()
    assert {'invoice','resume','sow','proposal','other'} <= {c['id'] for c in categories}
    assert client.get('/api/forms/config').status_code==404
    assert client.post('/api/forms/fill',json={}).status_code==404
    assert [p['template'] for p in client.get('/api/prompts').json()][:2]==[REVIEW,CLASSIFY]

def test_classification_real_pdf_and_request(client,provider):
    client.put('/api/settings',json={'api_key':'test-key'})
    r=client.post('/api/classification',files={'file':('misleading-resume.pdf',pdf_bytes('INVOICE: Amount due USD 1200 for services. Please pay within 30 days.'))})
    assert r.status_code==200,r.text
    assert r.json()['label']=='Invoice'
    assert not r.json()['needs_review']
    assert r.json()['requests']==provider
    assert 'misleading-resume.pdf' not in json.dumps(provider)
    assert 'test-key' not in r.text
    assert len(provider[0]['questions'])==1

def test_bad_file_does_not_prevent_next_file(client,provider):
    client.put('/api/settings',json={'api_key':'test-key'})
    assert client.post('/api/classification',files={'file':('broken.pdf',b'broken')}).status_code==422
    assert client.post('/api/classification',files={'file':('resume.pdf',pdf_bytes())}).json()['category']=='resume'

def test_key_required(client):
    assert client.post('/api/classification',files={'file':('resume.pdf',pdf_bytes())}).status_code==409

def test_ambiguous_classification_is_flagged(client,monkeypatch):
    probs={id:0 for id in classification.CATEGORIES};probs.update(invoice=.52,receipt=.48)
    monkeypatch.setattr(classification,'AsyncTypeSafeClient',lambda **kw:AsyncTypeSafeClient(**kw,transport=httpx2.MockTransport(lambda r:httpx2.Response(200,json={'model':'jev-test','usage':{},'answers':{'document_type':{'type':'choice','choice':'invoice','confidence':.1,'probabilities':probs}}}))))
    client.put('/api/settings',json={'api_key':'test-key'})
    r=client.post('/api/classification',files={'file':('file.pdf',pdf_bytes())})
    assert r.status_code==200 and r.json()['needs_review']

def test_incomplete_response_fails_safely(client,monkeypatch):
    monkeypatch.setattr(classification,'AsyncTypeSafeClient',lambda **kw:AsyncTypeSafeClient(**kw,transport=httpx2.MockTransport(lambda r:httpx2.Response(200,json={'model':'jev-test','usage':{},'answers':{}}))))
    client.put('/api/settings',json={'api_key':'test-key'})
    assert client.post('/api/classification',files={'file':('file.pdf',pdf_bytes())}).status_code==502


def test_profile_templates(client):
    from backend.models import Profile
    templates=client.get('/api/profile-templates').json()
    assert len(templates)==10
    assert len([t for t in templates if t['category']=='Resume'])==6
    for t in templates:
        Profile.model_validate(t)


def test_financial_categories_are_used_in_requests_and_settings(client,provider):
    expected={'bank_statement','credit_card_statement','investment_statement','loan_statement','financial_statement','account_statement','remittance_advice','payslip','tax_return','insurance_policy'}
    categories=client.get('/api/classification/categories').json()
    assert expected <= {c['id'] for c in categories}
    client.put('/api/settings',json={'api_key':'test-key'})
    response=client.post('/api/classification',files={'file':('document.pdf',pdf_bytes())})
    assert response.status_code==200
    options=provider[0]['questions']['document_type']['criteria']
    assert expected <= set(options)
    prompt=next(p for p in client.get('/api/prompts').json() if p['id']=='classification')
    assert all(c['label'] in prompt['choices'] for c in categories)
