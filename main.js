import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100000
);
camera.position.set(0, 0, 0);
camera.lookAt(0, 0, 0);

//lighting
const light = new THREE.DirectionalLight(0xffffff, 2); //040348
light.position.set(50, 100, 50);
light.castShadow = true;
light.shadow.bias = -0.0001; //giam artifcat
scene.add(light);
const shadowHelper = new THREE.CameraHelper(light.shadow.camera)
scene.add(shadowHelper);
//Camera frostum, so cang nho thi vung nhan shadow cang nho(de bi clipping)
light.shadow.camera.left = -30;
light.shadow.camera.right = 30;
light.shadow.camera.top = 30;
light.shadow.camera.bottom = -30;
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 500;
light.shadow.mapSize.width = 2048; 
light.shadow.mapSize.height = 2048;

const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
scene.add(ambientLight);

//Ground plane
const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x404040 })
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
plane.name = 'Ground';
scene.add(plane);

//obstacles
const wall = new THREE.Mesh(
    new THREE.BoxGeometry(5, 10, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xFF0000 }));
wall.position.set(0, wall.geometry.parameters.height / 2, -2);
wall.castShadow = true;
wall.receiveShadow = true;
scene.add(wall);
const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xFF0000 }));
sphere.position.set(3, sphere.geometry.parameters.radius, 2);
sphere.castShadow = true;
sphere.receiveShadow = true;
scene.add(sphere);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1c1848);
renderer.shadowMap.enabled = true;
document.getElementById('webgl').appendChild(renderer.domElement);

//Bullet
const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
bullet.castShadow = true;

