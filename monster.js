import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BoneFilters, lerpAngle } from './animationUtils.js';

export class Monster {
    constructor(scene, player, staticMeshes, dynamicMeshes, position, options = {}) {
        this.scene = scene;
        this.player = player;
        this.position = position
        this.staticMeshes = staticMeshes;
        this.dynamicMeshes = dynamicMeshes;
        this.loader = new GLTFLoader();
        this.monster = null;
        this.mixer = null;
        this.animations = [];
        this.action = {};

        this.type = options.type;
        this.tier = options.tier;
        this.moveSpeed = options.moveSpeed || 1.5;
        this.attackRange = options.attackRange;
        this.detectionRange = options.detectionRange;
        this.modelPath = options.modelPath;
        this.scale = options.scale;
        this.health = options.health || null;
        this.maxHealth = options.maxHealth;
        this.attackDamage = options.attackDamage || null;
        this.attackCoolDown = options.attackCoolDown;

        this.avoidanceForce = new THREE.Vector3();
        this.lastAttack = 0;
        this.isAlive = true;
        this.currentAction = null;
        this.attackTimer = 0.5;

        this.scoreValue = 10;

        this.loadModel();
    }

    getDamageModifier()
    {
        const difficulty = localStorage.getItem('difficulty') || 'easy';
        let damageModifier = 0;
        switch (difficulty) {
            case 'medium':
                damageModifier = 5;
                break;
            case 'hard':
                damageModifier = 10;
                break;
            default:
                damageModifier = 0;
        }
        return damageModifier;
    }

    loadModel() {
        this.loader.load(this.modelPath, (gltfMonster) => {
            this.monster = gltfMonster.scene;
            this.monster.scale.set(this.scale.x, this.scale.y, this.scale.z);
            this.monster.userData = {
                isMonster: true,
                isAlive: true,
                health: this.health,
                type: this.type,
                tier: this.tier,
                collider: null,
                takeDamage: (damage) => this.takeDamage(damage),
            };
            if (this.position) {
                this.monster.position.copy(this.position);
            }

            this.createhitbox();
            this.monster.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.scene.add(this.monster);
            //add blood bar
            this.addHealthBar();
            //Animation setup
            this.setupAnimations(gltfMonster.animations);
            this.onModelLoad(gltfMonster);
        }, undefined, (error) => {
            console.error(error);
        });
    }
    createhitbox() { }
    pushPlayerBack(pushForce) {
        const playerPosition = this.player.model.position.clone();
        const monsterPosition = this.monster.position.clone();

        const pushDir = new THREE.Vector3(
            playerPosition.x - monsterPosition.x,
            0,
            playerPosition.z - monsterPosition.z
        ).normalize();

        const velocity = pushDir.multiplyScalar(pushForce);
        this.player.getPushVelocity(velocity);
    }
    onModelLoad(gltfMonster) { }

