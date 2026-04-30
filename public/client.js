import * as THREE from 'three';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import Stats from './jsm/libs/stats.module.js';

class LorenzSystem {
    // standard parameters for the Lorenz Attractor
    rho = 28;
    sigma = 10;
    beta = 8 / 3;
    h = 0.01; // step size

    constructor(initialPosition, color, scene) {
        // Hey it's that expand trick!
        this.position = { ...initialPosition };
        this.color = color;
        // This will be a bob showing current point
        const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshBasicMaterial(color);
        this.sphere = new THREE.Mesh(sphereGeometry, material);
        scene.add(this.sphere);

        // how long the trails will be
        this.maxPoints = 3000;
        // I made an efficiency trade off exchanging memory for compute time
        this.aBigNumber = 150000;
        this.currentPointCount = 0;
        // Our trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(this.aBigNumber * 3);
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

        this.line = new THREE.Line(trailGeometry, material);
        // This helps when you zoom in; points in the trail don't disappear
        this.line.frustumCulled = false;
        scene.add(this.line);
    }

    // This function uses RK4 to calculate the next position
    calculateNextPosition(rk4) {
        return {
            x:
                this.position.x +
                (this.h * (rk4.k1.dx + 2 * rk4.k2.dx + 2 * rk4.k3.dx + rk4.k4.dx)) / 6,
            y:
                this.position.y +
                (this.h * (rk4.k1.dy + 2 * rk4.k2.dy + 2 * rk4.k3.dy + rk4.k4.dy)) / 6,
            z:
                this.position.z +
                (this.h * (rk4.k1.dz + 2 * rk4.k2.dz + 2 * rk4.k3.dz + rk4.k4.dz)) / 6,
        };
    }

    // This function finds the derivatives at a single point RK4 uses four points
    // ... well sort of only three but the midpoint it samples twice (*)
    getLorenzDerivatives(position) {
        return {
            dx: this.sigma * (position.y - position.x),
            dy: position.x * (this.rho - position.z) - position.y,
            dz: position.x * position.y - this.beta * position.z,
        };
    }

    // This uses getLorenzDerivatives on those four (three) points
    getRK4Vals() {
        // The derivatives at the initial point ...
        const k1 = this.getLorenzDerivatives(this.position);

        // ... inform where the second point which is ...
        const posK2 = {
            x: this.position.x + (this.h / 2) * k1.dx,
            y: this.position.y + (this.h / 2) * k1.dy,
            z: this.position.z + (this.h / 2) * k1.dz,
        };

        // ... and we calculate the next set of derivatives which ...
        const k2 = this.getLorenzDerivatives(posK2);

        // ... informs how we sample the second point a second time ...
        const posK3 = {
            x: this.position.x + (this.h / 2) * k2.dx,
            y: this.position.y + (this.h / 2) * k2.dy,
            z: this.position.z + (this.h / 2) * k2.dz,
        };

        const k3 = this.getLorenzDerivatives(posK3);

        // ... which informs us what the fourth point is
        // AND how we sample it.
        const posK4 = {
            x: this.position.x + this.h * k3.dx,
            y: this.position.y + this.h * k3.dy,
            z: this.position.z + this.h * k3.dz,
        };

        const k4 = this.getLorenzDerivatives(posK4);

        return { k1, k2, k3, k4 };
    }

    // This puts the logic together and is what animate will call
    update() {
        // get the RK4 values
        let rk4 = this.getRK4Vals();
        // use them to calculate next position
        this.position = this.calculateNextPosition(rk4);
        // update the trail with the new positon
        this.updateTrail(this.position);
        // set the sphere's position so three.js can render it
        this.sphere.position.set(this.position.x, this.position.y, this.position.z);
    }

    // updates ... the trail
    updateTrail(newPosition) {
        const points = this.line.geometry.attributes.position.array;

        // Trails should only get so long otherwise it clutters
        // When a trail is shorter than its max length just add
        // the point and change the "DrawRange" accordingly
        if (this.currentPointCount < this.maxPoints) {
            points[this.currentPointCount * 3] = newPosition.x;
            points[this.currentPointCount * 3 + 1] = newPosition.y;
            points[this.currentPointCount * 3 + 2] = newPosition.z;
            this.currentPointCount++;
            this.line.geometry.setDrawRange(0, this.currentPointCount);
            // when the point count is more than the max we have to change things up
        } else {
            // this was the computationally expensive thing I discarded and used more memory for instead
            /*for (let i = 0; i < (this.maxPoints - 1) * 3; i++) {
                points[i] = points[i + 3];
            }*/

            points[this.currentPointCount * 3] = newPosition.x;
            points[this.currentPointCount * 3 + 1] = newPosition.y;
            points[this.currentPointCount * 3 + 2] = newPosition.z;
            this.currentPointCount++;

            // have to change the range but maintain the maxPoints
            this.line.geometry.setDrawRange(
                this.currentPointCount - this.maxPoints,
                this.maxPoints
            );
        }

        // This tells three.js to update it
        this.line.geometry.attributes.position.needsUpdate = true;
    }
}

const scene = new THREE.Scene();

// changed the last two parameters so the trails won't disappear when zooming in or out
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Tried two ways to fix the "computer graphics 'z' isn't math 'z'" thing
// Should be obvious which one I prefered
//scene.rotation.x = -Math.PI / 2
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);

// Added axes
scene.add(new THREE.AxesHelper(50));
// Changed the positon
camera.position.set(20, 60, 60);
// Changed the focus
controls.target.set(0, 0, 27);
controls.update();

// Declare two LorenzSystems, one with a 0.0001 offset
// Just like Lorenz did on accident
let l1 = new LorenzSystem({ x: 1, y: 1, z: 1 }, { color: 0x00ffff }, scene);
let l2 = new LorenzSystem({ x: 1, y: 1, z: 1.0001 }, { color: 0xff00ff }, scene);

window.addEventListener(
    'resize',
    function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        render();
    },
    false
);

const stats = Stats();
document.body.appendChild(stats.dom);

function animate() {
    requestAnimationFrame(animate);
    render();
    stats.update();
    // update both Lorenz systems
    l1.update();
    l2.update();
}

function render() {
    renderer.render(scene, camera);
}

animate();

// (*) It is actually a fourth point after the k2 step.
