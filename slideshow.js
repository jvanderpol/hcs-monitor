var filesystem = null;
var imageCache = {};
var accessToken = null;

function main() {
  initImageCache(function() {
    initFilesystem(function() {
      initFacebook(function() {
        syncPictures();
      });
      addNextSlide();
      showAddedSlide();
    });
    document.body.onclick = function() { requestFullScreen(document.body); }
  });
}

function requestFullScreen(element) {
  var fullScreenMethod = element.requestFullScreen || element.webkitRequestFullScreen;
  if (fullScreenMethod) {
    //fullScreenMethod.call(element);
  }
}

function getNextImage() {
  var imageIds = Object.keys(imageCache)
  if (imageIds.length == 0) {
    return null;
  }
  var imageIndex = Math.floor(Math.random() * imageIds.length);
  return imageCache[imageIds[imageIndex]];
}

var nextZIndex = 0;

function createImageSlide(image, width, height) {
  var slideContainer = document.createElement("div");
  slideContainer.classList.add("fade", "slide-container");
  slideContainer.style.width = width + "px";
  slideContainer.style.height = height + "px";

  var background = document.createElement("img");
  background.classList.add("slide-background");
  background.src = image.url;
  background.zIndex = nextZIndex++;

  var imageElement = document.createElement("img");
  imageElement.classList.add("slide-image");
  imageElement.src = image.url;
  imageElement.zIndex = nextZIndex++;

  var imageMultiplier;
  var backgroundMultiplier;
  var imageRatio = image.height / image.width;
  var slideRation = height / width;
  if (imageRatio > slideRation) {
    imageElement.style.height = height + "px";
    imageMultiplier = height / image.height;
    background.style.width = width + "px";
    backgroundMultiplier = width / image.width;
  } else {
    imageElement.style.width = width + "px";
    background.style.height = height + "px";
    imageMultiplier = width / image.width;
    backgroundMultiplier = height / image.height;
  }
  imageElement.style.margin =
    ((height - image.height * imageMultiplier) / 2) + "px " +
    ((width - image.width * imageMultiplier) / 2) + "px";
  var clippedVertical = (backgroundMultiplier * image.height - height) / 2;
  var clippedHoriztonal = (backgroundMultiplier * image.width - width) / 2;
  background.style.clipPath = "inset(" +
    clippedVertical + "px " +
    clippedHoriztonal + "px)";
  background.style.top = "-" + clippedVertical + "px";
  background.style.left = "-" + clippedHoriztonal + "px";

  slideContainer.appendChild(imageElement);
  slideContainer.appendChild(background);
  return slideContainer
}

function showAddedSlide() {
  var slideshowContainer = document.getElementById('slideshow-container');
  var slideContainers = document.getElementsByClassName("slide-container");
  for (var i = 0; i < slideContainers.length; i++) {
    var slide = slideContainers[i];
    if (slide == nextSlide) {
      slide.style.opacity = 1;
    } else if (slide.style.opacity == 0) {
      slideshowContainer.removeChild(slide);
    } else {
      slide.style.opacity = 0;
    }
  }
}

var nextSlide;

function addNextSlide() {
  // This is done here to ensure the slide is actually loaded, this should probably be done with a callback
  showAddedSlide();

  var image = getNextImage();
  if (image != null) {
    var slideshowContainer = document.getElementById('slideshow-container');
    nextSlide = createImageSlide(image, slideshowContainer.offsetWidth, slideshowContainer.offsetHeight)
    slideshowContainer.appendChild(nextSlide);
  }
  setTimeout(addNextSlide, 4000);
}

function initImageCache(callback) {
  chrome.storage.local.get({imageCache: {}}, function(items) {
    imageCache = items.imageCache
    callback();
  });
}

function saveImageCache() {
  chrome.storage.local.set({imageCache: imageCache})
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

function syncPictures() {
  console.log("syncing pictures");
  facebookGraphCall({path:'/140475252639971/photos/uploaded', fields:'images,created_time,name'}, handleImageResponse);
}

function handleImageResponse(response) {
  var nextPageToRequest = response.paging && response.paging.next
  var downloadsDone = function() {
    if (!nextPageToRequest) {
      console.log('sync done');
      saveImageCache();
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
    if (new Date(image.created_time) < new Date(2016, 1, 1)) {
      nextPageToRequest = null;
      continue;
    }
    var cachedImage =  imageCache[image.id];
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
    console.log("Fetching nextPage");
    facebookGraphCall({url:nextPageToRequest}, handleImageResponse);
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
  var cacheEntry = {
    height: largestImage.height,
    width: largestImage.width
  };
  maybeDownload(largestImage.source, image.id,
    function(url) {
      cacheEntry.url = url;
      imageCache[image.id] = cacheEntry;
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
};

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
      var params = changeInfo.url.split('#')[1];
      var accessToken = params.split('&')[0].split('=')[1];
      console.log("Got new accessToken: " + accessToken);
      setAccessToken(accessToken);
      chrome.storage.local.set({accessToken: accessToken})
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

function facebookGraphCall(options, callback) {
  var xhr = new XMLHttpRequest();
  var url;
  if (options.url) {
    url = options.url
  } else {
    url = "https://graph.facebook.com" + options.path + "?fields=" + (options.fields || "") + "&access_token=" + accessToken;
  }
  xhr.open("GET",  url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 400) {
        facebookLogin(function() {
          facebookGraphCall(options, callback);
        });
      } else {
        var response = JSON.parse(xhr.responseText);
        callback(response);
      }
    }
  }
  xhr.send();
}

function globalErrorHandler(error) {
  if (!error || !error.code) {
    console.log('unknown error ' + error);
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
  console.log(message);
}

window.onload = main
