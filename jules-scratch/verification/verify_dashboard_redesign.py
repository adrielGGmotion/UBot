from playwright.sync_api import sync_playwright, expect
import time

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    BASE_URL = "http://localhost:3000"
    SCREENSHOT_DIR = "jules-scratch/verification"

    try:
        # 1. Login
        print("Navigating to login page...")
        page.goto(f"{BASE_URL}/login.html", timeout=60000)
        page.locator("#password").fill("admin")
        page.locator('form#login-form button[type="submit"]').click()
        print("Login successful.")

        # 2. Index Page
        print("Verifying index.html...")
        expect(page.locator("#guild-count")).to_be_visible(timeout=30000)
        time.sleep(2) # Allow animations and charts to render
        page.screenshot(path=f"{SCREENSHOT_DIR}/01_index.png", full_page=True)
        print("Screenshot for index.html taken.")

        # 3. Stats Page
        print("Verifying stats.html...")
        page.locator('a[href="stats.html"]').click()
        expect(page.locator("#command-chart")).to_be_visible(timeout=30000)
        time.sleep(2)
        page.screenshot(path=f"{SCREENSHOT_DIR}/02_stats.png", full_page=True)
        print("Screenshot for stats.html taken.")

        # 4. Profile Page
        print("Verifying profile.html...")
        page.locator('a[href="profile.html"]').click()
        expect(page.locator("#profile-form")).to_be_visible(timeout=30000)
        time.sleep(2)
        page.screenshot(path=f"{SCREENSHOT_DIR}/03_profile.png", full_page=True)
        print("Screenshot for profile.html taken.")

        # 5. Server Page (Bonus)
        print("Verifying server.html...")
        page.locator('a[href="index.html"]').click()
        expect(page.locator("#guilds-list")).to_be_visible(timeout=30000)
        if page.locator("#guilds-list a").count() > 0:
            page.locator("#guilds-list a").first.click()
            expect(page.locator("#server-name-title")).to_be_visible(timeout=30000)
            time.sleep(2)
            page.screenshot(path=f"{SCREENSHOT_DIR}/04_server.png", full_page=True)
            print("Screenshot for server.html taken.")
        else:
            print("No servers found to verify server.html, skipping screenshot.")


    except Exception as e:
        print(f"An error occurred during verification: {e}")
        # Take a screenshot of the failure state for debugging
        page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
    finally:
        print("Closing browser.")
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)