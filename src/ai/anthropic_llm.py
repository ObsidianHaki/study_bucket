# ai/anthropic_llm.py — like a @Component in Spring Boot

import anthropic
from dotenv import load_dotenv

# Load environments from .env file
load_dotenv()

client = anthropic.Anthropic()


def get_anthropic_llm():

    class AnthropicAgent:
        def get_llm_response(self, prompt: str) -> str:
            message = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text

    return AnthropicAgent()
