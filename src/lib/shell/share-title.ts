/**
 * Title handed to the system share sheet (specs/022 contracts/share-ui §3). Built from the same
 * snapshot as the link, in the sharer's language, notation and accidental policy. It is not part
 * of the link.
 */
import { m } from '$lib/paraglide/messages.js';
import type { ShareSnapshot } from '$lib/link';
import { defaultSpelling, noteLabel } from '$lib/notation/notation';
import { cagedRootSpelling } from '$lib/state/caged-view';
import { inversionName, qualityName } from '$lib/state/triads-model';
import { triadsRootSpelling, type TriadsViewState } from '$lib/state/triads-view';

type Inversion = TriadsViewState['inversion'];

/** The triads screen's inversion name, lower-cased to read mid-sentence in the title. */
function inversionWord(inv: Inversion): string {
  const name = inversionName(inv);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

export function shareTitle(snapshot: ShareSnapshot): string {
  switch (snapshot.tool) {
    case 'caged': {
      const { view } = snapshot;
      const key = noteLabel(cagedRootSpelling(view));
      const quality = qualityName(view.quality);
      return view.focus === null
        ? m.share_title_caged({ key, quality })
        : m.share_title_caged_shape({ key, quality, shape: view.focus.letter });
    }
    case 'triads': {
      const { view } = snapshot;
      return m.share_title_triads({
        root: noteLabel(triadsRootSpelling(view)),
        quality: qualityName(view.quality),
        inversion: inversionWord(view.inversion)
      });
    }
    case 'notes': {
      const { selection } = snapshot.view;
      if (selection.length === 0) return m.share_title_notes_empty();
      return m.share_title_notes({
        notes: selection.map((pc) => noteLabel(defaultSpelling(pc))).join(', ')
      });
    }
  }
}
