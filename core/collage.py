"""
Collage Composition Module for Tile Collage Studio.
Composes generated panels and anchor image into the final collage.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)


class AnchorPosition(Enum):
    """Position options for the anchor Tile image in the collage."""

    TOP_LEFT = "top_left"
    TOP_RIGHT = "top_right"
    BOTTOM_LEFT = "bottom_left"
    BOTTOM_RIGHT = "bottom_right"
    CENTER_LEFT = "center_left"
    CENTER_RIGHT = "center_right"
    CENTER = "center"


class LayoutType(Enum):
    """Supported collage layout types."""

    GRID_2X2 = "2x2"
    GRID_3X3 = "3x3"
    GRID_2X3 = "2x3"
    GRID_3X2 = "3x2"
    ROW_1X3 = "1x3"
    ROW_1X4 = "1x4"
    COLUMN_3X1 = "3x1"
    COLUMN_4X1 = "4x1"
    FEATURED = "featured"  # Large anchor + smaller panels


@dataclass
class LayoutConfig:
    """Configuration for collage layout."""

    layout_type: LayoutType = LayoutType.GRID_2X2
    anchor_position: AnchorPosition = AnchorPosition.TOP_LEFT
    padding: int = 4
    border_width: int = 2
    border_color: tuple[int, int, int] = (255, 255, 255)
    background_color: tuple[int, int, int] = (30, 30, 30)
    output_size: tuple[int, int] = (1080, 1080)
    show_captions: bool = False
    caption_font_size: int = 14
    caption_color: tuple[int, int, int] = (255, 255, 255)
    caption_bg_opacity: int = 180


def get_layout_grid(layout_type: LayoutType) -> tuple[int, int]:
    """Get grid dimensions (rows, cols) for a layout type."""
    grids = {
        LayoutType.GRID_2X2: (2, 2),
        LayoutType.GRID_3X3: (3, 3),
        LayoutType.GRID_2X3: (2, 3),
        LayoutType.GRID_3X2: (3, 2),
        LayoutType.ROW_1X3: (1, 3),
        LayoutType.ROW_1X4: (1, 4),
        LayoutType.COLUMN_3X1: (3, 1),
        LayoutType.COLUMN_4X1: (4, 1),
        LayoutType.FEATURED: (2, 2),  # Special handling
    }
    return grids.get(layout_type, (2, 2))


def get_panel_count(layout_type: LayoutType) -> int:
    """Get total number of panels (including anchor) for a layout."""
    rows, cols = get_layout_grid(layout_type)
    return rows * cols


def get_anchor_grid_position(
    anchor_position: AnchorPosition,
    rows: int,
    cols: int,
) -> tuple[int, int]:
    """
    Convert anchor position enum to grid coordinates (row, col).
    """
    positions = {
        AnchorPosition.TOP_LEFT: (0, 0),
        AnchorPosition.TOP_RIGHT: (0, cols - 1),
        AnchorPosition.BOTTOM_LEFT: (rows - 1, 0),
        AnchorPosition.BOTTOM_RIGHT: (rows - 1, cols - 1),
        AnchorPosition.CENTER_LEFT: (rows // 2, 0),
        AnchorPosition.CENTER_RIGHT: (rows // 2, cols - 1),
        AnchorPosition.CENTER: (rows // 2, cols // 2),
    }
    return positions.get(anchor_position, (0, 0))


def calculate_cell_size(
    output_size: tuple[int, int],
    rows: int,
    cols: int,
    padding: int,
) -> tuple[int, int]:
    """Calculate the size of each cell in the grid."""
    total_padding_x = padding * (cols + 1)
    total_padding_y = padding * (rows + 1)

    cell_width = (output_size[0] - total_padding_x) // cols
    cell_height = (output_size[1] - total_padding_y) // rows

    return cell_width, cell_height


def get_cell_position(
    row: int,
    col: int,
    cell_size: tuple[int, int],
    padding: int,
) -> tuple[int, int]:
    """Get the top-left position of a cell in the collage."""
    x = padding + col * (cell_size[0] + padding)
    y = padding + row * (cell_size[1] + padding)
    return x, y


def resize_image_to_cell(
    image: Image.Image,
    cell_size: tuple[int, int],
    border_width: int = 0,
) -> Image.Image:
    """
    Resize and crop an image to fit a cell, maintaining aspect ratio.
    """
    target_width = cell_size[0] - 2 * border_width
    target_height = cell_size[1] - 2 * border_width

    # Calculate aspect ratios
    img_aspect = image.width / image.height
    cell_aspect = target_width / target_height

    if img_aspect > cell_aspect:
        # Image is wider, fit by height and crop width
        new_height = target_height
        new_width = int(new_height * img_aspect)
    else:
        # Image is taller, fit by width and crop height
        new_width = target_width
        new_height = int(new_width / img_aspect)

    # Resize
    resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Center crop
    left = (new_width - target_width) // 2
    top = (new_height - target_height) // 2
    cropped = resized.crop((left, top, left + target_width, top + target_height))

    return cropped


def add_caption_to_image(
    image: Image.Image,
    caption: str,
    font_size: int = 14,
    text_color: tuple[int, int, int] = (255, 255, 255),
    bg_opacity: int = 180,
) -> Image.Image:
    """Add a caption overlay to the bottom of an image."""
    if not caption or caption.startswith("["):
        return image

    img = image.copy()
    draw = ImageDraw.Draw(img)

    # Get font
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    # Calculate text size and position
    bbox = draw.textbbox((0, 0), caption, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Truncate if too long
    max_width = img.width - 20
    if text_width > max_width:
        while text_width > max_width and len(caption) > 10:
            caption = caption[:-4] + "..."
            bbox = draw.textbbox((0, 0), caption, font=font)
            text_width = bbox[2] - bbox[0]

    # Draw semi-transparent background
    padding = 6
    bg_top = img.height - text_height - padding * 2 - 5
    bg_rect = [0, bg_top, img.width, img.height]

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle(bg_rect, fill=(0, 0, 0, bg_opacity))

    img = img.convert("RGBA")
    img = Image.alpha_composite(img, overlay)
    img = img.convert("RGB")

    # Draw text
    draw = ImageDraw.Draw(img)
    text_x = (img.width - text_width) // 2
    text_y = bg_top + padding
    draw.text((text_x, text_y), caption, font=font, fill=text_color)

    return img


def compose_collage(
    anchor_image: Image.Image,
    panels: list[Image.Image],
    thoughts: list[str],
    config: LayoutConfig,
) -> Image.Image:
    """
    Compose the final collage from anchor image and generated panels.

    Args:
        anchor_image: The fixed Tile reference image
        panels: List of generated panel images
        thoughts: List of thought captions (parallel to panels)
        config: Layout configuration

    Returns:
        Final composed collage image
    """
    rows, cols = get_layout_grid(config.layout_type)
    total_cells = rows * cols
    anchor_row, anchor_col = get_anchor_grid_position(
        config.anchor_position, rows, cols
    )

    logger.info(
        f"Composing {config.layout_type.value} collage "
        f"({rows}x{cols}), anchor at ({anchor_row}, {anchor_col})"
    )

    # Create base collage
    collage = Image.new("RGB", config.output_size, config.background_color)
    cell_size = calculate_cell_size(
        config.output_size, rows, cols, config.padding
    )

    # Track which cells are filled
    panel_index = 0

    for row in range(rows):
        for col in range(cols):
            x, y = get_cell_position(row, col, cell_size, config.padding)

            # Determine which image goes in this cell
            if row == anchor_row and col == anchor_col:
                # Place anchor image
                cell_image = resize_image_to_cell(
                    anchor_image, cell_size, config.border_width
                )
                caption = "[Tal]" if config.show_captions else ""
            else:
                # Place generated panel
                if panel_index < len(panels):
                    cell_image = resize_image_to_cell(
                        panels[panel_index], cell_size, config.border_width
                    )
                    caption = thoughts[panel_index] if panel_index < len(thoughts) else ""
                    panel_index += 1
                else:
                    # No more panels, create empty cell
                    cell_image = Image.new(
                        "RGB",
                        (cell_size[0] - 2 * config.border_width,
                         cell_size[1] - 2 * config.border_width),
                        config.background_color,
                    )
                    caption = ""

            # Add caption if enabled
            if config.show_captions and caption:
                cell_image = add_caption_to_image(
                    cell_image,
                    caption,
                    config.caption_font_size,
                    config.caption_color,
                    config.caption_bg_opacity,
                )

            # Add border
            if config.border_width > 0:
                bordered = Image.new(
                    "RGB",
                    (cell_size[0], cell_size[1]),
                    config.border_color,
                )
                bordered.paste(
                    cell_image,
                    (config.border_width, config.border_width),
                )
                cell_image = bordered

            # Paste into collage
            collage.paste(cell_image, (x, y))

    return collage


def get_required_panel_count(layout_type: LayoutType) -> int:
    """
    Get the number of generated panels needed for a layout.
    (Total cells minus 1 for the anchor)
    """
    return get_panel_count(layout_type) - 1


def suggest_layout(num_thoughts: int) -> LayoutType:
    """Suggest a layout based on the number of thoughts."""
    if num_thoughts <= 1:
        return LayoutType.GRID_2X2
    elif num_thoughts <= 2:
        return LayoutType.ROW_1X3
    elif num_thoughts <= 3:
        return LayoutType.GRID_2X2
    elif num_thoughts <= 5:
        return LayoutType.GRID_2X3
    elif num_thoughts <= 8:
        return LayoutType.GRID_3X3
    else:
        return LayoutType.GRID_3X3  # Max supported, will truncate


LAYOUT_DESCRIPTIONS = {
    LayoutType.GRID_2X2: "2x2 Grid (4 panels)",
    LayoutType.GRID_3X3: "3x3 Grid (9 panels)",
    LayoutType.GRID_2X3: "2x3 Grid (6 panels)",
    LayoutType.GRID_3X2: "3x2 Grid (6 panels)",
    LayoutType.ROW_1X3: "Horizontal Row (3 panels)",
    LayoutType.ROW_1X4: "Horizontal Row (4 panels)",
    LayoutType.COLUMN_3X1: "Vertical Column (3 panels)",
    LayoutType.COLUMN_4X1: "Vertical Column (4 panels)",
}
