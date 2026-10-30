/**
 * Catalog values that are legitimately identical to English (R-08, data-model §4): the product
 * name, English-kept tuning names, and values that hold only placeholders and symbols.
 */
const SHARED: readonly string[] = [
  'app_name',
  'title_screen',
  'tool_caged_name',
  'card_label',
  'fretboard_position_function',
  'note_spoken_natural',
  'sound_volume_value',
  'notes_triad_name',
  'notes_strings_label',
  'notes_region_shortcut_0_4',
  'notes_region_shortcut_5_9',
  'notes_region_shortcut_10_14',
  'notes_region_minus_glyph',
  'notes_region_plus_glyph',
  'triads_name',
  'triads_low_to_high_entry',
  'triads_name_no_inversion',
  'triads_desc_all_notes',
  'triads_desc_note_entry',
  'tuning_af4',
  'tuning_af5',
  'tuning_af6',
  'tuning_af7',
  'tuning_af23',
  'instrument_preset_label',
  'caged_key_name',
  'share_title_caged',
  'summary_separator',
  'summary_note_separator',
  'metronome_bpm_label',
  'metronome_bpm_unit',
  'shortcuts_key_escape'
];

/** 021: syllables spelled the same as English (es: all seven; pt-BR: Mi, Sol, Si only). */
const SOLFEGE_ES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'].map((l) => `note_name_solfege_${l}`);
const SOLFEGE_PT = ['e', 'g', 'b'].map((l) => `note_name_solfege_${l}`);

export const IDENTICAL_ALLOWLIST: Readonly<Record<'pt-BR' | 'es', readonly string[]>> = {
  // "Volume" is the same word in Brazilian Portuguese.
  'pt-BR': [...SHARED, 'sound_volume', ...SOLFEGE_PT],
  es: [...SHARED, ...SOLFEGE_ES]
};
