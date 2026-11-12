// 手機型錄用的 3D 縮圖：把每件家具的 3D 模型算成一張小圖
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { STYLES } from './catalog.js?v=20261112g';
import { buildItem, buildPerson } from './models.js?v=20261112g';
import { setTexSize } from './mats.js?v=20261112g';
setTexSize(256);

let R = null, scene, cam;
function init() {
  const c = document.createElement('canvas'); c.width = c.height = 200;
  R = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setClearColor(0x000000, 0); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a4, 0.7));
  const d = new THREE.DirectionalLight(0xfff4e6, 2.4); d.position.set(-2, 4, 3); scene.add(d);
  cam = new THREE.PerspectiveCamera(26, 1, 0.01, 60);
}
export function renderThumb(spec, styleKey) {
  if (!R) init();
  const o = spec.t === 'person' ? buildPerson(spec, { mode: 'stand' }) : buildItem(spec, STYLES[styleKey] || STYLES.nordic);
  scene.add(o);
  const box = new THREE.Box3().setFromObject(o), sph = box.getBoundingSphere(new THREE.Sphere());
  const dir = new THREE.Vector3(0.7, 0.55, 1).normalize();
  cam.position.copy(sph.center).addScaledVector(dir, sph.radius / Math.sin(THREE.MathUtils.degToRad(13)) * 1.03);
  cam.lookAt(sph.center);
  R.render(scene, cam);
  const url = R.domElement.toDataURL('image/png');
  scene.remove(o); o.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
  return url;
}
