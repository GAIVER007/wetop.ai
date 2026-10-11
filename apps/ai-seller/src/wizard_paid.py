"""Shared scan/generation deduplication, fail-closed daily budget and paid lease."""
import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timezone
from redis.exceptions import WatchError

TTL = 172800
# Must cover the longest live WizardSession (30 days), including abandoned-job recovery.
JOB_TTL = 2592000

class PaidMeter:
    def __init__(self, redis, key, spent, limit):
        self.redis, self.key, self.spent, self.limit = redis, key, spent, limit
        self.paid = False

    async def call(self, invoke):
        if self.spent >= self.limit:
            return {'status': 'error', 'errorCode': 'BUDGET_EXCEEDED'}
        # Keep the whole remainder reserved if a provider's usage or outcome is unknown.
        await self.redis.set(self.key, self.limit, ex=TTL)
        self.paid = True
        result = await invoke(self.limit - self.spent)
        usage = result['usage']
        if usage['complete']:
            self.spent += usage['input'] + usage['output']
            await self.redis.set(self.key, self.spent, ex=TTL)
        else:
            self.spent = self.limit
            return {'status': 'error', 'errorCode': 'USAGE_UNAVAILABLE', 'usage': usage}
        result.pop('model', None)
        return result

async def _limited(redis, key: str, limit: int) -> bool:
    async with redis.pipeline(transaction=True) as pipe:
        pipe.incr(key)
        pipe.expire(key, 3600, nx=True)
        result = await pipe.execute()
    return int(result[0]) > limit


async def paid_job(settings, redis, body, kind: str, operation) -> tuple[int, dict]:
    # No raw URL, bearer or visitor address in Redis keys or logs.
    digest = hashlib.sha256(body.model_dump_json().encode()).hexdigest()
    job_key = f"wizard:{kind}:{body.sessionId}:{body.requestId}"
    day = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    budget_key = f"wizard:tokens:{day}"
    lock_key = 'wizard:scan:paid-lock'
    limit = settings.wizard_daily_tokens
    if limit <= 0:
        return 503, {'status': 'error', 'errorCode': 'BUDGET_UNCONFIGURED'}
    cached = await redis.get(job_key)
    if cached:
        state = json.loads(cached)
        if state['digest'] != digest:
            return 409, {'status': 'error', 'errorCode': 'REQUEST_CONFLICT'}
        return state['http'], state['result']
    if await _limited(redis, f'wizard:session:{body.sessionId}', 5) or await _limited(redis, f'wizard:ip:{body.ipHash}', 20):
        return 429, {'status': 'error', 'errorCode': 'RATE_LIMITED'}
    owner = uuid.uuid4().hex
    if not await redis.set(lock_key, owner, nx=True, ex=120):
        return 503, {'status': 'error', 'errorCode': 'BUSY'}
    claimed = False
    meter = None
    try:
        spent = int(await redis.get(budget_key) or 0)
        if spent >= limit:
            return 503, {'status': 'error', 'errorCode': 'BUDGET_EXCEEDED'}
        pending = {'digest': digest, 'http': 409, 'result': {'status': 'error', 'errorCode': 'RESULT_UNKNOWN'}}
        claimed = bool(await redis.set(job_key, json.dumps(pending), nx=True, ex=JOB_TTL))
        if not claimed:
            state = json.loads(await redis.get(job_key))
            if state['digest'] != digest:
                return 409, {'status': 'error', 'errorCode': 'REQUEST_CONFLICT'}
            return state['http'], state['result']
        http = 200
        meter = PaidMeter(redis, budget_key, spent, limit)
        try:
            async with asyncio.timeout(85):
                result = await operation(meter)
        except Exception:
            result = {'status': 'error', 'errorCode': 'RESULT_UNKNOWN' if meter.paid else 'UNAVAILABLE'}
        await redis.set(job_key, json.dumps({'digest': digest, 'http': http, 'result': result}), ex=JOB_TTL)
        return http, result
    finally:
        # CAS unlock: never delete a lease acquired by another worker after expiry.
        async with redis.pipeline(transaction=True) as pipe:
            try:
                await pipe.watch(lock_key)
                value = await pipe.get(lock_key)
                if value in (owner, owner.encode()):
                    pipe.multi()
                    pipe.delete(lock_key)
                    await pipe.execute()
            except WatchError:
                pass


