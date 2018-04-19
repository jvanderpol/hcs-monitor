window.addEventListener("load", function() {
  $(document.body).click(function() {
    $(document.body).toggleClass("hide-cursor");
  });
});

function logAjaxError(serviceName) {
  return function(jqXHR, textStatus, errorThrown) {
    console.error("Error calling " + serviceName +
      "\ntextStatus:" + textStatus +
      "\nerrorThrown: " + errorThrown +
      "\njqXHR.status: " + jqXHR.status +
      "\njqXHR.responseText: " + jqXHR.responseText);
  }
}
