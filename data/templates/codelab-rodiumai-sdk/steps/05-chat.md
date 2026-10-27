# Une réponse en flux

:::tabs group="lang"
```py title="chat.py" download="files/examples/chat.py" {4-7}
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
```
```ts title="chat.ts" download="files/examples/chat.ts" {3-6}
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.RODIUMAI_API_KEY,
  baseURL: process.env.RODIUMAI_BASE_URL ?? "https://api.rodiumai.io/v1",
});

const stream = await client.chat.completions.create({
  model: "google/gemini-3.7-flash",
  messages: [{ role: "user", content: "Explique les RODI en une phrase." }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
```
:::

```terminal
$ python chat.py
Les RODI sont l'unité de crédit de RodiumAi qui sert à payer chaque appel aux modèles.
```
