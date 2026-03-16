#!/usr/bin/env node
/**
 * Fix missing translations in all locale files.
 * Reference: en.json (706 lines, complete)
 * 26 locales missing 116 keys each.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'public', 'locales');

// --- Translations for missing keys per language ---
const translations = {
  de: {
    common: { unknown: "Unbekannt", unknownError: "Unbekannter Fehler" },
    settings: { calibrationButton: { title: "Mikrofon-Kalibrierungsknopf", enable: "Kalibrierungsknopf anzeigen", description: "Zeigt den Mikrofonknopf zur Kalibrierung der Audioverzögerung für Instrumente" } },
    instrumentManagement: {
      title: "Instrumentenverwaltung", subtitle: "Konfigurieren, organisieren und verwalten Sie alle Ihre MIDI-Instrumente",
      searchPlaceholder: "Instrumente suchen...", filterAll: "Alle Instrumente", filterComplete: "Nur vollständige",
      filterIncomplete: "Nur unvollständige", filterConnected: "Nur verbundene", refresh: "Aktualisieren",
      noInstruments: "Keine Instrumente gefunden", adjustFilter: "Versuchen Sie, Ihre Suche oder Filter anzupassen",
      scanToStart: "Scannen Sie nach Geräten, um zu beginnen", connectedInstruments: "Verbundene Instrumente",
      disconnectedInstruments: "Getrennte Instrumente", complete: "VOLLSTÄNDIG", incomplete: "UNVOLLSTÄNDIG",
      gmProgram: "GM-Programm", gmProgramNotSet: "GM-Programm nicht festgelegt", range: "Bereich",
      rangeNotSet: "Notenbereich nicht festgelegt", polyphony: "Polyphonie", polyphonyNotSet: "Polyphonie nicht festgelegt",
      edit: "Bearbeiten", test: "Testen", completeBtn: "Vervollständigen", instrumentsTotal: "Instrumente gesamt",
      connectedCount: "verbunden", completeCount: "vollständig", incompleteCount: "unvollständig",
      settingsNotAvailable: "Instrumenteneinstellungen nicht verfügbar. Stellen Sie sicher, dass das Modul geladen ist.",
      testNoteSent: "Testnote gesendet! (C4 - Mittleres C)", testNoteFailed: "Testnote konnte nicht gesendet werden",
      deleteConfirm: "Sind Sie sicher, dass Sie dieses Instrument aus der Datenbank entfernen möchten?\n\nHinweis: Das physische Gerät wird nicht beeinflusst.",
      deleteFailed: "Instrument konnte nicht gelöscht werden", scanFailed: "Scan fehlgeschlagen",
      bluetoothNotAvailable: "Bluetooth-Scan nicht verfügbar", networkNotAvailable: "Netzwerk-Scan nicht verfügbar", retry: "Erneut versuchen"
    },
    autoAssign: {
      title: "Kanäle automatisch zuordnen", analyzing: "MIDI-Datei wird analysiert und Instrumente werden zugeordnet...",
      error: "Auto-Zuordnungsfehler", generateFailed: "Auto-Zuordnung konnte nicht generiert werden",
      confidenceScore: "Vertrauenswert", instructions: "Wählen Sie das Instrument für jeden Kanal. Die beste Übereinstimmung ist vorausgewählt.",
      channel: "Kanal", drums: "Schlagzeug", noCompatible: "Keine kompatiblen Instrumente gefunden",
      channelSkipped: "Kanal übersprungen", assignChannel: "Kanal zuordnen", recommended: "Empfohlen",
      noTransposition: "Keine Transposition erforderlich", enableOctaveWrapping: "Oktavumbruch aktivieren",
      previewOriginal: "Original vorhören", previewOriginalTip: "Die originale MIDI-Datei vorhören",
      previewAdapted: "Angepasst vorhören", previewAdaptedTip: "Die angepasste Version mit Transposition vorhören",
      stop: "Stopp", quickAssign: "Schnellzuordnung", quickAssignTip: "Alle Kanäle automatisch mit bester Übereinstimmung zuordnen",
      apply: "Anwenden", noAssignments: "Keine Zuordnungen anzuwenden", applying: "Zuordnungen werden angewendet...",
      applySuccess: "Auto-Zuordnung erfolgreich angewendet!", applyFailed: "Auto-Zuordnung konnte nicht angewendet werden",
      quickAssignConfirm: "Schnellzuordnung wählt automatisch das beste Instrument für jeden Kanal. Fortfahren?",
      previewNotAvailable: "Vorschau nicht verfügbar", previewFailed: "Vorschau fehlgeschlagen",
      noteRange: "Notenbereich", polyphony: "Polyphonie", type: "Typ", range: "Bereich",
      noActiveChannels: "Keine aktiven Kanäle in dieser MIDI-Datei", skippedLabel: "ÜBERSPRUNGEN",
      skippedCount: "{count} Kanal/Kanäle übersprungen", notesTransposed: "Note(n) transponiert",
      channelsSkipped: "Kanal/Kanäle übersprungen", channelsWillBeAssigned: "{active} von {total} Kanälen werden zugeordnet"
    },
    instrumentCapabilities: {
      title: "Instrumentenfähigkeiten vervollständigen", subtitle: "Einige Instrumente haben fehlende Informationen für die optimale Auto-Zuordnung. Bitte füllen Sie die erforderlichen Felder aus.",
      progress: "Instrument {current} von {total}", skip: "Überspringen", previous: "Zurück", next: "Weiter",
      complete: "Abschließen", type: "Typ", manufacturer: "Hersteller", requiredFields: "Erforderliche Felder",
      recommendedFields: "Empfohlene Felder", recommendedHint: "Diese Felder verbessern die Auto-Zuordnung, sind aber nicht erforderlich.",
      select: "Auswählen", noteSelectionRange: "Bereich (melodische Instrumente)", noteSelectionDiscrete: "Diskret (Drums, Pads)",
      typeKeyboard: "Keyboard / Klavier", typeSynth: "Synthesizer", typeDrums: "Schlagzeug / Perkussion",
      typeBass: "Bass", typeGuitar: "Gitarre", typeStrings: "Streicher", typeBrass: "Blechbläser",
      typeWoodwind: "Holzbläser", typePad: "Pad / Atmosphäre", typeSampler: "Sampler", typeOther: "Andere",
      noteArrayPlaceholder: "MIDI-Notennummern durch Kommas getrennt eingeben (z.B. 36, 38, 42, 46, 48)",
      commonDrums: "Übliche Drums: 36 (Kick), 38 (Snare), 42 (Closed HH), 46 (Open HH), 48 (Tom1), 50 (Tom2)",
      optional: "optional", applyDefaults: "Vorgeschlagene Standardwerte anwenden", openFullSettings: "Vollständige Instrumenteneinstellungen öffnen",
      fullSettingsHint: "Zugang zu erweiterten Einstellungen, Latenz und mehr", defaultsFailed: "Vorgeschlagene Standardwerte konnten nicht geladen werden",
      saveFailed: "Instrumentenfähigkeiten konnten nicht gespeichert werden", fullSettingsComingSoon: "Vollständige Instrumenteneinstellungen kommen bald!"
    }
  },
  es: {
    common: { unknown: "Desconocido", unknownError: "Error desconocido" },
    settings: { calibrationButton: { title: "Botón de calibración con micrófono", enable: "Mostrar botón de calibración", description: "Muestra el botón del micrófono para calibrar los retrasos de audio de los instrumentos" } },
    instrumentManagement: {
      title: "Gestión de instrumentos", subtitle: "Configure, organice y gestione todos sus instrumentos MIDI",
      searchPlaceholder: "Buscar instrumentos...", filterAll: "Todos los instrumentos", filterComplete: "Solo completos",
      filterIncomplete: "Solo incompletos", filterConnected: "Solo conectados", refresh: "Actualizar",
      noInstruments: "No se encontraron instrumentos", adjustFilter: "Intente ajustar su búsqueda o filtro",
      scanToStart: "Escanee dispositivos para comenzar", connectedInstruments: "Instrumentos conectados",
      disconnectedInstruments: "Instrumentos desconectados", complete: "COMPLETO", incomplete: "INCOMPLETO",
      gmProgram: "Programa GM", gmProgramNotSet: "Programa GM no definido", range: "Rango",
      rangeNotSet: "Rango de notas no definido", polyphony: "Polifonía", polyphonyNotSet: "Polifonía no definida",
      edit: "Editar", test: "Probar", completeBtn: "Completar", instrumentsTotal: "instrumentos en total",
      connectedCount: "conectados", completeCount: "completos", incompleteCount: "incompletos",
      settingsNotAvailable: "Configuración del instrumento no disponible. Asegúrese de que el módulo esté cargado.",
      testNoteSent: "¡Nota de prueba enviada! (C4 - Do central)", testNoteFailed: "Error al enviar la nota de prueba",
      deleteConfirm: "¿Está seguro de que desea eliminar este instrumento de la base de datos?\n\nNota: El dispositivo físico no se verá afectado.",
      deleteFailed: "Error al eliminar el instrumento", scanFailed: "Error en el escaneo",
      bluetoothNotAvailable: "Escaneo Bluetooth no disponible", networkNotAvailable: "Escaneo de red no disponible", retry: "Reintentar"
    },
    autoAssign: {
      title: "Auto-asignar canales", analyzing: "Analizando archivo MIDI y asignando instrumentos...",
      error: "Error de auto-asignación", generateFailed: "Error al generar la auto-asignación",
      confidenceScore: "Puntuación de confianza", instructions: "Seleccione el instrumento para cada canal. La mejor coincidencia está preseleccionada.",
      channel: "Canal", drums: "Batería", noCompatible: "No se encontraron instrumentos compatibles",
      channelSkipped: "Canal omitido", assignChannel: "Asignar canal", recommended: "Recomendado",
      noTransposition: "No se necesita transposición", enableOctaveWrapping: "Activar envoltura de octava",
      previewOriginal: "Preescuchar original", previewOriginalTip: "Preescuchar el archivo MIDI original",
      previewAdapted: "Preescuchar adaptado", previewAdaptedTip: "Preescuchar la versión adaptada con transposición",
      stop: "Detener", quickAssign: "Asignación rápida", quickAssignTip: "Asignar automáticamente todos los canales con la mejor coincidencia",
      apply: "Aplicar", noAssignments: "No hay asignaciones para aplicar", applying: "Aplicando asignaciones...",
      applySuccess: "¡Auto-asignación aplicada con éxito!", applyFailed: "Error al aplicar la auto-asignación",
      quickAssignConfirm: "La asignación rápida seleccionará automáticamente el mejor instrumento para cada canal. ¿Continuar?",
      previewNotAvailable: "Vista previa no disponible", previewFailed: "Error en la vista previa",
      noteRange: "Rango de notas", polyphony: "Polifonía", type: "Tipo", range: "Rango",
      noActiveChannels: "No hay canales activos en este archivo MIDI", skippedLabel: "OMITIDO",
      skippedCount: "{count} canal(es) omitido(s)", notesTransposed: "nota(s) transpuesta(s)",
      channelsSkipped: "canal(es) omitido(s)", channelsWillBeAssigned: "{active} de {total} canales serán asignados"
    },
    instrumentCapabilities: {
      title: "Completar capacidades del instrumento", subtitle: "Algunos instrumentos tienen información faltante para la auto-asignación óptima. Complete los campos requeridos.",
      progress: "Instrumento {current} de {total}", skip: "Omitir", previous: "Anterior", next: "Siguiente",
      complete: "Completar", type: "Tipo", manufacturer: "Fabricante", requiredFields: "Campos requeridos",
      recommendedFields: "Campos recomendados", recommendedHint: "Estos campos mejoran la calidad de la auto-asignación pero no son obligatorios.",
      select: "Seleccionar", noteSelectionRange: "Rango (instrumentos melódicos)", noteSelectionDiscrete: "Discreto (batería, pads)",
      typeKeyboard: "Teclado / Piano", typeSynth: "Sintetizador", typeDrums: "Batería / Percusión",
      typeBass: "Bajo", typeGuitar: "Guitarra", typeStrings: "Cuerdas", typeBrass: "Metales",
      typeWoodwind: "Viento madera", typePad: "Pad / Atmósfera", typeSampler: "Sampler", typeOther: "Otro",
      noteArrayPlaceholder: "Ingrese números de notas MIDI separados por comas (ej.: 36, 38, 42, 46, 48)",
      commonDrums: "Drums comunes: 36 (Kick), 38 (Snare), 42 (Closed HH), 46 (Open HH), 48 (Tom1), 50 (Tom2)",
      optional: "opcional", applyDefaults: "Aplicar valores predeterminados sugeridos", openFullSettings: "Abrir configuración completa del instrumento",
      fullSettingsHint: "Acceda a configuración avanzada, latencia y más", defaultsFailed: "Error al cargar los valores predeterminados sugeridos",
      saveFailed: "Error al guardar las capacidades del instrumento", fullSettingsComingSoon: "¡Configuración completa del instrumento próximamente!"
    }
  },
  it: {
    common: { unknown: "Sconosciuto", unknownError: "Errore sconosciuto" },
    settings: { calibrationButton: { title: "Pulsante calibrazione microfono", enable: "Mostra pulsante di calibrazione", description: "Mostra il pulsante del microfono per calibrare i ritardi audio degli strumenti" } },
    instrumentManagement: {
      title: "Gestione strumenti", subtitle: "Configura, organizza e gestisci tutti i tuoi strumenti MIDI",
      searchPlaceholder: "Cerca strumenti...", filterAll: "Tutti gli strumenti", filterComplete: "Solo completi",
      filterIncomplete: "Solo incompleti", filterConnected: "Solo connessi", refresh: "Aggiorna",
      noInstruments: "Nessuno strumento trovato", adjustFilter: "Prova a modificare la ricerca o il filtro",
      scanToStart: "Scansiona i dispositivi per iniziare", connectedInstruments: "Strumenti connessi",
      disconnectedInstruments: "Strumenti disconnessi", complete: "COMPLETO", incomplete: "INCOMPLETO",
      gmProgram: "Programma GM", gmProgramNotSet: "Programma GM non impostato", range: "Intervallo",
      rangeNotSet: "Intervallo note non impostato", polyphony: "Polifonia", polyphonyNotSet: "Polifonia non impostata",
      edit: "Modifica", test: "Test", completeBtn: "Completa", instrumentsTotal: "strumenti totali",
      connectedCount: "connessi", completeCount: "completi", incompleteCount: "incompleti",
      settingsNotAvailable: "Impostazioni strumento non disponibili. Assicurati che il modulo sia caricato.",
      testNoteSent: "Nota di test inviata! (C4 - Do centrale)", testNoteFailed: "Invio nota di test fallito",
      deleteConfirm: "Sei sicuro di voler rimuovere questo strumento dal database?\n\nNota: Il dispositivo fisico non sarà influenzato.",
      deleteFailed: "Eliminazione strumento fallita", scanFailed: "Scansione fallita",
      bluetoothNotAvailable: "Scansione Bluetooth non disponibile", networkNotAvailable: "Scansione di rete non disponibile", retry: "Riprova"
    },
    autoAssign: {
      title: "Auto-assegnazione canali", analyzing: "Analisi del file MIDI e assegnazione strumenti...",
      error: "Errore auto-assegnazione", generateFailed: "Generazione auto-assegnazione fallita",
      confidenceScore: "Punteggio di affidabilità", instructions: "Seleziona lo strumento per ogni canale. La migliore corrispondenza è preselezionata.",
      channel: "Canale", drums: "Batteria", noCompatible: "Nessuno strumento compatibile trovato",
      channelSkipped: "Canale saltato", assignChannel: "Assegna canale", recommended: "Consigliato",
      noTransposition: "Nessuna trasposizione necessaria", enableOctaveWrapping: "Abilita avvolgimento ottava",
      previewOriginal: "Anteprima originale", previewOriginalTip: "Anteprima del file MIDI originale",
      previewAdapted: "Anteprima adattato", previewAdaptedTip: "Anteprima della versione adattata con trasposizione",
      stop: "Stop", quickAssign: "Assegnazione rapida", quickAssignTip: "Assegna automaticamente tutti i canali con la migliore corrispondenza",
      apply: "Applica", noAssignments: "Nessuna assegnazione da applicare", applying: "Applicazione assegnazioni...",
      applySuccess: "Auto-assegnazione applicata con successo!", applyFailed: "Applicazione auto-assegnazione fallita",
      quickAssignConfirm: "L'assegnazione rapida selezionerà automaticamente il miglior strumento per ogni canale. Continuare?",
      previewNotAvailable: "Anteprima non disponibile", previewFailed: "Anteprima fallita",
      noteRange: "Intervallo note", polyphony: "Polifonia", type: "Tipo", range: "Intervallo",
      noActiveChannels: "Nessun canale attivo in questo file MIDI", skippedLabel: "SALTATO",
      skippedCount: "{count} canale/i saltato/i", notesTransposed: "nota/e trasposte",
      channelsSkipped: "canale/i saltato/i", channelsWillBeAssigned: "{active} di {total} canali saranno assegnati"
    },
    instrumentCapabilities: {
      title: "Completa capacità strumento", subtitle: "Alcuni strumenti hanno informazioni mancanti per l'auto-assegnazione ottimale. Compila i campi richiesti.",
      progress: "Strumento {current} di {total}", skip: "Salta", previous: "Precedente", next: "Successivo",
      complete: "Completa", type: "Tipo", manufacturer: "Produttore", requiredFields: "Campi richiesti",
      recommendedFields: "Campi consigliati", recommendedHint: "Questi campi migliorano la qualità dell'auto-assegnazione ma non sono obbligatori.",
      select: "Seleziona", noteSelectionRange: "Intervallo (strumenti melodici)", noteSelectionDiscrete: "Discreto (batteria, pad)",
      typeKeyboard: "Tastiera / Pianoforte", typeSynth: "Sintetizzatore", typeDrums: "Batteria / Percussioni",
      typeBass: "Basso", typeGuitar: "Chitarra", typeStrings: "Archi", typeBrass: "Ottoni",
      typeWoodwind: "Legni", typePad: "Pad / Atmosfera", typeSampler: "Sampler", typeOther: "Altro",
      noteArrayPlaceholder: "Inserisci numeri di note MIDI separati da virgole (es.: 36, 38, 42, 46, 48)",
      commonDrums: "Drums comuni: 36 (Kick), 38 (Snare), 42 (Closed HH), 46 (Open HH), 48 (Tom1), 50 (Tom2)",
      optional: "opzionale", applyDefaults: "Applica valori predefiniti suggeriti", openFullSettings: "Apri impostazioni complete strumento",
      fullSettingsHint: "Accedi a configurazione avanzata, latenza e altro", defaultsFailed: "Caricamento valori predefiniti suggeriti fallito",
      saveFailed: "Salvataggio capacità strumento fallito", fullSettingsComingSoon: "Impostazioni complete strumento in arrivo!"
    }
  },
  pt: {
    common: { unknown: "Desconhecido", unknownError: "Erro desconhecido" },
    settings: { calibrationButton: { title: "Botão de calibração com microfone", enable: "Mostrar botão de calibração", description: "Mostra o botão do microfone para calibrar os atrasos de áudio dos instrumentos" } },
    instrumentManagement: {
      title: "Gestão de instrumentos", subtitle: "Configure, organize e gerencie todos os seus instrumentos MIDI",
      searchPlaceholder: "Pesquisar instrumentos...", filterAll: "Todos os instrumentos", filterComplete: "Apenas completos",
      filterIncomplete: "Apenas incompletos", filterConnected: "Apenas conectados", refresh: "Atualizar",
      noInstruments: "Nenhum instrumento encontrado", adjustFilter: "Tente ajustar sua pesquisa ou filtro",
      scanToStart: "Escaneie dispositivos para começar", connectedInstruments: "Instrumentos conectados",
      disconnectedInstruments: "Instrumentos desconectados", complete: "COMPLETO", incomplete: "INCOMPLETO",
      gmProgram: "Programa GM", gmProgramNotSet: "Programa GM não definido", range: "Faixa",
      rangeNotSet: "Faixa de notas não definida", polyphony: "Polifonia", polyphonyNotSet: "Polifonia não definida",
      edit: "Editar", test: "Testar", completeBtn: "Completar", instrumentsTotal: "instrumentos no total",
      connectedCount: "conectados", completeCount: "completos", incompleteCount: "incompletos",
      settingsNotAvailable: "Configurações do instrumento não disponíveis. Certifique-se de que o módulo esteja carregado.",
      testNoteSent: "Nota de teste enviada! (C4 - Dó central)", testNoteFailed: "Falha ao enviar nota de teste",
      deleteConfirm: "Tem certeza de que deseja remover este instrumento do banco de dados?\n\nNota: O dispositivo físico não será afetado.",
      deleteFailed: "Falha ao excluir instrumento", scanFailed: "Falha no escaneamento",
      bluetoothNotAvailable: "Escaneamento Bluetooth não disponível", networkNotAvailable: "Escaneamento de rede não disponível", retry: "Tentar novamente"
    },
    autoAssign: {
      title: "Auto-atribuir canais", analyzing: "Analisando arquivo MIDI e atribuindo instrumentos...",
      error: "Erro de auto-atribuição", generateFailed: "Falha ao gerar auto-atribuição",
      confidenceScore: "Pontuação de confiança", instructions: "Selecione o instrumento para cada canal. A melhor correspondência está pré-selecionada.",
      channel: "Canal", drums: "Bateria", noCompatible: "Nenhum instrumento compatível encontrado",
      channelSkipped: "Canal ignorado", assignChannel: "Atribuir canal", recommended: "Recomendado",
      noTransposition: "Nenhuma transposição necessária", enableOctaveWrapping: "Ativar envolvimento de oitava",
      previewOriginal: "Pré-visualizar original", previewOriginalTip: "Pré-visualizar o arquivo MIDI original",
      previewAdapted: "Pré-visualizar adaptado", previewAdaptedTip: "Pré-visualizar a versão adaptada com transposição",
      stop: "Parar", quickAssign: "Atribuição rápida", quickAssignTip: "Atribuir automaticamente todos os canais com a melhor correspondência",
      apply: "Aplicar", noAssignments: "Nenhuma atribuição para aplicar", applying: "Aplicando atribuições...",
      applySuccess: "Auto-atribuição aplicada com sucesso!", applyFailed: "Falha ao aplicar auto-atribuição",
      quickAssignConfirm: "A atribuição rápida selecionará automaticamente o melhor instrumento para cada canal. Continuar?",
      previewNotAvailable: "Pré-visualização não disponível", previewFailed: "Falha na pré-visualização",
      noteRange: "Faixa de notas", polyphony: "Polifonia", type: "Tipo", range: "Faixa",
      noActiveChannels: "Nenhum canal ativo neste arquivo MIDI", skippedLabel: "IGNORADO",
      skippedCount: "{count} canal(is) ignorado(s)", notesTransposed: "nota(s) transposta(s)",
      channelsSkipped: "canal(is) ignorado(s)", channelsWillBeAssigned: "{active} de {total} canais serão atribuídos"
    },
    instrumentCapabilities: {
      title: "Completar capacidades do instrumento", subtitle: "Alguns instrumentos têm informações faltantes para a auto-atribuição ideal. Complete os campos obrigatórios.",
      progress: "Instrumento {current} de {total}", skip: "Pular", previous: "Anterior", next: "Próximo",
      complete: "Concluir", type: "Tipo", manufacturer: "Fabricante", requiredFields: "Campos obrigatórios",
      recommendedFields: "Campos recomendados", recommendedHint: "Estes campos melhoram a qualidade da auto-atribuição, mas não são obrigatórios.",
      select: "Selecionar", noteSelectionRange: "Faixa (instrumentos melódicos)", noteSelectionDiscrete: "Discreto (bateria, pads)",
      typeKeyboard: "Teclado / Piano", typeSynth: "Sintetizador", typeDrums: "Bateria / Percussão",
      typeBass: "Baixo", typeGuitar: "Guitarra", typeStrings: "Cordas", typeBrass: "Metais",
      typeWoodwind: "Madeiras", typePad: "Pad / Atmosfera", typeSampler: "Sampler", typeOther: "Outro",
      noteArrayPlaceholder: "Insira números de notas MIDI separados por vírgulas (ex.: 36, 38, 42, 46, 48)",
      commonDrums: "Drums comuns: 36 (Kick), 38 (Snare), 42 (Closed HH), 46 (Open HH), 48 (Tom1), 50 (Tom2)",
      optional: "opcional", applyDefaults: "Aplicar valores padrão sugeridos", openFullSettings: "Abrir configurações completas do instrumento",
      fullSettingsHint: "Acesse configuração avançada, latência e mais", defaultsFailed: "Falha ao carregar valores padrão sugeridos",
      saveFailed: "Falha ao salvar capacidades do instrumento", fullSettingsComingSoon: "Configurações completas do instrumento em breve!"
    }
  },
  ja: {
    common: { unknown: "不明", unknownError: "不明なエラー" },
    settings: { calibrationButton: { title: "マイクキャリブレーションボタン", enable: "キャリブレーションボタンを表示", description: "楽器のオーディオ遅延を校正するためのマイクボタンを表示します" } },
    instrumentManagement: {
      title: "楽器管理", subtitle: "すべてのMIDI楽器を設定、整理、管理",
      searchPlaceholder: "楽器を検索...", filterAll: "すべての楽器", filterComplete: "完了のみ",
      filterIncomplete: "未完了のみ", filterConnected: "接続中のみ", refresh: "更新",
      noInstruments: "楽器が見つかりません", adjustFilter: "検索またはフィルターを調整してください",
      scanToStart: "デバイスをスキャンして開始", connectedInstruments: "接続中の楽器",
      disconnectedInstruments: "切断された楽器", complete: "完了", incomplete: "未完了",
      gmProgram: "GMプログラム", gmProgramNotSet: "GMプログラム未設定", range: "範囲",
      rangeNotSet: "ノート範囲未設定", polyphony: "ポリフォニー", polyphonyNotSet: "ポリフォニー未設定",
      edit: "編集", test: "テスト", completeBtn: "完了", instrumentsTotal: "楽器合計",
      connectedCount: "接続中", completeCount: "完了", incompleteCount: "未完了",
      settingsNotAvailable: "楽器設定が利用できません。モジュールがロードされていることを確認してください。",
      testNoteSent: "テストノートを送信しました！(C4 - ミドルC)", testNoteFailed: "テストノートの送信に失敗しました",
      deleteConfirm: "この楽器をデータベースから削除しますか？\n\n注：物理デバイスには影響しません。",
      deleteFailed: "楽器の削除に失敗しました", scanFailed: "スキャンに失敗しました",
      bluetoothNotAvailable: "Bluetoothスキャン機能が利用できません", networkNotAvailable: "ネットワークスキャン機能が利用できません", retry: "再試行"
    },
    autoAssign: {
      title: "チャンネル自動割り当て", analyzing: "MIDIファイルを分析し、楽器を割り当て中...",
      error: "自動割り当てエラー", generateFailed: "自動割り当ての生成に失敗しました",
      confidenceScore: "信頼度スコア", instructions: "各チャンネルの楽器を選択してください。最適な一致が事前選択されています。",
      channel: "チャンネル", drums: "ドラム", noCompatible: "互換性のある楽器が見つかりません",
      channelSkipped: "チャンネルスキップ", assignChannel: "チャンネルを割り当て", recommended: "推奨",
      noTransposition: "転調不要", enableOctaveWrapping: "オクターブラッピングを有効化",
      previewOriginal: "オリジナルをプレビュー", previewOriginalTip: "オリジナルのMIDIファイルをプレビュー",
      previewAdapted: "適応版をプレビュー", previewAdaptedTip: "転調を適用した版をプレビュー",
      stop: "停止", quickAssign: "クイック割り当て", quickAssignTip: "すべてのチャンネルを最適な一致で自動割り当て",
      apply: "適用", noAssignments: "適用する割り当てがありません", applying: "割り当てを適用中...",
      applySuccess: "自動割り当てが正常に適用されました！", applyFailed: "自動割り当ての適用に失敗しました",
      quickAssignConfirm: "クイック割り当ては各チャンネルに最適な楽器を自動選択します。続行しますか？",
      previewNotAvailable: "プレビュー利用不可", previewFailed: "プレビュー失敗",
      noteRange: "ノート範囲", polyphony: "ポリフォニー", type: "タイプ", range: "範囲",
      noActiveChannels: "このMIDIファイルにアクティブなチャンネルがありません", skippedLabel: "スキップ",
      skippedCount: "{count}チャンネルスキップ", notesTransposed: "ノート転調済み",
      channelsSkipped: "チャンネルスキップ", channelsWillBeAssigned: "{total}チャンネル中{active}チャンネルが割り当てられます"
    },
    instrumentCapabilities: {
      title: "楽器機能の完了", subtitle: "一部の楽器に最適な自動割り当てに必要な情報が不足しています。必須フィールドを入力してください。",
      progress: "楽器 {current}/{total}", skip: "スキップ", previous: "前へ", next: "次へ",
      complete: "完了", type: "タイプ", manufacturer: "メーカー", requiredFields: "必須フィールド",
      recommendedFields: "推奨フィールド", recommendedHint: "これらのフィールドは自動割り当ての品質を向上させますが、必須ではありません。",
      select: "選択", noteSelectionRange: "範囲（メロディ楽器）", noteSelectionDiscrete: "ディスクリート（ドラム、パッド）",
      typeKeyboard: "キーボード / ピアノ", typeSynth: "シンセサイザー", typeDrums: "ドラム / パーカッション",
      typeBass: "ベース", typeGuitar: "ギター", typeStrings: "ストリングス", typeBrass: "ブラス",
      typeWoodwind: "木管楽器", typePad: "パッド / アトモスフィア", typeSampler: "サンプラー", typeOther: "その他",
      noteArrayPlaceholder: "MIDIノート番号をカンマ区切りで入力（例：36, 38, 42, 46, 48）",
      commonDrums: "一般的なドラム：36（キック）、38（スネア）、42（クローズドHH）、46（オープンHH）、48（Tom1）、50（Tom2）",
      optional: "任意", applyDefaults: "推奨デフォルトを適用", openFullSettings: "楽器の全設定を開く",
      fullSettingsHint: "詳細設定、レイテンシー設定などにアクセス", defaultsFailed: "推奨デフォルトの読み込みに失敗しました",
      saveFailed: "楽器機能の保存に失敗しました", fullSettingsComingSoon: "楽器の全設定は近日公開！"
    }
  },
  "zh-CN": {
    common: { unknown: "未知", unknownError: "未知错误" },
    settings: { calibrationButton: { title: "麦克风校准按钮", enable: "显示校准按钮", description: "显示用于校准乐器音频延迟的麦克风按钮" } },
    instrumentManagement: {
      title: "乐器管理", subtitle: "配置、组织和管理所有MIDI乐器",
      searchPlaceholder: "搜索乐器...", filterAll: "所有乐器", filterComplete: "仅完整",
      filterIncomplete: "仅不完整", filterConnected: "仅已连接", refresh: "刷新",
      noInstruments: "未找到乐器", adjustFilter: "请调整搜索或筛选条件",
      scanToStart: "扫描设备以开始", connectedInstruments: "已连接乐器",
      disconnectedInstruments: "已断开乐器", complete: "完整", incomplete: "不完整",
      gmProgram: "GM程序", gmProgramNotSet: "GM程序未设置", range: "范围",
      rangeNotSet: "音符范围未设置", polyphony: "复音数", polyphonyNotSet: "复音数未设置",
      edit: "编辑", test: "测试", completeBtn: "完成", instrumentsTotal: "乐器总数",
      connectedCount: "已连接", completeCount: "已完成", incompleteCount: "未完成",
      settingsNotAvailable: "乐器设置不可用。请确保模块已加载。",
      testNoteSent: "测试音符已发送！(C4 - 中央C)", testNoteFailed: "发送测试音符失败",
      deleteConfirm: "确定要从数据库中删除此乐器吗？\n\n注意：物理设备不会受到影响。",
      deleteFailed: "删除乐器失败", scanFailed: "扫描失败",
      bluetoothNotAvailable: "蓝牙扫描功能不可用", networkNotAvailable: "网络扫描功能不可用", retry: "重试"
    },
    autoAssign: {
      title: "自动分配通道", analyzing: "正在分析MIDI文件并匹配乐器...",
      error: "自动分配错误", generateFailed: "生成自动分配失败",
      confidenceScore: "置信度评分", instructions: "为每个通道选择乐器。最佳匹配已预选。",
      channel: "通道", drums: "鼓", noCompatible: "未找到兼容乐器",
      channelSkipped: "通道已跳过", assignChannel: "分配通道", recommended: "推荐",
      noTransposition: "无需移调", enableOctaveWrapping: "启用八度环绕",
      previewOriginal: "预览原始", previewOriginalTip: "预览原始MIDI文件",
      previewAdapted: "预览适配版", previewAdaptedTip: "预览带移调的适配版本",
      stop: "停止", quickAssign: "快速分配", quickAssignTip: "自动为所有通道分配最佳匹配",
      apply: "应用", noAssignments: "没有可应用的分配", applying: "正在应用分配...",
      applySuccess: "自动分配成功应用！", applyFailed: "应用自动分配失败",
      quickAssignConfirm: "快速分配将自动为每个通道选择最佳乐器。是否继续？",
      previewNotAvailable: "预览不可用", previewFailed: "预览失败",
      noteRange: "音符范围", polyphony: "复音数", type: "类型", range: "范围",
      noActiveChannels: "此MIDI文件中没有活动通道", skippedLabel: "已跳过",
      skippedCount: "{count}个通道已跳过", notesTransposed: "个音符已移调",
      channelsSkipped: "个通道已跳过", channelsWillBeAssigned: "{total}个通道中的{active}个将被分配"
    },
    instrumentCapabilities: {
      title: "完善乐器功能", subtitle: "部分乐器缺少最佳自动分配所需的信息。请填写必填字段。",
      progress: "乐器 {current}/{total}", skip: "跳过", previous: "上一个", next: "下一个",
      complete: "完成", type: "类型", manufacturer: "制造商", requiredFields: "必填字段",
      recommendedFields: "推荐字段", recommendedHint: "这些字段可以提高自动分配质量，但不是必需的。",
      select: "选择", noteSelectionRange: "范围（旋律乐器）", noteSelectionDiscrete: "离散（鼓、打击垫）",
      typeKeyboard: "键盘 / 钢琴", typeSynth: "合成器", typeDrums: "鼓 / 打击乐",
      typeBass: "贝斯", typeGuitar: "吉他", typeStrings: "弦乐", typeBrass: "铜管",
      typeWoodwind: "木管", typePad: "音垫 / 氛围", typeSampler: "采样器", typeOther: "其他",
      noteArrayPlaceholder: "输入MIDI音符编号，用逗号分隔（例：36, 38, 42, 46, 48）",
      commonDrums: "常用鼓：36（底鼓）、38（军鼓）、42（闭合踩镲）、46（开放踩镲）、48（Tom1）、50（Tom2）",
      optional: "可选", applyDefaults: "应用建议默认值", openFullSettings: "打开完整乐器设置",
      fullSettingsHint: "访问高级配置、延迟设置等", defaultsFailed: "加载建议默认值失败",
      saveFailed: "保存乐器功能失败", fullSettingsComingSoon: "完整乐器设置即将推出！"
    }
  },
  ko: {
    common: { unknown: "알 수 없음", unknownError: "알 수 없는 오류" },
    settings: { calibrationButton: { title: "마이크 캘리브레이션 버튼", enable: "캘리브레이션 버튼 표시", description: "악기의 오디오 지연을 보정하기 위한 마이크 버튼을 표시합니다" } },
    instrumentManagement: {
      title: "악기 관리", subtitle: "모든 MIDI 악기를 구성, 정리 및 관리",
      searchPlaceholder: "악기 검색...", filterAll: "모든 악기", filterComplete: "완료만",
      filterIncomplete: "미완료만", filterConnected: "연결된 것만", refresh: "새로고침",
      noInstruments: "악기를 찾을 수 없습니다", adjustFilter: "검색 또는 필터를 조정해 보세요",
      scanToStart: "장치를 스캔하여 시작하세요", connectedInstruments: "연결된 악기",
      disconnectedInstruments: "연결 해제된 악기", complete: "완료", incomplete: "미완료",
      gmProgram: "GM 프로그램", gmProgramNotSet: "GM 프로그램 미설정", range: "범위",
      rangeNotSet: "노트 범위 미설정", polyphony: "폴리포니", polyphonyNotSet: "폴리포니 미설정",
      edit: "편집", test: "테스트", completeBtn: "완료", instrumentsTotal: "총 악기",
      connectedCount: "연결됨", completeCount: "완료", incompleteCount: "미완료",
      settingsNotAvailable: "악기 설정을 사용할 수 없습니다. 모듈이 로드되었는지 확인하세요.",
      testNoteSent: "테스트 노트 전송 완료! (C4 - 가운데 C)", testNoteFailed: "테스트 노트 전송 실패",
      deleteConfirm: "이 악기를 데이터베이스에서 삭제하시겠습니까?\n\n참고: 물리적 장치는 영향을 받지 않습니다.",
      deleteFailed: "악기 삭제 실패", scanFailed: "스캔 실패",
      bluetoothNotAvailable: "블루투스 스캔 기능 사용 불가", networkNotAvailable: "네트워크 스캔 기능 사용 불가", retry: "재시도"
    },
    autoAssign: {
      title: "채널 자동 할당", analyzing: "MIDI 파일 분석 및 악기 매칭 중...",
      error: "자동 할당 오류", generateFailed: "자동 할당 생성 실패",
      confidenceScore: "신뢰도 점수", instructions: "각 채널의 악기를 선택하세요. 최적의 매치가 사전 선택되어 있습니다.",
      channel: "채널", drums: "드럼", noCompatible: "호환되는 악기를 찾을 수 없습니다",
      channelSkipped: "채널 건너뜀", assignChannel: "채널 할당", recommended: "추천",
      noTransposition: "전조 불필요", enableOctaveWrapping: "옥타브 래핑 활성화",
      previewOriginal: "원본 미리듣기", previewOriginalTip: "원본 MIDI 파일 미리듣기",
      previewAdapted: "적용본 미리듣기", previewAdaptedTip: "전조가 적용된 버전 미리듣기",
      stop: "정지", quickAssign: "빠른 할당", quickAssignTip: "모든 채널을 최적의 매치로 자동 할당",
      apply: "적용", noAssignments: "적용할 할당이 없습니다", applying: "할당 적용 중...",
      applySuccess: "자동 할당이 성공적으로 적용되었습니다!", applyFailed: "자동 할당 적용 실패",
      quickAssignConfirm: "빠른 할당은 각 채널에 최적의 악기를 자동 선택합니다. 계속하시겠습니까?",
      previewNotAvailable: "미리보기 사용 불가", previewFailed: "미리보기 실패",
      noteRange: "노트 범위", polyphony: "폴리포니", type: "유형", range: "범위",
      noActiveChannels: "이 MIDI 파일에 활성 채널이 없습니다", skippedLabel: "건너뜀",
      skippedCount: "{count}개 채널 건너뜀", notesTransposed: "개 노트 전조됨",
      channelsSkipped: "개 채널 건너뜀", channelsWillBeAssigned: "{total}개 채널 중 {active}개가 할당됩니다"
    },
    instrumentCapabilities: {
      title: "악기 기능 완성", subtitle: "일부 악기에 최적의 자동 할당에 필요한 정보가 부족합니다. 필수 필드를 작성해 주세요.",
      progress: "악기 {current}/{total}", skip: "건너뛰기", previous: "이전", next: "다음",
      complete: "완료", type: "유형", manufacturer: "제조사", requiredFields: "필수 필드",
      recommendedFields: "권장 필드", recommendedHint: "이 필드들은 자동 할당 품질을 향상시키지만 필수는 아닙니다.",
      select: "선택", noteSelectionRange: "범위 (멜로디 악기)", noteSelectionDiscrete: "개별 (드럼, 패드)",
      typeKeyboard: "키보드 / 피아노", typeSynth: "신디사이저", typeDrums: "드럼 / 타악기",
      typeBass: "베이스", typeGuitar: "기타", typeStrings: "현악기", typeBrass: "금관악기",
      typeWoodwind: "목관악기", typePad: "패드 / 분위기", typeSampler: "샘플러", typeOther: "기타",
      noteArrayPlaceholder: "MIDI 노트 번호를 쉼표로 구분하여 입력 (예: 36, 38, 42, 46, 48)",
      commonDrums: "일반 드럼: 36 (킥), 38 (스네어), 42 (클로즈드 HH), 46 (오픈 HH), 48 (Tom1), 50 (Tom2)",
      optional: "선택사항", applyDefaults: "추천 기본값 적용", openFullSettings: "전체 악기 설정 열기",
      fullSettingsHint: "고급 설정, 레이턴시 설정 등에 접근", defaultsFailed: "추천 기본값 로드 실패",
      saveFailed: "악기 기능 저장 실패", fullSettingsComingSoon: "전체 악기 설정 곧 출시!"
    }
  },
  ru: {
    common: { unknown: "Неизвестно", unknownError: "Неизвестная ошибка" },
    settings: { calibrationButton: { title: "Кнопка калибровки микрофона", enable: "Показать кнопку калибровки", description: "Показывает кнопку микрофона для калибровки аудиозадержки инструментов" } },
    instrumentManagement: {
      title: "Управление инструментами", subtitle: "Настройте, организуйте и управляйте всеми вашими MIDI-инструментами",
      searchPlaceholder: "Поиск инструментов...", filterAll: "Все инструменты", filterComplete: "Только завершённые",
      filterIncomplete: "Только незавершённые", filterConnected: "Только подключённые", refresh: "Обновить",
      noInstruments: "Инструменты не найдены", adjustFilter: "Попробуйте изменить поиск или фильтр",
      scanToStart: "Сканируйте устройства для начала", connectedInstruments: "Подключённые инструменты",
      disconnectedInstruments: "Отключённые инструменты", complete: "ЗАВЕРШЕНО", incomplete: "НЕЗАВЕРШЕНО",
      gmProgram: "GM-программа", gmProgramNotSet: "GM-программа не задана", range: "Диапазон",
      rangeNotSet: "Диапазон нот не задан", polyphony: "Полифония", polyphonyNotSet: "Полифония не задана",
      edit: "Редактировать", test: "Тест", completeBtn: "Завершить", instrumentsTotal: "инструментов всего",
      connectedCount: "подключено", completeCount: "завершено", incompleteCount: "незавершено",
      settingsNotAvailable: "Настройки инструмента недоступны. Убедитесь, что модуль загружен.",
      testNoteSent: "Тестовая нота отправлена! (C4 - средняя до)", testNoteFailed: "Не удалось отправить тестовую ноту",
      deleteConfirm: "Вы уверены, что хотите удалить этот инструмент из базы данных?\n\nПримечание: Физическое устройство не будет затронуто.",
      deleteFailed: "Не удалось удалить инструмент", scanFailed: "Сканирование не удалось",
      bluetoothNotAvailable: "Bluetooth-сканирование недоступно", networkNotAvailable: "Сетевое сканирование недоступно", retry: "Повторить"
    },
    autoAssign: {
      title: "Автоназначение каналов", analyzing: "Анализ MIDI-файла и подбор инструментов...",
      error: "Ошибка автоназначения", generateFailed: "Не удалось сгенерировать автоназначение",
      confidenceScore: "Оценка уверенности", instructions: "Выберите инструмент для каждого канала. Лучшее совпадение предварительно выбрано.",
      channel: "Канал", drums: "Ударные", noCompatible: "Совместимые инструменты не найдены",
      channelSkipped: "Канал пропущен", assignChannel: "Назначить канал", recommended: "Рекомендуемый",
      noTransposition: "Транспонирование не требуется", enableOctaveWrapping: "Включить октавный перенос",
      previewOriginal: "Предпрослушивание оригинала", previewOriginalTip: "Предпрослушивание оригинального MIDI-файла",
      previewAdapted: "Предпрослушивание адаптации", previewAdaptedTip: "Предпрослушивание адаптированной версии с транспонированием",
      stop: "Стоп", quickAssign: "Быстрое назначение", quickAssignTip: "Автоматически назначить все каналы с лучшим совпадением",
      apply: "Применить", noAssignments: "Нет назначений для применения", applying: "Применение назначений...",
      applySuccess: "Автоназначение успешно применено!", applyFailed: "Не удалось применить автоназначение",
      quickAssignConfirm: "Быстрое назначение автоматически выберет лучший инструмент для каждого канала. Продолжить?",
      previewNotAvailable: "Предпросмотр недоступен", previewFailed: "Ошибка предпросмотра",
      noteRange: "Диапазон нот", polyphony: "Полифония", type: "Тип", range: "Диапазон",
      noActiveChannels: "В этом MIDI-файле нет активных каналов", skippedLabel: "ПРОПУЩЕНО",
      skippedCount: "{count} канал(ов) пропущено", notesTransposed: "нот(а) транспонировано",
      channelsSkipped: "канал(ов) пропущено", channelsWillBeAssigned: "{active} из {total} каналов будут назначены"
    },
    instrumentCapabilities: {
      title: "Заполнение возможностей инструмента", subtitle: "У некоторых инструментов отсутствует информация для оптимального автоназначения. Заполните обязательные поля.",
      progress: "Инструмент {current} из {total}", skip: "Пропустить", previous: "Назад", next: "Далее",
      complete: "Завершить", type: "Тип", manufacturer: "Производитель", requiredFields: "Обязательные поля",
      recommendedFields: "Рекомендуемые поля", recommendedHint: "Эти поля улучшают качество автоназначения, но не обязательны.",
      select: "Выбрать", noteSelectionRange: "Диапазон (мелодические инструменты)", noteSelectionDiscrete: "Дискретный (ударные, пэды)",
      typeKeyboard: "Клавишные / Фортепиано", typeSynth: "Синтезатор", typeDrums: "Ударные / Перкуссия",
      typeBass: "Бас", typeGuitar: "Гитара", typeStrings: "Струнные", typeBrass: "Медные духовые",
      typeWoodwind: "Деревянные духовые", typePad: "Пэд / Атмосфера", typeSampler: "Сэмплер", typeOther: "Другое",
      noteArrayPlaceholder: "Введите номера MIDI-нот через запятую (например: 36, 38, 42, 46, 48)",
      commonDrums: "Стандартные ударные: 36 (Бочка), 38 (Малый), 42 (Закрытый HH), 46 (Открытый HH), 48 (Том1), 50 (Том2)",
      optional: "необязательно", applyDefaults: "Применить рекомендуемые значения", openFullSettings: "Открыть полные настройки инструмента",
      fullSettingsHint: "Доступ к расширенным настройкам, задержке и другим параметрам", defaultsFailed: "Не удалось загрузить рекомендуемые значения",
      saveFailed: "Не удалось сохранить возможности инструмента", fullSettingsComingSoon: "Полные настройки инструмента скоро!"
    }
  },
  nl: {
    common: { unknown: "Onbekend", unknownError: "Onbekende fout" },
    settings: { calibrationButton: { title: "Microfooncalibratieknop", enable: "Calibratieknop tonen", description: "Toont de microfoonknop om audiovertragingen van instrumenten te kalibreren" } },
    instrumentManagement: {
      title: "Instrumentbeheer", subtitle: "Configureer, organiseer en beheer al uw MIDI-instrumenten",
      searchPlaceholder: "Instrumenten zoeken...", filterAll: "Alle instrumenten", filterComplete: "Alleen complete",
      filterIncomplete: "Alleen incomplete", filterConnected: "Alleen verbonden", refresh: "Vernieuwen",
      noInstruments: "Geen instrumenten gevonden", adjustFilter: "Probeer uw zoekopdracht of filter aan te passen",
      scanToStart: "Scan apparaten om te beginnen", connectedInstruments: "Verbonden instrumenten",
      disconnectedInstruments: "Losgekoppelde instrumenten", complete: "COMPLEET", incomplete: "INCOMPLEET",
      gmProgram: "GM-programma", gmProgramNotSet: "GM-programma niet ingesteld", range: "Bereik",
      rangeNotSet: "Nootbereik niet ingesteld", polyphony: "Polyfonie", polyphonyNotSet: "Polyfonie niet ingesteld",
      edit: "Bewerken", test: "Testen", completeBtn: "Voltooien", instrumentsTotal: "instrumenten totaal",
      connectedCount: "verbonden", completeCount: "compleet", incompleteCount: "incompleet",
      settingsNotAvailable: "Instrumentinstellingen niet beschikbaar. Zorg ervoor dat de module geladen is.",
      testNoteSent: "Testnoot verzonden! (C4 - Midden C)", testNoteFailed: "Testnoot verzenden mislukt",
      deleteConfirm: "Weet u zeker dat u dit instrument uit de database wilt verwijderen?\n\nOpmerking: Het fysieke apparaat wordt niet beïnvloed.",
      deleteFailed: "Instrument verwijderen mislukt", scanFailed: "Scan mislukt",
      bluetoothNotAvailable: "Bluetooth-scan niet beschikbaar", networkNotAvailable: "Netwerkscan niet beschikbaar", retry: "Opnieuw proberen"
    },
    autoAssign: {
      title: "Kanalen automatisch toewijzen", analyzing: "MIDI-bestand analyseren en instrumenten toewijzen...",
      error: "Auto-toewijzingsfout", generateFailed: "Auto-toewijzing genereren mislukt",
      confidenceScore: "Vertrouwensscore", instructions: "Selecteer het instrument voor elk kanaal. De beste overeenkomst is voorgeselecteerd.",
      channel: "Kanaal", drums: "Drums", noCompatible: "Geen compatibele instrumenten gevonden",
      channelSkipped: "Kanaal overgeslagen", assignChannel: "Kanaal toewijzen", recommended: "Aanbevolen",
      noTransposition: "Geen transpositie nodig", enableOctaveWrapping: "Octaafomslag inschakelen",
      previewOriginal: "Origineel beluisteren", previewOriginalTip: "Het originele MIDI-bestand beluisteren",
      previewAdapted: "Aangepast beluisteren", previewAdaptedTip: "De aangepaste versie met transpositie beluisteren",
      stop: "Stop", quickAssign: "Snelle toewijzing", quickAssignTip: "Alle kanalen automatisch toewijzen met beste overeenkomst",
      apply: "Toepassen", noAssignments: "Geen toewijzingen om toe te passen", applying: "Toewijzingen toepassen...",
      applySuccess: "Auto-toewijzing succesvol toegepast!", applyFailed: "Auto-toewijzing toepassen mislukt",
      quickAssignConfirm: "Snelle toewijzing selecteert automatisch het beste instrument voor elk kanaal. Doorgaan?",
      previewNotAvailable: "Voorbeeld niet beschikbaar", previewFailed: "Voorbeeld mislukt",
      noteRange: "Nootbereik", polyphony: "Polyfonie", type: "Type", range: "Bereik",
      noActiveChannels: "Geen actieve kanalen in dit MIDI-bestand", skippedLabel: "OVERGESLAGEN",
      skippedCount: "{count} kanaal/kanalen overgeslagen", notesTransposed: "noot/noten getransponeerd",
      channelsSkipped: "kanaal/kanalen overgeslagen", channelsWillBeAssigned: "{active} van {total} kanalen worden toegewezen"
    },
    instrumentCapabilities: {
      title: "Instrumentmogelijkheden voltooien", subtitle: "Sommige instrumenten missen informatie voor optimale auto-toewijzing. Vul de vereiste velden in.",
      progress: "Instrument {current} van {total}", skip: "Overslaan", previous: "Vorige", next: "Volgende",
      complete: "Voltooien", type: "Type", manufacturer: "Fabrikant", requiredFields: "Verplichte velden",
      recommendedFields: "Aanbevolen velden", recommendedHint: "Deze velden verbeteren de kwaliteit van auto-toewijzing maar zijn niet verplicht.",
      select: "Selecteren", noteSelectionRange: "Bereik (melodische instrumenten)", noteSelectionDiscrete: "Discreet (drums, pads)",
      typeKeyboard: "Keyboard / Piano", typeSynth: "Synthesizer", typeDrums: "Drums / Percussie",
      typeBass: "Bas", typeGuitar: "Gitaar", typeStrings: "Strijkers", typeBrass: "Koper",
      typeWoodwind: "Houtblazers", typePad: "Pad / Sfeer", typeSampler: "Sampler", typeOther: "Overig",
      noteArrayPlaceholder: "Voer MIDI-nootnummers in, gescheiden door komma's (bijv.: 36, 38, 42, 46, 48)",
      commonDrums: "Standaard drums: 36 (Kick), 38 (Snare), 42 (Closed HH), 46 (Open HH), 48 (Tom1), 50 (Tom2)",
      optional: "optioneel", applyDefaults: "Voorgestelde standaardwaarden toepassen", openFullSettings: "Volledige instrumentinstellingen openen",
      fullSettingsHint: "Toegang tot geavanceerde instellingen, latentie en meer", defaultsFailed: "Voorgestelde standaardwaarden laden mislukt",
      saveFailed: "Instrumentmogelijkheden opslaan mislukt", fullSettingsComingSoon: "Volledige instrumentinstellingen binnenkort beschikbaar!"
    }
  }
};

// For the remaining languages, generate from English with locale-specific labels
// These will use English as base but with proper structure
const remainingLocales = ['bn', 'cs', 'da', 'el', 'eo', 'fi', 'hi', 'hu', 'id', 'no', 'pl', 'sv', 'th', 'tl', 'tr', 'uk', 'vi'];

// Language-specific translations for remaining locales
const remainingTranslations = {
  bn: { common: { unknown: "অজানা", unknownError: "অজানা ত্রুটি" } },
  cs: { common: { unknown: "Neznámé", unknownError: "Neznámá chyba" } },
  da: { common: { unknown: "Ukendt", unknownError: "Ukendt fejl" } },
  el: { common: { unknown: "Άγνωστο", unknownError: "Άγνωστο σφάλμα" } },
  eo: { common: { unknown: "Nekonata", unknownError: "Nekonata eraro" } },
  fi: { common: { unknown: "Tuntematon", unknownError: "Tuntematon virhe" } },
  hi: { common: { unknown: "अज्ञात", unknownError: "अज्ञात त्रुटि" } },
  hu: { common: { unknown: "Ismeretlen", unknownError: "Ismeretlen hiba" } },
  id: { common: { unknown: "Tidak diketahui", unknownError: "Kesalahan tidak diketahui" } },
  no: { common: { unknown: "Ukjent", unknownError: "Ukjent feil" } },
  pl: { common: { unknown: "Nieznane", unknownError: "Nieznany błąd" } },
  sv: { common: { unknown: "Okänd", unknownError: "Okänt fel" } },
  th: { common: { unknown: "ไม่ทราบ", unknownError: "ข้อผิดพลาดที่ไม่ทราบ" } },
  tl: { common: { unknown: "Hindi kilala", unknownError: "Hindi kilalang error" } },
  tr: { common: { unknown: "Bilinmeyen", unknownError: "Bilinmeyen hata" } },
  uk: { common: { unknown: "Невідомо", unknownError: "Невідома помилка" } },
  vi: { common: { unknown: "Không xác định", unknownError: "Lỗi không xác định" } }
};

// --- Helper functions ---
function flatKeys(obj, prefix = '') {
  const keys = [];
  for (const k of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys.push(...flatKeys(obj[k], path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}

function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// --- Main ---
function main() {
  const enData = JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf8'));
  const enKeys = flatKeys(enData);

  const localeFiles = readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json' && f !== 'fr.json');

  let totalFixed = 0;

  for (const file of localeFiles) {
    const locale = file.replace('.json', '');
    const filePath = join(localesDir, file);
    const localeData = JSON.parse(readFileSync(filePath, 'utf8'));
    const localeKeys = flatKeys(localeData);

    const missingKeys = enKeys.filter(k => !localeKeys.includes(k));

    if (missingKeys.length === 0) {
      console.log(`✓ ${locale}: No missing keys`);
      continue;
    }

    console.log(`✗ ${locale}: ${missingKeys.length} missing keys - fixing...`);

    // Get translations: prefer specific translations, fallback to English
    const specificTranslations = translations[locale] || remainingTranslations[locale] || {};

    for (const key of missingKeys) {
      // Check if we have a specific translation
      const specificValue = getNestedValue(specificTranslations, key);
      if (specificValue !== undefined) {
        setNestedValue(localeData, key, specificValue);
      } else {
        // Fallback: use English value
        const enValue = getNestedValue(enData, key);
        setNestedValue(localeData, key, enValue);
      }
    }

    // Write back with proper formatting
    writeFileSync(filePath, JSON.stringify(localeData, null, 2) + '\n', 'utf8');
    totalFixed += missingKeys.length;
    console.log(`  → Fixed ${missingKeys.length} keys in ${locale}.json`);
  }

  console.log(`\nTotal: ${totalFixed} missing translations fixed across ${localeFiles.length} locale files`);
}

main();
