(() => {
  const DURATION = 45;
  const FPS = 30;
  const stage = document.querySelector('#stage');
  const question = document.querySelector('.question-scene');
  const tour = document.querySelector('.tour-scene');
  const cta = document.querySelector('.cta-scene');
  const questionCard = document.querySelector('.ig-question');
  const questionHalo = document.querySelector('.question-halo');
  const reply = document.querySelector('.ig-reply');
  const questionFoot = document.querySelector('.question-foot');
  const portal = document.querySelector('.reply-portal');
  const bursts = [...document.querySelectorAll('.burst')];
  const siteFrame = document.querySelector('.site-frame');
  const tourPage = document.querySelector('.tour-page');
  const heroMotion = document.querySelector('.hero-motion-state');
  const categoryMotion = document.querySelector('.category-motion-state');
  const productState = document.querySelector('.product-state');
  const aboutState = document.querySelector('.about-state');
  const sectionBridge = document.querySelector('.section-bridge');
  const actionRipple = document.querySelector('.action-ripple');
  const localBrand = document.querySelector('.local-brand-scene');
  const localBrandPhoto = document.querySelector('.local-brand-photo');
  const localBrandLogo = document.querySelector('.local-brand-logo');
  const localBrandPlace = document.querySelector('.local-brand-place');
  const localBrandHeading = document.querySelector('.local-brand-scene h2');
  const localBrandProof = document.querySelector('.local-brand-proof');
  const localBrandRule = document.querySelector('.local-brand-rule');
  const ghostA = document.querySelector('.ghost-a');
  const ghostB = document.querySelector('.ghost-b');
  const rail = document.querySelector('.type-rail');
  const auraRed = document.querySelector('.aura-red');
  const auraMustard = document.querySelector('.aura-mustard');
  const paths = [...document.querySelectorAll('.motion-path, .motion-circle')];
  const sparks = [...document.querySelectorAll('.spark-field i')];
  const mpoWordmark = document.querySelector('.mpo-wordmark');
  const ctaEyebrow = document.querySelector('.cta-eyebrow');
  const ctaHeading = document.querySelector('.cta-scene h1');
  const ctaDescription = document.querySelector('.cta-description');
  const ctaButton = document.querySelector('.cta-button');
  const ctaCredit = document.querySelector('.cta-credit');
  const ctaOrbit = document.querySelector('.cta-orbit');
  const ctaOutline = document.querySelector('.cta-outline');
  const toggle = document.querySelector('#toggle');
  const restart = document.querySelector('#restart');
  const scrubber = document.querySelector('#scrubber');
  const clock = document.querySelector('#clock');
  const params = new URLSearchParams(location.search);
  let playing = false;
  let time = clamp(Number(params.get('time') || 0), 0, DURATION);
  if (params.has('frame')) time = clamp(Number(params.get('frame')) / FPS, 0, DURATION);
  const captureMode = params.get('capture') === '1';
  if (captureMode) document.body.classList.add('capture');
  let startedAt = performance.now() - time * 1000;

  function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
  function range(value, start, end) { return clamp((value - start) / (end - start)); }
  function mix(a, b, progress) { return a + (b - a) * progress; }
  function easeOut(value) { const p = clamp(value); return 1 - Math.pow(1 - p, 3); }
  function easeInOut(value) { const p = clamp(value); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function backOut(value) {
    const p = clamp(value);
    const c1 = 1.18;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  }
  function fadeWindow(value, start, end, ramp = .5) {
    return clamp((value - start) / ramp) * clamp((end - value) / ramp);
  }

  function tourScroll(value) {
    if (value < 13.75) return 430;
    if (value < 14.8) return mix(430, 850, easeInOut(range(value, 13.75, 14.8)));
    if (value < 17.1) return mix(850, 2200, easeInOut(range(value, 14.8, 17.1)));
    if (value < 19.05) return mix(2200, 2700, easeInOut(range(value, 17.1, 19.05)));
    if (value < 21.05) return mix(2700, 3600, easeInOut(range(value, 19.05, 21.05)));
    if (value < 22.95) return mix(3600, 4450, easeInOut(range(value, 21.05, 22.95)));
    return 4450;
  }

  function animateAtmosphere(value) {
    const stageScale = stage.clientWidth / 1080;
    auraRed.style.transform = `translate(${Math.sin(value * .38) * 70 * stageScale}px,${Math.cos(value * .29) * 45 * stageScale}px) scale(${1 + Math.sin(value * .24) * .08})`;
    auraMustard.style.transform = `translate(${Math.cos(value * .31) * 60 * stageScale}px,${Math.sin(value * .26) * 55 * stageScale}px) scale(${1 + Math.cos(value * .22) * .07})`;
    rail.style.transform = `translateX(${(-value * 24 * stageScale).toFixed(2)}px)`;
    paths.forEach((path, index) => {
      path.style.strokeDashoffset = `${(-value * (index + 1) * 18).toFixed(2)}`;
    });
    sparks.forEach((spark, index) => {
      const x = Math.sin(value * (.43 + index * .013) + index * 1.7) * (18 + index % 3 * 8) * stageScale;
      const y = Math.cos(value * (.36 + index * .017) + index * 1.3) * (22 + index % 4 * 7) * stageScale;
      const pulse = .62 + .38 * Math.sin(value * 1.1 + index);
      spark.style.opacity = clamp(pulse, .18, 1).toFixed(3);
      spark.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${(.8 + pulse * .45).toFixed(3)})`;
    });
  }

  function render(nextTime) {
    time = clamp(nextTime, 0, DURATION);
    animateAtmosphere(time);

    const questionOpacity = clamp((5.2 - time) / .55);
    question.style.opacity = questionOpacity.toFixed(4);
    const cardIn = backOut(range(time, .12, 1.0));
    questionCard.style.opacity = clamp(cardIn).toFixed(4);
    questionCard.style.transform = `translateY(${(1 - cardIn) * 12}%) rotate(${(1 - cardIn) * -1.8}deg)`;
    questionHalo.style.transform = `scale(${.78 + cardIn * .22}) rotate(${time * 2.2}deg)`;
    const replyIn = backOut(range(time, 1.08, 2.0));
    const replyOut = 1 - easeInOut(range(time, 3.72, 4.48));
    reply.style.opacity = (clamp(replyIn) * replyOut).toFixed(4);
    reply.style.transform = `translateY(${(1 - replyIn) * 25}%) rotate(${(1 - replyIn) * 2.4}deg) scale(${.92 + replyIn * .08})`;
    const footIn = easeOut(range(time, 1.9, 2.85));
    questionFoot.style.opacity = footIn.toFixed(4);
    questionFoot.style.transform = `translateY(${(1 - footIn) * 18}%)`;
    bursts.forEach((burst, index) => {
      const reveal = easeOut(range(time, .7 + index * .35, 1.5 + index * .35));
      burst.style.opacity = reveal.toFixed(3);
      burst.style.transform = `rotate(${(index ? -18 : 13) + time * (index ? -10 : 12)}deg) scale(${.4 + reveal * .6})`;
    });

    const portalIn = easeInOut(range(time, 3.55, 4.72));
    portal.style.opacity = (Math.sin(portalIn * Math.PI) * .92).toFixed(4);
    portal.style.transform = `scale(${.15 + portalIn * 14}) rotate(${portalIn * 42}deg)`;

    const tourOpacity = fadeWindow(time, 3.86, 39.72, .74);
    tour.style.opacity = tourOpacity.toFixed(4);
    const frameIn = backOut(range(time, 3.92, 5.05));
    siteFrame.style.opacity = clamp(frameIn).toFixed(4);
    siteFrame.style.clipPath = `inset(${((1 - clamp(frameIn)) * 44).toFixed(2)}% ${((1 - clamp(frameIn)) * 39).toFixed(2)}% round ${Math.round(38 + (1 - clamp(frameIn)) * 220)}px)`;
    siteFrame.style.transform = `translateY(${(1 - frameIn) * 8}%) scale(${.965 + frameIn * .035}) rotate(${(1 - frameIn) * -1.2}deg)`;

    const captureScale = tourPage.clientWidth / 390;
    const originalScroll = tourScroll(time);
    tourPage.style.transform = `translate3d(0, ${(-originalScroll * captureScale).toFixed(3)}px, 0)`;
    tourPage.style.opacity = easeInOut(range(time, 14.38, 14.62)).toFixed(4);

    const heroVisible = fadeWindow(time, 4.12, 10.38, .55);
    const heroDrift = easeInOut(range(time, 4.28, 10.22));
    heroMotion.style.opacity = heroVisible.toFixed(4);
    heroMotion.style.transform = `translateY(${(-heroDrift * 14.5).toFixed(3)}%) scale(${(1 + heroDrift * .006).toFixed(4)})`;

    const categoryReveal = easeInOut(range(time, 9.45, 10.18));
    const categoryOut = 1 - easeOut(range(time, 14.28, 14.52));
    const categoryVisible = categoryReveal * categoryOut;
    const categoryDrift = easeInOut(range(time, 9.72, 14.45));
    categoryMotion.style.opacity = categoryVisible.toFixed(4);
    categoryMotion.style.clipPath = `inset(${((1 - categoryReveal) * 100).toFixed(3)}% 0 0 0)`;
    categoryMotion.style.transform = `translateY(${(-categoryDrift * 11.5).toFixed(3)}%) scale(${(1 + categoryDrift * .004).toFixed(4)})`;

    const bridgeIn = easeInOut(range(time, 14.22, 14.7));
    const bridgeOut = easeInOut(range(time, 16.3, 16.76));
    const bridgeVisible = clamp((time - 14.12) / .16) * clamp((16.88 - time) / .16);
    const bridgeDrift = easeInOut(range(time, 14.7, 16.3));
    sectionBridge.style.opacity = bridgeVisible.toFixed(4);
    sectionBridge.style.transform = `translateY(${time < 16.3 ? (1 - bridgeIn) * 105 : -bridgeOut * 105}%)`;
    sectionBridge.querySelector('b').style.transform = `translateX(${(1 - bridgeIn) * -12 + bridgeDrift * 1.8}%) scale(${1 + bridgeDrift * .018})`;
    sectionBridge.querySelector('i').style.width = `${20 + bridgeDrift * 20}%`;

    const productIn = easeInOut(range(time, 22.72, 23.58));
    const productOut = 1 - easeOut(range(time, 28.12, 28.3));
    const productScroll = mix(0, 218, easeInOut(range(time, 23.78, 27.5)));
    productState.style.opacity = (productIn * productOut).toFixed(4);
    productState.style.transform = `translateY(${((1 - productIn) * 82 - productScroll * captureScale).toFixed(3)}px)`;

    const rippleProgress = easeOut(range(time, 27.58, 28.16));
    const rippleFade = 1 - easeOut(range(time, 27.94, 28.34));
    actionRipple.style.opacity = (rippleProgress * rippleFade).toFixed(4);
    actionRipple.style.transform = `translate(-50%,-50%) scale(${.2 + rippleProgress * 2.45})`;

    const localReveal = easeInOut(range(time, 27.92, 28.72));
    const localExit = easeInOut(range(time, 32.92, 33.78));
    const localVisible = localReveal > 0 && localExit < 1 ? 1 : 0;
    const localTopCrop = time < 32.92 ? (1 - localReveal) * 100 : 0;
    localBrand.style.opacity = String(localVisible);
    localBrand.style.clipPath = time < 32.92
      ? `inset(${localTopCrop.toFixed(3)}% 0 0 0)`
      : `inset(0 ${(localExit * 100).toFixed(3)}% 0 0)`;
    const localPhotoDrift = easeInOut(range(time, 28.1, 33.45));
    localBrandPhoto.style.transform = `translateY(${(-localPhotoDrift * 2.8).toFixed(3)}%) scale(${(1.055 - localPhotoDrift * .035).toFixed(4)})`;
    localBrandPhoto.style.filter = `saturate(${(1.04 + localPhotoDrift * .08).toFixed(3)}) contrast(${(1.02 + localPhotoDrift * .05).toFixed(3)})`;
    const localLogoIn = backOut(range(time, 28.18, 29.0));
    localBrandLogo.style.opacity = clamp(localLogoIn).toFixed(4);
    localBrandLogo.style.transform = `translateY(${(1 - localLogoIn) * -35}%) scale(${.94 + localLogoIn * .06})`;
    const localCopyIn = easeOut(range(time, 28.62, 29.55));
    localBrandPlace.style.opacity = localCopyIn.toFixed(4);
    localBrandPlace.style.transform = `translateX(${(1 - localCopyIn) * -10}%)`;
    const localHeadingIn = backOut(range(time, 28.9, 30.0));
    localBrandHeading.style.opacity = clamp(localHeadingIn).toFixed(4);
    localBrandHeading.style.transform = `translateY(${(1 - localHeadingIn) * 20}%)`;
    const localProofIn = easeOut(range(time, 29.75, 30.65));
    localBrandProof.style.opacity = localProofIn.toFixed(4);
    localBrandProof.style.transform = `translateY(${(1 - localProofIn) * 35}%)`;
    localBrandRule.style.width = `${8 + localProofIn * 16}%`;

    const aboutIn = easeInOut(range(time, 32.92, 33.82));
    const aboutExit = easeInOut(range(time, 38.62, 39.5));
    const aboutDrift = easeInOut(range(time, 34.0, 38.55));
    aboutState.style.opacity = String(aboutIn > 0 && aboutExit < 1 ? 1 : 0);
    aboutState.style.clipPath = 'none';
    aboutState.style.transform = `translateY(${(-aboutDrift * 1.8).toFixed(3)}%)`;

    ghostA.style.transform = `translateY(${Math.sin(time * .34) * 90}px) rotate(-90deg)`;
    ghostB.style.transform = `translateY(${Math.cos(time * .3) * 80}px) rotate(90deg)`;

    const ctaReveal = easeInOut(range(time, 38.62, 39.5));
    const ctaVisibility = clamp((time - 38.52) / .1) * clamp((46.2 - time) / .82);
    cta.style.opacity = ctaVisibility.toFixed(4);
    cta.style.clipPath = `inset(${((1 - ctaReveal) * 100).toFixed(3)}% 0 0 0)`;
    const markIn = backOut(range(time, 38.88, 39.88));
    mpoWordmark.style.opacity = clamp(markIn).toFixed(4);
    mpoWordmark.style.transform = `translateY(${(1 - markIn) * 34}%) rotate(${(1 - markIn) * -5}deg) scale(${.88 + markIn * .12})`;
    const eyebrowIn = easeOut(range(time, 39.24, 40.1));
    ctaEyebrow.style.opacity = eyebrowIn.toFixed(4);
    ctaEyebrow.style.transform = `translateX(${(1 - eyebrowIn) * -6}%)`;
    const ctaIn = backOut(range(time, 39.52, 40.76));
    ctaHeading.style.opacity = clamp(ctaIn).toFixed(4);
    ctaHeading.style.transform = `translateY(${(1 - ctaIn) * 15}%)`;
    const descriptionIn = easeOut(range(time, 40.36, 41.32));
    ctaDescription.style.opacity = descriptionIn.toFixed(4);
    ctaDescription.style.transform = `translateX(${(1 - descriptionIn) * -6}%)`;
    const buttonIn = backOut(range(time, 41.08, 42.16));
    const buttonBreath = 1 + range(time, 42.2, 42.6) * Math.sin((time - 42.2) * 2.8) * .012;
    ctaButton.style.opacity = clamp(buttonIn).toFixed(4);
    ctaButton.style.transform = `translateY(${(1 - buttonIn) * 28}%) scale(${(.96 + buttonIn * .04) * buttonBreath})`;
    ctaCredit.style.opacity = easeOut(range(time, 41.75, 42.5)).toFixed(4);
    ctaOrbit.style.transform = `rotate(${time * 8}deg) scale(${1 + Math.sin(time * .55) * .04})`;
    ctaOutline.style.transform = `translateX(${(-time * 8).toFixed(2)}px) rotate(-7deg)`;

    scrubber.value = time.toFixed(2);
    clock.textContent = `00:${time.toFixed(1).padStart(4, '0')} / 00:45.0`;
    stage.dataset.frame = String(Math.round(time * FPS));
    if (!captureMode) syncPreviewMedia(time);
  }

  function mediaTime(value, start, media) {
    const lastFrame = Number.isFinite(media.duration) ? Math.max(0, media.duration - 1 / FPS) : 0;
    return clamp(value - start, 0, lastFrame);
  }

  function syncPreviewMedia(value) {
    const states = [
      {media: heroMotion, start: 4.12, end: 10.4},
      {media: categoryMotion, start: 9.45, end: 14.7},
    ];
    states.forEach(({media, start, end}) => {
      const active = value >= start - .22 && value <= end;
      if (!active) {
        media.pause();
        return;
      }
      const desired = mediaTime(value, start, media);
      if (Math.abs(media.currentTime - desired) > .14) media.currentTime = desired;
      if (playing && media.paused) media.play().catch(() => undefined);
      if (!playing && !media.paused) media.pause();
    });
  }

  function waitForMedia(media, eventName, timeout = 1200) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        media.removeEventListener(eventName, finish);
        resolve();
      };
      media.addEventListener(eventName, finish, {once: true});
      setTimeout(finish, timeout);
    });
  }

  async function seekMedia(media, desired) {
    if (media.readyState < 2) await waitForMedia(media, 'loadeddata');
    const target = mediaTime(desired, 0, media);
    if (Math.abs(media.currentTime - target) <= 1 / (FPS * 2)) return;
    const sought = waitForMedia(media, 'seeked');
    media.currentTime = target;
    await sought;
  }

  async function renderCaptureFrame(frame) {
    const nextTime = clamp(frame / FPS, 0, DURATION);
    render(nextTime);
    const jobs = [];
    if (nextTime >= 4.08 && nextTime <= 10.45) jobs.push(seekMedia(heroMotion, nextTime - 4.12));
    if (nextTime >= 9.4 && nextTime <= 14.75) jobs.push(seekMedia(categoryMotion, nextTime - 9.45));
    await Promise.all(jobs);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function loop(now) {
    if (!playing) return;
    const next = (now - startedAt) / 1000;
    if (next >= DURATION) {
      playing = false;
      toggle.textContent = 'Reproduzir';
      render(DURATION);
      return;
    }
    render(next);
    requestAnimationFrame(loop);
  }

  toggle?.addEventListener('click', () => {
    playing = !playing;
    toggle.textContent = playing ? 'Pausar' : 'Reproduzir';
    if (playing) {
      if (time >= DURATION) time = 0;
      startedAt = performance.now() - time * 1000;
      requestAnimationFrame(loop);
    } else syncPreviewMedia(time);
  });
  restart?.addEventListener('click', () => {
    time = 0;
    startedAt = performance.now();
    render(0);
    if (playing) requestAnimationFrame(loop);
  });
  scrubber?.addEventListener('input', (event) => {
    playing = false;
    toggle.textContent = 'Reproduzir';
    render(Number(event.target.value));
  });
  addEventListener('resize', () => render(time));

  render(time);
  window.renderDogChefAlternativeFrame = renderCaptureFrame;
})();
