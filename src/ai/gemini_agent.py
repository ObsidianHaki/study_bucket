from dotenv import load_dotenv
from google import genai
import os
load_dotenv() # intgerate variables from .env file

# The client gets the API key from the environment variable `GEMINI_API_KEY`.
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

response = client.models.generate_content(
    model="gemini-3-flash-preview", contents="Who is Loick ronaldo"
)
print(response.text)