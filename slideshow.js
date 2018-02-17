window.addEventListener("load", function() {
  initAndSyncImageCache(function() {
    addNextSlide();
    showAddedSlide();
  });
});

function chooseBucket(buckets) {
  var totalWeight = 0;
  var passedWeight = 0;
  buckets.forEach(function (bucket) { totalWeight += bucket.weight });
  var rand = Math.random();
  for (var i = 0; i < buckets.length; i++) {
    var bucket = buckets[i];
    passedWeight += bucket.weight;
    if (rand < passedWeight / totalWeight) {
      return bucket;
    }
  }
  return null;
}

function getNextImage() {
  var bucketIndex = Math.random();
  var firstBucket = chooseBucket(buckettedImageCache);
  if (firstBucket) {
    var secondBucket = chooseBucket(firstBucket.values);
    if (secondBucket) {
      var imageIndex = Math.random();
      var imageIndex = Math.floor(Math.random() * secondBucket.values.length);
      var imageId = secondBucket.values[imageIndex];
      return imageCache.images[imageId];
    }
  }
  return null;
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
