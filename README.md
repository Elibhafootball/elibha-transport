# Elibha Transport — Journey Planner

A static, browser-based multimodal journey planner for Elibha, using the Google Sheets transport timetable as the authoritative source.

## Current state
Prototype under testing. The site includes autocomplete across 407 stations, airports and ferry terminals; scheduled trains, Brados Underground, ferries and optional flights; expandable legs; and Earlier/Later navigation. Complex journeys and overnight cases still require further end-to-end validation.

## Local preview
Run a static web server from the repository root (opening index.html directly with file:// will not load the JSON data):
```sh
python3 -m http.server 8000
```
Then open http://localhost:8000.

## Automated tests
Requires Node.js 22 or later:
```sh
npm test
```
GitHub Actions also runs the tests on pushes to main.

## Hosting
The site is ready for a **GitHub Pages** static deployment, but publishing must be enabled in the repository settings:
1. Go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main**, folder **/(root)**, then **Save**.
4. Once GitHub reports deployment success, open the Pages URL shown there.

## Data
- `data/stations.json`: location names and unique three-letter codes.
- `data/timetable.json`: compiled services and interchange walking times.
- `data/config.json`: routing configuration.
- `js/journey-engine.js`: journey search.
- `js/app.js`: user interface.

Data is currently refreshed manually from the source Google Sheet. **Do not edit the spreadsheet from this repository.** Changes to the source Sheet will not appear automatically until the JSON is recompiled and committed.

## Known limitations
- Timetables are assumed to repeat every day; service calendars and specific dates are not yet modelled.
- Complex multimodal journeys may still produce suboptimal alternatives, especially when multiple changes are possible.
- The journey finder currently searches a bounded window and does not guarantee all possible itineraries.
- Results should be treated as a test prototype until route-by-route validation is complete.
