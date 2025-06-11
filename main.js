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
const light = new THREE.DirectionalLight(0xFFFFFF, 0.5);
light.position.set(0, 5, 0);
light.castShadow = true;
light.shadow.bias = -0.0001;
scene.add(light);
scene.add(light.target);
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

const pointLight = new THREE.PointLight(0xFFFFFF, 1, 0, 2); //Player's glow
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

let score = 0;
let scoreDisplay = document.getElementById('score');
function updateScore(points) {
    score += points;
    if (scoreDisplay) {
        scoreDisplay.textContent = `${score}`;
    }
}

window.addEventListener('monsterKilled', (e) => {
    updateScore(e.detail.score);
    //localStorage.setItem('lastScore', score);
});

window.addEventListener('playerKilled', (e) => {
    localStorage.setItem('lastScore', score);
    let bestScore = localStorage.getItem('bestScore');
    if (bestScore !== null) {
        if (score >= bestScore)
        {
            bestScore = score;
        }
        localStorage.setItem('bestScore', bestScore);
    }
    else {
        localStorage.setItem('bestScore', score);
    }

    const overlay = document.getElementById('gameOverOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }

    const backBtn = document.getElementById('backButton');
    if (backBtn) {
        backBtn.style.display = 'block';
    }
});

window.addEventListener('levelCleared', () => {
    localStorage.setItem('lastScore', score);
    let bestScore = localStorage.getItem('bestScore');
    if (bestScore !== null) {
        if (score >= bestScore)
        {
            bestScore = score;
        }
        localStorage.setItem('bestScore', bestScore);
    }
    else {
        localStorage.setItem('bestScore',score);
    }

    const overlay = document.createElement('div');
    overlay.id = 'congratsOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
        <h1 style="color:white; font-size:48px; margin-bottom:20px;">🎉 Congratulations!</h1>
        <p style="color:white; font-size:24px;">You finished the level!</p>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.remove();
    }, 20000);
});

// Setup minimap renderer and camera
const minimapScene = new THREE.Scene();

const minimapRenderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('minimap'),
    antialias: true,
    alpha: true,
});
minimapRenderer.setSize(200, 200);
minimapRenderer.setClearColor(0x000000, 1);

const minimapCamera = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 1000);
minimapCamera.up.set(0, 0, -1);
minimapCamera.lookAt(new THREE.Vector3(0, -1, 0));
minimapCamera.position.set(0, 100, 0);

const minimapDot = new THREE.Mesh(
    new THREE.SphereGeometry(1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
minimapDot.scale.set(2, 2, 2);
minimapScene.add(minimapDot);

let level_ = new Level(minimapScene, player, staticMeshes, dynamicMeshes);
minimapScene.add(level_);
const light_ = new THREE.DirectionalLight(0xb0c4de, 2);
light_.position.set(50, 100, 50);
light_.castShadow = true;
light_.shadow.bias = -0.0001;
minimapScene.add(light_);

function renderMinimap() {
    if (!player?.model) return;

    const playerPos = player.model.position;

    minimapCamera.position.set(playerPos.x, 100, playerPos.z);
    minimapCamera.lookAt(new THREE.Vector3(playerPos.x, 0, playerPos.z));

    minimapDot.position.set(playerPos.x, 1, playerPos.z);

    minimapRenderer.clear();
    minimapRenderer.render(minimapScene, minimapCamera);
}
function animate() {
    if (!player.model || !level.mapScene) {
        requestAnimationFrame(animate);
        return;
    }

    const delta = clock.getDelta();
    requestAnimationFrame(animate);

    if (isPaused) return;

    staticMeshes.forEach(mesh => {
        mesh.boundingBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    });

    player.update(delta);
    if (light.position.clone().distanceTo(player?.model?.position.clone()) > 20) {
        light.position.set(player?.model?.position.x, player?.model?.position.y + 5, player?.model?.position.z);
        light.target.position.set(player?.model?.position.x, player?.model?.position.y, player?.model?.position.z);
    }
    level.update(delta);

    pointLight.position.set(player?.model?.position.x, player?.model?.position.y + 0.5, player?.model?.position.z);

    if (player?.model) {
        const pos = player.model.position;
        minimapDot.position.set(pos.x, 1, pos.z);

        minimapCamera.position.set(pos.x, 100, pos.z);
        minimapCamera.lookAt(new THREE.Vector3(pos.x, 0, pos.z));
    }
    renderer.render(scene, camera);
    renderMinimap();
}
animate();

window.addEventListener('load', () => {
    const tip = document.getElementById('startTip');
    if (tip) {
        tip.style.display = 'block';
        setTimeout(() => {
            tip.style.display = 'none';
        }, 10000);
    }
});

const bgMusic = new Audio('Sound/Bit_Quest.mp3');
bgMusic.loop = true;
bgMusic.volume = 1;

const musicSetting = localStorage.getItem('music');
const musicEnabled = musicSetting === null || musicSetting === 'true';

if (musicEnabled) {
    bgMusic.play().catch((e) => {
        document.addEventListener('click', () => {
            bgMusic.play();
        }, { once: true });
    });
}
