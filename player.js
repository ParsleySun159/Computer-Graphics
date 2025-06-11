import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BoneFilters, lerpAngle } from './animationUtils.js';

export class Player {
    constructor(scene, camera, staticMeshes, dynamicMeshes) {
        this.scene = scene;
        this.camera = camera;
        this.staticMeshes = staticMeshes;
        this.dynamicMeshes = dynamicMeshes;
        this.loader = new GLTFLoader();
        this.model = null;
        this.mixer = null;
        this.animations = [];
        this.action = {};
        this.head = null;
        this.keysPressed = {};
        this.target = new THREE.Object3D();
        this.intersectionPoint = new THREE.Vector3();
        this.plane = new THREE.Plane();
        this.mousePos = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.currentRotationY = 0;
        this.currentHeadYaw = 0;

        this.stats = {
            MaxHealth: 200,
            Health: 200,
            DMG: 20,
            Speed: 5
        };
        this.isAlive = true;
        this.isFlashing = false;

        this.initInput();
        this.loadModel();
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
    }
    playBlinking() {
        if (this.action['Blinking'] && !this.action['Blinking'].isRunning()) {
            this.action['Blinking'].reset().play();
        }
        const nextBlink = Math.random() * 2000 + 2000;
        setTimeout(() => this.playBlinking(), nextBlink);
    }
    takeDamage(damage) {
        if (!this.isAlive) return;
        this.stats.Health = Math.max(0, this.stats.Health - damage);
        console.log(`Player takes ${damage} damage, health now ${this.stats.Health}`);

        const healthBar = this.model.getObjectByName("healthBarFill");
        if (healthBar) {
            const healthRatio = Math.max(this.stats.Health / this.stats.MaxHealth);
            healthBar.scale.x = healthRatio;
            healthBar.position.x = -(1 - healthRatio) * 0.5;
        }

        this.flashRed();

        const healthDisplay = document.getElementById('health');
        if (healthDisplay) {
            healthDisplay.textContent = this.stats.Health;
        }
        if (this.stats.Health <= 0) {
            this.die();
        }
    }
    flashRed() {
        if (!this.model || this.isFlashing) return;

        this.isFlashing = true;
        const meshes = [];

        this.model.traverse((child) => {
            if (child.isMesh && child.material) {
                meshes.push({
                    mesh: child,
                    originalcolor: child.material.color.clone()
                });
            }
        });

        let isRed = false;

        const blink = setInterval(() => {
            isRed = !isRed;
            meshes.forEach(({ mesh, originalcolor }) => {
                if (isRed) {
                    mesh.material.color.set(0xff0000); // red
                }
                else {
                    mesh.material.color.copy(originalcolor);
                }
            });
        }, 200);

        setTimeout(() => {
            clearInterval(blink);
            meshes.forEach(({ mesh, originalcolor }) => {
                mesh.material.color.copy(originalcolor);
            });
            this.isFlashing = false;
        }, 1000);
    }
    die() {
        console.log('isAlive:', this.isAlive);
        if (!this.isAlive) return;
        this.isAlive = false;

        const event = new CustomEvent('playerKilled');
        window.dispatchEvent(event);

        setTimeout(() => {
            this.model?.geometry?.dispose();
            this.scene.remove(this.model);
            console.log('Player removed from scene');
        }, 1000);
        this.model = null;
    }
    update(delta) {
        if (!this.model || !this.mixer) return;

        this.mixer.update(delta);

        // Mouse-based rotation
        this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
        this.raycaster.setFromCamera(this.mousePos, this.camera);
        this.raycaster.ray.intersectPlane(this.plane, this.intersectionPoint);
        this.target.position.set(this.intersectionPoint.x, 0, this.intersectionPoint.z);

        // Movement
        const prevPosition = this.model.position.clone();
        const direction = new THREE.Vector3();
        if (this.keysPressed['w']) direction.z -= 1;
        if (this.keysPressed['s']) direction.z += 1;
        if (this.keysPressed['a']) direction.x -= 1;
        if (this.keysPressed['d']) direction.x += 1;

        let isMoving = direction.lengthSq() > 0;
        if (isMoving) {
            direction.normalize();
            if (!this.model.userData.isWalk) {
                this.model.userData.isWalk = true;
                this.action['Idle']?.fadeOut(0.3);
                this.action['Walking']?.reset().fadeIn(0.3).play();
            }

            const moveSpeed = delta * 2 * this.stats.Speed;
            this.action['Walking'].timeScale = 0.75 + this.stats.Speed / 4;
            this.model.position.addScaledVector(direction, moveSpeed);
            this.model.updateMatrixWorld(true);

            this.model.userData.collider.updateMatrixWorld();
            const playerBox = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3().setFromMatrixPosition(this.model.userData.collider.matrixWorld),
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
                this.model.position.copy(prevPosition);
                this.model.position.x += direction.x * moveSpeed;
                this.model.updateMatrixWorld(true);
                this.model.userData.collider.updateMatrixWorld();
                playerBox.setFromCenterAndSize(
                    new THREE.Vector3().setFromMatrixPosition(this.model.userData.collider.matrixWorld),
                    new THREE.Vector3(0.5, 1.8, 0.5)
                );
                if (this.staticMeshes.some(mesh => playerBox.intersectsBox(mesh.boundingBox))) {
                    this.model.position.x = prevPosition.x; // cancel X move
                }

                //Try Z
                this.model.position.z = prevPosition.z + direction.z * moveSpeed;
                this.model.updateMatrixWorld(true);
                this.model.userData.collider.updateMatrixWorld();
                playerBox.setFromCenterAndSize(
                    new THREE.Vector3().setFromMatrixPosition(this.model.userData.collider.matrixWorld),
                    new THREE.Vector3(0.5, 1.8, 0.5)
                );
                if (this.staticMeshes.some(mesh => playerBox.intersectsBox(mesh.boundingBox))) {
                    this.model.position.z = prevPosition.z; // cancel Z move
                }
            }
            else if (!this.model.userData.isAim) { //Xoay khi k ban
                const targetAngle = Math.atan2(direction.x, direction.z);
                this.currentRotationY = lerpAngle(this.currentRotationY, targetAngle, delta * 5);
                this.model.rotation.y = this.currentRotationY;
            }
        }
        else {
            if (this.model.userData.isWalk) {
                this.model.userData.isWalk = false;
                this.action['Walking']?.fadeOut(0.3);
                if (!this.model.userData.isAim && !this.model.userData.isShoot) {
                    this.action['Idle']?.reset().fadeIn(0.3).play();
                }
            }
        }

