# 12 — Design and experience

Guidelines for experience and visual language. They define roles, hierarchies, and behaviors; the final values (exact colors, typography, measurements) are decided in the visual design phase, within these limits.

## 1. Principles

| Id | Principle | What it means in practice |
|---|---|---|
| DX-1 | **The fretboard is the protagonist** | It occupies the largest possible area on any screen. Controls sit around it, never on top of it |
| DX-2 | **One concept at a time** | Each tool opens in its simplest state. Advanced options (compare, layers, filters) are one tap away, but off |
| DX-3 | **Function before shape** | Root, third, and fifth look the same on every screen. The user learns the code once |
| DX-4 | **Every change is visible** | When a control changes, the fretboard changes with a short transition that shows what moved — the third dropping one fret is the lesson |
| DX-5 | **Seeing and hearing go together** | Everything shown can be heard; everything that sounds lights up |
| DX-6 | **The instrument is the user's** | Tuning, strings, and handedness are reflected everywhere, including the thumbnails on the home screen |
| DX-7 | **One hand is busy** | The user has the guitar on their lap: large targets, few taps, no complex gestures, no typing |
| DX-8 | **Sober, without rewards** | No scores, confetti, mascots, or notifications. The application is a study instrument |

## 2. Voice and texts

- The tone of an experienced teacher: direct, calm, free of unnecessary jargon, never patronizing.
- Control labels use the musician's vocabulary ("Root", "Inversion", "Strings"), not the interface's ("Parameter", "Mode").
- The questions on the home-screen cards (FR-1.2) are the only "content" text in version 1.
- Empty states and notices say what happened in terms of the instrument and offer an action (file 08).
- Short sentences. No notice longer than two lines.

## 3. Visual language

### 3.1 Character

Modern, clean, and with the warmth of an instrument: neutral surfaces, the fretboard with the presence of an object (wood and metal suggested by discreet color and texture, without literal imitation), markers in firm color. The interface around it is quiet so that the markers are the liveliest thing on screen.

### 3.2 Color roles

| Role | Use | Requirement |
|---|---|---|
| Surface | Background of the page and the panels | Neutral in both themes |
| Fretboard | Fretboard area | Distinct from the surface; a warm, dark tone in both themes, so that the markers have the same contrast in both |
| Strings and frets | Lines of the fretboard | Visible, but receding behind the markers |
| Root | Root marker | The most salient color in the product; exclusive to this role |
| Third | Third marker | Distinct from root and fifth, also for the most common types of color blindness |
| Fifth | Fifth marker | Same |
| Scale degree | Scale notes that are not in the triad | Outline, no fill |
| Neutral note | Notes in the Notes tool | Light fill over the fretboard |
| Selection | Selected note in the Notes tool; shape in focus | The accent color of the interface |
| Connection | Notes shared between shapes | An additional ring around the marker |
| Comparison | Comparison triad | Dashed outline, same color as the function |
| Notice | Notice bars | Discreet; never error red for normal situations |

The root, third, and fifth colors are not reused for any other purpose in the interface.

### 3.3 Markers

| Function | Shape | Relative size |
|---|---|---|
| Root | Rounded square, filled | Largest |
| Third | Filled circle | Medium |
| Fifth | Filled diamond | Medium |
| Scale degree | Outlined circle | Smallest |
| Neutral note | Light filled circle | Medium |

Emphasis levels (FR-3.9):

| Level | Appearance |
|---|---|
| Highlighted | Full color, label visible, slight elevation |
| Normal | Full color, label visible |
| Dimmed | Reduced opacity, no label, still perceptible (NFR-3.7) |
| Hidden | Not drawn; the position remains tappable |

### 3.4 Typography

- One sans-serif family, highly legible at small sizes, with fixed-width numerals (for fret and string numbers).
- The symbols ♯, ♭, 𝄪, and 𝄫 must exist in the label typeface or be drawn as graphic elements, with the same weight and alignment as the letters.
- Marker labels have a minimum size legible at normal viewing distance; below that minimum, EC-3.2 applies.

### 3.5 Motion

| Situation | Motion | Indicative duration |
|---|---|---|
| Root or key change | The markers slide to the new frets | Short (up to 300 ms) |
| Quality change or comparison | Only the note that changes moves; the others stay still | Short |
| Inversion or set change | The old shape fades out and the new one appears, with a slight overlap | Short |
| Focus on a CAGED shape | The other shapes dim; the fretboard scrolls to the region | Medium (up to 500 ms) |
| Turning a layer on | The layer notes appear from low to high | Short |
| Sound playback | The marker that sounds pulses once | Duration of the note |

With reduced motion (NFR-3.6), all of them become an instant change, except the playback pulse, which becomes a state change without animation.

## 4. Screen anatomy

### 4.1 Home screen

| Zone | Content |
|---|---|
| Top | Product name; language; theme; "About" |
| Center | Three tool cards (FR-1.2), side by side on wide screens, stacked on narrow screens |
| Bottom | Instrument summary with access to the panel (FR-1.3) |

