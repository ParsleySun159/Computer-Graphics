import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Props {
    constructor(scene, player, staticMeshes, position){
        this.scene = scene;
        this.player = player;
        this.staticMeshes = staticMeshes;
        this.position = position;
        this.loader = new GLTFLoader();
        this.model = null;

        this.loadModel();
    }
    loadModel(){}
}
export class Spike extends Props {
    constructor(scene, player, staticMeshes, position){
        super(scene, player, staticMeshes, position);
        this.cooldown = 5;
        this.originalY = position.y;
        this.targetY = position.y;
    }

    loadModel(){
        this.loader.load('./Model/Spike.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(2, 2, 2);

            if(this.position){
                this.model.position.copy(this.position);
            }

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.createhitbox();
            this.scene.add(this.model);
        });
    }

    update(delta){
        if(!this.model) return;
        this.cooldown -= delta;
        if (this.cooldown >= -1 && this.cooldown <= 0) {
            this.targetY = this.originalY;
        }
        if (this.cooldown < -1){
            this.targetY = -0.6;
            this.cooldown = 5;
        }
        if(Math.abs(this.model.position.y - this.targetY) < 0.01){
            this.model.position.y = this.targetY;
        }
        else {
            this.model.position.y += (this.targetY - this.model.position.y) * delta * 10;
        }

        const spikeHitbox = new THREE.Box3().setFromObject(this.model.userData.collider);
        const playerBox = new THREE.Box3().setFromObject(this.player?.model.userData.collider);
        const isOverlap = spikeHitbox.intersectsBox(playerBox);
        if(isOverlap){
            this.attack();
        }
    }

    createhitbox() {
        const spikeHitbox = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.2, 0.4),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
        );
        spikeHitbox.name = 'spikeHitbox';
        spikeHitbox.visible = false;
        spikeHitbox.position.set(0, 0, 0);
        this.model.add(spikeHitbox);
        this.model.userData.collider = spikeHitbox;
    }
    attack(){
        const playerPosition = this.player.model.position.clone();
        const spikePosition = this.model.position.clone();

        const pushDir = new THREE.Vector3(
            playerPosition.x - spikePosition.x + (Math.random()-0.5),
            0,
            playerPosition.z - spikePosition.z + (Math.random()-0.5)
        ).normalize();

        const velocity = pushDir.multiplyScalar(1.0);
        this.player.takeDamage(5);
        this.player.getPushVelocity(velocity);
    }
}

export class Crate extends Props {
    constructor(scene, player, staticMeshes, position){
        super(scene, player, staticMeshes, position);
        this.durability = 3;
    }
    loadModel(){
        this.loader.load('./Model/Crate.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.userData ={
                isCrate: true,
                takeDamage: () => this.takeDamage(),
            }

            if(this.position){
                this.model.position.copy(this.position);
            }

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.createhitbox();
            this.scene.add(this.model);
        });
    }
    createhitbox() {
        this.model.traverse((child) => {
            if(child.isMesh && child.name.startsWith('Crate')){
                this.staticMeshes.push(child);
                child.geometry.computeBoundingBox();

                const bbox = child.geometry.boundingBox;
                const centerY = (bbox.min.y + bbox.max.y) / 2;
                const halfY = (bbox.max.y - bbox.min.y) / 2 * 1.5;
                bbox.min.y = centerY - halfY;
                bbox.max.y = centerY + halfY;

                child.boundingBox = child.geometry.boundingBox.clone();
                this.model.userData.collider = child.boundingBox;
            }
        });
        console.log(this.model);
    }
    takeDamage() {
        this.durability -= 1;
        console.log(this.durability);
        if(this.durability <= 0){
            this.dispose();
        }
    }
    dispose(){
        this.model.traverse((child) => {
            if (child.isMesh) {
                if(child.name.startsWith('Crate')){
                    const index = this.staticMeshes.indexOf(child);
                    if (index !== -1) {
                        this.staticMeshes.splice(index, 1);
                    }
                    if (child.boundingBox) {
                        delete child.boundingBox;
                    }
                    if (this.model) {
                        this.scene.remove(this.model);
                    }
                }
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });

        this.model.userData.collider = null;
        this.model = null;
    }
}