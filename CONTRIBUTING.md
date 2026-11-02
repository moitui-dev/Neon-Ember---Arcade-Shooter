# Contributing Games to Omni Gaming Network

We welcome game submissions from developers worldwide! You can contribute in one of two ways:

## Option 1: Native Integration (Fork & PR)
1. Fork this repository.
2. Add your game files to `games/your-game-name/`.
3. Add your entry to `games/registry.json` set to `"type": "internal"`.
4. Open a Pull Request to `main`.

## Option 2: External Hosted Game (URL Submission)
1. Fork this repository.
2. Add your game metadata to `games/registry.json` set to `"type": "external"` with your hosted URL.
3. Include the `postMessage` SDK snippet in your game to support global leaderboards.
4. Open a Pull Request to `main`.