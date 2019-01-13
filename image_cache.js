var filesystem = null;
var imageCache = {};
var buckettedImageCache = [];
var currentImageCacheVersion = "0.3";
var accessToken = null;

function initAndSyncImageCache(callback) {
  initImageCache(function() {
    initFilesystem(function() {
      initFacebook(function() {
        // Every 30 minutes
        scheduleSync("new images", syncNewPictures, 1000 * 60 * 30, imageCache.lastSyncInMillis)
        // Every 2 hours
        scheduleSync("trim images", trimRemovedPictures, 1000 * 60 * 60 * 2, imageCache.lastTrimSyncInMillis)
      });
      callback();
    });
  });
}


function initImageCache(callback) {
  chrome.storage.local.get({imageCache: {}}, function(items) {
    if (items.imageCache && items.imageCache.version == "0.2") {
      // Upgrade from 0.2 to 0.3
      items.imageCache.version = "0.3"
      items.imageCache.disabledImageIds = {
        1944261675594644: true,
        1897526086934870: true,
        1928648037156008: true,
        1950014561686022: true,
        1968645393156272: true,
        1943989572288521: true}
    }
    if (items.imageCache && items.imageCache.version == currentImageCacheVersion) {
      imageCache = items.imageCache
    } else {
      imageCache = {version: currentImageCacheVersion, images: {}, disabledImageIds: {}}
    }
    bucketImageCache();
    callback();
  });
}

function saveImageCache() {
  chrome.storage.local.set({imageCache: imageCache});
  bucketImageCache();
}

function doneSyncing() {
  updateFaceScores();
  imageCache.lastSyncInMillis = new Date().getTime();
  saveImageCache();
}

function bucketImageCache() {
  enabledImageIds = Object.keys(imageCache.images).filter(
    function(imageId) { return !imageCache.disabledImageIds[imageId] }
  );
  datedBuckets = bucketImagesByDate(enabledImageIds);
  datedBuckets.forEach(function (bucket) { bucket.values = bucketImageByFaces(bucket.values) });
  buckettedImageCache = datedBuckets;
}

function bucketImageByFaces(imageIds) {
  var withFaces = [];
  var withoutFaces = [];
  imageIds.forEach(function (imageId) {
    var image = imageCache.images[imageId];
    if (image.facialScoreData && image.facialScoreData.length == 0) {
      withoutFaces.push(imageId);
    } else {
      withFaces.push(imageId);
    }
  });
  return maybeMergeBuckets([
    {
      weight: 0.8,
      values: withFaces,
      minLength: 20
    },
    {
      weight: 0.2,
      values: withoutFaces,
      minLength: 0
    }]);
}

function daysAgo(days) {
  var result = new Date();
  result.setDate(result.getDate() - days);
  return result;
}

function bucketImagesByDate(imageIds) {
  var threeWeeksAgo = daysAgo(21);
  var threeMonthsAgo = daysAgo(90);
  var veryRecent = [];
  var kindaRecent = [];
  var theRest = [];
  imageIds.forEach(function(imageId) {
    var image = imageCache.images[imageId];
    var imageCreationTime = new Date(image.createdTime);
    if (imageCreationTime > threeWeeksAgo) {
      veryRecent.push(imageId);
    } else if (imageCreationTime > threeMonthsAgo) {
      kindaRecent.push(imageId);
    } else {
      theRest.push(imageId);
    }
  });
  return maybeMergeBuckets([
    {
      weight: 0.7,
      values: veryRecent,
      minLength: 30
    },
    {
      weight: 0.2,
      values: kindaRecent,
      minLength: 60
    },
    {
      weight: 0.1,
      values: theRest,
      minLength: 0
    }
  ])
}

