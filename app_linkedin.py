"""
Tal Content Engine - LinkedIn Content Generator

Simplified 3-step workflow:
1. Extract LinkedIn profile
2. Build personality profile
3. Generate content in their voice

Run with: streamlit run app_linkedin.py
"""

import json
import os
import requests
import streamlit as st
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")

# App Authentication (format: "user1:pass1,user2:pass2,user3:pass3")
APP_USERS_RAW = os.environ.get("APP_USERS", "")


def parse_app_users() -> dict:
    """Parse APP_USERS env var into a dict of {username: password}."""
    users = {}
    if APP_USERS_RAW:
        for pair in APP_USERS_RAW.split(","):
            if ":" in pair:
                username, password = pair.strip().split(":", 1)
                users[username.strip()] = password.strip()
    return users


def check_login(username: str, password: str) -> bool:
    """Verify login credentials."""
    users = parse_app_users()
    return users.get(username) == password


def is_auth_enabled() -> bool:
    """Check if authentication is enabled."""
    return bool(APP_USERS_RAW.strip())


def show_login_page():
    """Display login page and return True if logged in."""
    st.markdown("""
    <style>
        .login-container {
            max-width: 400px;
            margin: 100px auto;
            padding: 2rem;
            background: #1e293b;
            border-radius: 12px;
            border: 1px solid #334155;
        }
    </style>
    """, unsafe_allow_html=True)

    col1, col2, col3 = st.columns([1, 2, 1])

    with col2:
        st.title("Tal Content Engine")
        st.caption("Please log in to continue")

        st.divider()

        username = st.text_input("Username", placeholder="Enter your username")
        password = st.text_input("Password", type="password", placeholder="Enter your password")

        if st.button("Login", type="primary", use_container_width=True):
            if check_login(username, password):
                st.session_state.logged_in = True
                st.session_state.username = username
                st.rerun()
            else:
                st.error("Invalid username or password")

        st.divider()
        st.caption("Contact admin for access credentials")


