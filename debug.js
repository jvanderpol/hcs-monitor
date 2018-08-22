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
  function renderImageId(imageId) {
    var image = imageCache.images[imageId];
    return Mustache.render(imageRowTemplate, {
      debugInfo: JSON.stringify(image, null, 2),
      disabled: imageCache.disabledImageIds[imageId],
      imageId: imageId,
      imageUrl: image.url
    });
  }
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
      var trimmedCount = 0;
      faceBucket.values.forEach(function(imageId) {
        if (renderedImageFromBuckets++ < 100) {
          $('#imageTable').append(renderImageId(imageId));
        } else {
          trimmedCount++;
        }
      });
      if (trimmedCount > 0) {
        $('#imageTable').append("<tr><td>Trimmed " + trimmedCount + "</td></tr>")
      }
    });
  });
  Object.keys(imageCache.disabledImageIds).forEach(function(imageId) {
      $('#imageTable').append(renderImageId(imageId));
  });
}
