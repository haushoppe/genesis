import THREE, { AmbientLight, BoxGeometry, CubeRefractionMapping, CubeTextureLoader, DirectionalLight, Mapping, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, SpotLight, TextureLoader, WebGLRenderer } from "three";

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

        // this.scene.add(this.createAmbientLight());
        // this.scene.add(this.createSpotLight());
        this.scene.add(this.createDirectionalLight());

        this.scene.add(this.cube);

        // this light globally illuminates all objects in the scene equally.
        // this.scene.add(new AmbientLight(0x404040)); // soft white light

        this.renderer = this.createRenderer();
        document.body.appendChild(this.renderer.domElement);

        window.addEventListener("resize", this.onWindowResize.bind(this), false);

        this.animate();
    }

    private createAmbientLight() {
      // return new AmbientLight(0x404040)); // soft white light
      return new AmbientLight( 0xffffff, 0.3 );
    }

    // copied from here: https://github.com/mrdoob/three.js/blob/master/examples/webgl_clipping_advanced.html
    private createSpotLight() {
      const light = new SpotLight( 0xffffff, 0.5 );
      light.angle = Math.PI / 5;
      light.penumbra = 0.2;
      light.position.set( 2, 3, 3 );
      light.castShadow = true;
      light.shadow.camera.near = 3;
      light.shadow.camera.far = 10;
      light.shadow.mapSize.width = 1024;
      light.shadow.mapSize.height = 1024;
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

    // the well kown wooden box from the cube example
    private createSimpleCube() {
      const texture = new TextureLoader().load("images/textures/crate.gif");
      const geometry = new BoxGeometry(200, 200, 200);
      const material = new MeshBasicMaterial({ map: texture });
      return new Mesh(geometry, material);
    }

    // Debugging hint: MeshBasicMaterial ignores the light
    // https://r105.threejsfundamentals.org/threejs/lessons/threejs-materials.html
    private createComplexCube() {

      const loader = new TextureLoader();

      // https://www.youtube.com/watch?v=pUFMoAS-a8w
      const textures = [
        this.getPhong(loader, 'images/textures/diece-1.svg'), // x+ (right side)
        this.getPhong(loader, 'images/textures/diece-2.svg'), // x- (left side)
        this.getPhong(loader, 'images/textures/diece-3.svg'), // y+ (top side)
        this.getPhong(loader, 'images/textures/diece-4.svg'), // y- (bottom side)
        this.getPhong(loader, 'images/textures/diece-5.svg'), // z+ (front side)
        this.getPhong(loader, 'images/textures/diece-6.svg')  // z- (far side)
      ];

      const geometry = new BoxGeometry(200, 200, 200);
      return new Mesh(geometry, textures);
    }

    private getPhong(loader: TextureLoader, textureUrl: string) {
      return new MeshPhongMaterial({
        shininess: 100,
        map: loader.load(textureUrl)
      })
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