let mixer;
let player;
let head, leftHand, rightHand;
let animations = [];
let action = {};
const loader = new GLTFLoader();
loader.load('./Model/Male_MC.glb', (gltf) => {
    player = gltf.scene;
    player.position.set(0, 0, 0);
    player.scale.set(1, 1, 1);

    player.userData = {
        isIdle: true,
        isWalk: false,
        isAim: false,
        isShoot: false,
        isRightHand: false,
    }

    const playerHitbox = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.6, 0.8), //size hitbox
        new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
    );
    playerHitbox.name = 'PlayerHitbox';
    playerHitbox.position.set(0, playerHitbox.position.y / 2 + 1, 0);
    player.add(playerHitbox);
    player.userData.collider = playerHitbox;

    player.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }

    });

    head = player.getObjectByName('Head');
    leftHand = player.getObjectByName('HandL');
    rightHand = player.getObjectByName('HandR');
    player.name = 'Player1';
    scene.add(player);

    mixer = new THREE.AnimationMixer(player);

    const playerBoneFilter = {
        'Idle': { excludeBones: ['EyelidL', 'EyelidR'] },
        'Walking': { excludeBones: ['EyelidL', 'EyelidR'] },
        'Blinking': { filterBones: ['EyelidL', 'EyelidR'] },
        'Aim': { filterBones: ['Neck', 'ShoulderL','ShoulderR','Upper_ArmL','Upper_ArmR','Fore_ArmL','Fore_ArmR','HandL','HandR','IKArmL','IKArmR','TargerArmL','TargetArmR','Spine','Hips']},
        'Shoot': { filterBones: ['Neck', 'ShoulderL', 'ShoulderR', 'Upper_ArmL', 'Upper_ArmR', 'Fore_ArmL', 'Fore_ArmR', 'HandL', 'HandR', 'IKArmL', 'IKArmR', 'TargerArmL', 'TargetArmR', 'Spine', 'Hips'] }
    }

    animations = gltf.animations;
    animations.forEach((clip) => {
        const act = mixer.clipAction(clip);
        act.play();
        mixer.update(0); //Update mixer de khoi tao animation propertyBindings
        act.stop();  
        const config = playerBoneFilter[clip.name];
        if (config) {
            BoneFilters(act, config);
        }
        action[clip.name] = act;
    });
    // Chinh animation speed
    action['Idle'].setLoop(THREE.LoopOnce);
    action['Idle'].clampWhenFinished = true;
    action['Idle'].timeScale = 1.25;
    /*   action['Idle'].play();*/
    action['Blinking'].setLoop(THREE.LoopOnce);
    action['Blinking'].clampWhenFinished = true;
    action['Aim'].setLoop(THREE.LoopOnce);
    /*action['Idle']?.play();*/
    function playBlinking() {
        if (action['Blinking'] && !action['Blinking'].isRunning())
            action['Blinking'].reset().play();
        const nextBlink = Math.random() * 2000 + 2000;
        setTimeout(playBlinking, nextBlink);
    }
    playBlinking();
    /*
    function logBonesPerClip(animations) {
        animations.forEach((clip) => {
            const trackNames = clip.tracks.map(track => track.name.split('.')[0]);
            const uniqueBones = [...new Set(trackNames)];
            console.log(`Clip "${clip.name}" affects bones:`, uniqueBones);
        });
    }
    logBonesPerClip(animations);
    */
}, undefined, (error) => {
    console.error(error);
});
function BoneFilters(action, { filterBones = null, excludeBones=null }) {
    if (!action._originalBindings) {
        action._originalBindings = [...action._propertyBindings];
        action._originalInterpolants = [...action._interpolants];
    }
    if (!filterBones && !excludeBones) {
        action._propertyBindings = action._originalBindings;
        action._interpolants = action._originalInterpolants;
        return;
    }
    if (filterBones) {
        // NOTE Run animation only for these specific bones https://discourse.threejs.org/t/animation-replace-blend-mode/51804/2
        const filteredBindings = [];
        const filteredInterpolants = [];
        const bindings = action._propertyBindings || [];
        const interpolants = action._interpolants || [];

        bindings.forEach((propertyMixer, index) => {
            const { binding } = propertyMixer;

            if ((binding && binding.targetObject && !filterBones.includes(binding.targetObject.name))) {
                return;
            } else {
                filteredBindings.push(propertyMixer);
                filteredInterpolants.push(interpolants[index]);
            }
        });

        action._propertyBindings = filteredBindings;
        action._interpolants = filteredInterpolants;
    } else if (excludeBones) {
        // NOTE Run animation for all except these specific bones
        const filteredBindings = [];
        const filteredInterpolants = [];
        const bindings = action._propertyBindings || [];
        const interpolants = action._interpolants || [];

        bindings.forEach((propertyMixer, index) => {
            const { binding } = propertyMixer;

            if (!(binding && binding.targetObject && excludeBones.includes(binding.targetObject.name))) {
                filteredBindings.push(propertyMixer);
                filteredInterpolants.push(interpolants[index]);
            }
        });

        action._propertyBindings = filteredBindings;
        action._interpolants = filteredInterpolants;
    }
}

//For collision and hitbox
let staticMeshes = [];
let dynamicMeshes = [];
scene.traverse((child) => {
    if (child.isMesh && child.name != 'Player' && child.name != 'Ground') {
        staticMeshes.push(child);
        child.geometry.computeBoundingBox();
        child.boundingBox = child.geometry.boundingBox.clone();
    }
});

