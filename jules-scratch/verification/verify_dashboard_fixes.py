import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        base_url = "http://localhost:3000"

        # 1. Verify the chart on stats.html
        print("Navigating to stats page to verify chart...")
        await page.goto(f"{base_url}/stats.html")
        await page.wait_for_selector("#command-chart")
        # Give chart animation time to settle
        await page.wait_for_timeout(1000)
        await page.screenshot(path="jules-scratch/verification/01_chart_fix.png")
        print("Screenshot of chart taken.")

        # 2. Verify the sidebar is visible on server.html with the toggle in the header
        print("Navigating to server page to verify sidebar...")
        # Since this is a dynamic page, we need to provide a guild ID
        # But since we are in DEV_MODE, we can't access a real guild.
        # We will just go to the page and check the static elements.
        await page.goto(f"{base_url}/server.html?guild=12345")
        await page.wait_for_selector(".sidebar")

        # Check that the sidebar is visible
        sidebar = page.locator(".sidebar")
        await expect(sidebar).to_be_visible()

        # Check that the toggle is in the header
        sidebar_toggle = page.locator(".sidebar-header #sidebar-toggle")
        await expect(sidebar_toggle).to_be_visible()

        await page.screenshot(path="jules-scratch/verification/02_sidebar_visible.png")
        print("Screenshot of visible sidebar taken.")

        # 3. Verify the sidebar is hidden on index.html
        print("Navigating to index page to verify hidden sidebar...")
        await page.goto(f"{base_url}/index.html")

        # The sidebar element should not be visible.
        # We check this by asserting its style `display: none;`
        sidebar = page.locator(".sidebar")
        await expect(sidebar).to_have_css("display", "none")

        await page.screenshot(path="jules-scratch/verification/03_sidebar_hidden.png")
        print("Screenshot of hidden sidebar taken.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())