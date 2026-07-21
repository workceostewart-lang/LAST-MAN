import * as THREE from 'three';
import { GameState } from './gameState.js';
import { Card } from './card.js';
import { PhysicsWorld } from './physics.js';
import { UIManager } from './ui.js';
import { InteractionManager } from './interaction.js';

// Setup Three.js
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
scene.add(dirLight);

// Table surface (invisible plane to catch shadows)
const planeGeo = new THREE.PlaneGeometry(50, 50);
const planeMat = new THREE.ShadowMaterial({ opacity: 0.5 });
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// Systems
const physics = new PhysicsWorld();
const uiManager = new UIManager();

// Game State lists
let activeCards = [];
let discardPile = [];
let drawPile = [];

// Setup Initial State
function initGame() {
  // Spawn Discard Pile Top Card
  const topCard = new Card('discard-top', GameState.discardTop.color, GameState.discardTop.value, scene, physics);
  topCard.setPosition(0, 0, 0);
  topCard.setRotation(-Math.PI/2, 0, Math.random() * 0.2);
  physics.addCard(topCard.mesh);
  discardPile.push(topCard);

  // Spawn Draw Pile (Visual representation)
  for(let i=0; i<5; i++) {
    const drawCard = new Card(`draw-${i}`, 'back', '', scene, physics);
    drawCard.setPosition(-3, i * 0.02, 0);
    drawCard.setRotation(-Math.PI/2, 0, 0);
    drawPile.push(drawCard);
  }

  // Deal Hand
  GameState.hand.forEach((cardData, i) => {
    const card = new Card(cardData.id, cardData.color, cardData.value, scene, physics, false);
    
    // Start at draw pile
    card.setPosition(-3, 0.5, 0);
    card.setRotation(-Math.PI/2, 0, 0);
    
    // Animate to hand
    card.animateToHand(i, GameState.hand.length, false);
    activeCards.push(card);
  });
}

function onCardPlayed(card) {
  // Remove from hand array
  activeCards = activeCards.filter(c => c !== card);
  
  // Play to discard visually
  const topY = discardPile.length * 0.03;
  card.playToDiscard(new THREE.Vector3(0, topY, 0));
  
  // After GSAP animation completes, add to physics world so it lands
  setTimeout(() => {
    physics.addCard(card.mesh);
    discardPile.push(card);
  }, 500);

  // If wild, show color picker
  if (card.value === 'Wild' || card.value === 'Wild Draw 4') {
    uiManager.showColorPicker();
  }
  
  // Check win condition
  if (activeCards.length === 0) {
    uiManager.showEndScreen('Player', 500);
  }
}

const interaction = new InteractionManager(camera, scene, onCardPlayed);

initGame();

// Render Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  
  physics.update(dt);
  renderer.render(scene, camera);
}

animate();

// Handle Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
