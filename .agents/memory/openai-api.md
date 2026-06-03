---
name: OpenAI API usage in api-server
description: api-server has no openai npm package — use raw fetch to api.openai.com
---

The `openai` npm package is NOT installed in `artifacts/api-server`. Always call OpenAI using:

```ts
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env["OPENAI_API_KEY"]}` },
  body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 1200 }),
});
```

**Why:** The api-server package.json only has express, drizzle, jsonwebtoken, pino etc. — no openai dep.
**How to apply:** Any new route that calls OpenAI must use raw fetch, never `import OpenAI from "openai"`.
