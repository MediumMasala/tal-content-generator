"""
Character Profile Management for Tile Collage Studio.
Derives and stores consistent character identity from the anchor Tile photo.
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class CharacterProfile:
    """
    Represents the consistent identity of the Tile character.
    Used to maintain visual consistency across all generated scenes.
    """

    # Core identity descriptors
    gender_presentation: str = "unspecified"
    age_range: str = "unspecified"
    face_shape: str = "unspecified"
    hairstyle: str = "unspecified"
    hair_color: str = "unspecified"
    skin_tone: str = "unspecified"

    # Clothing and accessories
    signature_clothing: str = "casual attire"
    accessories: list[str] = field(default_factory=list)
    distinguishing_marks: list[str] = field(default_factory=list)

    # User-provided notes
    user_notes: str = ""

    # Computed properties
    image_hash: str = ""
    dominant_colors: list[str] = field(default_factory=list)

    # Embedding placeholder for future use with real models
    embedding_placeholder: Optional[list[float]] = None

    # Constraints that must not change across scenes
    do_not_change: list[str] = field(default_factory=lambda: [
        "same face structure and features",
        "same hairstyle and hair color",
        "same outfit and clothing style",
        "same body proportions",
        "same accessories and distinguishing marks",
    ])

    def to_prompt_string(self) -> str:
        """
        Convert profile to a textual prompt segment for image generation.
        This string should be prepended to every scene prompt.
        """
        parts = []

        # Core identity
        if self.gender_presentation != "unspecified":
            parts.append(self.gender_presentation)
        if self.age_range != "unspecified":
            parts.append(f"{self.age_range} years old")

        # Physical features
        features = []
        if self.face_shape != "unspecified":
            features.append(f"{self.face_shape} face")
        if self.hairstyle != "unspecified":
            hair_desc = self.hairstyle
            if self.hair_color != "unspecified":
                hair_desc = f"{self.hair_color} {hair_desc}"
            features.append(hair_desc)
        if self.skin_tone != "unspecified":
            features.append(f"{self.skin_tone} skin")

        if features:
            parts.append(", ".join(features))

        # Clothing
        if self.signature_clothing:
            parts.append(f"wearing {self.signature_clothing}")

        # Accessories
        if self.accessories:
            parts.append(f"with {', '.join(self.accessories)}")

        # Distinguishing marks
        if self.distinguishing_marks:
            parts.append(f"notable features: {', '.join(self.distinguishing_marks)}")

        # User notes
        if self.user_notes:
            parts.append(self.user_notes)

        return "; ".join(parts) if parts else "person matching the reference image exactly"

    def get_consistency_constraints(self) -> str:
        """
        Get the 'do not change' constraints as a prompt string.
        """
        return "IMPORTANT: " + "; ".join(self.do_not_change)

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "CharacterProfile":
        """Create from dictionary."""
        return cls(**data)


def compute_image_hash(image: Image.Image) -> str:
    """Compute a hash of the image for caching purposes."""
    img_array = np.array(image.convert("RGB"))
    return hashlib.md5(img_array.tobytes()).hexdigest()


def extract_dominant_colors(image: Image.Image, num_colors: int = 5) -> list[str]:
    """
    Extract dominant colors from an image.
    Returns color names/hex codes.
    """
    img = image.convert("RGB").resize((100, 100))
    pixels = np.array(img).reshape(-1, 3)

    # Simple k-means-like clustering for dominant colors
    from collections import Counter

    # Quantize colors to reduce variety
    quantized = (pixels // 32) * 32
    color_counts = Counter(map(tuple, quantized))
    top_colors = color_counts.most_common(num_colors)

    return [f"#{r:02x}{g:02x}{b:02x}" for (r, g, b), _ in top_colors]


def create_profile(
    anchor_image: Image.Image,
    user_notes: str = "",
    auto_detect: bool = True,
) -> CharacterProfile:
    """
    Create a character profile from the anchor Tile image.

    Args:
        anchor_image: The reference image of the Tile character
        user_notes: Optional user-provided description of the character
        auto_detect: Whether to attempt automatic feature detection

    Returns:
        CharacterProfile with derived identity traits
    """
    logger.info("Creating character profile from anchor image")

    profile = CharacterProfile(
        user_notes=user_notes,
        image_hash=compute_image_hash(anchor_image),
        dominant_colors=extract_dominant_colors(anchor_image),
    )

    if auto_detect:
        # Placeholder for future ML-based feature detection
        # For now, we use sensible defaults that emphasize consistency
        profile.do_not_change = [
            "same face structure, expression style, and facial features",
            "same hairstyle, hair color, and hair texture",
            "same outfit, clothing colors, and style",
            "same body proportions and posture tendencies",
            "same accessories and distinguishing marks",
            "consistent lighting on the character across scenes",
        ]

    # If user provided notes, parse them for key details
    if user_notes:
        notes_lower = user_notes.lower()

        # Simple keyword extraction
        if any(w in notes_lower for w in ["male", "man", "boy", "he"]):
            profile.gender_presentation = "male"
        elif any(w in notes_lower for w in ["female", "woman", "girl", "she"]):
            profile.gender_presentation = "female"

        # Age hints
        if any(w in notes_lower for w in ["young", "teen", "teenager"]):
            profile.age_range = "teenager"
        elif any(w in notes_lower for w in ["adult", "middle-aged"]):
            profile.age_range = "adult"
        elif any(w in notes_lower for w in ["elderly", "old", "senior"]):
            profile.age_range = "elderly"

    logger.info(f"Created profile with hash: {profile.image_hash[:8]}...")
    return profile


def save_profile(profile: CharacterProfile, path: Path) -> None:
    """Save a character profile to a JSON file."""
    with open(path, "w") as f:
        json.dump(profile.to_dict(), f, indent=2)


def load_profile(path: Path) -> Optional[CharacterProfile]:
    """Load a character profile from a JSON file."""
    if not path.exists():
        return None
    with open(path) as f:
        return CharacterProfile.from_dict(json.load(f))
