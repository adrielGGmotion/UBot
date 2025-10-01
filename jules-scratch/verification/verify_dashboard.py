import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        try:
            # 1. Login
            await page.goto("http://localhost:3000/login.html")
            await page.get_by_label("Password").fill("password")
            await page.get_by_role("button", name="Login").click()
            await page.wait_for_url("http://localhost:3000/index.html")

            # 2. Verify main dashboard page
            await expect(page.get_by_text("Servers", exact=True)).to_be_visible()
            await page.screenshot(path="jules-scratch/verification/01_dashboard_full.png")

            # 3. Verify collapsible sidebar
            sidebar_toggle_button = page.locator("#sidebar-toggle")
            await sidebar_toggle_button.click()
            await page.wait_for_timeout(500) # Wait for animation
            await expect(page.locator(".sidebar.collapsed")).to_be_visible()
            await page.screenshot(path="jules-scratch/verification/02_dashboard_collapsed.png")

            # 4. Navigate to a new page to test sidebar consistency
            await page.locator('a[href="github.html"]').click()
            await page.wait_for_url("http://localhost:3000/github.html")
            await expect(page.get_by_text("This page is under construction.")).to_be_visible()
            await page.screenshot(path="jules-scratch/verification/03_github_page.png")

            # 5. Verify server settings page styling
            await page.goto("http://localhost:3000/server.html?id=123") # Dummy ID
            await page.wait_for_timeout(1000) # Wait for JS to load and replace text
            await page.screenshot(path="jules-scratch/verification/04_server_settings.png")

        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            await browser.close()

asyncio.run(main())