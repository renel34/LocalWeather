import pool from './db.js';

/**
 * Saves weather data to the database
 * @param {object} weatherData - Current weather data
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} city
 * @returns {Promise<object>} The saved record
 */
export async function saveWeatherData(weatherData, latitude, longitude, city) {
  const query = `
    INSERT INTO weather_history (
      location,
      latitude,
      longitude,
      temperature,
      feels_like,
      temp_min,
      temp_max,
      humidity,
      pressure,
      wind_speed,
      wind_deg,
      rain,
      clouds,
      weather_description,
      weather_icon
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *;
  `;

  const values = [
    city,
    latitude,
    longitude,
    weatherData.temperature,
    weatherData.feelsLike,
    weatherData.tempMin,
    weatherData.tempMax,
    weatherData.humidity,
    weatherData.pressure.inHg,
    weatherData.wind.speed,
    weatherData.wind.deg,
    weatherData.rain,
    weatherData.clouds,
    weatherData.weatherDescription,
    weatherData.weatherIcon,
  ];

  try {
    const result = await pool.query(query, values);
    console.log('Weather data saved to database:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving weather data:', error);
    throw error;
  }
}

/**
 * Fetches the last 30 days of weather data for a location
 * @param {string} location - City name
 * @returns {Promise<array>} Array of weather records
 */
export async function getWeatherHistory(location) {
  const query = `
    SELECT
      created_at,
      temperature,
      humidity,
      pressure
    FROM weather_history
    WHERE location = $1
    AND created_at >= NOW() - INTERVAL '30 days'
    ORDER BY created_at ASC;
  `;

  try {
    const result = await pool.query(query, [location]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching weather history:', error);
    throw error;
  }
}