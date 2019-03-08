var latestForecastCacheVersion = "0.1";
var weatherCache = {};

const WEATHER_REFRESH_RATE = 10 * 60000;
const MAX_WEATHER_AGE_TO_DISPLAY_IN_SECONDS = 60 * 60 * 2;

window.addEventListener("load", function() {
  initForecastCache(function() {
    initApiKeys(function() {
      scheduleSync("weather", refreshWeather, WEATHER_REFRESH_RATE, weatherCache.lastUpdateInMillis)
    });
    updateUiFromCache();
  });
});

function initForecastCache(callback) {
  chrome.storage.local.get({weatherCache: {}}, function(items) {
    if (items.weatherCache.version == latestForecastCacheVersion) {
      weatherCache = items.weatherCache
    } else {
      weatherCache = {version: latestForecastCacheVersion, forecast: {}, current: {}}
    }
    callback();
  });
}

function refreshWeather() {
  console.log('Refreshing weather');
  var darkSkyKey = getKey("dark-sky");
  if (darkSkyKey) {
    $.ajax({
      url: "https://api.darksky.net/forecast/" + darkSkyKey + "/41.547540,-87.461620"
    })
      .done(handleDarkSkyResponse)
      .fail(logAjaxError('dark sky forecast', updateUiFromCache));
  }
}

function formatTemp(temp) {
  return Math.round(temp) + '\u00B0';
}

var weatherIcons = {
  'clear-day': 'clear',
  'clear-night': 'clear',
  'rain': 'rain',
  'snow': 'snow',
  'sleet': 'sleet',
  'wind': 'clear',
  'fog': 'fog',
  'cloudy': 'cloudy',
  'partly-cloudy-day': 'partlycloudy',
  'partly-cloudy-night': 'partlycloudy'
}

function updateWeather(weatherData, iconId, tempId) {
  var iconElement = document.getElementById(iconId);
  if (iconElement) {
    var iconUrl;
    if (weatherData && weatherIcons[weatherData.icon]) {
      iconUrl = 'weather-icons/icons/black/svg/' + weatherIcons[weatherData.icon] + '.svg';
    } else {
      console.error('Unable to find weather icon in ' + weatherData);
      iconUrl = 'weather-icons/icons/black/svg/unknown.svg';
    }
    iconElement.src = iconUrl;
  }
  var tempElement = document.getElementById(tempId)
  if (tempElement) {
    if (weatherData && weatherData.temperature) {
      tempElement.innerText = formatTemp(weatherData.temperature);
    } else {
      tempElement.innerText = '?'
    }
  }
}

function handleDarkSkyResponse(response) {
  weatherCache.lastUpdateInMillis = new Date().getTime();
  weatherCache.current = response.currently
  updateForecast(response.hourly, weatherCache.forecast)
  chrome.storage.local.set({weatherCache: weatherCache});
  updateUiFromCache();
}

function updateForecast(hourly, forecast) {
  if (hourly) {
    for (var i = 0; i < hourly.data.length; i++) {
      var hourData = hourly.data[i];
      if (isToday(hourData)) {
        forecast[getDate(hourData).getHours()] = hourData
      }
    }
  }
  for (const [hour, forecastHour] of Object.entries(forecast)) {
    if (!isToday(forecastHour)) {
      delete forecast[hour]
    }
  }
}

function getDate(weatherData) {
  var date = new Date(0);
  date.setUTCSeconds(weatherData.time);
  return date;
}

function isToday(forecastHour) {
  return getDate(forecastHour).getDate() == (new Date()).getDate();
}

function updateUiFromCache() {
  var timeInSeconds = new Date().getTime() / 1000;
  var weatherTimeInSeconds;
  if (weatherCache.current &&
    weatherCache.current.time &&
    timeInSeconds - weatherCache.current.time < MAX_WEATHER_AGE_TO_DISPLAY_IN_SECONDS) {
    updateWeather(weatherCache.current, 'weather-current-icon', 'weather-current-temp');
  } else  {
    console.error("Unable to get current weather from " + weatherCache);
    updateWeather(null, 'weather-current-icon', 'weather-current-temp');
  }
  updateRecess(10, '1');
  updateRecess(12, '2');
  updateRecess(14, '3');
}

function updateRecess(hour, recessNumber) {
  var hourData = weatherCache.forecast[hour];
  if (hourData && !isToday(hourData)) {
    hourData = null;
  }
  if (!hourData) {
    console.error("No forecast for hour " + hour + " in " + weatherCache.forecast);
  }
  updateWeather(
    hourData,
    'weather-recess-' + recessNumber + '-icon',
    'weather-recess-' + recessNumber + '-temp');
}
