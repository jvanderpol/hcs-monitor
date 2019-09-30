window.addEventListener("load", function() {
  initApiKeys(function() {
    initAndSyncImageCache().then(drawImageTable);
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
      imageId: imageId,
      imageUrl: image.url
    });
  }
  for (let bucket of buckettedImageCache) {
    var renderedBucket = Mustache.render(bucketRowTemplate, {
      bucketWeight: bucket.weight,
      imageCount: bucket.images.length
    });
    $('#imageTable').append(renderedBucket);
    var renderedImageFromBuckets = 0;
    var trimmedCount = 0;
    for (let imageId of bucket.images) {
      if (renderedImageFromBuckets++ < 100) {
        $('#imageTable').append(renderImageId(imageId));
      } else {
        trimmedCount++;
      }
    }
    if (trimmedCount > 0) {
      $('#imageTable').append("<tr><td>Trimmed " + trimmedCount + "</td></tr>")
    }
  }
}
