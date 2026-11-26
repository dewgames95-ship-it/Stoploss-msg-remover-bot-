# vendor

Game libraries, stored locally so the game needs no CDN and no build step.

| Library | Version | License | Use |
|---|---|---|---|
| three | 0.187.0 | MIT | 3D engine (minified ESM build + selected addons) |
| postprocessing | 6.39.6 | Zlib | Bloom and other screen effects |
| gsap | 3.15.1 | GSAP standard license (gsap.com/standard-license) | UI and camera animation |
| howler | 2.2.4 | MIT | Engine sounds and music |

Three addons included: GLTFLoader, DRACOLoader (+ decoder in `addons/libs/draco/`),
meshopt decoder, BufferGeometryUtils, SkeletonUtils, RoomEnvironment.

## Usage

```html
<script type="importmap">
{ "imports": {
  "three": "./assets/vendor/three/build/three.module.js",
  "three/addons/": "./assets/vendor/three/addons/",
  "postprocessing": "./assets/vendor/postprocessing/postprocessing.js"
} }
</script>
<script src="./assets/vendor/gsap/gsap.min.js"></script>
<script src="./assets/vendor/howler/howler.min.js"></script>
<script type="module">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import { EffectComposer, RenderPass, EffectPass, BloomEffect } from 'postprocessing';
</script>
```

Open `assets/vendor/check.html` through a web server to confirm every library loads.