        // Camera follow
        const targetPos = this.model.position.clone();
        this.camera.position.set(targetPos.x, targetPos.y + 12, targetPos.z + 5);
        this.camera.lookAt(targetPos);

        // Head rotation
        if (this.head && this.model) {
            const headWorldPos = new THREE.Vector3();
            this.head.getWorldPosition(headWorldPos);

            const dx = this.target.position.x - headWorldPos.x;
            const dz = this.target.position.z - headWorldPos.z;

            const targetYaw = Math.atan2(dx, dz);
            let bodyYaw = this.model.rotation.y;

            let angleToTarget = targetYaw - bodyYaw;
            angleToTarget = Math.atan2(Math.sin(angleToTarget), Math.cos(angleToTarget));

            const bodyRotationSpeed = 0.05;
            this.model.rotation.y += angleToTarget * bodyRotationSpeed;

            bodyYaw = this.model.rotation.y;
            let headYaw = targetYaw - bodyYaw;
            headYaw = Math.atan2(Math.sin(headYaw), Math.cos(headYaw));

            const maxHeadYaw = THREE.MathUtils.degToRad(60);
            headYaw = THREE.MathUtils.clamp(headYaw, -maxHeadYaw, maxHeadYaw);
            this.currentHeadYaw = lerpAngle(this.currentHeadYaw, headYaw, delta * 5);
            this.head.rotation.set(0, this.currentHeadYaw, 0);
        }
    }
}
export class Player1 extends Player {
    constructor(scene, camera, staticMeshes, dynamicMeshes) {
        super(scene, camera, staticMeshes, dynamicMeshes);
        this.leftGun = null;
        this.rightGun = null;
        this.bulletTemplate = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshStandardMaterial({
                color: 0xffff00,
                metalness: 1,
                roughness: 0.2,
                emissive: 0xAF9B60,
                emissiveIntensity: 0.5
            })
        );
        this.bulletTemplate.castShadow = true;
        this.shootInterval = null;
        const updateStatsPanel = () => {
            const healthDisplay = document.getElementById('health');
            const dmgDisplay = document.getElementById('dmg');
            const speedDisplay = document.getElementById('speed');

            if (healthDisplay) healthDisplay.textContent = this.stats.Health;
            if (dmgDisplay) dmgDisplay.textContent = this.stats.DMG;
            if (speedDisplay) speedDisplay.textContent = this.stats.Speed;
        };

