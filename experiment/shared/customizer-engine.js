import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import OpenSCAD from './openscad-lib/openscad.js';
import { addFonts } from './openscad-lib/openscad.fonts.js';

// Shared font set across every product page: Pacifico (script), Comic Neue
// (bold, playful), Kalam for Devanagari, and the Anek series covering the
// rest of the major Indian scripts. Each product page just picks its own
// default selection from this same list rather than redefining it.
export const SHARED_FONTS = [
  { url: '../shared/openscad-lib/Pacifico-Regular.ttf', fsPath: '/fonts/Pacifico-Regular.ttf' },
  { url: '../shared/openscad-lib/ComicNeue-Bold.ttf', fsPath: '/fonts/ComicNeue-Bold.ttf' },
  { url: '../shared/openscad-lib/Kalam-Regular.ttf', fsPath: '/fonts/Kalam-Regular.ttf' },
  { url: '../shared/openscad-lib/AnekBangla.ttf', fsPath: '/fonts/AnekBangla.ttf' },
  { url: '../shared/openscad-lib/AnekGujarati.ttf', fsPath: '/fonts/AnekGujarati.ttf' },
  { url: '../shared/openscad-lib/AnekGurmukhi.ttf', fsPath: '/fonts/AnekGurmukhi.ttf' },
  { url: '../shared/openscad-lib/AnekKannada.ttf', fsPath: '/fonts/AnekKannada.ttf' },
  { url: '../shared/openscad-lib/AnekMalayalam.ttf', fsPath: '/fonts/AnekMalayalam.ttf' },
  { url: '../shared/openscad-lib/AnekOdia.ttf', fsPath: '/fonts/AnekOdia.ttf' },
  { url: '../shared/openscad-lib/AnekTamil.ttf', fsPath: '/fonts/AnekTamil.ttf' },
  { url: '../shared/openscad-lib/AnekTelugu.ttf', fsPath: '/fonts/AnekTelugu.ttf' },
];

// Maps a <select id="font"> option value to the Sanscript.js script key used
// for phonetic transliteration, or null for fonts that are typed directly in
// Latin (Pacifico, Comic Neue). Keys must match the SHARED_FONTS <option>
// values exactly.
const FONT_SCRIPTS = {
  'Kalam': 'devanagari',
  'Anek Bangla:style=Regular': 'bengali',
  'Anek Gujarati:style=Regular': 'gujarati',
  'Anek Gurmukhi:style=Regular': 'gurmukhi',
  'Anek Kannada:style=Regular': 'kannada',
  'Anek Malayalam:style=Regular': 'malayalam',
  'Anek Odia:style=Regular': 'oriya',
  'Anek Tamil:style=Regular': 'tamil',
  'Anek Telugu:style=Regular': 'telugu',
};

export function scriptForFont(fontValue) {
  return FONT_SCRIPTS[fontValue] || null;
}

// Wires a name <input> to transliterate phonetic Latin typing into whichever
// Indian script the currently-selected font uses (e.g. typing "rahul" while
// Kalam is selected shows "राहुल"), using Sanscript.js (loaded as a global
// via <script src="vendor/sanscript.js">). The underlying phonetic text is
// tracked separately from the input's displayed value, since the two only
// match 1:1 for Latin fonts - that's what lets switching fonts re-render the
// same typed name in a different script instead of losing what was typed.
export function wireTransliteratingNameInput({ inputEl, fontSelectEl, maxLength }) {
  let rawBuffer = inputEl.value;

  function transliterate(text, script) {
    if (!script || !window.Sanscript) return text;
    return window.Sanscript.t(text, 'itrans', script);
  }

  function render() {
    inputEl.value = transliterate(rawBuffer, scriptForFont(fontSelectEl.value));
  }

  function tryUpdate(nextRawBuffer) {
    const script = scriptForFont(fontSelectEl.value);
    const next = transliterate(nextRawBuffer, script);
    if (next.length > maxLength) return; // over the limit - reject the keystroke
    rawBuffer = nextRawBuffer;
    inputEl.value = next;
  }

  inputEl.addEventListener('beforeinput', (e) => {
    const script = scriptForFont(fontSelectEl.value);
    if (!script) return; // Latin font: let the browser type normally
    // A selection range can't be mapped back to a position in the raw
    // phonetic buffer (the two texts have different lengths), so treat any
    // edit that replaces a selection as starting fresh from the edit itself -
    // this covers the common "select all, then type/delete" pattern.
    const hasSelection = inputEl.selectionStart !== inputEl.selectionEnd;
    if (hasSelection) rawBuffer = '';
    if (e.inputType === 'insertText' || e.inputType === 'insertCompositionText') {
      e.preventDefault();
      tryUpdate(rawBuffer + (e.data || ''));
    } else if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
      e.preventDefault();
      tryUpdate(hasSelection ? '' : rawBuffer.slice(0, -1));
    } else if (e.inputType === 'insertFromPaste') {
      e.preventDefault(); // handled by the paste listener below
    }
  });

  inputEl.addEventListener('paste', (e) => {
    const script = scriptForFont(fontSelectEl.value);
    if (!script) return;
    e.preventDefault();
    const hasSelection = inputEl.selectionStart !== inputEl.selectionEnd;
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    tryUpdate((hasSelection ? '' : rawBuffer) + pasted);
  });

  // Latin fonts: no interception, just keep the raw buffer mirroring what's
  // typed so switching to a transliterating font later starts from the right
  // phonetic text.
  inputEl.addEventListener('input', () => {
    if (!scriptForFont(fontSelectEl.value)) rawBuffer = inputEl.value;
  });

  fontSelectEl.addEventListener('change', render);
  render();

  return {
    // Used when restoring a name from a recipe URL: reverse-transliterates
    // back to a phonetic buffer (if the restored font is a script font) so
    // further typing keeps working, then re-renders.
    setValue(text) {
      const script = scriptForFont(fontSelectEl.value);
      rawBuffer = script && window.Sanscript ? window.Sanscript.t(text, script, 'itrans') : text;
      render();
    },
  };
}

