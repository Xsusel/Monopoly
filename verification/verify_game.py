from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Visit Home
        page.goto("http://localhost:3000")

        # Check title
        expect(page.get_by_role("heading", name="POLNOPOLY")).to_be_visible()
        expect(page.get_by_role("heading", name="GRA EKONOMICZNA")).to_be_visible()

        # 2. Login
        page.get_by_placeholder("Twój Nick").fill("GraczTestowy")
        page.get_by_placeholder("Nazwa Pokoju (np. DOMOWKA)").fill("TESTROOM")
        page.get_by_role("button", name="GRAJ").click()

        # 3. Wait for Room to load
        expect(page.get_by_role("heading", name="POCZEKALNIA: TESTROOM")).to_be_visible()

        # 4. Screenshot Lobby
        page.screenshot(path="verification/lobby.png")
        print("Lobby screenshot taken")

        # 5. Start Game
        page.get_by_role("button", name="START GRY").click()

        # 6. Wait for Game Board
        # The class is .board-grid based on Board.jsx
        expect(page.locator(".board-grid")).to_be_visible(timeout=10000)

        # 7. Check Currency in UI
        expect(page.locator(".cash")).to_contain_text("PLN")

        # 8. Check Center Logo on Board
        expect(page.locator(".center-logo p")).to_have_text("GRA EKONOMICZNA")

        # 9. Check a Board Name (e.g. Białystok instead of Sosnowiec)
        # Using xpath or text search in .name class
        # .name is inside .board-cell
        # Let's just search for text "Białystok"
        expect(page.get_by_text("Białystok")).to_be_visible()
        expect(page.get_by_text("Warszawa Centrum")).to_be_visible()

        page.screenshot(path="verification/board.png")
        print("Board screenshot taken")

        browser.close()

if __name__ == "__main__":
    run()
