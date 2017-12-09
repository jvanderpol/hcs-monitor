var apiKeys;

function initApiKeys(callback) {
  chrome.storage.local.get({apiKeys: {}}, function(items) {
    apiKeys = items.apiKeys;
    callback();
  });
}

function saveApiKeys() {
  chrome.storage.local.set({apiKeys: apiKeys});
}

function getKey(key) {
  if (!apiKeys[key]) {
    console.log(key + ' key not stored in apiKeys, run the following to update:\napiKeys["' + key + '"] = "your_api_key";\nsaveApiKeys();');
    return null;
  } else {
    return apiKeys[key];
  }
}
