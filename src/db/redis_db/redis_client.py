import logging
import redis
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

pool = redis.ConnectionPool(
    host=os.environ.get("REDIS_HOST"),
    port=os.environ.get("REDIS_PORT"),
    decode_responses=True,
)
r = redis.Redis(connection_pool=pool)


def save_query_and_response(query: str, response: str):
    r.lpush("cache", f"User Query: {query}\nAssistant response: {response}")
    logger.info("Saved query/response to Redis cache | query='%s'", query)
    return r.lrange("cache", 0, 6)  # the last 6 messages are stord inside of the cahce


def cache_previous_messages():
    cache_size = r.llen("cache")
    if cache_size > 5:
        logger.info("Cache overflow, trimming oldest entries | cache_size=%d", cache_size)
        for _ in range(6):
            r.lpop("cache")
    messages = r.lrange("cache", 0, 6)
    logger.info("Retrieved %d previous message(s) from cache", len(messages))
    return messages
