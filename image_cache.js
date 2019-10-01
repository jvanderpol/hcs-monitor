const CURRENT_IMAGE_CACHE_VERSION = "0.1";
const NEW_IMAGE_FIELDS = [
  'id',
  'webContentLink',
  'imageMediaMetadata/height',
  'imageMediaMetadata/width',
  'imageMediaMetadata/time'
];

let buckettedImageCache = [];
let imageCache = {};
let filesystem = null;
let accessToken = null;
let googleApiToken = null;

async function initAndSyncImageCache() {
  await initImageCache();
  filesystem = await initFilesystem();
  initGoogleToken().then(scheduleSyncs);
}

async function googleApiCall(options) {
  return new Promise(function (resolve, reject) {
    let url;
    if (options.url) {
      url = options.url;
    } else {
      url = "https://www.googleapis.com" + options.path + "?" + $.param(options.params || {});
    }
    $.ajax({
      url: url,
      beforeSend: xhr => xhr.setRequestHeader("Authorization", "Bearer " + googleApiToken)
    }).done((data, textStatus, request) => resolve(data))
      .fail(function(jqXHR, textStatus, errorThrown) {
      //if (jqXHR.status == 400) {
        // TODO handle new auth and don't retry failed auth
      //} else {
      reject("textStatus:" + textStatus +
        " errorThrown: " + errorThrown +
        " jqXHR.status: " + jqXHR.status +
        " jqXHR.responseText: " + jqXHR.responseText);
    });
  });
}

function scheduleSyncs() {
  // Every 10 minutes
  scheduleSync("new images", syncNewPictures, 1000 * 60 * 10, imageCache.lastSyncInMillis);
  // Every 2 hours
  scheduleSync("trim images", trimRemovedPictures, 1000 * 60 * 60 * 2, imageCache.lastTrimSyncInMillis);
}

async function initGoogleToken() {
  return new Promise(function (resolve, reject) {
    chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
      if (token) {
        googleApiToken = token;
        resolve();
      } else {
        reject('Failed to get token');
      }
    });
  });
}


async function initImageCache() {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.get({imageCache: {}}, function(items) {
      if (items.imageCache && items.imageCache.version == CURRENT_IMAGE_CACHE_VERSION) {
        imageCache = items.imageCache
      } else {
        imageCache = {version: CURRENT_IMAGE_CACHE_VERSION, images: {}}
      }
      bucketImageCache();
      resolve();
    });
  });
}

function saveImageCache() {
  chrome.storage.local.set({imageCache: imageCache});
  bucketImageCache();
}

function bucketImageCache() {
  let threeWeeksAgo = daysAgo(21);
  let threeMonthsAgo = daysAgo(90);
  let veryRecent = [];
  let kindaRecent = [];
  let theRest = [];
  for (let imageId in imageCache.images) {
    let image = imageCache.images[imageId];
    let imageCreationTime = new Date(image.createdTime);
    if (imageCreationTime > threeWeeksAgo) {
      veryRecent.push(imageId);
    } else if (imageCreationTime > threeMonthsAgo) {
      kindaRecent.push(imageId);
    } else {
      theRest.push(imageId);
    }
  };
  buckettedImageCache = maybeMergeBuckets([
    {
      weight: 0.7,
      images: veryRecent,
      minLength: 30
    },
    {
      weight: 0.2,
      images: kindaRecent,
      minLength: 60
    },
    {
      weight: 0.1,
      images: theRest,
      minLength: 0
    }
  ])
}

function daysAgo(days) {
  let result = new Date();
  result.setDate(result.getDate() - days);
  return result;
}

function bucketImagesByDate(imageIds) {
}

function maybeMergeBuckets(buckets) {
  let mergedBuckets = [];
  let carryOverValues = [];
  let carryOverWeight = 0;
  buckets.forEach(function (bucket, index) {
    let mergedBucketImages = bucket.images.concat(carryOverValues);
    if (mergedBucketImages.length > bucket.minLength ||
         (index == buckets.length - 1 && mergedBucketImages.length > 0)) {
      mergedBuckets.push({
        weight: bucket.weight + carryOverWeight,
        images: mergedBucketImages
      });
      carryOverValues = [];
      carryOverWeight = 0;
    } else {
      carryOverValues = mergedBucketImages;
      carryOverWeight += bucket.weight;
    }
  });
  return mergedBuckets;
}

