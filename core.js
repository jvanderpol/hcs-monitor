window.addEventListener("load", function() {
  $(document.body).click(function() {
    $(document.body).toggleClass("hide-cursor");
  });
});

function logAjaxError(serviceName, cleanupFunction) {
  return function(jqXHR, textStatus, errorThrown) {
    console.error("Error calling " + serviceName +
      "\ntextStatus:" + textStatus +
      "\nerrorThrown: " + errorThrown +
      "\njqXHR.status: " + jqXHR.status +
      "\njqXHR.responseText: " + jqXHR.responseText);
    if (cleanupFunction) {
      cleanupFunction();
    }
  }
}

function scheduleSync(name, func, interval, lastSyncInMillis) {
  function invokeFunc() {
    func();
    setTimeout(invokeFunc, interval);
  }
  var now = new Date();
  var lastSync = new Date(lastSyncInMillis || 0);
  var timeSinceLastSync = now.getTime() - lastSync.getTime();
  if (timeSinceLastSync > interval) {
    invokeFunc();
  } else {
    var delay = interval - timeSinceLastSync;
    console.log("Delaying '" + name + "' sync by " +
      (Math.round(delay / 1000 / 60 * 10) / 10) +
      " minutes due to recent sync at " + lastSync.toLocaleString());
    setTimeout(invokeFunc, delay)
  }
}
