"""
TAL Image Prompt Builder - Prompt Enhancement Layer

Converts user requests into SAFE, photorealistic image-generation prompts
with strict character consistency using the TAL Anchor Image.
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# System prompt for TAL Image Generator
TAL_SYSTEM_PROMPT = """
You are "TAL Image Prompt Builder": a strict prompt-enhancement layer that converts a user's request into a SAFE, photorealistic image-generation prompt.

PRIMARY OBJECTIVE
Generate prompts that ALWAYS:
1) Keep the TAL character consistent using the provided character reference image (the "TAL Anchor Image").
2) Look like a REAL photograph of a REAL person in a REAL location (photorealistic, not animated).
3) Avoid using or referencing celebrities, famous people, politicians, or public figures in any way.

NON-NEGOTIABLE CONSTRAINTS

A) Character consistency (hard rule)
- The person in the generated image MUST match the TAL Anchor Image identity consistently (face, hairstyle, skin tone, body type, signature accessories, clothing vibe).
- Use the anchor image as a strong reference every time.
- Do NOT describe the character in a way that changes their identity.
- If the user asks to change the character identity, refuse that part and keep the character consistent.

B) Photorealism (hard rule)
- Output must look like a real camera photo taken in the real world.
- Absolutely avoid: cartoon, anime, illustration, 3D render, Pixar/Disney vibe, sketch, painting, CGI, plastic skin, over-stylized HDR.
- Prefer documentary / lifestyle photography cues: natural lighting, realistic textures, believable environment, camera lens details, mild depth-of-field, realistic shadows.

C) NO celebrities / NO famous people / NO politicians (hard rule)
- Never use any celebrity name, politician name, public figure reference.
- If the user request includes any public figure: remove it and replace with a generic description.
- If the user's request fundamentally requires a specific public figure, refuse and ask them to reframe.

D) Safety + legality (hard rule)
- Do not generate disallowed content.
- Avoid real company logos, trademarked characters, and copyrighted mascots.

E) Locations must be real-world
- Render believable real locations (street, café, office, metro station, stadium, etc.)
- If location is missing: infer a plausible real location that matches the scenario.

PROMPT ENHANCEMENT RULES
1) Extract intent: Scene type, Setting, Time/weather, Mood, Wardrobe, Camera framing, Objects
2) Convert vague requests into concrete photographic direction with camera/lens cues
3) Preserve user's idea but enforce constraints
4) Always include a "Negative prompt" to suppress non-photoreal styles

OUTPUT FORMAT (MUST FOLLOW EXACTLY)
Return ONLY a single JSON object with these keys:
{
  "final_prompt": string,
  "negative_prompt": string,
  "reference_strength": number,
  "size": string,
  "n": number,
  "seed": null,
  "assumptions": [string],
  "policy_notes": [string]
}

DEFAULTS
- size: "1024x1024"
- reference_strength: 0.85
- n: 1
- Style baseline: "photorealistic, natural light, candid lifestyle photo, realistic skin texture, subtle depth of field"

NEGATIVE PROMPT BASE (always include):
"cartoon, anime, illustration, 3d, cgi, render, painting, sketch, comic, unreal engine, pixar, disney, doll-like, plastic skin, oversharpened, extra limbs, deformed face, blurry, watermark, text, logo, brand marks, celebrity, politician, public figure"
"""

# Default negative prompt
DEFAULT_NEGATIVE_PROMPT = (
    "cartoon, anime, illustration, 3d, cgi, render, painting, sketch, comic, "
    "unreal engine, pixar, disney, doll-like, plastic skin, oversharpened, "
    "extra limbs, deformed face, blurry, watermark, text, logo, brand marks, "
    "celebrity, politician, public figure, deformed, bad anatomy, bad proportions"
)

# Default style baseline
DEFAULT_STYLE_BASELINE = (
    "photorealistic, natural light, candid lifestyle photo, realistic skin texture, "
    "subtle depth of field, 35mm photography, high quality, detailed"
)


class PromptEnhancer:
    """
    TAL Image Prompt Builder - Enhances simple user prompts into
    photorealistic image generation prompts with strict character consistency.
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the prompt enhancer.

        Args:
            api_key: Google API key. If None, reads from GOOGLE_API_KEY env var.
        """
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self._client = None
        self._model = None
        logger.info(f"PromptEnhancer initialized (has_key={bool(self.api_key)})")

    def _init_model(self):
        """Initialize Gemini model lazily."""
        if self._client is not None:
            return

        try:
            from google import genai

            self._client = genai.Client(api_key=self.api_key)
            self._model = "gemini-2.0-flash"
            logger.info("Gemini client initialized for prompt enhancement")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
            raise

    def enhance(
        self,
        user_request: str,
        style_preset: str = "default",
        additional_context: str = "",
    ) -> dict:
        """
        Enhance a user request into a complete image generation prompt package.

        Args:
            user_request: The user's natural language description
            style_preset: Optional style preset
            additional_context: Optional additional context

        Returns:
            Dictionary with:
            - final_prompt: Complete prompt for image generation
            - negative_prompt: What to avoid
            - reference_strength: How strongly to match reference (0-1)
            - size: Image dimensions
            - n: Number of images
            - seed: Random seed or null
            - assumptions: What was assumed from vague input
            - policy_notes: Any policy enforcement notes
        """
        if not self.api_key:
            logger.warning("No API key, using basic enhancement")
            return self._basic_enhance(user_request)

        try:
            self._init_model()
            return self._gemini_enhance(user_request, additional_context)
        except Exception as e:
            logger.error(f"Gemini enhancement failed: {e}")
            return self._basic_enhance(user_request)

    def _gemini_enhance(
        self,
        user_request: str,
        additional_context: str,
    ) -> dict:
        """Use Gemini to enhance the prompt following TAL system rules."""

        from google.genai.types import GenerateContentConfig

        user_message = f"""User request: "{user_request}"

