import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Level extends THREE.Group {
    constructor(player) {
        super();
        this.loader = new GLTFLoader();
        this.rooms = new Map();
        this.currentRoom = null;
        this.player = player;
        this.loadMap();
    }
    loadMap() {
        this.loader.load('./Model/Level.glb', (gltf) => {
            const mapScene = gltf.scene;
            window.mapScene = mapScene;
            mapScene.traverse((child) => {
                if (child.isMesh && child.name.startsWith('Room')) {
                    this.rooms.set(child.name, child);
                    child.visible = false;
                    child.receiveShadow = true; //Ground plane
                    child.traverse((nest) => {
                        if (nest.isMesh) {
                            if (!nest.name.startsWith('Wall')) {
                                nest.castShadow = true;
                            }
                            nest.receiveShadow = true;
                        }
                    })
                }
            });
            this.add(mapScene);
        });
    }
    update() {
        if (!this.player.player || !this.player.player.position) { //This.player = Player1 class, this.player.player = Player model
            return; 
        }
        const playerPos = this.player.player.position;

        for (let [name, room] of this.rooms.entries()) {
            const box = new THREE.Box3().setFromObject(room);
            if (box.containsPoint(playerPos)) {
                if (this.currentRoom !== room) {
                    if (this.currentRoom) this.currentRoom.visible = false;
                    room.visible = true;
                    this.currentRoom = room;

                    let event = new Event('roomLoaded');
                    window.dispatchEvent(event);
                }
                break;
            }
        }
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