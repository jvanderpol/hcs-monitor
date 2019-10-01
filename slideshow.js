$(window).on("load", function() {
  initAndSyncImageCache().then(addNextSlide);
});

function nonRecentlyShowsImageIds(imageIds) {
  return imageIds.filter(imageId => !recentlyShownIds.includes(imageId));
}

function chooseBucket(buckets) {
  let bucketsWithImages = buckets.filter(bucket => nonRecentlyShowsImageIds(bucket.images).length > 0);
  let totalWeight = bucketsWithImages.reduce((total, bucket) => total + bucket.weight, 0);
  const rand = Math.random();
  let passedWeight = 0;
  for (let bucket of bucketsWithImages) {
    passedWeight += bucket.weight;
    if (rand < passedWeight / totalWeight) {
      return bucket;
    }
  }
  return null;
}

var recentlyShownIds = [];

function getNextImage() {
  let bucket = chooseBucket(buckettedImageCache);
  if (!bucket) {
    recentlyShownIds = [];
    console.error("Unable to find any buckets with showable pictures, resetting recentlyShownIds to see if that helps");
    bucket = chooseBucket(buckettedImageCache);
  }
  if (!bucket) {
    console.error("Unable to find any buckets with showable pictures");
    return null;
  }
  const unshownImages = nonRecentlyShowsImageIds(bucket.images);
  const nextImageId  = unshownImages[Math.floor(Math.random() * unshownImages.length)];
  recentlyShownIds.unshift(nextImageId);
  while (recentlyShownIds.length > 50) {
    recentlyShownIds.pop();
  }
  return imageCache.images[nextImageId];
}

function createImageSlide(image, width, height, doneCallback) {
  var slideContainer = document.createElement("div");
  slideContainer.classList.add("fade", "slide-container");
  slideContainer.style.width = width + "px";
  slideContainer.style.height = height + "px";

  var loadCount = 0;
  var maybeFinish = function() {
    if (++loadCount == 2) {
      doneCallback(slideContainer);
    }
  };

  var background = document.createElement("img");
  background.classList.add("slide-background");
  background.src = image.url;
  $(background).on("load", maybeFinish);

  var imageElement = document.createElement("img");
  imageElement.classList.add("slide-image");
  imageElement.src = image.url;
  $(imageElement).on("load", maybeFinish);

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

function showSlide(nextSlide) {
  var slideshowContainer = document.getElementById('slideshow-container');
  var slideContainers = document.getElementsByClassName("slide-container");
  var toRemove = [];
  for (var i = 0; i < slideContainers.length; i++) {
    var slide = slideContainers[i];
    if (slide == nextSlide) {
      slide.style.opacity = 1;
    } else if (slide.style.opacity == 0) {
      // Don't remove these while iterating over slideContainers as that will
      // break iteration of the slideContainer elements.
      toRemove.push(slide);
    } else {
      slide.style.opacity = 0;
      $(slide).on("transitionend", function  (event) {
        slideshowContainer.removeChild(event.target);
      });
    }
  }
  toRemove.forEach(function (slide) {
    slideshowContainer.removeChild(slide)
  });
}

function addNextSlide() {
  var image = getNextImage();
  var slideshowContainer = document.getElementById('slideshow-container');
  if (image != null) {
    var nextSlide = createImageSlide(image, slideshowContainer.offsetWidth, slideshowContainer.offsetHeight, function(completedSlide) {
      showSlide(completedSlide);
    });
    slideshowContainer.appendChild(nextSlide);
  }
  setTimeout(addNextSlide, 8000);
}
