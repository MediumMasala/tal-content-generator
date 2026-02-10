"""
Storage utilities for Tile Collage Studio.
Handles file I/O, directory management, and metadata persistence.
"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from PIL import Image


def get_output_dir() -> Path:
    """Get the base output directory from env or default."""
    return Path(os.environ.get("OUTPUT_DIR", "./outputs"))


def get_published_dir() -> Path:
    """Get the base published directory from env or default."""
    return Path(os.environ.get("PUBLISHED_DIR", "./published"))


def generate_run_id() -> str:
    """Generate a unique run ID with timestamp prefix."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    short_uuid = uuid.uuid4().hex[:8]
    return f"{timestamp}_{short_uuid}"


def get_run_dir(run_id: str) -> Path:
    """Get the directory for a specific run."""
    return get_output_dir() / run_id


def ensure_run_dir(run_id: str) -> Path:
    """Create and return the run directory."""
    run_dir = get_run_dir(run_id)
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "panels").mkdir(exist_ok=True)
    return run_dir


def save_image(image: Image.Image, path: Path) -> Path:
    """Save a PIL Image to the specified path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG")
    return path


def load_image(path: Path) -> Image.Image:
    """Load an image from path."""
    return Image.open(path).convert("RGBA")


def save_metadata(run_id: str, metadata: dict[str, Any]) -> Path:
    """Save metadata JSON for a run."""
    run_dir = get_run_dir(run_id)
    metadata_path = run_dir / "metadata.json"

    # Add timestamp if not present
    if "timestamp" not in metadata:
        metadata["timestamp"] = datetime.now().isoformat()
    if "run_id" not in metadata:
        metadata["run_id"] = run_id

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return metadata_path


def load_metadata(run_id: str) -> Optional[dict[str, Any]]:
    """Load metadata JSON for a run."""
    metadata_path = get_run_dir(run_id) / "metadata.json"
    if not metadata_path.exists():
        return None
    with open(metadata_path) as f:
        return json.load(f)


def save_collage(run_id: str, collage: Image.Image) -> Path:
    """Save the final collage image."""
    run_dir = ensure_run_dir(run_id)
    collage_path = run_dir / "collage.png"
    return save_image(collage, collage_path)


def save_panel(run_id: str, panel_index: int, panel: Image.Image) -> Path:
    """Save an individual panel image."""
    run_dir = ensure_run_dir(run_id)
    panel_path = run_dir / "panels" / f"panel_{panel_index:02d}.png"
    return save_image(panel, panel_path)


def collage_exists(run_id: str) -> bool:
    """Check if a collage exists for the given run."""
    return (get_run_dir(run_id) / "collage.png").exists()


def get_collage_path(run_id: str) -> Path:
    """Get the path to a run's collage."""
    return get_run_dir(run_id) / "collage.png"
