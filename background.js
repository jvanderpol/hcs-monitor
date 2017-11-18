chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.create({
    url: chrome.runtime.getURL("window.html"),
    //type: "popup"
  });
});
