"""
Cabal of Strangers - Streamlit Frontend

Full workflow: Prompt Enhancement → Image Generation with TAL reference → Instagram Posting
"""

from typing import Optional, Tuple
import json
import os
import requests
import streamlit as st
from pathlib import Path
from io import BytesIO
from datetime import datetime
import base64
import time

from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")
TAL_IMAGE_PATH = Path("image 3410 (1).png")

# Instagram API Configuration
INSTAGRAM_ACCESS_TOKEN = os.environ.get("INSTAGRAM_ACCESS_TOKEN")
INSTAGRAM_BUSINESS_ACCOUNT_ID = os.environ.get("INSTAGRAM_BUSINESS_ACCOUNT_ID")
GRAPH_API_VERSION = "v19.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# Page config
st.set_page_config(
    page_title="Tal Studios",
    page_icon="🎭",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        text-align: center;
        padding: 1rem 0;
    }
    .stTextArea textarea {
        font-size: 1.1rem;
    }
    .prompt-box {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 1rem;
        margin: 0.5rem 0;
    }
</style>
""", unsafe_allow_html=True)


def load_tal_image():
    """Load TAL's reference image."""
    if TAL_IMAGE_PATH.exists():
        return Image.open(TAL_IMAGE_PATH).convert("RGBA")
    return None


def check_backend_health():
    """Check if the backend server is running."""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=2)
        return response.json()
    except requests.exceptions.RequestException:
        return None


def get_enhanced_prompt(user_request: str, size: str, seed: Optional[int], style_preset: Optional[str]):
    """Call the backend /run endpoint to get enhanced prompt."""
    payload = {
        "user_request": user_request,
        "size": size,
        "seed": seed,
        "style_preset": style_preset,
    }

    response = requests.post(
        f"{BACKEND_URL}/run",
        json=payload,
        timeout=60,
    )
    return response.json()


def image_to_base64(img: Image.Image) -> str:
    """Convert PIL Image to base64 string."""
    import base64
    buffer = BytesIO()
    # Convert to RGB if RGBA
    if img.mode == "RGBA":
        img = img.convert("RGB")
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def generate_image_with_nano_banana(prompt: str, negative_prompt: str, size: str, reference_image: Image.Image, additional_reference: Optional[Image.Image] = None):
    """Generate image using Nano Banana Pro (Gemini 3 Pro Image) with reference image."""
    try:
        from google import genai
        from google.genai import types

        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return None, "No GOOGLE_API_KEY found"

        client = genai.Client(api_key=api_key)

        # Determine aspect ratio from size
        width, height = map(int, size.split("x"))
        ratio = width / height
        if abs(ratio - 1.0) < 0.1:
            aspect_ratio = "1:1"
        elif abs(ratio - 16/9) < 0.1:
            aspect_ratio = "16:9"
        elif abs(ratio - 9/16) < 0.1:
            aspect_ratio = "9:16"
        elif abs(ratio - 4/3) < 0.1:
            aspect_ratio = "4:3"
        else:
            aspect_ratio = "1:1"

        # Build prompt with photoreal mascot style and character reference
        additional_ref_note = ""
        if additional_reference:
            additional_ref_note = "\n\nADDITIONAL REFERENCE: Use the second reference image for scene/style inspiration while keeping TAL's identity from the first reference."

        full_prompt = f"""Photorealistic lifestyle photograph of TAL, a 3D mascot character, in a real-world location.

CHARACTER LOCK (identity must match reference image exactly):
- TAL character must match TAL_ANCHOR_IMAGE exactly
- Same fur color palette (orange/golden with cream markings)
- Same facial proportions, eye style, muzzle shape
- Same outfit vibe: beige t-shirt, dark brown vest, black pants, orange sneakers, black smartwatch

Scene: {prompt}

PHOTOGRAPHY STYLE:
- Real-world location with natural lighting + realistic shadows
- Shot on DSLR, 35mm lens, shallow depth of field, subtle film grain
- High-end brand mascot photography feel (like a real mascot photographed on location)
- Realistic textures: detailed fur, fabric weave, natural shadow falloff
- NOT a cartoon frame or animated movie still - this should look like a REAL photograph of a mascot{additional_ref_note}"""

        # Build contents list with reference images
        contents = [full_prompt, reference_image]
        if additional_reference:
            contents.append(additional_reference)

        # Use Nano Banana Pro with reference image
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp-image-generation",  # Model with image generation support
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            )
        )

        # Extract generated image from response
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_bytes = part.inline_data.data
                    pil_image = Image.open(BytesIO(image_bytes)).convert("RGB")
                    return pil_image, None

        return None, "No image in response"

    except Exception as e:
        return None, str(e)


