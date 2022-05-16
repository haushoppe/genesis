import THREE, { AmbientLight, BoxGeometry, CameraHelper, Color, CubeRefractionMapping, CubeTextureLoader, DirectionalLight, DirectionalLightHelper, Mapping, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PointLight, Scene, SpotLight, TextureLoader, Vector3, WebGLRenderer } from "three";
import { config } from "./config";
import { firstPersonControl, doMovementUpdate, bindPointerLockControls } from "./helper/first-person-control";
import { PointerLockControls } from "./helper/pointer-lock-controls";

const green = new Color(0, 1, 0);


export class App
{
    private camera: PerspectiveCamera;
    private scene: Scene;
    private cube: Mesh;
    private renderer: WebGLRenderer;

    /**
     * Based off the three.js docs: https://threejs.org/examples/?q=cube#webgl_geometry_cube
     */
    constructor()
    {
        const camera = this.camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);

        camera.position.set(0, 0, -4);
        camera.lookAt(new Vector3(0, 0, 0));



        // this.camera.position.z = 400;



        const scene = this.scene = new Scene();

        // scene.add(this.createAmbientLightOld());
        // const directionalLight = this.createDirectionalLight()
        // scene.add(directionalLight);
        // const lighthelper = new DirectionalLightHelper(directionalLight, 1, green);
        // const camerahelper = new CameraHelper(this.camera);
        // scene.add(lighthelper);
        // scene.add(camerahelper);


        scene.add(this.createPointLight());
        scene.add(this.createAmbientLight());



        // this.cube = this.createSimpleCube();
        this.cube = this.createCube();
        scene.add(this.cube);


        scene.add(this.createPlane());


        bindPointerLockControls(this.camera)

        this.renderer = this.createRenderer();
        document.body.appendChild(this.renderer.domElement);

        window.addEventListener("resize", this.onWindowResize.bind(this), false);

        this.loop();
    }

    // globally illuminates all objects in the scene equally
    private createAmbientLight() {
      let light = new AmbientLight("white", .15);
      light.position.set(10, 2, 0);
      return light;
    }

    private createDirectionalLight() {
      const light = new DirectionalLight( 0xffffff, 0.5 );
      light.position.set( 0, 2, 0 );
      light.castShadow = true;
      light.shadow.camera.near = 1;
      light.shadow.camera.far = 10;

      light.shadow.camera.right = 1;
      light.shadow.camera.left = - 1;
      light.shadow.camera.top	= 1;
      light.shadow.camera.bottom = - 1;

      light.shadow.mapSize.width = 1024;
      light.shadow.mapSize.height = 1024;
      return light;
    }

    private createPointLight() {
      const light = new PointLight("white", .8);
      light.position.set(0, 3, 0);
      light.castShadow = true;
      light.shadow.camera.near = 2.1;
      light.shadow.radius = 8; // soften shadow by setting radius
      return light;
    }

    // Debugging hint: MeshBasicMaterial ignores the light
    // https://r105.threejsfundamentals.org/threejs/lessons/threejs-materials.html
    private createCube() {

      const loader = new TextureLoader();

      // https://www.youtube.com/watch?v=pUFMoAS-a8w
      // x+ (right side)
      // x- (left side)
      // y+ (top side)
      // y- (bottom side)
      // z+ (front side)
      // z- (far side)
      const textures = config.hardcodedStarsTextures.map(url => this.getPhong(loader, url));
      const geometry = new BoxGeometry(1, 1, 1);
      const cube = new Mesh(geometry, textures);

      cube.position.y = 1;
      cube.position.x = 0;
      cube.receiveShadow = true;
      cube.castShadow = true;

      return cube;
    }

    private getPhong(loader: TextureLoader, textureUrl: string) {
      return new MeshPhongMaterial({
        shininess: 100,
        map: loader.load(textureUrl),
        // wireframe: true
      })
    }


    private createPlane() {
      let planeGeometry = new PlaneGeometry(10, 10);
      let planeMaterial = new MeshPhongMaterial({ color: "white", wireframe: false });
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

      // ?
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFSoftShadowMap;



      return renderer;
    }

    private onWindowResize(): void
    {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private loop(): void
    {
        requestAnimationFrame(this.loop.bind(this));
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    private update() {

      this.cube.rotation.x += 0.005;
      this.cube.rotation.y += 0.01;

      firstPersonControl(this.camera);
      doMovementUpdate(this.camera);
    }
}

new App();
