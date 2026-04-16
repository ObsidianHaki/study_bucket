from collections.abc import AsyncGenerator

import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.AsyncAnthropic()

DEFAULT_MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 4096

# Available models for selection (set of valid model IDs)
AVAILABLE_MODELS = {
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
}


async def stream_llm_response(
    system: str, user_prompt: str, model: str | None = None
) -> AsyncGenerator[str | dict, None]:
    """Stream text tokens, then yield a final dict with usage metadata."""
    # Use provided model or fall back to default
    selected_model = model if model in AVAILABLE_MODELS else DEFAULT_MODEL

    async with client.messages.stream(
        model=selected_model,
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


def get_available_models() -> set:
    """Return the available models for selection."""
    return AVAILABLE_MODELS
