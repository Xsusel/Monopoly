from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3000")

        # Login as Host
        page.get_by_placeholder("Twój Nick").fill("TimerHost")
        page.get_by_placeholder("Nazwa Pokoju (np. DOMOWKA)").fill("TIMER_ROOM")
        page.get_by_role("button", name="GRAJ").click()

        expect(page.get_by_role("heading", name="POCZEKALNIA: TIMER_ROOM")).to_be_visible()

        # Check for Settings
        expect(page.locator("select")).to_be_visible()
        # Set timer to 30s
        page.select_option("select", "30")

        # Start Game
        page.get_by_role("button", name="START GRY").click()

        # Wait for board
        expect(page.locator(".board-grid")).to_be_visible()

        # Check Timer Visibility
        expect(page.locator(".turn-timer")).to_be_visible()

        # Get initial timer text (e.g., "⏳ 0:30")
        initial_timer = page.locator(".turn-timer").text_content()
        print(f"Initial timer: {initial_timer}")

        # Wait 5 seconds
        time.sleep(5)

        # Check timer decreased
        current_timer = page.locator(".turn-timer").text_content()
        print(f"Current timer: {current_timer}")

        if initial_timer == current_timer:
           print("Timer not moving!")
           exit(1)

        # Wait for timeout (30s total, we waited 5, wait 30 more to be safe)
        print("Waiting for turn timeout...")
        # We need to detect turn change.
        # "TimerHost" started. So turn index 0.
        # When timeout happens, it should switch. But single player?
        # If single player, nextTurn goes back to index 0.
        # But logs should show "Czas minął".

        # Let's wait until log appears.
        expect(page.locator(".logs")).to_contain_text("Czas minął!", timeout=35000)

        print("Timeout log found!")
        page.screenshot(path="verification/timer_test.png")

        browser.close()

if __name__ == "__main__":
    run()
