# Replacing the repo

1. In your local clone of `hassanireza/obsidianBreak`, delete the old `src/` and `public/` folders. Every file in them is replaced or no longer needed.
2. Unzip this archive into the repo root and overwrite everything.
3. Run `npm ci && npm run typecheck && npm run build`.
4. Commit and push. The existing GitHub Pages workflow deploys it.

`package.json` dependencies and `package-lock.json` are unchanged, so `npm ci` works as before.

## Old files that no longer exist

* public/favicon.svg
* src/App.tsx
* src/components/GrainOverlay.tsx
* src/components/HUD.tsx
* src/components/Logo.tsx
* src/components/Overlay.tsx
* src/components/hud.css
* src/components/icons.tsx
* src/components/overlay.css
* src/engine/AIAssist.ts
* src/engine/AudioEngine.ts
* src/engine/EventBus.ts
* src/engine/GameEngine.ts
* src/engine/Input.ts
* src/engine/ParticleSystem.ts
* src/engine/Vector2.ts
* src/engine/entities/Ball.ts
* src/engine/entities/Brick.ts
* src/engine/entities/Entity.ts
* src/engine/entities/Paddle.ts
* src/engine/entities/PowerUp.ts
* src/engine/levels/Level.ts
* src/engine/levels/levelData.ts
* src/engine/sharedAudioContext.ts
* src/engine/types.ts
* src/hooks/useGameEngine.ts
* src/lib/progress.ts
* src/main.tsx
* src/screens/GameScreen.tsx
* src/screens/LevelSelect.tsx
* src/screens/MainMenu.tsx
* src/screens/gameScreen.css
* src/screens/levelSelect.css
* src/screens/mainMenu.css
* src/styles/global.css
* src/styles/tokens.css
