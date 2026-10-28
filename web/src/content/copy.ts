import type { SwitchProfile } from '../audio/switches';

// All the site's product copy. Phosphor and its team are invented; every spec is a plausible concept value.

export const brand = {
  title: 'Built for people who type all day.',
  lead:
    'Phosphor started on a night shift. Three of us, a dark studio and a keyboard whose lights could only blink in rainbows. We wanted one colour, one job: show the hands where they are.',
  body:
    'Phosphor One is that keyboard. Sixty-one keys lit from below in a single phosphor green, the function keys burning brighter so you find them without looking. Everything else stays quiet: frosted aluminium, no logos on the top, no software to install.',
  principles: [
    { n: '01', title: 'Light is information.', text: 'Every key glows as much as it needs to and no more. The brightest ones are the ones that do something.' },
    { n: '02', title: 'Built to be opened.', text: 'Hot-swap sockets, standard screws and a published parts list. A screwdriver fixes it, not a support ticket.' },
    { n: '03', title: 'Sound is designed.', text: 'Each switch is tuned like an instrument: the thock, the bump, the click. You can hear all three on this page.' },
  ],
  team: [
    { name: 'Ines Varela', role: 'Founder · industrial design', note: 'Drew the case on the back of a timesheet.' },
    { name: 'Tomas Okafor', role: 'Firmware · acoustics', note: 'Has recorded 9,000 key presses. On purpose.' },
    { name: 'Mei Lindqvist', role: 'Light · typography', note: 'Picked the green from 212 samples.' },
  ],
  teamNote: 'Portraits are drawn from each name, dot by dot.',
};

export const specs = {
  title: 'Six layers, nothing hidden.',
  lead: 'Scroll and the board comes apart. Every layer is there for the light, the sound or the repair.',
  layers: [
    { id: 'caps', n: '01', name: 'Keycaps', detail: 'PBT, double-shot legends with light windows, OEM profile' },
    { id: 'switches', n: '02', name: 'Switches', detail: 'Linear, tactile or clicky. 5-pin, swap them without solder' },
    { id: 'plate', n: '03', name: 'Plate', detail: 'Frosted polycarbonate, 1.5 mm, spreads the light evenly' },
    { id: 'pcb', n: '04', name: 'PCB', detail: '1.6 mm, 61 south-facing LEDs, all one green' },
    { id: 'gasket', n: '05', name: 'Gasket', detail: 'Poron foam, 2.4 mm, keeps the stack off the case' },
    { id: 'case', n: '06', name: 'Case', detail: 'Bead-blasted aluminium 6063, 4.4° typing angle' },
  ],
  figures: [
    { k: 'Layout', v: '60%', sub: '61 keys, ANSI' },
    { k: 'Switches', v: 'Hot-swap', sub: '5-pin sockets' },
    { k: 'Connection', v: '2.4 GHz', sub: '+ Bluetooth 5.3 + USB-C' },
    { k: 'Battery', v: '4,000 mAh', sub: 'about 3 weeks, light on' },
    { k: 'Weight', v: '1.12 kg', sub: '300 × 105 × 22–30 mm' },
  ],
  concept: 'Concept specs: invented, plausible values for a product that does not exist.',
} as const;

export type LayerId = (typeof specs.layers)[number]['id'];

export const sound = {
  title: 'Hear it before you buy it.',
  lead: 'Three switches, three voices. Hover or tap a card to hear it, pick one, then type in the field below. Every key on the page plays it too.',
  switches: [
    { id: 'linear', key: 'KeyL', name: 'Mist', kind: 'Linear', force: '45 gf', travel: '4.0 mm', text: 'Smooth all the way down. A low, rounded thock.' },
    { id: 'tactile', key: 'KeyT', name: 'Fern', kind: 'Tactile', force: '55 gf', travel: '3.8 mm', text: 'A soft bump halfway, felt more than heard.' },
    { id: 'clicky', key: 'KeyC', name: 'Spark', kind: 'Clicky', force: '60 gf', travel: '4.0 mm', text: 'A crisp click on top of the thock. Loud and proud.' },
  ] satisfies { id: SwitchProfile; key: string; name: string; kind: string; force: string; travel: string; text: string }[],
  tryLabel: 'Type here to hear it',
  tryPlaceholder: 'the quick brown fox…',
  note: 'Sounds are synthesised in your browser, nothing loads. Mute them from the top bar.',
};
