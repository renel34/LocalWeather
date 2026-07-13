# Weather Station

A full-stack weather web app that auto-detects your location, shows current conditions and a 5-day forecast, and quietly builds a historical record of every place you've checked — charted right on the page.

![Node.js](https://img.shields.io/badge/Node.js-Runtime-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![EJS](https://img.shields.io/badge/EJS-Templates-B4CA65?logo=ejs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-Visualization-FF6384?logo=chartdotjs&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-green)

---

## Description

Weather Station is a server-rendered weather dashboard built with Express and EJS. On load, it geolocates the visitor by IP and immediately displays current conditions and a 5-day forecast pulled from the OpenWeatherMap API. Visitors can also search any city worldwide, which is resolved to coordinates through OpenWeatherMap's geocoding API.

Every location that gets viewed is persisted to PostgreSQL and re-sampled automatically once a day, building up a rolling history that's rendered as an interactive, dual-axis Chart.js graph of temperature, humidity, and pressure over the last 30 days.

---

## Overview

The app is a single Express server with no build step beyond compiling Tailwind CSS. Two data sources drive the UI: OpenWeatherMap (current conditions, forecast, geocoding) and ipapi.co (IP-based geolocation for first-time visitors). Every fetch — whether from the homepage, a search, or the daily scheduler — funnels through one `fetchWeatherData` function and is written to a single `weather_history` table via a small PostgreSQL data-access layer.

Locations are deduplicated in memory as they're viewed, and a lightweight in-process scheduler wakes up at noon each day to re-fetch and log conditions for every location seen so far, giving the temperature-history chart something meaningful to plot over time.

---

## Features

- **IP-based auto-location** on first load, with current conditions and forecast rendered immediately
- **Worldwide city search** (`City, State, Country`) resolved via OpenWeatherMap's geocoding API
- **Current conditions**: temperature, feels-like, min/max, humidity, pressure (converted to inHg), wind speed/direction, rain, and cloud cover
- **5-day forecast** with icons and daily highs
- **Automatic daily history logging** — every location viewed is re-sampled at noon and saved to PostgreSQL
- **30-day history chart** — dual-axis Chart.js line chart plotting temperature, humidity, and pressure trends per location
- **`/api/weather/history` JSON endpoint** for the last 30 days of readings for any tracked location
- **Responsive, dark-themed UI** built with Tailwind CSS

---

## Technologies Used

**Backend**

- Node.js + Express 5
- EJS server-side templating
- Axios for outbound API calls
- dotenv for configuration

**Database**

- PostgreSQL via `pg` (connection pooling, parameterized queries)

**Frontend**

- Tailwind CSS 4 (CLI build)
- Chart.js (loaded via CDN) for the temperature/humidity/pressure history chart

**External APIs**

- [OpenWeatherMap](https://openweathermap.org/api) — current weather, 5-day forecast, geocoding
- [ipapi.co](https://ipapi.co) — IP-based geolocation

---

## Skills Demonstrated

- Server-rendered full-stack architecture with Express and EJS partials (header/footer/chart includes)
- Consuming and normalizing multiple third-party REST APIs into one consistent internal shape
- Relational schema design and parameterized SQL for time-series weather data
- Building a self-contained in-process scheduler (no external cron) that survives across the app's daily cycle
- Data visualization with multi-axis, multi-series Chart.js charts driven by a JSON API
- Responsive, accessible dark-mode UI design with Tailwind CSS

---

## Project Structure

```
Weather App/
├── index.js                    # Express app: routes, weather fetching, daily scheduler
├── src/
│   ├── db.js                     # PostgreSQL connection pool
│   ├── weatherService.js         # saveWeatherData / getWeatherHistory (data access layer)
│   └── input.css                 # Tailwind entry point
├── views/
│   ├── index.ejs                  # Main page: current conditions + forecast
│   ├── header.ejs                 # Branding + search form
│   ├── footer.ejs
│   └── temperatureChart.ejs       # Chart.js 30-day history chart
├── public/
│   ├── output.css                 # Compiled Tailwind output
│   └── pictures/                  # Static images/icons
├── tailwind.config.js
└── package.json
```

---

## Installation

### Prerequisites

- Node.js
- PostgreSQL
- An [OpenWeatherMap](https://openweathermap.org/api) API key

### 1. Clone the repository

```bash
git clone https://github.com/renel34/LocalWeather.git
cd LocalWeather
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
WEATHER_API_KEY=your_openweathermap_api_key
PORT=3000

# Local PostgreSQL connection
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=weather_app
```

### 4. Set up the database

See [Database](#database) below for the schema.

### 5. Build Tailwind CSS

```bash
npm run build:css
```

### 6. Run the app

```bash
npm start      # production
npm run dev    # with nodemon (auto-restart)
```

The app runs at `http://localhost:3000` (or your configured `PORT`).

---

## Database

```sql
CREATE TABLE weather_history (
  id SERIAL PRIMARY KEY,
  location VARCHAR(255) NOT NULL,
  latitude numeric(10,8) NOT NULL,
  longitude numeric(11,8) NOT NULL,
  temperature numeric(5,2) NOT NULL,
  feels_like numeric(5,2),
  temp_min numeric(5,2),
  temp_max numeric(5,2),
  humidity INTEGER,
  pressure numeric(7,2),
  wind_speed numeric(5,2),
  wind_deg integer,
  rain numeric(5,2),
  clouds INTEGER,
  weather_description VARCHAR(255),
  weather_icon VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);
```

Every fetch — homepage load, search, or scheduled daily update — writes one row here, keyed loosely by `location`, so the history chart and API can query back up to 30 days per city.

---

## API Integration

| Method | Endpoint                                | Description                                                                                                                    |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/`                                     | Auto-detects the visitor's location by IP and renders current weather + forecast                                               |
| `GET`  | `/search?location=<city,state,country>` | Geocodes the given location and renders its current weather + forecast                                                         |
| `GET`  | `/api/weather/history?location=<city>`  | Returns up to 30 days of saved readings (timestamp, temperature, humidity, pressure) for the given location, used by the chart |

---

## How It Works

1. On homepage load, the server calls `ipapi.co` to resolve the visitor's city, region, country, and coordinates.
2. Those coordinates are passed to OpenWeatherMap's current-weather and 5-day-forecast endpoints in parallel, and the response is normalized into a single `weatherData`/`forecastData` shape.
3. The resolved location is added to an in-memory `Set` of tracked locations (deduplicated via JSON string equality), and the current reading is saved to `weather_history`.
4. Searching a city instead routes the free-text input through OpenWeatherMap's geocoding API to resolve coordinates, then follows the same fetch-and-save path.
5. The page renders the current conditions, 5-day forecast, and a Chart.js panel that calls `/api/weather/history` client-side to plot the last 30 days for that location.
6. A scheduler computes the milliseconds until the next noon, fires once then, and re-runs every 24 hours after — looping over every tracked location to fetch and log a fresh reading, so the history chart keeps growing even without new visits.

---

## Challenges Solved

- **Deployment port binding** — the port was hardcoded initially, which broke on hosts that assign their own port dynamically; the server now reads `process.env.PORT` with a local fallback.
- **Building history without a cron dependency** — rather than pulling in an external scheduler, the app computes exact milliseconds until the next local noon (`msUntilNextNoon`), fires a `setTimeout` once, then hands off to a 24-hour `setInterval`, keeping the daily-refresh logic self-contained in `index.js`.
- **Dual-axis charting** — temperature/humidity and pressure live on very different numeric scales; the history chart uses two Y axes (`y` and `y1`) so pressure trends stay readable alongside temperature and humidity on the same chart.
- **Inconsistent API response shapes** — OpenWeatherMap omits `wind` or `rain` objects entirely when there's no data, which crashed naive property access; `fetchWeatherData` normalizes those cases to `"N/A"` / `0` before the value ever reaches the template.

---

## What I Learned

- How to structure an Express app so multiple entry points (homepage, search, scheduler) share one weather-fetching and persistence path instead of duplicating logic
- Writing environment-aware code (local vs. hosted database config) that adapts based on which variables are present rather than requiring separate code paths
- Implementing a reliable, dependency-free scheduling pattern in plain Node.js
- Designing a time-series schema and querying it efficiently for a rolling window (`INTERVAL '30 days'`)
- Building multi-series, multi-axis charts with Chart.js driven entirely by a JSON API
- Defensive normalization of third-party API responses so partial or missing fields don't break server-rendered templates

---

## Author

**René Laplante**
Full-stack developer

---

## License

This project is licensed under the ISC License.
