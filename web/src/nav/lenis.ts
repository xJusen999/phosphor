import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let lenis: Lenis | null = null;

/** The running smooth scroller (null before `startLenis` or after its cleanup). */
export const getLenis = () => lenis;

/** Smooth scroll driven by GSAP's ticker, feeding ScrollTrigger. Returns the cleanup. */
export function startLenis() {
  gsap.registerPlugin(ScrollTrigger);
  const l = new Lenis({ lerp: 0.1 }); // honours prefers-reduced-motion itself (1:1 scroll, instant scrollTo)
  const raf = (t: number) => l.raf(t * 1000);
  l.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  lenis = l;
  return () => {
    gsap.ticker.remove(raf);
    l.destroy();
    if (lenis === l) lenis = null;
  };
}
