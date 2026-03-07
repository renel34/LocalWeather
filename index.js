import express from "express";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables from a .env file into process.env
dotenv.config();

/**
 * Converts pressure from hectopascals (hPa) to inches of mercury (inHg).
 * @param {number} hPa - The pressure value in hectopascals.
 * @returns {string} The pressure value in inches of mercury, formatted to two decimal places.
 */
function hPaToInHg(hPa) {
  return (hPa * 0.02953).toFixed(2);
}

/**
 * Fetches current weather and 5-day forecast data from the OpenWeatherMap API.
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} city
 * @param {string} region_code
 * @param {string} country_name
 * @returns {Promise<object>} An object containing formatted current weather and forecast data.
 */
async function fetchWeatherData(
  latitude,
  longitude,
  city,
  region_code,
  country_name,
) {
  // API URLs for current weather and 5-day forecast
  const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=imperial&appid=${WEATHER_API_KEY}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=imperial&appid=${WEATHER_API_KEY}`;

  // Fetch both current weather and forecast data in parallel
  const [currentWeatherResponse, forecastResponse] = await Promise.all([
    axios.get(currentWeatherUrl),
    axios.get(forecastUrl),
  ]);

  // Structure the current weather data into a more usable format
  const weatherData = {
    location: `${city}, ${region_code}, ${country_name}`,
    temperature: Math.round(currentWeatherResponse.data.main.temp),
    feelsLike: Math.round(currentWeatherResponse.data.main.feels_like),
    tempMin: Math.round(currentWeatherResponse.data.main.temp_min),
    tempMax: Math.round(currentWeatherResponse.data.main.temp_max),
    humidity: currentWeatherResponse.data.main.humidity,
    pressure: {
      inHg: hPaToInHg(currentWeatherResponse.data.main.pressure),
    },
    wind: {
      speed: currentWeatherResponse.data.wind
        ? currentWeatherResponse.data.wind.speed
        : "N/A",
      deg: currentWeatherResponse.data.wind
        ? currentWeatherResponse.data.wind.deg
        : "N/A",
    },
    rain: currentWeatherResponse.data.rain
      ? currentWeatherResponse.data.rain["1h"] || 0
      : 0,
    clouds: currentWeatherResponse.data.clouds
      ? currentWeatherResponse.data.clouds.all
      : "N/A",
    weatherIcon: currentWeatherResponse.data.weather[0].icon,
    weatherDescription: currentWeatherResponse.data.weather[0].description,
  };

  // Process the forecast data to get one forecast per day for the next 5 days
  const forecastData = forecastResponse.data.list
    .filter((item, index) => index % 8 === 0) // The API returns data every 3 hours, so we take one entry every 24 hours (8 * 3 = 24)
    .slice(0, 5) // Get the next 5 days
    .map((item) => ({
      date: new Date(item.dt * 1000).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      temp: Math.round(item.main.temp),
      icon: item.weather[0].icon,
      description: item.weather[0].description,
    }));

  return { weatherData, forecastData };
}

// Initialize Express app and set port
const app = express();
const port = 3000;
// Get API key from environment variables
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// Middleware setup
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(express.static("public")); // Serve static files from the "public" directory

// Main route handler for the homepage
app.get("/", async (req, res) => {
  try {
    // Get user's location based on their IP address
    const ipResponse = await axios.get("https://ipapi.co/json/");
    const { city, region_code, country_name, latitude, longitude } =
      ipResponse.data;
    console.log(
      `Location data fetched: ${city}, ${region_code}, ${country_name} (${latitude}, ${longitude})`,
    );

    // Fetch weather data for the selected location
    const { weatherData, forecastData } = await fetchWeatherData(
      latitude,
      longitude,
      city,
      region_code,
      country_name,
    );

    // Render the main page with the weather data
    res.render("index.ejs", { weatherData, forecastData, error: null });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).send("Error fetching weather data");
  }
});

// Route handler for location search
app.get("/search", async (req, res) => {
  try {
    const location = req.query.location;
    if (!location) {
      // If no location is provided, render the page with an error
      return res.render("index.ejs", {
        error: "Location is required",
        weatherData: null,
        forecastData: [],
      });
    }

    // Split the location string into parts (City, State/Province, Country)
    const parts = location.split(",").map((s) => s.trim());
    const city = parts[0] || "";
    const state = parts[1] || "";
    const country = parts[2] || "";

    // Build the query string for the geocoding API
    let query = city;
    if (state) query += `,${state}`;
    if (country) query += `,${country}`;

    console.log(`Final geocoding query: ${query}`);

    // Use the OpenWeatherMap Geocoding API to find coordinates for the location
    const geocodingUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=1&appid=${WEATHER_API_KEY}`;
    const geocodingResponse = await axios.get(geocodingUrl);

    // If the geocoding API returns no results, the location was not found
    if (geocodingResponse.data.length === 0) {
      return res.status(404).send("Location not found");
    }

    // Extract location details from the geocoding response
    const {
      lat,
      lon,
      name,
      country: countryCode,
      state: region_code,
    } = geocodingResponse.data[0];

    // Fetch weather data for the found coordinates
    const { weatherData, forecastData } = await fetchWeatherData(
      lat,
      lon,
      name,
      region_code || "",
      countryCode,
    );

    // Render the page with the new weather data
    res.render("index.ejs", { weatherData, forecastData, error: null });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).send("Error fetching weather data");
  }
});

// Start the server and listen for incoming requests
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