    addHealthBar() {
        //blood bar
        const healthBarContainer = new THREE.Group();
        healthBarContainer.name = "healthBarContainer";
        healthBarContainer.position.set(0, 2.2, 0);
        const healthBarBackground = new THREE.Mesh(
            new THREE.BoxGeometry(1.1, 0.1, 0.05),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.7
            })
        );
        healthBarBackground.name = "healthBarBackground";

        // current blood
        const healthBarFill = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.1, 0.05),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        healthBarFill.name = "healthBarFill";
        healthBarFill.position.set(0, 0, 0.06);

        healthBarContainer.add(healthBarBackground);
        healthBarContainer.add(healthBarFill);
        this.monster.add(healthBarContainer);
    }

    setupAnimations(animations) {
        console.log('Available animations:', animations.map(a => a.name));
    }

    update(delta, monsters) {
        if (!this.player.isAlive || !this.player || !this.monster || !this.mixer || !this.player.model) return;
        this.mixer.update(delta);

        this.avoidMonster(monsters);

        if (this.attackTimer > 0) {
            this.attackTimer -= delta;
        }

        this.detectionandAttack(delta);
        this.updateDynamicMesh(delta);
    }

    detectionandAttack(delta) { }
    updateDynamicMesh(delta) {
        this.dynamicMeshes.forEach((item, index) => {
            if (!this.monster || !this.monster.userData.isAlive) {
                this.scene.remove(item.mesh);
                this.dynamicMeshes.splice(index, 1);
            }
            const move = item.direction.clone().multiplyScalar(item.speed * delta);
            item.mesh.position.add(move);
            if (item.mesh.position.distanceTo(this.player?.model?.position) < 1) {
                if (this.player.isAlive) {
                    this.player.takeDamage(this.attackDamage + this.getDamageModifier());
                }
                this.scene.remove(item.mesh);
                this.dynamicMeshes.splice(index, 1);
            }
            if (item.mesh.position.distanceTo(this.monster.position) > 50) {
                this.scene.remove(item.mesh);
                this.dynamicMeshes.splice(index, 1);
            }
        });
    }

    avoidMonster(monsters) {
        if (!this.monster || !this.monster.userData.isAlive) return;

        const monPosition = this.monster.position;

        monsters.forEach(other => {
            if (other === this || !other.monster || !other.monster.userData.isAlive) return;

            const otherPos = other.monster.position;
            const distance = monPosition.distanceTo(otherPos);
            const minDistance = 1;

            if (distance < minDistance) {
                const pushDir = new THREE.Vector3().subVectors(monPosition, otherPos).normalize();
                const pushStrength = (minDistance - distance) * 0.1;

                this.monster.position.addScaledVector(pushDir, pushStrength);
            }
        });
    }

    MovetoPlayer(delta, playerPosition) {
        if (!this.monster) return;

        const direction = new THREE.Vector3().subVectors(playerPosition, this.monster.position);
        direction.y = 0;

        if (direction.length() > 0) {
            direction.normalize();

            const moveForce = direction.clone().add(this.avoidanceForce);
            if (moveForce.length() > 0) {
                moveForce.normalize();
            }

            const angle = Math.atan2(moveForce.x, moveForce.z);
            this.monster.rotation.y = angle;

            const moveMonster = this.moveSpeed * delta;
            const originalPosition = this.monster.position.clone();

            //move along x
            this.monster.position.x += moveForce.x * moveMonster;
            if (this.checkStaticCollisions()) {
                this.monster.position.x = originalPosition.x;
            }

            //move along z
            this.monster.position.z += moveForce.z * moveMonster;
            if (this.checkStaticCollisions()) {
                this.monster.position.z = originalPosition.z;
            }

            if (this.action['Walking'] && !this.action['Walking'].isRunning()) {
                this.action['Walking'].play();
            }
        }
    }

    checkStaticCollisions() {
        if (!this.monster.userData.collider) return;

        this.monster.userData.collider.updateMatrixWorld();
        const monsterBox = new THREE.Box3().setFromObject(this.monster.userData.collider);

        for (const mesh of this.staticMeshes) {
            if (mesh.boundingBox && monsterBox.intersectsBox(mesh.boundingBox)) {
                return true; //colllision
            }
        }
        return false;
    }

    canSeePlayer() {
        if (!this.monster || !this.player) return false;

        const origin = this.monster.position.clone();
        origin.y += 1.0;

        const target = this.player.model.position.clone();
        target.y += 1.0;

        const direction = new THREE.Vector3().subVectors(target, origin).normalize();
        const raycaster = new THREE.Raycaster(origin, direction);
        const distance = origin.distanceTo(target);

        const hits = raycaster.intersectObjects(this.staticMeshes, true);
        for (const hit of hits) {
            if (hit.distance < distance) {
                return false; //barrer between player and monster
            }
        }

        return true;
    }

    attackPlayer() {
        if (!this.canSeePlayer()) return;
        this.performAttack();
    }

    performAttack() {
        console.log(`${this.type} attack`);
    }

    takeDamage(damage) {
        if (!this.isAlive) return;
        const maxHealth = this.maxHealth;
        this.health = Math.max(0, this.health - damage);
        console.log(`Monster takes ${damage} damage, health now ${this.health}`);

        const healthBar = this.monster.getObjectByName("healthBarFill");
        if (healthBar) {
            const healthRatio = this.health / maxHealth;
            healthBar.scale.x = healthRatio;
            healthBar.position.x = -(1 - healthRatio) / 2;
        }

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        if (!this.isAlive || !this.monster) return;

        if (this.mixer) {
            this.mixer.stopAllAction();
        }

        this.dynamicMeshes = this.dynamicMeshes.filter(bullet =>
            bullet.mesh.userData?.shooter !== this.monster
        );

        const parent = this.monster.parent;
        if (parent) {
            parent.remove(this.monster);
        }

        this.isAlive = false;
        this.monster = null;

        const event = new CustomEvent('monsterKilled', { detail: { score: this.scoreValue } });
        window.dispatchEvent(event);
    }
}

