# SafiGroom OS app downloads

SafiGroom OS uses the hosted app and backend at `https://safi-groom-os.vercel.app`. User accounts and business data stay in the hosted database and are shared between the web, Windows, and Android versions.

## Install from a browser

Open the hosted URL in Chrome or Edge and use the browser's **Install app** option. On iPhone or iPad, open it in Safari, tap **Share**, then **Add to Home Screen**.

## Download Windows and Android builds

Each push to `main` and each manually started **Build SafiGroom OS installers** GitHub Actions run builds a Windows installer and Android APK. Open the successful workflow run in the repository's **Actions** tab and download the `SafiGroom-OS-Windows` or `SafiGroom-OS-Android` artifact.

The Windows installer is unsigned, so Windows may show its standard unknown-publisher warning. The Android APK is a debug-signed distribution build and may require allowing installation from the browser or file manager that opens it. These artifacts are suitable for direct testing and private distribution, not app-store publishing.

## Build locally

- Windows installer: run `npm ci` and `npm run desktop:dist` on Windows. The installer is written to `release/`.
- Android APK: install Android Studio and its Android SDK, then run `npm ci`, `npm run android:sync`, and `.\android\gradlew.bat assembleDebug`. The APK is written to `android\app\build\outputs\apk\debug\app-debug.apk`.

The installable browser app is included in the standard Vite production build. It requires an HTTPS deployment for service-worker installation.

## Set platform administrator credentials

Set `DATABASE_URL` and `PLATFORM_ADMIN_EMAIL` in the local environment, then run `npm run db:set-platform-admin` from an interactive terminal. The command prompts for a new password without echoing it, updates or provisions the administrator account, and expires that account's existing sessions without deleting salon data. Use a unique password of at least 16 characters; do not put passwords in source files or commit them.
