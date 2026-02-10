"""
Tal - Social Media Brain

A streamlined tool for generating consistent Tal character images from simple prompts.
"""

import logging
import os
from io import BytesIO
from pathlib import Path

import streamlit as st
from PIL import Image
from dotenv import load_dotenv

from core.collage import (
    LayoutConfig,
    LayoutType,
    compose_collage,
)
from core.generator import CollageGenerator
from core.profile import create_profile
from core.prompt_enhancer import get_enhancer, get_tal_character_prompt
from core.publish import publish, PublishError
from core.storage import (
    ensure_run_dir,
    generate_run_id,
    save_collage,
    save_metadata,
    save_panel,
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Page config
st.set_page_config(
    page_title="Tal - Social Media Brain",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Custom CSS for cleaner UI
st.markdown("""
<style>
    .main-header {
        text-align: center;
        padding: 1rem 0;
    }
    .stTextArea textarea {
        font-size: 1.1rem;
    }
    .creative-card {
        border: 1px solid #333;
        border-radius: 10px;
        padding: 10px;
        margin: 5px;
    }
    .status-box {
        background: #1a1a2e;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)


def init_session_state():
    """Initialize session state variables."""
    defaults = {
        "tal_image": None,
        "character_profile": None,
        "generated_creatives": None,
        "enhanced_prompt": None,
        "original_prompt": None,
        "current_run_id": None,
        "generation_in_progress": False,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def load_tal_image():
    """Load Tal's default image."""
    tal_path = Path("image 3410 (1).png")
    if tal_path.exists():
        return Image.open(tal_path).convert("RGBA")
    return None


def get_api_status():
    """Check API configuration status."""
    api_key = os.environ.get("GOOGLE_API_KEY")
    return bool(api_key)


def generate_creatives(user_prompt: str, num_creatives: int = 4):
    """Generate creative variations based on user prompt."""

    # Initialize enhancer
    enhancer = get_enhancer()

    # Enhance the prompt
    enhanced = enhancer.enhance(user_prompt, style_preset="default")
    st.session_state.original_prompt = user_prompt
    st.session_state.enhanced_prompt = enhanced

    # Load Tal image
    tal_image = load_tal_image()
    if tal_image is None:
        st.error("Tal's image not found! Please add 'image 3410 (1).png' to the project folder.")
        return None

    # Create a simple profile
    profile = create_profile(tal_image, user_notes="Tal - Character reference for photorealistic generation")

    # Initialize generator
    api_available = get_api_status()
    generator = CollageGenerator(
        dry_run=not api_available,
        use_google=api_available,
        enhance_prompts=False,  # Already enhanced above
    )

    # Generate variations with slightly different prompts
    variations = [
        enhanced.get("enhanced", user_prompt),
        f"{enhanced.get('enhanced', user_prompt)} Close-up shot.",
        f"{enhanced.get('enhanced', user_prompt)} Wide angle view.",
        f"{enhanced.get('enhanced', user_prompt)} Dynamic action pose.",
    ][:num_creatives]

    # Generate panels
    panels = generator.generate_panels(
        anchor_image=tal_image,
        thoughts=variations,
        character_profile=profile,
        style_preset="default",
        panel_size=(1024, 1024),
        use_tal_mode=True,
    )

    return panels


def render_main_ui():
    """Render the main application UI."""

    # Header
    col_logo, col_title = st.columns([1, 4])
    with col_logo:
        tal_img = load_tal_image()
        if tal_img:
            st.image(tal_img, width=100)
    with col_title:
        st.title("🧠 Tal - Social Media Brain")
        st.caption("Generate consistent Tal creatives from simple prompts")

    st.divider()

    # API Status indicator
    api_ok = get_api_status()
    if api_ok:
        st.success("✓ Google Imagen API connected", icon="✅")
    else:
        st.warning("⚠️ Running in preview mode (placeholder images). Add GOOGLE_API_KEY to .env for real generation.")

    # Main input section
    st.subheader("💭 What do you want Tal to do?")

    user_prompt = st.text_area(
        "Enter your idea",
        placeholder="Examples:\n• Tal drinking coffee at a cozy cafe\n• Tal presenting at a tech conference\n• Tal celebrating a milestone\n• Tal working on a laptop late at night",
        height=120,
        label_visibility="collapsed",
    )

    # Number of creatives selector
    col1, col2, col3 = st.columns([2, 1, 2])
    with col2:
        num_creatives = st.selectbox(
            "Creatives",
            options=[2, 3, 4],
            index=2,
            help="Number of creative variations to generate"
        )

    # Generate button
    col_btn1, col_btn2, col_btn3 = st.columns([1, 2, 1])
    with col_btn2:
        generate_clicked = st.button(
            "🚀 Generate Creatives",
            type="primary",
            use_container_width=True,
            disabled=not user_prompt.strip(),
        )

    st.divider()

    # Generation process
    if generate_clicked and user_prompt.strip():
        run_id = generate_run_id()
        st.session_state.current_run_id = run_id

        with st.status("🎨 Creating Tal creatives...", expanded=True) as status:

            # Step 1: Enhance prompt
            st.write("✨ **Step 1:** Enhancing your prompt with AI...")
            enhancer = get_enhancer()
            enhanced = enhancer.enhance(user_prompt.strip(), style_preset="default")
            st.session_state.original_prompt = user_prompt.strip()
            st.session_state.enhanced_prompt = enhanced

            # Show enhanced prompt
            with st.expander("View Enhanced Prompt", expanded=False):
                st.markdown(f"**Original:** {user_prompt.strip()}")
                st.markdown(f"**Enhanced:** {enhanced.get('enhanced', user_prompt)}")
                if enhanced.get('mood'):
                    st.markdown(f"**Mood:** {enhanced.get('mood')}")

            # Step 2: Load Tal
            st.write("🐕 **Step 2:** Loading Tal's character...")
            tal_image = load_tal_image()
            if tal_image is None:
                st.error("Tal's image not found!")
                return

            profile = create_profile(tal_image, user_notes="Tal - Character reference for photorealistic generation")

            # Step 3: Generate creatives
            st.write(f"🎨 **Step 3:** Generating {num_creatives} creative variations...")

            api_available = get_api_status()
            generator = CollageGenerator(
                dry_run=not api_available,
                use_google=api_available,
                enhance_prompts=False,
            )

            # Create variations
            base_prompt = enhanced.get("enhanced", user_prompt.strip())
            variations = [
                base_prompt,
                f"{base_prompt} Centered composition, front view.",
                f"{base_prompt} Side angle, dynamic lighting.",
                f"{base_prompt} Wide shot showing environment.",
            ][:num_creatives]

            progress = st.progress(0)

            panels = generator.generate_panels(
                anchor_image=tal_image,
                thoughts=variations,
                character_profile=profile,
                style_preset="default",
                panel_size=(1024, 1024),
                use_tal_mode=True,
            )

            progress.progress(100)
            st.session_state.generated_creatives = panels

            # Step 4: Save outputs
            st.write("💾 **Step 4:** Saving creatives...")
            ensure_run_dir(run_id)
            for i, panel in enumerate(panels):
                save_panel(run_id, i, panel.image)

            # Save metadata
            metadata = {
                "run_id": run_id,
                "original_prompt": user_prompt.strip(),
                "enhanced_prompt": enhanced,
                "num_creatives": num_creatives,
                "api_mode": "google_imagen" if api_available else "placeholder",
            }
            save_metadata(run_id, metadata)

            status.update(label="✅ Creatives generated!", state="complete")

    # Display generated creatives
    if st.session_state.generated_creatives:
        st.subheader("🖼️ Generated Creatives")

        # Show original vs enhanced prompt
        with st.expander("📝 Prompt Details"):
            col_orig, col_enh = st.columns(2)
            with col_orig:
                st.markdown("**Your Input:**")
                st.info(st.session_state.original_prompt)
            with col_enh:
                st.markdown("**AI Enhanced:**")
                enhanced = st.session_state.enhanced_prompt
                st.success(enhanced.get("enhanced", "")[:200] + "...")

        # Display creatives in a grid
        panels = st.session_state.generated_creatives
        cols = st.columns(len(panels))

        for i, (col, panel) in enumerate(zip(cols, panels)):
            with col:
                st.image(panel.image, use_container_width=True)

                # Download button for each creative
                buf = BytesIO()
                panel.image.save(buf, format="PNG")
                buf.seek(0)

                st.download_button(
                    f"⬇️ Download #{i+1}",
                    data=buf,
                    file_name=f"tal_creative_{st.session_state.current_run_id}_{i+1}.png",
                    mime="image/png",
                    use_container_width=True,
                )

        # Actions row
        st.divider()
        col_action1, col_action2, col_action3 = st.columns([1, 1, 1])

        with col_action1:
            if st.button("🔄 Generate More", use_container_width=True):
                # Keep the prompt, regenerate
                st.session_state.generated_creatives = None
                st.rerun()

        with col_action2:
            if st.button("📤 Publish All", use_container_width=True):
                try:
                    # Save as collage first
                    tal_image = load_tal_image()
                    config = LayoutConfig(
                        layout_type=LayoutType.GRID_2X2 if len(panels) == 4 else LayoutType.ROW_1X3,
                        output_size=(1080, 1080),
                        padding=8,
                        border_width=0,
                    )
                    collage = compose_collage(
                        anchor_image=tal_image,
                        panels=[p.image for p in panels[1:]],  # Skip first as anchor replacement
                        thoughts=[p.thought for p in panels[1:]],
                        config=config,
                    )
                    save_collage(st.session_state.current_run_id, collage)
                    result = publish(st.session_state.current_run_id)
                    st.success(f"Published to: {result['published_path']}")
                except Exception as e:
                    st.error(f"Publish failed: {e}")

        with col_action3:
            if st.button("🆕 New Prompt", use_container_width=True):
                st.session_state.generated_creatives = None
                st.session_state.enhanced_prompt = None
                st.session_state.original_prompt = None
                st.rerun()


def main():
    """Main application entry point."""
    init_session_state()
    render_main_ui()


if __name__ == "__main__":
    main()
