/* =========================================================
   Từ Batch đến Real-time — demo section
   Worker URL (data-demo-url or ?demo=…) → QR code + links,
   backup video placeholder, pause the video off-slide.
   ========================================================= */
(function () {
  'use strict';

  function demoUrl(slide) {
    let url = (new URLSearchParams(location.search).get('demo') || slide.dataset.demoUrl || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return url.replace(/\/+$/, '');
  }

  function liveSlide() {
    const slide = document.getElementById('demo-live');
    if (!slide) return;
    const url = demoUrl(slide);
    slide.classList.toggle('has-url', !!url);
    if (!url) return;
    slide.querySelectorAll('[data-demo-href]').forEach((a) => { a.href = url + a.dataset.demoHref; });
    slide.querySelectorAll('[data-demo-text]').forEach((el) => { el.textContent = url + el.dataset.demoText; });
    const box = slide.querySelector('.qr-box');
    if (box && window.QRCode) {
      // eslint-disable-next-line no-new
      new window.QRCode(box, { text: url + '/', width: 392, height: 392, correctLevel: window.QRCode.CorrectLevel.M });
      box.removeAttribute('title'); // qrcodejs puts the raw URL in a tooltip
    } else if (box) {
      box.hidden = true; // offline: the URL text and buttons still work
    }
  }

  function backupVideo() {
    document.querySelectorAll('.video-box').forEach((box) => {
      const video = box.querySelector('video');
      const source = video && video.querySelector('source');
      if (!video) return;
      const missing = () => box.classList.add('missing');
      if (source) source.addEventListener('error', missing);
      video.addEventListener('error', missing);
      if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) missing();
    });
    document.addEventListener('slide:enter', (e) => {
      document.querySelectorAll('.video-box video').forEach((v) => {
        if (!e.detail.slide.contains(v) && !v.paused) v.pause();
      });
    });
  }

  function init() {
    liveSlide();
    backupVideo();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
