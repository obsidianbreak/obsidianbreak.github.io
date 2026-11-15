import { useEffect, useRef, useState } from "react";
import { FoamNetwork } from "../td/Network";
import { foamBus } from "../td/Signals";

/**
 * Full screen TouchDesigner style Voronoi foam. Falls back to a plain
 * paper gradient when WebGL2 is unavailable, and slows down when the
 * player prefers reduced motion.
 */
export default function FoamBackground({ night, reduced }: { night: boolean; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    foamBus.mode = night ? "night" : "day";
  }, [night]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !FoamNetwork.supported()) {
      setFailed(true);
      return;
    }
    let net: FoamNetwork;
    try {
      net = new FoamNetwork(canvas);
    } catch {
      setFailed(true);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let own = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      const gap = reduced ? 100 : foamBus.quality === 0 ? 66 : foamBus.quality === 1 ? 33 : 0;
      if (now - last >= gap && !document.hidden) {
        last = now;
        own += dt;
        if (foamBus.time === 0) foamBus.time = own;
        net.render(dt);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      net.dispose();
    };
  }, [reduced]);

  return failed ? <div className={`foam foam--fallback ${night ? "foam--night" : ""}`} /> : <canvas ref={ref} className="foam" aria-hidden="true" />;
}