export class Slime extends Monster {
    constructor(scene, player, staticMeshes, dynamicMeshes, position) {
        super(scene, player, staticMeshes, dynamicMeshes, position, {
            type: 'Slime',
            tier: 1,
            health: 50,
            maxHealth: 50,
            attackDamage: 5,
            detectionRange: 15,
            moveSpeed: 1.2,
            modelPath: './Model/Slime.glb',
            scale: { x: 0.8, y: 0.8, z: 0.8 },
            attackCoolDown: 2000
        });
        this.scoreValue = 10;
    }

    detectionandAttack(delta) {
        const playerPosition = this.player.model.position;
        const monsterPosition = this.monster.position;

        const distanceToPlayer = monsterPosition.distanceTo(playerPosition);

        // if player is within detection range
        if (distanceToPlayer <= this.detectionRange) {
            this.MovetoPlayer(delta, playerPosition);
            this.performAttack();
        }
        else {
            if (this.action['Walking']) {
                this.action['Walking'].stop();
            }
        }
    }

    performAttack() {
        if (!this.player.isAlive || !this.monster || !this.monster?.userData?.collider || !this.player.model?.userData?.collider) return;

        const currenttime = performance.now();

        if (currenttime - this.lastAttack < this.attackCoolDown) {
            return;
        }

        const slimeBox = new THREE.Box3().setFromObject(this.monster.userData.collider);
        const playerBox = new THREE.Box3().setFromObject(this.player.model.userData.collider);

        if (slimeBox.intersectsBox(playerBox)) {
            this.player.takeDamage(this.attackDamage + this.getDamageModifier());
            this.lastAttack = currenttime;
            this.pushPlayerBack(1.0);
            console.log(`Slime hit player for ${this.attackDamage} damage`);
        }
    }

    setupAnimations(animations) {
        this.mixer = new THREE.AnimationMixer(this.monster);
        this.animations = animations;

        this.animations.forEach((clip) => {
            const act = this.mixer.clipAction(clip);
            act.play();
            this.mixer.update(0); //Update mixer de khoi tao propertyBindings
            act.stop();

            this.action[clip.name] = act;
            act.setLoop(THREE.LoopRepeat);
        });

        if (this.action['Walking']) {
            this.action['Walking'].play();
            this.isFlying = true;
        }
    }

    createhitbox() {
        const monsterHitbox = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 1, 0.6),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
        );
        monsterHitbox.name = 'monsterHitbox';
        monsterHitbox.visible = false;
        monsterHitbox.position.set(0, monsterHitbox.position.y / 2 + 1, 0);
        this.monster.add(monsterHitbox);
        this.monster.userData.collider = monsterHitbox;
    }
}

export class Pixie extends Monster {
    constructor(scene, player, staticMeshes, dynamicMeshes, position) {
        super(scene, player, staticMeshes, dynamicMeshes, position, {
            type: 'Pixie',
            tier: 1,
            health: 50,
            maxHealth: 50,
            attackDamage: 5,
            moveSpeed: 1.2,
            attackRange: 5,
            detectionRange: 15,
            modelPath: './Model/Pixie.glb',
            scale: { x: 1.1, y: 1.1, z: 1.1 },
            attackCoolDown: 2
        });

        this.isFlying = false;
        this.wingsspeed = 1.5;
        this.isAttacking = false;
        this.scoreValue = 15;
    }

