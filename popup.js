window.onload = function() {
  document.getElementById("full-screen").addEventListener("click", function(){
    chrome.windows.create({
      url: chrome.runtime.getURL("window.html"),
      state: "fullscreen",
      type: "popup"
    });
  });
  document.getElementById("new-tab").addEventListener("click", function(){
    chrome.tabs.create({
      url: chrome.runtime.getURL("window.html"),
    });
  });
}
