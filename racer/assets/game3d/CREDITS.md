# Race view assets

| File | What it is | Source | Licence |
|---|---|---|---|
| `car_f8.glb` | Sports car used for all three racers, outside and driver's-seat views | "2020 Ferrari F8 Tributo" by its Sketchfab author (name as shown on the model page; fill it in here), supplied by the project owner: https://sketchfab.com/3d-models/2020-ferrari-f8-tributo-5e7daeb70ea04b43b517db885f564d76 | CC-BY 4.0 (credit the author, link the model, state changes). Ferrari names and badges are trademarks of their owner; clear them before any commercial release. |
| `trees_maple.glb`, `trees_pine.glb` | Roadside 3D trees (LOD2 of a few trees, textures shrunk to 512 px, normal maps dropped) | Maple and pine tree packs supplied by the project owner (Sketchfab exports) | Confirm the packs' licence and credit on their Sketchfab pages |
| `city_a.glb`, `city_b.glb`, `tower.glb`, `grass.glb` | City blocks, glass tower and grass patches (Draco geometry, WebP textures up to 2048 px) | `city_pack_7.glb`, a second city pack, `3_world_trade_center.glb` and `grass_pack_lp.glb`, supplied by the project owner (Sketchfab exports) | Confirm each model's licence and credit on its Sketchfab page |
| `car_ao.png` | Soft contact shadow under the car | three.js examples (`examples/models/gltf/ferrari_ao.png`) | MIT (three.js) |
| `sky.jpg`, `sky_front.jpg` | Sky photo (reflections and visible sky) | "Kloofendal 48d Partly Cloudy (Pure Sky)" HDRI, Poly Haven | CC0 |
| `flora.webp` | Tree and rock cut-outs | Renders of Poly Haven models: Fir Tree 01, Pine Tree 01, Tree Small 02, Jacaranda Tree, Island Tree 01, Rock Moss Set 01 | CC0 |

## Changes made to the car model (`tools/build-car.mjs`)

- Shape, UVs, plate and badge artwork are unchanged.
- The 544 loose meshes are merged into named parts: `body`, `wheel0`-`wheel3`, `interior`, a lighter `interiorLo` for outside views, and `steer` (the whole steering wheel: rim, carbon sections, grips, buttons and hub badge, gathered into one part so it turns as one).
- Rescaled to metres, nose towards -z, wheels on the ground; textures re-encoded as WebP; geometry Draco-compressed.
- In the game only the body paint colour is set per car (gold, blue, red). Glass, wheels, carbon, lights and the cabin are shared and not tinted.

Road, markings, START/FINISH, boost pads, guard rails, skyline towers, obstacles and particles are generated in code (`tools/r3d.js`).
