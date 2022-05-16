import THREE, { BoxGeometry, CubeRefractionMapping, CubeTextureLoader, Mapping, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, TextureLoader, WebGLRenderer } from "three";

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
        this.camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.z = 400;

        // this.cube = this.createSimpleCube();
        this.cube = this.createComplexCube();

        this.scene = new Scene();
        this.scene.add(this.cube);

        this.renderer = this.createRenderer();
        document.body.appendChild(this.renderer.domElement);

        window.addEventListener("resize", this.onWindowResize.bind(this), false);

        this.animate();
    }

    // the well kown wooden box from the cube example
    private createSimpleCube() {
      const texture = new TextureLoader().load("images/textures/crate.gif");
      const geometry = new BoxGeometry(200, 200, 200);
      const material = new MeshBasicMaterial({ map: texture });
      return new Mesh(geometry, material);
    }

    private createComplexCube() {

      const loader = new TextureLoader();

      const textures = [
        new MeshBasicMaterial({  map: loader.load("images/textures/diece-1.svg") }),
        new MeshBasicMaterial({  map: loader.load("images/textures/diece-2.svg") }),
        new MeshBasicMaterial({  map: loader.load("images/textures/diece-3.svg") }),
        new MeshBasicMaterial({  map: loader.load("images/textures/diece-4.svg") }),
        new MeshBasicMaterial({  map: loader.load("images/textures/diece-5.svg") }),
        new MeshBasicMaterial({  map: loader.load("images/textures/diece-6.svg") })
      ]

      // MeshStandardMaterial illuminated
      // MeshBasicMaterial ignores the light

      // const material = new MeshBasicMaterial({ color: 0xffffff, envMap: textureCube });
      // const material = new MeshStandardMaterial({ color: 0xffffff, map: textureCube });

      const geometry = new BoxGeometry(200, 200, 200);
      return new Mesh(geometry, textures);
    }

    private createRenderer() {
      const renderer = new WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0); // the default
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      return renderer;
    }

    private onWindowResize(): void
    {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private animate(): void
    {
        requestAnimationFrame(this.animate.bind(this));

        this.cube.rotation.x += 0.005;
        this.cube.rotation.y += 0.01;

        this.renderer.render(this.scene, this.camera);
    }
}

new App();
