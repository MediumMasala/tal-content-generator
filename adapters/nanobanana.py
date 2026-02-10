"""
Nano Banana Image Generation Adapter.

This module provides an interface to the Nano Banana image generation model.
Currently implements a placeholder/dry-run mode that generates debug images.
Replace the placeholder implementation with real API calls when available.
"""

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)


@dataclass
class GenerationRequest:
    """Request parameters for image generation."""

    prompt: str
    reference_images: list[Image.Image]
    width: int = 512
    height: int = 512
    seed: Optional[int] = None
    identity_strength: float = 0.8  # How strongly to preserve reference identity (0-1)
    reference_weight: float = 0.7  # Weight of reference image in generation
    style_preset: Optional[str] = None
    negative_prompt: str = ""


@dataclass
class GenerationResult:
    """Result from image generation."""

    image: Image.Image
    prompt_used: str
    seed_used: Optional[int]
    metadata: dict


class ImageGeneratorAdapter(ABC):
    """Abstract base class for image generation adapters."""

    @abstractmethod
    def generate(self, request: GenerationRequest) -> GenerationResult:
        """Generate an image based on the request parameters."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the adapter is available and configured."""
        pass


class NanoBananaAdapter(ImageGeneratorAdapter):
    """
    Adapter for the Nano Banana image generation model.

    TODO: Replace placeholder implementation with real API calls:
    1. Set NANOBANANA_API_KEY environment variable
    2. Implement _call_api() method with actual API endpoint
    3. Handle image upload for reference images
    4. Parse API response and extract generated image
    """

    def __init__(self, api_key: Optional[str] = None, dry_run: bool = False):
        """
        Initialize the Nano Banana adapter.

        Args:
            api_key: API key for Nano Banana. If None, reads from NANOBANANA_API_KEY env var.
            dry_run: If True, always use placeholder generation (useful for testing).
        """
        self.api_key = api_key or os.environ.get("NANOBANANA_API_KEY")
        self.dry_run = dry_run
        self.api_endpoint = os.environ.get(
            "NANOBANANA_API_ENDPOINT",
            "https://api.nanobanana.ai/v1/generate"  # Placeholder URL
        )

        logger.info(
            f"NanoBananaAdapter initialized (dry_run={dry_run}, "
            f"has_api_key={bool(self.api_key)})"
        )

    def is_available(self) -> bool:
        """Check if the real API is available."""
        if self.dry_run:
            return False
        return bool(self.api_key)

    def generate(self, request: GenerationRequest) -> GenerationResult:
        """
        Generate an image based on the request.

        In dry-run mode (or if API is unavailable), returns a placeholder image
        with the prompt text rendered on it.
        """
        logger.info(f"Generation request: {request.prompt[:100]}...")

        if self.dry_run or not self.is_available():
            logger.info("Using placeholder generation (dry-run mode)")
            return self._generate_placeholder(request)

        # TODO: Implement real API call
        return self._call_api(request)

    def _generate_placeholder(self, request: GenerationRequest) -> GenerationResult:
        """
        Generate a placeholder image with the prompt text.
        Useful for debugging prompts without making real API calls.
        """
        # Create a gradient background
        img = Image.new("RGB", (request.width, request.height))
        draw = ImageDraw.Draw(img)

        # Create a nice gradient background
        for y in range(request.height):
            # Purple to blue gradient
            r = int(80 + (y / request.height) * 40)
            g = int(60 + (y / request.height) * 80)
            b = int(120 + (y / request.height) * 80)
            draw.line([(0, y), (request.width, y)], fill=(r, g, b))

        # Add a placeholder character silhouette
        center_x = request.width // 2
        center_y = request.height // 2

        # Draw a simple figure silhouette
        head_radius = min(request.width, request.height) // 10
        body_width = head_radius * 2
        body_height = head_radius * 4

        # Head
        draw.ellipse(
            [
                center_x - head_radius,
                center_y - body_height // 2 - head_radius,
                center_x + head_radius,
                center_y - body_height // 2 + head_radius,
            ],
            fill=(200, 200, 220),
            outline=(150, 150, 170),
        )

        # Body
        draw.rounded_rectangle(
            [
                center_x - body_width // 2,
                center_y - body_height // 2 + head_radius,
                center_x + body_width // 2,
                center_y + body_height // 2,
            ],
            radius=10,
            fill=(180, 180, 200),
            outline=(150, 150, 170),
        )

        # Add prompt text overlay
        self._draw_text_wrapped(
            draw,
            f"[PLACEHOLDER]\n\n{request.prompt}",
            (10, 10),
            request.width - 20,
            fill=(255, 255, 255, 200),
        )

        # Add reference indicator if reference images provided
        if request.reference_images:
            ref_text = f"[Ref images: {len(request.reference_images)}]"
            draw.text((10, request.height - 30), ref_text, fill=(200, 200, 255))

        # Add identity strength indicator
        strength_text = f"[Identity: {request.identity_strength:.0%}]"
        draw.text((10, request.height - 50), strength_text, fill=(200, 255, 200))

        return GenerationResult(
            image=img,
            prompt_used=request.prompt,
            seed_used=request.seed,
            metadata={
                "mode": "placeholder",
                "identity_strength": request.identity_strength,
                "reference_weight": request.reference_weight,
                "reference_count": len(request.reference_images),
            },
        )

    def _draw_text_wrapped(
        self,
        draw: ImageDraw.ImageDraw,
        text: str,
        position: tuple[int, int],
        max_width: int,
        fill=(255, 255, 255),
    ):
        """Draw text with word wrapping."""
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        except (OSError, IOError):
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
            except (OSError, IOError):
                font = ImageFont.load_default()

        lines = []
        for paragraph in text.split("\n"):
            words = paragraph.split()
            current_line = []

            for word in words:
                test_line = " ".join(current_line + [word])
                bbox = draw.textbbox((0, 0), test_line, font=font)
                if bbox[2] - bbox[0] <= max_width:
                    current_line.append(word)
                else:
                    if current_line:
                        lines.append(" ".join(current_line))
                    current_line = [word]

            if current_line:
                lines.append(" ".join(current_line))
            else:
                lines.append("")

        y = position[1]
        for line in lines[:15]:  # Limit to 15 lines
            draw.text((position[0], y), line, font=font, fill=fill)
            y += 18

    def _call_api(self, request: GenerationRequest) -> GenerationResult:
        """
        Call the real Nano Banana API.

        TODO: Implement this method with actual API integration:

        1. Prepare the request payload:
           payload = {
               "prompt": request.prompt,
               "negative_prompt": request.negative_prompt,
               "width": request.width,
               "height": request.height,
               "seed": request.seed,
               "identity_strength": request.identity_strength,
               "reference_weight": request.reference_weight,
               "style_preset": request.style_preset,
           }

        2. Upload/encode reference images:
           - Convert PIL Images to base64 or upload to temporary storage
           - Add reference image URLs/data to payload

        3. Make the API call:
           response = requests.post(
               self.api_endpoint,
               headers={"Authorization": f"Bearer {self.api_key}"},
               json=payload,
           )

        4. Parse response and return GenerationResult:
           - Decode generated image from response
           - Extract metadata (actual seed used, etc.)

        5. Handle errors appropriately:
           - Rate limiting
           - Invalid API key
           - Content policy violations
           - Network errors
        """
        raise NotImplementedError(
            "Real Nano Banana API integration not implemented. "
            "Set dry_run=True or implement _call_api() with actual API calls. "
            "See TODO comments in this method for implementation guide."
        )


def get_adapter(dry_run: bool = True) -> NanoBananaAdapter:
    """
    Factory function to get a configured adapter.

    Args:
        dry_run: If True, returns adapter in dry-run mode (placeholder images).

    Returns:
        Configured NanoBananaAdapter instance.
    """
    return NanoBananaAdapter(dry_run=dry_run)
