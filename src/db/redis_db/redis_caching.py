
import redis
import os
from dotenv import load_dotenv
load_dotenv()



pool = redis.ConnectionPool(host=os.environ.get("REDIS_HOST"), port=os.environ.get("REDIS_PORT"), decode_responses=True)
r = redis.Redis(connection_pool=pool)


def save_query_and_response(query: str, response: str):

    r.lpush("cache", f"User Query: {query}\nAssistant response: {response}")
    return r.lrange("cache", 0, 6)  #  context


def cache_previous_messages():
    if r.llen("cache") > 5:
        for i in range(6):
            r.lpop("cache")
    return r.lrange("cache", 0, 6)
