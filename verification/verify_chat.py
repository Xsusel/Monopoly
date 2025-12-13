from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Player 1
        page1 = browser.new_page()
        page1.goto("http://localhost:3000")
        page1.get_by_placeholder("Twój Nick").fill("HostPlayer")
        page1.get_by_placeholder("Nazwa Pokoju (np. DOMOWKA)").fill("CHATROOM")
        page1.get_by_role("button", name="GRAJ").click()
        expect(page1.get_by_role("heading", name="POCZEKALNIA: CHATROOM")).to_be_visible()

        # Player 2
        page2 = browser.new_page()
        page2.goto("http://localhost:3000")
        page2.get_by_placeholder("Twój Nick").fill("GuestPlayer")
        page2.get_by_placeholder("Nazwa Pokoju (np. DOMOWKA)").fill("CHATROOM")
        page2.get_by_role("button", name="GRAJ").click()

        expect(page2.get_by_role("heading", name="POCZEKALNIA: CHATROOM")).to_be_visible()

        # Start Game (Host)
        page1.get_by_role("button", name="START GRY").click()

        # Wait for board
        expect(page1.locator(".board-grid")).to_be_visible()
        expect(page2.locator(".board-grid")).to_be_visible()

        # Test Chat
        page1.get_by_role("button", name="Czat").click()
        page2.get_by_role("button", name="Czat").click()

        page1.locator("input[placeholder='...']").fill("Hello form P1")
        page1.locator("form.chat-input button").click()

        expect(page2.locator(".chat-messages")).to_contain_text("HostPlayer: Hello form P1")
        print("Chat verification successful")

        page1.screenshot(path="verification/game_chat.png")
        browser.close()

if __name__ == "__main__":
    run()
