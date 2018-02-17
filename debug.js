window.addEventListener("load", function() {
  initApiKeys(function() {
    initAndSyncImageCache(function() {
      drawImageTable();
    });
  });
});

function drawImageTable() {
  var imageRowTemplate = $("#imageRowTemplate").html();
  Mustache.parse(imageRowTemplate);
  var bucketRowTemplate = $("#bucketRowTemplate").html();
  Mustache.parse(bucketRowTemplate);
  buckettedImageCache.forEach(function(timeBucket) {
    timeBucket.values.forEach(function(faceBucket) {
      var weight = timeBucket.weight * faceBucket.weight;
      var renderedBucket = Mustache.render(bucketRowTemplate, {
        weight: weight,
        timeBucketWeight: timeBucket.weight,
        faceBucketWeight: faceBucket.weight,
        imageCount: faceBucket.values.length
      });
      $('#imageTable').append(renderedBucket);
      var renderedImageFromBuckets = 0;
      faceBucket.values.forEach(function(imageId) {
        var image = imageCache.images[imageId];
        var rendered = Mustache.render(imageRowTemplate, {debugInfo: JSON.stringify(image, null, 2), imageUrl: image.url});
        if (renderedImageFromBuckets++ < 10) {
          $('#imageTable').append(rendered);
        }
      });
    });
  });
}
