// Import required modules
import express from "express";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

function hPaToInHg(hPa) {
  return (hPa * 0.02953).toFixed(2);
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
    // Fetch user's location data based on IP
    const ipResponse = await axios.get("https://ipapi.co/json/");
    const { city, region_code, country_name, latitude, longitude } =
      ipResponse.data;
    console.log(
      `Location data fetched: ${city}, ${region_code}, ${country_name} (${latitude}, ${longitude})`
    );

    // Construct URLs for current weather and forecast API calls
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=imperial&appid=${WEATHER_API_KEY}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=imperial&appid=${WEATHER_API_KEY}`;

    // Make parallel API calls for current weather and forecast
    const [currentWeatherResponse, forecastResponse] = await Promise.all([
      axios.get(currentWeatherUrl),
      axios.get(forecastUrl),
    ]);

    // Process current weather data
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
      // Wind data processing
      wind: {
        // Check if wind data exists and extract wind speed
        speed: currentWeatherResponse.data.wind
          ? currentWeatherResponse.data.wind.speed
          : "N/A",
        // Check if wind data exists and extract wind direction in degrees
        deg: currentWeatherResponse.data.wind
          ? currentWeatherResponse.data.wind.deg
          : "N/A",
      },
      // Rain data processing
      rain: currentWeatherResponse.data.rain
        ? // Check if rain data exists
          currentWeatherResponse.data.rain["1h"] || 0 // Use 1-hour rainfall if available, otherwise 0
        : 0, // If no rain data, set to 0
      // Cloud coverage data processing
      clouds: currentWeatherResponse.data.clouds
        ? currentWeatherResponse.data.clouds.all // Extract cloud coverage percentage if available
        : "N/A", // If no cloud data, set to "N/A"
      weatherIcon: currentWeatherResponse.data.weather[0].icon,
      weatherDescription: currentWeatherResponse.data.weather[0].description,
    };

    // Process forecast data
    const forecastData = forecastResponse.data.list
      .filter((item, index) => index % 8 === 0) // Get one forecast per day (every 8th item)
      .slice(0, 5) // Limit to 5 days
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

    // Render the EJS template with weather and forecast data
    res.render("index.ejs", { weatherData, forecastData });
  } catch (error) {
    // Error handling
    console.error("Error:", error.message);
    res.status(500).send("Error fetching weather data");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
