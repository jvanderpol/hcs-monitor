var filesystem = null;
var imageCache = null;

function main() {
  initImageCache();
  initFilesystem(function() {
    refreshSlideshowFromCache();
    initFacebookSdk();
		showSlides();
  });
}

var slideIndex = 0;

function showSlides() {
    var i;
    var slides = document.getElementsByClassName("slide");
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none"; 
    }
    slideIndex++;
    if (slideIndex > slides.length) {slideIndex = 1} 
    slides[slideIndex-1].style.display = "block"; 
    setTimeout(showSlides, 4000);
}

function initImageCache() {
  //window.localStorage.setItem('images', '{}');
  imageCache = JSON.parse(window.localStorage.getItem('images') || "{}");
}

function saveImageCache() {
  window.localStorage.setItem('images', JSON.stringify(imageCache));
}

function refreshSlideshowFromCache() {
  console.log('Refreshing from ' + JSON.stringify(imageCache));
  var slideContainer = document.getElementById('slideshow-container');
  for (imageId in imageCache) {
    var localImage = imageCache[imageId];
    var imageElement = document.createElement("img");
    imageElement.classList.add("slide", "fade");
    imageElement.src = localImage.url;
    document.body.appendChild(imageElement);
  }
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
  var completedImages = 0;
  var totalImages = 0;
  var maybeRestart = function() {
    completedImages++;
    if (completedImages == totalImages) {
      console.log('sync done');
      saveImageCache();
      refreshSlideshowFromCache();
    }
  };
  FB.api('/140475252639971/photos/uploaded', { fields: 'images' }, function(response) {
    for (var i = 0; i < response.data.length; i++) {
      var image = response.data[i];
      var cachedImage =  imageCache[image.id];
      if (cachedImage && cachedImage.isLocal) {
        continue;
      }
      totalImages++;
      downloadImage(image, maybeRestart);
    }
  });
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
  var cacheEntry = {};
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
            console.log(xhr.response);
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
