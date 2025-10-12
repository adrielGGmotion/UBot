import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Log all network requests to the console for debugging
        page.on("request", lambda request: print(">>", request.method, request.url))
        page.on("response", lambda response: print("<<", response.status, response.url))

        # Mock global API endpoints that are called on all pages
        await page.route("**/api/info", lambda route: route.fulfill(
            status=200,
            json={"bot": {"tag": "TestBot#1234"}, "guilds": 1}
        ))

        await page.route("**/api/guilds", lambda route: route.fulfill(
            status=200,
            json=[{"id": "12345", "name": "Test Guild", "icon": ""}]
        ))

        # Mock API endpoints before navigating
        await page.route("**/api/guilds/12345/roles", lambda route: route.fulfill(
            status=200,
            json=[
                {"id": "role1", "name": "Moderator", "color": "#ff0000"},
                {"id": "role2", "name": "DJ", "color": "#00ff00"},
                {"id": "role3", "name": "Member", "color": "#0000ff"},
                {"id": "role4", "name": "Bot", "color": "#ffff00"},
            ]
        ))

        await page.route("**/api/guilds/12345/settings", lambda route: route.fulfill(
            status=200,
            json={
                "settings": {
                    "musicConfig": {
                        "managerRoles": ["role1", "role2"],
                        "blacklistedRoles": ["role4"],
                        "autoplay": True,
                        "embedColor": True,
                    }
                },
                "availableChannels": []
            }
        ))

        await page.route("**/api/guilds/12345/player-status", lambda route: route.fulfill(
            status=200,
            json={
                "isPlaying": True,
                "isPaused": False,
                "track": {
                    "title": "The Chain",
                    "author": "Fleetwood Mac",
                    "uri": "https://www.youtube.com/watch?v=v--IqqusnNQ",
                    "artworkUrl": "https://i.ytimg.com/vi/pcawnRIyeok/hqdefault.jpg",
                    "duration": 271000,
                    "position": 55000,
                },
                "queue": [{"title": "Go Your Own Way", "author": "Fleetwood Mac"}],
            }
        ))

        # Mock LRCLib API
        await page.route("https://lrclib.net/api/get**", lambda route: route.fulfill(
            status=200,
            json={
                "syncedLyrics": [
                    {"timestamp": "27930", "line": "Listen to the wind blow"},
                    {"timestamp": "30880", "line": "Watch the sun rise"},
                    {"timestamp": "54110", "line": "And if you don't love me now"},
                    {"timestamp": "57110", "line": "You will never love me again"},
                    {"timestamp": "60410", "line": "I can still hear you saying"},
                    {"timestamp": "63480", "line": "You would never break the chain (Never break the chain)"}
                ]
            }
        ))

        # Mock translation files
        await page.route("**/api/dashboard/locales/en", lambda route: route.fulfill(
            status=200,
            json={
                "settings_music_manager_roles": "Manager Roles",
                "settings_music_blacklisted_roles": "Blacklisted Roles",
                "music_control_panel_title": "Music Control Panel"
            }
        ))


        # Go to the page
        await page.goto("http://localhost:3000/login.html")

        # In DEV_MODE, there's no password, just click login
        # Use expect_navigation to reliably handle the redirect
        async with page.expect_navigation():
            # Use a more robust selector that doesn't depend on the button's text,
            # as it might be changed by the translation script.
            await page.locator("form#login-form button[type='submit']").click()

        # Go to the music system page for a specific guild
        await page.goto("http://localhost:3000/music_system.html?id=12345")

        # Wait for the page to load and elements to be visible
        await expect(page.get_by_text("Manager Roles")).to_be_visible()
        await expect(page.get_by_text("Music Control Panel")).to_be_visible()

        # Wait for the player to render
        await expect(page.get_by_text("The Chain")).to_be_visible()
        await expect(page.get_by_text("Fleetwood Mac")).to_be_visible()

        # Wait for the lyrics to appear
        await expect(page.get_by_text("Listen to the wind blow")).to_be_visible()

        # Take a screenshot
        await page.screenshot(path="jules-scratch/verification/music_system_verification.png", full_page=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
