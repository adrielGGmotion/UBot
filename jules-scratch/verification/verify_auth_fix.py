import re
from playwright.sync_api import Page, expect

def test_dashboard_management_page_loads(page: Page):
    """
    This test verifies that after logging in, the user can access the
    server management page without being redirected back to the login page.
    This validates the fix that removed the faulty client-side localStorage
    authentication logic.
    """

    # --- 1. Mock API Endpoints ---
    # Mock login API to simulate successful login
    page.route(
        "**/api/login",
        lambda route: route.fulfill(status=200)
    )

    # Mock guilds API to provide a server list on the main page
    page.route(
        "**/api/guilds",
        lambda route: route.fulfill(
            status=200,
            json=[{
                "id": "12345",
                "name": "Test Server",
                "icon": "icon_url",
                "memberCount": 10
            }]
        )
    )

    # Mock global info and stats for the main dashboard page
    page.route(
        "**/api/info",
        lambda route: route.fulfill(
            status=200,
            json={
                "bot": {"tag": "TestBot", "online": True, "uptime": "1h", "latency": 50},
                "guilds": 1,
                "colors": {}
            }
        )
    )
    page.route(
        "**/api/stats",
        lambda route: route.fulfill(
            status=200,
            json={
                "totalCommands": 100,
                "commandUsage": [{"commandName": "ping", "count": 100}]
            }
        )
    )

    # Mock stats for the specific management page
    page.route(
        "**/api/guilds/12345/stats",
        lambda route: route.fulfill(
            status=200,
            json={
                "onlineMembers": 5,
                "commandUsage": {
                    "ping": 10,
                    "play": 25
                }
            }
        )
    )

    # Mock sidebar HTML content
    page.route(
        "**/sidebar.html",
        lambda route: route.fulfill(
            status=200,
            content_type="text/html",
            body="""
                <div id="sidebar-toggle"></div>
                <a href="/server.html?id=12345" id="server-overview-link">Overview</a>
                <a href="/stats.html">Global Stats</a>
            """
        )
    )

    # Mock english dashboard translations
    page.route(
        "**/api/dashboard/locales/en.json",
        lambda route: route.fulfill(
            status=200,
            json={
                "dashboard_server_managing_title": "Managing: {{serverName}}",
                "dashboard_login_button": "Login"
            }
        )
    )

    # Mock the bot's main language file, as translator.js might request it.
    page.route(
        "**/api/locales/en.json",
        lambda route: route.fulfill(status=200, json={})
    )

    # --- 2. Arrange: Go to the login page ---
    page.goto("http://localhost:3000/login.html")

    # --- 3. Act: Log in ---
    # Wait for the translation engine to be ready before interacting with the page.
    page.evaluate("() => window.i18n.ready")

    # In DEV_MODE, no password is needed, just click the login button.
    # Use expect_navigation to reliably wait for the redirect after the click.
    with page.expect_navigation(url="http://localhost:3000/"):
        page.get_by_role("button", name="Login").click()

    # --- 4. Act: Navigate to the management page ---
    # After login, we are already on the main dashboard page.
    # We expect to see the "Test Server" link.
    expect(page.get_by_text("Test Server")).to_be_visible()

    # Click the link to go to the management page.
    page.get_by_text("Test Server").click()

    # --- 5. Assert: Verify we are on the correct page and not redirected ---
    # Check that the URL is correct for the management page.
    expect(page).to_have_url(re.compile(r".*/server.html\?id=12345"))

    # Check for an element unique to the management page to confirm it loaded.
    # Based on the mocked stats, we should see the online member count.
    expect(page.get_by_text("Managing: Test Server")).to_be_visible()

    # --- 6. Screenshot: Capture the final result ---
    page.screenshot(path="jules-scratch/verification/verification.png")