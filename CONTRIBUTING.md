# Contributing Games to Omni Gaming Network

Thank you for your interest in contributing to **Omni Gaming Network**! We welcome independent game developers to showcase their HTML5/Canvas games on our web platform.

---

## Submission Options

You can submit your game using either of the two methods below:

### Option 1: Native Integration (Fork & Pull Request)
Best for open-source canvas/HTML5 games hosted directly within our platform repository.

1. **Fork** the [OmniGamingNetwork repository](https://github.com/moitui-dev/Neon-Ember---Arcade-Shooter).
2. Create a subfolder inside `games/` named after your game (e.g., `games/your-game-name/`).
3. Place your `index.html`, scripts, CSS, and game assets inside `games/your-game-name/`.
4. Open `games/registry.json` and append your game details:
   ```json
   {
     "id": "your-game-name",
     "title": "Your Game Title",
     "author": "Your Developer Name",
     "type": "internal",
     "path": "games/your-game-name/index.html",
     "category": "Single Player",
     "badge": "⚡ Single Player",
     "description": "Short summary of your game."
   }