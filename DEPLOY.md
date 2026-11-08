# Deploying Island Forge to Sevalla

The repository has a `Dockerfile` at its root. Sevalla builds it and runs the web app and API in one container on port 8080.

## 1. Create the app

1. In the Sevalla dashboard, go to **Applications → Add application**.
2. Connect GitHub if you haven't already, then pick the **`moonlightwolfalt/cells-atoms-and-particles`** repository.
3. Pick the branch to deploy. This work is on **`claude/laughing-archimedes-cry8ds`**. You can deploy that branch, or merge it into your main branch first and deploy main.
4. Turn on **automatic deployment** if you want every push to that branch to redeploy.
5. Choose a location and the smallest instance size. You can scale up later.

## 2. Build settings

In the app's **Settings → Build**:

- **Build environment:** Dockerfile
- **Dockerfile path:** `Dockerfile`
- **Context:** `.` (the repository root)

The image sets `PORT=8080` and the server listens on it. If Sevalla gives your app a different `PORT`, the server uses that instead. The health check is at `/api/health`.

Sevalla's menu names can change. If yours differ, look for the setting that chooses **Dockerfile** as the build method.

## 3. Environment variables

The image runs in **public mode** (`ISLAND_FORGE_PUBLIC=1`). That protects your AI keys and the server.

| Variable | What it does |
|---|---|
| `ISLAND_FORGE_PASSCODE` | **Set this if you add any AI key below.** Visitors can only use your keys if they type this passcode. Anyone without it has to paste their own API key. |
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | ChatGPT |
| `GEMINI_API_KEY` | Gemini |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `XAI_API_KEY` | Grok |
| `MISTRAL_API_KEY` | Mistral |
| `LLAMA_API_KEY` | Llama (Meta Llama API) |
| `DASHSCOPE_API_KEY` | Qwen |
| `MOONSHOT_API_KEY` | Kimi |
| `OPENAI_COMPATIBLE_API_KEY` | The "Other OpenAI-compatible" provider |
| `RATE_LIMIT_PER_HOUR` | AI generations per visitor per hour. The default is 30, and `0` turns the limit off. The offline generator is never limited. |
| `ALLOWED_BASE_URLS` | Comma-separated base URLs visitors may use, for example `https://api.groq.com/openai/v1`. Custom base URLs are blocked by default. |
| `ALLOW_SHARED_KEYS` | Set to `1` only if you really want **anyone** to use your keys without a passcode. This can run up your AI bill. |

Mark the API keys and the passcode as secrets in Sevalla. You don't need any keys at all: the offline generator works without them, and visitors can paste their own keys.

## 4. Deploy

Keep the app at **one instance** (Sevalla's default). Generation runs as a background job held in that instance's memory, which is what lets slow AI models take minutes without hitting any gateway time limit.

Click **Deploy now**. When it finishes, open the URL Sevalla gives you, for example `https://island-forge-xxxx.sevalla.app`. To check that it's up, open `/api/health` on that URL. It should return `{"ok":true}`.

## What's turned off on the public server

- **Ollama:** it runs on your own computer, so the server can't reach it. Run Island Forge locally to use it.
- **Claude Code:** it runs Claude Code's agent runtime on the machine, so it's off on public servers and not included in the image. Use the regular **Claude** option instead (same models, same API key).
- **Custom base URLs:** blocked unless they're listed in `ALLOWED_BASE_URLS`.

## Running the same image yourself

```bash
docker build -t island-forge .
docker run -p 8080:8080 -e ISLAND_FORGE_PASSCODE=choose-one -e ANTHROPIC_API_KEY=sk-ant-... island-forge
# http://localhost:8080
```
