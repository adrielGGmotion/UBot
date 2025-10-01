from playwright.sync_api import sync_playwright, expect
import re

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to login page
    page.goto("http://localhost:3000/login.html")

    # Enter password
    page.locator("#password").fill("password")

    # The translator script changes the button text from "Entrar" to "Login".
    # We wait for the button with the translated text "Login" to appear.
    login_button = page.get_by_role("button", name="Login")
    expect(login_button).to_be_visible()
    login_button.click()

    # Wait for navigation to the main page. The URL can be either / or /index.html.
    expect(page).to_have_url(re.compile(r"http://localhost:3000/(index.html)?$"))

    # Check for a visible, translated element on the dashboard.
    # This verifies that the dashboard-specific translation file is being loaded correctly.
    servers_title_element = page.locator('[data-locale-key="dashboard_servers_title"]')

    # The text should be "Servers" from the new dashboard en.json
    expect(servers_title_element).to_have_text("Servers")

    # Take a screenshot for visual confirmation
    page.screenshot(path="jules-scratch/verification/dashboard_translation.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)