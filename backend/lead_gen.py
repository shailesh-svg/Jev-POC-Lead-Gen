"""Score an inbound lead against an ICP profile in a single TypeSafe request.

Combines four question types in one system_one call (composite scoring +
intent routing): Noul per ICP criterion, Score for industry fit, company
maturity, and purchase intent, and Choice for the routing decision.
"""
import math
from typesafe_sdk import AsyncTypeSafeClient, Choice, Noul, Score, RetryPolicy
from .prompts import LEAD_FIT, LEAD_INDUSTRY, LEAD_MATURITY, LEAD_INTENT, LEAD_ROUTE, request_trace

WEIGHTS = {'icp_fit': 0.40, 'industry_fit': 0.20, 'company_maturity': 0.15, 'purchase_intent': 0.25}

def _level_ratio(score, levels):
    return score / (len(levels) - 1) if len(levels) > 1 else 0.0

def _level_label(score, levels):
    index = max(0, min(len(levels) - 1, round(score)))
    return levels[index]

def _validate(value, low=0, high=1):
    if not math.isfinite(value) or not low <= value <= high:
        raise ValueError('Invalid value returned by provider')
    return value

async def score_lead(profile, text, key):
    questions = {
        f'criterion_{i}': Noul(instructions=LEAD_FIT.format(name=c['name'], description=c['description']))
        for i, c in enumerate(profile['criteria'])
    }
    questions['industry_fit'] = Score(instructions=LEAD_INDUSTRY, criteria=profile['industry_levels'])
    questions['company_maturity'] = Score(instructions=LEAD_MATURITY, criteria=profile['maturity_levels'])
    questions['purchase_intent'] = Score(instructions=LEAD_INTENT, criteria=profile['intent_levels'])
    questions['route'] = Choice(instructions=LEAD_ROUTE, criteria={r['name']: r['description'] for r in profile['routing']})

    async with AsyncTypeSafeClient(api_key=key, timeout=60, retry=RetryPolicy(max_retries=1)) as client:
        response = await client.system_one(
            state={'ideal_customer_profile': profile['icp_description'], 'lead_content': text},
            questions=questions,
        )

    criteria_results = []
    for i, c in enumerate(profile['criteria']):
        value = _validate(float(response.nouls[f'criterion_{i}'].noul))
        criteria_results.append({**c, 'fit': round(value * 100, 1)})
    icp_fit = sum(r['fit'] * r['weight'] for r in criteria_results) / sum(r['weight'] for r in criteria_results)

    industry = response.scores['industry_fit']
    maturity = response.scores['company_maturity']
    intent = response.scores['purchase_intent']
    route = response.choices['route']

    routing_ids = {r['name'] for r in profile['routing']}
    if route.choice not in routing_ids:
        raise ValueError('Unknown routing destination')
    for s, levels in ((industry, profile['industry_levels']), (maturity, profile['maturity_levels']), (intent, profile['intent_levels'])):
        _validate(float(s.score), 0, len(levels) - 1)
        _validate(float(s.confidence))
    _validate(float(route.confidence))

    priority = round(100 * (
        WEIGHTS['icp_fit'] * icp_fit / 100
        + WEIGHTS['industry_fit'] * _level_ratio(industry.score, profile['industry_levels'])
        + WEIGHTS['company_maturity'] * _level_ratio(maturity.score, profile['maturity_levels'])
        + WEIGHTS['purchase_intent'] * _level_ratio(intent.score, profile['intent_levels'])
    ))
    needs_review = min(float(intent.confidence), float(route.confidence)) < 0.5

    def describe(s, levels):
        return {'level': _level_label(s.score, levels), 'score': round(float(s.score), 2), 'confidence': round(float(s.confidence), 2)}

    return {
        'icp_fit': round(icp_fit, 1),
        'criteria': criteria_results,
        'industry_fit': describe(industry, profile['industry_levels']),
        'company_maturity': describe(maturity, profile['maturity_levels']),
        'purchase_intent': describe(intent, profile['intent_levels']),
        'priority': priority,
        'tier': 'Hot' if priority >= 70 else 'Warm' if priority >= 40 else 'Cold',
        'route': route.choice,
        'route_description': next(r['description'] for r in profile['routing'] if r['name'] == route.choice),
        'route_confidence': round(float(route.confidence), 2),
        'needs_review': needs_review,
        'profile_name': profile['name'],
        'requests': [request_trace(response)],
    }
