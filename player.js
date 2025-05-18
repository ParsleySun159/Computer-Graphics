import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BoneFilters, lerpAngle } from './animationUtils.js';

export class Player1 {
    constructor(scene, camera, staticMeshes, dynamicMeshes) {
        this.scene = scene;
        this.camera = camera;
        this.staticMeshes = staticMeshes;
        this.dynamicMeshes = dynamicMeshes;
        this.loader = new GLTFLoader();
        this.player = null;
        this.mixer = null;
        this.animations = [];
        this.action = {};
        this.head = null;
        this.leftGun = null;
        this.rightGun = null;
        this.keysPressed = {};
        this.target = new THREE.Object3D();
        this.intersectionPoint = new THREE.Vector3();
        this.plane = new THREE.Plane();
        this.mousePos = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.currentRotationY = 0;
        this.currentHeadYaw = 0;
        this.bulletTemplate = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        this.bulletTemplate.castShadow = true;
        this.shootInterval = null;

        this.initInput();
        this.loadModel();
    }
    loadModel() {
        this.loader.load('./Model/Male_MC.glb', (gltf) => {
            this.player = gltf.scene;
            this.player.position.set(0, 0, 0);
            this.player.scale.set(1, 1, 1);

            this.player.userData = {
                isWalk: false,
                isAim: false,
                isShoot: false,
                isRightHand: false,
            };
            this.player.stat = { Speed: 5 };

            const playerHitbox = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 1.6, 0.8),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
            );
            playerHitbox.name = 'PlayerHitbox';
            playerHitbox.position.set(0, playerHitbox.position.y / 2 + 1, 0);
            this.player.add(playerHitbox);
            this.player.userData.collider = playerHitbox;

            this.player.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.head = this.player.getObjectByName('Head');
            this.leftGun = this.player.getObjectByName('GunL');
            this.rightGun = this.player.getObjectByName('GunR');
            this.player.name = 'Player1';
            this.scene.add(this.player);

            const playerBoneFilter = {
                'Idle': { excludeBones: ['EyelidL', 'EyelidR'] },
                'Walking': { excludeBones: ['EyelidL', 'EyelidR'] },
                'Blinking': { filterBones: ['EyelidL', 'EyelidR'] },
                'Aim': { filterBones: ['Neck', 'ShoulderL', 'ShoulderR', 'Upper_ArmL', 'Upper_ArmR', 'Fore_ArmL', 'Fore_ArmR', 'HandL', 'HandR', 'IKArmL', 'IKArmR', 'TargetArmL', 'TargetArmR', 'Spine', 'Hips', 'CTRLTorso', 'GunL', 'GunR'] },
                'ShootL': { filterBones: ['Neck', 'ShoulderL', 'Upper_ArmL', 'Fore_ArmL', 'HandL', 'IKArmL', 'TargetArmL', 'Spine', 'Hips', 'CTRLTorso', 'GunL'] },
                'ShootR': { filterBones: ['Neck', 'ShoulderR', 'Upper_ArmR', 'Fore_ArmR', 'HandR', 'IKArmR', 'TargetArmR', 'Spine', 'Hips', 'CTRLTorso', 'GunR'] },
                'GunDown': { filterBones: ['Neck', 'ShoulderL', 'ShoulderR', 'Upper_ArmL', 'Upper_ArmR', 'Fore_ArmL', 'Fore_ArmR', 'HandL', 'HandR', 'IKArmL', 'IKArmR', 'TargetArmL', 'TargetArmR', 'Spine', 'Hips', 'CTRLTorso', 'GunL', 'GunR'] }
            };

            this.mixer = new THREE.AnimationMixer(this.player);
            this.animations = gltf.animations;
            this.animations.forEach((clip) => {
                const act = this.mixer.clipAction(clip);
                act.play();
                this.mixer.update(0); //Update mixer de khoi tao propertyBindings
                act.stop();
                const config = playerBoneFilter[clip.name];
                if (config) {
                    BoneFilters(act, config);
                }
                this.action[clip.name] = act;
            });

            this.action['Idle'].setLoop(THREE.LoopOnce);
            this.action['Idle'].clampWhenFinished = true;
            this.action['Idle'].timeScale = 1.25;
            this.action['Blinking'].setLoop(THREE.LoopOnce);
            this.action['Blinking'].clampWhenFinished = true;
            this.action['Aim'].setLoop(THREE.LoopOnce);
            this.action['Aim'].clampWhenFinished = true;
            this.action['ShootL'].setLoop(THREE.LoopOnce);
            this.action['ShootL'].clampWhenFinished = true;
            this.action['ShootR'].setLoop(THREE.LoopOnce);
            this.action['ShootR'].clampWhenFinished = true;
            this.action['GunDown'].setLoop(THREE.LoopOnce);
            this.playBlinking();
        }, undefined, (error) => {
            console.error(error);
        });
    }
    initInput() {
        document.addEventListener('keydown', (event) => {
            this.keysPressed[event.key.toLowerCase()] = true;
        });

        document.addEventListener('keyup', (event) => {
            this.keysPressed[event.key.toLowerCase()] = false;
        });
        document.addEventListener('mousemove', (event) => {
            this.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0) { // Left mouse button
                if (!this.player.userData.isAim) {
                    BoneFilters(this.action['Walking'], { filterBones: ['CTRLTorso', 'ThighL', 'ThighR', 'ShinL', 'ShinR', 'FootL', 'FootR', 'HeelsL', 'HeelsR', 'ToesL', 'ToesR', 'TargetLegL', 'TargetLegR'] });
                    this.player.userData.isAim = true;
                    this.action['Idle']?.fadeOut(0.3);
                    this.action['GunDown']?.fadeOut(0.3);
                    this.action['Aim'].reset().fadeIn(0.3).play();
                    this.player.userData.isShoot = true;
                }
                if (this.player.userData.isShoot) {
                    this.mixer.addEventListener('finished', this.OnGunUp.bind(this));
                }
            }
        });
        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) {
                this.player.userData.isAim = false;
                this.player.userData.isShoot = false;
                clearInterval(this.shootInterval);
                this.shootInterval = null;
                this.action['ShootL'].fadeOut(0.3);
                this.action['ShootR'].fadeOut(0.3);
                this.action['Aim'].fadeOut(0.3);
                this.action['GunDown'].reset().fadeIn(0.3).play();
                this.mixer.addEventListener('finished', this.OnGunDown.bind(this));
            }
        });
    }
    OnGunUp(event) {
        if (event.action === this.action['Aim']) {
            this.mixer.removeEventListener('finished', this.OnGunUp);
            if (!this.shootInterval) {
                this.Shoot();
                this.shootInterval = setInterval(() => { this.Shoot(); }, 384); //1 lan ban moi ben = 8 frame * 24 frame rate * 2
            }
        }
    }
    OnGunDown(event) {
        if (event.action === this.action['GunDown']) {
            this.mixer.removeEventListener('finished', this.OnGunDown);
            if (!this.player.userData.isAim && !this.player.userData.isShoot) {
                BoneFilters(this.action['Walking'], {});
            }
            if (!this.player.userData.isWalk) {
                this.action['Idle'].reset().fadeIn(0.3).play();
            }
        }
    }
    Shoot() {
        const gun = this.player.userData.isRightHand ? this.rightGun : this.leftGun;
        const gunWorldPosition = new THREE.Vector3();
        gun.getWorldPosition(gunWorldPosition);
        const bulletClone = this.bulletTemplate.clone();
        bulletClone.userData.isBullet = true;
        bulletClone.userData.spawnTime = performance.now();
        bulletClone.position.copy(gunWorldPosition);
        bulletClone.frustumCulled = false; // Disable frustum culling, bullet wont disappear if out of camera range
        this.scene.add(bulletClone);
        this.dynamicMeshes.push(bulletClone);
        const direction = new THREE.Vector3().subVectors(this.target.position, bulletClone.position);
        direction.y = 0;
        direction.normalize();
        bulletClone.velocity = direction.multiplyScalar(15); // Set bullet speed
        if (this.player.userData.isRightHand) {
            this.action['ShootR'].reset().play();
        }
        else {
            this.action['ShootL'].reset().play();
        }
        this.player.userData.isRightHand = !this.player.userData.isRightHand;
    }
    playBlinking() {
        if (this.action['Blinking'] && !this.action['Blinking'].isRunning()) {
            this.action['Blinking'].reset().play();
        }
        const nextBlink = Math.random() * 2000 + 2000;
        setTimeout(() => this.playBlinking(), nextBlink);
    }
    update(delta) {
        if (!this.player || !this.mixer) return;

        this.mixer.update(delta);

        // Mouse-based rotation
        this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
        this.raycaster.setFromCamera(this.mousePos, this.camera);
        this.raycaster.ray.intersectPlane(this.plane, this.intersectionPoint);
        this.target.position.set(this.intersectionPoint.x, 0, this.intersectionPoint.z);

        // Movement
        const prevPosition = this.player.position.clone();
        const direction = new THREE.Vector3();
        if (this.keysPressed['w']) direction.z -= 1;
        if (this.keysPressed['s']) direction.z += 1;
        if (this.keysPressed['a']) direction.x -= 1;
        if (this.keysPressed['d']) direction.x += 1;

        let isMoving = direction.lengthSq() > 0;
        if (isMoving) {
            direction.normalize();
            if (!this.player.userData.isWalk) {
                this.player.userData.isWalk = true;
                this.action['Idle']?.fadeOut(0.3);
                this.action['Walking']?.reset().fadeIn(0.3).play();
            }

            const moveSpeed = delta * 2 * this.player.stat.Speed;
            this.action['Walking'].timeScale = 0.5 + this.player.stat.Speed / 2;
            this.player.position.addScaledVector(direction, moveSpeed);
            this.player.updateMatrixWorld(true);

            this.player.userData.collider.updateMatrixWorld();
            const playerBox = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3().setFromMatrixPosition(this.player.userData.collider.matrixWorld),
                new THREE.Vector3(0.8, 1.6, 0.8)
            );

            let collided = false;
            for (let i = 0; i < this.staticMeshes.length; i++) {
                const mesh = this.staticMeshes[i];
                if (playerBox.intersectsBox(mesh.boundingBox)) {
                    collided = true;
                    break;
                }
            }

            if (collided) {
                //Try X
                this.player.position.copy(prevPosition);
                this.player.position.x += direction.x * moveSpeed;
                this.player.updateMatrixWorld(true);
                this.player.userData.collider.updateMatrixWorld();
                playerBox.setFromCenterAndSize(
                    new THREE.Vector3().setFromMatrixPosition(this.player.userData.collider.matrixWorld),
                    new THREE.Vector3(0.5, 1.8, 0.5)
                );
                if (this.staticMeshes.some(mesh => playerBox.intersectsBox(mesh.boundingBox))) {
                    this.player.position.x = prevPosition.x; // cancel X move
                }

                //Try Z
                this.player.position.z = prevPosition.z + direction.z * moveSpeed;
                this.player.updateMatrixWorld(true);
                this.player.userData.collider.updateMatrixWorld();
                playerBox.setFromCenterAndSize(
                    new THREE.Vector3().setFromMatrixPosition(this.player.userData.collider.matrixWorld),
                    new THREE.Vector3(0.5, 1.8, 0.5)
                );
                if (this.staticMeshes.some(mesh => playerBox.intersectsBox(mesh.boundingBox))) {
                    this.player.position.z = prevPosition.z; // cancel Z move
                }
            }
            else if (!this.player.userData.isAim) { //Xoay khi k ban
                const targetAngle = Math.atan2(direction.x, direction.z);
                this.currentRotationY = lerpAngle(this.currentRotationY, targetAngle, delta * 5);
                this.player.rotation.y = this.currentRotationY;
            }
        }
        else {
            if (this.player.userData.isWalk) {
                this.player.userData.isWalk = false;
                this.action['Walking']?.fadeOut(0.3);
                if (!this.player.userData.isAim && !this.player.userData.isShoot) {
                    this.action['Idle']?.reset().fadeIn(0.3).play();
                }
            }
        }

        // Camera follow
        const targetPos = this.player.position.clone();
        this.camera.position.set(targetPos.x, targetPos.y + 12, targetPos.z + 5);
        this.camera.lookAt(targetPos);

        // Head rotation
        if (this.head && this.player) {
            const headWorldPos = new THREE.Vector3();
            this.head.getWorldPosition(headWorldPos);

            const dx = this.target.position.x - headWorldPos.x;
            const dz = this.target.position.z - headWorldPos.z;

            const targetYaw = Math.atan2(dx, dz);
            let bodyYaw = this.player.rotation.y;

            let angleToTarget = targetYaw - bodyYaw;
            angleToTarget = Math.atan2(Math.sin(angleToTarget), Math.cos(angleToTarget));

            const bodyRotationSpeed = 0.05;
            this.player.rotation.y += angleToTarget * bodyRotationSpeed;

            bodyYaw = this.player.rotation.y;
            let headYaw = targetYaw - bodyYaw;
            headYaw = Math.atan2(Math.sin(headYaw), Math.cos(headYaw));

            const maxHeadYaw = THREE.MathUtils.degToRad(60);
            headYaw = THREE.MathUtils.clamp(headYaw, -maxHeadYaw, maxHeadYaw);
            this.currentHeadYaw = lerpAngle(this.currentHeadYaw, headYaw, delta * 5);
            this.head.rotation.set(0, this.currentHeadYaw, 0);
        }
        this.dynamicMeshes = this.dynamicMeshes.filter(obj => {
            if (obj.userData.isBullet) {
                obj.position.add(obj.velocity.clone().multiplyScalar(delta));
                obj.geometry.computeBoundingSphere();
                obj.boundingSphere = obj.geometry.boundingSphere.clone();
                obj.boundingSphere.applyMatrix4(obj.matrixWorld);
                if (performance.now() - obj.userData.spawnTime > 2000) {
                    this.scene.remove(obj);
                    return false;
                }
            }
            return true;
        });
    }
}