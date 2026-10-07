<script lang="ts" module>
  export type BarIconName =
    | 'home'
    | 'notes'
    | 'triads'
    | 'caged'
    | 'about'
    | 'share'
    | 'instrument'
    | 'letters'
    | 'solfege'
    | 'language';
</script>

<script lang="ts">
  // Decorative 24×24 stroke icons for the landscape app bar (025 US4). Never the accessible name.
  const PATHS: Readonly<Record<BarIconName, string>> = {
    home: 'M3 11l9-8 9 8M5 10v10h14V10',
    notes: 'M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm11-2a3 3 0 11-6 0 3 3 0 016 0z',
    triads: 'M12 3l9 17H3z',
    caged: 'M4 5h16v14H4zM4 10h16M4 14h16M10 5v14',
    about: 'M12 11v6M12 7.5v.5M3 12a9 9 0 1018 0 9 9 0 10-18 0',
    share: 'M12 15V3m0 0L8 7m4-4l4 4M5 12v8h14v-8',
    instrument: 'M4 20L14 10m0 0l3-3 3 3-3 3zM5 13a4 4 0 014 4',
    letters: 'M5 19L12 5l7 14M8 14h8',
    solfege: 'M4 5h5a7 7 0 010 14H4zM17 12h3',
    language: 'M3 12a9 9 0 1018 0 9 9 0 10-18 0M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18'
  };

  let { name }: { name: BarIconName } = $props();
</script>

<svg class="bar-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
  ><path d={PATHS[name]} /></svg
>
