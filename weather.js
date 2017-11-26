var apiKeys;

window.addEventListener("load", function() {
  initApiKeys(refreshWeather);
});

function initApiKeys(callback) {
  chrome.storage.local.get({apiKeys: {}}, function(items) {
    apiKeys = items.apiKeys;
    callback();
  });
}

function saveApiKeys() {
  chrome.storage.local.set({apiKeys: apiKeys});
}

function refreshWeather() {
  if (!apiKeys["apixu"]) {
    console.log('apixu keys not stored in apiKeys, run the following to update:\napiKeys.apixu = "your_api_key";\nsaveApiKeys();');
  } else {
    var xhr = new XMLHttpRequest();
    var url = "http://api.apixu.com/v1/forecast.json?key=" + apiKeys.apixu + "&q=46322&days=1";
    xhr.open("GET",  url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        var response = JSON.parse(xhr.responseText);
        handleWeatherRespone(response);
      }
    }
    xhr.send();
    // Refresh every 5 minutes
    setTimeout(refreshWeather, 5 * 60000);
  }
}

function formatTemp(temp) {
  return Math.round(temp) + '\u00B0';
}

var weatherIcons = {
  1000: 'sunny', // sunny
  1003: 'partlycloudy', // partly cloudy
  1006: 'cloudy', // cloudy
  1009: 'cloudy', // overcast
  1030: 'mist', // mist
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
}

function updateWeatherIcon(iconId, condition) {
  var iconElement = document.getElementById(iconId);
  if (iconElement) {
    var iconUrl;
    if (weatherIcons[condition.code]) {
      iconUrl = 'weather-icons/icons/black/svg/' + weatherIcons[condition.code] + '.svg';
    } else if (condition.icon) {
      iconUrl = 'http:' + condition.icon;
    } else {
      iconUrl = 'weather-icons/icons/black/svg/unknown.svg';
    }
    iconElement.src = iconUrl;
  }
}

function handleWeatherRespone(response) {
  document.getElementById('weather-current-temp').innerText = formatTemp(response.current.temp_f);
  updateWeatherIcon('weather-current-icon', response.current.condition);
  var foundRecess1 = false;
  var foundRecess2 = false;
  for (var i = 0; i < response.forecast.forecastday.length; i++) {
    var day = response.forecast.forecastday[i];
    for (var j = 0; j < day.hour.length; j++) {
      var hour = day.hour[j];
      var time = new Date(hour.time);
      if (time.getHours() == 10) {
        document.getElementById('weather-recess-1-temp').innerText = formatTemp(hour.temp_f);
        updateWeatherIcon('weather-recess-1-icon', hour.condition);
        foundRecess1 = true;
      } else if (time.getHours() == 14) {
        document.getElementById('weather-recess-2-temp').innerText = formatTemp(hour.temp_f);
        updateWeatherIcon('weather-recess-2-icon', hour.condition);
        foundRecess2 = true;
    }
    }
  }
  if (!foundRecess1) {
    document.getElementById('weather-recess-1-temp').innerText = "?";
    updateWeatherIcon('weather-recess-1-icon', -1);
  }
  if (!foundRecess2) {
    document.getElementById('weather-recess-2-temp').innerText = "?";
    updateWeatherIcon('weather-recess-2-icon', -1);
  }
}
