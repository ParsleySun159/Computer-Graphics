import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Monster {
    constructor(scene, player, staticMeshes, dynamicMeshes, position) {
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


        this.moveSpeed = 1.5;
        this.attackRange = 4;
        this.detectionRange = 10;
        this.lastAttack = 0;
        this.isAlive = true;
        this.currentAction = null;

        this.avoidanceForce = new THREE.Vector3();

        this.health = 100;
        this.attackDamage = 10;
        this.attackCoolDown = 2;
        this.attackTimer = 0.5;

        this.loadModel();
    }

    loadModel() {
        this.loader.load('./Model/Male_MC.glb', (gltfMonster) => {
            this.monster = gltfMonster.scene;

            this.monster.userData = {
                isMonster: true,
                isAlive: true,
                health: this.health,
                collider: null,
                takeDamage: (damage) => this.takeDamage(damage),
            };
            if (this.position) {
                this.monster.position.copy(this.position);
            }
            this.monster.scale.set(1, 1, 1);

            // Create hitbox
            const monsterHitbox = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 1.6, 0.8),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
            );
            monsterHitbox.name = 'monsterHitbox';
            monsterHitbox.visible = false;
            monsterHitbox.position.set(0, monsterHitbox.position.y / 2 + 1, 0);
            this.monster.add(monsterHitbox);
            this.monster.userData.collider = monsterHitbox;

            this.monster.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.scene.add(this.monster);

            //Animation setup
            this.mixer = new THREE.AnimationMixer(this.monster);
            this.animations = gltfMonster.animations;

            this.animations.forEach((clip) => {
                const act = this.mixer.clipAction(clip);
                this.action[clip.name] = act;
                if (clip.name === 'Idle') {
                    act.play();
                }
                else {
                    act.stop();
                }
            });
            console.log("Available animation names:", this.animations.map(a => a.name));
        }, undefined, (error) => {
            console.error(error);
        });
    }

    update(delta, monsters) {
        if (!this.player.isAlive || !this.player || !this.monster || !this.mixer || !this.player.model) return;
        this.mixer.update(delta);

        this.avoidMonster(monsters);

        if (this.attackTimer > 0) {
            this.attackTimer -= delta;
        }

        const playerPosition = this.player.model.position;
        const monsterPosition = this.monster.position;

        const distanceToPlayer = monsterPosition.distanceTo(playerPosition);

        // if player is within detection range
        if (distanceToPlayer <= this.detectionRange) {
            if (distanceToPlayer > this.attackRange) {
                this.MovetoPlayer(delta, playerPosition);
                if (this.action['ShootR'] && this.action['ShootR'].isRunning()) {
                    this.action['ShootR'].stop();
                    this.action['Walking'].play();
                }
            }
            else {
                if (this.action['Walking'] && this.action['Walking'].isRunning()) {
                    this.action['Walking'].stop();
                    this.action['Idle']?.play();
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
                this.action['Idle'].play();
            }
        }

        this.dynamicMeshes.forEach((item, index) => {
            if (!this.monster || !this.monster.userData.isAlive) {
                this.scene.remove(item.mesh);
                this.dynamicMeshes.splice(i, 1);
            }
            const move = item.direction.clone().multiplyScalar(item.speed * delta);
            item.mesh.position.add(move);
            if (item.mesh.position.distanceTo(this.player?.model?.position) < 1) {
                if (this.player.isAlive) {
                    this.player.takeDamage(10);
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
            //this.avoidObstacles(direction);

            const moveForce = direction.clone().add(this.avoidanceForce);
            if (moveForce.length() > 0) {
                moveForce.normalize();
            }

            const angle = Math.atan2(moveForce.x, moveForce.z);
            this.monster.rotation.y = angle;

            const moveMonster = this.moveSpeed * delta;
            this.monster.position.add(moveForce.multiplyScalar(moveMonster));

            if (this.action['Walking'] && !this.action['Walking'].isRunning()) {
                this.action['Idle'].stop();
                this.action['Walking'].play();
            }
        }
    }

    attackPlayer() {
        console.log('Monster attacks player!');
        if (this.action['ShootR']) {
            this.action['Walking']?.stop();
            this.action['ShootR']?.reset().play();

            this.shootBullet();

            this.mixer.addEventListener('finished', (e) => {
                if (e.action == this.action['ShootR']) {
                    this.mixer.removeEventListener('finished', arguments.callee);
                }
            });
        }
    }

    shootBullet() {
        if (!this.isAlive || !this.scene) return;

        //Bullet
        const bullet = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        bullet.castShadow = true;

        const monsterPos = this.monster.position.clone();
        bullet.position.copy(monsterPos);
        this.scene.add(bullet);

        const direction = new THREE.Vector3().subVectors(this.player.model.position, monsterPos).normalize();
        const bulletSpeed = 2;

        this.dynamicMeshes.push({ mesh: bullet, direction, speed: bulletSpeed });
    }

    takeDamage(damage) {
        if (!this.isAlive) return;
        this.health -= damage;
        console.log(`Monster takes ${damage} damage, health now ${this.health}`);

        // Cập nhật health trong userData
        if (this.monster.userData) {
            this.monster.userData.health = this.health;
        }

        if (this.health <= 0) {
            console.log("Monster died!");
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
    }
}