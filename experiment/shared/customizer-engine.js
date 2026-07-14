import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import OpenSCAD from './openscad-lib/openscad.js';
import { addFonts } from './openscad-lib/openscad.fonts.js';

// Glossy injection-plastic look (clearcoat over a semi-matte base) - matches
// studio-style product renders (e.g. MakerWorld previews) rather than a flat
// matte preview.
function plasticMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, metalness: 0.05, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
}

// Shared engine for every parametric-model product page: three.js viewer
// (lighting, grid, orbit camera), OpenSCAD WASM rendering pipeline, color
// swatches, and STL downloads. A product page only supplies its own SCAD
// geometry (`solids`) and its own controls (`getParams`) - everything else
// here is identical across products.
export async function initCustomizer({
  viewer, statusEl, spinnerEl, generateBtn,
  solids,              // [{ id, defaultColor, buildScad(params) }]
  getParams,           // () => params, read fresh from the DOM on each render
  namePrefix,          // (params) => string, used for STL download filenames
  describe,            // optional (params) => string, shown in the status log
  downloadLinks = {},  // { [solidId]: <a> element }
  colorPickers = {},   // { [solidId]: row element containing .color-swatch children }
  fonts = [],          // [{ url, fsPath }] extra font files to preload into the WASM FS
}) {
  function log(msg) { statusEl.textContent = msg; console.log(msg); }

  // ── three.js scene setup ──────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a3a3a);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, -60, 60);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewer.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Studio-style lighting: soft ambient fill plus a strong key light from the
  // upper right to produce the glossy specular highlight seen on plastic
  // product renders.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 1.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(40, 70, 55);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
  fillLight.position.set(-40, -20, 30);
  scene.add(fillLight);

  // Grid sits under the model as a scale reference, 10mm per square (matches
  // a print bed grid), resized and repositioned to fit whatever is loaded.
  let gridHelper = null;
  function updateGrid(box) {
    if (gridHelper) scene.remove(gridHelper);
    const footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    const size = Math.max(80, Math.ceil((footprint * 1.8) / 10) * 10);
    gridHelper = new THREE.GridHelper(size, size / 10, 0x6b5591, 0x9a8bb5);
    gridHelper.material.opacity = 0.85;
    gridHelper.material.transparent = true;
    const center = box.getCenter(new THREE.Vector3());
    gridHelper.position.set(center.x, box.min.y - 0.05, center.z);
    scene.add(gridHelper);
  }

  function resize() {
    const w = viewer.clientWidth, h = viewer.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  // ── solids: one mesh per named part (e.g. base + text), independently colorable ──
  const meshes = {};
  const colors = {};
  solids.forEach(s => { colors[s.id] = s.defaultColor; });

  function showSolids(buffers) {
    const loader = new STLLoader();
    Object.values(meshes).forEach(m => scene.remove(m));

    let centerOffset = null;
    solids.forEach(s => {
      const geom = loader.parse(buffers[s.id]);
      geom.computeVertexNormals();
      const mesh = new THREE.Mesh(geom, plasticMaterial(colors[s.id]));
      if (!centerOffset) {
        // Center everything using the first solid's bounding box (the
        // "primary"/base part), so all solids stay aligned to each other.
        geom.computeBoundingBox();
        centerOffset = geom.boundingBox.getCenter(new THREE.Vector3()).negate();
      }
      mesh.position.copy(centerOffset);
      mesh.rotation.x = -Math.PI / 2; // OpenSCAD Z-up -> three.js Y-up
      scene.add(mesh);
      meshes[s.id] = mesh;
    });

    const box = solids.slice(1).reduce(
      (b, s) => b.union(new THREE.Box3().setFromObject(meshes[s.id])),
      new THREE.Box3().setFromObject(meshes[solids[0].id])
    );
    updateGrid(box);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    camera.position.copy(center).add(new THREE.Vector3(0, size * 0.75, size * 0.9));
    controls.target.copy(center);
    controls.update();
  }

  function recolor(id, hex) {
    colors[id] = hex;
    if (meshes[id]) meshes[id].material.color.setHex(hex);
  }

  Object.entries(colorPickers).forEach(([id, rowEl]) => {
    rowEl.addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      rowEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      recolor(id, parseInt(swatch.dataset.color.slice(1), 16));
    });
  });

  // ── OpenSCAD engine ─────────────────────────────────────────────────────
  // A fresh instance is created per render: this WASM build's global/module
  // state does not reliably survive repeated callMain() invocations on the
  // same instance (observed as an opaque numeric exception on the 2nd call).
  const fontBytesCache = {};
  async function newEngine() {
    const instance = await OpenSCAD({ noInitialRun: true });
    addFonts(instance);
    for (const font of fonts) {
      if (!fontBytesCache[font.url]) {
        fontBytesCache[font.url] = new Uint8Array(await (await fetch(font.url)).arrayBuffer());
      }
      instance.FS.writeFile(font.fsPath, fontBytesCache[font.url]);
    }
    return instance;
  }

  async function renderOne(code, filename) {
    const instance = await newEngine();
    instance.FS.writeFile('/input.scad', code);
    instance.callMain(['/input.scad', '-o', '/' + filename]);
    const output = instance.FS.readFile('/' + filename);
    return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
  }

  async function render() {
    spinnerEl.textContent = 'Rendering…';
    generateBtn.disabled = true;
    Object.values(downloadLinks).forEach(a => a.classList.add('disabled'));
    try {
      const params = getParams();
      const buffers = {};
      const t0 = performance.now();
      for (const s of solids) {
        buffers[s.id] = await renderOne(s.buildScad(params), `${s.id}.stl`);
      }
      const elapsed = (performance.now() - t0).toFixed(0);

      showSolids(buffers);

      const prefix = namePrefix(params);
      for (const s of solids) {
        const link = downloadLinks[s.id];
        if (!link) continue;
        link.href = URL.createObjectURL(new Blob([buffers[s.id]], { type: 'application/octet-stream' }));
        link.download = `${prefix}-${s.id}.stl`;
        link.classList.remove('disabled');
      }
      const sizes = solids.map(s => `${s.id}: ${(buffers[s.id].byteLength / 1024).toFixed(1)} KB`).join(', ');
      const label = describe ? describe(params) + ' ' : '';
      log(`Rendered ${label}in ${elapsed}ms. ${sizes}`);
    } catch (e) {
      log('Render failed: ' + (e?.message || e) + ' | name=' + e?.name + ' errno=' + e?.errno + ' code=' + e?.code);
      console.error(e);
    } finally {
      spinnerEl.textContent = '';
      generateBtn.disabled = false;
    }
  }

  generateBtn.addEventListener('click', render);
  render();

  return { render, recolor };
}
