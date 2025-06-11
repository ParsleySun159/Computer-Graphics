import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'; //Load HDR map
import { BossWitch, Doll, Monster, Pixie, Slime } from './monster.js';
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
        this.loadMap();
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
                    //child.castShadow = true;
                    //child.shadow.bias = -0.01;
                    //child.shadow.mapSize.width = 2048;
                    //child.shadow.mapSize.height = 2048;
                }
            });
            this.add(this.mapScene);
            window.mapScene = this.mapScene;
            this.currentRoom = this.rooms.get('Room1');
            window.rooms = this.rooms;

            this.spawnMonsters(this.currentRoom);

            let event = new Event('levelLoaded');
            window.dispatchEvent(event);

            this.mixer = new THREE.AnimationMixer(this.mapScene);
            this.animations = gltf.animations;
            this.animations.forEach((clip) => {
                const act = this.mixer.clipAction(clip);
                this.action[clip.name] = act;
            });
            this.action['FireLoop'].reset().play();
            const loader = new RGBELoader();
            loader.load('./Model/lightmap.hdr', (lightmap) => {
                lightmap.flipY = false;
                lightmap.channel = 1; //Set lightmap to use uv1
                //lightmap.encoding = THREE.LinearEncoding;
                //lightmap.generateMipmaps = false;
                //lightmap.minFilter = THREE.LinearFilter;
                //lightmap.magFilter = THREE.LinearFilter;
                this.mapScene.traverse((child) => {
                    if (child.material) {
                        let newMat = child.material.clone();
                        child.material = newMat;
                        child.material.lightMap = lightmap;
                        child.material.lightMapIntensity = 1;
                        child.material.needsUpdate = true;
                    }
                });
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
                    {type: 'Slime', position: new THREE.Vector3(0, 0, -28)},    
                    {type: 'Slime', position: new THREE.Vector3(-5, 0, -30)},   
                    {type: 'Pixie', position: new THREE.Vector3(0, 0, -32)},   
                    {type: 'Pixie', position: new THREE.Vector3(0, 0, -34)},
                    {type: 'Pixie', position: new THREE.Vector3(-7, 0, -34)}
                ];
                break;
            case 'Room3':
                monsters = [
                    {type: 'Slime', position:new THREE.Vector3(-28, 0, -30)},    
                    {type: 'Pixie', position:new THREE.Vector3(-26, 0, -32)},   
                    {type: 'Pixie', position:new THREE.Vector3(-24, 0, -34)},   
                    {type: 'Slime', position:new THREE.Vector3(-22, 0, -25)},    
                    {type: 'Slime', position:new THREE.Vector3(-20, 0, -28)},
                    {type: 'Doll', position:new THREE.Vector3(-20, 0, -25)},
                    {type: 'Doll', position:new THREE.Vector3(-20, 0, -24)},   
                ];
                break;
            case 'Room4':
                monsters = [
                    {type: 'Doll', position:new THREE.Vector3(20, 0, -25)},    
                    {type: 'Doll', position:new THREE.Vector3(24, 0, -28)},   
                    {type: 'Doll', position:new THREE.Vector3(26, 0, -30)},   
                    {type: 'Doll', position:new THREE.Vector3(28, 0, -32)},
                    {type: 'Doll', position:new THREE.Vector3(22, 0, -34)},   
                    {type: 'Witch', position:new THREE.Vector3(22, 0, -32)}  
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
                        console.log('Room2 position:', this.rooms.get('Room2').object.position);
                        this.spawnMonsters(this.currentRoom);
                    }
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
                if (this.currentRoom.monsters.every(monster => !monster.isAlive)) {
                    console.log('All monsters cleared in: ', this.currentRoom.object.name);
                    this.currentRoom.states.isCleared = true;
                }
            }
            if (this.currentRoom.states.isCleared) {
                this.isClear(this.currentRoom);
            }
            if (this.currentRoom.object.name === 'Room4' && this.currentRoom.states.isCleared && !this.levelCompleted) {
                this.levelCompleted = true;
                window.dispatchEvent(new Event('levelCleared'));
            }
        }
    }
    disposeRoom(room) {
        if (!room || !room.object || room.states.isDisposed) {
            console.log('disposeRoom called with invalid room or already disposed:', room?.object?.name || room);
            return;
        }
        console.log(`Disposing room: ${room.object.name}`);
        let event2 = new Event('roomDisposed');
        window.dispatchEvent(event2);

        const objectsToRemove = [];
        room.object.traverse((child) => {
            if (child === room.object || child.name.startsWith('Room') || child.name.startsWith('Wall') || child.name.startsWith('Torch')) {
                return;
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
    dispose() {
        this.rooms.forEach((room) => {
            this.disposeRoom(room);
            this.remove(room);
        });
        this.rooms.clear();
        this.currentRoom = null;
        this.children = [];
    }
}

/*export class Ground extends THREE.Mesh {
  constructor(width, height) {
      super()
      this.width = width;
      this.height = height;
      this.createGeometry();
      this.material = new THREE.MeshStandardMaterial({ color: 0x404040 });
      this.rotation.x = -Math.PI / 2;
      this.receiveShadow = true;
  }

  createGeometry() {
      this.geometry?.dispose();
      this.geometry = new THREE.PlaneGeometry(this.width, this.height);
      this.geometry.computeVertexNormals();
  }
}*/