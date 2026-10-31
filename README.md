# Daily Fuel

A small Android app that builds your daily menu, counts calories and protein, tracks water, and sends
reminders to eat and drink (they keep firing when the app is closed).

- Menu: six mini-meals a day, a food database with calories and protein, custom foods, a suggested starter day
- Today: calories, protein and water against your targets, one-tap "eaten" per meal, protein gap suggestions
- History: the last 14 days and a 7-day average
- Reminders: meals at the times you set, water every 60 to 150 minutes between two times
- All data stays on the phone. No account, no internet needed.

## Get the APK (no Android Studio needed)

1. Create a free GitHub account if you do not have one, then create a new private repository.
2. Upload everything in this folder to it (drag and drop the files in the browser, or use git).
   Keep the `.github` folder, it holds the build recipe.
3. Open the repository's **Actions** tab, choose **Build Android APK**, and press **Run workflow**.
4. After about 6 to 10 minutes, open the finished run and download **daily-fuel-apk**. Unzip it to get `app-debug.apk`.
5. Send the APK to your phone, open it, and allow "Install unknown apps" for the app you opened it from.
6. Open Daily Fuel, tap **Settings**, then **Allow and schedule reminders**.
7. In Android settings, set Daily Fuel's battery usage to **No restrictions**, so reminders are not delayed.

## Build on your own computer instead

Needs Node 22, Java 21 and the Android SDK (Android Studio installs the SDK).

    npm install
    npx cap sync android
    cd android && ./gradlew assembleDebug

The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Or run `npx cap open android` to use Android Studio.

## Change things

- Foods and the starter menu: `www/foods.js`
- Screens and logic: `www/app.js`, styles in `www/styles.css`
- After any change to `www`, run `npx cap sync android` and rebuild.
- Values are estimates, not medical advice.
