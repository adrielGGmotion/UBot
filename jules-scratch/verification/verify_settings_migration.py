import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    """
    This script verifies that the GitHub and Music settings have been
    migrated to their own pages and that the old 'Settings' link
    has been removed from the sidebar.
    """
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # 1. Go to the login page.
    page.goto("http://localhost:3000/login.html")

    # 2. Log in.
    password_input = page.locator("#password")
    password_input.fill("placeholder")
    login_button = page.get_by_role("button", name=re.compile("Login|Entrar", re.IGNORECASE))
    login_button.click()

    # 3. Mock the API response for the guilds list.
    page.route("**/api/guilds", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"id":"12345","name":"Test Server","icon":null}]'
    ))

    # 4. Wait for redirect to the main page and for the server list to load.
    expect(page).to_have_url("http://localhost:3000/")
    page.wait_for_selector("#guilds-list .guild-item")

    # 5. Click the first server to navigate to the server management page.
    first_server = page.locator("#guilds-list .guild-item").first
    first_server.click()

    # 5. Wait for the sidebar to load on the server page.
    expect(page.locator(".sidebar")).to_be_visible()

    # 6. Mock the settings API response
    page.route("**/api/guilds/12345/settings", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"settings":{"musicConfig":{"djRole":"DJ","autoplay":false,"embedColor":false},"githubRepos":[]},"availableChannels":[{"id":"ch1","name":"general"}]}'
    ))

    # 7. Navigate to the GitHub page.
    github_link = page.get_by_role("link", name="GitHub")
    github_link.click()

    # 8. Verify navigation and functionality.
    expect(page).to_have_url(re.compile(r".*github\.html\?id=12345"))
    expect(page.get_by_role("heading", name="GitHub Notifications")).to_be_visible()

    # Click the "Add Repository" button and verify the modal appears
    add_repo_button = page.locator("#add-repo-btn")
    add_repo_button.click()
    expect(page.locator("#repo-modal")).to_be_visible()

    page.screenshot(path="jules-scratch/verification/github_page.png")

    # Close the modal before proceeding
    close_button = page.locator("#repo-modal .close-btn")
    close_button.click()
    expect(page.locator("#repo-modal")).not_to_be_visible()

    # Navigate to the Music System page.
    music_link = page.get_by_role("link", name="Music System")
    music_link.click()

    # Check that the Music settings are present.
    expect(page.get_by_role("heading", name="Music", exact=True)).to_be_visible()
    page.screenshot(path="jules-scratch/verification/music_system_page.png")

    # 8. Check that the old "Settings" link is gone.
    settings_link = page.query_selector('a:has-text("Settings")')
    if settings_link:
        expect(settings_link).not_to_be_visible()

    browser.close()

with sync_playwright() as playwright:
    run(playwright)