const keysPressed = {};
document.addEventListener('keydown', (event) => {
    keysPressed[event.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});

//Player Rotation
const target = new THREE.Object3D();
const intersectionPoint = new THREE.Vector3();
const plane1 = new THREE.Plane();
const planeNormal = new THREE.Vector3();
const mousePos = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
document.addEventListener('mousemove', (event) => {
    mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;

    plane1.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0), // up direction
        new THREE.Vector3(0, 0, 0)  // y = 0 plane
    );

    raycaster.setFromCamera(mousePos, camera);
    raycaster.ray.intersectPlane(plane1, intersectionPoint);

    target.position.set(intersectionPoint.x, 0, intersectionPoint.z);
});
let bulletClone;
let shootInterval;
//document.addEventListener('click', (event) => {
//    if (event.button === 0) { // Left mouse button)
//        if (!isAim) {
//            isAim = true;
//            action['Idle'].fadeOut(0.3);
//            BoneFilters(action['Walking'], { filterBones: ['CTRLTorso', 'ThighL', 'ThighR', 'ShinL', 'ShinR', 'FootL', 'FootR', 'HeelsL', 'HeelsR', 'ToesL', 'ToesR', 'TargetLegL', 'TargetLegR'] });
//            action['Aim'].reset().play();
//        }
//        if (isAim) {
//            action['Aim'].fadeOut(0.3);
//            action['Shoot'].reset().fadeIn(0.3).play();
//        }
//    }
//});
document.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left mouse button
        if (!player.userData.isAim) {
            player.userData.isAim = true;
            action['Idle'].fadeOut(0.3);
            action['Aim'].reset().play();
            player.userData.isShoot = true;
            BoneFilters(action['Walking'], { filterBones: ['CTRLTorso', 'ThighL', 'ThighR', 'ShinL', 'ShinR', 'FootL', 'FootR', 'HeelsL', 'HeelsR', 'ToesL', 'ToesR', 'TargetLegL', 'TargetLegR'] });
        }
        if (player.userData.isShoot && !shootInterval) {
            action['Aim'].fadeOut(0.3);
            action['Shoot'].reset().play();
            shootInterval = setInterval(() => { shoot(); }, 384); //1 lan ban = 8 frame * 24 frame rate
        }
    }
});
document.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
        player.userData.isAim = false;
        player.userData.isShoot = false;
        clearInterval(shootInterval);
        shootInterval = null;
        action['Aim'].fadeOut(0.3);
        action['Shoot'].fadeOut(0.3);
        BoneFilters(action['Walking'], {});
        if (!player.userData.isWalk) {
            const idleAction = action['Idle'];
            idleAction.reset();
            idleAction.time = idleAction.getClip().duration; // Start at the end
            idleAction.timeScale = -1; //Reverse
            idleAction.play();
        }
    }
});

function shoot() {
    const hand = player.userData.isRightHand ? rightHand : leftHand;
    const handWorldPosition = new THREE.Vector3();
    hand.getWorldPosition(handWorldPosition);
    bulletClone = bullet.clone();
    bulletClone.userData.isBullet = true;
    bulletClone.userData.spawnTime = performance.now();
    bulletClone.position.copy(handWorldPosition);
    bulletClone.frustumCulled = false; // Disable frustum culling, bullet wont disappear if out of camera range
    scene.add(bulletClone);
    dynamicMeshes.push(bulletClone);
    const direction = new THREE.Vector3().subVectors(target.position, bulletClone.position);
    direction.y = 0;
    direction.normalize();
    bulletClone.velocity = direction.multiplyScalar(15); // Set bullet speed
    player.userData.isRightHand = !player.userData.isRightHand;
}

