"""
Generator module for Tile Collage Studio.
Builds prompts with character consistency and orchestrates image generation.
"""

import logging
from dataclasses import dataclass
from typing import Optional

from PIL import Image

from adapters.nanobanana import (
    GenerationRequest,
    GenerationResult,
    NanoBananaAdapter,
    ImageGeneratorAdapter,
    get_adapter,
)
from adapters.google_imagen import GoogleImagenAdapter, get_google_adapter
from core.profile import CharacterProfile
from core.prompt_enhancer import PromptEnhancer, get_enhancer, get_tal_character_prompt

logger = logging.getLogger(__name__)


@dataclass
class StyleConfig:
    """Configuration for visual style across the collage."""

    mood: str = "neutral"
    color_palette: str = "natural"
    lighting: str = "soft natural lighting"
    art_style: str = "photorealistic"
    consistency_note: str = "maintain consistent lighting and color grading across all scenes"

    def to_prompt_suffix(self) -> str:
        """Convert style config to prompt suffix."""
        parts = [
            f"{self.art_style} style",
            f"{self.mood} mood",
            f"{self.lighting}",
            f"{self.color_palette} color palette",
            self.consistency_note,
        ]
        return ", ".join(parts)


# Predefined style presets
STYLE_PRESETS = {
    "cinematic": StyleConfig(
        mood="dramatic",
        color_palette="cinematic teal and orange",
        lighting="dramatic cinematic lighting",
        art_style="cinematic film still",
        consistency_note="consistent cinematic look across all frames",
    ),
    "bright_cheerful": StyleConfig(
        mood="happy and cheerful",
        color_palette="bright and vibrant colors",
        lighting="bright sunny lighting",
        art_style="clean modern photography",
        consistency_note="maintain bright cheerful atmosphere throughout",
    ),
    "moody_artistic": StyleConfig(
        mood="contemplative and artistic",
        color_palette="muted earth tones",
        lighting="soft diffused lighting with shadows",
        art_style="artistic portrait photography",
        consistency_note="consistent moody artistic feel",
    ),
    "minimalist": StyleConfig(
        mood="calm and focused",
        color_palette="minimal, mostly neutral with accent colors",
        lighting="clean even lighting",
        art_style="minimalist clean aesthetic",
        consistency_note="maintain clean minimal look",
    ),
    "vintage": StyleConfig(
        mood="nostalgic",
        color_palette="warm vintage film colors",
        lighting="soft golden hour lighting",
        art_style="vintage film photography",
        consistency_note="consistent retro film aesthetic",
    ),
    "default": StyleConfig(),
}


@dataclass
class GeneratedPanel:
    """A single generated panel for the collage."""

    thought: str
    prompt: str
    image: Image.Image
    index: int
    metadata: dict


def build_scene_prompt(
    thought: str,
    character_profile: CharacterProfile,
    style_config: StyleConfig,
    panel_index: int,
    total_panels: int,
    use_tal_mode: bool = True,
    is_pre_enhanced: bool = False,
) -> str:
    """
    Build a complete scene prompt that maintains character consistency.

    Args:
        thought: The user's thought/idea for this scene (or pre-enhanced prompt)
        character_profile: The character's profile
        style_config: Visual style configuration
        panel_index: Index of this panel (0-based)
        total_panels: Total number of panels being generated
        use_tal_mode: If True, use Tal-specific character description
        is_pre_enhanced: If True, thought is already a complete enhanced prompt

    Returns:
        Complete prompt string for the image generator
    """
    # If prompt was already enhanced by Gemini, it should already have character description
    # Just ensure it starts with the exact character prompt for photorealistic generation
    if is_pre_enhanced and use_tal_mode:
        tal_exact = get_tal_character_prompt()
        # Check if enhanced prompt already starts with photorealistic character description
        if thought.lower().startswith("photorealistic"):
            return thought
        else:
            # Prepend exact character description for reference-based generation
            return f"{tal_exact}. {thought}"

    if use_tal_mode:
        # Use Tal's EXACT character description - NEVER MODIFY
        character_desc = get_tal_character_prompt()
    else:
        character_desc = character_profile.to_prompt_string()

    # Build the scene description
    # Character description MUST come first and be complete
    prompt = f"{character_desc}. Scene: {thought}."

    return prompt


def build_neutral_scene_prompt(
    character_profile: CharacterProfile,
    style_config: StyleConfig,
    panel_index: int,
) -> str:
    """
    Build a neutral scene prompt for padding when needed.
    The character should still be present and consistent.
    """
    character_desc = character_profile.to_prompt_string()

    neutral_scenes = [
        "standing in a contemplative pose",
        "looking thoughtfully into the distance",
        "in a moment of peaceful reflection",
        "with a gentle, natural expression",
        "in a candid, relaxed moment",
    ]

    scene = neutral_scenes[panel_index % len(neutral_scenes)]

    return (
        f"A portrait of {character_desc}, {scene}. "
        f"Same person as reference image, exact same features and appearance. "
        f"{style_config.to_prompt_suffix()}. "
        f"{character_profile.get_consistency_constraints()}"
    )


def get_best_adapter(dry_run: bool = True, use_google: bool = True) -> ImageGeneratorAdapter:
    """
    Get the best available adapter based on configuration.

    Args:
        dry_run: If True, use placeholder mode
        use_google: If True, prefer Google Imagen adapter

    Returns:
        Configured image generation adapter
    """
    if dry_run:
        return get_adapter(dry_run=True)

    if use_google:
        import os
        api_key = os.environ.get("GOOGLE_API_KEY")
        if api_key:
            logger.info("Using Google Imagen adapter with API key")
            return get_google_adapter(api_key=api_key, dry_run=False)
        else:
            logger.warning("GOOGLE_API_KEY not set, falling back to placeholder")
            return get_adapter(dry_run=True)

    return get_adapter(dry_run=dry_run)


