var latestForecastCacheVersion = "0.1";
var weatherCache = {};

window.addEventListener("load", function() {
  initForecastCache(function() {
    initApiKeys(refreshWeather);
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
  } else {
    var apixuKey = getKey("apixu");
    if (apixuKey) {
      var xhr = new XMLHttpRequest();
      var url = "http://api.apixu.com/v1/forecast.json?key=" + apixuKey + "&q=46322&days=1";
      xhr.open("GET",  url, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          var response = JSON.parse(xhr.responseText);
          handleApixuWeatherResponse(response);
        }
      }
      xhr.send();
    }
  }
  // Refresh every 5 minutes
  setTimeout(refreshWeather, 5 * 60000);
}

function formatTemp(temp) {
  return Math.round(temp) + '\u00B0';
}

var weatherIcons = {
  1000: 'sunny', // sunny
  1003: 'partlycloudy', // partly cloudy
  1006: 'cloudy', // cloudy
  1009: 'cloudy', // overcast
  1030: 'fog', // mist
  1063: 'chancerain', // patchy rain possible
  1066: 'chanceflurries', // patchy snow possible
  1069: 'chancesleet', // patchy sleet possible
  1072: 'chancesleet', // patchy freezing drizzle
  1087: 'tstorms', // Thundery outbreaks possible
  1114: 'snow', // blowing snow
  1117: 'snow', // blizzard
  1135: 'fog', // fog
  1147: 'fog', // freezing frog
  1150: 'chancerain', // patchy light drizzle
  1153: 'chancerain', // light drizzle
  1168: 'sleet', // freezing drizzle
  1171: 'sleet', // Heavy freezing drizzle
  1180: 'chancerain', // Patchy light rain
  1183: 'chancerain', // Light rain
  1186: 'chancerain', // Moderate rain at times
  1189: 'chancerain', // Moderate rain
  1192: 'rain	', // Heavy rain at times
  1195: 'rain	', // Heavy rain
  1198: 'chancesleet', // Light freezing rain
  1201: 'sleet', // Moderate or heavy freezing rain
  1204: 'chancesleet', // Light sleet
  1207: 'sleet', // Moderate or heavy sleet
  1210: 'chanceflurries', // Patchy light snow
  1213: 'chanceflurries', // Light snow
  1216: 'chancesnow', // Patchy moderate snow
  1219: 'chancesnow', // Moderate snow
  1222: 'snow', // Patchy heavy snow
  1225: 'snow', // Heavy snow
  1237: 'sleet', // Ice pellets
  1240: 'chancerain', // Light rain shower
  1243: 'sleet', // Moderate or heavy rain shower
  1246: 'sleet', // Torrential rain shower
  1249: 'chancesleet', // Light sleet showers
  1252: 'sleet', // Moderate or heavy sleet showers
  1255: 'chancesnow', // Light snow showers
  1258: 'snow', // Moderate or heavy snow showers
  1261: 'sleet', // Light showers of ice pellets
  1264: 'sleet', // Moderate or heavy showers of ice pellets
  1273: 'chancetstorms', // Patchy light rain with thunder
  1276: 'tstorms', // Moderate or heavy rain with thunder
  1279: 'chancetstorms', // Patchy light snow with thunder
  1282: 'tstorms', // Moderate or heavy snow with thunder

  // Weather underground
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

function updateWeatherApixuIcon(iconId, condition) {
  updateWeatherIcon(iconId, condition.code, "http:" + condition.url);
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
  document.getElementById('weather-current-temp').innerText = formatTemp(weatherCache.current.temp_f);
  updateWeatherIcon('weather-current-icon', weatherCache.current.icon, weatherCache.current.icon_url);
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

function handleApixuWeatherResponse(response) {
  document.getElementById('weather-current-temp').innerText = formatTemp(response.current.temp_f);
  updateWeatherApixuIcon('weather-current-icon', response.current.condition);
  var foundRecess1 = false;
  var foundRecess2 = false;
  for (var i = 0; i < response.forecast.forecastday.length; i++) {
    var day = response.forecast.forecastday[i];
    if (day.hour) {
      for (var j = 0; j < day.hour.length; j++) {
        var hour = day.hour[j];
        var time = new Date(hour.time);
        if (time.getHours() == 10) {
          document.getElementById('weather-recess-1-temp').innerText = formatTemp(hour.temp_f);
          updateWeatherApixuIcon('weather-recess-1-icon', hour.condition);
          foundRecess1 = true;
        } else if (time.getHours() == 14) {
          document.getElementById('weather-recess-2-temp').innerText = formatTemp(hour.temp_f);
          updateWeatherApixuIcon('weather-recess-2-icon', hour.condition);
          foundRecess2 = true;
        }
      }
    }
  }
  if (!foundRecess1) {
    document.getElementById('weather-recess-1-temp').innerText = "?";
    updateWeatherIcon('weather-recess-1-icon', -1, '');
  }
  if (!foundRecess2) {
    document.getElementById('weather-recess-2-temp').innerText = "?";
    updateWeatherIcon('weather-recess-2-icon', -1, '');
  }
}
