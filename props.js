import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SpeedBoostItem, HealItem, DamageIncreaseItem, AtkSpeedIncreaseItem} from './item.js';

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
    constructor(scene, player, staticMeshes, position, items = []){
        super(scene, player, staticMeshes, position);
        this.items = items;
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
    spawnItem(){
        if(Math.random() > 0.5) return;
        const id = Math.floor(Math.random()*4+1);
        let item;
        switch (id) {
            case 1:
                item = new HealItem(this.scene, this.player, this.position, '/Model/healing_potion.glb');
                break;
            case 2:
                item = new DamageIncreaseItem(this.scene, this.player, this.position, '/Model/damage_pickup.glb');
                break;
            case 3:
                item = new AtkSpeedIncreaseItem(this.scene, this.player, this.position, '/Model/atkspeed_pickup.glb');
                break;
            case 4:
                item = new SpeedBoostItem(this.scene, this.player, this.position, '/Model/speed_pickup.glb');
                break;
            default:
                break;
        }
        if(item) {
            this.items.push(item);
        }
    }
    createhitbox() {
        this.model.traverse((child) => {
            if(child.isMesh && child.name.startsWith('Crate')){
                this.staticMeshes.push(child);
                child.boundingBox = new THREE.Box3().setFromObject(child, true);
                this.model.userData.collider = child.boundingBox;
            }
        });
        console.log(this.model);
    }
    takeDamage() {
        this.durability -= 1;
        if(this.durability <= 0){
            this.dispose();
            this.spawnItem();
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