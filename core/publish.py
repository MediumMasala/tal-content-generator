"""
Publish Module for Tile Collage Studio.
Handles exporting and publishing generated collages.
"""

import json
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from core.storage import (
    collage_exists,
    get_collage_path,
    get_published_dir,
    load_metadata,
)

logger = logging.getLogger(__name__)


class PublishError(Exception):
    """Error during publishing."""

    pass


def publish(run_id: str) -> dict:
    """
    Publish a generated collage.

    - Validates that collage exists
    - Copies to ./published/{date}/
    - Appends entry to published_index.jsonl

    Args:
        run_id: The run ID of the collage to publish

    Returns:
        Dictionary with publish info including the path

    Raises:
        PublishError: If collage doesn't exist or publish fails
    """
    logger.info(f"Publishing collage for run: {run_id}")

    # Validate collage exists
    if not collage_exists(run_id):
        raise PublishError(f"No collage found for run_id: {run_id}")

    source_path = get_collage_path(run_id)

    # Create date-based publish directory
    today = datetime.now().strftime("%Y-%m-%d")
    publish_dir = get_published_dir() / today
    publish_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    timestamp = datetime.now().strftime("%H%M%S")
    dest_filename = f"collage_{run_id}_{timestamp}.png"
    dest_path = publish_dir / dest_filename

    # Copy the collage
    try:
        shutil.copy2(source_path, dest_path)
        logger.info(f"Copied collage to: {dest_path}")
    except Exception as e:
        raise PublishError(f"Failed to copy collage: {e}")

    # Load metadata if available
    metadata = load_metadata(run_id) or {}

    # Create publish record
    publish_record = {
        "run_id": run_id,
        "published_at": datetime.now().isoformat(),
        "source_path": str(source_path),
        "published_path": str(dest_path),
        "original_metadata": metadata,
    }

    # Append to index
    index_path = get_published_dir() / "published_index.jsonl"
    try:
        with open(index_path, "a") as f:
            f.write(json.dumps(publish_record) + "\n")
        logger.info(f"Added entry to publish index")
    except Exception as e:
        logger.warning(f"Failed to update publish index: {e}")

    return {
        "success": True,
        "run_id": run_id,
        "published_path": str(dest_path),
        "published_at": publish_record["published_at"],
    }


def get_published_history(limit: int = 50) -> list[dict]:
    """
    Get recent publish history from the index.

    Args:
        limit: Maximum number of entries to return

    Returns:
        List of publish records, newest first
    """
    index_path = get_published_dir() / "published_index.jsonl"

    if not index_path.exists():
        return []

    records = []
    try:
        with open(index_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    except Exception as e:
        logger.error(f"Failed to read publish index: {e}")
        return []

    # Return newest first
    records.reverse()
    return records[:limit]


def publish_to_telegram(
    run_id: str,
    chat_id: Optional[str] = None,
    caption: Optional[str] = None,
    bot_token: Optional[str] = None,
) -> dict:
    """
    STUB: Publish a collage to Telegram.

    This function is a placeholder for future Telegram integration.
    DO NOT implement until explicitly requested.

    Args:
        run_id: The run ID of the collage to publish
        chat_id: Telegram chat/channel ID to post to
        caption: Optional caption for the image
        bot_token: Telegram bot token (or from env)

    Returns:
        Dictionary with result info

    TODO: Implementation steps when needed:
    1. Get TELEGRAM_BOT_TOKEN from env if not provided
    2. Get TELEGRAM_CHAT_ID from env if not provided
    3. Validate collage exists
    4. Use python-telegram-bot or requests to:
       - Upload image via sendPhoto API
       - Include caption if provided
    5. Return message_id and success status
    6. Update publish index with Telegram details
    """
    raise NotImplementedError(
        "Telegram publishing is not yet implemented. "
        "This is a stub function for future use. "
        "Request implementation when needed."
    )


def export_for_sharing(run_id: str, output_path: Optional[Path] = None) -> Path:
    """
    Export a collage with its metadata for easy sharing.

    Creates a self-contained export with:
    - collage.png
    - metadata.json

    Args:
        run_id: The run ID to export
        output_path: Optional custom output path

    Returns:
        Path to the export directory
    """
    if not collage_exists(run_id):
        raise PublishError(f"No collage found for run_id: {run_id}")

    # Create export directory
    if output_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = Path(f"./exports/collage_{timestamp}")

    output_path.mkdir(parents=True, exist_ok=True)

    # Copy collage
    source_collage = get_collage_path(run_id)
    dest_collage = output_path / "collage.png"
    shutil.copy2(source_collage, dest_collage)

    # Copy/create metadata
    metadata = load_metadata(run_id) or {"run_id": run_id}
    metadata["exported_at"] = datetime.now().isoformat()

    with open(output_path / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Exported to: {output_path}")
    return output_path