let currentRotationY = 0;
let currentHeadYaw = 0;
THREE.MathUtils.lerpAngle = function (a, b, t) { //smooth rotation
    const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + delta * t;
};

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    staticMeshes.forEach(mesh => {
        mesh.boundingBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    }); //Update bounding boxes 4 obstacles

    shadowHelper.update();
    light.target.position.copy(player.position); //Theo player de khong bi mat shadow
    light.target.updateMatrixWorld();

    const delta = clock.getDelta();

    if (!player || animations.length === 0) {
        renderer.render(scene, camera);
        return;
    }

    if (mixer) {
        mixer.update(delta);
    }

    const prevPosition = player.position.clone();
    const direction = new THREE.Vector3();
    if (keysPressed['w']) direction.z -= 1;
    if (keysPressed['s']) direction.z += 1;
    if (keysPressed['a']) direction.x -= 1;
    if (keysPressed['d']) direction.x += 1;

    let isMoving = direction.lengthSq() > 0;

    if (isMoving) {
        direction.normalize();
        if (!player.userData.isWalk) {
            player.userData.isWalk = true;
            action['Idle']?.fadeOut(0.3);
            action['Walking']?.reset().fadeIn(0.3).play();
        }

        const moveSpeed = delta * 1.5;
        player.position.addScaledVector(direction, moveSpeed);
        player.updateMatrixWorld(true);

        player.userData.collider.updateMatrixWorld();
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3().setFromMatrixPosition(player.userData.collider.matrixWorld),
            new THREE.Vector3(0.8, 1.6, 0.8) // match box size
        );

        let collided = false;

        for (let i = 0; i < staticMeshes.length; i++) { //turn into function
            const mesh = staticMeshes[i];
            if (playerBox.intersectsBox(mesh.boundingBox)) {
                collided = true;
                break;
            }
        }
        if (collided) {
            // Try X direction
            player.position.copy(prevPosition);
            player.position.x += direction.x * moveSpeed;
            player.updateMatrixWorld(true);
            player.userData.collider.updateMatrixWorld();
            playerBox.setFromCenterAndSize(
                new THREE.Vector3().setFromMatrixPosition(player.userData.collider.matrixWorld),
                new THREE.Vector3(0.5, 1.8, 0.5)
            );

            if (staticMeshes.some(mesh => playerBox.intersectsBox(mesh.boundingBox))) {
                player.position.x = prevPosition.x; // cancel X move
            }

            // Try Z
            player.position.z = prevPosition.z + direction.z * moveSpeed;
            player.updateMatrixWorld(true);
            player.userData.collider.updateMatrixWorld();
            playerBox.setFromCenterAndSize(
                new THREE.Vector3().setFromMatrixPosition(player.userData.collider.matrixWorld),
                new THREE.Vector3(0.5, 1.8, 0.5)
            );

            if (staticMeshes.some(mesh => playerBox.intersectsBox(mesh.boundingBox))) {
                player.position.z = prevPosition.z;
            }
        }
        else if (!player.userData.isAim) { //Chi xoay khi khong ban
            const targetAngle = Math.atan2(direction.x, direction.z);
            currentRotationY = THREE.MathUtils.lerpAngle(currentRotationY, targetAngle, delta * 5);
            player.rotation.y = currentRotationY;
        }
    }
    else {
        if (player.userData.isWalk) {
            player.userData.isWalk = false;
            action['Walking']?.fadeOut(0.3);
            if (!player.userData.isAim) {
                action['Idle']?.reset().fadeIn(0.3).play();
            }
        }
    }
    const targetPos = player.position.clone();
    camera.position.set(targetPos.x, targetPos.y + 12, targetPos.z + 6);
    camera.lookAt(targetPos);

    if (head && player) { //Rotation ~ mouse
        const headWorldPos = new THREE.Vector3();
        head.getWorldPosition(headWorldPos);

        const dx = target.position.x - headWorldPos.x;
        const dz = target.position.z - headWorldPos.z;

        const targetYaw = Math.atan2(dx, dz);
        let bodyYaw = player.rotation.y;

        let angleToTarget = targetYaw - bodyYaw;
        angleToTarget = Math.atan2(Math.sin(angleToTarget), Math.cos(angleToTarget));

        const bodyTurnSpeed = 0.025; //body rotation speed
        player.rotation.y += angleToTarget * bodyTurnSpeed;

        bodyYaw = player.rotation.y;
        let headYaw = targetYaw - bodyYaw;
        headYaw = Math.atan2(Math.sin(headYaw), Math.cos(headYaw));

        const maxHeadYaw = THREE.MathUtils.degToRad(60);
        headYaw = THREE.MathUtils.clamp(headYaw, -maxHeadYaw, maxHeadYaw); //head rotation range
        currentHeadYaw = THREE.MathUtils.lerpAngle(currentHeadYaw, headYaw, delta * 5);
        head.rotation.set(0, currentHeadYaw, 0);
    }
    dynamicMeshes = dynamicMeshes.filter(obj => {
        if (obj.userData.isBullet) {
            obj.position.add(obj.velocity.clone().multiplyScalar(delta));
            obj.geometry.computeBoundingSphere();
            obj.boundingSphere = obj.geometry.boundingSphere.clone();
            obj.boundingSphere.applyMatrix4(obj.matrixWorld);
            if (performance.now() - obj.userData.spawnTime > 2000) {
                scene.remove(obj);
                return false;
            }
        }
        return true;
    });

    renderer.render(scene, camera);
}
animate();