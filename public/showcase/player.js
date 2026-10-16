(() => {
  "use strict";
  const video = document.getElementById("demo");
  const play = document.getElementById("playButton");
  if (!video || !play) return;
  play.addEventListener("click", async () => {
    video.muted = false;
    video.volume = 1;
    video.currentTime = 0;
    try {
      await video.play();
      play.textContent = "↻ Replay with sound";
    } catch {
      video.focus();
    }
  });
})();
