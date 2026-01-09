from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3000")

        # Join
        page.get_by_placeholder("Twój Nick").fill("ChestTester")
        page.get_by_text("🐻").click()
        page.get_by_placeholder("Nazwa Pokoju").fill("CHEST_ROOM")
        page.get_by_role("button", name="GRAJ").click()

        expect(page.get_by_role("heading", name="POCZEKALNIA: CHEST_ROOM")).to_be_visible(timeout=10000)

        # Start
        page.get_by_role("button", name="START GRY").click()
        expect(page.locator(".board-grid")).to_be_visible(timeout=10000)

        # Verify "Skrzynia" exists on board (e.g. id=2)
        # Using xpath to find text "Skrzynia"
        expect(page.locator(".board-grid")).to_contain_text("Skrzynia")

        # We can't easily force landing on Chest without cheating or rolling many times.
        # But we can verify the text is present.

        print("Community Chest verification successful")
        browser.close()

if __name__ == "__main__":
    run()
