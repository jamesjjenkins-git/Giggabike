# Giggabike

A retro motocross racer for the browser (and, eventually, iPhone). It's a side-scrolling 2.5D track with four lanes, jumps, mud, boost pads and an engine that overheats if you lean on the turbo for too long.

All the code, pixel art and sound are made from scratch. There are no image or audio files: everything is drawn and synthesised at runtime, and there are no build steps or dependencies.

## Play

Open `index.html` through any static web server, for example:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Hosting on GitHub Pages

Go to **Settings → Pages**, pick **Deploy from a branch**, then choose `main` and `/ (root)`.

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Go (throttle) | `Z` / `J` / `Space` | **GO** |
| Turbo (faster, but heats the engine) | `X` / `K` / `Shift` | **TURBO** |
| Change lane | `↑` / `↓` | D-pad up/down |
| Lean back / forward (wheelie, or pitch in the air) | `←` / `→` | D-pad left/right |
| Pause | `P` / `Esc` | **II** |
| Mute | `M` | – |
| Menus | arrows + `Enter` | tap |

## How it plays

- **Turbo and temperature:** holding TURBO raises your top speed, but the TEMP gauge climbs. If it fills up the engine overheats and you sit still for 3 seconds.
- **Cooling arrows:** ride over the yellow arrows on the track to reset the engine temperature straight away.
- **Landings:** in the air, lean (left/right) so the bike matches the slope you're landing on. A good landing on a downslope gives you a speed bonus. A bit off costs you speed. Way off and you crash.
- **Crashes:** you lose a couple of seconds. Mash GO to get back on the bike faster.
- **Wheelies:** lean back on the ground to pop a wheelie. This gets you through mud faster, but hold it too long and you'll loop out.
- **Mud** slows you right down. **Boost pads** (cyan) shoot you forward.
- **Rear wheels:** ride into the back wheel of a rider ahead of you and you go down.
- **Gap jumps:** you need speed to clear these. If you come up short you hit the face of the landing ramp.

### Modes

- **Time Trial:** ride solo and try to beat the qualifying time.
- **Race:** race against 5 CPU riders.

There are three tracks, each with its own look: Dustbowl (easy), Canyon Run (medium) and Thunder Ridge (hard, at night). Best times are saved in your browser.

## Code layout

```
index.html, style.css     page shell + on-screen touch controls
js/config.js              resolution, projection, physics constants
js/track.js               track generator, ramp height profiles, palettes
js/bike.js                bike physics (lanes, heat, air, landings, crashes) + CPU riders
js/render.js              2.5D oblique renderer, stands, HUD
js/sprites.js             procedural pixel-art bike/rider
js/font.js                5x7 bitmap font
js/audio.js               WebAudio engine + sound effects
js/input.js               keyboard + multi-touch
js/main.js                game states, menus, main loop
```

## Toward iPhone

- The game already runs full-screen and landscape when you add it to the home screen. The canvas has a fixed 384×216 logical resolution and is scaled up with nearest-neighbour filtering.
- The on-screen controls are multi-touch, so you can steer and hold GO or TURBO at the same time.
- To make a native app, wrap the folder with Capacitor (`npx cap add ios`) or a WKWebView shell. No code changes should be needed.
