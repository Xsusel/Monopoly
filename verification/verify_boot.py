from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        page.goto("http://localhost:3000")

        # Check title
        expect(page.get_by_role("heading", name="POLNOPOLY")).to_be_visible()

        # Join
        page.get_by_placeholder("Twój Nick").fill("Tester")
        page.get_by_text("🦊").click()
        page.get_by_placeholder("Nazwa Pokoju").fill("TEST_BOOT")
        page.get_by_role("button", name="GRAJ").click()

        # Expect Lobby
        expect(page.get_by_role("heading", name="POCZEKALNIA: TEST_BOOT")).to_be_visible(timeout=10000)

        print("Boot verification successful")
        browser.close()

if __name__ == "__main__":
    run()
