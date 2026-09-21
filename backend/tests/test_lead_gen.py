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
    assert r.json()['review_reasons'] == ['Purchase intent confidence 30%']

def test_lead_score_flags_a_guessed_rubric(client, lead_profile, provider):
    """A rubric the model had no confidence in still feeds the score, so it is flagged."""
    seen, make = provider
    make(answers(maturity=(3, .0)))
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores', json={'lead_profile_id': id, 'text': 'A VP Engineering asked about our platform.'})
    assert r.status_code == 200, r.text
    assert r.json()['needs_review'] is True
    assert r.json()['review_reasons'] == ['Company maturity confidence 0%']

def test_lead_score_tolerates_middling_rubric_confidence(client, lead_profile, provider):
    """An unsure-but-not-guessing rubric is normal, and must not flag every lead."""
    seen, make = provider
    make(answers(industry=(2, .42)))
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores', json={'lead_profile_id': id, 'text': 'A VP Engineering asked about our platform.'})
    assert r.status_code == 200, r.text
    assert r.json()['needs_review'] is False
    assert r.json()['review_reasons'] == []

def test_lead_score_rejects_unknown_route(client, lead_profile, provider):
    seen, make = provider
    make(answers(route=('escalate_to_legal', .9)))
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores', json={'lead_profile_id': id, 'text': 'Some inbound message.'})
    assert r.status_code == 502

@pytest.mark.parametrize('answer', [
    {'criterion_0': {'type': 'noul', 'noul': 1.4}},
    {'criterion_0': {'type': 'noul', 'noul': float('nan')}},
    {'industry_fit': {'type': 'score', 'score': 9, 'confidence': .9, 'probabilities': {}, 'legend': {}}},
    {'purchase_intent': {'type': 'score', 'score': 1, 'confidence': 1.2, 'probabilities': {}, 'legend': {}}},
    {'route': {'type': 'choice', 'choice': 'nurture_sequence', 'confidence': -0.1, 'probabilities': {}}},
])
def test_out_of_range_answers_fail_safely(client, lead_profile, provider, answer):
    seen, make = provider
    make({**answers(), **answer})
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores', json={'lead_profile_id': id, 'text': 'A VP Engineering asked about our platform.'})
    assert r.status_code == 502
    assert 'incomplete result' in r.json()['detail']

def test_missing_answer_fails_safely(client, lead_profile, provider):
    seen, make = provider
    body = answers()
    del body['company_maturity']
    make(body)
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores', json={'lead_profile_id': id, 'text': 'A VP Engineering asked about our platform.'})
    assert r.status_code == 502

def test_batch_ranks_leads_by_priority(client, lead_profile, monkeypatch):
    bodies = {
        'hot lead': answers(criterion_values=(1, 1), intent=(3, .9)),
        'cold lead': answers(criterion_values=(.05, .05), industry=(0, .9), maturity=(0, .9), intent=(0, .9), route=('disqualify', .9)),
    }
    def handle(request):
        payload = json.loads(request.content)
        which = 'hot lead' if 'hot lead' in payload['state']['lead_content'] else 'cold lead'
        return httpx2.Response(200, json={'model': 'jev-test', 'usage': {}, 'answers': bodies[which]})
    monkeypatch.setattr(lead_gen, 'AsyncTypeSafeClient', lambda **kw: AsyncTypeSafeClient(**kw, transport=httpx2.MockTransport(handle)))
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores/batch', json={'lead_profile_id': id, 'leads': [
        'This is a cold lead with no stated need at all.',
        'This is a hot lead ready to buy this quarter.',
    ]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['scored'] == 2 and body['failed'] == 0
    assert [lead['index'] for lead in body['leads']] == [1, 0]
    assert body['leads'][0]['result']['tier'] == 'Hot'
    assert body['leads'][0]['result']['priority'] > body['leads'][1]['result']['priority']

def test_batch_reports_per_lead_failures(client, lead_profile, monkeypatch):
    def handle(request):
        payload = json.loads(request.content)
        if 'break' in payload['state']['lead_content']:
            return httpx2.Response(500, json={'error': 'private provider detail'})
        return httpx2.Response(200, json={'model': 'jev-test', 'usage': {}, 'answers': answers()})
    monkeypatch.setattr(lead_gen, 'AsyncTypeSafeClient', lambda **kw: AsyncTypeSafeClient(**kw, transport=httpx2.MockTransport(handle)))
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    client.put('/api/settings', json={'api_key': 'test-key'})
    r = client.post('/api/lead-scores/batch', json={'lead_profile_id': id, 'leads': [
        'A VP Engineering asked about our platform today.',
        'This lead will break the provider on purpose.',
    ]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['scored'] == 1 and body['failed'] == 1
    failed = next(lead for lead in body['leads'] if 'error' in lead)
    assert failed['index'] == 1
    assert 'private provider detail' not in r.text
    assert body['leads'][0]['index'] == 0

def test_batch_limits_and_requirements(client, lead_profile):
    id = client.post('/api/lead-profiles', json=lead_profile).json()['id']
    assert client.post('/api/lead-scores/batch', json={'lead_profile_id': id, 'leads': ['x' * 30]}).status_code == 409
    client.put('/api/settings', json={'api_key': 'test-key'})
    assert client.post('/api/lead-scores/batch', json={'lead_profile_id': 'missing', 'leads': ['x' * 30]}).status_code == 404
    assert client.post('/api/lead-scores/batch', json={'lead_profile_id': id, 'leads': []}).status_code == 422
    assert client.post('/api/lead-scores/batch', json={'lead_profile_id': id, 'leads': ['x' * 30] * 11}).status_code == 422
    assert client.post('/api/lead-scores/batch', json={'lead_profile_id': id, 'leads': ['too short']}).status_code == 422
