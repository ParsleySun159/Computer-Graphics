import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
            this.dispose();
        }
    }

    onPickup() {
        throw new Error("onPickup() must be implemented by subclass");
    }
    dispose() {
        if(!this.mesh) return;
        this.mesh.traverse((child) => {
            if(child === this.mesh) return;
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
            child = null;
        });
        this.scene.remove(this.mesh);
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
        this.isActive = false;
        console.log("dispose");
    }
}

export class SpeedBoostItem extends BaseItem {
    constructor(scene, player, position, modelPath = null, scale = new THREE.Vector3(1, 1, 1)) {
        super(
            scene,
            player,
            position,
            modelPath,
            scale,
        );

        this.duration = 5;
        this.boostMultiplier = 1.5;
        this.originalSpeed = this.player.stats.Speed;
    }

    onPickup() {
        if (!this.isActive) return;

        this.isActive = false;

        this.player.stats.Speed = Math.min(this.player.stats.Speed * this.boostMultiplier, 10);
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

        const maxHealth = this.player.stats.MaxHealth ?? 200;
        this.player.stats.Health = Math.min(maxHealth, this.player.stats.Health + this.healAmount);
        console.log("Healed. HP is now:", this.player.stats.Health);
        const event = new CustomEvent('playerHeal', { detail: { health: this.player.stats.Health } });
        window.dispatchEvent(event);
    }
}

export class DamageIncreaseItem extends BaseItem {
    constructor(scene, player, position, modelPath = null, scale = new THREE.Vector3(1, 1, 1)) {
        super(
            scene,
            player,
            position,
            modelPath,
            scale,
        );

        this.increaseValue = Math.floor(Math.random()*4) + 2;
    }

    onPickup() {
        if (!this.isActive) return;

        this.isActive = false;

        this.player.stats.DMG = Math.min(this.player.stats.DMG + this.increaseValue, 50);
        const event = new CustomEvent('damageIncrease', { detail: { damage: this.player.stats.DMG } });
        window.dispatchEvent(event);
    }
}

export class AtkSpeedIncreaseItem extends BaseItem {
    constructor(scene, player, position, modelPath = null, scale = new THREE.Vector3(1, 1, 1)) {
        super(
            scene,
            player,
            position,
            modelPath,
            scale,
        );

        this.increaseValue = 0.2;
    }

    onPickup() {
        if (!this.isActive) return;

        this.isActive = false;

        this.player.stats.AtkSpeed = Math.min(this.player.stats.AtkSpeed + this.increaseValue, 2.0);
        const event = new CustomEvent('atkspeedIncrease', { detail: { atkspeed: this.player.stats.AtkSpeed } });
        window.dispatchEvent(event);
    }
}