from playwright.sync_api import sync_playwright

def verify_polnopoly():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a larger viewport to see the whole board
        context = browser.new_context(viewport={'width': 1200, 'height': 1000})
        page = context.new_page()

        # 1. Navigate to Home
        print("Navigating to home...")
        page.goto("http://localhost:3000")
        page.wait_for_load_state("networkidle")

        # Screenshot Home
        page.screenshot(path="verification/1_home.png")
        print("Screenshot 1: Home")

        # 2. Enter Room Name
        print("Creating room 'TESTROOM'...")
        page.fill("input[type='text']", "TESTROOM")
        page.click("button[type='submit']")

        # 3. Handle Nickname Modal (if it appears)
        # It should appear because we have no localStorage
        page.wait_for_selector(".modal", timeout=5000)
        print("Modal appeared. Entering Nickname...")
        page.screenshot(path="verification/2_modal.png")

        page.fill(".modal input", "GRACZ1")
        page.click(".modal button")

        # 4. Wait for Board
        print("Waiting for board...")
        page.wait_for_selector(".board-grid", timeout=10000)

        # 5. Interact (Roll Dice)
        # Wait for "RZUĆ KOSTKĄ" button
        try:
            # It might not be my turn if logic fails, but I am the first player
            page.wait_for_selector(".btn-roll", timeout=2000)
            print("Rolling dice...")
            page.click(".btn-roll")
            # Wait a bit for update
            page.wait_for_timeout(1000)
        except:
            print("Roll button not found (maybe not my turn or error?)")

        # 6. Screenshot Board
        print("Taking final screenshot...")
        page.screenshot(path="verification/3_board.png")

        browser.close()

if __name__ == "__main__":
    verify_polnopoly()
