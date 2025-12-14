// Import required modules
import express from "express";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

function hPaToInHg(hPa) {
  return (hPa * 0.02953).toFixed(2);
}

async function fetchWeatherData(
  latitude,
  longitude,
  city,
  region_code,
  country_name
) {
  const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=imperial&appid=${WEATHER_API_KEY}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=imperial&appid=${WEATHER_API_KEY}`;

  const [currentWeatherResponse, forecastResponse] = await Promise.all([
    axios.get(currentWeatherUrl),
    axios.get(forecastUrl),
  ]);

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

  const forecastData = forecastResponse.data.list
    .filter((item, index) => index % 8 === 0)
    .slice(0, 5)
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Main route handler
app.get("/", async (req, res) => {
  try {
    const ipResponse = await axios.get("https://ipapi.co/json/");
    const { city, region_code, country_name, latitude, longitude } =
      ipResponse.data;
    console.log(
      `Location data fetched: ${city}, ${region_code}, ${country_name} (${latitude}, ${longitude})`
    );

    const { weatherData, forecastData } = await fetchWeatherData(
      latitude,
      longitude,
      city,
      region_code,
      country_name
    );

    res.render("index.ejs", { weatherData, forecastData, error: null });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).send("Error fetching weather data");
  }
});

app.get("/search", async (req, res) => {
  try {
    const location = req.query.location;
    if (!location) {
      return res.render("index.ejs", {
        error: "Location is required",
        weatherData: null,
        forecastData: [],
      });
    }

    // Split into parts (City, State/Province, Country)
    const parts = location.split(",").map((s) => s.trim());
    const city = parts[0] || "";
    const state = parts[1] || "";
    const country = parts[2] || "";

    // Build query string
    let query = city;
    if (state) query += `,${state}`;
    if (country) query += `,${country}`;

    console.log(`Final geocoding query: ${query}`);

    const geocodingUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=1&appid=${WEATHER_API_KEY}`;
    const geocodingResponse = await axios.get(geocodingUrl);

    if (geocodingResponse.data.length === 0) {
      return res.status(404).send("Location not found");
    }

    const {
      lat,
      lon,
      name,
      country: countryCode,
      state: region_code,
    } = geocodingResponse.data[0];

    const { weatherData, forecastData } = await fetchWeatherData(
      lat,
      lon,
      name,
      region_code || "",
      countryCode
    );

    res.render("index.ejs", { weatherData, forecastData, error: null });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).send("Error fetching weather data");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
