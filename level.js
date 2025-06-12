import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BossWitch, Doll, Monster, Pixie, Slime } from './monster.js';
import { Crate, Spike } from './props.js';

import { SpeedBoostItem, HealItem} from './item.js';
export class Level extends THREE.Group {
    constructor(scene, player, staticMeshes, dynamicMeshes) {
        super();
        this.loader = new GLTFLoader();
        this.scene = scene;
        this.staticMeshes = staticMeshes;
        this.dynamicMeshes = dynamicMeshes;
        this.mapScene = null;
        this.rooms = new Map();
        this.currentRoom = null;
        this.mixer = null;
        this.animations = [];
        this.action = {};
        this.player = player;
        this.torchActions = new Map(); // Store torch animation actions
        this.torchLights = new Map(); // Store torch light objects
        this.loadMap();

        window.addEventListener('spawnMonsterWave', (event) => {
            const bossPosition = event.detail?.position;
            const positions = [];
            for (let i = 0; i < event.detail?.count; i++) {
                const x = bossPosition.x + (Math.random() - 0.5) * 10;
                const z = bossPosition.z + (Math.random() - 0.5) * 10;
                positions.push(new THREE.Vector3(x, 1, z));
            }
            for (let i = 0; i < positions.length; i++) {
                const monster = new Pixie(this.scene, this.player, this.staticMeshes, this.dynamicMeshes, positions[i]);
                this.currentRoom.monsters.push(monster);
            }
        });
    }

