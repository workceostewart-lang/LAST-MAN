# Product Requirements Document: LAST MAN

*Merged v1 — combines the original browser-first PRD with OpenCode's cross-platform PRD*

## 1. Overview

LAST MAN is a cross-platform card game (PC & Mobile) inspired by classic UNO-style gameplay, for 2-4 players (1 human + 1-3 CPU opponents). It features high-quality AI-generated card art and a theme system that lets players fully swap the visual style without touching core game logic. The initial build target is a fast, self-contained, playable-anywhere experience — no accounts, no backend required to play a round.

## 2. Goals & Non-Goals

**Goals**
- Faithful implementation of standard UNO-style rules
- Fun, responsive experience against 1-3 CPU opponents of varying difficulty and personality
- Clean, readable card UI that works well on both touch and desktop/mouse
- Fast round times (2-5 minutes per round)
- Fully re-skinnable visual layer via the theme system

**Non-Goals (v1.0)**
- Online multiplayer / real-time networking (future update)
- Accounts, persistent stats, or leaderboards (future update)
- In-app purchases for additional themes
- Story/campaign mode
- House-rule variants beyond a small configurable set

## 3. Target Platforms

- **Primary**: iOS, Android (Mobile)
- **Secondary**: Windows, macOS, Linux (PC)
- **Future consideration**: Web/browser-based version
- Touch-first interaction (tap/drag to play cards) with full mouse support on desktop
- Responsive layout across portrait mobile through desktop widths

## 4. Core Gameplay Requirements

### 4.1 Setup
- 2-4 players total (1 human + 1-3 CPU, configurable at start)
- Standard 108-card deck: numbers 0-9 (two of 1-9, one of 0) in 4 colors (Red, Blue, Green, Yellow), Skip/Reverse/Draw Two (two each per color), Wild and Wild Draw Four (4 each)
- Each player dealt 7 cards; remaining cards form the draw pile; top card flipped to start the discard pile

### 4.2 Turn Mechanics
- Player must play a card matching color, number, or symbol of the top discard card, or play a Wild
- If no valid card, player draws one card from the draw pile; may play it immediately if valid, otherwise turn passes
- Turn order proceeds clockwise by default; Reverse flips direction

### 4.3 Special Cards
| Card | Effect |
|---|---|
| Skip | Next player's turn is skipped |
| Reverse | Direction of play reverses (acts as Skip in 2-player games) |
| Draw Two | Next player draws 2 cards and loses their turn |
| Wild | Current player chooses the next color |
| Wild Draw Four | Current player chooses color; next player draws 4 and loses their turn |

### 4.4 "Last Card" Call
- When a player has exactly 1 card left, they must declare it ("Last Man!")
- If a human player fails to declare before their next turn (or before an opponent catches them), they draw 2 penalty cards
- CPU players call automatically per configurable "catch" difficulty

### 4.5 Game Modes
- **Quick Play**: single round, first to empty hand wins
- **Match Mode**: best of X rounds with cumulative scoring
- **Score Target**: play until a player reaches a configurable target score (e.g., 500), using standard UNO scoring (number cards = face value, action cards = 20, Wild/Wild Draw Four = 50)

### 4.6 AI Opponents
- **Difficulty levels**: Easy, Medium, Hard
  - Easy: plays first valid card found
  - Medium/Hard: prioritizes action cards, holds Wild Draw Four unless needed, picks color based on most-held color in hand, adjusts risk-taking around "last card" catches
- **Personality modifiers (optional)**: Aggressive (prioritizes offensive cards like Draw Two/Four against the leader), Defensive (holds action cards, plays conservatively), Balanced (default mixed strategy)

## 5. UI/UX Requirements
- Player's hand fanned at bottom of screen; tap to select, tap again (or drag up) to play
- Discard pile shows current top card and active color clearly
- Draw pile shown with remaining card count
- Color picker modal appears on Wild/Wild Draw Four play
- Turn indicator showing whose turn it is and play direction
- "Last card" button/indicator appears and pulses when a player reaches 1 card
- Animated card transitions and effects (deal, draw, play, shuffle)
- End-of-round and end-of-match summary screens (winner, scores if scoring mode enabled)
- Sound effects for key actions (optional, toggleable)
- Tutorial/onboarding flow explaining rules for new players

## 6. Visual Design & Themes

### 6.1 Card Art Style
- High-quality AI-generated artwork rather than flat CSS/SVG cards
- Source tools: Nano Banana (Gemini), Google Flow, ChatGPT image tools
- Asset set needed per theme: 4 color suits × values 0-9, Skip/Reverse/Draw Two per color, Wild, Wild Draw Four, and a card back — consistent style/palette across the full set
- All cards carry the "LAST MAN" identity (no UNO branding)
- Images sized/optimized for mobile performance (compressed, consistent aspect ratio)

### 6.2 Theme System
A theme tab in settings lets players swap the entire visual style at runtime, without touching game logic or restarting.

