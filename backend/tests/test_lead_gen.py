import json
import pytest
import httpx2
from typesafe_sdk import AsyncTypeSafeClient
from backend import lead_gen
from backend.models import LeadProfile
from test_app import client

@pytest.fixture
def lead_profile():
    return {
        'name': 'DevOps Platform',
        'icp_description': 'We sell CI/CD tooling to engineering orgs with 50+ engineers.',
        'criteria': [
            {'name': 'Decision-maker access', 'description': 'A VP Engineering or Head of Platform is named.', 'weight': 3},
            {'name': 'Technical pain point', 'description': 'A concrete build or deploy problem is stated.', 'weight': 2},
        ],
        'industry_levels': ['Irrelevant sector', 'Adjacent sector', 'Core target: software'],
        'maturity_levels': ['No info', 'Early-stage', 'Growth-stage', 'Enterprise'],
        'intent_levels': ['No stated need', 'Passive interest', 'Actively evaluating', 'Ready to buy'],
        'routing': [
            {'name': 'immediate_sdr_outreach', 'description': 'Strong fit and intent. Route to SDR now.'},
            {'name': 'nurture_sequence', 'description': 'Reasonable fit, low urgency. Nurture.'},
            {'name': 'disqualify', 'description': 'Poor fit. Disqualify.'},
        ],
    }

def answers(criterion_values=(.9, .8), industry=(2, .9), maturity=(3, .85), intent=(2, .8), route=('immediate_sdr_outreach', .9)):
    body = {f'criterion_{i}': {'type': 'noul', 'noul': v} for i, v in enumerate(criterion_values)}
    body['industry_fit'] = {'type': 'score', 'score': industry[0], 'confidence': industry[1], 'probabilities': {}, 'legend': {}}
    body['company_maturity'] = {'type': 'score', 'score': maturity[0], 'confidence': maturity[1], 'probabilities': {}, 'legend': {}}
    body['purchase_intent'] = {'type': 'score', 'score': intent[0], 'confidence': intent[1], 'probabilities': {}, 'legend': {}}
    body['route'] = {'type': 'choice', 'choice': route[0], 'confidence': route[1], 'probabilities': {}}
    return body

@pytest.fixture
def provider(monkeypatch):
    seen = []
    def make(answer_body):
        def handle(request):
            seen.append(json.loads(request.content))
            return httpx2.Response(200, json={'model': 'jev-test', 'usage': {}, 'answers': answer_body})
        monkeypatch.setattr(lead_gen, 'AsyncTypeSafeClient', lambda **kw: AsyncTypeSafeClient(**kw, transport=httpx2.MockTransport(handle)))
    make(answers())
    return seen, make

def test_lead_profile_crud_and_validation(client, lead_profile):
    assert client.get('/api/lead-profiles').json() == []
    created = client.post('/api/lead-profiles', json=lead_profile)
    assert created.status_code == 201, created.text
    id = created.json()['id']
    lead_profile['name'] = 'Updated'
    assert client.put('/api/lead-profiles/' + id, json=lead_profile).json()['name'] == 'Updated'
    lead_profile['industry_levels'] = ['Only one level']
    assert client.put('/api/lead-profiles/' + id, json=lead_profile).status_code == 422
    assert client.delete('/api/lead-profiles/' + id).status_code == 204
    assert client.delete('/api/lead-profiles/' + id).status_code == 404

def test_lead_profile_templates_are_valid(client):
    templates = client.get('/api/lead-profile-templates').json()
    assert len(templates) == 2
    for t in templates:
        LeadProfile.model_validate(t)

def test_lead_score_requires_key(client, lead_profile):
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    r = client.post('/api/lead-scores', json={'lead_profile_id': id, 'text': 'A VP Engineering asked about our platform.'})
    assert r.status_code == 409

def test_lead_score_unknown_profile(client):
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores', json={'lead_profile_id': 'missing', 'text': 'A VP Engineering asked about our platform.'})
    assert r.status_code == 404

def test_lead_score_end_to_end(client, lead_profile, provider):
    seen, make = provider
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores', json={'lead_profile_id': id, 'text': 'A VP Engineering asked about our platform after a failed rollout.'})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['icp_fit'] == 86.0
    assert body['industry_fit'] == {'level': 'Core target: software', 'score': 2.0, 'confidence': 0.9}
    assert body['route'] == 'immediate_sdr_outreach'
    assert body['needs_review'] is False
    assert body['tier'] in ('Hot', 'Warm', 'Cold')
    assert len(seen[0]['questions']) == 6
    assert 'test-key' not in r.text

def test_lead_score_flags_low_confidence(client, lead_profile, provider):
    seen, make = provider
    make(answers(intent=(1, .3)))
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores', json={'lead_profile_id': id, 'text': 'Some generic inbound message.'})
    assert r.status_code == 200, r.text
    assert r.json()['needs_review'] is True

def test_lead_score_rejects_unknown_route(client, lead_profile, provider):
    seen, make = provider
    make(answers(route=('escalate_to_legal', .9)))
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores', json={'lead_profile_id': id, 'text': 'Some inbound message.'})
    assert r.status_code == 502
