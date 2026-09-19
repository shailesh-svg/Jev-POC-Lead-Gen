from typesafe_sdk import AsyncTypeSafeClient, Noul, RetryPolicy
from .prompts import REVIEW, request_trace
from .validation import bounded

def status_for(value):
    return 'Strong support' if value >= .75 else 'Partial support' if value >= .4 else 'Limited support'

async def evaluate(profile, text, key):
    questions = {
        f'criterion_{i}': Noul(instructions=REVIEW.format(name=c['name'], description=c['description'])) for i, c in enumerate(profile['criteria'])
    }
    async with AsyncTypeSafeClient(api_key=key, timeout=60, retry=RetryPolicy(max_retries=1)) as client:
        response = await client.system_one(state={'profile': profile['description'], 'submitted_content': text}, questions=questions)
    results = []
    for i, c in enumerate(profile['criteria']):
        value = bounded(response.nouls[f'criterion_{i}'].noul, message='Invalid score returned by provider')
        results.append({**c, 'score': round(value * 100, 1), 'status': status_for(value)})
    total = round(sum(r['score'] * r['weight'] for r in results) / sum(r['weight'] for r in results))
    return {'score': total, 'criteria': results, 'profile_name': profile['name'], 'model': str(getattr(response, 'model', 'jev-latest')), 'requests': [request_trace(response)]}