| Theme | Look & Feel |
|---|---|
| **Premium/Modern** (default) | Clean flat vector illustration, bold gradients, minimalist, polished |
| **Cartoon** | Bright, playful, family-friendly, thick black outlines, squash-and-stretch energy, comic-style shading |
| **Neon/Cyberpunk** | Dark background, glowing neon edges on numbers/symbols, holographic gradient sheen |
| **Retro Arcade** | 80s/90s pixel-art aesthetic, chunky blocky numbers, scanline texture |
| **Nature/Elemental** | Colors mapped to elements (red=fire, blue=water, green=earth, yellow=lightning/air), symbols as elemental icons |
| **Space/Sci-Fi** | Dark starfield backgrounds, metallic/chrome number styling, futuristic HUD-style corner markers |
| **Minimalist/Mono** | Single-color-per-suit flat design, no gradients, high-contrast typography-driven |

Each theme reuses the same prompt template structure (below), only changing the "Style:" line.

### 6.3 Image Generation Prompt Templates

**Number & action cards:**
```
Create a single LAST MAN playing card illustration, portrait orientation,
rounded corners, white border.

Card color: [RED / YELLOW / GREEN / BLUE]
Card value: [0-9 / Skip / Reverse / Draw Two]
Style: [theme style description — e.g. "flat vector illustration, bold
clean shapes, subtle gradient background"] in the card's color, bold
white number/symbol centered, small matching number/symbol mirrored
in two opposite corners. No text other than the number or symbol.
No watermarks, no logos, no photorealism. High resolution, crisp
edges, transparent or white background outside the card border.
```

**Wild and Wild Draw Four:**
```
Create a single LAST MAN Wild card illustration, portrait orientation,
rounded corners, white border. Background split into four curved
color sections (red, yellow, green, blue) meeting at the center.
[For Wild Draw Four: overlay a bold white "+4" centered on top of
the four-color background.] [For Wild: no text overlay, just the
four-color swirl design.] [theme style description], no watermarks,
no logos, no photorealism, high resolution, crisp edges.
```

**Card back:**
```
Create a single playing card back design, portrait orientation,
rounded corners, white border. Solid black background with a bold
red oval in the center containing stylized white "LAST MAN"
text-like branding shape (do not render readable text, just an
abstract oval logo shape). [theme style description], no
watermarks, no photorealism, high resolution, crisp edges.
```

## 7. Technical Requirements

### 7.1 Framework
- Recommended: Unity, Godot, or React Native for true cross-platform (iOS, Android, Windows, macOS, Linux)
- If browser version is pursued: client-side only, HTML5/JS/CSS, no external network calls required to play

### 7.2 Performance
- 60 FPS target on mid-range mobile devices
- Smooth card animations/transitions
- Low memory footprint on mobile
- Deterministic shuffle via seeded RNG (for reproducible testing)

### 7.3 Data & Storage
- Local save for game progress and settings
- Theme assets cached locally after first download
- Optional cloud sync (future consideration)

## 8. Configuration Options (v1)
- Number of players (2-4) and CPU count
- CPU difficulty and personality
- Game mode (Quick Play / Match Mode / Score Target) and target score
- Theme selection
- Stacking Draw Two/Draw Four house rule (toggle, off by default)
- Sound on/off

## 9. Features Checklist

**Core**
- [ ] Single-player vs CPU opponents
- [ ] 2-4 player support (1 human + AI)
- [ ] Standard rules implementation
- [ ] "Last card" announcement mechanic
- [ ] Multiple game modes (Quick, Match, Score Target)

**Themes**
- [ ] Theme selection tab in settings
- [ ] 7+ built-in themes
- [ ] Theme-specific card art generation
- [ ] Runtime theme switching without restart

**AI**
- [ ] 3 difficulty levels
- [ ] Strategic card play based on difficulty
- [ ] Optional AI personality modifiers

**Polish**
- [ ] Tutorial/onboarding for new players
- [ ] Game statistics tracking (local)
- [ ] Settings menu (sound, themes, difficulty)

## 10. Success Metrics
- A full round completes without rule violations or soft-locks
- Game playable start-to-finish on mobile and desktop within one sitting
- CPU never gets stuck or fails to take a legal action
- Player retention rate (D1, D7, D30)
- Average session length
- Theme usage statistics
- App store ratings/reviews (once published)

## 11. Out of Scope (v1.0)
- Online multiplayer (future update)
- In-app purchases for additional themes
- Leaderboards (future update)
- Story/campaign mode

## 12. Timeline (Estimated)

| Phase | Duration | Deliverables |
|---|---|---|
| Prototyping | 4 weeks | Core gameplay mechanics, basic UI |
| Alpha | 6 weeks | Full ruleset, 1 theme, basic AI |
| Beta | 6 weeks | All themes, AI difficulty/personality, polish |
| Launch | 2 weeks | Store submission, marketing assets |

## 13. Open Questions
- Should the Wild Draw Four "challenge" rule (accusing a player of playing it illegally) be included in v1 or deferred?
- Local pass-and-play (multiple humans, one device) — in scope for v1 or later?
- Which framework (Unity / Godot / React Native) — any existing team preference or constraint?
- Is a browser version a parallel v1 target, or strictly a later add-on after mobile/PC ship?

---

*Document Version: 2.0 (merged)*
*Last Updated: July 21, 2026*
