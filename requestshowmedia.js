(function () {

var playerOrigin = document.querySelector('script[src$="requestshowmedia.js"]')
                   .dataset.playerorigin || '/';

var video = null,
    play = HTMLMediaElement.prototype.play,
    pause = HTMLMediaElement.prototype.pause;
    // var fastSeek = HTMLMediaElement.prototype.fastSeek; // not implemented by browsers yet

var castAvailable = false,  // Set when at least one Cast device is available
    castSession = null;     // Cast session linked to the page if there's one

HTMLVideoElement.prototype.requestShow = function () {
  video = this;
  requestShowMedia(this);
};

HTMLVideoElement.prototype.exitShow = function () {
  if (this.dataset.secondScreenEnabled === 'true') {
    this.player.close();
  }
};

HTMLMediaElement.prototype.play = function (args) {
  if (this.dataset.secondScreenEnabled === 'true') {
    video.player.postMessage({ cmd: 'play'}, playerOrigin);
  } else {
    play.apply(this, args);
  }
};

HTMLMediaElement.prototype.pause = function (args) {
  if (this.dataset.secondScreenEnabled  === 'true') {
    video.player.postMessage({ cmd: 'pause'}, playerOrigin);
  } else {
    pause.apply(this, args);
  }
};

HTMLMediaElement.prototype.fastSeek = function (currentTime) {
  if (this.dataset.secondScreenEnabled  === 'true') {
    video.player.postMessage({ cmd: 'fastSeek', currentTime: currentTime }, playerOrigin);
  } else {
    //fastSeek.apply(this, args); // not implemented by browsers yet
    this.currentTime = currentTime;
  }
};

function onSecondScreenEnabled() {
  video.pause();
  video.style.opacity = 0.5;
  video.dataset.secondScreenEnabled = true;
}

function onSecondScreenDisabled(currentTime) {
  video.dataset.secondScreenEnabled = false;
  video.player = null;
  video.style.opacity = 1;
  if (currentTime || (currentTime === 0)) {
    video.currentTime = currentTime;
  }
  video.play();
}

function dispatchTimeUpdateOnSecondScreenEvent(currentTime) {
  try {
    video.ontimeupdateonsecondscreen(currentTime);
  } catch (ex) { }

  video.dispatchEvent(new CustomEvent('timeupdateonsecondscreen',
    { detail: { currentTimeOnSecondScreen: currentTime } }));
}

function dispatchSecondScreenCloseEvent() {
  try {
    video.onclosesecondscreen();
  } catch (ex) { }
  video.dispatchEvent(new Event('closesecondscreen'));
}

function requestShowMedia(video) {
  // Try projecting to Chromecast device first
  if (castAvailable) {
    console.log('Cast device available');
    if (castSession) {
      loadCastMedia(castSession);
    }
    else {
      chrome.cast.requestSession(loadCastMedia, function (error) {
        if (error.code === 'cancel') {
          console.info('User chose not to use Cast device, fallback to attached screen');
          requestShowMediaOnAttachedScreen(video);
        }
        else {
          console.error('Could not create Cast session', error);
          dispatchSecondScreenCloseEvent();
        }
      });
    }
  }
  else {
    requestShowMediaOnAttachedScreen(video);
  }
}

function requestShowMediaOnAttachedScreen(video) {
  var playerURL = document.querySelector('script[src$="requestshowmedia.js"]').dataset.player;
  video.player = window.open(playerURL, '', 'presentation');
  if (!video.player) {
    dispatchSecondScreenCloseEvent();
    return;
  }
  
  video.player.addEventListener('load', function () {
    onSecondScreenEnabled();
    video.player.postMessage({
      cmd: 'open',
      currentSrc: video.currentSrc,
      currentTime: video.currentTime
    }, playerOrigin);
  });

  addEventListener('message', function (event) {
    switch (event.data.cmd) {
      case 'play':
        onSecondScreenDisabled(event.data.currentTime);
        break;
      case 'ontimeupdateonsecondscreen':
        dispatchTimeUpdateOnSecondScreenEvent(event.data.currentTime);
        break;
      case 'close':
        dispatchSecondScreenCloseEvent();
        break;
      default:
        break;
    }
  });

  return video.player;
}

// Initialize the Cast API if available
window['__onGCastApiAvailable'] = function (loaded, errorInfo) {
  if (!loaded) {
    console.error('Cast API could not be loaded', errorInfo);
    return;
  }

  var applicationID = chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
  var sessionRequest = new chrome.cast.SessionRequest(applicationID);
  var apiConfig = new chrome.cast.ApiConfig(
    sessionRequest,
    function (session) {
      console.log('Cast session found at startup');
      castSession = session;
      castSession.addUpdateListener(onCastSessionChange);
    },
    function (availability) {
      console.log('Cast API', 'availability=' + availability);
      if (availability === chrome.cast.ReceiverAvailability.AVAILABLE) {
        castAvailable = true;
      }
      else {
        // No more Chromecast device around, stop casting session
        // if there was one.
        castAvailable = false;
        if (castSession) {
          onSecondScreenDisabled();
          dispatchSecondScreenCloseEvent();
        }
      }
    });
  chrome.cast.initialize(apiConfig, function () {
    console.info('The Cast API was initialized');
  }, function (error) {
    console.error('The Cast API could not be initialized', error);
  });
};

// TODO: Video content-type should not be hardcoded. It cannot simply be dropped
// as Cast devices refuse to play the video otherwise.
function loadCastMedia(session) {
  var mediaInfo = new chrome.cast.media.MediaInfo(video.currentSrc, 'video/mp4');
  var request = new chrome.cast.media.LoadRequest(mediaInfo);
  request.currentTime = video.currentTime;
  castSession = session;
  castSession.addUpdateListener(onCastSessionChange);
  castSession.loadMedia(request, onCastMediaLoaded, onCastMediaError);
}

function onCastSessionChange(isAlive) {
  if (!isAlive) {
    castSession = null;
    if (video && (video.dataset.secondScreenEnabled === 'true')) {
      onSecondScreenDisabled();
      dispatchSecondScreenCloseEvent();
    }
  }
}

function onCastMediaLoaded(media) {
  video.player = new CastPlayer(media);
  onSecondScreenEnabled();
}

function onCastMediaError(error) {
  console.error('The Cast API returned an error', error);
  onSecondScreenDisabled();
  dispatchSecondScreenCloseEvent();
}

function CastPlayer(media) {
  this.postMessage = function (msg) {
    switch (msg.cmd) {
    case 'play':
      // Note: calling "play" when a Chromecast device is done playing a video
      // does not do anything. The only way to restart play is to reload the
      // video, it seems.
      if ((media.playerState === chrome.cast.media.PlayerState.IDLE) &&
          (media.idleReason === chrome.cast.media.IdleReason.FINISHED)) {
        video.currentTime = 0;
        loadCastMedia(castSession);
      }
      else {
        media.play();
      }
      break;
    case 'pause':
      media.pause();
      break;
    case 'fastSeek':
      seekRequest = new chrome.cast.media.SeekRequest();
      seekRequest.currentTime = msg.currentTime;
      media.seek(seekRequest);
      break;
    }
  };

  this.close = function () {
    var currentTime = media.getEstimatedTime();
    if (castInterval) {
      clearInterval(castInterval);
      castInterval = null;
    }
    media.stop(null, function () {
      onSecondScreenDisabled(currentTime);
      dispatchSecondScreenCloseEvent();
    }, function (error) {
      console.warn('Could not properly stop Cast session', error);
      onSecondScreenDisabled();
      dispatchSecondScreenCloseEvent();
    });
  };

  // Monitor time updates
  var castInterval = setInterval(function () {
    var currentTime = null;
    if (castSession) {
      currentTime = media.getEstimatedTime();
      dispatchTimeUpdateOnSecondScreenEvent(currentTime);
    }
    else {
      clearInterval(castInterval);
      castInterval = null;
    }
  }, 500);
}

}());