No decorative images, carousel, or introductory text. The first possible action is choosing a study.

### 4.2 Tool screen

Every tool shares the same five-zone structure:

| Zone | Content | Note |
|---|---|---|
| A — Application bar | Navigation between tools; tuning badge; sound; notation; share; menu (instrument, language, theme, about) | Always visible |
| B — Main controls | The choices that define the view (note; or root, quality, inversion, set; or key, quality, shape) | Always visible; never behind a menu |
| C — Fretboard | The fretboard, with tags and minimap | The largest zone |
| D — Context panel | Position card (Notes); composition panel (Triads); layers and connections (CAGED) | Beside the fretboard on wide screens; below it on narrow screens |
| E — Actions | Listen; view; labels; compare; reset | Next to the fretboard |

### 4.3 Controls per tool

| Tool | Zone B | Zone D | Zone E |
|---|---|---|---|
| Notes | Chromatic selector of twelve notes | Position card; string and region filters | Show (naturals, all, none); hide names; label; listen; clear |
| Triads | Root; quality (four options); inversion (three); string set | Composition panel | View (isolated, full neck, all notes); compare; octave; label; listen |
| CAGED | Key; quality (two options); shape selector (C A G E D + all) | Layers; connections; set for the Triad layer | Previous and next shape; label; listen |

Control patterns:

- **Note selector:** twelve buttons in chromatic order, in one or two rows; naturals and altered notes look distinct. The same component in the three tools.
- **Mutually exclusive options with up to five values** (quality, inversion, view, shape): a segmented control, every option visible.
- **String set:** represented graphically by a small diagram of the strings, with the three active ones emphasized, in addition to the "3-2-1" label.
- **Layers:** a list of switches with a sample of each layer's marker, doubling as the legend.

## 5. Responsiveness

### 5.1 Width ranges

| Range | Logical width | Layout |
|---|---|---|
| Reflow | below 1024 (zoom only) | One column: A, B, C, E, D. The fretboard scrolls horizontally. *[Changed by slice 030: desktop-only target.]* |
| Wide | 1024 or more | Two columns: fretboard on the left taking most of the space; D on the right (side), or stacked below the fretboard. B above the fretboard. *[Changed by slice 030: desktop-only target.]* |

### 5.2 (Removed)

*[Changed by slice 030: desktop-only target.]*

### 5.3 (Removed)

*[Changed by slice 030: desktop-only target.]*

### 5.4 Desktop

- The whole fretboard (up to 24 frets) fits without scrolling from about 1280 of width.
- Hovering over a position shows its name (FR-3.16).
- Keyboard shortcuts for the frequent actions: play, next and previous (shape or inversion), switch labels, switch notation. The list of shortcuts is on the "About" page.

### 5.5 Common rules

- No function disappears on smaller screens; what changes is the arrangement (C-4).
- The main controls (zone B) are never behind a menu.
- String orientation and handedness apply in every range.
- Panels (instrument, language) open as a sheet rising from the bottom on narrow screens and as a side panel on wide screens.

## 6. The fretboard in detail

| Element | Guideline |
|---|---|
| Proportion | Tall enough that the markers of neighboring strings do not touch, with 6 or 7 strings |
| Strings | Thickness increasing from the highest to the lowest; the seventh string visibly thicker |
| Nut | A thick, light band; an unmistakable visual reference for the start of the neck |
| Open strings | Markers drawn before the nut, in their own column |
| Fret numbers | Below the fretboard (or above, depending on orientation), always on the edge opposite the shape tags |
| Inlays | Discreet, at the center of the fretboard; they never compete with the markers |
| Shape and inversion tags | Above the fretboard, aligned with the region; they are tappable |
| Region in focus | A slightly lit background band covering the frets of the region |
| Comparison arrows | Short, between the two positions, with the number of frets of the movement |
| Minimap | Below the fretboard; shows the visible stretch as a window and the highlighted positions as dots |
| Left-handed | Full mirroring; the minimap and the arrows also flip |

## 7. Accessibility in the design

- Distinct shapes per function (section 3.3) make reading independent of color.
- Keyboard focus on the fretboard is a high-contrast ring around the position.
- Each view has a "Describe this view" button, which shows the equivalent text (FR-3.18).
- The light and dark themes are checked for the contrast of the markers over the fretboard, which is the critical point.
- Target size follows NFR-3.5; the note selector wraps in reflow. *[Changed by slice 030: desktop-only target.]*

## 8. What the design avoids

| Avoid | Reason |
|---|---|
| A photorealistic fretboard | It reduces the contrast and legibility of the markers |
| Function colors reused in buttons and notices | It breaks the visual code (DX-3) |
| Controls hidden behind gestures | The user has one hand busy (DX-7) |
| Overlay tutorials on the first visit | The tool should explain itself through its simple initial state (DX-2) |
| Windows that block the screen | They interrupt study |
| Reward elements | Out of scope and out of character for the product (DX-8) |
