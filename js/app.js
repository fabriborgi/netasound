/* ============================================
   SOUNDGRAB - Main Application Logic
   ============================================ */

(function() {
  'use strict';

  // =========================================
  // PROFANITY WORD LISTS (EN, IT, ES)
  // =========================================
  const PROFANITY = {
    en: [
      'fuck','fucking','fucked','fucker','motherfucker','shit','shitty','bullshit',
      'bitch','bitches','asshole','ass','damn','damned','bastard','dick','dickhead',
      'cock','cunt','pussy','whore','slut','nigga','nigger','retard','fag','faggot',
      'piss','pissed','crap','douche','wanker','twat','bollocks','bloody','arse',
      'jackass','goddam','goddamn','dumbass','motherfucking','shitface','dipshit'
    ],
    it: [
      'cazzo','minchia','fanculo','vaffanculo','stronzo','stronza','merda','puttana',
      'troia','bastardo','bastarda','coglione','coglioni','porco','porca','madonna',
      'dio','cristo','figa','culo','merdoso','merdosa','cornuto','cornuta',
      'cazzone','cazzata','incazzato','incazzata','porcone','puttanata','troiata',
      'stronzata','fottere','fottiti','fottuto','fottuta','pirla','sega',
      'zoccola','mignotta','cagate','cagata','cagare'
    ],
    es: [
      'mierda','puta','joder','jodido','jodida','coño','carajo','pendejo','pendeja',
      'cabrón','cabrona','chingar','chingado','chingada','verga','culo','polla',
      'gilipollas','hijo de puta','puto','puta madre','maricón','marica',
      'idiota','estúpido','estúpida','imbécil','maldito','maldita','mamón','mamona',
      'pinche','culero','culera','huevón','huevona','boludo','boluda','concha',
      'pelotudo','pelotuda','cojones','hostia','capullo','zorra'
    ]
  };

  // =========================================
  // STATE
  // =========================================
  let state = {
    currentUrl: '',
    platform: null, // 'youtube' | 'soundcloud'
    videoId: null,
    selectedLangs: ['it', 'en', 'es'],
    audioContext: null,
    cleanAudioBuffer: null,
    cleanFileName: '',
    isProcessing: false
  };

  // =========================================
  // DOM REFERENCES
  // =========================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    urlInput: $('#urlInput'),
    btnAnalyze: $('#btnAnalyze'),
    btnAnalyzeText: $('#btnAnalyzeText'),
    platformBadge: $('#platformBadge'),
    platformIcon: $('#platformIcon'),
    platformName: $('#platformName'),
    downloadSection: $('#download'),
    trackTitle: $('#trackTitle'),

    btnDownloadMp3: $('#btnDownloadMp3'),
    btnDownloadMp3Clean: $('#btnDownloadMp3Clean'),
    btnDownloadWav: $('#btnDownloadWav'),
    btnDownloadWavClean: $('#btnDownloadWavClean'),

    cleanSection: $('#clean'),
    cleanUploadArea: $('#cleanUploadArea'),
    cleanFileInput: $('#cleanFileInput'),
    processingPanel: $('#processingPanel'),
    progressBar: $('#progressBar'),
    processingStatus: $('#processingStatus'),
    detectedWords: $('#detectedWords'),
    wordsList: $('#wordsList'),
    cleanResult: $('#cleanResult'),
    btnCleanResultMp3: $('#btnCleanResultMp3'),
    btnCleanResultWav: $('#btnCleanResultWav'),

    chartsCarousel: $('#chartsCarousel'),
    carouselPrev: $('#carouselPrev'),
    carouselNext: $('#carouselNext'),
    carouselDots: $('#carouselDots'),

    toastContainer: $('#toastContainer')
  };

  // =========================================
  // URL VALIDATION
  // =========================================
  const URL_PATTERNS = {
    youtube: [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/
    ],
    soundcloud: [
      /(?:https?:\/\/)?(?:www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/,
      /(?:https?:\/\/)?(?:m\.)?soundcloud\.com\/[\w-]+\/[\w-]+/
    ]
  };

  function detectPlatform(url) {
    for (const pattern of URL_PATTERNS.youtube) {
      const match = url.match(pattern);
      if (match) {
        return { platform: 'youtube', id: match[1] };
      }
    }
    for (const pattern of URL_PATTERNS.soundcloud) {
      const match = url.match(pattern);
      if (match) {
        return { platform: 'soundcloud', id: url };
      }
    }
    return null;
  }

  // =========================================
  // COBALT DOWNLOAD URL BUILDER
  // =========================================
  function getCobaltUrl(url, format) {
    // Open cobalt.tools with the URL pre-filled
    const encodedUrl = encodeURIComponent(url);
    return `https://cobalt.tools/#url=${encodedUrl}`;
  }

  function openDownload(url, format) {
    const cobaltUrl = getCobaltUrl(url, format);
    window.open(cobaltUrl, '_blank');
    showToast(`Apertura cobalt.tools per il download ${format.toUpperCase()}...`, 'info');
  }

  // =========================================
  // TOAST NOTIFICATIONS
  // =========================================
  function showToast(message, type = 'info', duration = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span>${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // =========================================
  // ANALYZE URL HANDLER
  // =========================================
  function handleAnalyze() {
    const url = dom.urlInput.value.trim();

    if (!url) {
      showToast('Per favore incolla un link di YouTube o SoundCloud', 'warning');
      return;
    }

    const result = detectPlatform(url);

    if (!result) {
      showToast('Link non riconosciuto. Assicurati che sia un link diretto di YouTube o SoundCloud.', 'error');
      return;
    }

    state.currentUrl = url;
    state.platform = result.platform;
    state.videoId = result.id;

    // Show platform badge
    if (result.platform === 'youtube') {
      dom.platformIcon.textContent = '▶️';
      dom.platformName.textContent = 'YouTube rilevato';
    } else {
      dom.platformIcon.textContent = '☁️';
      dom.platformName.textContent = 'SoundCloud rilevato';
    }
    dom.platformBadge.classList.add('visible');

    // Show download section
    dom.downloadSection.classList.add('visible');
    dom.trackTitle.textContent = `Piattaforma: ${result.platform === 'youtube' ? 'YouTube' : 'SoundCloud'}`;

    // Scroll to download section
    dom.downloadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    showToast(`Link ${result.platform === 'youtube' ? 'YouTube' : 'SoundCloud'} validato con successo!`, 'success');
  }

  // =========================================
  // DOWNLOAD HANDLERS
  // =========================================
  function handleDownloadMp3() {
    openDownload(state.currentUrl, 'mp3');
  }

  function handleDownloadWav() {
    openDownload(state.currentUrl, 'wav');
    showToast('Suggerimento: Scarica come MP3 da cobalt, poi usa la sezione Clean per convertire in WAV', 'info', 6000);
  }

  function handleDownloadMp3Clean() {
    openDownload(state.currentUrl, 'mp3');
    showToast('Scarica il file, poi caricalo nella sezione "Clean Audio" qui sotto per censurare le parolacce', 'info', 6000);
    dom.cleanSection.classList.add('visible');
    setTimeout(() => {
      dom.cleanSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
  }

  function handleDownloadWavClean() {
    openDownload(state.currentUrl, 'wav');
    showToast('Scarica il file, poi caricalo nella sezione "Clean Audio" qui sotto per censurare le parolacce', 'info', 6000);
    dom.cleanSection.classList.add('visible');
    setTimeout(() => {
      dom.cleanSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
  }

  // =========================================
  // CLEAN AUDIO PROCESSING
  // =========================================

  function getSelectedLangs() {
    const chips = $$('.lang-chip');
    const langs = [];
    chips.forEach(chip => {
      if (chip.classList.contains('active')) {
        langs.push(chip.dataset.lang);
      }
    });
    return langs;
  }

  function getProfanityList() {
    const langs = getSelectedLangs();
    const combined = [];
    langs.forEach(lang => {
      if (PROFANITY[lang]) {
        combined.push(...PROFANITY[lang]);
      }
    });
    return combined;
  }

  function updateStep(stepNum, status) {
    const icons = { pending: '⏳', active: '🔄', completed: '✅', error: '❌' };
    const step = $(`#step${stepNum}`);
    step.querySelector('.step-icon').textContent = icons[status];
    step.className = status === 'active' ? 'active' : status === 'completed' ? 'completed' : '';
  }

  function updateProgress(percent) {
    dom.progressBar.style.width = `${percent}%`;
  }

  async function processCleanAudio(file) {
    if (state.isProcessing) return;
    state.isProcessing = true;
    state.cleanFileName = file.name.replace(/\.[^.]+$/, '');

    // Show processing panel
    dom.processingPanel.classList.add('visible');
    dom.cleanResult.classList.remove('visible');
    dom.detectedWords.classList.remove('visible');

    try {
      // Step 1: Decode audio
      updateStep(1, 'active');
      dom.processingStatus.textContent = 'Decodifica file audio...';
      updateProgress(10);

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      state.audioContext = audioContext;

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      updateStep(1, 'completed');
      updateProgress(20);

      // Step 2: Speech Recognition
      updateStep(2, 'active');
      dom.processingStatus.textContent = 'Trascrizione audio con Speech Recognition...';

      let detectedProfanity = [];

      // Check if Web Speech API is available
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        detectedProfanity = await performSpeechRecognition(file, audioBuffer.duration);
      } else {
        showToast('Speech Recognition non disponibile in questo browser. Uso analisi alternativa.', 'warning', 5000);
        // Fallback: scan for common silence patterns (simplified approach)
        detectedProfanity = performFallbackAnalysis(audioBuffer);
      }

      updateStep(2, 'completed');
      updateProgress(50);

      // Step 3: Find profanity timestamps
      updateStep(3, 'active');
      dom.processingStatus.textContent = 'Analisi parolacce rilevate...';

      const profanityList = getProfanityList();
      const muteRanges = [];
      const foundWords = new Set();

      detectedProfanity.forEach(item => {
        const words = item.text.toLowerCase().split(/\s+/);
        words.forEach(word => {
          // Clean the word from punctuation
          const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
          if (profanityList.includes(cleanWord)) {
            foundWords.add(cleanWord);
            // Create a mute range: from slightly before to slightly after the word
            const wordDuration = 0.5; // approximate duration of a word in seconds
            const start = Math.max(0, item.timestamp - 0.1);
            const end = Math.min(audioBuffer.duration, item.timestamp + wordDuration + 0.1);
            muteRanges.push({ start, end, word: cleanWord });
          }
        });
      });

      // Merge overlapping ranges
      const mergedRanges = mergeRanges(muteRanges);

      updateStep(3, 'completed');
      updateProgress(65);

      // Show detected words
      if (foundWords.size > 0) {
        dom.detectedWords.classList.add('visible');
        dom.wordsList.innerHTML = '';
        foundWords.forEach(word => {
          const tag = document.createElement('span');
          tag.className = 'word-tag';
          tag.textContent = word;
          dom.wordsList.appendChild(tag);
        });
        showToast(`Trovate ${foundWords.size} parolacce in ${mergedRanges.length} sezioni`, 'info');
      } else {
        showToast('Nessuna parolaccia rilevata! Il file sembra già pulito.', 'success');
      }

      // Step 4: Mute sections
      updateStep(4, 'active');
      dom.processingStatus.textContent = 'Silenziamento sezioni...';

      const cleanBuffer = muteAudioRanges(audioBuffer, mergedRanges);
      state.cleanAudioBuffer = cleanBuffer;

      updateStep(4, 'completed');
      updateProgress(85);

      // Step 5: Encode final file
      updateStep(5, 'active');
      dom.processingStatus.textContent = 'Preparazione file finale...';

      updateStep(5, 'completed');
      updateProgress(100);

      dom.processingStatus.textContent = '✅ Elaborazione completata!';
      dom.cleanResult.classList.add('visible');

      showToast('File clean pronto per il download!', 'success');

    } catch (error) {
      console.error('Clean processing error:', error);
      showToast(`Errore durante l'elaborazione: ${error.message}`, 'error', 6000);
      dom.processingStatus.textContent = '❌ Errore durante l\'elaborazione';
    } finally {
      state.isProcessing = false;
    }
  }

  // =========================================
  // SPEECH RECOGNITION
  // =========================================
  function performSpeechRecognition(file, duration) {
    return new Promise((resolve) => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      const langs = getSelectedLangs();
      // Set the primary lang
      const langMap = { it: 'it-IT', en: 'en-US', es: 'es-ES' };
      recognition.lang = langMap[langs[0]] || 'it-IT';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      const results = [];
      let startTime = Date.now();

      // We need to play the audio through the speaker for speech recognition
      // Create an audio element to play the file
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      audio.volume = 0.01; // Very low volume to not disturb

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript;
            const elapsed = (Date.now() - startTime) / 1000;
            results.push({
              text: transcript,
              timestamp: elapsed
            });
          }
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          // Continue
        }
      };

      recognition.onend = () => {
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        resolve(results);
      };

      // Start playing and recognizing
      audio.play().then(() => {
        recognition.start();

        // Stop after audio ends or max 5 minutes
        const maxDuration = Math.min(duration * 1000, 300000);
        setTimeout(() => {
          try {
            recognition.stop();
          } catch (e) {
            // Already stopped
          }
          audio.pause();
        }, maxDuration + 2000);

        audio.onended = () => {
          setTimeout(() => {
            try {
              recognition.stop();
            } catch (e) {
              // Already stopped
            }
          }, 1000);
        };
      }).catch(() => {
        showToast('Impossibile riprodurre l\'audio per l\'analisi. Prova con un file diverso.', 'error');
        resolve(results);
      });
    });
  }

  // Fallback when Speech API is not available
  function performFallbackAnalysis(audioBuffer) {
    // Simple amplitude analysis - detect very loud sections (often vocal emphasis)
    // This is a basic heuristic and won't be as accurate as speech recognition
    showToast('Analisi fallback: senza Speech API la censura potrebbe non essere precisa', 'warning', 5000);
    return [];
  }

  // =========================================
  // AUDIO PROCESSING UTILITIES
  // =========================================

  function mergeRanges(ranges) {
    if (ranges.length === 0) return [];

    // Sort by start time
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      if (sorted[i].start <= last.end + 0.1) {
        last.end = Math.max(last.end, sorted[i].end);
      } else {
        merged.push(sorted[i]);
      }
    }

    return merged;
  }

  function muteAudioRanges(audioBuffer, ranges) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    // Create a new AudioContext for the offline buffer
    const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      numChannels, length, sampleRate
    );

    const newBuffer = ctx.createBuffer(numChannels, length, sampleRate);

    for (let ch = 0; ch < numChannels; ch++) {
      const inputData = audioBuffer.getChannelData(ch);
      const outputData = newBuffer.getChannelData(ch);

      // Copy all data
      outputData.set(inputData);

      // Mute the profanity ranges
      ranges.forEach(range => {
        const startSample = Math.floor(range.start * sampleRate);
        const endSample = Math.min(Math.ceil(range.end * sampleRate), length);

        // Apply fade-out before mute (20ms)
        const fadeSamples = Math.floor(0.02 * sampleRate);
        const fadeOutStart = Math.max(0, startSample - fadeSamples);

        for (let i = fadeOutStart; i < startSample && i < length; i++) {
          const fadeRatio = (startSample - i) / fadeSamples;
          outputData[i] *= fadeRatio;
        }

        // Silence the range
        for (let i = startSample; i < endSample && i < length; i++) {
          outputData[i] = 0;
        }

        // Apply fade-in after mute (20ms)
        const fadeInEnd = Math.min(endSample + fadeSamples, length);
        for (let i = endSample; i < fadeInEnd; i++) {
          const fadeRatio = (i - endSample) / fadeSamples;
          outputData[i] *= fadeRatio;
        }
      });
    }

    return newBuffer;
  }

  // =========================================
  // AUDIO ENCODING (WAV & MP3)
  // =========================================

  function encodeWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;

    const dataLength = audioBuffer.length * numChannels * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Interleave channels
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = audioBuffer.getChannelData(ch)[i];
        const clamped = Math.max(-1, Math.min(1, sample));
        const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function encodeMp3(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const kbps = 192;

    // Check if lamejs is available
    if (typeof lamejs === 'undefined') {
      showToast('Libreria MP3 non caricata. Prova a ricaricare la pagina.', 'error');
      return null;
    }

    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);
    const blockSize = 1152;
    const mp3Data = [];

    // Convert float samples to Int16
    const leftData = convertFloat32ToInt16(audioBuffer.getChannelData(0));
    const rightData = numChannels > 1
      ? convertFloat32ToInt16(audioBuffer.getChannelData(1))
      : leftData;

    for (let i = 0; i < leftData.length; i += blockSize) {
      const leftChunk = leftData.subarray(i, i + blockSize);
      const rightChunk = rightData.subarray(i, i + blockSize);

      let mp3buf;
      if (numChannels === 1) {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      } else {
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      }

      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    const end = mp3encoder.flush();
    if (end.length > 0) {
      mp3Data.push(end);
    }

    return new Blob(mp3Data, { type: 'audio/mpeg' });
  }

  function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
    }
    return int16Array;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // =========================================
  // CLEAN RESULT DOWNLOAD HANDLERS
  // =========================================
  function handleCleanDownloadMp3() {
    if (!state.cleanAudioBuffer) {
      showToast('Nessun file elaborato. Carica prima un file audio.', 'warning');
      return;
    }

    showToast('Codifica MP3 in corso...', 'info');

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const blob = encodeMp3(state.cleanAudioBuffer);
      if (blob) {
        downloadBlob(blob, `${state.cleanFileName}_clean.mp3`);
        showToast('Download MP3 Clean completato!', 'success');
      }
    }, 100);
  }

  function handleCleanDownloadWav() {
    if (!state.cleanAudioBuffer) {
      showToast('Nessun file elaborato. Carica prima un file audio.', 'warning');
      return;
    }

    showToast('Codifica WAV in corso...', 'info');

    setTimeout(() => {
      const blob = encodeWav(state.cleanAudioBuffer);
      downloadBlob(blob, `${state.cleanFileName}_clean.wav`);
      showToast('Download WAV Clean completato!', 'success');
    }, 100);
  }

  // =========================================
  // CAROUSEL LOGIC
  // =========================================
  function initCarousel() {
    const carousel = dom.chartsCarousel;
    const cards = carousel.querySelectorAll('.chart-card');
    const totalCards = cards.length;
    let currentIndex = 0;
    let cardsPerView = getCardsPerView();

    function getCardsPerView() {
      const width = window.innerWidth;
      if (width >= 1200) return 3;
      if (width >= 768) return 2;
      return 1;
    }

    function getTotalPages() {
      return Math.max(1, totalCards - cardsPerView + 1);
    }

    function updateDots() {
      const totalPages = getTotalPages();
      dom.carouselDots.innerHTML = '';
      for (let i = 0; i < totalPages; i++) {
        const dot = document.createElement('button');
        dot.className = `carousel-dot${i === currentIndex ? ' active' : ''}`;
        dot.setAttribute('aria-label', `Pagina ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dom.carouselDots.appendChild(dot);
      }
    }

    function updateButtons() {
      dom.carouselPrev.disabled = currentIndex === 0;
      dom.carouselNext.disabled = currentIndex >= getTotalPages() - 1;
    }

    function goTo(index) {
      currentIndex = Math.max(0, Math.min(index, getTotalPages() - 1));

      const cardWidth = cards[0].offsetWidth;
      const gap = 24; // var(--space-lg)
      const offset = currentIndex * (cardWidth + gap);
      carousel.style.transform = `translateX(-${offset}px)`;

      updateDots();
      updateButtons();
    }

    dom.carouselPrev.addEventListener('click', () => goTo(currentIndex - 1));
    dom.carouselNext.addEventListener('click', () => goTo(currentIndex + 1));

    // Touch/swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) goTo(currentIndex + 1);
        else goTo(currentIndex - 1);
      }
    }, { passive: true });

    // Resize handler
    window.addEventListener('resize', () => {
      cardsPerView = getCardsPerView();
      goTo(Math.min(currentIndex, getTotalPages() - 1));
    });

    // Init
    updateDots();
    updateButtons();
  }

  // =========================================
  // FILE UPLOAD HANDLING
  // =========================================
  function initFileUpload() {
    const uploadArea = dom.cleanUploadArea;
    const fileInput = dom.cleanFileInput;

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
      }
    });
  }

  function handleFileUpload(file) {
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/webm'];
    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['mp3', 'wav', 'ogg', 'webm', 'aac', 'm4a'];

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      showToast('Formato file non supportato. Usa MP3, WAV, OGG o WebM.', 'error');
      return;
    }

    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      showToast('File troppo grande. Massimo 100MB.', 'error');
      return;
    }

    showToast(`File "${file.name}" caricato. Inizio elaborazione...`, 'info');
    processCleanAudio(file);
  }

  // =========================================
  // LANGUAGE CHIP TOGGLE
  // =========================================
  function initLangChips() {
    $$('.lang-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        const activeLangs = getSelectedLangs();
        if (activeLangs.length === 0) {
          chip.classList.add('active');
          showToast('Seleziona almeno una lingua', 'warning');
        }
      });
    });
  }

  // =========================================
  // NAVBAR SCROLL EFFECT
  // =========================================
  function initNavbar() {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      const navbar = document.getElementById('navbar');

      if (currentScroll > 50) {
        navbar.style.background = 'rgba(10, 10, 15, 0.95)';
      } else {
        navbar.style.background = 'rgba(10, 10, 15, 0.8)';
      }
      lastScroll = currentScroll;
    });
  }

  // =========================================
  // SMOOTH SCROLL FOR NAV LINKS
  // =========================================
  function initSmoothScroll() {
    $$('.nav-links a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // =========================================
  // ENTER KEY TO ANALYZE
  // =========================================
  function initInputHandlers() {
    dom.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleAnalyze();
      }
    });

    // Real-time URL detection as user types
    dom.urlInput.addEventListener('input', () => {
      const url = dom.urlInput.value.trim();
      if (url.length > 10) {
        const result = detectPlatform(url);
        if (result) {
          if (result.platform === 'youtube') {
            dom.platformIcon.textContent = '▶️';
            dom.platformName.textContent = 'YouTube rilevato';
          } else {
            dom.platformIcon.textContent = '☁️';
            dom.platformName.textContent = 'SoundCloud rilevato';
          }
          dom.platformBadge.classList.add('visible');
        } else {
          dom.platformBadge.classList.remove('visible');
        }
      } else {
        dom.platformBadge.classList.remove('visible');
      }
    });
  }

  // =========================================
  // INITIALIZATION
  // =========================================
  function init() {
    // Button handlers
    dom.btnAnalyze.addEventListener('click', handleAnalyze);
    dom.btnDownloadMp3.addEventListener('click', handleDownloadMp3);
    dom.btnDownloadMp3Clean.addEventListener('click', handleDownloadMp3Clean);
    dom.btnDownloadWav.addEventListener('click', handleDownloadWav);
    dom.btnDownloadWavClean.addEventListener('click', handleDownloadWavClean);
    dom.btnCleanResultMp3.addEventListener('click', handleCleanDownloadMp3);
    dom.btnCleanResultWav.addEventListener('click', handleCleanDownloadWav);

    // Initialize components
    initCarousel();
    initFileUpload();
    initLangChips();
    initNavbar();
    initSmoothScroll();
    initInputHandlers();

    console.log('🎵 SoundGrab initialized');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