    createhitbox() {
        const monsterHitbox = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 2, 0.5),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
        );
        monsterHitbox.name = 'monsterHitbox';
        monsterHitbox.visible = false;
        monsterHitbox.position.set(0, monsterHitbox.position.y / 2 + 1, 0);
        this.monster.add(monsterHitbox);
        this.monster.userData.collider = monsterHitbox;
    }

    detectionandAttack(delta) {
        const playerPosition = this.player.model.position;
        const monsterPosition = this.monster.position;

        const distanceToPlayer = monsterPosition.distanceTo(playerPosition);

        // if player is within detection range
        if (distanceToPlayer <= this.detectionRange) {
            if (distanceToPlayer > this.attackRange) {
                this.MovetoPlayer(delta, playerPosition);
                if (this.action['Shoot'] && this.action['Shoot'].isRunning()) {
                    this.action['Shoot'].stop();
                    this.action['Walking'].play();
                }
            }
            else {
                if (this.action['Walking'] && this.action['Walking'].isRunning()) {
                    this.action['Walking'].stop();
                }
                if (this.player.isAlive && this.attackTimer <= 0) {
                    this.attackPlayer();
                    this.attackTimer = this.attackCoolDown;
                }
            }

        }
        else {
            if (this.action['Walking']) {
                this.action['Walking'].stop();
            }
        }
    }

    setupAnimations(animations) {
        this.mixer = new THREE.AnimationMixer(this.monster);
        this.animations = animations;

        this.animations.forEach((clip) => {
            const act = this.mixer.clipAction(clip);
            act.play();
            this.mixer.update(0); //Update mixer de khoi tao propertyBindings
            act.stop();

            this.action[clip.name] = act;
            act.setLoop(THREE.LoopRepeat);
        });

        if (this.action['Walking']) {
            this.action['Shoot'].reset().stop();
            this.action['Walking'].play();
            this.isFlying = true;
        }
    }

    performAttack() {
        if (this.action['Shoot']) {
            this.action['Walking'].reset().stop();
            this.action['Shoot'].reset().play();
            this.shootBullet();
        }
    }

    shootBullet() {
        if (!this.isAlive || !this.scene) return;
        const bulletgeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16);
        const bulletMaterial = new THREE.MeshStandardMaterial({
            color: 0xa84fff,
            emissive: 0x5500aa,
            emissiveIntensity: 1.5
        });
        const bulletdirection = new THREE.Vector3(0, 1, 0);

        //Bullet
        const bullet = new THREE.Mesh(
            bulletgeometry,
            bulletMaterial
        );
        bullet.castShadow = true;

        const monsterPos = this.monster.position.clone();
        bullet.position.copy(monsterPos);
        this.scene.add(bullet);

        const direction = new THREE.Vector3().subVectors(this.player.model.position, monsterPos).normalize();
        bullet.quaternion.setFromUnitVectors(
            bulletdirection,
            direction
        );
        const bulletSpeed = 2;

        this.dynamicMeshes.push({ mesh: bullet, direction, speed: bulletSpeed });
    }
}

export class Doll extends Monster {
    constructor(scene, player, staticMeshes, dynamicMeshes, position) {
        super(scene, player, staticMeshes, dynamicMeshes, position, {
            type: 'Doll',
            tier: 2,
            health: 100,
            maxHealth: 100,
            attackDamage: 15,
            moveSpeed: 3,
            modelPath: './Model/Doll.glb',
            attackRange: 5.0,
            detectionRange: 20,
            scale: { x: 1.0, y: 1.0, z: 1.0 },
            attackCoolDown: 5000
        });

        this.jumperTimer = 0;
        this.isJumping = false;
        this.isHidden = true;
        this.originalY = position.y;
        this.scoreValue = 25;
    }

    update(delta, monsters) {
        super.update(delta, monsters)
        if (this.isJumping) {
            this.jumperTimer += delta;
            this.updateJump(delta);
        }
    }

