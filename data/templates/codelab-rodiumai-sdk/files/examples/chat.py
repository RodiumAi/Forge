import os

from openai import OpenAI

client = OpenAI(
    api_key=os.environ["RODIUMAI_API_KEY"],
    base_url=os.environ.get("RODIUMAI_BASE_URL", "https://api.rodiumai.io/v1"),
)

stream = client.chat.completions.create(
    model="google/gemini-3.7-flash",
    messages=[{"role": "user", "content": "Explique les RODI en une phrase."}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
print()
