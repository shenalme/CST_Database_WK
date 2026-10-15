# Machine models for the 3D digital twin

The twin draws a detailed procedural 3D model for each machine type. To use your **real machines** instead, export them from CAD (or any 3D tool) as **glTF / GLB** and register them here:

1. Put the files in this folder, for example `oven.glb`, `autoclave.glb`.
2. Edit `models.json`: map a `machine_type` (oven, autoclave, press, cnc, spray_booth, vacuum_pump, injection, dispenser, cutting, hand_tool, packaging) or an exact machine name to a file. Remove the leading underscore of the example entry.
   ```json
   { "oven": { "file": "oven.glb", "rotateY": 0 }, "Autoclave": { "file": "my_autoclave.glb", "height": 3.2 } }
   ```
3. Run `cd tools && npm run models` (embeds the files so they also load when `twin.html` is double-clicked) and reload `twin.html`. The model is scaled to the machine's footprint from the database (`machine_locations.width_m / height_m`), stands on the floor, and is tinted by the same state / energy / carbon colouring.

Options per entry: `file`, `rotateX` / `rotateZ` / `rotateY` (degrees; `rotateX: -90` for Z-up CAD exports such as STL conversions, `rotateY` turns the machine on the floor), `height` (metres), and `credit` (text shown on the twin page — required for CC BY models). Heavy models: run `cd tools && npm run optimise-model -- in.glb out.glb 0.1` (keeps about 10 % of the triangles, removes unused data). Draco/Meshopt-compressed files are not supported yet — export or optimise to a plain GLB.

Tips: use metres or any consistent unit (the model is scaled automatically); put the front of the machine towards +Z (the camera side); keep files small (under a few MB; decimate CAD meshes); GLB is easiest. `example_box.gltf` is a tiny working sample for testing the loader.

Licences: only use models you have the right to publish — files in `docs/` are public on GitHub Pages.