def save_outputs(run_id: str, images: list, prompt_package: dict):
    """Save generated images and metadata."""
    output_dir = Path(f"outputs/runs/{run_id}")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save images
    image_paths = []
    for i, img in enumerate(images):
        img_path = output_dir / f"generated_{i}.png"
        img.save(img_path)
        image_paths.append(str(img_path))

    # Save prompt package
    with open(output_dir / "prompt_package.json", "w") as f:
        json.dump(prompt_package, f, indent=2)

    return image_paths


# ============== Instagram Integration ==============

def check_instagram_configured() -> bool:
    """Check if Instagram credentials are configured."""
    return bool(INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID)


def upload_image_to_hosting(img: Image.Image) -> Tuple[Optional[str], Optional[str]]:
    """Upload image to imgur for hosting (required by Instagram API)."""
    try:
        # Convert image to base64
        buffer = BytesIO()
        if img.mode == "RGBA":
            img = img.convert("RGB")
        img.save(buffer, format="JPEG", quality=95)
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.read()).decode("utf-8")

        # Use imgur API (anonymous upload)
        response = requests.post(
            "https://api.imgur.com/3/image",
            headers={
                "Authorization": "Client-ID 546c25a59c58ad7",
            },
            data={
                "image": img_base64,
                "type": "base64",
            },
            timeout=60,
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("data", {}).get("link"):
                return data["data"]["link"], None
            return None, "No URL in response"

        return None, f"HTTP {response.status_code}: {response.text[:100]}"

    except Exception as e:
        return None, str(e)


def create_instagram_media_container(image_url: str, caption: str) -> Tuple[Optional[str], Optional[str]]:
    """Create an Instagram media container."""
    try:
        response = requests.post(
            f"{GRAPH_API_BASE}/{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media",
            params={
                "image_url": image_url,
                "caption": caption,
                "access_token": INSTAGRAM_ACCESS_TOKEN,
            },
            timeout=30,
        )

        data = response.json()

        if "id" in data:
            return data["id"], None
        elif "error" in data:
            return None, data["error"].get("message", "Unknown error")
        return None, "No container ID in response"

    except Exception as e:
        return None, str(e)


def publish_instagram_media(container_id: str) -> Tuple[Optional[str], Optional[str]]:
    """Publish the media container to Instagram."""
    try:
        # Wait a moment for the container to be ready
        time.sleep(2)

        response = requests.post(
            f"{GRAPH_API_BASE}/{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish",
            params={
                "creation_id": container_id,
                "access_token": INSTAGRAM_ACCESS_TOKEN,
            },
            timeout=30,
        )

        data = response.json()

        if "id" in data:
            return data["id"], None
        elif "error" in data:
            return None, data["error"].get("message", "Unknown error")
        return None, "No media ID in response"

    except Exception as e:
        return None, str(e)


def generate_tal_caption(image_context: str, mood: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
    """Generate a TAL-style caption using the backend."""
    try:
        response = requests.post(
            f"{BACKEND_URL}/caption",
            json={
                "image_context": image_context,
                "mood": mood,
            },
            timeout=30,
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "ok":
                return data.get("full_caption"), None
            return None, data.get("error", "Unknown error")
        return None, f"HTTP {response.status_code}"

    except Exception as e:
        return None, str(e)


def post_to_instagram(img: Image.Image, caption: str) -> Tuple[bool, str]:
    """Full flow: Upload image → Create container → Publish to Instagram."""

    # Step 1: Upload image to get public URL
    image_url, error = upload_image_to_hosting(img)
    if error:
        return False, f"Image upload failed: {error}"

    # Step 2: Create media container
    container_id, error = create_instagram_media_container(image_url, caption)
    if error:
        return False, f"Container creation failed: {error}"

    # Step 3: Publish
    media_id, error = publish_instagram_media(container_id)
    if error:
        return False, f"Publishing failed: {error}"

    return True, f"Posted successfully! Media ID: {media_id}"


def main():
    """Main application entry point."""

    # Header with TAL image
    col_logo, col_title = st.columns([1, 4])
    with col_logo:
        tal_img = load_tal_image()
        if tal_img:
            st.image(tal_img, width=100)
    with col_title:
        st.title("🎭 Tal Studios")
        st.caption("AI-powered content generation with TAL character consistency")

    st.divider()

    # Check backend status
    health = check_backend_health()
    backend_ok = health is not None

    # Check API key
    api_key = os.environ.get("GOOGLE_API_KEY")
    api_ok = bool(api_key)

    # Status display
    col1, col2, col3 = st.columns(3)
    with col1:
        if backend_ok:
            gemini_status = "Connected" if health.get("gemini_available") else "Mock Mode"
            st.success(f"✓ Prompt Enhancer: {gemini_status}")
        else:
            st.error("❌ Backend not running")
            st.code("npm run dev")

    with col2:
        if api_ok:
            st.success(f"✓ Google Imagen: Ready")
        else:
            st.warning("⚠️ No API key - placeholder images only")

    with col3:
        if check_instagram_configured():
            st.success("✓ Instagram: Connected")
        else:
            st.warning("⚠️ Instagram: Not configured")

    if not backend_ok:
        st.stop()

    st.divider()

    # Input form
    st.subheader("💭 What do you want TAL to do?")

    user_request = st.text_area(
        "Enter your request",
        placeholder="Examples:\n• TAL drinking coffee at a cozy cafe\n• TAL presenting at a tech conference\n• TAL working on a laptop late at night",
        height=120,
        label_visibility="collapsed",
    )

    # Enhance Prompting Toggle
    enhance_prompting = st.toggle(
        "✨ Enhance Prompting",
        value=True,
        help="When ON: AI enhances your prompt for better results. When OFF: Uses your prompt directly."
    )

    # Settings row
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        size = st.selectbox(
            "Size",
            options=["1024x1024", "1080x1080"],
            index=0,
        )

    with col2:
        num_images = st.selectbox(
            "Images",
            options=[1, 2, 3, 4],
            index=0,
        )

    with col3:
        use_seed = st.checkbox("Use seed")
        seed = st.number_input("Seed", value=42, disabled=not use_seed, label_visibility="collapsed") if use_seed else None

    with col4:
        style_preset = st.selectbox(
            "Style",
            options=[None, "cinematic", "bright_cheerful", "moody_artistic", "minimalist", "vintage"],
            format_func=lambda x: "Default" if x is None else x.replace("_", " ").title(),
            disabled=not enhance_prompting,
        )

    # Additional Reference Image Section
    with st.expander("🖼️ Add Reference Image (Optional)", expanded=False):
        st.caption("Upload or paste an image to use as additional style/scene reference")

        ref_col1, ref_col2 = st.columns([2, 1])

        with ref_col1:
            uploaded_ref = st.file_uploader(
                "Drop image here or click to upload",
                type=["png", "jpg", "jpeg", "webp"],
                help="This image will be used as additional reference for the scene/style",
                label_visibility="collapsed",
            )

        with ref_col2:
            if uploaded_ref:
                ref_image = Image.open(uploaded_ref).convert("RGB")
                st.image(ref_image, caption="Reference", width=150)
                use_reference = st.checkbox("Use this reference", value=True)
            else:
                use_reference = False
                ref_image = None
                st.info("No reference added")

    # Generate button
    col_btn1, col_btn2, col_btn3 = st.columns([1, 2, 1])
    with col_btn2:
        generate_clicked = st.button(
            "🚀 Generate Images",
            type="primary",
            width="stretch",
            disabled=not user_request.strip(),
        )

    st.divider()

    # Generation process
    if generate_clicked and user_request.strip():
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        with st.status("🎨 Generating TAL images...", expanded=True) as status:

            # Step 1: Enhance prompt OR use regular query
            if enhance_prompting:
                st.write("✨ **Step 1:** Enhancing prompt with Gemini...")
                try:
                    result = get_enhanced_prompt(
                        user_request=user_request.strip(),
                        size=size,
                        seed=int(seed) if seed else None,
                        style_preset=style_preset,
                    )

                    if result.get("status") != "ok":
                        st.error(f"Prompt enhancement failed: {result.get('error', 'Unknown error')}")
                        status.update(label="❌ Failed", state="error")
                        return

                    prompt_package = result["streamlit_payload"]["prompt_package"]
                    st.success(f"Enhanced prompt ready ({len(prompt_package['final_prompt'])} chars)")

                except Exception as e:
                    st.error(f"Backend error: {e}")
                    status.update(label="❌ Failed", state="error")
                    return

                # Show enhanced prompt
                with st.expander("📝 View Enhanced Prompt"):
                    st.markdown(f"**Original:** {user_request.strip()}")
                    st.markdown(f"**Enhanced:** {prompt_package['final_prompt'][:300]}...")
                    if prompt_package.get("policy_notes"):
                        st.warning(f"Policy notes: {', '.join(prompt_package['policy_notes'])}")
            else:
                # Regular query - use user's prompt directly
                st.write("📝 **Step 1:** Using your prompt directly...")
                prompt_package = {
                    "final_prompt": user_request.strip(),
                    "negative_prompt": "blurry, low quality, distorted, watermark, text, logo",
                    "reference_image_ids": ["TAL_ANCHOR_IMAGE"],
                    "reference_strength": 0.9,
                    "size": size,
                    "n": 1,
                    "seed": int(seed) if seed else None,
                    "assumptions": ["Using direct prompt without enhancement"],
                    "policy_notes": [],
                }
                st.success("Using your prompt directly")

            # Step 2: Load TAL reference
            st.write("🐕 **Step 2:** Loading TAL reference image...")
            tal_image = load_tal_image()
            if tal_image is None:
                st.error("TAL image not found!")
                status.update(label="❌ Failed", state="error")
                return
            st.success("TAL reference loaded")

            # Step 3: Generate images
            st.write(f"🎨 **Step 3:** Generating {num_images} image(s) with Google Imagen...")

            generated_images = []
            errors = []
            progress = st.progress(0)

            for i in range(num_images):
                # Vary the prompt slightly for multiple images
                variant_prompt = prompt_package["final_prompt"]
                if i == 1:
                    variant_prompt += " Close-up composition."
                elif i == 2:
                    variant_prompt += " Wide angle view."
                elif i == 3:
                    variant_prompt += " Dynamic side angle."

                img, error = generate_image_with_nano_banana(
                    prompt=variant_prompt,
                    negative_prompt=prompt_package["negative_prompt"],
                    size=size,
                    reference_image=tal_image,
                    additional_reference=ref_image if use_reference else None,
                )

                if img:
                    generated_images.append(img)
                else:
                    errors.append(f"Image {i+1}: {error}")

                progress.progress((i + 1) / num_images)

            if not generated_images:
                st.error(f"No images generated. Errors: {'; '.join(errors)}")
                status.update(label="❌ Failed", state="error")
                return

            # Step 4: Save outputs
            st.write("💾 **Step 4:** Saving outputs...")
            image_paths = save_outputs(run_id, generated_images, prompt_package)
            st.success(f"Saved {len(generated_images)} images")

            # Store in session
            st.session_state.generated_images = generated_images
            st.session_state.prompt_package = prompt_package
            st.session_state.run_id = run_id
            st.session_state.image_paths = image_paths

            if errors:
                st.warning(f"Some images failed: {'; '.join(errors)}")

            status.update(label=f"✅ Generated {len(generated_images)} images!", state="complete")

    # Display results
    if "generated_images" in st.session_state and st.session_state.generated_images:
        st.subheader(f"🖼️ Generated Images (Run: {st.session_state.run_id})")

        images = st.session_state.generated_images
        cols = st.columns(len(images))

        for i, (col, img) in enumerate(zip(cols, images)):
            with col:
                st.image(img, width="stretch")

                # Download button
                buf = BytesIO()
                img.save(buf, format="PNG")
                buf.seek(0)

                st.download_button(
                    f"⬇️ Download #{i+1}",
                    data=buf,
                    file_name=f"tal_{st.session_state.run_id}_{i+1}.png",
                    mime="image/png",
                    width="stretch",
                )

        # Prompt details
        with st.expander("📝 Prompt Details"):
            pkg = st.session_state.prompt_package
            st.markdown("**Final Prompt:**")
            st.info(pkg["final_prompt"])
            st.markdown("**Negative Prompt:**")
            st.text(pkg["negative_prompt"])
            st.markdown("**Settings:**")
            st.json({
                "reference_strength": pkg["reference_strength"],
                "size": pkg["size"],
                "assumptions": pkg["assumptions"],
                "policy_notes": pkg["policy_notes"],
            })

        # Actions
        st.divider()
        col1, col2, col3 = st.columns(3)

        with col1:
            if st.button("🔄 Generate More", width="stretch"):
                pass  # Keep same prompt, will regenerate on button click

        with col2:
            if st.button("🆕 New Request", width="stretch"):
                for key in ["generated_images", "prompt_package", "run_id", "image_paths"]:
                    if key in st.session_state:
                        del st.session_state[key]
                st.rerun()

        with col3:
            # Download all as ZIP
            st.download_button(
                "📦 Download JSON",
                data=json.dumps(st.session_state.prompt_package, indent=2),
                file_name=f"tal_run_{st.session_state.run_id}.json",
                mime="application/json",
                width="stretch",
            )

        # Instagram Posting Section
        st.divider()
        st.subheader("📸 Post to Instagram")

        if not check_instagram_configured():
            st.warning("Instagram not configured. Add INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID to .env")
        else:
            # Select which image to post
            image_options = [f"Image #{i+1}" for i in range(len(images))]
            selected_image_idx = st.selectbox(
                "Select image to post",
                options=range(len(images)),
                format_func=lambda x: f"Image #{x+1}",
            )

            # Caption generation
            st.markdown("**Caption**")

            # Initialize caption in session state if not present
            if "generated_caption" not in st.session_state:
                st.session_state.generated_caption = ""

            col_cap1, col_cap2 = st.columns([3, 1])

            with col_cap1:
                caption_context = st.text_input(
                    "What's happening in this image?",
                    placeholder="e.g., TAL chilling at a cafe, TAL crushing it at work...",
                    label_visibility="collapsed",
                )

            with col_cap2:
                generate_caption_clicked = st.button(
                    "🎤 Generate Caption",
                    width="stretch",
                    help="Generate a TAL-style caption using AI",
                )

            if generate_caption_clicked and caption_context:
                with st.spinner("TAL is cooking up a caption..."):
                    # Use the user's original request as context
                    context = caption_context or st.session_state.prompt_package.get("assumptions", ["TAL content"])[0]
                    generated, error = generate_tal_caption(context)

                    if generated:
                        st.session_state.generated_caption = generated
                        st.success("Caption generated!")
                    else:
                        st.error(f"Caption generation failed: {error}")

            # Caption text area
            default_caption = st.session_state.generated_caption or f"another day another chaos. you know how it is.\n\n#TAL #BangaloreTech #TechLife #ContentCreator #Vibes"
            caption = st.text_area(
                "Edit Caption",
                value=default_caption,
                height=120,
                help="Edit the caption or generate a new one with TAL's voice",
                label_visibility="collapsed",
            )

            col_post1, col_post2 = st.columns([2, 1])

            with col_post1:
                post_clicked = st.button(
                    "📤 Post to Instagram",
                    type="primary",
                    width="stretch",
                    disabled=not caption.strip(),
                )

            with col_post2:
                st.caption(f"Posting Image #{selected_image_idx + 1}")

            if post_clicked:
                with st.spinner("Posting to Instagram..."):
                    selected_img = images[selected_image_idx]
                    success, message = post_to_instagram(selected_img, caption.strip())

                    if success:
                        st.success(f"🎉 Maalik Aap Great Ho!")
                        st.balloons()
                        # Clear generated caption after successful post
                        st.session_state.generated_caption = ""
                    else:
                        st.error(f"❌ {message}")


if __name__ == "__main__":
    main()