function maybeMergeBuckets(buckets) {
  var mergedBuckets = [];
  var carryOverValues = [];
  var carryOverWeight = 0;
  buckets.forEach(function (bucket, index) {
    var mergedBucketValues = bucket.values.concat(carryOverValues);
    if (mergedBucketValues.length > bucket.minLength ||
         (index == buckets.length - 1 && mergedBucketValues.length > 0)) {
      var min = 0;
      mergedBuckets.forEach(function (bucket) { min = Math.max(min, bucket.max); })
      mergedBuckets.push({
        weight: bucket.weight + carryOverWeight,
        values: mergedBucketValues
      });
      carryOverValues = [];
      carryOverWeight = 0;
    } else {
      carryOverValues = mergedBucketValues;
      carryOverWeight += bucket.weight;
    }
  });
  return mergedBuckets;
}

function initFilesystem(successHandler) {
  console.log("initializing filesystem");
  var requestedBytes = 1024*1024*1024*3;
  navigator.webkitPersistentStorage.requestQuota(requestedBytes,
    function(grantedBytes) {  
      window.webkitRequestFileSystem(PERSISTENT, grantedBytes,
          function(fs) {
            filesystem = fs;
            successHandler()
          },
          globalErrorHandler);
    }, globalErrorHandler);
}

function syncHistoryLimit() {
  return daysAgo(365 * 2);
}

function retainImageIds(retainedImageIds) {
  var toDelete = Object.keys(imageCache.images).filter(
    function(imageId) { return !(imageId in retainedImageIds) }
  );
  console.log("trimming: " + toDelete);
  toDelete.forEach(function(id) { delete imageCache.images[id] });
  imageCache.lastTrimSyncInMillis = new Date().getTime();
  saveImageCache();
}

function trimRemovedPictures() {
  console.log("trimming removed pictures");
  facebookGraphCall({path:'/140475252639971/photos/uploaded', fields:'images,created_time,name'}, handleImageResponseForTrim);
  retainedImageIds = {}
  function handleImageResponseForTrim(response) {
    var nextPageToRequest = response.paging && response.paging.next
    var requestNextPage = true;
    for (var i = 0; i < response.data.length; i++) {
      var image = response.data[i];
      if (new Date(image.created_time) < syncHistoryLimit()) {
        retainImageIds(retainedImageIds);
        requestNextPage = false;
        break;
      } else {
        retainedImageIds[image.id] = true;
      }
    }
    if (nextPageToRequest && requestNextPage) {
      var lastDate = "empty";
      if (response.data.length > 0) {
        lastDate = response.data[response.data.length - 1].created_time;
      }
      console.log("Fetching nextPage for trim, last image date: " + lastDate);
      facebookGraphCall({url:nextPageToRequest}, handleImageResponseForTrim);
    }
  }
}

function syncNewPictures() {
  console.log("syncing new pictures");
  facebookGraphCall({path:'/140475252639971/photos/uploaded', fields:'images,created_time,name'}, handleImageResponseForNewPictures);
}

function handleImageResponseForNewPictures(response) {
  var nextPageToRequest = response.paging && response.paging.next
  var downloadsDone = function() {
    if (!nextPageToRequest) {
      console.log('sync done');
      doneSyncing();
    }
  }
  var finishedDownloads = 0;
  var downloadedsStarted = 0;
  var markDone = function() {
    finishedDownloads++;
    if (finishedDownloads == downloadedsStarted) {
      downloadsDone();
    }
  };
  for (var i = 0; i < response.data.length; i++) {
    var image = response.data[i];
    if (new Date(image.created_time) < syncHistoryLimit()) {
      nextPageToRequest = null;
      continue;
    }
    var cachedImage =  imageCache.images[image.id];
    if (cachedImage) {
      nextPageToRequest = null;
      continue;
    }
    downloadedsStarted++;
    downloadImage(image, markDone);
  }
  if (downloadedsStarted == 0) {
    downloadsDone();
  }
  if (nextPageToRequest) {
    var lastDate = "empty";
    if (response.data.length > 0) {
      lastDate = response.data[response.data.length - 1].created_time;
    }
    console.log("Fetching nextPage, last image date: " + lastDate);
    facebookGraphCall({url:nextPageToRequest}, handleImageResponseForNewPictures);
  }
}

