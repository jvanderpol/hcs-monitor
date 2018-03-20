var latestForecastCacheVersion = "0.1";
var weatherCache = {};

window.addEventListener("load", function() {
  initForecastCache(function() {
    initApiKeys(refreshWeather);
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
  console.log("Refrehsing weather");
  var weatherUndergroundKey = getKey("weather-underground");
  if (weatherUndergroundKey) {
    $.ajax({
      url: "http://api.wunderground.com/api/" + weatherUndergroundKey + "/conditions/q/IN/46322.json"
    })
      .done(handleWeatherUndergroundConditionsResponse)
      .fail(logAjaxError);
    $.ajax({
      url: "http://api.wunderground.com/api/" + weatherUndergroundKey + "/hourly/q/IN/46322.json"
    })
      .done(handleWeatherUndergroundHourlyResponse)
      .fail(logAjaxError);
  }
  // Refresh every 5 minutes
  setTimeout(refreshWeather, 5 * 60000);
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

function logAjaxError(jqXHR, textStatus, errorThrown) {
  console.log("textStatus:" + textStatus +
    " errorThrown: " + errorThrown +
    " jqXHR.status: " + jqXHR.status +
    " jqXHR.responseText: " + jqXHR.responseText);
}

function handleWeatherUndergroundConditionsResponse(response) {
  weatherCache.current = response.current_observation
  console.log("Current weather sync complete");
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
  console.log("Forecast sync complete");
  saveForecastCache();
  updateUiFromCache();
}

function updateUiFromCache() {
  if ((new Date()).getTime() / 1000 - parseInt(weatherCache.current.observation_epoch) < 60 * 60) {
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
