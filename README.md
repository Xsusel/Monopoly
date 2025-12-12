# POLNOPOLY – EDYCJA CEBULA

Multiplayerowa gra ekonomiczna w czasie rzeczywistym z silnym naciskiem na polskie realia i memy.

## Wymagania

- Node.js (wersja 16 lub nowsza)
- npm

## Instalacja i Uruchomienie (Lokalnie)

1. **Pobierz repozytorium**

2. **Zainstaluj zależności i zbuduj Frontend**
   ```bash
   cd client
   npm install
   npm run build
   ```
   To stworzy folder `client/dist` z gotową stroną.

3. **Zainstaluj zależności Backendu**
   ```bash
   cd ../server
   npm install
   ```

4. **Uruchom serwer**
   ```bash
   node index.js
   ```

5. **Graj**
   Otwórz przeglądarkę i wejdź na `http://localhost:3000`.

## Instalacja na Serwerze (VPS / Linux)

1. Zaloguj się na serwer przez SSH.
2. Sklonuj repozytorium.
3. Wykonaj kroki budowania (jak wyżej).
4. Do utrzymania działania serwera w tle polecamy `pm2`:
   ```bash
   npm install -g pm2
   cd server
   pm2 start index.js --name "polnopoly"
   ```
5. Jeśli używasz Nginx, skonfiguruj proxy pass na port 3000.

## Konfiguracja
Plik konfiguracyjny planszy znajduje się w `server/data/board.json`. Możesz tam zmieniać nazwy miast, ceny i czynsze.

## Aktualizacja na Serwerze

Aby zaktualizować grę po wprowadzeniu zmian w kodzie:

1. Zaloguj się na serwer i wejdź do folderu projektu:
   ```bash
   cd /sciezka/do/projektu
   ```

2. Pobierz zmiany z repozytorium:
   ```bash
   git pull origin main
   ```

3. Przebuduj frontend (jeśli były zmiany w `client`):
   ```bash
   cd client
   npm install  # Opcjonalnie, jeśli doszły biblioteki
   npm run build
   cd ..
   ```

4. Zrestartuj serwer backendu (używając PM2):
   ```bash
   cd server
   npm install # Opcjonalnie, jeśli doszły biblioteki
   pm2 restart polnopoly
   ```

5. Gotowe! Odśwież stronę w przeglądarce.
