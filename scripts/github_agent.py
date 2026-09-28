#!/usr/bin/env python3
"""
FeeTrust GitHub Mobile Agent (LM Studio Integration)
Runs locally on your server/PC to handle commands sent from your phone via GitHub Issues.
Zero API cost - uses your local LM Studio instance!
"""

import os
import sys
import time
import json
import urllib.request
import urllib.error

# ------------------------------------------------------------------
# ENV FILE HELPER (Loads .env.local or .env if present)
# ------------------------------------------------------------------
def load_env():
    for env_name in [".env.local", ".env"]:
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), env_name)
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip('"').strip("'")
                        if k not in os.environ:
                            os.environ[k] = v

load_env()


# CONFIGURATION
# ------------------------------------------------------------------
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
REPO_FULL_NAME = os.getenv("GITHUB_REPOSITORY", "torvicpablero-glitch/Feet-Trust")
LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://127.0.0.1:1234/v1/chat/completions")
POLL_INTERVAL_SECONDS = 10

if "/" in REPO_FULL_NAME:
    REPO_OWNER, REPO_NAME = REPO_FULL_NAME.split("/", 1)
else:
    REPO_OWNER, REPO_NAME = "torvicpablero-glitch", "Feet-Trust"

# ------------------------------------------------------------------
# LM STUDIO QUERY
# ------------------------------------------------------------------
def query_lm_studio(prompt):
    payload = json.dumps({
        "model": "local-model",
        "messages": [
            {
                "role": "system",
                "content": "You are FeeTrust AI agent. Provide clear, concise coding guidance or answers."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 2048
    }).encode("utf-8")

    req = urllib.request.Request(
        LM_STUDIO_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        return (
            f"⚠️ Could not connect to LM Studio at `{LM_STUDIO_URL}`.\n\n"
            f"Please ensure:\n"
            f"1. LM Studio is running on your machine.\n"
            f"2. A model is loaded in LM Studio.\n"
            f"3. Local Server is started (Developer tab -> Start Server).\n\n"
            f"Error details: `{e}`"
        )

# ------------------------------------------------------------------
# GITHUB API HELPERS
# ------------------------------------------------------------------
def get_recent_issue_comments():
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/issues/comments?sort=created&direction=desc&per_page=10"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "FeeTrust-Local-Agent"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"❌ GitHub API Error [{e.code}]: {e.reason}")
        return []
    except Exception as e:
        print(f"❌ Failed to reach GitHub: {e}")
        return []

def post_issue_comment(comments_url, body_text):
    payload = json.dumps({"body": body_text}).encode("utf-8")
    req = urllib.request.Request(
        comments_url,
        data=payload,
        headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "FeeTrust-Local-Agent"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        print(f"❌ Failed to post comment back to GitHub: {e}")
        return False

# ------------------------------------------------------------------
# MAIN WORKER LOOP
# ------------------------------------------------------------------
def main():
    if not GITHUB_TOKEN:
        print("⚠️ WARNING: GITHUB_TOKEN environment variable is not set!")
        print("Please set GITHUB_TOKEN in your environment or .env.local file.")
        print("Required GitHub Token permissions: Repo (Issues Read/Write).\n")

    print("==================================================")
    print("🤖 FeeTrust GitHub Mobile Agent (LM Studio)")
    print("==================================================")
    print(f"📍 Target Repository: {REPO_OWNER}/{REPO_NAME}")
    print(f"🔗 LM Studio Endpoint: {LM_STUDIO_URL}")
    print(f"⏱️  Polling Interval: {POLL_INTERVAL_SECONDS} seconds")
    print("--------------------------------------------------")
    print("📱 Trigger from your phone: Post '!agent <your prompt>' in any GitHub Issue.")
    print("Press Ctrl+C to stop.\n")

    seen_comment_ids = set()
    initial_run = True

    while True:
        try:
            comments = get_recent_issue_comments()

            for comment in comments:
                cid = comment.get("id")
                body = comment.get("body", "").strip()

                if initial_run:
                    # On startup, mark existing comments as seen so we don't reply to old history
                    seen_comment_ids.add(cid)
                    continue

                if cid in seen_comment_ids:
                    continue

                seen_comment_ids.add(cid)

                # Check if comment triggers the agent
                if body.startswith("!agent") or body.startswith("@agent"):
                    prompt = body.split(" ", 1)[1] if " " in body else ""
                    if not prompt:
                        prompt = "Hello! Please summarize what you can do."

                    print(f"\n📩 [New Request from Phone]: '{prompt}'")
                    print("🧠 Querying LM Studio...")

                    reply = query_lm_studio(prompt)

                    issue_comments_url = comment.get("issue_url") + "/comments"
                    formatted_reply = f"🤖 **FeeTrust Local Agent Response**:\n\n{reply}"

                    print("📤 Posting reply to GitHub...")
                    success = post_issue_comment(issue_comments_url, formatted_reply)
                    if success:
                        print("✅ Reply posted successfully!")
                    else:
                        print("❌ Failed to post reply.")

            if initial_run:
                initial_run = False
                print("✅ Synchronized existing comments. Agent listening for NEW comments...")

        except KeyboardInterrupt:
            print("\n👋 Agent stopped.")
            sys.exit(0)
        except Exception as err:
            print(f"⚠️ Unexpected error: {err}")

        time.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    main()
