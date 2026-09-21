"""Score an inbound lead against an ICP profile in a single TypeSafe request.

Combines four question types in one system_one call (composite scoring +
intent routing): Noul per ICP criterion, Score for industry fit, company
maturity, and purchase intent, and Choice for the routing decision.
"""
from typesafe_sdk import AsyncTypeSafeClient, Choice, Noul, Score, RetryPolicy
from .prompts import LEAD_FIT, LEAD_INDUSTRY, LEAD_MATURITY, LEAD_INTENT, LEAD_ROUTE, request_trace
from .validation import bounded

WEIGHTS = {'icp_fit': 0.40, 'industry_fit': 0.20, 'company_maturity': 0.15, 'purchase_intent': 0.25}
# Intent and routing decide what happens to the lead, so they are held to a
# higher bar. Any rubric answered below GUESS_CONFIDENCE was effectively a
# guess, and still feeds the priority score, so it is worth a human look.
REVIEW_CONFIDENCE = 0.5
GUESS_CONFIDENCE = 0.25
HOT, WARM = 70, 40

def _level_ratio(score, levels):
    return score / (len(levels) - 1) if len(levels) > 1 else 0.0

def _level_label(score, levels):
    index = max(0, min(len(levels) - 1, round(score)))
    return levels[index]

def _review_reasons(industry, maturity, intent, route_confidence):
    """Why this lead needs a human look, in the words shown to the user."""
    reasons = []
    if intent[1] < REVIEW_CONFIDENCE:
        reasons.append(f'Purchase intent confidence {intent[1]:.0%}')
    if route_confidence < REVIEW_CONFIDENCE:
        reasons.append(f'Routing confidence {route_confidence:.0%}')
    for label, (_, confidence) in (('Industry fit', industry), ('Company maturity', maturity)):
        if confidence < GUESS_CONFIDENCE:
            reasons.append(f'{label} confidence {confidence:.0%}')
    return reasons

def _describe(answer, levels):
    """Validate one Score answer and render it for the client."""
    score = bounded(answer.score, 0, len(levels) - 1)
    confidence = bounded(answer.confidence)
    return {'level': _level_label(score, levels), 'score': round(score, 2), 'confidence': round(confidence, 2)}, score, confidence

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
        value = bounded(response.nouls[f'criterion_{i}'].noul)
        criteria_results.append({**c, 'fit': round(value * 100, 1)})
    icp_fit = sum(r['fit'] * r['weight'] for r in criteria_results) / sum(r['weight'] for r in criteria_results)

    industry, industry_score, industry_confidence = _describe(response.scores['industry_fit'], profile['industry_levels'])
    maturity, maturity_score, maturity_confidence = _describe(response.scores['company_maturity'], profile['maturity_levels'])
    intent, intent_score, intent_confidence = _describe(response.scores['purchase_intent'], profile['intent_levels'])

    route = response.choices['route']
    destination = next((r for r in profile['routing'] if r['name'] == route.choice), None)
    if not destination:
        raise ValueError('Unknown routing destination')
    route_confidence = bounded(route.confidence)

    reasons = _review_reasons(
        (industry_score, industry_confidence),
        (maturity_score, maturity_confidence),
        (intent_score, intent_confidence),
        route_confidence,
    )

    priority = round(100 * (
        WEIGHTS['icp_fit'] * icp_fit / 100
        + WEIGHTS['industry_fit'] * _level_ratio(industry_score, profile['industry_levels'])
        + WEIGHTS['company_maturity'] * _level_ratio(maturity_score, profile['maturity_levels'])
        + WEIGHTS['purchase_intent'] * _level_ratio(intent_score, profile['intent_levels'])
    ))

    return {
        'icp_fit': round(icp_fit, 1),
        'criteria': criteria_results,
        'industry_fit': industry,
        'company_maturity': maturity,
        'purchase_intent': intent,
        'priority': priority,
        'tier': 'Hot' if priority >= HOT else 'Warm' if priority >= WARM else 'Cold',
        'route': route.choice,
        'route_description': destination['description'],
        'route_confidence': round(route_confidence, 2),
        'needs_review': bool(reasons),
        'review_reasons': reasons,
        'profile_name': profile['name'],
        'requests': [request_trace(response)],
    }
