// Storage helpers.
// Citation data is stored only in Chrome's local extension storage.
(() => {

function canUseChromeStorage() {
  return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
}

function storageGet(keys, callback) {
  if (!canUseChromeStorage()) {
    callback({});
    return;
  }

  try {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        callback({});
        return;
      }

      callback(result);
    });
  } catch (error) {
    callback({});
  }
}

function storageSet(data, callback = () => {}) {
  if (!canUseChromeStorage()) {
    callback();
    return;
  }

  try {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        callback();
        return;
      }

      callback();
    });
  } catch (error) {
    callback();
  }
}

window.AutoCiteStorage = {
  storageGet,
  storageSet
};
})();
