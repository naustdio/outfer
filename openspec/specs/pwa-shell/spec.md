# PWA Shell Specification

## Purpose

Defines installability and app-shell-only offline caching for the closet-app PWA. Offline caching of catalog data is explicitly out of scope.

## Requirements

### Requirement: Installability
The application MUST expose a valid `manifest.json` (name, icons, start URL, display mode) so browsers offer it as an installable PWA.

#### Scenario: Browser offers install prompt
- GIVEN a supporting browser loading the app over HTTPS with a valid manifest and registered service worker
- WHEN installability criteria are met
- THEN the browser MUST be able to offer installing the app to the home screen/desktop

#### Scenario: Installed app launches in standalone display
- GIVEN the app has been installed
- WHEN the user opens it from the installed icon
- THEN it MUST launch using the manifest's configured display mode (not a browser tab with full chrome)

### Requirement: App-Shell-Only Offline Caching
The service worker MUST cache the app shell (static HTML/CSS/JS assets required to boot the UI) so the shell loads with the network offline. The service worker MUST NOT cache or serve catalog data (garments, outfits, tips) for offline use — data fetches MUST remain network-dependent.

#### Scenario: App shell loads offline
- GIVEN the service worker has cached the app shell on a prior online visit
- WHEN the network is offline and the user opens the app
- THEN the app shell UI MUST render

#### Scenario: Data screens do not serve stale cached data offline
- GIVEN the network is offline
- WHEN the user navigates to a screen that fetches catalog data (e.g., garment list)
- THEN the app MUST NOT serve a previously cached data response as if it were live; it MUST surface that data cannot be loaded offline

#### Scenario: Service worker updates the cached shell on new deploys
- GIVEN a new version of the app shell is deployed
- WHEN the service worker detects the update
- THEN it MUST refresh the cached shell assets rather than serving the stale version indefinitely
