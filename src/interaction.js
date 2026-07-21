import * as THREE from 'three';
import gsap from 'gsap';

export class InteractionManager {
  constructor(camera, scene, onCardPlayed) {
    this.camera = camera;
    this.scene = scene;
    this.onCardPlayed = onCardPlayed;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.hoveredCard = null;
    this.selectedCard = null;
    
    // Bind events
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    window.addEventListener('click', this.onClick.bind(this));
    window.addEventListener('touchend', this.onClick.bind(this));
  }
  
  updateMousePos(clientX, clientY) {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  }
  
  getIntersectedCard() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;
      if (obj.userData && obj.userData.card) {
        return obj.userData.card;
      }
    }
    return null;
  }
  
  onMouseMove(event) {
    this.updateMousePos(event.clientX, event.clientY);
    this.handleHover();
  }
  
  onTouchMove(event) {
    if (event.touches.length > 0) {
      this.updateMousePos(event.touches[0].clientX, event.touches[0].clientY);
      this.handleHover();
    }
  }
  
  handleHover() {
    const card = this.getIntersectedCard();
    
    if (card !== this.hoveredCard) {
      if (this.hoveredCard && this.hoveredCard !== this.selectedCard) {
        this.hoveredCard.hover(false);
      }
      this.hoveredCard = card;
      if (this.hoveredCard && this.hoveredCard !== this.selectedCard) {
        this.hoveredCard.hover(true);
      }
    }
  }
  
  onClick(event) {
    if (event.type === 'touchend' && event.changedTouches.length > 0) {
      this.updateMousePos(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
    }
    
    const card = this.getIntersectedCard();
    
    if (card && !card.isCPU) {
      if (this.selectedCard === card) {
        // Double tap -> Play card
        this.selectedCard = null;
        this.onCardPlayed(card);
      } else {
        // First tap -> Select
        if (this.selectedCard) {
          this.selectedCard.hover(false);
        }
        this.selectedCard = card;
        
        // Pop up slightly higher when selected
        gsap.to(card.mesh.position, { y: -2.5, z: 4, duration: 0.2 });
      }
    } else {
      // Clicked outside, deselect
      if (this.selectedCard) {
        this.selectedCard.hover(false);
        this.selectedCard = null;
      }
    }
  }
}