        updateStatsPanel();
    }
    loadModel() {
        this.loader.load('./Model/Male_MC.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.position.set(0, 0, 0);
            this.model.scale.set(1, 1, 1);

            this.model.userData = {
                isWalk: false,
                isAim: false,
                isShoot: false,
                isRightHand: false,
            };

            const playerHitbox = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 1.6, 0.8),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
            );
            playerHitbox.name = 'PlayerHitbox';
            playerHitbox.visible = false;
            playerHitbox.position.set(0, playerHitbox.position.y / 2 + 1, 0);
            this.model.add(playerHitbox);
            this.model.userData.collider = playerHitbox;

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.head = this.model.getObjectByName('Head');
            this.leftGun = this.model.getObjectByName('GunL');
            this.rightGun = this.model.getObjectByName('GunR');
            this.model.name = 'Player1';
            this.scene.add(this.model);

            this.BloodBar();

            const playerBoneFilter = {
                'Idle': { excludeBones: ['EyelidL', 'EyelidR'] },
                'Walking': { excludeBones: ['EyelidL', 'EyelidR'] },
                'Blinking': { filterBones: ['EyelidL', 'EyelidR'] },
                'Aim': { filterBones: ['Neck', 'ShoulderL', 'ShoulderR', 'Upper_ArmL', 'Upper_ArmR', 'Fore_ArmL', 'Fore_ArmR', 'HandL', 'HandR', 'IKArmL', 'IKArmR', 'TargetArmL', 'TargetArmR', 'Spine', 'Hips', 'CTRLTorso', 'GunL', 'GunR'] },
                'ShootL': { filterBones: ['Neck', 'ShoulderL', 'Upper_ArmL', 'Fore_ArmL', 'HandL', 'IKArmL', 'TargetArmL', 'Spine', 'Hips', 'CTRLTorso', 'GunL'] },
                'ShootR': { filterBones: ['Neck', 'ShoulderR', 'Upper_ArmR', 'Fore_ArmR', 'HandR', 'IKArmR', 'TargetArmR', 'Spine', 'Hips', 'CTRLTorso', 'GunR'] },
                'GunDown': { filterBones: ['Neck', 'ShoulderL', 'ShoulderR', 'Upper_ArmL', 'Upper_ArmR', 'Fore_ArmL', 'Fore_ArmR', 'HandL', 'HandR', 'IKArmL', 'IKArmR', 'TargetArmL', 'TargetArmR', 'Spine', 'Hips', 'CTRLTorso', 'GunL', 'GunR'] }
            };

            this.mixer = new THREE.AnimationMixer(this.model);
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
            console.error('Error loading Male_MC.glb: ', error);
        });
    }

    BloodBar() {
        //blood bar
        const healthBarContainer = new THREE.Group();
        healthBarContainer.name = "healthBarContainer";
        healthBarContainer.position.set(0, 2.2, 0);
        const healthBarBackground = new THREE.Mesh(
            new THREE.BoxGeometry(1.1, 0.1, 0.05),
            new THREE.MeshStandardMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.7
            })
        );
        healthBarBackground.name = "healthBarBackground";

        // current blood
        const healthBarFill = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.1, 0.05),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        healthBarFill.name = "healthBarFill";
        healthBarFill.position.set(0, 0, 0.06);

        healthBarContainer.add(healthBarBackground);
        healthBarContainer.add(healthBarFill);
        this.model.add(healthBarContainer);
    }
    initInput() {
        super.initInput();
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0) { // Left mouse button

                if (!this.model.userData.isAim) {
                    BoneFilters(this.action['Walking'], { filterBones: ['CTRLTorso', 'ThighL', 'ThighR', 'ShinL', 'ShinR', 'FootL', 'FootR', 'HeelsL', 'HeelsR', 'ToesL', 'ToesR', 'TargetLegL', 'TargetLegR'] });
                    this.model.userData.isAim = true;
                    this.action['Idle']?.fadeOut(0.3);
                    this.action['GunDown']?.fadeOut(0.3);
                    this.action['Aim'].reset().fadeIn(0.3).play();
                    this.model.userData.isShoot = true;
                }
                if (this.model.userData.isShoot) {
                    this.mixer.addEventListener('finished', this.OnGunUp.bind(this));
                }
            }
        });
        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) {

                this.model.userData.isAim = false;
                this.model.userData.isShoot = false;
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
            if (!this.model.userData.isAim && !this.model.userData.isShoot) {
                BoneFilters(this.action['Walking'], {});
            }
            if (!this.model.userData.isWalk) {
                this.action['Idle'].reset().fadeIn(0.3).play();
            }
        }
    }
    Shoot() {
        const gun = this.model.userData.isRightHand ? this.rightGun : this.leftGun;
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
        if (this.model.userData.isRightHand) {
            this.action['ShootR'].reset().play();
        }
        else {
            this.action['ShootL'].reset().play();
        }
        this.model.userData.isRightHand = !this.model.userData.isRightHand;
    }
    update(delta) {
        super.update(delta);
        this.dynamicMeshes = this.dynamicMeshes.filter(obj => {
            if (obj.userData.isBullet) {
                obj.position.add(obj.velocity.clone().multiplyScalar(delta));
                obj.geometry.computeBoundingSphere();
                obj.boundingSphere = obj.geometry.boundingSphere.clone();
                obj.boundingSphere.applyMatrix4(obj.matrixWorld);

                let hitSomething = false;
                let monstersToDamage = [];

                this.scene.traverse(child => {
                    if (child.userData?.isMonster && child.userData.collider) {
                        const monsterBox = new THREE.Box3().setFromObject(child.userData.collider);

                        if (obj.boundingSphere.intersectsBox(monsterBox)) {
                            if (typeof child.userData.takeDamage === 'function') {
                                monstersToDamage.push(child);
                            }
                            hitSomething = true;
                        }
                    }
                });

                monstersToDamage.forEach(monster => {
                    if (typeof monster.userData.takeDamage === 'function') {
                        monster.userData.takeDamage(this.stats.DMG);
                    }
                });

                if (performance.now() - obj.userData.spawnTime > 2000 || hitSomething) {
                    this.scene.remove(obj);
                    return false;
                }
            }
            return true;
        });
    }

}