function initFilesystem(successHandler) {
  return new Promise(function(resolve, reject) {
    console.log("initializing filesystem");
    let requestedBytes = 1024*1024*1024*3;
    navigator.webkitPersistentStorage.requestQuota(requestedBytes,
      function(grantedBytes) {  
        window.webkitRequestFileSystem(PERSISTENT, grantedBytes, resolve, reject);
      }, reject);
  });
}

function syncHistoryLimit() {
  return daysAgo(365);
}

function retainImageIds(retainedImageIds) {
  let toDelete = Object.keys(imageCache.images).filter(
    imageId => !retainedImageIds.includes(imageId)
  );
  console.log("trimming: " + (toDelete.join(', ') || 'nothing'));
  toDelete.forEach(function(id) { delete imageCache.images[id] });
  imageCache.lastTrimSyncInMillis = new Date().getTime();
  saveImageCache();
}

async function trimRemovedPictures() {
  console.log("trimming removed pictures");
  let nextPageToken = null;
  let files = [];
  do {
    const filesResponse = await googleApiCall({
      path: '/drive/v3/files',
      params: {
        fields: 'nextPageToken,files(id)',
        q: '"1BR7F53bfHQi0RUDKDtkp28_nEOVHchu_" in parents',
        pageToken: nextPageToken || ''
      }
    });
    // Spread operator ...
    files.push(...filesResponse.files);
    nextPageToken = filesResponse.nextPageToken;
  } while (nextPageToken);

  retainImageIds(files.map(file => file.id));
}

async function syncNewPictures() {
  console.log("syncing new pictures");
  let nextPageToken = null;
  let files = [];
  let oldestFile = null;
  do {
    const filesResponse = await googleApiCall({
      path: '/drive/v3/files',
      params: {
        fields: 'nextPageToken,files(' + NEW_IMAGE_FIELDS.join(',') + ')',
        q: '"1BR7F53bfHQi0RUDKDtkp28_nEOVHchu_" in parents',
        orderBy: 'createdTime',
        pageToken: nextPageToken || ''
      }
    });
    // Spread operator ...
    files.push(...filesResponse.files);
    nextPageToken = filesResponse.nextPageToken;
    oldestFile = files[files.length - 1];
  } while (nextPageToken);
  await Promise.all(files.map(file => ensureImageCached(file)));
  imageCache.lastSyncInMillis = new Date().getTime();
  saveImageCache();
  console.log('sync done');
}

function getCreateTime(image) {
  if (image.imageMediaMetadata.time) {
    let timeMatch = image.imageMediaMetadata.time.match(/^(\d{4}):(\d{2}):(\d{2}).*/ );
    if (timeMatch) {
      return new Date(
        parseInt(timeMatch[1]),
        parseInt(timeMatch[2]) - 1,
        parseInt(timeMatch[3]));
    }
  }
  return new Date(image.createdTime);
}

async function ensureImageCached(image) {
  let url = await maybeDownload(image.webContentLink, image.id);
  imageCache.images[image.id] = {
    createdTime: getCreateTime(image).getTime(),
    height: image.imageMediaMetadata.height,
    width: image.imageMediaMetadata.width,
    url: url
  };
}

function maybeDownload(url, fileId) {
  if (!filesystem) {
    return Promise.reject("filesystem isn't yet initialized");
  }
  return new Promise(function (resolve, reject) {
    filesystem.root.getFile(
      fileId,
      { create:false },
      (fileEntry) => resolve(fileEntry.toURL()),
      async () => resolve(await download(url, fileId)));
  });
}

function download(url, fileId) {
  return new Promise(function (resolve, reject) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = "blob";
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status === 200) {
          filesystem.root.getFile(fileId, { create:true }, function(fileEntry) {
            fileEntry.createWriter(function(writer) {
              writer.onwriteend = function(e) {
                resolve(fileEntry.toURL());
              };
              writer.onerror = reject;
              writer.write(xhr.response);
            })
          }, reject);
        } else {
          reject(xhr.status);
        }
      }
    };
    xhr.send();
  });
}

function globalErrorHandler(error) {
  if (!error || !error.code) {
    console.error('unknown error ' + error);
    return;
  }
  let message = '';

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