    createhitbox() {
        const monsterHitbox = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 1.5, 0.5),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
        );
        monsterHitbox.name = 'monsterHitbox';
        monsterHitbox.visible = false;
        monsterHitbox.position.set(0, monsterHitbox.position.y / 2 + 1, 0);
        this.monster.add(monsterHitbox);
        this.monster.userData.collider = monsterHitbox;
    }

    detectionandAttack(delta) {
        const playerPosition = this.player.model.position;
        const monsterPosition = this.monster.position;
        const distanceToPlayer = monsterPosition.distanceTo(playerPosition);
        const DollBox = new THREE.Box3().setFromObject(this.monster.userData.collider);
        const playerBox = new THREE.Box3().setFromObject(this.player.model.userData.collider);
        const isOverlap = DollBox.intersectsBox(playerBox);

        // if player is within detection range
        if (distanceToPlayer <= this.detectionRange) {
            console.log('isHidden:', this.isHidden);
            if (this.isHidden) {
                if (distanceToPlayer <= this.attackRange) {
                    this.reveal();
                }
            }
            if (!this.isHidden) {
                this.MovetoPlayer(delta, playerPosition);
            }

            if (isOverlap) { //this.attackRange >= distanceToPlayer
                this.performAttack();
            }
        }
        else {
            if (this.action['Walking']) {
                this.action['Walking'].stop();
            }
        }
    }

    setupAnimations(animations) {
        this.mixer = new THREE.AnimationMixer(this.monster);
        this.animations = animations;
        this.action = {};

        this.animations.forEach((clip) => {
            const act = this.mixer.clipAction(clip);
            act.play();
            this.mixer.update(0); //Update mixer de khoi tao propertyBindings
            act.stop();

            this.action[clip.name] = act;
            act.setLoop(THREE.LoopRepeat);
            if (clip.name === 'Walking' && !this.isHidden) {
                act.play();
            } else {
                act.stop();
            }
        });
    }

    onModelLoad(gltfMonster) {
        this.setupAnimations(gltfMonster.animations);
        this.hide();
    }

    reveal() {
        if (!this.monster) return;

        this.isHidden = false;
        this.isJumping = true;
        this.jumperTimer = 0;
        this.monster.visible = true;
        this.monster.position.y = this.originalY;

        if (this.action['Jump']) {
            this.action['Jump'].reset().play();
        }
        if (this.action['Walking']) {
            this.action['Walking'].play();
        }
    }

    hide() {
        this.isHidden = true;
        this.isJumping = false;
        this.jumperTimer = 0;
        this.monster.visible = false;
        this.monster.position.y = this.originalY - 3;
        if (this.action['Jump']) this.action['Jump'].stop();
        if (this.action['Walking']) this.action['Walking'].stop();
    }

    updateJump(delta) {
        const jumpDuration = 1.0;
        const jumpHeight = 2.0;
        this.jumperTimer += delta;

        const jumpProgress = this.jumperTimer / jumpDuration;
        const yPos = this.originalY + Math.sin(jumpProgress * Math.PI) * jumpHeight;
        this.monster.position.y = yPos;


        if (this.jumperTimer >= jumpDuration) {
            this.monster.position.y = this.originalY;
            this.isJumping = false;
            this.jumperTimer = 0;

            // Return to walking animation after jump
            if (this.action['Walking'] && !this.attackState) {
                this.action['Jump'].stop();
                this.action['Walking'].play();
            }
        }
    }

    performAttack() {
        if (!this.player.isAlive || !this.monster || !this.monster?.userData?.collider || !this.player.model?.userData?.collider) return;

        const currenttime = performance.now();
        if (currenttime - this.lastAttack < this.attackCoolDown) {
            return;
        }

        const DollBox = new THREE.Box3().setFromObject(this.monster.userData.collider);
        const playerBox = new THREE.Box3().setFromObject(this.player.model.userData.collider);

        if (DollBox.intersectsBox(playerBox)) {
            this.action['Walking'].reset().stop();
            this.action['Jump'].reset().play();
            this.player.takeDamage(this.attackDamage + this.getDamageModifier());
            this.lastAttack = currenttime;
            this.pushPlayerBack(2.0);
        }
            //this.pushPlayerBack();
            console.log(`Doll hit player for ${this.attackDamage + this.getDamageModifier()} damage`);
        //}
    }

    pushPlayerBack() {
        const playerPosition = this.player.model.position.clone();
        const monsterPosition = this.monster.position.clone();

        const pushDir = new THREE.Vector3(
            playerPosition.x - monsterPosition.x,
            0,
            playerPosition.z - monsterPosition.z
        ).normalize();

        const pushForce = 1.0;
        this.player.model.position.x += pushDir.x * pushForce;
        this.player.model.position.z += pushDir.z * pushForce;
    }
}


export class BossWitch extends Monster {
    constructor(scene, player, staticMeshes, dynamicMeshes, position) {
        super(scene, player, staticMeshes, dynamicMeshes, position, {
            type: 'Witch',
            tier: 3,
            health: 500,
            maxHealth: 500,
            attackDamage: 20,
            moveSpeed: 1.2,
            attackRange: 5,
            detectionRange: 20,
            modelPath: './Model/Witch.glb',
            scale: { x: 2.5, y: 2.5, z: 2.5 },
            attackCoolDown: 2,
        });

        this.waveAttackTimer = 0;
        this.waveAttackInterval = 7;
        this.waveAttackRange = 7;
        this.waveAttackDamage = 30;
        this.isWave = false;
        this.scoreValue = 35;
    }

    update(delta, monsters) {
        super.update(delta, monsters);
        this.waveAttackTimer += delta;
    }

