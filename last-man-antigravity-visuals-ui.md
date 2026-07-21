# LAST MAN — Visuals & UI Scope (Antigravity Handoff)

*This file is scoped for the visual/UI build only. Game engine logic (deck, turns, CPU decisions, scoring) lives in the full PRD and is being handled separately — do not implement game rules or CPU logic from this file.*

## 1. What You're Building

The visual and UI layer for LAST MAN, an UNO-style card game. Assume the game engine (deck, turns, valid-move checking, CPU logic, scoring) exists elsewhere and will expose game state to render against. Your job is presentation, layout, interaction, and theming — not rules.

## 2. Screens & Layout

- **Player's hand**: fanned at the bottom of the screen; tap to select a card, tap again (or drag up) to play it
- **Discard pile**: shows the current top card and the active color clearly
- **Draw pile**: shows remaining card count
- **Color picker modal**: appears when a Wild or Wild Draw Four is played, lets the player choose the next color
- **Turn indicator**: shows whose turn it is and current play direction
- **"Last card" indicator**: a button/badge that appears and pulses when a player is down to 1 card
- **End-of-round / end-of-match summary screen**: shows winner and scores (if scoring mode is on)
- **Settings/theme tab**: lets the player pick a visual theme and toggle sound
- **Tutorial/onboarding flow**: walks new players through the rules

## 3. Interaction & Feel

- Touch-first (tap/drag), full mouse support on desktop
- Responsive across mobile portrait through desktop widths
- Animated card transitions: deal, draw, play, shuffle
- Clear visual feedback for valid vs. invalid moves
- Sound effects on key actions, toggleable in settings

## 4. Card Art & Theme System

- Card faces/backs are high-quality AI-generated images (not flat CSS/SVG), sourced from Nano Banana, Gemini, Google Flow, or ChatGPT image tools
- All card art uses the "LAST MAN" identity — no UNO branding anywhere
- A **theme selector** in settings swaps the entire card art set at runtime, with no logic changes required. Build the UI to support hot-swapping the active image set.

**Themes to support:**

| Theme | Look & Feel |
|---|---|
| Premium/Modern (default) | Clean flat vector, bold gradients, minimalist |
| Cartoon | Bright, playful, thick black outlines, comic-style shading |
| Neon/Cyberpunk | Dark background, glowing neon edges, holographic sheen |
| Retro Arcade | 80s/90s pixel-art, chunky blocky numbers, scanlines |
| Nature/Elemental | Colors mapped to fire/water/earth/lightning |
| Space/Sci-Fi | Starfield backgrounds, chrome numbers, HUD-style corners |
| Minimalist/Mono | Single-color-per-suit, no gradients, typography-driven |

## 5. Game State Shape You'll Render Against

(Placeholder — confirm exact shape with the engine build, but expect something like:)

```
{
  players: [{ id, name, isCPU, handCount, hasCalledLastCard }],
  currentPlayerId,
  playDirection: "clockwise" | "counterclockwise",
  discardTop: { color, value },
  activeColor,
  drawPileCount,
  hand: [{ id, color, value }],   // human player's own hand, full detail
  gameMode: "quickPlay" | "matchMode" | "scoreTarget",
  scores: { playerId: number }    // if scoring mode active
}
```

## 6. Out of Scope for This File
- Deck construction, shuffling, valid-move checking
- CPU decision-making / difficulty / personality logic
- Scoring calculation logic (only display it)
- Backend, save/sync, multiplayer
