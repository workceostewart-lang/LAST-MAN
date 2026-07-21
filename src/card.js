import * as THREE from 'three';
import gsap from 'gsap';

const textureLoader = new THREE.TextureLoader();
const backTexture = textureLoader.load('/assets/themes/premium/back.jpg');
const red7Texture = textureLoader.load('/assets/themes/premium/red_7.jpg');

export class Card {
  constructor(id, color, value, scene, physicsWorld, isCPU = false) {
    this.id = id;
    this.color = color;
    this.value = value;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.isCPU = isCPU;
    this.zone = isCPU ? 'cpu' : 'hand';
    
    // Create Mesh
    const geometry = new THREE.BoxGeometry(1.5, 2.1, 0.02);
    
    // Front Texture
    let frontTex;
    if (color === 'red' && value === '7') {
      frontTex = red7Texture;
    } else {
      frontTex = this.generateFaceTexture(color, value);
    }
    
    // Materials: order is Right, Left, Top, Bottom, Front, Back
    // Actually, box materials: [ px, nx, py, ny, pz, nz ]
    // pz is front (+z), nz is back (-z)
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const frontMaterial = new THREE.MeshStandardMaterial({ map: frontTex });
    const backMaterial = new THREE.MeshStandardMaterial({ map: backTexture });
    
    const materials = [
      edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial,
      frontMaterial, backMaterial
    ];
    
    this.mesh = new THREE.Mesh(geometry, materials);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Store reference to this instance for raycasting
    this.mesh.userData = { card: this };
    
    scene.add(this.mesh);
  }

  setZone(zone) {
    this.zone = zone;
    return this;
  }
  
  generateFaceTexture(colorStr, value) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 716;
    const ctx = canvas.getContext('2d');
    
    let bgColor = '#ffffff';
    if (colorStr === 'red') bgColor = '#ff3b30';
    if (colorStr === 'blue') bgColor = '#007aff';
    if (colorStr === 'green') bgColor = '#34c759';
    if (colorStr === 'yellow') bgColor = '#ffcc00';
    if (colorStr === 'black') bgColor = '#1e1e1e';
    
    // Base gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, bgColor);
    gradient.addColorStop(1, '#000000');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 16;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
    
    // Text
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 200px Outfit, sans-serif';
    
    let displayVal = value;
    if (value === 'Reverse') displayVal = '↺';
    if (value === 'Skip') displayVal = '⊘';
    if (value === 'Draw 2') displayVal = '+2';
    if (value === 'Wild') displayVal = 'W';
    if (value === 'Wild Draw 4') displayVal = '+4';
    
    ctx.fillText(displayVal, canvas.width / 2, canvas.height / 2);
    
    // Small corner text
    ctx.font = 'bold 60px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(displayVal, 40, 40);
    
    ctx.save();
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(Math.PI);
    ctx.fillText(displayVal, 40, 40);
    ctx.restore();
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
  
  setPosition(x, y, z) {
    this.mesh.position.set(x, y, z);
  }
  
  setRotation(x, y, z) {
    this.mesh.rotation.set(x, y, z);
  }
  
  // Animate to player hand
  animateToHand(index, total, isCPU) {
    const spacing = 1.6;
    const startX = -((total - 1) * spacing) / 2;
    let targetX = startX + (index * spacing);
    
    let targetY = -2.2;
    let targetZ = 3;
    let rotX = -0.2;
    let rotY = 0;
    let rotZ = 0;
    
    // Fan effect
    const angle = (index - (total-1)/2) * 0.1;
    targetY -= Math.abs(angle) * 1.5;
    targetX += Math.sin(angle) * 0.5;
    rotZ = -angle;

    if (isCPU) {
      // Just hide them offscreen or stack them somewhere for now
      targetY = 6;
      targetZ = -4;
      rotX = Math.PI; // facedown
    }
    
    gsap.to(this.mesh.position, {
      x: targetX,
      y: targetY,
      z: targetZ,
      duration: 0.6,
      delay: index * 0.1,
      ease: 'back.out(1.5)'
    });
    
    gsap.to(this.mesh.rotation, {
      x: rotX,
      y: rotY,
      z: rotZ,
      duration: 0.6,
      delay: index * 0.1,
      ease: 'power2.out'
    });
  }
  
  // Highlight when hovering
  hover(isHovered) {
    if (this.isCPU) return;
    gsap.to(this.mesh.position, {
      y: isHovered ? -1.55 : -2.2 - Math.abs(this.mesh.rotation.z) * 1.5,
      z: isHovered ? 3.5 : 3,
      duration: 0.2
    });
  }
  
  // Play card to discard pile
  playToDiscard(discardTopPos) {
    // Add physics body here to let it drop realistically
    // We'll mock physics dropping with GSAP for the smooth arc, then switch to physics body
    
    gsap.to(this.mesh.position, {
      x: discardTopPos.x + (Math.random() - 0.5) * 0.5,
      y: discardTopPos.y,
      z: discardTopPos.z + (Math.random() - 0.5) * 0.5,
      duration: 0.5,
      ease: 'power2.inOut'
    });
    
    gsap.to(this.mesh.rotation, {
      x: 0,
      y: 0,
      z: (Math.random() - 0.5) * Math.PI,
      duration: 0.5,
      ease: 'power2.inOut'
    });
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}