    loadMap() {
        this.loader.load('./Model/Level.glb', (gltf) => {
            this.mapScene = gltf.scene;
            this.mapScene.traverse((child) => {
                if (child.isMesh) {
                    if (child.name.startsWith('Room') && !child.name.includes('Door') && !child.name.endsWith('Point')) {
                        let spawnPoint = null;
                        child.traverse((c) => {
                            if (c.name.endsWith('Point')) {
                                c.visible = false;
                                spawnPoint = new THREE.Box3().setFromObject(c);
                            }
                        });

                        if (!spawnPoint) {
                            console.warn('No spawn point found for: ', child.name);
                        }

                        this.rooms.set(child.name, {
                            object: child,
                            spawnPoint: spawnPoint,
                            states: {
                                isVisited: false,
                                isCleared: false,
                                isDisposed: false
                            },
                            monsters: [],
                            spikes: [],
                            crates: [],
                            items: [],
                        });
                        console.log('Room added: ', child.name);
                        console.log(`Room ${child.name} spawnPoint:`, spawnPoint);
                    }
                    if (child.name.includes('Door')) {
                        child.visible = false;
                    }
                    child.receiveShadow = true;
                    child.castShadow = true;
                }
                if (child.isLight) {
                    child.intensity /= 1000;
                    child.castShadow = false;
                    if (child.name.startsWith('TorchLight')) {
                        this.torchLights.set(child, child.visible); // Store initial visibility
                        child.visible = false;
                    }
                }
            });
            this.add(this.mapScene);
            this.currentRoom = this.rooms.get('Room1');
            window.rooms = this.rooms;

            this.spawnMonsters(this.currentRoom);
            this.spawnItems(this.currentRoom);

            let event = new Event('levelLoaded');
            window.dispatchEvent(event);

            this.mixer = new THREE.AnimationMixer(this.mapScene);
            this.animations = gltf.animations;
            this.animations.forEach((clip) => {
                if (clip.name === 'FireLoop') {
                    this.mapScene.traverse((child) => {
                        if (child.name.startsWith('Torch')) {
                            const action = this.mixer.clipAction(clip, child);
                            this.action[clip.name] = action;
                            this.torchActions.set(child, this.action[clip.name]);
                            this.action['FireLoop'].reset().play();
                        }
                    });
                } else {
                    const act = this.mixer.clipAction(clip);
                    this.action[clip.name] = act;
                }
            });
        }, undefined, (error) => {
            console.error('Error loading Level.glb: ', error);
        });
    }
    spawnMonsters(room) {
        let monsters = [];
        switch (room.object.name) {
            case 'Room1':
                break;
            case 'Room2':
                monsters = [
                    {type: 'Slime', position: new THREE.Vector3(0, 0.1, -28)},    
                    {type: 'Slime', position: new THREE.Vector3(-5, 0.1, -30)},   
                    {type: 'Pixie', position: new THREE.Vector3(0, 1, -32)},   
                    {type: 'Pixie', position: new THREE.Vector3(0, 1, -34)},    
                    {type: 'Pixie', position: new THREE.Vector3(-7, 1, -34)}
                ];
                break;
            case 'Room3':
                monsters = [
                    {type: 'Slime', position:new THREE.Vector3(-28, 0.1, -30)},    
                    {type: 'Pixie', position:new THREE.Vector3(-26, 1, -32)},   
                    {type: 'Pixie', position:new THREE.Vector3(-24, 1, -34)},   
                    {type: 'Slime', position:new THREE.Vector3(-22, 0.1, -25)},    
                    {type: 'Slime', position:new THREE.Vector3(-20, 0.1, -28)},
                    {type: 'Doll', position:new THREE.Vector3(-20, 0, -25)}, 
                    {type: 'Doll', position:new THREE.Vector3(-20, 0, -24)},   
                ];
                break;
            case 'Room4':
                monsters = [
                    {type: 'Pixie', position:new THREE.Vector3(20, 1, -35)},
                    {type: 'Pixie', position:new THREE.Vector3(20, 1, -25)},      
                    {type: 'Pixie', position:new THREE.Vector3(29, 1, -35)},
                    {type: 'Pixie', position:new THREE.Vector3(29, 1, -25)},
                    {type: 'Slime', position:new THREE.Vector3(24, 0.1, -30)},
                ];
                break;
            case 'Room5':
                monsters = [
                    {type: 'Witch', position:new THREE.Vector3(24, 0, -62)},
                    {type: 'Doll', position:new THREE.Vector3(14, 0, -72)},
                    {type: 'Doll', position:new THREE.Vector3(34, 0, -52)},
                ];
            default:
                break;
        }

        for(const monsterType of monsters){
            let monster;
            switch(monsterType.type){
                case 'Slime':
                    monster = new Slime(this.scene, this.player, this.staticMeshes, this.dynamicMeshes, monsterType.position);
                    break;
                case 'Pixie':
                    monster = new Pixie(this.scene, this.player, this.staticMeshes, this.dynamicMeshes, monsterType.position);
                    break;
                case 'Doll':
                    monster = new Doll(this.scene, this.player, this.staticMeshes, this.dynamicMeshes, monsterType.position);
                    break;
                case 'Witch':
                    monster = new BossWitch(this.scene, this.player, this.staticMeshes, this.dynamicMeshes, monsterType.position);
                    break;
                default:
                    break;
            }
            if(monster){
                room.monsters.push(monster);
            }
        }
    }
    spawnSpikes(room){
        const spikeSize = new THREE.Vector3(0.5, 0.5, 0.5);
        const count = Math.floor(Math.random()*8+3);
        for(let i = 0; i < count; i++){
            let validPos = null;
            let attempts = 0;

            while(attempts < 10){
                const min = room.spawnPoint.min;
                const max = room.spawnPoint.max;
                const x = min.x + Math.random() * (max.x - min.x);
                const z = min.z + Math.random() * (max.z - min.z);
                const position = new THREE.Vector3(x, 0, z);

                const tempBox = new THREE.Box3().setFromCenterAndSize(position, spikeSize);

                const isCollided = this.staticMeshes.some((mesh) => {
                    if(!mesh.name.startsWith('Room') && mesh.boundingBox){
                        const worldBox = mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
                        return tempBox.intersectsBox(worldBox);
                    }
                    return false;
                });

                if(!isCollided){
                    validPos = position;
                    break
                }
                attempts++;
            }

            if(validPos){
                const spike = new Spike(this.scene, this.player, this.staticMeshes, validPos);
                room.spikes.push(spike);
                console.log(`Spawned spike at ${validPos.x}, ${validPos.y}, ${validPos.z} in ${room.object.name}`);
            }
        }
    }

    spawnCrates(room){
        const crateSize = new THREE.Vector3(0.5, 0.5, 0.5);
        const count = Math.floor(Math.random()*3+3);
        for(let i = 0; i < count; i++){
            let validPos = null;
            let attempts = 0;

            while(attempts < 10){
                const min = room.spawnPoint.min;
                const max = room.spawnPoint.max;
                const x = min.x + Math.random() * (max.x - min.x);
                const z = min.z + Math.random() * (max.z - min.z);
                const position = new THREE.Vector3(x, 0, z);

                const tempBox = new THREE.Box3().setFromCenterAndSize(position, crateSize);

                const isCollided = this.staticMeshes.some((mesh) => {
                    if(!mesh.name.startsWith('Room') && mesh.boundingBox){
                        const worldBox = mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
                        return tempBox.intersectsBox(worldBox);
                    }
                    return false;
                });

                if(!isCollided){
                    validPos = position;
                    break
                }
                attempts++;
            }

            if(validPos){
                const crate = new Crate(this.scene, this.player, this.staticMeshes, validPos);
                room.crates.push(crate);
                console.log(`Spawned crate at ${validPos.x}, ${validPos.y}, ${validPos.z} in ${room.object.name}`);
            }
        }
    }

