import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// export class SpeedBoostItem {
//     constructor(scene, player, position, duration = 5, boostMultiplier = 2, modelPath = null, scale = new THREE.Vector3(1, 1, 1)) {
//         this.scene = scene;
//         this.player = player;
//         this.position = position;
//         this.duration = duration;
//         this.boostMultiplier = boostMultiplier;
//         this.modelPath = modelPath;
//         this.scale = scale;

//         this.isActive = true;
//         this.originalSpeed = null;

//         this.loader = new GLTFLoader();
//         this.mesh = null;

//         if (this.modelPath) {
//             this.loadModel();
//         } else {
//             this.createPlaceholderMesh();
//         }
//     }

//     checkCollision() {
//         if (!this.mesh || !this.player || !this.player.model) return false;

//         const itemBox = new THREE.Box3().setFromObject(this.mesh);

//         // Use the player hitbox, if it exists
//         const playerHitbox = this.player.model.userData.collider;
//         if (!playerHitbox) return false;

//         const playerBox = new THREE.Box3().setFromObject(playerHitbox);

//         return itemBox.intersectsBox(playerBox);
//     }

//     loadModel() {
//         this.loader.load(this.modelPath, (gltf) => {
//             this.mesh = gltf.scene;
//             this.mesh.scale.copy(this.scale);
//             this.mesh.position.copy(this.position);
//             this.mesh.userData.isSpeedBoost = true;

//             this.scene.add(this.mesh);
//         }, undefined, (error) => {
//             console.error("Error loading speed boost model:", error);
//             this.createPlaceholderMesh();
//         });
//     }

//     createPlaceholderMesh() {
//         this.mesh = new THREE.Mesh(
//             new THREE.SphereGeometry(0.3, 16, 16),
//             new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffaa })
//         );
//         this.mesh.position.copy(this.position);
//         this.mesh.userData.isSpeedBoost = true;

//         this.scene.add(this.mesh);
//     }

//     update(delta) {
//         if (!this.isActive || !this.mesh) return;


//         this.mesh.rotation.y += delta;

//         if (this.checkCollision()) {
//             this.applyBoost();
//         }
//     }

//     applyBoost() {
//         if (!this.isActive) return;

//         this.isActive = false;
//         this.scene.remove(this.mesh);

//         this.originalSpeed = this.player.stats.Speed;
//         this.player.stats.Speed *= this.boostMultiplier;
//         console.log(this.player.stats.Speed);

//         setTimeout(() => this.removeBoost(), this.duration * 1000);
//     }

//     removeBoost() {
//         if (this.player) {
//             this.player.stats.Speed = this.originalSpeed;
//             console.log(this.player.stats.Speed);
//         }
//     }
// }

export class BaseItem {
    constructor(
        scene,
        player,
        position,
        modelPath = null,
        scale = new THREE.Vector3(1, 1, 1),
    ) {
        this.scene = scene;
        this.player = player;
        this.position = position;
        this.modelPath = modelPath;
        this.scale = scale;

        this.isActive = true;
        this.mesh = null;
        this.loader = new GLTFLoader();

        if (this.modelPath) {
            this.loadModel();
        } 
        else {
            console.log("fail");
            this.createPlaceholderMesh();
        }
    }

    loadModel() {
        this.loader.load(this.modelPath, (gltf) => {
            this.mesh = gltf.scene;
            this.mesh.scale.copy(this.scale);
            this.mesh.position.copy(this.position);
            this.scene.add(this.mesh);
            console.log("success");
        }, undefined, (error) => {
            console.error("Error loading item model:", error);
            this.createPlaceholderMesh();
        });
    }
    createPlaceholderMesh() {
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffaa })
        );
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    checkCollision() {
        if (!this.mesh || !this.player || !this.player.model) return false;

        const itemBox = new THREE.Box3().setFromObject(this.mesh);
        const playerHitbox = this.player.model.userData.collider;
        if (!playerHitbox) return false;

        const playerBox = new THREE.Box3().setFromObject(playerHitbox);
        return itemBox.intersectsBox(playerBox);
    }

    update(delta) {
        if (!this.isActive || !this.mesh) return;
        this.mesh.rotation.y += delta;

        if (this.checkCollision()) {
            this.onPickup();
        }
    }

    onPickup() {
        throw new Error("onPickup() must be implemented by subclass");
    }
    dispose() {
        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);  // ⬅️ THIS removes it from scene
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(mat => mat.dispose());
                } else {
                    this.mesh.material.dispose();
                }
            }
            this.mesh = null;
        }
        this.isActive = false;
        console.log("dispose");
    }
}

export class SpeedBoostItem extends BaseItem {
    constructor(scene, player, position, duration = 5, boostMultiplier = 2, modelPath = null, scale = new THREE.Vector3(1, 1, 1)) {
        super(
            scene,
            player,
            position,
            modelPath,
            scale,
        );

        this.duration = duration;
        this.boostMultiplier = boostMultiplier;
        this.originalSpeed = null;
    }

    onPickup() {
        if (!this.isActive) return;

        this.isActive = false;
        this.scene.remove(this.mesh);

        this.originalSpeed = this.player.stats.Speed;
        this.player.stats.Speed *= this.boostMultiplier;
        console.log("Speed boosted to:", this.player.stats.Speed);
        const event = new CustomEvent('speedBoost', { detail: { speed: this.player.stats.Speed } });
        window.dispatchEvent(event);

        setTimeout(() => {
            this.player.stats.Speed = this.originalSpeed;
            const event = new CustomEvent('speedBoost', { detail: { speed: this.player.stats.Speed } });
            window.dispatchEvent(event);
            console.log("Speed restored to:", this.player.stats.Speed);
        }, this.duration * 1000);
    }
}

export class HealItem extends BaseItem {
    constructor(scene, player, position, modelPath = null, scale = new THREE.Vector3(1, 1, 1)) {
        super(
            scene,
            player,
            position,
            modelPath,
            scale
        );

        this.healAmount = 20;
    }

    onPickup() {
        if (!this.isActive) return;
        this.isActive = false;
        this.scene.remove(this.mesh);

        const maxHealth = this.player.stats.MaxHealth ?? 200;
        this.player.stats.Health = Math.min(maxHealth, this.player.stats.Health + this.healAmount);
        console.log("Healed. HP is now:", this.player.stats.Health);
        const event = new CustomEvent('playerHeal', { detail: { health: this.player.stats.Health } });
        window.dispatchEvent(event);
    }
}