function downloadImage(image, doneCallback) {
  var largestImage = null;
  for (var i = 0; i < image.images.length; i++) {
    var imageSource = image.images[i];
    if (!largestImage || largestImage.width < imageSource.width) {
      largestImage = imageSource;
    }
  }
  var cachedEntry = {
    createdTime: image.created_time,
    height: largestImage.height,
    width: largestImage.width,
    remoteUrl: largestImage.source
  };
  maybeDownload(largestImage.source, image.id,
    function(url) {
      cachedEntry.url = url;
      imageCache.images[image.id] = cachedEntry;
      doneCallback();
    },
    function(e) {
      globalErrorHandler(e);
      doneCallback();
    });
}

function maybeDownload(url, file, urlHandler, errorHandler) {
  if (!filesystem) {
    errorHandler("filesystem isn't yet initialized");
  }
  filesystem.root.getFile(file, { create:false },
    function(fileEntry) {
      urlHandler(fileEntry.toURL());
    },
    function(e) {
      download(url, file, urlHandler, errorHandler);
    });
}

function download(url, file, urlHandler, errorHandler) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.responseType = "blob";
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status === 200) {
        filesystem.root.getFile(file, { create:true }, function(fileEntry) {
          fileEntry.createWriter(function(writer) {
            writer.onwriteend = function(e) {
              urlHandler(fileEntry.toURL());
            };
            writer.onerror = errorHandler;
            writer.write(xhr.response);
          })
        }, errorHandler);
      } else {
        errorHandler(xhr.status);
      }
    }
  };
  xhr.send();
  return xhr;
}

function updateFaceScores() {
  updateFaceScoreWithWaiting(Object.keys(imageCache.images), saveImageCache);
}

var API_CALLS_PER_MINUTE = 5;
function updateFaceScoreWithWaiting(keys, callback) {
  var completedCalls = 0;
  var pendingCalls = 0;
  var lastGroup = keys.length <= API_CALLS_PER_MINUTE;
  var checkCompletedCallback = function() {
    completedCalls++;
    if (completedCalls == pendingCalls) {
      saveImageCache();
    }
  }
  var imageIndex;
  for (imageIndex = 0; imageIndex < keys.length; imageIndex++) {
    var image = imageCache.images[keys[imageIndex]];
    if (image && !image.facialScoreData && (!image.facialScoreDataError || image.facialScoreDataError.length < 5)) {
      updateFaceScore(image, checkCompletedCallback);
      pendingCalls++;
      if (pendingCalls == API_CALLS_PER_MINUTE) {
        break;
      }
    }
  }
  if (imageIndex < keys.length) {
    var callAgain = function() {
      updateFaceScoreWithWaiting(keys.slice(pendingCalls));
    };
    setTimeout(callAgain, 60000);
  }
}

function updateFaceScore(image, callback) {
  callFacesApi(
    image.remoteUrl,
    function(scoreData) {
      image.facialScoreData = scoreData;
      callback();
    },
    function(error) {
      console.error(image.remoteUrl + ": " + error);
      if (!image.facialScoreDataError) {
        image.facialScoreDataError = [];
      }
      image.facialScoreDataError.push(error);
      callback();
    });
}

function callFacesApi(imageUrl, scoreCallback, errorCallback) {
  var subscriptionKey = getKey('microsoft-cognitive-services');
  if (!subscriptionKey) {
    errorCallback('invalidKey')
    return;
  }
  var uriBase = "https://eastus2.api.cognitive.microsoft.com/face/v1.0/detect";

  // Request parameters.
  var params = {
    "returnFaceAttributes": "age,smile,emotion,blur,exposure,noise",
  };
  $.ajax({
    url: uriBase + "?" + $.param(params),
    beforeSend: function(xhrObj){
        xhrObj.setRequestHeader("Content-Type","application/json");
        xhrObj.setRequestHeader("Ocp-Apim-Subscription-Key", subscriptionKey);
    },
    type: "POST",
    data: '{"url": "' + imageUrl + '"}',
  })

  .done(function(data) {
    scoreCallback(data);
  })

  .fail(function(jqXHR, textStatus, errorThrown) {
    var errorString = "textStatus:" + textStatus +
      " errorThrown: " + errorThrown +
      " jqXHR.status: " + jqXHR.status +
      " jqXHR.responseText: " + jqXHR.responseText;
    errorCallback(errorString);
  });
}