    WaveAttack() {
        if (!this.isAlive || !this.scene) return;

        if (this.action['Attack']) {
            this.action['Attack'].reset().play();
            this.action['Attack'].setLoop(THREE.LoopOnce);
            this.action['Attack'].clampWhenFinished = true;
        }

        setTimeout(() => {
            const waveGeometry = new THREE.RingGeometry(0.66, 1, 32);
            const waveMaterial = new THREE.MeshStandardMaterial({
                color: 0x8a2be2,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });

            const wave = new THREE.Mesh(waveGeometry, waveMaterial);
            wave.rotation.x = -Math.PI / 2;
            wave.position.copy(this.monster.position);
            wave.position.y = 0.1;
            this.scene.add(wave);

            let scale = 0.1;
            const maxScale = this.waveAttackRange;
            const waveSpeed = 0.2;

            const animateWave = () => {
                scale += waveSpeed * 0.5;
                wave.scale.set(scale, scale, scale);

                if (this.player.isAlive) {
                    const distance = this.player.model.position.distanceTo(wave.position);
                    if (distance <= scale && distance >= scale - waveSpeed) {
                        this.player.takeDamage(this.waveAttackDamage);
                    }
                }

                if (scale < maxScale) {
                    requestAnimationFrame(animateWave);
                } else {
                    this.scene.remove(wave);
                    wave.geometry.dispose();
                    wave.material.dispose();

                    if (this.action['Attack'] && this.action['Attack'].isRunning()) {
                        this.action['Attack'].stop();
                    }
                }
            };

            animateWave();

        }, 1500);
    }

    detectionandAttack(delta) {
        const playerPosition = this.player.model.position;
        const monsterPosition = this.monster.position;

        const distanceToPlayer = monsterPosition.distanceTo(playerPosition);

        // if player is within detection range
        if (distanceToPlayer <= this.detectionRange) {
            if (distanceToPlayer > this.attackRange) {
                this.MovetoPlayer(delta, playerPosition);
                if (this.action['Shoot'] && this.action['Shoot'].isRunning()) {
                    this.action['Shoot'].stop();
                    this.action['Walking'].play();
                }
            }
            else {
                if (this.action['Walking'] && this.action['Walking'].isRunning()) {
                    this.action['Walking'].stop();
                }
                if (this.player.isAlive && this.attackTimer <= 0) {
                    this.attackPlayer();
                    this.attackTimer = this.attackCoolDown;
                }
            }
        }
        else {
            if (this.action['Walking']) {
                this.action['Walking'].stop();
            }
        }
    }

    createhitbox() {
        const monsterHitbox = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 1.5, 0.5),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
        );
        monsterHitbox.name = 'monsterHitbox';
        monsterHitbox.visible = false;
        monsterHitbox.position.set(0, monsterHitbox.position.y / 2 + 1, 0);
        this.monster.add(monsterHitbox);
        this.monster.userData.collider = monsterHitbox;
    }

    setupAnimations(animations) {
        this.mixer = new THREE.AnimationMixer(this.monster);
        this.animations = animations;

        this.animations.forEach((clip) => {
            const act = this.mixer.clipAction(clip);
            act.play();
            this.mixer.update(0); //Update mixer de khoi tao propertyBindings
            act.stop();

            this.action[clip.name] = act;
            act.setLoop(THREE.LoopRepeat);
        });
    }

    performAttack() {
        if (this.waveAttackTimer >= this.waveAttackInterval) {
            this.action['Shoot'].stop();
            this.action['Attack'].reset().play();
            this.WaveAttack();
            this.waveAttackTimer = 0;
        }
        if (this.action['Shoot']) {
            this.action['Shoot'].reset().play();
            this.action['Shoot'].fadeOut(0.2);
            this.shootBullet();
        }
    }

    shootBullet() {
        if (!this.isAlive || !this.scene) return;
        const playerPosition = this.player.model.position;
        const wand = this.monster.getObjectByName('Wand_Core');
        const bulletgeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const bulletMaterial = new THREE.MeshStandardMaterial({
            color: 0xa84fff,
            emissive: 0x5500aa,
            emissiveIntensity: 1.5,
            transparent: true
        });
        const bulletdirection = new THREE.Vector3(0, 1, 0);

        //Bullet
        const bullet = new THREE.Mesh(
            bulletgeometry,
            bulletMaterial
        );
        bullet.castShadow = true;

        const wandPosition = new THREE.Vector3();
        wand.getWorldPosition(wandPosition);
        bullet.position.copy(wandPosition);
        this.scene.add(bullet);

        const direction = new THREE.Vector3().subVectors(
            playerPosition,
            wandPosition
        ).normalize();
        bullet.quaternion.setFromUnitVectors(
            bulletdirection,
            direction
        );
        const bulletSpeed = 5;

        this.dynamicMeshes.push({
            mesh: bullet,
            direction,
            speed: bulletSpeed,
        });
    }
} 