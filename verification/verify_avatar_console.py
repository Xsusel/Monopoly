from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen for console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        page.goto("http://localhost:3000")

        # Test Avatar Selection
        page.get_by_placeholder("Twój Nick").fill("EmojiPlayer")

        # Click on '🚗' avatar
        page.get_by_text("🚗").click()

        page.get_by_placeholder("Nazwa Pokoju (np. DOMOWKA)").fill("EMOJI_ROOM")
        page.get_by_role("button", name="GRAJ").click()

        # Wait for Room with longer timeout
        try:
            expect(page.get_by_role("heading", name="POCZEKALNIA: EMOJI_ROOM")).to_be_visible(timeout=5000)
        except Exception as e:
            print("Failed to see Lobby. Page content:")
            print(page.locator("body").inner_text())
            page.screenshot(path="verification/failed_lobby.png")
            raise e

        browser.close()

if __name__ == "__main__":
    run()
