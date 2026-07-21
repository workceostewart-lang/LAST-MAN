# Product Requirements Document: LAST MAN

## 1. Overview
LAST MAN is a cross-platform (PC & Mobile) card game inspired by classic UNO-style gameplay for 2-4 players. The game features high-quality AI-generated card art and a robust theme system that allows players to customize the entire visual style without affecting core game logic.

## 2. Target Platforms
- **Primary**: iOS, Android (Mobile)
- **Secondary**: Windows, macOS, Linux (PC)
- **Future Consideration**: Web/browser-based version

## 3. Core Gameplay

### 3.1 Game Rules
- **Players**: 2-4 (1 human + 1-3 CPU opponents)
- **Deck**: 108 cards (4 colors, numbers 0-9, action cards, wild cards)
- **Objective**: First player to play their last card wins the round

### 3.2 Card Types
- **Number Cards**: 0-9 in four colors (Red, Blue, Green, Yellow)
- **Action Cards**: Skip, Reverse, Draw Two
- **Wild Cards**: Wild, Wild Draw Four

### 3.3 Turn Mechanics
1. Match the top card by color, number, or symbol, or play a Wild card
2. If unable to play, draw one card from the draw pile
3. If drawn card can be played, play it immediately; otherwise, turn passes
4. "Last Card" announcement is required when down to one card (risk: draw 2 penalty if caught)

### 3.4 Special Rules
- **Skip**: Next player loses their turn
- **Reverse**: Reverses play direction
- **Draw Two**: Next player draws 2 cards and loses turn
- **Wild**: Player chooses the color to continue play
- **Wild Draw Four**: Player chooses color; next player draws 4 and loses turn

### 3.5 Game Modes
- **Quick Play**: Single round, first to empty hand wins
- **Match Mode**: Best of X rounds with cumulative scoring
- **Score Target**: Play until a player reaches a target score (configurable)

## 4. AI Opponents
- **Difficulty Levels**: Easy, Medium, Hard
- **Behavior**: CPU players follow strategic card-play logic appropriate to difficulty
- **Customization**: Optional AI personality traits (aggressive, defensive, balanced)

## 5. Visual Design & Themes

### 5.1 Card Art Style
- High-quality AI-generated artwork
- Source tools: Nano Banana, Gemini, Google Flow, ChatGPT
- Custom prompt templates for each card type (numbers, actions, wilds, card backs)
- All cards rebranded with "LAST MAN" identity

### 5.2 Theme System
A theme tab allows players to swap the entire visual style without touching game logic.

| Theme | Description |
|-------|-------------|
| Premium/Modern | Default sleek, polished look |
| Cartoon | Bright, playful, family-friendly |
| Neon/Cyberpunk | Dark background with glowing neon elements |
| Retro Arcade | 80s/90s pixel art aesthetic |
| Nature/Elemental | Earth, water, fire, air motifs |
| Space/Sci-Fi | Futuristic, cosmic design |
| Minimalist/Mono | Clean, simple, monochrome palette |

### 5.3 UI/UX Requirements
- Responsive layout for both mobile and desktop
- Intuitive card selection and play interface
- Clear visual feedback for valid/invalid moves
- Animated card transitions and effects
- Sound effects for actions (optional, can be toggled)

## 6. Features

### 6.1 Core Features
- [ ] Single-player vs CPU opponents
- [ ] 2-4 player support (1 human + AI)
- [ ] Standard UNO-style rules implementation
- [ ] "Last card" announcement mechanic
- [ ] Multiple game modes (Quick, Match, Score Target)

### 6.2 Theme System
- [ ] Theme selection tab in settings
- [ ] 7+ built-in themes
- [ ] Theme-specific card art generation
- [ ] Runtime theme switching without restart

### 6.3 AI System
- [ ] 3 difficulty levels
- [ ] Strategic card play based on difficulty
- [ ] Optional AI personality modifiers

### 6.4 Polish & Extras
- [ ] Tutorial/onboarding for new players
- [ ] Game statistics tracking
- [ ] Settings menu (sound, themes, difficulty)
- [ ] Tutorial mode explaining rules

## 7. Technical Requirements

### 7.1 Cross-Platform Framework
- Recommend: Unity, Godot, or React Native
- Must support iOS, Android, Windows, macOS, Linux

### 7.2 Performance
- 60 FPS on mid-range mobile devices
- Smooth card animations and transitions
- Low memory footprint for mobile

### 7.3 Data & Storage
- Local save for game progress and settings
- Theme assets cached locally after download
- Optional cloud sync (future consideration)

## 8. Success Metrics
- Player retention rate (D1, D7, D30)
- Average session length
- Theme usage statistics
- App store ratings and reviews
- Player progression through difficulty levels

## 9. Out of Scope (v1.0)
- Online multiplayer (future update)
- In-app purchases for additional themes
- Leaderboards (future update)
- Story/campaign mode

## 10. Timeline (Estimated)

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Prototyping | 4 weeks | Core gameplay mechanics, basic UI |
| Alpha | 6 weeks | Full ruleset, 1 theme, basic AI |
| Beta | 6 weeks | All themes, AI difficulty, polish |
| Launch | 2 weeks | Store submission, marketing assets |

---

*Document Version: 1.0*
*Last Updated: July 21, 2026*