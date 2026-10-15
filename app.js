(() => {
  'use strict';
  const story = window.NUO_STORY;
  const $ = (id) => document.getElementById(id);
  const storageKey = 'little-nuo-reader-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* Reading also works without storage. */ }
  let current = Number.isInteger(saved.page) ? Math.max(0, Math.min(story.length - 1, saved.page)) : 0;
  let ending = ['A', 'B', 'C'].includes(saved.ending) ? saved.ending : 'A';
  let motion = saved.motion === true;
  let flipping = false;
  let playRequest = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bookElement = $('book');
  const pageNodes = [];
  const stemFor = (scene) => scene.variants ? scene.variants[ending] : scene.stem;
  const imagePath = (stem) => `./images/${stem}.webp`;
  const videoPath = (stem) => `./videos/${stem}.mp4`;
  const pad = (value) => String(value).padStart(2, '0');

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ page: current, ending, motion })); } catch { /* Optional. */ }
  }

  function pauseAll() {
    playRequest += 1;
    bookElement.querySelectorAll('video').forEach((video) => {
      video.pause();
      video.classList.remove('is-visible');
    });
    $('video-fallback').hidden = true;
    $('playback-status').hidden = true;
  }

  function syncControls() {
    const scene = story[current];
    $('chapter-label').textContent = scene.chapter;
    $('top-page').textContent = `${pad(current + 1)} / ${story.length}`;
    $('picture-badge').textContent = pad(current + 1);
    $('scene-tag').textContent = scene.tag;
    $('scene-title').textContent = scene.title;
    $('scene-text').textContent = scene.text;
    $('current-page').textContent = pad(current + 1);
    $('previous').disabled = current === 0 || flipping;
    $('next').disabled = current === story.length - 1 || flipping;
    $('page-progress').value = current + 1;
    $('page-progress').setAttribute('aria-valuetext', `第${current + 1}页，共${story.length}页`);
    $('motion-toggle').setAttribute('aria-pressed', String(motion));
    $('motion-label').textContent = motion ? '切换为静态画面' : '让画面动起来';
    $('replay').hidden = !motion;
    $('ending').value = ending;
    document.querySelectorAll('.catalog-item').forEach((item, i) => {
      if (i === current) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    // The currently visible image and next image are enough for smooth reading.
    for (const index of [current, current + 1, current - 1]) {
      const image = pageNodes[index]?.querySelector('img');
      if (image) image.loading = 'eager';
    }
    save();
  }

  async function playCurrent(restart = false) {
    if (!motion || flipping || document.hidden || $('catalog').open) return;
    const page = pageNodes[current];
    const video = page.querySelector('video');
    const expected = videoPath(stemFor(story[current]));
    if (video.getAttribute('src') !== expected) {
      video.src = expected;
      video.load();
    }
    if (restart) video.currentTime = 0;
    video.muted = true;
    video.defaultMuted = true;
    const request = ++playRequest;
    try {
      await video.play();
      if (request !== playRequest || flipping || !motion || page !== pageNodes[current] || document.hidden || $('catalog').open) return;
      video.classList.add('is-visible');
      $('video-fallback').hidden = true;
      $('playback-status').hidden = true;
    } catch (error) {
      if (request !== playRequest || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        $('video-fallback').hidden = false;
      } else {
        $('playback-status').textContent = '视频暂时无法播放，仍可看图翻页';
        $('playback-status').hidden = false;
      }
    }
  }

  story.forEach((scene, i) => {
    const page = document.createElement('div');
    page.className = 'story-page';
    page.dataset.page = i;
    const image = document.createElement('img');
    image.src = imagePath(stemFor(scene));
    image.alt = scene.title;
    image.loading = i <= 1 || i === current ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.draggable = false;
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.preload = 'none';
    video.poster = image.src;
    video.setAttribute('aria-hidden', 'true');
    video.addEventListener('ended', () => {
      if (pageNodes[current] !== page || !motion) return;
      $('playback-status').textContent = '本页播放完毕 · 可重播或继续翻页';
      $('playback-status').hidden = false;
    });
    video.addEventListener('error', () => {
      if (pageNodes[current] !== page || !motion || flipping) return;
      video.classList.remove('is-visible');
      $('playback-status').textContent = '视频暂时无法播放，仍可看图翻页';
      $('playback-status').hidden = false;
    });
    page.append(image, video);
    bookElement.appendChild(page);
    pageNodes.push(page);
  });

  let chapter = '';
  story.forEach((scene, i) => {
    if (chapter !== scene.chapter) {
      chapter = scene.chapter;
      const group = document.createElement('p');
      group.className = 'catalog-group';
      group.textContent = chapter;
      $('catalog-list').append(group);
    }
    const item = document.createElement('button');
    item.className = 'catalog-item';
    item.dataset.index = i;
    const number = document.createElement('span');
    number.textContent = pad(i + 1);
    const title = document.createElement('strong');
    title.textContent = scene.title;
    item.append(number, title);
    item.addEventListener('click', () => {
      // Avoid briefly resuming the page we are leaving when closing the dialog.
      jump(i);
      $('catalog').close();
    });
    $('catalog-list').append(item);
  });

  const pageFlip = new St.PageFlip(bookElement, {
    width: 1200, height: 675, size: 'stretch',
    minWidth: 1500, maxWidth: 2400, minHeight: 100, maxHeight: 1350,
    usePortrait: true, autoSize: false, showCover: false,
    startPage: current, flippingTime: reduceMotion ? 1 : 850,
    drawShadow: true, maxShadowOpacity: 0.24,
    useMouseEvents: false, mobileScrollSupport: false,
    disableFlipByClick: false, clickEventForward: false,
    showPageCorners: false, swipeDistance: 40
  });

  function jump(index) {
    if (flipping) return;
    pauseAll();
    const target = Math.max(0, Math.min(story.length - 1, index));
    pageFlip.turnToPage(target);
    current = target;
    syncControls();
    playCurrent(true);
  }

  pageFlip.on('flip', (event) => {
    pauseAll();
    current = event.data;
    syncControls();
    if (!flipping) playCurrent(true);
  });
  pageFlip.on('changeState', (event) => {
    flipping = event.data !== 'read';
    if (flipping) pauseAll();
    syncControls();
    if (!flipping) playCurrent(true);
  });
  pageFlip.on('init', () => {
    syncControls();
    playCurrent();
  });
  pageFlip.loadFromHTML(pageNodes);

  $('next').addEventListener('click', () => {
    if (!flipping && current < story.length - 1) pageFlip.flipNext('top');
  });
  $('previous').addEventListener('click', () => {
    if (!flipping && current > 0) pageFlip.flipPrev('top');
  });
  // Keep page controls separate from the illustration. The library's corner-only
  // click filter also blocks flipPrev() in portrait mode, so gestures are handled here.
  let touchStart = null;
  bookElement.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') touchStart = { x: event.clientX, y: event.clientY };
  });
  bookElement.addEventListener('pointerup', (event) => {
    if (!touchStart || event.pointerType !== 'touch') return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      (dx < 0 ? $('next') : $('previous')).click();
    }
  });
  bookElement.addEventListener('pointercancel', () => { touchStart = null; });
  $('page-progress').addEventListener('change', (event) => jump(Number(event.target.value) - 1));
  $('motion-toggle').addEventListener('click', () => {
    motion = !motion;
    pauseAll();
    syncControls();
    if (motion) playCurrent(true);
  });
  $('replay').addEventListener('click', () => { pauseAll(); playCurrent(true); });
  $('video-fallback').addEventListener('click', () => playCurrent());
  $('ending').addEventListener('change', (event) => {
    pauseAll();
    ending = event.target.value;
    story.forEach((scene, i) => {
      if (!scene.variants) return;
      const image = pageNodes[i].querySelector('img');
      const video = pageNodes[i].querySelector('video');
      image.src = imagePath(stemFor(scene));
      video.poster = image.src;
      if (video.hasAttribute('src')) {
        video.removeAttribute('src');
        video.load();
      }
    });
    // Portrait flips may use cloned pages: sync their image sources too.
    bookElement.querySelectorAll('.story-page').forEach((node) => {
      const scene = story[Number(node.dataset.page)];
      if (scene?.variants) node.querySelector('img').src = imagePath(stemFor(scene));
    });
    syncControls();
    playCurrent(true);
  });
  $('catalog-open').addEventListener('click', () => {
    pauseAll();
    $('catalog').showModal();
    const active = $('catalog-list').querySelector('[aria-current="page"]');
    active?.scrollIntoView({ block: 'center' });
    active?.focus({ preventScroll: true });
  });
  $('catalog-close').addEventListener('click', () => $('catalog').close());
  $('catalog').addEventListener('close', () => playCurrent());
  $('catalog').addEventListener('click', (event) => {
    if (event.target !== $('catalog')) return;
    const bounds = $('catalog').getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('catalog').close();
  });
  document.querySelector('.brand').addEventListener('click', (event) => { event.preventDefault(); jump(0); });
  document.addEventListener('keydown', (event) => {
    if ($('catalog').open || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); $('next').click(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); $('previous').click(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAll();
    else playCurrent();
  });
})();
