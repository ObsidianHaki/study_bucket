# ai/anthropic_agent.py — like a @Component in Spring Boot

import anthropic
from dotenv import load_dotenv

# Load environments from .env file
load_dotenv()

client = anthropic.Anthropic()

def get_anthropic_agent():
    """
    DI provider for AnthropicAgent — like:
        @Bean
        public AnthropicAgent anthropicAgent() { return new AnthropicAgent(client); }

    FastAPI calls this via Depends() whenever a route or service needs it.
    """
    class AnthropicAgent:
        def generate(self, prompt: str) -> str:
            message = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return message.content[0].text

    return AnthropicAgent()