function initFacebook(callback) {
  chrome.storage.local.get({accessToken: null}, function(items) {
    if (items.accessToken) {
      setAccessToken(items.accessToken);
      callback();
    } else {
      facebookLogin(callback);
    }
  })
}

function setAccessToken(localAccessToken) {
  accessToken = localAccessToken;
  chrome.storage.local.set({accessToken: accessToken})
}

function facebookLogin(callback) {
  var redirect_url = 'https://www.facebook.com/connect/login_success.html';
  updateListener = function(tabId, changeInfo, tab) {
    if (changeInfo.url) {
      // Example changeInfo.url:
      // https://www.facebook.com/connect/login_success.html#access_token=asdf1234&expires_in=6060&reauthorize_required_in=7776000&data_access_expiration_time=1553397540
      var match = changeInfo.url.match(/login_success.html#.*access_token=([^&]+)/);
      if (match) {
        var accessToken = match[1];
        console.log("Got new accessToken: " + accessToken);
        setAccessToken(accessToken);
        chrome.storage.local.set({accessToken: accessToken})
      } else {
        console.error("Unable to find accessToken from url " + changeInfo.url);
      }
      chrome.tabs.onUpdated.removeListener(updateListener);
      if (tab.id) {
        chrome.tabs.remove(tab.id);
      }
      callback();
    }
  };
  chrome.tabs.onUpdated.addListener(updateListener);

  chrome.windows.create(
    {
      url:"https://www.facebook.com/dialog/oauth?client_id=198951587317971&response_type=token&scope=email&redirect_uri=" + redirect_url
    });
};

var callCount = 0;

function facebookGraphCall(options, callback) {
  if (callCount > 90) {
    setTimeout(function() {
      facebookGraphCall(options, callback);
    }, 600000 /* 10 minutes */);
    return;
  }
  var url;
  if (options.url) {
    url = options.url;
  } else {
    url = "https://graph.facebook.com" + options.path + "?" + $.param({fields: options.fields, access_token: accessToken});
  }
  $.get(url).done(function(data, textStatus, request) {
      //TODO Determine why this header doesn't show up
      var usage = request.getResponseHeader("x-app-usage");
      if (usage) {
        var parsedUsage = JSON.parse(usage);
        callCount = parsedUsage.call_count;
      }
      callback(data);
    }).fail(function(jqXHR, textStatus, errorThrown) {
      if (jqXHR.status == 400 && !options.isRetry) {
        facebookLogin(function() {
          options.isRetry = true;
          facebookGraphCall(options, callback);
        });
      } else {
        var errorString = "textStatus:" + textStatus +
          " errorThrown: " + errorThrown +
          " jqXHR.status: " + jqXHR.status +
          " jqXHR.responseText: " + jqXHR.responseText;
        console.error(errorString);
      }
    });
}

function globalErrorHandler(error) {
  if (!error || !error.code) {
    console.error('unknown error ' + error);
    return;
  }
  var message = '';

  switch (error.code) {
    case FileError.SECURITY_ERR:
      message = 'Security Error';
      break;
    case FileError.NOT_FOUND_ERR:
      message = 'Not Found Error';
      break;
    case FileError.QUOTA_EXCEEDED_ERR:
      message = 'Quota Exceeded Error';
      break;
    case FileError.INVALID_MODIFICATION_ERR:
      message = 'Invalid Modification Error';
      break;
    case FileError.INVALID_STATE_ERR:
      message = 'Invalid State Error';
      break;
    default:
      message = 'Unknown Error';
      break;
  }
  console.error(message);
}
