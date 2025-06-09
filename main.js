import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Level } from './level.js';
import { Player1 } from './player.js';
import { Monster } from './monster.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100000
);
camera.lookAt(0, 0, 0);

//lighting
const light = new THREE.DirectionalLight(0x111184, 0.8);
light.position.set(0, 100, 0);
light.castShadow = true;
light.shadow.bias = -0.0001; //giam artifact
scene.add(light);
//Camera frostum, so cang nho thi vung nhan shadow cang nho(de bi clipping)
light.shadow.camera.left = -30;
light.shadow.camera.right = 30;
light.shadow.camera.top = 30;
light.shadow.camera.bottom = -30;
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 500;
light.shadow.mapSize.width = 2048; 
light.shadow.mapSize.height = 2048;

const hemisphereLight = new THREE.HemisphereLight(0xFFB100, 0x111184, -0.2);
scene.add(hemisphereLight);
scene.fog = new THREE.FogExp2(0xFFFFFF, 0.02);

const pointLight = new THREE.PointLight(0xFFFFFF, 1, 0, 2);
scene.add(pointLight);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputEncoding = THREE.sRGBEncoding;
document.getElementById('webgl').appendChild(renderer.domElement);

//Load
let staticMeshes = [];
let dynamicMeshes = [];
window.staticMeshes = staticMeshes;
let player = new Player1(scene, camera, staticMeshes, dynamicMeshes);
let level = new Level(scene, player, staticMeshes, dynamicMeshes);
scene.add(level);


function updateStaticMeshes(object, type) { //1: add, 0:dispose
    object.traverse((child) => {
        if (type == 1 && !staticMeshes.includes(child) && child.isMesh && !child.name.endsWith('_Ground') && !child.name.endsWith('Point') && !child.name.startsWith('Torch')) {
            staticMeshes.push(child);
            child.geometry.computeBoundingBox();
            child.boundingBox = child.geometry.boundingBox.clone();
        }
        if (type == 0 && staticMeshes.includes(child) && child.isMesh && !child.name.startsWith('Room') && !child.name.startsWith('Wall')) {
            const index = staticMeshes.indexOf(child);
            if (index !== - 1) {
                staticMeshes.splice(index, 1);
            }
            if (child.boundingBox) {
                delete child.boundingBox;
            }
        }
    });
}

window.addEventListener('levelLoaded', () => {
    if (level) {
        updateStaticMeshes(level, 1);
    }
});
window.addEventListener('roomDisposed', () => {
    if (level.currentRoom && level.currentRoom.object) {
        updateStaticMeshes(level.currentRoom.object, 0);
    }
});

const clock = new THREE.Clock();

let isPaused = false;

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') {
        togglePause();
    }
});

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseOverlay').style.display = isPaused ? 'flex' : 'none';
}

function animate() {
    const delta = clock.getDelta();
    requestAnimationFrame(animate);

    if (isPaused) return;

    staticMeshes.forEach(mesh => {
        mesh.boundingBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    }); //Update bounding boxes 4 obstacles

    player.update(delta);
    level.update(delta);
    

    pointLight.position.set(player?.model?.position.x, player?.model?.position.y + 0.5, player?.model?.position.z);
    renderer.render(scene, camera);
}
animate();