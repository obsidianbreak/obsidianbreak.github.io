# TouchDesigner approach

TouchDesigner (TD) is a desktop node based tool. It cannot run inside a static GitHub Pages site, so this project rebuilds the same network pattern in WebGL2 and uses TD vocabulary for the structure.

```
Voronoi TOP --> Feedback TOP (ping pong) --> Level TOP --> screen
     ^                                           ^
 touch and ball points                   mode, share, ink channels
 ripples from tile flips
```

| TD concept | In this repo |
| --- | --- |
| TOP (texture operator) | One fragment shader pass in `src/td/shaders.ts` |
| Feedback TOP | `FEEDBACK_FS` with two textures swapped each frame in `src/td/Network.ts` |
| CHOP (channel operator) | `Signals` in `src/td/Signals.ts`, each channel eased like a Lag CHOP |
| Parameter binding | `tension`, `mode`, `share` and `ink` channels drive shader uniforms |
| Network | `FoamNetwork` builds and renders the chain |

The foam reacts to the game: seeds are pulled toward your finger and every ball, tile flips send ripples, and tension rises in close matches.

## Using real TouchDesigner

If you want to author visuals in TD itself, the practical route is to export loops and use them as assets:

1. Build the look in TD and render it with a Movie File Out TOP as a short seamless loop (WebM or MP4).
2. Place it in `public/assets/` and play it in a `<video>` behind the game, or load it as a WebGL texture.
3. Keep the live Voronoi network above it for interaction.

Quality tiers (`Context.ts` `FrameMeter`) lower the network resolution on slower phones, and the network falls back to a plain paper gradient when WebGL2 is not available.
