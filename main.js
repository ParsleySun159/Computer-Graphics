import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Level } from './level.js';
import { Player1 } from './player.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100000
);
camera.lookAt(0, 0, 0);

//lighting
const light = new THREE.DirectionalLight(0xb0c4de, 2); //040348
light.position.set(50, 100, 50);
light.castShadow = true;
light.shadow.bias = -0.0001; //giam artifcat
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

const hemisphereLight = new THREE.HemisphereLight(0x4682b4, 0x2f4f4f, 5);
scene.add(hemisphereLight);

const torchLight1 = new THREE.PointLight(0xff4500, 10, 10, 2); // Orange-red
torchLight1.position.set(3, 0.5, 2);
scene.add(torchLight1);

scene.fog = new THREE.FogExp2(0xFFFFFF, 0.02); //Fog color and density

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
renderer.shadowMap.enabled = true;
document.getElementById('webgl').appendChild(renderer.domElement);

//Load
let staticMeshes = [];
let dynamicMeshes = [];
let player = new Player1(scene, camera, staticMeshes, dynamicMeshes);
let level = new Level(player);
scene.add(level);

function updateStaticMeshes(object) {
    object.traverse((child) => {
        if (!staticMeshes.includes(child) && child.isMesh && child.name.endsWith !== '_Ground') {
            staticMeshes.push(child);
            child.geometry.computeBoundingBox();
            child.boundingBox = child.geometry.boundingBox.clone();
        }
    });
}

window.addEventListener('roomLoaded', () => {
    if (level.currentRoom) {
        updateStaticMeshes(level.currentRoom);
    }
});

const clock = new THREE.Clock();
function animate() {
    const delta = clock.getDelta();
    requestAnimationFrame(animate);
    staticMeshes.forEach(mesh => {
        mesh.boundingBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    }); //Update bounding boxes 4 obstacles

    player.update(delta);
    level.update();

    renderer.render(scene, camera);
}
animate();