    spawnItems(room) {
        let items = [];

        switch (room.object.name) {
            case 'Room2':
                items = [
                    { type: 'SpeedBoost', position: new THREE.Vector3(3, 0.1, -28) },
                    { type: 'Heal', position: new THREE.Vector3(-5, 0.1, -30) },
                ];
                break;
            case 'Room3':
                items = [
                    { type: 'SpeedBoost', position: new THREE.Vector3(-28, 0.1, -30) },
                    { type: 'Heal', position: new THREE.Vector3(-26, 1, -32) },
                ];
                break;
            case 'Room4':
                items = [
                    { type: 'Heal', position: new THREE.Vector3(20, 0, -25) },
                    { type: 'Heal', position: new THREE.Vector3(22, 0, -32) },
                ];
                break;
            case 'Room5':
                items = [
                    { type: 'SpeedBoost', position: new THREE.Vector3(14, 0, -72) },
                    { type: 'Heal', position: new THREE.Vector3(24, 0, -62) },
                    { type: 'Heal', position: new THREE.Vector3(34, 0, -52) },
                ];
                break;
            default:
                break;
        }

        for (const itemDef of items) {
            let item;
            switch (itemDef.type) {
                case 'SpeedBoost':
                    item = new SpeedBoostItem(this.scene, this.player, itemDef.position, 6, 2, '/Model/speed_pickup.glb', new THREE.Vector3(0.5, 0.5, 0.5));
                    break;
                case 'Heal':
                    item = new HealItem(this.scene, this.player, itemDef.position, '/Model/healing_potion.glb', new THREE.Vector3(0.5, 0.5, 0.5))
                    break;
                default:
                    break;
            }
            if (item) {
                room.items = room.items || [];
                room.items.push(item);
                //console.log("success")
            }
        }
    }

    isEnter(room) {
        if (!room || !room.object) return;
        room.object.traverse((child) => {
            if (child.isMesh && child.name.includes('Door')) {
                if (!child.visible) {
                    child.visible = true;
                }
                if (child.position.y <= 5) {
                    child.position.y += 0.5;
                }
            }
        });
    }
    isClear(room) {
        if (!room || !room.object) return;
        if (room.items && Array.isArray(room.items)) {
            room.items.forEach(item => {
                if (item.geometry) {
                    item.geometry.dispose();
                }
                if (item.material) {
                    if (Array.isArray(item.material)) {
                        item.material.forEach(mat => this.disposeMaterial(mat));
                    } else {
                        this.disposeMaterial(item.material);
                    }
                }
                if (item.parent && item !== room.object) {
                    item.parent.remove(item);
                }
                if (item.dispose && typeof item.dispose === 'function') {
                    item.dispose();
                }
            });
            room.items = [];
        }
        

        room.object.traverse((child) => {
            if (child.isMesh && child.name.includes('Door')) {
                if (child.position.y >= -5) {
                    child.position.y -= 0.5;
                }
                else {
                    child.visible = false;
                }
            }
        });
    }
    update(delta) {
        if (!this.mixer || !this.player.model || !this.player.model.position) {
            return;
        }
        this.mixer.update(delta);

        const playerPos = this.player.model.getWorldPosition(new THREE.Vector3());

        for (let [name, room] of this.rooms.entries()) {
            if (room.spawnPoint.containsPoint(playerPos)) {
                if (this.currentRoom !== room) {
                    if (this.currentRoom) {
                        this.disposeRoom(this.currentRoom);
                        this.currentRoom.states.isDisposed = true;
                    }
                    this.currentRoom = room;
                    console.log('Player entered room: ', this.currentRoom.object.name);
                    if (!this.currentRoom.states.isVisited) {
                        console.log('Room is visited for the first time: ', this.currentRoom.object.name);
                        this.currentRoom.states.isVisited = true;
                        this.spawnMonsters(this.currentRoom);
                        this.spawnSpikes(this.currentRoom);
                        this.spawnCrates(this.currentRoom);
                        this.spawnItems(this.currentRoom);
                    }
                    // Update torch animations and lights
                    this.updateTorchAnimations();
                }
                window.currentRoom = this.currentRoom;
                break;
            }
        }
        if (this.currentRoom && this.currentRoom.object && !this.currentRoom.states.isDisposed) {
            if (this.currentRoom.spawnPoint.containsPoint(playerPos) && !this.currentRoom.states.isVisited) {
                console.log('Player spawned in: ', this.currentRoom.object.name);
                this.currentRoom.states.isVisited = true;
            }
            if (this.currentRoom.states.isVisited && !this.currentRoom.states.isCleared) {
                this.isEnter(this.currentRoom);
                this.currentRoom.monsters.forEach(monster => {
                    if (monster.isAlive) {
                        monster.update(delta, this.currentRoom.monsters);
                    }
                });
                this.currentRoom.spikes.forEach(spike => {
                    spike.update(delta);
                })
                this.currentRoom.items.forEach(item => {
                    if (item.isActive) {
                        item.update(delta, this.currentRoom.items);
                    }
                });
                if (this.currentRoom.monsters.every(monster => !monster.isAlive)) {
                    console.log('All monsters cleared in: ', this.currentRoom.object.name);
                    this.currentRoom.states.isCleared = true;
                }
            }
            if (this.currentRoom.states.isCleared) {
                this.isClear(this.currentRoom);
            }
            if (this.currentRoom.object.name === 'Room5' && this.currentRoom.states.isCleared && !this.levelCompleted) {
                this.levelCompleted = true;
                window.dispatchEvent(new Event('levelCleared'));
            }
        }
    }

