# Balatro Multiplayer Launcher (BMP Launcher)

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win:local

# For macOS
$ npm run build:mac:local

# For Linux
$ npm run build:linux:local
```

Remove :local to publish to Github.

## Game path detection

The launcher automatically detects your Balatro installation if you haven’t set a custom path.

How it works:
- Windows: Reads the Steam install path from the registry (HKLM\SOFTWARE\WOW6432Node\Valve\Steam → InstallPath), parses steamapps/libraryfolders.vdf to enumerate libraries, then looks for steamapps/common/Balatro. Falls back to C:\Program Files (x86)\Steam if needed.
- macOS: Looks under ~/Library/Application Support/Steam/steamapps/common/Balatro and validates the Balatro.app bundle.
- Linux: Looks under ~/.local/share/Steam/steamapps/common/Balatro (Proton layout) and validates presence of Balatro.exe.

Validation rules:
- Windows: Directory is considered valid if any of love.dll, lua51.dll, SDL2.dll, or Balatro.exe exists.
- macOS: Checks for Balatro.app/Contents/Resources/Balatro.love.
- Linux: Checks for Balatro.exe in the Balatro directory.

Custom path:
- You can set a custom game directory in Settings. The path is validated before being saved. If you select the executable, the launcher will normalize it to the containing folder.
