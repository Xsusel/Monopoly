from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3000")

        # Test Avatar Selection
        page.get_by_placeholder("Twój Nick").fill("EmojiPlayer")

        # Click on '🚗' avatar
        page.get_by_text("🚗").click()

        page.get_by_placeholder("Nazwa Pokoju (np. DOMOWKA)").fill("EMOJI_ROOM")
        page.get_by_role("button", name="GRAJ").click()

        # Wait for Room with longer timeout
        try:
            expect(page.get_by_role("heading", name="POCZEKALNIA: EMOJI_ROOM")).to_be_visible(timeout=10000)
        except Exception as e:
            print("Failed to see Lobby. Page content:")
            print(page.locator("body").inner_text())
            page.screenshot(path="verification/failed_lobby.png")
            raise e

        # Check Avatar in Lobby
        expect(page.locator("li")).to_contain_text("🚗")
        expect(page.locator("li")).to_contain_text("EmojiPlayer")

        # Start Game
        page.get_by_role("button", name="START GRY").click()

        # Wait for board
        expect(page.locator(".board-grid")).to_be_visible(timeout=10000)

        # Check Token on Board (Initially at Start pos)
        # Token should contain "🚗"
        expect(page.locator(".token").first).to_have_text("🚗")

        # Check Sidebar
        expect(page.locator(".sidebar")).to_contain_text("🚗")

        # Test Deed Card Hover
        # Find a property (e.g., class .cell-1 is Białystok)
        cell1 = page.locator(".cell-1")
        cell1.hover()

        # Check Deed Card visibility
        expect(page.locator(".cell-1 .deed-card")).to_be_visible()
        expect(page.locator(".cell-1 .deed-card")).to_contain_text("Czynsz:")

        print("Avatar and Deed Card verification successful")
        page.screenshot(path="verification/avatar_test.png")

        browser.close()

if __name__ == "__main__":
    run()
