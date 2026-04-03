import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.AsyncAnthropic()


async def get_llm_response(prompt: str) -> str:
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text