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

function saveForecastCache() {
  chrome.storage.local.set({weatherCache: weatherCache});
}

function refreshWeather() {
  console.log('Refreshing weather');
  var weatherUndergroundKey = getKey("weather-underground");
  if (weatherUndergroundKey) {
    $.ajax({
      url: "http://api.wunderground.com/api/" + weatherUndergroundKey + "/conditions/q/IN/46322.json"
    })
      .done(handleWeatherUndergroundConditionsResponse)
      .fail(logAjaxError('weather underground conditions', updateUiFromCache));
    $.ajax({
      url: "http://api.wunderground.com/api/" + weatherUndergroundKey + "/hourly/q/IN/46322.json"
    })
      .done(handleWeatherUndergroundHourlyResponse)
      .fail(logAjaxError('weather underground hourly', updateUiFromCache));
  }
}

function formatTemp(temp) {
  return Math.round(temp) + '\u00B0';
}

var weatherIcons = {
  'chanceflurries': 'chanceflurries',
  'chancerain': 'chancerain',
  'chancesleet': 'chancesleet',
  'chancesnow': 'chancesnow',
  'chancetstorms': 'chancetstorms',
  'clear': 'clear',
  'cloudy': 'cloudy',
  'flurries': 'flurries',
  'fog': 'fog',
  'hazy': 'hazy',
  'mostlycloudy': 'mostlycloudy',
  'mostlysunny': 'mostlysunny',
  'partlycloudy': 'partlycloudy',
  'partlysunny': 'partlysunny',
  'rain': 'rain',
  'sleet': 'sleet',
  'snow': 'snow',
  'sunny': 'sunny',
  'tstorms': 'tstorms'
}

function updateWeatherIcon(iconId, code, url) {
  var iconElement = document.getElementById(iconId);
  if (iconElement) {
    var iconUrl;
    if (weatherIcons[code]) {
      iconUrl = 'weather-icons/icons/black/svg/' + weatherIcons[code] + '.svg';
    } else if (url) {
      iconUrl = url;
    } else {
      iconUrl = 'weather-icons/icons/black/svg/unknown.svg';
    }
    iconElement.src = iconUrl;
  }
}

function handleWeatherUndergroundConditionsResponse(response) {
  weatherCache.lastUpdateInMillis = new Date().getTime();
  weatherCache.current = response.current_observation
  saveForecastCache();
  updateUiFromCache();
}

function getDate(forecastHour) {
  var date = new Date(0);
  date.setUTCSeconds(forecastHour.FCTTIME.epoch);
  return date;
}

function isToday(forecastHour) {
  return getDate(forecastHour).getDate() == (new Date()).getDate();
}

function handleWeatherUndergroundHourlyResponse(response) {
  for (var i = 0; i < response.hourly_forecast.length; i++) {
    var hour = response.hourly_forecast[i];
    if (isToday(hour)) {
      weatherCache.forecast[getDate(hour).getHours()] = hour;
    }
  }
  for (const [hour, forecastHour] of Object.entries(weatherCache.forecast)) {
    if (!isToday(forecastHour)) {
      delete weatherCache.forecast[hour]
    }
  }
  saveForecastCache();
  updateUiFromCache();
}

function updateUiFromCache() {
  var timeInSeconds = new Date().getTime() / 1000;
  var weatherTimeInSeconds = parseInt(weatherCache.current.observation_epoch);
  if (timeInSeconds - weatherTimeInSeconds < MAX_WEATHER_AGE_TO_DISPLAY_IN_SECONDS) {
    document.getElementById('weather-current-temp').innerText = formatTemp(weatherCache.current.temp_f);
    updateWeatherIcon('weather-current-icon', weatherCache.current.icon, weatherCache.current.icon_url);
  } else {
    document.getElementById('weather-current-temp').innerText = "?";
    updateWeatherIcon('weather-current-icon', -1, '');
  }
  updateRecess(weatherCache.forecast, 10, '1');
  updateRecess(weatherCache.forecast, 12, '2');
  updateRecess(weatherCache.forecast, 14, '3');
}

function updateRecess(forecastHours, hour, recessNumber) {
  forecastHour = forecastHours[hour]
  if (forecastHour) {
    temp = formatTemp(forecastHour.temp.english)
    icon = forecastHour.icon
    iconUrl = forecastHour.icon_url
  } else {
    temp = '?'
    icon = -1
    iconUrl = ''
  }
  document.getElementById('weather-recess-' + recessNumber + '-temp').innerText = temp;
  updateWeatherIcon('weather-recess-' + recessNumber + '-icon', icon, iconUrl);
}
