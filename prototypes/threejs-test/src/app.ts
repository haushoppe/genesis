import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshPhongMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';

import { config } from './config';
import { bindPointerLockControls, doMovementUpdate, firstPersonControl, player } from './helper/first-person-control';

// TODO: https://www.youtube.com/watch?v=d1sr2oWnxus
// 12b How to show video on cube three.js

// TODO: https://threejs.org/docs/#manual/en/introduction/How-to-update-things
// How to update things

export class App {
  private camera: PerspectiveCamera;
  private scene: Scene;
  private cube: Mesh;
  private renderer: WebGLRenderer;

  /**
   * Based off the three.js docs: https://threejs.org/examples/?q=cube#webgl_geometry_cube
   */
  constructor() {
    const scene = this.scene = new Scene();

    const camera = (this.camera = new PerspectiveCamera(
      65, // field of view in vertical degrees
      window.innerWidth / window.innerHeight, // aspect ration: ratio of image width to height
      .1, // distance from camera objects starts to appear
      50 // distance from camerea objects stop apperaring
    ));

    camera.position.set(0, player.height, -2.7);
    camera.lookAt(new Vector3(0, player.height, 0));

    // const camerahelper = new CameraHelper(this.camera);
    // scene.add(camerahelper);

    const pointLight = this.createPointLight();
    scene.add(pointLight);

    const pointLightFront = this.createPointLightFront();
    scene.add(pointLightFront);
    // const lighthelper = new PointLightHelper(pointLightFront, 1, green);
    // scene.add(lighthelper);

    scene.add(this.createAmbientLight());

    // const light3 = this.createDirectionalLight();
    // scene.add(light3);
    // const lighthelper3 = new DirectionalLightHelper(light3, 1, green);
    // scene.add(lighthelper3);


      // const lighthelper3 = new DirectionalLightHelper(light3, 1, green);
    // scene.add(lighthelper3);

    // this.cube = this.createSimpleCube();
    this.cube = this.createCube();
    scene.add(this.cube);

    scene.add(this.createPlane());

    bindPointerLockControls(this.camera);

    this.renderer = this.createRenderer();
    document.body.appendChild(this.renderer.domElement);

    window.addEventListener("resize", this.onWindowResize.bind(this), false);

    this.loop();
  }

  // globally illuminates all objects in the scene equally
  // see Physically Based Rendering and Lighting
  // ( https://discoverthreejs.com/book/first-steps/physically-based-rendering/ )
  private createAmbientLight() {
    let light = new AmbientLight("white", 1);
    light.position.set(10, 2, 0);
    return light;
  }

  private createDirectionalLight() {
    const light = new DirectionalLight("white", 0.8);
    light.position.set(0, 3, 0);
    light.castShadow = true;
    light.shadow.camera.near = 1;
    light.shadow.radius = 8; // soften shadow by setting radius

    return light;
  }

  private createPointLight() {
    const light = new PointLight("white", 0.8);
    light.position.set(0, 3, 0);
    light.castShadow = true;
    light.shadow.camera.near = 2.1;
    light.shadow.radius = 8; // soften shadow by setting radius
    return light;
  }

  private createPointLightFront() {
    const light = new PointLight("white", 1.1);
    light.position.set(0, 1, -7);
    return light;
  }

  private createCube() {
    const loader = new TextureLoader();

    // https://www.youtube.com/watch?v=pUFMoAS-a8w
    // x+ (right side)
    // x- (left side)
    // y+ (top side)
    // y- (bottom side)
    // z+ (front side)
    // z- (far side)
    const textures = config.hardcodedStarsTextures.map((url) =>
      this.getPhongMaterial(loader, url)
    );
    const geometry = new BoxGeometry(1, 1, 1);
    const cube = new Mesh(geometry, textures);

    cube.position.y = 1;
    cube.position.x = 0;
    cube.receiveShadow = true;
    cube.castShadow = true;

    return cube;
  }

  // Debugging hint: MeshBasicMaterial ignores the light
  // https://r105.threejsfundamentals.org/threejs/lessons/threejs-materials.html
  private getPhongMaterial(loader: TextureLoader, textureUrl: string) {
    return new MeshPhongMaterial({
      shininess: 100,
      map: loader.load(textureUrl),
      // wireframe: true
    });
  }

  private createPlane() {
    let planeGeometry = new PlaneGeometry(10, 10);
    let planeMaterial = new MeshPhongMaterial({
      color: "#202020",
      // wireframe: true,
    });
    let plane = new Mesh(planeGeometry, planeMaterial);

    plane.rotation.x -= Math.PI / 2;
    plane.scale.x = 3;
    plane.scale.y = 3;
    plane.receiveShadow = true;

    return plane;
  }

  private createRenderer() {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });

    renderer.setClearColor(0x000000, 0); // the default
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // see https://threejs.org/docs/#api/en/renderers/WebGLRenderer.shadowMap.type
    renderer.shadowMap.enabled = true;
    // filters shadow maps using the Percentage-Closer Filtering (PCF) algorithm
    // with better soft shadows especially when using low-resolution shadow maps.
    // see https://threejs.org/docs/#api/en/constants/Renderer
    renderer.shadowMap.type = PCFSoftShadowMap;

    // turn on the physically correct lighting model
    // renderer.physicallyCorrectLights = true;

    return renderer;
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private loop(): void {
    requestAnimationFrame(this.loop.bind(this));
    this.update();
    this.renderer.render(this.scene, this.camera);
  }

  private update() {
    this.cube.rotation.x += 0.005 / 2;
    this.cube.rotation.y += 0.01 / 2;

    firstPersonControl(this.camera);
    doMovementUpdate(this.camera);
  }
}

new App();
