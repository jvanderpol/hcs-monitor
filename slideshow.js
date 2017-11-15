var filesystem = null;
var imageCache = {};

function main() {
  initImageCache();
  initFilesystem(function() {
    refreshSlideshowFromCache();
    initFacebookSdk();
		addNextSlide();
  });
}

function getNextImage() {
  var imageIds = Object.keys(imageCache)
  if (imageIds.length == 0) {
    return null;
  }
  var imageIndex = Math.floor(Math.random() * imageIds.length);
  return imageCache[imageIds[imageIndex]];
}

function createImageSlide(image, width, height) {
  var slideContainer = document.createElement("div");
  slideContainer.classList.add("fade", "slide-container");
  slideContainer.style.width = width + "px";
  slideContainer.style.height = height + "px";

  var background = document.createElement("img");
  background.classList.add("slide-background");
  background.src = image.url;

  var imageElement = document.createElement("img");
  imageElement.classList.add("slide-image");
  imageElement.src = image.url;

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
  var i;
  var slideContainers = document.getElementsByClassName("slide-container");
  for (i = 0; i < slideContainers.length; i++) {
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
  if (image == null) {
    return;
  }
  var slideshowContainer = document.getElementById('slideshow-container');
  nextSlide = createImageSlide(image, slideshowContainer.offsetWidth, slideshowContainer.offsetHeight)
  slideshowContainer.appendChild(nextSlide);
  setTimeout(addNextSlide, 4000);
}

function initImageCache() {
  //window.localStorage.setItem('images', '{}');
  imageCache = JSON.parse(window.localStorage.getItem('images') || "{}");
}

function saveImageCache() {
  window.localStorage.setItem('images', JSON.stringify(imageCache));
}

function refreshSlideshowFromCache() {
  console.log('Refreshing from cache');
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
  FB.api('/140475252639971/photos/uploaded', { fields: 'images,created_time,name' }, handleImageResponse);
}

function shouldFetchNextPage(response) {
  for (var i = 0; i < response.data.length; i++) {
    var image = response.data[i].id;
    if (image in imageCache) {
      //nextPage = null;
      break;
    }
  }
}

function handleImageResponse(response) {
  var maybeNextPage = response.paging && response.paging.next
  var downloadsDone = function() {
    if (!maybeNextPage) {
      console.log('sync done');
      saveImageCache();
      refreshSlideshowFromCache();
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
      maybeNextPage = null;
      continue;
    }
    var cachedImage =  imageCache[image.id];
    if (cachedImage && cachedImage.isLocal) {
      maybeNextPage = null;
      continue;
    }
    downloadedsStarted++;
    downloadImage(image, markDone);
  }
  if (downloadedsStarted == 0) {
    downloadsDone();
  }
  if (maybeNextPage) {
    console.log("Fetching nextPage");
    FB.api(maybeNextPage, handleImageResponse);
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
  // TODO set dimensions, comments, etc.
  var cacheEntry = {
    height: largestImage.height,
    width: largestImage.width
  };
  maybeDownload(largestImage.source, image.id,
    function(url) {
      cacheEntry.url = url;
      cacheEntry.isLocal = true;
      imageCache[image.id] = cacheEntry;
      doneCallback();
    },
    function(e) {
      globalErrorHandler(e);
      cacheEntry.url = largestImage.source;
      cacheEntry.isLocal = false;
      imageCache[image.id] = cacheEntry;
      doneCallback();
    });
}

function maybeDownload(url, file, urlHandler, errorHandler) {
  if (!filesystem) {
    return url;
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

function tryLogin() {
  FB.getLoginStatus(function(response) {
    if (response.status === 'connected') {
      syncPictures();
    } else {
      FB.login(function(response) { syncPictures() });
    }
  });
}

window.fbAsyncInit = function() {
  FB.init({
    appId      : '1967886200146564',
    cookie     : true,  // enable cookies to allow the server to access 
                        // the session
    xfbml      : true,  // parse social plugins on this page
    version    : 'v2.8' // use graph api version 2.8
  });
  tryLogin();
};

function initFacebookSdk() {
  var s = 'script';
  var id = 'facebook-jssdk';
  console.log("loading facebook sdk");
  var js, fjs = document.getElementsByTagName(s)[0];
  if (document.getElementById(id)) return;
  js = document.createElement(s); js.id = id;
  js.src = "//connect.facebook.net/en_US/sdk.js";
  fjs.parentNode.insertBefore(js, fjs);
};

function globalErrorHandler(error) {
  console.log('unknown error ' + error);
  return;
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