    updateTorchAnimations() {
        // Update torch animations
        this.torchActions.forEach((action, torch) => {
            let isInCurrentRoom = false;
            if (this.currentRoom) {
                let parent = torch;
                while (parent) {
                    if (parent === this.currentRoom.object) {
                        isInCurrentRoom = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
            if (isInCurrentRoom) {
                if (!action.isRunning()) {
                    action.reset().play();
                }
            } else {
                if (action.isRunning()) {
                    action.stop();
                }
            }
        });

        // Update torch lights
        this.torchLights.forEach((initialVisible, light) => {
            let isInCurrentRoom = false;
            if (this.currentRoom) {
                let parent = light;
                while (parent) {
                    if (parent === this.currentRoom.object) {
                        isInCurrentRoom = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
            light.visible = isInCurrentRoom; // Enable light only in current room
        });
    }

    disposeRoom(room) {
        if (!room || !room.object || room.states.isDisposed) {
            console.log('disposeRoom called with invalid room or already disposed:', room?.object?.name || room);
            return;
        }
        console.log(`Disposing room: ${room.object.name}`);
        let event2 = new Event('roomDisposed');
        window.dispatchEvent(event2);

        /*if (room.items && Array.isArray(room.items)) {
            room.items.forEach(item => {
                if (item.geometry) {
                    item.geometry.dispose();
                }
                if (item.material) {
                    if (Array.isArray(item.material)) {
                        item.material.forEach(mat => this.disposeMaterial(mat));
                    } else {
                        this.disposeMaterial(item.material);
                    }
                }
                if (item.parent && item !== room.object) {
                    item.parent.remove(item);
                }
                if (item.dispose && typeof item.dispose === 'function') {
                    item.dispose();
                }
            });
            room.items = [];
        }*/

        const objectsToRemove = [];
        room.object.traverse((child) => {
            if (child === room.object || child.name.startsWith('Room') || child.name.startsWith('Wall') || !child.name.startsWith('Torch')) {
                return;
            }
            if (child.isLight && child.name.startsWith('TorchLight')) {
                child.visible = false; // Ensure light is disabled
                this.torchLights.delete(child); // Remove from tracking
            }
  
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => this.disposeMaterial(mat));
                } else {
                    this.disposeMaterial(child.material);
                }
            }
            objectsToRemove.push(child);
        });

        objectsToRemove.forEach(child => {
            if (child.parent && child !== room.object) {
                child.parent.remove(child);
            }
        });
        room.object.children = room.object.children.filter(child => child === room.object || child.name.startsWith('Room') || child.name.startsWith('Wall') || child.name.startsWith('Torch'));
        room.states.isDisposed = true;
    }
    disposeMaterial(mat) {
        if (!mat) return;

        if (mat.map) mat.map.dispose();
        if (mat.lightMap) mat.lightMap.dispose();
        if (mat.aoMap) mat.aoMap.dispose();
        if (mat.emissiveMap) mat.emissiveMap.dispose();
        if (mat.bumpMap) mat.bumpMap.dispose();
        if (mat.normalMap) mat.normalMap.dispose();
        if (mat.displacementMap) mat.displacementMap.dispose();
        if (mat.roughnessMap) mat.roughnessMap.dispose();
        if (mat.metalnessMap) mat.metalnessMap.dispose();
        if (mat.alphaMap) mat.alphaMap.dispose();
        if (mat.envMap) mat.envMap.dispose();

        mat.dispose();
    }
}