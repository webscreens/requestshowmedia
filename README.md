# requestShowMedia.js
### A [Presentation API](http://webscreens.github.io/presentation-api/) [prollyfill](http://prollyfill.org/) for the `HTMLMediaElement`.

### Demo

A [second screen &lt;video&gt; sharing demo](http://webscreens.github.io/requestshowmedia/demo/) displays a `<video>` contained on a web page on a second screen and allows its playback to be controlled using the standard `HTMLMediaElement` methods `play()`, `pause()`, and `fastSeek(time)`. If an [experimental Chromium build](http://webscreens.github.io/demo/#binaries) is used, the video is displayed on a second screen attached to your system using HDMI, VGA, Miracast, or WiDi. Or, if a Chromecast device is available, the video is sent there (requires Chrome with the [Google Cast Extension](https://chrome.google.com/webstore/detail/google-cast/boadgeojelhgndaghljhdicfkmllpafd?hl=en) installed). The demo also works in modern browsers (tested with latest Chrome, Firefox, and Safari) without any extensions by emulating a second screen using a new window. 

### How It Works

1. Include the `requestshowmedia.js` script to your page, copy `requestshowmedia.js` and `player.html` to the same directory (or see `demo/index.html` for advanced configuration).
1. Include the `cast_sender.js` script that implements the [Chrome Sender API](https://developers.google.com/cast/docs/reference/chrome/) for Chromecast support.
1. Invoke `requestShow()` on the video element to show the video on the second screen.
1. Use the standard `HTMLMediaElement` methods to control the playback on the second screen.
1. Enjoy.

```html
<script src="requestshowmedia.js" data-player="player.html"></script>
<script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js"></script>
<video src="myvideo.mp4"></video>
<script>
var v = document.querySelector('video');
v.requestShow();

// Standard HTMLMediaElement methods
v.play();
v.pause();
v.fastSeek(time);

// Experimental extensions to the HTMLMediaElement
v.ontimeupdateonsecondscreen = function (event) {
  console.log(event.detail.currentTimeOnSecondScreen);
};

v.onclosesecondscreen = function () {
  console.log('Second screen closed.');
};

v.exitShow();
</script>
```
### Next Steps

* Track and help evolve the Presentation API
* Implement the missing `HTMLMediaElement` methods
* Make `requestShow()` return a promise when [the browser support improves](http://caniuse.com/promises) (or use a polyfill)
* Use native `fastSeek(time)` when browsers implement it

### Credits

Video trailer from http://www.bigbuckbunny.org/, an open source http://www.blender.org/ project.
Transcoded versions from https://github.com/georgepaterson/jquery-videobackground.