// public/js/views/components/auto-assign/RoutingSummaryHelpers.js
// Pure computational helpers extracted from RoutingSummaryPage.js (P2-F.4u).
// Exposed on `window.RoutingSummaryHelpers` — IIFE+globals convention.

(function() {
  'use strict';

  const _t = (key, params) => typeof i18n !== 'undefined' ? i18n.t(key, params) : key;

  function mergeHints(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a === 'all' || b === 'all') return 'all';
    if (a === b) return a;
    if (a === 'both-panels' || b === 'both-panels') return 'both-panels';
    if ((a === 'summary' && b === 'detail') || (a === 'detail' && b === 'summary')) return 'both-panels';
    return 'all';
  }

  function detectOverlaps(segments) {
    if (!segments || segments.length < 2) return [];
    const overlaps = [];
    for (let a = 0; a < segments.length; a++) {
      for (let b = a + 1; b < segments.length; b++) {
        const rA = segments[a].noteRange;
        const rB = segments[b].noteRange;
        if (!rA || !rB) continue;
        const oMin = Math.max(rA.min, rB.min);
        const oMax = Math.min(rA.max, rB.max);
        if (oMin <= oMax) {
          overlaps.push({ min: oMin, max: oMax, segA: a, segB: b });
        }
      }
    }
    return overlaps;
  }

  function computeSplitCoverageScore({ splitData, analysis, adapt, autoAdaptation }) {
    if (!splitData?.segments?.length) return 0;
    const dist = analysis?.noteDistribution;
    if (!dist) return splitData.quality || 0;
    const semi = (autoAdaptation && adapt?.pitchShift !== 'none')
      ? (adapt?.transpositionSemitones || 0) : 0;
    let covered = 0;
    let total = 0;
    for (const [note, count] of Object.entries(dist)) {
      const shifted = parseInt(note) + semi;
      total += count;
      const inRange = splitData.segments.some(seg => {
        const rMin = seg.noteRange?.min ?? 0;
        const rMax = seg.noteRange?.max ?? 127;
        return shifted >= rMin && shifted <= rMax;
      });
      if (inRange) covered += count;
    }
    return total > 0 ? Math.round((covered / total) * 100) : 0;
  }

  function getCCName(ccNum, cache) {
    if (cache && cache[ccNum] !== undefined) return cache[ccNum];
    let name = `CC ${ccNum}`;
    if (typeof InstrumentSettingsModal !== 'undefined' && InstrumentSettingsModal.CC_GROUPS) {
      for (const group of Object.values(InstrumentSettingsModal.CC_GROUPS)) {
        if (group.ccs && group.ccs[ccNum]) {
          name = group.ccs[ccNum].name;
          break;
        }
      }
    }
    if (cache) cache[ccNum] = name;
    return name;
  }

  function getInstrumentCCs(instrumentId, allInstruments, findInstrumentById) {
    const fullInst = (allInstruments || []).find(i => i.id === instrumentId);
    if (fullInst?.supported_ccs) {
      if (Array.isArray(fullInst.supported_ccs)) return fullInst.supported_ccs;
      try { return JSON.parse(fullInst.supported_ccs || '[]'); } catch { return null; }
    }
    const found = findInstrumentById ? findInstrumentById(instrumentId) : null;
    if (found?.supported_ccs) {
      if (Array.isArray(found.supported_ccs)) return found.supported_ccs;
      try { return JSON.parse(found.supported_ccs || '[]'); } catch { return null; }
    }
    return null;
  }

  function computeCCSummary({
    channel,
    channelAnalyses,
    selectedAssignments,
    splitChannels,
    splitAssignments,
    ccRemapping,
    getInstrumentCCs: resolveCCs
  }) {
    const ch = String(channel);
    const analysis = channelAnalyses[channel];
    const channelCCs = analysis?.usedCCs || [];
    const assignment = selectedAssignments[ch];
    const isSplit = splitChannels.has(channel);
    const currentRemap = ccRemapping[ch] || {};

    if (isSplit && splitAssignments[channel]) {
      const segs = splitAssignments[channel].segments || [];
      const segCCs = segs.map(seg => resolveCCs(seg.instrumentId));
      const allUnknown = segCCs.every(ccs => ccs === null);

      let supportedByAll = 0, unsupportedByAny = 0;
      for (const ccNum of channelCCs) {
        const isDisabled = currentRemap[ccNum] === -1;
        const anyUnsupported = !isDisabled && segCCs.some(ccs => ccs !== null && !ccs.includes(ccNum));
        if (isDisabled || anyUnsupported) unsupportedByAny++;
        else supportedByAll++;
      }

      let summaryHTML;
      if (allUnknown) {
        summaryHTML = `<span class="rs-cc-summary rs-cc-unknown-summary">${_t('routingSummary.ccUnknown') || 'CC non configurés \u2014 supposés tous supportés'}</span>`;
      } else if (unsupportedByAny === 0) {
        summaryHTML = `<span class="rs-cc-summary rs-cc-ok-summary">\u2713 ${_t('routingSummary.ccAllSupported') || 'Tous les CC supportés'} (${supportedByAll})</span>`;
      } else {
        summaryHTML = `<span class="rs-cc-summary rs-cc-warn-summary">${supportedByAll}/${channelCCs.length} ${_t('routingSummary.ccSupported') || 'CC supportés'} \u2014 ${unsupportedByAny} ${_t('routingSummary.ccUnsupported') || 'non supportés'}</span>`;
      }
      return { summaryHTML, supportedCount: supportedByAll, unsupportedCount: unsupportedByAny, allUnknown };
    }

    let instrumentCCs = assignment?.supportedCcs ?? null;
    if (instrumentCCs && typeof instrumentCCs === 'string') {
      try { instrumentCCs = JSON.parse(instrumentCCs); } catch { instrumentCCs = null; }
    }
    if (instrumentCCs == null && assignment?.instrumentId) {
      instrumentCCs = resolveCCs(assignment.instrumentId);
    }

    let supportedCount = 0, unsupportedCount = 0;
    for (const ccNum of channelCCs) {
      const isDisabled = currentRemap[ccNum] === -1;
      if (isDisabled) { unsupportedCount++; }
      else if (instrumentCCs === null || instrumentCCs.includes(ccNum)) { supportedCount++; }
      else { unsupportedCount++; }
    }

    let summaryHTML;
    if (instrumentCCs === null) {
      summaryHTML = `<span class="rs-cc-summary rs-cc-unknown-summary">${_t('routingSummary.ccUnknown') || 'CC non configurés \u2014 supposés tous supportés'}</span>`;
    } else if (unsupportedCount === 0) {
      summaryHTML = `<span class="rs-cc-summary rs-cc-ok-summary">\u2713 ${_t('routingSummary.ccAllSupported') || 'Tous les CC supportés'} (${supportedCount})</span>`;
    } else {
      summaryHTML = `<span class="rs-cc-summary rs-cc-warn-summary">${supportedCount}/${channelCCs.length} ${_t('routingSummary.ccSupported') || 'CC supportés'} \u2014 ${unsupportedCount} ${_t('routingSummary.ccUnsupported') || 'non supportés'}</span>`;
    }
    return { summaryHTML, supportedCount, unsupportedCount, allUnknown: instrumentCCs === null };
  }

  window.RoutingSummaryHelpers = Object.freeze({
    mergeHints,
    detectOverlaps,
    computeSplitCoverageScore,
    getCCName,
    getInstrumentCCs,
    computeCCSummary
  });
})();
