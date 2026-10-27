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
