from collections.abc import AsyncGenerator

import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.AsyncAnthropic()

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096


async def stream_llm_response(system: str, user_prompt: str) -> AsyncGenerator[str | dict, None]:
    """Stream text tokens, then yield a final dict with usage metadata."""
    async with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield text

    # After streaming completes, get the final message with usage stats
    response = await stream.get_final_message()
    yield {
        "usage": {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        },
        "model": response.model,
    }