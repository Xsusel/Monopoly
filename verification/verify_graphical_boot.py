from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3000")

        # Join
        page.get_by_placeholder("Twój Nick").fill("GraphTester")
        page.get_by_placeholder("Nazwa Pokoju").fill("GRAPH_ROOM")
        page.get_by_role("button", name="GRAJ").click()

        # Check Lobby
        expect(page.get_by_role("heading", name="POCZEKALNIA: GRAPH_ROOM")).to_be_visible(timeout=10000)

        # Check Glassmorphism (check background color rgba)
        # .sidebar background should be rgba(15, 23, 42, 0.85)
        # Playwright get_computed_style
        sidebar = page.locator(".lobby-screen") # Wait, sidebar is in Game mode.

        # Start Game
        page.get_by_role("button", name="START GRY").click()
        expect(page.locator(".board-grid")).to_be_visible(timeout=10000)

        # Check Sidebar styling
        # It's hard to verify exact visual "glass" effect in headless, but we can check if CSS loaded by checking a class existence or basic style.
        # We can check if  prop logic works:
        # One token should have .active-turn class?
        # Player "GraphTester" is the only one, and it is his turn.
        # So his token should have .active-turn

        expect(page.locator(".token.active-turn")).to_be_visible()

        print("Graphical boot verification successful")
        browser.close()

if __name__ == "__main__":
    run()