// Glossy injection-plastic look (clearcoat over a semi-matte base) - matches
// studio-style product renders (e.g. MakerWorld previews) rather than a flat
// matte preview.
function plasticMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, metalness: 0.05, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
}

// Shared engine for every parametric-model product page: three.js viewer
// (lighting, grid, orbit camera), OpenSCAD WASM rendering pipeline, and
// color swatches. A product page only supplies its own SCAD geometry
// (`solids`) and its own controls (`getParams`) - everything else here is
// identical across products. Rendered STLs aren't offered as a direct
// download - use `getLastModel()` on the returned instance to retrieve the
// buffers for attaching to an order once that integration exists.
export async function initCustomizer({
  viewer, statusEl, spinnerEl, generateBtn,
  solids,              // [{ id, defaultColor, buildScad(params) }]
  getParams,           // () => params, read fresh from the DOM on each render
  namePrefix,          // (params) => string, used to label the generated STLs
  describe,            // optional (params) => string, shown in the console log
  onRendered,          // optional (params) => void, called after each successful render -
                        // e.g. to encode params into the URL so the page becomes a
                        // reconstructable "recipe" link an order can store
  colorPickers = {},   // { [solidId]: row element containing .color-swatch children }
  fonts = [],          // [{ url, fsPath }] extra font files to preload into the WASM FS
}) {
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

  // Legend shows the currently rendered model's real measured size (from its
  // STL bounding box) plus the grid scale - not just a static "10mm" caption,
  // so the customer can see actual dimensions rather than guess them from
  // the grid alone.
  const legendEl = document.createElement('div');
  legendEl.className = 'grid-legend';
  viewer.appendChild(legendEl);

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

    // Box axes after the Z-up -> Y-up rotation: x/z are the flat footprint
    // (length/width), y is the vertical thickness/height off the bed.
    const dims = box.getSize(new THREE.Vector3());
    legendEl.textContent =
      `Model: ${dims.x.toFixed(1)} × ${dims.z.toFixed(1)} × ${dims.y.toFixed(1)} mm (L × W × H)  ·  Grid: 10mm squares`;

    const size = dims.length();
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

  // The STL buffers from the most recent render, kept around in case
  // something needs them without re-rendering (e.g. manual QA). Orders don't
  // attach these directly - since generation is deterministic, the order
  // instead stores the finalized parameters (see `onRendered` below), and
  // the STL is regenerated from them whenever it's actually needed.
  let lastBuffers = null;
  let lastPrefix = null;

  async function render() {
    statusEl.textContent = 'Generating your model…';
    spinnerEl.textContent = 'Rendering…';
    generateBtn.disabled = true;
    try {
      const params = getParams();
      const buffers = {};
      const t0 = performance.now();
      for (const s of solids) {
        buffers[s.id] = await renderOne(s.buildScad(params), `${s.id}.stl`);
      }
      const elapsed = (performance.now() - t0).toFixed(0);

      showSolids(buffers);
      lastBuffers = buffers;
      lastPrefix = namePrefix(params);

      const sizes = solids.map(s => `${s.id}: ${(buffers[s.id].byteLength / 1024).toFixed(1)} KB`).join(', ');
      const label = describe ? describe(params) + ' ' : '';
      console.log(`Rendered ${label}in ${elapsed}ms. ${sizes}`);
      statusEl.textContent = 'Model ready.';
      onRendered?.(params);
    } catch (e) {
      console.error('Render failed:', e);
      statusEl.textContent = 'Something went wrong generating the model. Please try again.';
    } finally {
      spinnerEl.textContent = '';
      generateBtn.disabled = false;
    }
  }

  generateBtn.addEventListener('click', render);
  render();

  return {
    render,
    recolor,
    getLastModel: () => (lastBuffers ? { buffers: lastBuffers, prefix: lastPrefix } : null),
  };
}
