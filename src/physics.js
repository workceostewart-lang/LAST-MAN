import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0), // m/s²
    });
    
    // Create a static ground plane (table)
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // make it face up
    this.world.addBody(groundBody);
    
    this.bodies = [];
  }
  
  addCard(mesh) {
    if (this.bodies.some((entry) => entry.mesh === mesh)) return null;
    // Create a physics body matching the card geometry
    // Card size: 1.5, 2.1, 0.02
    const shape = new CANNON.Box(new CANNON.Vec3(1.5 / 2, 2.1 / 2, 0.02 / 2));
    const body = new CANNON.Body({
      mass: 0.1, // kg
      shape: shape,
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      quaternion: new CANNON.Quaternion(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w)
    });
    
    // Add some damping so cards don't slide forever
    body.linearDamping = 0.5;
    body.angularDamping = 0.5;
    
    this.world.addBody(body);
    this.bodies.push({ mesh, body });
    return body;
  }

  removeCard(mesh) {
    const index = this.bodies.findIndex((entry) => entry.mesh === mesh);
    if (index < 0) return;
    this.world.removeBody(this.bodies[index].body);
    this.bodies.splice(index, 1);
  }

  clearCards() {
    for (const { body } of this.bodies) this.world.removeBody(body);
    this.bodies = [];
  }
  
  update(dt) {
    this.world.step(1 / 60, dt, 3);
    
    // Sync meshes with physics bodies
    for (const { mesh, body } of this.bodies) {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  }
}