class CollageGenerator:
    """
    Orchestrates the generation of collage panels with character consistency.
    """

    def __init__(
        self,
        adapter: Optional[ImageGeneratorAdapter] = None,
        dry_run: bool = True,
        use_google: bool = True,
        enhance_prompts: bool = True,
    ):
        """
        Initialize the generator.

        Args:
            adapter: Image generation adapter. If None, creates default.
            dry_run: If True, use placeholder mode.
            use_google: If True and not dry_run, prefer Google Imagen adapter.
            enhance_prompts: If True, use Gemini to enhance user prompts.
        """
        self.adapter = adapter or get_best_adapter(dry_run=dry_run, use_google=use_google)
        self.enhance_prompts = enhance_prompts
        self.enhancer = get_enhancer() if enhance_prompts else None
        logger.info(
            f"CollageGenerator initialized (adapter: {type(self.adapter).__name__}, "
            f"available: {self.adapter.is_available()}, enhance_prompts: {enhance_prompts})"
        )

    def generate_panels(
        self,
        anchor_image: Image.Image,
        thoughts: list[str],
        character_profile: CharacterProfile,
        style_preset: str = "default",
        custom_style: Optional[StyleConfig] = None,
        panel_size: tuple[int, int] = (512, 512),
        identity_strength: float = 0.85,
        seed: Optional[int] = None,
        use_tal_mode: bool = True,
    ) -> list[GeneratedPanel]:
        """
        Generate all panels for the collage.

        Args:
            anchor_image: The reference Tal image
            thoughts: List of thought strings for each panel
            character_profile: The character's identity profile
            style_preset: Name of predefined style preset
            custom_style: Custom StyleConfig (overrides preset)
            panel_size: Size of each generated panel
            identity_strength: How strongly to preserve reference identity
            seed: Optional random seed for reproducibility
            use_tal_mode: If True, use Tal-specific character prompting

        Returns:
            List of GeneratedPanel objects
        """
        style = custom_style or STYLE_PRESETS.get(style_preset, STYLE_PRESETS["default"])

        panels = []
        total_panels = len(thoughts)

        logger.info(f"Generating {total_panels} panels with style preset: {style_preset}")

        # Enhance all prompts first if enhancer is available
        enhanced_thoughts = []
        if self.enhance_prompts and self.enhancer:
            logger.info("Enhancing prompts with Gemini...")
            for thought in thoughts:
                try:
                    enhanced = self.enhancer.enhance(thought, style_preset)
                    enhanced_thoughts.append(enhanced)
                    logger.info(f"Enhanced: '{thought[:30]}...' -> '{enhanced['enhanced'][:50]}...'")
                except Exception as e:
                    logger.warning(f"Enhancement failed for '{thought}': {e}")
                    enhanced_thoughts.append({"original": thought, "enhanced": thought})
        else:
            enhanced_thoughts = [{"original": t, "enhanced": t} for t in thoughts]

        for i, (thought, enhanced) in enumerate(zip(thoughts, enhanced_thoughts)):
            logger.info(f"Generating panel {i + 1}/{total_panels}: {thought[:50]}...")

            # Use enhanced prompt if available
            scene_thought = enhanced.get("enhanced", thought)

            # Check if this was enhanced by Gemini
            is_enhanced = self.enhance_prompts and enhanced.get("enhanced") != enhanced.get("original")

            prompt = build_scene_prompt(
                thought=scene_thought,
                character_profile=character_profile,
                style_config=style,
                panel_index=i,
                total_panels=total_panels,
                use_tal_mode=use_tal_mode,
                is_pre_enhanced=is_enhanced,
            )

            request = GenerationRequest(
                prompt=prompt,
                reference_images=[anchor_image],
                width=panel_size[0],
                height=panel_size[1],
                seed=seed + i if seed else None,
                identity_strength=identity_strength,
                reference_weight=0.75,
                style_preset=style_preset,
            )

            result = self.adapter.generate(request)

            panels.append(
                GeneratedPanel(
                    thought=thought,
                    prompt=prompt,
                    image=result.image,
                    index=i,
                    metadata={
                        "seed_used": result.seed_used,
                        "generation_metadata": result.metadata,
                        "original_thought": enhanced.get("original", thought),
                        "enhanced_prompt": enhanced.get("enhanced", thought),
                        "scene_description": enhanced.get("scene_description", ""),
                        "mood": enhanced.get("mood", ""),
                        "prompt_enhanced": self.enhance_prompts,
                    },
                )
            )

        return panels

    def generate_padding_panels(
        self,
        anchor_image: Image.Image,
        character_profile: CharacterProfile,
        count: int,
        style_preset: str = "default",
        panel_size: tuple[int, int] = (512, 512),
        identity_strength: float = 0.85,
        start_index: int = 0,
    ) -> list[GeneratedPanel]:
        """
        Generate neutral padding panels when more panels are needed than thoughts.
        """
        style = STYLE_PRESETS.get(style_preset, STYLE_PRESETS["default"])
        panels = []

        for i in range(count):
            prompt = build_neutral_scene_prompt(
                character_profile=character_profile,
                style_config=style,
                panel_index=start_index + i,
            )

            request = GenerationRequest(
                prompt=prompt,
                reference_images=[anchor_image],
                width=panel_size[0],
                height=panel_size[1],
                identity_strength=identity_strength,
            )

            result = self.adapter.generate(request)

            panels.append(
                GeneratedPanel(
                    thought="[neutral scene]",
                    prompt=prompt,
                    image=result.image,
                    index=start_index + i,
                    metadata={"padding": True},
                )
            )

        return panels
