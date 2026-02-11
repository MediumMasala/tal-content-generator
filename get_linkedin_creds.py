"""
LinkedIn Credentials Helper

Run this locally to get permanent LinkedIn credentials for TAL's account.
Usage: python get_linkedin_creds.py
"""

import http.server
import urllib.parse
import webbrowser
import requests
import os
from dotenv import load_dotenv

load_dotenv()

# LinkedIn App Credentials (from .env file)
CLIENT_ID = os.environ.get("LINKEDIN_CLIENT_ID")
CLIENT_SECRET = os.environ.get("LINKEDIN_CLIENT_SECRET")
REDIRECT_URI = "http://localhost:8888/callback"

if not CLIENT_ID or not CLIENT_SECRET:
    print("Error: LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set in .env")
    exit(1)
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"

class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse the callback URL
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "code" in params:
            code = params["code"][0]
            print(f"\n✓ Got authorization code")

            # Exchange code for token
            print("Exchanging code for access token...")
            response = requests.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": REDIRECT_URI,
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )

            if response.status_code == 200:
                token_data = response.json()
                access_token = token_data.get("access_token")

                # Get user info
                print("Getting user info...")
                user_response = requests.get(
                    "https://api.linkedin.com/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=30,
                )

                if user_response.status_code == 200:
                    user_info = user_response.json()
                    user_urn = f"urn:li:person:{user_info.get('sub')}"
                    user_name = user_info.get('name', 'Unknown')

                    # Display results
                    print("\n" + "=" * 60)
                    print("SUCCESS! Add these to Render environment variables:")
                    print("=" * 60)
                    print(f"\nLinkedIn Account: {user_name}")
                    print(f"\nLINKEDIN_ACCESS_TOKEN={access_token}")
                    print(f"\nLINKEDIN_USER_URN={user_urn}")
                    print("\n" + "=" * 60)

                    # Send success response to browser
                    self.send_response(200)
                    self.send_header("Content-type", "text/html")
                    self.end_headers()
                    self.wfile.write(f"""
                    <html>
                    <head><title>Success!</title></head>
                    <body style="font-family: Arial; padding: 40px; background: #1a1a2e; color: white;">
                        <h1>✅ LinkedIn Connected!</h1>
                        <p>Account: <strong>{user_name}</strong></p>
                        <h3>Add these to Render:</h3>
                        <pre style="background: #0f0f23; padding: 20px; border-radius: 8px; overflow-x: auto;">
LINKEDIN_ACCESS_TOKEN={access_token}

LINKEDIN_USER_URN={user_urn}
                        </pre>
                        <p style="color: #888;">You can close this window now.</p>
                    </body>
                    </html>
                    """.encode())
                else:
                    print(f"Failed to get user info: {user_response.status_code}")
                    self.send_error(500, "Failed to get user info")
            else:
                print(f"Token exchange failed: {response.status_code}")
                print(response.text)
                self.send_error(500, f"Token exchange failed: {response.text[:200]}")
        else:
            error = params.get("error", ["Unknown"])[0]
            error_desc = params.get("error_description", [""])[0]
            print(f"\n❌ Error: {error} - {error_desc}")
            self.send_error(400, f"Error: {error}")

        # Shutdown server after handling
        self.server.should_stop = True

    def log_message(self, format, *args):
        pass  # Suppress default logging


def main():
    print("=" * 60)
    print("LinkedIn Credentials Helper for TAL Studios")
    print("=" * 60)

    # Build auth URL
    auth_params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "openid profile w_member_social",
        "state": "local_auth",
    })
    auth_url = f"https://www.linkedin.com/oauth/v2/authorization?{auth_params}"

    print("\n1. Opening LinkedIn login in your browser...")
    print("2. Log in with TAL's LinkedIn account")
    print("3. Authorize the app")
    print("\nWaiting for authorization...\n")

    # Start local server
    server = http.server.HTTPServer(("localhost", 8888), CallbackHandler)
    server.should_stop = False

    # Open browser
    webbrowser.open(auth_url)

    # Handle one request
    while not server.should_stop:
        server.handle_request()

    print("\nDone! You can now add the credentials to Render.")


if __name__ == "__main__":
    main()
