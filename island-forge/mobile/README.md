# Island Forge mobile (React Native and Expo)

Pick an island type and describe it. The app generates the island either on the phone (offline generator) or through your Island Forge server with Claude, ChatGPT, Gemini or DeepSeek. You can browse the map, locations (with their prefab and galleries), devices and Verse code, then share the map spec to a computer and export it for UEFN there.

```bash
cd island-forge/mobile
npm install
npm start          # scan the QR code with Expo Go
npm run web        # or run it in a browser
```

To use AI on your phone:
1. Run `HOST=0.0.0.0 npm start` in `island-forge/` on your computer.
2. In the app, set the server URL to your computer's local network address, for example `http://192.168.1.20:5173`.

The app imports the shared TypeScript core from `../core`, so it uses the same island types, generator, devices and Verse library as the web app.
