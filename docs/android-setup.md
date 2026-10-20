# Running the app on Android

How to run the LinkUp app (`app/`) on an Android emulator or a physical Android phone. Both work with the same `npm start` dev server.

| Option                                      | Setup time | Good for                                     |
| ------------------------------------------- | ---------- | -------------------------------------------- |
| [Physical device](#physical-device-expo-go) | ~5 min     | Quickest start, real performance             |
| [Emulator](#emulator)                       | ~30 min    | Demos, testing without a phone, screen sizes |

## Physical device (Expo Go)

1. Install **Expo Go** from the Play Store.
2. Connect the phone to the **same Wi-Fi** as your computer.
3. In `app/`, run `npm start`.
4. Open Expo Go and scan the QR code shown in the terminal.

The app loads over the network from Metro (port `8081`). If the phone cannot connect:

- **Firewall** blocks port 8081:
  - Fedora: `sudo firewall-cmd --add-port=8081/tcp` (add `--permanent` to keep it)
  - Ubuntu: `sudo ufw allow 8081/tcp`
  - Windows: allow Node.js on private networks when the firewall prompt appears
- **Network** blocks device-to-device traffic (university/eduroam Wi-Fi often does): run `npx expo start --tunnel` instead.
- **USB** instead of Wi-Fi: enable [USB debugging](https://developer.android.com/studio/debug/dev-options#enable), plug the phone in, check it shows up in `adb devices`, then run `adb reverse tcp:8081 tcp:8081` and press `a` in Metro.

## Emulator

### 1. Install Android Studio

| OS      | How                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Linux   | `flatpak install flathub com.google.AndroidStudio`, or the tarball from [developer.android.com/studio](https://developer.android.com/studio) |
| Windows | Installer from [developer.android.com/studio](https://developer.android.com/studio)                                                          |
| macOS   | Installer from [developer.android.com/studio](https://developer.android.com/studio) or `brew install --cask android-studio`                  |

### 2. Run the setup wizard

Open Android Studio, choose **Standard** setup and accept the licences. It downloads the Android SDK, platform-tools and the emulator (~3 GB). Keep the default SDK location:

| OS      | SDK location                 |
| ------- | ---------------------------- |
| Linux   | `~/Android/Sdk`              |
| Windows | `%LOCALAPPDATA%\Android\Sdk` |
| macOS   | `~/Library/Android/sdk`      |

### 3. Create a virtual device

1. Welcome screen → **More Actions → Virtual Device Manager → Create Virtual Device**.
2. Pick a phone with the Play Store icon (e.g. **Medium Phone** or **Pixel 8**).
3. Pick a system image: the latest stable API with Google Play, **x86_64** (or **arm64** on Apple Silicon Macs). Skip the "16 KB Page Size" variants — not needed.
4. Finish with the default settings.

### 4. Set environment variables

Expo needs `ANDROID_HOME` and the SDK tools on `PATH`.

**Linux / macOS** — add to `~/.zshrc` or `~/.bashrc`, then restart the terminal:

```bash
export ANDROID_HOME=$HOME/Android/Sdk          # macOS: $HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH
```

**Windows** — in _System Properties → Environment Variables_, add a user variable `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`, and add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator` to `Path`. Restart the terminal.

Check it worked:

```bash
adb --version
emulator -list-avds      # prints your device name
```

### 5. Run the app

Start the emulator first, then Metro:

```bash
emulator -avd <device-name>     # terminal 1 — wait for the home screen
cd app && npm start             # terminal 2 — press a
```

The first run installs Expo Go on the emulator automatically. After that, only these two commands are needed — Android Studio itself does not have to be open.

## Reaching the backend

The app reads the API address from `EXPO_PUBLIC_API_URL` in `app/.env` (copy `.env.example`). Restart `npm start` after changing it.

| Running on       | `EXPO_PUBLIC_API_URL`                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Emulator         | `http://10.0.2.2:<port>` (`10.0.2.2` is the emulator's alias for your computer) |
| Phone on Wi-Fi   | `http://<your-computer-LAN-IP>:<port>`                                          |
| Phone over USB   | `http://localhost:<port>` after `adb reverse tcp:<port> tcp:<port>`             |
| Deployed dev API | the Dokploy URL                                                                 |

## Troubleshooting

| Problem                                                                              | Fix                                                                                                                                                                                |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Failed to resolve the Android SDK path`                                             | SDK not installed or `ANDROID_HOME` not set — redo steps 2 and 4                                                                                                                   |
| `No Android connected device found, and no emulators could be started automatically` | Start the emulator yourself (`emulator -avd <name>`) before pressing `a`                                                                                                           |
| `adb server version doesn't match this client`                                       | Two `adb` installs. Run `adb kill-server` and make sure `which adb` points into the SDK                                                                                            |
| Emulator very slow / complains about acceleration                                    | Linux: check `/dev/kvm` exists and add yourself to the `kvm` group (`sudo usermod -aG kvm $USER`, then log out). Windows: enable _Windows Hypervisor Platform_ in Windows Features |
| `Premature EOF` while downloading a system image                                     | Interrupted download — retry, or pick another image                                                                                                                                |
| `Port 8081 is being used by another process`                                         | Another Metro is running. Accept the other port, or stop it (`lsof -i :8081` on Linux/macOS)                                                                                       |
| Expo Go says the project's SDK is incompatible                                       | Update Expo Go from the Play Store                                                                                                                                                 |
| Emulator warns about RAM                                                             | It still runs; close heavy apps. Lower the device RAM in Virtual Device Manager if needed                                                                                          |
