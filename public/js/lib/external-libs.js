/**
 * External Libraries Configuration
 * Links to proven MIDI/Audio libraries from GitHub
 */

window.ExternalLibs = {
    // WebMidi.js - Modern MIDI access in browser
    // https://github.com/djipco/webmidi
    webmidi: {
        cdn: 'https://cdn.jsdelivr.net/npm/webmidi@latest/dist/iife/webmidi.iife.js',
        npm: 'webmidi@3.1.11',
        version: '3.1.11'
    },

    // Tone.js - Web Audio framework
    // https://github.com/Tonejs/Tone.js
    tonejs: {
        cdn: 'https://cdn.jsdelivr.net/npm/tone@latest/build/Tone.js',
        npm: 'tone@14.7.77',
        version: '14.7.77'
    },

    // MIDI Parser - Parse MIDI files
    // https://github.com/colxi/midi-parser-js
    midiParser: {
        cdn: 'https://cdn.jsdelivr.net/npm/midi-parser-js@4.0.4/src/main.js',
        npm: 'midi-parser-js@4.0.4',
        version: '4.0.4'
    },

    // JZZ - MIDI library for Node.js and browsers
    // https://github.com/jazz-soft/JZZ
    jzz: {
        cdn: 'https://cdn.jsdelivr.net/npm/jzz@1.7.5/javascript/JZZ.js',
        npm: 'jzz@1.7.5',
        version: '1.7.5'
    },

    // WebAudio Piano Roll (g200kg)
    // https://github.com/g200kg/webaudio-pianoroll
    pianoroll: {
        cdn: 'https://cdn.jsdelivr.net/npm/webaudio-pianoroll@1.0.8/webaudio-pianoroll.js',
        css: 'https://cdn.jsdelivr.net/npm/webaudio-pianoroll@1.0.8/webaudio-pianoroll.css',
        npm: 'webaudio-pianoroll@1.0.8',
        version: '1.0.8'
    },

    // WebAudio Controls (g200kg)
    // https://github.com/g200kg/webaudio-controls
    controls: {
        cdn: 'https://cdn.jsdelivr.net/npm/webaudio-controls@latest/webaudio-controls.js',
        css: 'https://cdn.jsdelivr.net/npm/webaudio-controls@latest/webaudio-controls.css',
        npm: 'webaudio-controls@3.4.0',
        version: '3.4.0'
    }
};

/**
 * Load external library from CDN
 */
function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Load CSS from CDN
 */
function loadCSS(url) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
    });
}

/**
 * Initialize all external libraries
 */
window.initExternalLibs = async function() {
    console.log('🔧 Loading external MIDI libraries from GitHub...');

    try {
        // Load WebMidi.js
        console.log('Loading WebMidi.js...');
        await loadScript(ExternalLibs.webmidi.cdn);
        console.log('✅ WebMidi.js loaded');

        // Load Tone.js
        console.log('Loading Tone.js...');
        await loadScript(ExternalLibs.tonejs.cdn);
        console.log('✅ Tone.js loaded');

        // Load JZZ (fallback MIDI library)
        console.log('Loading JZZ...');
        await loadScript(ExternalLibs.jzz.cdn);
        console.log('✅ JZZ loaded');

        // Load WebAudio Controls (knobs, faders, etc.)
        console.log('Loading WebAudio Controls...');
        await Promise.all([
            loadScript(ExternalLibs.controls.cdn),
            loadCSS(ExternalLibs.controls.css)
        ]);
        console.log('✅ WebAudio Controls loaded');

        // Load WebAudio Piano Roll
        console.log('Loading WebAudio Piano Roll...');
        await Promise.all([
            loadScript(ExternalLibs.pianoroll.cdn),
            loadCSS(ExternalLibs.pianoroll.css)
        ]);
        console.log('✅ WebAudio Piano Roll loaded');

        console.log('✅ All external libraries loaded successfully');
        return true;

    } catch (error) {
        console.error('❌ Error loading external libraries:', error);
        throw error;
    }
};
