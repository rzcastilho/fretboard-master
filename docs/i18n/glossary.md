# Trilingual glossary (native review list)

Musical and interface terms as used in the catalogs. Seeded from
`specs/autonomous/fretboard-master/10-glossary.md` §4. All rows are `draft`: native-speaker review
is a pre-launch gate, not a merge gate. `tests/unit/i18n/glossary.test.ts` checks that every cited
key exists in all three catalogs.

Note letter names (C D E F G A B), ♯ ♭ 𝄪 𝄫 and non-root interval glyphs are never translated.
The root interval label is the one exception: R / T / T.

<!-- prettier-ignore-start -->
| English | Português (Brasil) | Español | Keys | Review |
| --- | --- | --- | --- | --- |
| fretboard / neck | braço | diapasón / mástil | `fretboard_label`, `zone_fretboard`, `notes_region_whole` | draft |
| nut | pestana | cejuela | `triads_compare_toward_nut`, `triads_compare_off_nut` | draft |
| fret | casa | traste | `notes_card_fret`, `notes_region_group`, `instrument_frets_label` | draft |
| open string | corda solta | cuerda al aire | `notes_card_open`, `fretboard_position_name_open` | draft |
| string | corda | cuerda | `notes_card_string`, `notes_strings_group` | draft |
| tuning | afinação | afinación | `instrument_tuning_legend`, `tuning_af1` | draft |
| right-handed / left-handed | destro / canhoto | diestro / zurdo | `instrument_handedness_right`, `instrument_handedness_left` | draft |
| note | nota | nota | `notes_zone_selector`, `fretboard_function_neutral` | draft |
| sharp / flat | sustenido / bemol | sostenido / bemol | `note_spoken_sharp`, `note_spoken_flat` | draft |
| double sharp / double flat | dobrado sustenido / dobrado bemol | doble sostenido / doble bemol | `note_spoken_double_sharp`, `note_spoken_double_flat` | draft |
| half step / whole step | semitom / tom | semitono / tono | `tuning_af2`, `tuning_af3` | draft |
| octave | oitava | octava | `notes_card_octave`, `triads_octave_up` | draft |
| root | tônica | tónica | `triads_group_root`, `fretboard_function_root`, `caged_interval_root`, `interval_root` | draft |
| third | terça | tercera | `fretboard_function_third`, `triads_function_third` | draft |
| fifth | quinta | quinta | `fretboard_function_fifth`, `caged_interval_fifth` | draft |
| major third / minor third | terça maior / terça menor | tercera mayor / tercera menor | `caged_interval_third`, `caged_interval_flat_third` | draft |
| triad | tríade | tríada | `tool_triads_name`, `caged_layer_triad` | draft |
| major / minor | maior / menor | mayor / menor | `triads_quality_major`, `triads_quality_minor` | draft |
| diminished / augmented | diminuta / aumentada | disminuida / aumentada | `triads_quality_diminished`, `triads_quality_augmented` | draft |
| quality | qualidade | calidad | `triads_group_quality`, `caged_group_quality` | draft |
| root position | posição fundamental | estado fundamental | `triads_inversion_root`, `triads_tag_root` | draft |
| 1st / 2nd inversion | 1ª / 2ª inversão | 1.ª / 2.ª inversión | `triads_inversion_first`, `triads_inversion_second` | draft |
| string set | conjunto de cordas | grupo de cuerdas | `triads_group_string_set`, `triads_another_set` | draft |
| shape | forma | forma | `caged_group_shape`, `fretboard_tags_label` | draft |
| wide stretch | abertura grande | apertura grande | `triads_wide_stretch`, `triads_tag_wide_stretch` | draft |
| chord | acorde | acorde | `caged_layer_chord`, `tool_triads_question` | draft |
| arpeggio | arpejo | arpegio | `caged_layer_arpeggio` | draft |
| scale | escala | escala | `caged_layer_scale`, `fretboard_function_degree` | draft |
| pentatonic | pentatônica | pentatónica | `caged_layer_pentatonic` | draft |
| key | tom | tonalidad | `caged_group_key`, `notes_card_caged` | draft |
| layer | camada | capa | `caged_layers_heading`, `caged_layer_now_on` | draft |
| letter names | nomes das notas | nombres de las notas | `triads_label_note_names`, `caged_label_note_names` | draft |
| intervals | intervalos | intervalos | `triads_label_intervals`, `caged_label_intervals` | draft |
| stacking | empilhamento | apilamiento | `triads_panel_stacking` | draft |
| tuning: Standard | Afinação padrão | Afinación estándar | `tuning_af1`, `tuning_af21` | draft |
| tuning: Half step down | Meio tom abaixo | Medio tono abajo | `tuning_af2`, `tuning_af22` | draft |
| tuning: Whole step down | Um tom abaixo | Un tono abajo | `tuning_af3` | draft |
| tuning: Open G / D / E / A | Aberta em G / D / E / A | Abierta en G / D / E / A | `tuning_af8`, `tuning_af9`, `tuning_af10`, `tuning_af11` | draft |
| tuning: Drop D, Drop C, Double Drop D, DADGAD, Drop A (kept in English) | Drop D, Drop C, Double Drop D, DADGAD, Drop A | Drop D, Drop C, Double Drop D, DADGAD, Drop A | `tuning_af4`, `tuning_af5`, `tuning_af6`, `tuning_af7`, `tuning_af23` | draft |
| custom tuning | Personalizada | Personalizada | `tuning_custom`, `instrument_custom_strings` | draft |
| tempo | andamento | velocidad | `caged_tempo_label` | draft |
| listen | ouvir | escuchar | `notes_listen`, `triads_listen`, `caged_listen` | draft |
| language | idioma | idioma | `language_label`, `language_open` | draft |
| note names / notation | nomes das notas / notação | nombres de las notas / notación | notation_label (added by 021) | draft |
| letters | letras | letras | notation_letters (added by 021) | draft |
| solfège | solfejo | solfeo | notation_solfege (added by 021) | draft |
| accidentals | acidentes | alteraciones | accidentals_label (added by 021) | draft |
| Quarter notes | Semínimas | Negras | `metronome_subdivision_1` | draft |
| 8th notes | Colcheias | Corcheas | `metronome_subdivision_2` | draft |
| 8th Triplets | Tercinas de colcheia | Tresillos de corchea | `metronome_subdivision_3` | draft |
| 16th notes | Semicolcheias | Semicorcheas | `metronome_subdivision_4` | draft |
| Quintuplets | Quintinas | Quintillos | `metronome_subdivision_5` | draft |
| Sextuplets | Sextinas | Seisillos | `metronome_subdivision_6` | draft |
| Septuplets | Septinas | Septillos | `metronome_subdivision_7` | draft |
| 32nd notes | Fusas | Fusas | `metronome_subdivision_8` | draft |
| Count In | Contagem | Cuenta previa | `metronome_count_in_label` | draft |
| Initial Count In | Contagem inicial | Cuenta inicial | `metronome_initial_count_in_label` | draft |
| Repeat Count In | Contagem de repetição | Cuenta de repetición | `metronome_repeat_count_in_label` | draft |
| sharps / flats / both | sustenidos / bemóis / ambos | sostenidos / bemoles / ambos | accidentals_sharps, accidentals_flats, accidentals_both (added by 021) | draft |
| language and notation | idioma e notação | idioma y notación | language_panel_label (added by 021) | draft |
<!-- prettier-ignore-end -->

## Adding a language

A fourth language is text files plus two list entries (ADR 0019, R-15):

1. Add `messages/<tag>.json` with every key from `messages/en.json`, including `language_autonym`.
2. Add `<tag>` to `locales` in `project.inlang/settings.json`.
3. Add a row `{ tag, primary }` to `LANGUAGES` in `src/lib/i18n/languages.ts` (`primary` is the
   lower-cased primary subtag used for device matching).
4. Add a column of terms to this glossary.

`tests/unit/i18n/languages.test.ts` fails if `LANGUAGES`, `settings.json` and Paraglide `locales`
disagree, and the catalog completeness test fails on missing keys.