# Page config
st.set_page_config(
    page_title="Tal Content Engine",
    page_icon="",
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
    .content-box {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 1.5rem;
        margin: 1rem 0;
        white-space: pre-wrap;
        font-family: inherit;
        line-height: 1.6;
    }
    .metric-card {
        background: #1e293b;
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
    }
    .personality-trait {
        display: inline-block;
        background: #334155;
        padding: 0.25rem 0.75rem;
        border-radius: 16px;
        margin: 0.25rem;
        font-size: 0.9rem;
    }
</style>
""", unsafe_allow_html=True)


def check_backend_health():
    """Check if the backend server is running."""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=2)
        return response.json()
    except requests.exceptions.RequestException:
        return None


def check_content_workflow():
    """Check if the content generation workflow is available."""
    try:
        response = requests.get(f"{BACKEND_URL}/content-workflow", timeout=2)
        return response.json()
    except requests.exceptions.RequestException:
        return None


def generate_content(linkedin_url: str, force_refresh: bool = False, custom_context: str = None):
    """Call the backend to generate content."""
    payload = {
        "linkedinUrl": linkedin_url,
        "forceRefresh": force_refresh,
    }
    if custom_context:
        payload["customContext"] = custom_context

    response = requests.post(
        f"{BACKEND_URL}/generate-content",
        json=payload,
        timeout=180,  # 3 minutes for full pipeline
    )
    return response.json()


def get_cached_data():
    """Get list of cached profiles and personalities."""
    try:
        response = requests.get(f"{BACKEND_URL}/cached", timeout=5)
        return response.json()
    except:
        return None


def get_profile(username: str):
    """Get cached profile data."""
    try:
        response = requests.get(f"{BACKEND_URL}/profiles/{username}", timeout=5)
        return response.json()
    except:
        return None


def get_personality(username: str):
    """Get cached personality data."""
    try:
        response = requests.get(f"{BACKEND_URL}/personalities/{username}", timeout=5)
        return response.json()
    except:
        return None


def main():
    """Main application entry point."""

    # Check authentication if enabled
    if is_auth_enabled():
        if not st.session_state.get("logged_in", False):
            show_login_page()
            return

    # Header
    col_title, col_logout = st.columns([4, 1])

    with col_title:
        st.title("Tal Content Engine")
        if is_auth_enabled() and st.session_state.get("logged_in"):
            st.caption(f"Welcome {st.session_state.get('username', 'User')}!")
        else:
            st.caption("Generate LinkedIn posts in anyone's voice")

    with col_logout:
        if is_auth_enabled() and st.session_state.get("logged_in"):
            if st.button("Logout", key="logout_btn"):
                st.session_state.logged_in = False
                st.session_state.username = None
                st.rerun()

    st.divider()

    # Check backend status
    health = check_backend_health()
    workflow = check_content_workflow()
    backend_ok = health is not None

    # Status display
    col1, col2, col3 = st.columns(3)

    with col1:
        if backend_ok:
            gemini_status = "Connected" if health.get("gemini_available") else "Mock Mode"
            st.success(f"Backend: {gemini_status}")
        else:
            st.error("Backend not running")
            st.code("npm run dev")

    with col2:
        if workflow and workflow.get("apify_configured"):
            st.success("Apify: Configured")
        else:
            st.warning("Apify: Not configured")

    with col3:
        if workflow and workflow.get("openai_available"):
            st.success("OpenAI: Available")
        else:
            st.warning("OpenAI: Not available")

    if not backend_ok:
        st.stop()

    st.divider()

    # Main tabs
    tab_generate, tab_cache = st.tabs(["Generate Content", "Cached Data"])

    with tab_generate:
        st.subheader("Generate LinkedIn Post")

        # Input form
        linkedin_url = st.text_input(
            "LinkedIn Profile URL",
            placeholder="https://linkedin.com/in/username",
            help="Enter the LinkedIn profile URL of the person whose voice you want to generate content in",
        )

        col_opt1, col_opt2 = st.columns(2)

        with col_opt1:
            force_refresh = st.checkbox(
                "Force refresh (re-scrape profile)",
                value=False,
                help="Check this to re-scrape the LinkedIn profile even if cached"
            )

        with col_opt2:
            use_custom_context = st.checkbox(
                "Add custom context",
                value=False,
                help="Add additional context to guide content generation"
            )

        custom_context = None
        if use_custom_context:
            custom_context = st.text_area(
                "Custom Context",
                placeholder="e.g., Focus on the AI angle, mention recent funding round, etc.",
                height=80,
            )

        # Generate button
        col_btn1, col_btn2, col_btn3 = st.columns([1, 2, 1])
        with col_btn2:
            generate_clicked = st.button(
                "Generate Content",
                type="primary",
                use_container_width=True,
                disabled=not linkedin_url.strip(),
            )

        st.divider()

        # Generation process
        if generate_clicked and linkedin_url.strip():
            with st.status("Generating content...", expanded=True) as status:
                st.write("Step 1/3: Extracting LinkedIn profile...")

                try:
                    result = generate_content(
                        linkedin_url=linkedin_url.strip(),
                        force_refresh=force_refresh,
                        custom_context=custom_context,
                    )

                    if result.get("status") == "error":
                        st.error(f"Error: {result.get('error', 'Unknown error')}")
                        if result.get("step"):
                            st.warning(f"Failed at step: {result.get('step')}")
                        status.update(label="Failed", state="error")
                        return

                    st.write("Step 2/3: Building personality profile...")
                    st.write("Step 3/3: Generating content...")

                    # Store result in session
                    st.session_state.content_result = result
                    status.update(label="Content generated!", state="complete")

                except requests.exceptions.Timeout:
                    st.error("Request timed out. The LinkedIn scraping might be taking too long.")
                    status.update(label="Timeout", state="error")
                    return
                except Exception as e:
                    st.error(f"Error: {e}")
                    status.update(label="Failed", state="error")
                    return

        # Display results
        if "content_result" in st.session_state and st.session_state.content_result:
            result = st.session_state.content_result

            st.subheader(f"Generated Content for {result.get('personName') or result.get('username')}")

            # Metrics row
            col_m1, col_m2, col_m3, col_m4 = st.columns(4)

            with col_m1:
                st.metric("Confidence Score", f"{result.get('confidenceScore', 0)}/100")

            with col_m2:
                writing_style = "Yes" if result.get("writingStyleAvailable") else "No"
                st.metric("Writing Style", writing_style)

            with col_m3:
                timing = result.get("timing", {})
                total_time = timing.get("totalMs", 0) / 1000
                st.metric("Generation Time", f"{total_time:.1f}s")

            with col_m4:
                st.metric("Username", result.get("username", "N/A"))

            st.divider()

            # Content display - Main Post
            st.markdown("**Main Post:**")
            st.markdown(f'<div class="content-box">{result.get("content", "")}</div>', unsafe_allow_html=True)
            st.code(result.get("content", ""), language=None)

            # Content display - Alt Version
            if result.get("altVersion"):
                st.markdown("**Alt Version:**")
                st.markdown(f'<div class="content-box">{result.get("altVersion", "")}</div>', unsafe_allow_html=True)
                st.code(result.get("altVersion", ""), language=None)

            # Angle and personalization notes
            col_notes1, col_notes2 = st.columns(2)

            with col_notes1:
                st.markdown("**Angle Used:**")
                st.info(result.get("angleUsed", "N/A"))

            with col_notes2:
                st.markdown("**Personalization Notes:**")
                st.info(result.get("personalizationNotes", "N/A"))

            # Storage paths
            with st.expander("Storage Paths"):
                paths = result.get("storagePaths", {})
                st.json(paths)

            # Timing breakdown
            with st.expander("Timing Breakdown"):
                timing = result.get("timing", {})
                col_t1, col_t2, col_t3 = st.columns(3)
                with col_t1:
                    st.metric("Extraction", f"{timing.get('extractionMs', 0)}ms")
                with col_t2:
                    st.metric("Personality", f"{timing.get('personalityMs', 0)}ms")
                with col_t3:
                    st.metric("Generation", f"{timing.get('generationMs', 0)}ms")

            # Actions
            st.divider()
            col_act1, col_act2, col_act3 = st.columns(3)

            with col_act1:
                if st.button("Generate Again", use_container_width=True):
                    del st.session_state.content_result
                    st.rerun()

            with col_act2:
                st.download_button(
                    "Download JSON",
                    data=json.dumps(result, indent=2),
                    file_name=f"tal_content_{result.get('username')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                    mime="application/json",
                    use_container_width=True,
                )

            with col_act3:
                if st.button("Clear", use_container_width=True):
                    del st.session_state.content_result
                    st.rerun()

    with tab_cache:
        st.subheader("Cached Data")

        cached = get_cached_data()

        if cached and cached.get("status") == "ok":
            col_c1, col_c2, col_c3 = st.columns(3)

            with col_c1:
                st.metric("Profiles", len(cached.get("profiles", [])))

            with col_c2:
                st.metric("Personalities", len(cached.get("personalities", [])))

            with col_c3:
                st.metric("Generated", len(cached.get("generated", [])))

            st.divider()

            # Profile viewer
            profiles = cached.get("profiles", [])
            if profiles:
                selected_profile = st.selectbox(
                    "View Profile",
                    options=profiles,
                    format_func=lambda x: x.title().replace("-", " "),
                )

                if selected_profile:
                    col_view1, col_view2 = st.columns(2)

                    with col_view1:
                        st.markdown("**Profile Data:**")
                        profile_data = get_profile(selected_profile)
                        if profile_data:
                            with st.expander("View Profile JSON", expanded=False):
                                st.json(profile_data)

                    with col_view2:
                        st.markdown("**Personality Data:**")
                        personality_data = get_personality(selected_profile)
                        if personality_data:
                            # Display personality traits
                            personality = personality_data.get("personality", {})
                            if personality.get("traits"):
                                st.markdown("**Traits:**")
                                traits_html = " ".join([
                                    f'<span class="personality-trait">{t}</span>'
                                    for t in personality.get("traits", [])
                                ])
                                st.markdown(traits_html, unsafe_allow_html=True)

                            if personality.get("values"):
                                st.markdown("**Values:**")
                                values_html = " ".join([
                                    f'<span class="personality-trait">{v}</span>'
                                    for v in personality.get("values", [])
                                ])
                                st.markdown(values_html, unsafe_allow_html=True)

                            with st.expander("View Full Personality JSON", expanded=False):
                                st.json(personality_data)
                        else:
                            st.info("No personality data available")
            else:
                st.info("No cached profiles yet. Generate content to populate cache.")
        else:
            st.warning("Could not fetch cached data")


if __name__ == "__main__":
    main()