Additional context: {additional_context if additional_context else "None"}

Generate the JSON prompt package following the system rules exactly. Output ONLY valid JSON, no markdown."""

        response = self._client.models.generate_content(
            model=self._model,
            contents=f"{TAL_SYSTEM_PROMPT}\n\n{user_message}",
            config=GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1000,
            )
        )

        response_text = response.text.strip()

        # Try to parse JSON from response
        try:
            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()

            result = json.loads(response_text)

            # Ensure all required fields exist
            result.setdefault("final_prompt", self._basic_enhance(user_request)["final_prompt"])
            result.setdefault("negative_prompt", DEFAULT_NEGATIVE_PROMPT)
            result.setdefault("reference_strength", 0.85)
            result.setdefault("size", "1024x1024")
            result.setdefault("n", 1)
            result.setdefault("seed", None)
            result.setdefault("assumptions", [])
            result.setdefault("policy_notes", [])

            # Add original for tracking
            result["original"] = user_request
            result["enhanced"] = result["final_prompt"]

            return result

        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON response, using as raw prompt")
            return {
                "original": user_request,
                "enhanced": response_text,
                "final_prompt": response_text,
                "negative_prompt": DEFAULT_NEGATIVE_PROMPT,
                "reference_strength": 0.85,
                "size": "1024x1024",
                "n": 1,
                "seed": None,
                "assumptions": ["Could not parse structured response"],
                "policy_notes": [],
            }

    def _basic_enhance(self, user_request: str) -> dict:
        """Basic enhancement without Gemini (fallback)."""

        # Build a photorealistic prompt
        final_prompt = (
            f"Photorealistic photograph of a person, {DEFAULT_STYLE_BASELINE}. "
            f"Scene: {user_request}. "
            f"The person should match the reference image exactly - same face, hairstyle, features. "
            f"Real camera photo, natural environment, believable lighting."
        )

        return {
            "original": user_request,
            "enhanced": final_prompt,
            "final_prompt": final_prompt,
            "negative_prompt": DEFAULT_NEGATIVE_PROMPT,
            "reference_strength": 0.85,
            "size": "1024x1024",
            "n": 1,
            "seed": None,
            "assumptions": ["Using basic enhancement without AI"],
            "policy_notes": [],
        }

    def enhance_batch(
        self,
        requests: list[str],
        style_preset: str = "default",
    ) -> list[dict]:
        """Enhance multiple requests."""
        return [self.enhance(req, style_preset) for req in requests]


def get_tal_character_prompt() -> str:
    """
    Get the base TAL character prompt for photorealistic generation.
    The actual character details come from the reference image.
    """
    return (
        "Photorealistic photograph of a person matching the reference image exactly, "
        "same face, same features, same identity, natural lighting, "
        "candid lifestyle photography style, 35mm lens, realistic skin texture, "
        "subtle depth of field, high quality detailed photo"
    )


def get_negative_prompt() -> str:
    """Get the default negative prompt."""
    return DEFAULT_NEGATIVE_PROMPT


def get_enhancer(api_key: Optional[str] = None) -> PromptEnhancer:
    """Factory function to create a PromptEnhancer."""
    return PromptEnhancer(api_key=api_key)
