import THREE, { BoxGeometry, CubeTextureLoader, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, Scene, TextureLoader, WebGLRenderer } from "three";
import { config } from "./config";

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

      // ADD PICTURE:
      var cubeNormalMap;
      var cubeBumpMap;


      const loader = new CubeTextureLoader();
      // loader.setCrossOrigin('Access-Control-Allow-Origin');
      loader.setPath(config.httpProxy);

      const textureCube = loader.load([
        encodeURIComponent("https://cloudflare-ipfs.com/ipfs/QmYKabnBxtucct5Vkf81o9ZX6u2sCnZKU94VfGqUwzbZwg"),
        encodeURIComponent("https://cloudflare-ipfs.com/ipfs/QmaWN5wo72fs9NGbXZnK3He8C8uZyURL6QrSJfwrCVzkEZ"),
        encodeURIComponent("https://cloudflare-ipfs.com/ipfs/QmPRPBncyL6oxz6uQ4edgBBSBiounmeD3PpwzEZv23HEfk"),
        encodeURIComponent("https://cloudflare-ipfs.com/ipfs/QmYksSVBoM8YYbJSMVab2mq6mg3sfQ2xaCmAhhc4LgR5Ny"),
        encodeURIComponent("https://cloudflare-ipfs.com/ipfs/QmciDF297zeVRJSMuBycVSUY1WZuuvQeJBxZXUZp92dx4J"),
        encodeURIComponent("https://cloudflare-ipfs.com/ipfs/QmacJ5HVz89YXNLXthWC3TqTNTQFyGLYeYMWnzb1UpUEiV")
      ]);

      const material = new MeshBasicMaterial({ color: 0xffffff, envMap: textureCube });
      const geometry = new BoxGeometry(200, 200, 200);
      return new Mesh(geometry, material);
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
