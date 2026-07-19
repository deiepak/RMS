import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for Web Speech API text-to-speech with queueing
 */
export default function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const queueRef = useRef([]);
  const speakingRef = useRef(false);
  const voicesRef = useRef([]);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Preload voices — Chrome loads them asynchronously
  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [supported]);

  const processQueue = useCallback(() => {
    if (!supported || speakingRef.current || queueRef.current.length === 0) return;

    const { message, options } = queueRef.current.shift();
    speakingRef.current = true;
    setSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = options?.rate || 1.0;
    utterance.pitch = options?.pitch || 1.0;
    utterance.volume = options?.volume || 1.0;
    utterance.lang = options?.lang || 'en-US';

    // Detect if message contains Devanagari script
    const hasDevanagari = /[\u0900-\u097F]/.test(message);

    // Use preloaded voices (fallback to getVoices if ref is empty)
    let voices = voicesRef.current;
    if (!voices || voices.length === 0) {
      voices = window.speechSynthesis.getVoices();
    }

    // Try to find explicitly requested language first
    let match = null;
    
    if (options?.lang) {
      match = voices.find(v => v.lang === options.lang || v.lang.startsWith(options.lang.split('-')[0]));
    }
    
    if (!match) {
      if (hasDevanagari) {
        // If Devanagari script is detected, prefer Nepali or Hindi
        match = voices.find(v => v.lang === 'ne-NP' || v.lang.startsWith('ne')) || 
                voices.find(v => v.lang === 'hi-IN' || v.lang.startsWith('hi'));
      } else {
        // Otherwise, default to English
        match = voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en'));
      }
    }
    
    // Ultimate fallback if nothing else matched
    if (!match && voices.length > 0) {
      match = voices[0];
    }

    if (match) {
      utterance.voice = match;
      utterance.lang = match.lang;
    }

    let timeoutId = null;

    const onFinish = () => {
      if (timeoutId) clearTimeout(timeoutId);
      speakingRef.current = false;
      setSpeaking(false);
      // Process next item in queue
      setTimeout(processQueue, 300); // slight pause between orders
    };

    utterance.onend = onFinish;
    utterance.onerror = onFinish;

    // Prevent garbage collection bug in Chrome
    window._currentUtterance = utterance;

    // Clear any stuck audio before starting
    window.speechSynthesis.cancel();
    
    // In Chrome, calling speak() immediately after cancel() can cause the new utterance to also silently fail/cancel.
    // Adding a tiny delay fixes this race condition.
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
      
      // Fallback: If onend doesn't fire after a reasonable time (15 seconds), reset.
      timeoutId = setTimeout(() => {
        window.speechSynthesis.cancel();
        onFinish();
      }, 15000);
    }, 50);

  }, [supported]);

  const speak = useCallback((message, options = {}) => {
    if (!supported) return;
    
    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
    }

    queueRef.current.push({ message, options });
    processQueue();
  }, [supported, processQueue]);

  return { speak, speaking, supported };
};

