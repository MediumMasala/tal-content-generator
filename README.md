# Cabal of Strangers - TAL Image Generator

A Mastra-based multi-tool workflow for generating photorealistic TAL character image prompts.

## Architecture

```
Streamlit (Python) → Express Server (TypeScript) → Mastra Flow
                                                      ↓
                                          ┌─────────────────────┐
                                          │  1. PROMPT_ENHANCER │
                                          │  2. GEMINI CALL     │
                                          │  3. OUTPUT_DISPATCHER│
                                          └─────────────────────┘
```

## Flow: `cabal_of_strangers_v1`

1. **User submits request** in Streamlit (natural language)
2. **PROMPT_ENHANCER** transforms request into Gemini-friendly instruction package
3. **GEMINI** generates structured PromptPackage with photorealistic constraints
4. **OUTPUT_DISPATCHER** persists artifacts and returns payload to Streamlit

## Non-Negotiable Constraints

- **TAL Character Consistency**: Identity locked to TAL_ANCHOR_IMAGE
- **Photorealism**: Must look like real camera photos
- **No Celebrities**: Public figures are stripped and replaced
- **Real Locations**: Believable real-world settings

## Setup

### 1. Install Node.js dependencies

```bash
npm install
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

Create a `.env` file:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
# Or use GEMINI_API_KEY
GEMINI_MODEL=gemini-2.0-flash
OUTPUT_DIR=./outputs
PORT=3000
```

**Note**: The system works in mock mode without an API key.

### 4. Start the backend server

```bash
npm run dev
```

Server runs at `http://localhost:3000`

### 5. Start the Streamlit frontend

In a new terminal:

```bash
streamlit run streamlit_app.py
```

Frontend runs at `http://localhost:8501`

## API Endpoints

### `POST /run`

Execute the Cabal of Strangers workflow.

**Request:**
```json
{
  "user_request": "TAL drinking coffee at a cafe",
  "size": "1024x1024",
  "seed": null,
  "style_preset": null
}
```

**Response:**
```json
{
  "status": "ok",
  "streamlit_payload": {
    "run_id": "uuid",
    "prompt_package": {
      "final_prompt": "...",
      "negative_prompt": "...",
      "reference_image_ids": ["TAL_ANCHOR_IMAGE"],
      "reference_strength": 0.85,
      "size": "1024x1024",
      "n": 1,
      "seed": null,
      "assumptions": [],
      "policy_notes": []
    },
    "paths": {
      "request": "outputs/runs/{run_id}/request.json",
      "enhancer_output": "outputs/runs/{run_id}/enhancer_output.json",
      "gemini_output": "outputs/runs/{run_id}/gemini_output.json",
      "events": "outputs/runs/{run_id}/events.jsonl"
    }
  }
}
```

### `GET /health`

Health check endpoint.

### `GET /flow`

Get flow metadata.

## Project Structure

```
├── streamlit_app.py           # Streamlit frontend
├── server/
│   └── index.ts               # Express server
├── mastra/
│   ├── flow.ts                # Mastra flow definition
│   ├── tools/
│   │   ├── prompt_enhancer.ts # Prompt enhancement tool
│   │   ├── output_dispatcher.ts # Output persistence tool
│   │   └── storage.ts         # File I/O utilities
│   └── gemini/
│       └── client.ts          # Gemini API wrapper
├── core/
│   ├── schemas.ts             # Zod schemas
│   └── tal_prompt_enhancer.md # System prompt for Gemini
├── outputs/
│   └── runs/{run_id}/         # Run artifacts
├── package.json
├── tsconfig.json
├── requirements.txt
└── README.md
```

## Development

```bash
# Type checking
npm run typecheck

# Build
npm run build

# Run built version
npm start
```

## Extending

### Adding Telegram Publishing

The OUTPUT_DISPATCHER has a stub for publish hooks. To add Telegram:

1. Add Telegram bot token to `.env`
2. Create `mastra/tools/telegram_publisher.ts`
3. Call from `output_dispatcher.ts` after file persistence

### Adding Image Generation

Wire Google Imagen or other image models after the Gemini call:

1. Create `mastra/tools/image_generator.ts`
2. Add as Step 4 in `mastra/flow.ts`
3. Use the `final_prompt` and `negative_prompt` from PromptPackage

---

## Legacy: Original Streamlit App

The original Python-only Streamlit app is still available as `app.py`. To run it:

```bash
streamlit run app.py
```

This version uses Google Imagen directly without the Mastra workflow.
