# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any
code — the project runs SDK 57 (upgraded from 54 on 4 September 2026). Do not carry SDK 54
APIs forward from memory: `StyleSheet.absoluteFillObject` is gone (use `absoluteFill`), native
tabs export `NativeTabs.Trigger.Icon` / `.Label` rather than bare `Icon` / `Label`, and
`useAnimatedStyle` returns an `AnimatedStyleHandle` that a `StyleProp<ViewStyle>` will not accept.

**Expo Go is no longer on the App Store past SDK 54.** A physical iPhone needs an `eas go` build
on your own TestFlight; the iOS Simulator and Android get the SDK 57 Expo Go from the CLI. Run it
with `npx expo start --go` — `expo-dev-client` is installed, so the CLI otherwise assumes a
development build.
