var createScene = function () {

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);

    // Environment
    var hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("/textures/environment.dds", scene);
    hdrTexture.name = "envTex";
    hdrTexture.gammaSpace = false;
    scene.environmentTexture = hdrTexture;

    var skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size:1000.0}, scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("textures/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    //setup camera
    var camera = new BABYLON.ArcRotateCamera("Camera", BABYLON.Tools.ToRadians(-120), BABYLON.Tools.ToRadians(80), 65, new BABYLON.Vector3(0, -15, 0), scene);    camera.attachControl(canvas, false);
    
    //enable Physics in the scene
    scene.enablePhysics(new BABYLON.Vector3(0,-12,0), new BABYLON.AmmoJSPlugin());

    //setup lights
    var light1 = new BABYLON.PointLight("light1", new BABYLON.Vector3(0, 5,-6), scene);
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(6, 5, 3.5), scene);
    var light3 = new BABYLON.DirectionalLight("light3", new BABYLON.Vector3(20, -5, 20), scene);
    light1.intensity = 15;
    light2.intensity = 5;

    //create an array of different starting positions for the marbles
    var marbleStartPosArray = [new BABYLON.Vector3(0.2,3.5,0), new BABYLON.Vector3(0,3.5,0.2), new BABYLON.Vector3(-0.2,3.5,0), new BABYLON.Vector3(0,3.5,-0.2)];

    //create a box used to trigger the destrucion of marbles
    var killBox = BABYLON.MeshBuilder.CreateBox("killBox", {width:100, depth:100, height:0.5}, scene);
    killBox.position = new BABYLON.Vector3(0,-50,0);
    killBox.visibility = 0;

    var marbleMaterialArray = [];

    engine.displayLoadingUI();

    Promise.all([
        BABYLON.SceneLoader.AppendAsync("https://models.babylonjs.com/Marble/marble/marble.gltf"),
        BABYLON.SceneLoader.AppendAsync("https://models.babylonjs.com/Marble/marbleTower/marbleTower.gltf")
    ]).then(function () {
        var marble = scene.getMeshByName("marble");
        marble.setParent(null);
        marble.visibility = 0;

        marbleMaterialArray.push(scene.getMaterialByName("blueMat"), scene.getMaterialByName("greenMat"), scene.getMaterialByName("redMat"), scene.getMaterialByName("purpleMat"), scene.getMaterialByName("yellowMat"));

        //get each mesh that's been loaded
        var tower = scene.getMeshByName("tower");
        var rockerBottom = scene.getMeshByName("rockerBottom");
        var rockerTop = scene.getMeshByName("rockerTop");
        var spinner = scene.getMeshByName("spinner");
        var supports = scene.getMeshByName("supports");
        var track = scene.getMeshByName("track");
        var wheel = scene.getMeshByName("wheel");

        //set the parents of each mesh to null
        tower.setParent(null);
        rockerBottom.setParent(null);
        rockerTop.setParent(null);
        spinner.setParent(null);
        supports.setParent(null);
        track.setParent(null);
        wheel.setParent(null);

        //add physics imposters to anything marbles will collide with
        tower.physicsImpostor = new BABYLON.PhysicsImpostor(tower, BABYLON.PhysicsImpostor.MeshImpostor,{mass:0, friction:1},scene);  
        supports.physicsImpostor = new BABYLON.PhysicsImpostor(supports, BABYLON.PhysicsImpostor.MeshImpostor,{mass:0, friction:1},scene);  
        track.physicsImpostor = new BABYLON.PhysicsImpostor(track, BABYLON.PhysicsImpostor.MeshImpostor,{mass:0, friction:1},scene);  
        wheel.physicsImpostor = new BABYLON.PhysicsImpostor(wheel, BABYLON.PhysicsImpostor.MeshImpostor,{mass:0, friction:1},scene);  
        
        //setup the rocker

        // Create rocker pin as the phsyics root and parent loaded assets to it
        var rockerRoot = new BABYLON.Mesh("rockerRoot", scene);
        rockerBottom.setParent(rockerRoot);
        rockerTop.setParent(rockerRoot);
        rockerRoot.position = new BABYLON.Vector3(4.1, -6.4, 0);
        rockerRoot.rotation.x -= BABYLON.Tools.ToRadians(25);

        rockerTop.physicsImpostor = new BABYLON.PhysicsImpostor(rockerTop, BABYLON.PhysicsImpostor.ConvexHullImpostor, { mass: 0 }, scene);
        rockerBottom.physicsImpostor = new BABYLON.PhysicsImpostor(rockerBottom, BABYLON.PhysicsImpostor.ConvexHullImpostor, { mass: 0 }, scene);
        rockerRoot.physicsImpostor = new BABYLON.PhysicsImpostor(rockerRoot, BABYLON.PhysicsImpostor.NoImpostor,{mass:2},scene);

        var rockerPin = BABYLON.MeshBuilder.CreateCylinder("Rocker", {diameter:0.10, height: 1}, scene);
        rockerPin.rotation.z += BABYLON.Tools.ToRadians(90);
        rockerPin.position = new BABYLON.Vector3(4.1, -6.4, 0);
        rockerPin.physicsImpostor = new BABYLON.PhysicsImpostor(rockerPin, BABYLON.PhysicsImpostor.MeshImpostor,{mass:0},scene);
        rockerPin.visibility = 0;

        var joint1 = new BABYLON.HingeJoint({  
            mainPivot: new BABYLON.Vector3(0, 0, 0),
            connectedPivot: new BABYLON.Vector3(0, 0, 0),
            mainAxis: new BABYLON.Vector3(-1, 0, 0),
            connectedAxis: new BABYLON.Vector3(0, 1, 0),
            nativeParams: {
            }
        });
        rockerRoot.physicsImpostor.addJoint(rockerPin.physicsImpostor, joint1);

        //handle logic for the brass wind-up spinner
        var currentWindUpAngle;
        var marbleSpawnRate = 8;
        var nextMarbleSpawnAngle = 360/marbleSpawnRate;
        var spinnerRotateSpeed = 120;
        var marblePosition = 0;

        var spinnerPivotParent = new BABYLON.TransformNode("spinnerPivotParent");
        spinner.setParent(spinnerPivotParent);

        BABYLON.Animation.CreateAndStartAnimation("spinnerRotation", spinnerPivotParent, "rotation.y", 30, spinnerRotateSpeed, BABYLON.Tools.ToRadians(0), BABYLON.Tools.ToRadians(360), 1)

        //handle logic for the large wheel
        var wheelPivotParent = new BABYLON.TransformNode("wheelPivotParent");
        wheelPivotParent.position.y -= 28.8;
        wheel.setParent(wheelPivotParent);
        BABYLON.Animation.CreateAndStartAnimation("marbleTowerWheelRot", wheelPivotParent, "rotation.x", 30, 600, BABYLON.Tools.ToRadians(0), BABYLON.Tools.ToRadians(-360), 1)

        //logic to change the starting marble position based on the rotation of the brass wind-up spinner
        scene.actionManager = new BABYLON.ActionManager(scene);
        scene.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction({
                trigger: BABYLON.ActionManager.OnEveryFrameTrigger
                },
                function(){
                    currentWindUpAngle = BABYLON.Tools.ToDegrees(spinnerPivotParent.rotation.y);
                    if(nextMarbleSpawnAngle == 360 && currentWindUpAngle<(360/marbleSpawnRate)){
                        nextMarbleSpawnAngle = (360/marbleSpawnRate);
                    }
                    else if(currentWindUpAngle >= nextMarbleSpawnAngle){
                        nextMarbleSpawnAngle += (360/marbleSpawnRate);
                        createMarble(marblePosition);
                        marblePosition +=1;
                        if(marblePosition == 4){
                            marblePosition = 0;
                        };

                    };
                }
            )
        );

        engine.hideLoadingUI();
    });

    //This is a function to create marbles: creating a mesh, adding a physics imposter, and adding an event trigger
    function createMarble(spawnAngle){

        //create a marble (sphere) using meshbuilder
        var marble = scene.getMeshByName("marble").clone("marbleClone");
        marble.visibility = 1;
        marble.material = marbleMaterialArray[Math.floor(Math.random() * 5)];
        
        //position the marble based on the incoming angle of the windup part of the marbleTower
        marble.position = marbleStartPosArray[spawnAngle];

        //add physics to the marble
        marble.physicsImpostor = new BABYLON.PhysicsImpostor(marble, BABYLON.PhysicsImpostor.SphereImpostor, {mass:2, friction:0.5, restitution:0}, scene);

        //add an actionManager to the marble
        marble.actionManager = new BABYLON.ActionManager(scene);

        //register a new action with the marble's actionManager..this will execute code whenever the marble intersects the "killBox"
        marble.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
                {
                trigger:BABYLON.ActionManager.OnIntersectionEnterTrigger,
                parameter:killBox
                }, 
                function(){
                    fadeAndDestroyMarble(marble);
                }
            )
        );

    };

    function fadeAndDestroyMarble(marble){
        var forceDirection = new BABYLON.Vector3(0, 1, 0);
        var forceMagnitude = 25;
        var contactLocalRefPoint = BABYLON.Vector3.Zero();

        //the one line of code version
        BABYLON.Animation.CreateAndStartAnimation("marbleVisAnim", marble, "visibility", 30, 30, 1, 0, 0, null, () => {
            marble.dispose();
        });
    };

    return scene;
};

var createScene = async function () {
    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);
    BABYLON.SceneLoader.ShowLoadingScreen = false;

    // create camera and lights for scene
    const lights = {};
    const env = {};
    const camera = {};
    async function initScene() {
        scene.clearColor = new BABYLON.Color3.FromInts(62, 33, 14);
        camera.main = new BABYLON.ArcRotateCamera("camera", BABYLON.Tools.ToRadians(70), BABYLON.Tools.ToRadians(90), 60, new BABYLON.Vector3(0.0, 6.0, 0.0), scene);
        camera.main.minZ = 0.1;
        camera.main.wheelDeltaPercentage = 0.1;
        camera.main.upperRadiusLimit = 60;
        camera.main.lowerRadiusLimit = 30;
        camera.main.upperBetaLimit = 1.4;
        camera.main.lowerBetaLimit = 0;
        camera.main.panningAxis = new BABYLON.Vector3(0, 0, 0);
        camera.main.attachControl(canvas, true);

        env.lighting = BABYLON.CubeTexture.CreateFromPrefilteredData("https://patrickryanms.github.io/BabylonJStextures/Demos/triplanar/env/runyonCanyon.env", scene);
        env.lighting.name = "runyonCanyon";
        env.lighting.gammaSpace = false;
        env.lighting.rotationY = 1.9;
        scene.environmentTexture = env.lighting;
        scene.environmentIntensity = 1.0;

        lights.dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(0.51, -0.2, -0.83), scene);
        lights.dirLight.position = new BABYLON.Vector3(-0.04, 0.057, 20);
        lights.dirLight.shadowMinZ = 0.5;
        lights.dirLight.shadowMaxZ = 90;
        lights.dirLight.intensity = 3; 
    }   

    const lightHelper = {
        active: false
    };
    function enableLightHelper(active) {
        if (active) {
            lights.gizmo = new BABYLON.LightGizmo();
            lights.gizmo.light = lights.dirLight;
    
            var dlh = new DirectionalLightHelper(lights.dirLight, camera.main);
            window.setTimeout(() => {
                scene.onAfterRenderObservable.add(() => dlh.buildLightHelper());
            }, 500);    
        }
    }

    const meshes = {};
    async function loadMeshes() {
        meshes.uvMesh = new BABYLON.MeshBuilder.CreateSphere("uvMesh", { segments: 100, diameter: 10 }, scene);
        meshes.projMesh = meshes.uvMesh.clone("projMesh");
        meshes.uvMesh.position = new BABYLON.Vector3(15, 6, 0);
        meshes.uvMesh.rotation = new BABYLON.Vector3(1, -0.5, 0);
        meshes.projMesh.position = new BABYLON.Vector3(0, 6, 0);
        meshes.file = await BABYLON.SceneLoader.AppendAsync("https://patrickryanms.github.io/BabylonJStextures/Demos/triplanar/gltf/shaderBall_ORM.glb");
        meshes.submeshes = [
            scene.getMeshByName("housing_low"),
            scene.getMeshByName("hub_low"),
            scene.getMeshByName("spokes_low"),
            scene.getMeshByName("supports_low")
        ];
        meshes.shaderBall = meshes.submeshes[0].parent;
        meshes.shaderBall.position = new BABYLON.Vector3(17, 6, 0);
        meshes.shaderBall.rotation = new BABYLON.Vector3(0, 4, 0);
        meshes.ground = new BABYLON.MeshBuilder.CreateGround("ground", { width: 150, height: 150 }, scene);
        lights.dirLight.includedOnlyMeshes.push(meshes.ground);
        meshes.ground.position.y = -0.2;	
        readyCheck.meshesReady = true;
    }

    let loadTexturesAsync = async function() {
        let textures = [];
        return new Promise((resolve, reject) => {
            let textureUrls = [
                "https://patrickryanms.github.io/BabylonJStextures/Demos/triplanar/textures/pbr_lava_basecolor.png",
                "https://patrickryanms.github.io/BabylonJStextures/Demos/triplanar/textures/pbr_lava_normal.png",
                "https://patrickryanms.github.io/BabylonJStextures/Demos/triplanar/textures/pbr_lava_orm.png",
                "https://patrickryanms.github.io/BabylonJStextures/Demos/triplanar/textures/pbr_lava_emissive.png"
            ];

            for (let url of textureUrls) {
                textures.push(new BABYLON.Texture(url, scene, false, true));
            }

            whenAllReady(textures, () => resolve(textures));
        }).then(() => {
            readyCheck.texturesReady = true;
            assignTextures(textures);
        });
    };

    // test if a texture is loaded
    let whenAllReady = function(textures, resolve) {
        let numRemaining = textures.length;
        if (numRemaining == 0) {
            resolve();
            return;
        }

        for (let i = 0; i < textures.length; i++) {
            let texture = textures[i];
            if (texture.isReady()) {
                if (--numRemaining === 0) {
                    resolve();
                    return;
                }
            } 
            else {
                let onLoadObservable = texture.onLoadObservable;
                if (onLoadObservable) {
                    onLoadObservable.addOnce(() => {
                        if (--numRemaining === 0) {
                            resolve();
                        }
                    });
                }
            }
        }
    };

    let retrieveTexture = function (meshMat, channel, textures) {
        let texture;
        for (let file of textures) {
            let segment = file.name.split("/");
            if (segment[segment.length -1].split("_")[1] === meshMat) {
                if (segment[segment.length -1].split("_")[2] === channel + ".png") {
                    texture = file;
                    return texture;
                }
            }
        }
    };

    const pbrTex = {};
    function assignTextures(textures) {
        pbrTex.baseColor = retrieveTexture("lava", "basecolor", textures);
        pbrTex.normal = retrieveTexture("lava", "normal", textures);
        pbrTex.orm = retrieveTexture("lava", "orm", textures);
        pbrTex.emissive = retrieveTexture("lava", "emissive", textures);
    }

    BABYLON.NodeMaterial.IgnoreTexturesAtLoadTime = true;
    const meshesMats = {};
    const meshesParameters = {};
    async function createMaterials() {

        meshesMats.uvProjection = new BABYLON.NodeMaterial("uvProjection", scene, {emitComments: false});
        await meshesMats.uvProjection.loadAsync("https://patrickryanms.github.io/BabylonJStextures/Demos/triplanar/shaders/uvProjectionShader.json");
        meshesMats.uvProjection.build(false);

        meshesMats.triplanarProjection = new BABYLON.NodeMaterial("triplanarProjection", scene, {emitComments: false});
        await meshesMats.triplanarProjection.loadAsync("https://patrickryanms.github.io/BabylonJStextures/Demos/triplanar/shaders/triplanarShader.json");
        meshesMats.triplanarProjection.build(false);

        meshesMats.ground = new BABYLON.NodeMaterial("groundNodeMat", scene, { emitComments: false });
        await meshesMats.ground.loadAsync("https://patrickryanms.github.io/BabylonJStextures/Demos/triplanar/shaders/groundShader.json");
        meshesMats.ground.build(false);
        meshes.ground.material = meshesMats.ground;
        meshesParameters.groundColor = meshesMats.ground.getBlockByName("groundColor");
        meshesParameters.groundColor.value = scene.clearColor;

        meshesParameters.uvProjBaseColor = meshesMats.uvProjection.getBlockByName("baseColorTex");
        meshesParameters.uvProjNormal = meshesMats.uvProjection.getBlockByName("normalTex");
        meshesParameters.uvProjORM = meshesMats.uvProjection.getBlockByName("ormTex");
        meshesParameters.uvProjEmissive = meshesMats.uvProjection.getBlockByName("emissiveTex");
        meshesParameters.uvProjUTile = meshesMats.uvProjection.getBlockByName("uTile");
        meshesParameters.uvProjVTile = meshesMats.uvProjection.getBlockByName("vTile");
        meshesParameters.uvProjBaseColor.texture = pbrTex.baseColor;
        meshesParameters.uvProjNormal.texture = pbrTex.normal;
        meshesParameters.uvProjORM.texture = pbrTex.orm;
        meshesParameters.uvProjEmissive.texture = pbrTex.emissive;
        meshesParameters.uvProjUTile.value = 2;
        meshesParameters.uvProjVTile.value = 2;

        meshesParameters.blendSharpness = meshesMats.triplanarProjection.getBlockByName("blendSharpness");
        meshesParameters.triProjBaseColorX = meshesMats.triplanarProjection.getBlockByName("xBaseColorTex");
        meshesParameters.triProjBaseColorY = meshesMats.triplanarProjection.getBlockByName("yBaseColorTex");
        meshesParameters.triProjBaseColorZ = meshesMats.triplanarProjection.getBlockByName("zBaseColorTex");
        meshesParameters.triProjNormalX = meshesMats.triplanarProjection.getBlockByName("xNormalTex");
        meshesParameters.triProjNormalY = meshesMats.triplanarProjection.getBlockByName("yNormalTex");
        meshesParameters.triProjNormalZ = meshesMats.triplanarProjection.getBlockByName("zNormalTex");
        meshesParameters.triProjORMX = meshesMats.triplanarProjection.getBlockByName("xORMTex");
        meshesParameters.triProjORMY = meshesMats.triplanarProjection.getBlockByName("yORMTex");
        meshesParameters.triProjORMZ = meshesMats.triplanarProjection.getBlockByName("zORMTex");
        meshesParameters.triProjEmissiveX = meshesMats.triplanarProjection.getBlockByName("xEmissiveTex");
        meshesParameters.triProjEmissiveY = meshesMats.triplanarProjection.getBlockByName("yEmissiveTex");
        meshesParameters.triProjEmissiveZ = meshesMats.triplanarProjection.getBlockByName("zEmissiveTex");
        meshesParameters.triProjUTile = meshesMats.triplanarProjection.getBlockByName("uTile");
        meshesParameters.triProjVTile = meshesMats.triplanarProjection.getBlockByName("vTile");
        meshesParameters.triProjLocalSpace = meshesMats.triplanarProjection.getBlockByName("localSpace");
        meshesParameters.blendSharpness.value = 8.0;
        meshesParameters.triProjBaseColorX.texture = pbrTex.baseColor;
        meshesParameters.triProjBaseColorY.texture = pbrTex.baseColor;
        meshesParameters.triProjBaseColorZ.texture = pbrTex.baseColor;
        meshesParameters.triProjNormalX.texture = pbrTex.normal;
        meshesParameters.triProjNormalY.texture = pbrTex.normal;
        meshesParameters.triProjNormalZ.texture = pbrTex.normal;
        meshesParameters.triProjORMX.texture = pbrTex.orm;
        meshesParameters.triProjORMY.texture = pbrTex.orm;
        meshesParameters.triProjORMZ.texture = pbrTex.orm;
        meshesParameters.triProjEmissiveX.texture = pbrTex.emissive;
        meshesParameters.triProjEmissiveY.texture = pbrTex.emissive;
        meshesParameters.triProjEmissiveZ.texture = pbrTex.emissive;
        meshesParameters.triProjUTile.value = 0.5;
        meshesParameters.triProjVTile.value = 0.5;
        meshesParameters.triProjLocalSpace = false;

        meshes.uvMesh.material = meshesMats.uvProjection;
        meshes.projMesh.material = meshesMats.triplanarProjection;
        for (let child of meshes.submeshes) {
            child.material = meshesMats.triplanarProjection;
        }

        readyCheck.materialsReady = true;
    }

    const shadows = {};
    function generateShadows() {
        shadows.shadowGenerator = new BABYLON.ShadowGenerator(512, lights.dirLight);
        shadows.shadowGenerator.useContactHardeningShadow = true;
        shadows.shadowGenerator.contactHardeningLightSizeUVRatio = 0.07;
        shadows.shadowGenerator.darkness = 0.65;
        shadows.shadowGenerator.addShadowCaster(meshes.uvMesh);
        shadows.shadowGenerator.addShadowCaster(meshes.projMesh);
        for (let child of meshes.submeshes) {
            shadows.shadowGenerator.addShadowCaster(child); 
        }
        shadows.shadowGenerator.enableSoftTransparentShadow = true;
        shadows.shadowGenerator.transparencyShadow = true;
        meshes.ground.receiveShadows = true;
        meshes.ground.material.environmentIntensity = 0.2;
    }

    const glowPass = {};
    function glowLayer() {
        glowPass.uvGlowMask = meshesMats.uvProjection.getBlockByName("glowMask");
        glowPass.projGlowMask = meshesMats.triplanarProjection.getBlockByName("glowMask");
        console.log(glowPass.uvGlowMask);
        glowPass.glow = new BABYLON.GlowLayer("glow", scene);
        glowPass.glow.intensity = 2;

        // set up material to use glow layer
        glowPass.glow.referenceMeshToUseItsOwnMaterial(meshes.uvMesh);
        glowPass.glow.referenceMeshToUseItsOwnMaterial(meshes.projMesh);
        for (let child of meshes.submeshes) {
            glowPass.glow.referenceMeshToUseItsOwnMaterial(child); 
        }

        // enable glow mask to render only emissive into glow layer, and then disable glow mask
        glowPass.glow.onBeforeRenderMeshToEffect.add(() => {
            glowPass.uvGlowMask.value = 1.0;
            glowPass.projGlowMask.value = 1.0;
        });
        glowPass.glow.onAfterRenderMeshToEffect.add(() => {
            glowPass.uvGlowMask.value = 0.0;
            glowPass.projGlowMask.value = 0.0;
        });    
    }

    const readyCheck = {
        meshesReady: false,
        texturesReady: false,
        materialsReady: false
    };
    function checkTrue(ready) {
        for (let value in ready) {
            if (value === false) {
                return false;
            }
        }
        return true;
    }
    function readyScene() {
        if (checkTrue(readyCheck)) {
            engine.hideLoadingUI();
        }
        else {
            console.log("looping");
            setTimeout(() => {
                readyScene();
            }, 1000);
        }
    }

    engine.displayLoadingUI();
    initScene();
    await loadMeshes();
    await loadTexturesAsync();
    await createMaterials();
    generateShadows();
    glowLayer();  
    enableLightHelper(lightHelper.active);
    readyScene();

    scene.debugLayer.show({embedMode: true});
    scene.debugLayer.select(meshesMats.triplanarProjection);

    return scene;
};

var createScene = function () {
    var scene = new BABYLON.Scene(engine);

    // Setup environment
    var camera = new BABYLON.ArcRotateCamera("ArcRotateCamera", 1, 0.8, 5, new BABYLON.Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, true);
    scene.clearColor = new BABYLON.Color3(0.0, 0.0, 0.0);

    // Emitter object
    var stars = BABYLON.Mesh.CreateBox("emitter", 0.01, scene);

    // Create a particle system
    var surfaceParticles = new BABYLON.ParticleSystem("surfaceParticles", 1600, scene);
    var flareParticles = new BABYLON.ParticleSystem("flareParticles", 20, scene);
    var coronaParticles = new BABYLON.ParticleSystem("coronaParticles", 600, scene);
    var starsParticles = new BABYLON.ParticleSystem("starsParticles", 500, scene);

    // Texture of each particle
    surfaceParticles.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJStextures/master/ParticleSystems/Sun/T_SunSurface.png", scene);
    flareParticles.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJStextures/master/ParticleSystems/Sun/T_SunFlare.png", scene);
    coronaParticles.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJStextures/master/ParticleSystems/Sun/T_Star.png", scene);
    starsParticles.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJStextures/master/ParticleSystems/Sun/T_Star.png", scene);

    // Create core sphere
    var coreSphere = BABYLON.MeshBuilder.CreateSphere("coreSphere", {diameter: 2.01, segments: 64}, scene);

    // Create core material
    var coreMat = new BABYLON.StandardMaterial("coreMat", scene)
    coreMat.emissiveColor = new BABYLON.Color3(0.3773, 0.0930, 0.0266); 

    // Assign core material to sphere
    coreSphere.material = coreMat;

    // Pre-warm
    surfaceParticles.preWarmStepOffset = 10;
    surfaceParticles.preWarmCycles = 100;

    flareParticles.preWarmStepOffset = 10;
    flareParticles.preWarmCycles = 100;

    coronaParticles.preWarmStepOffset = 10;
    coronaParticles.preWarmCycles = 100;

    // Initial rotation
    surfaceParticles.minInitialRotation = -2 * Math.PI;
    surfaceParticles.maxInitialRotation = 2 * Math.PI;

    flareParticles.minInitialRotation = -2 * Math.PI;
    flareParticles.maxInitialRotation = 2 * Math.PI;

    coronaParticles.minInitialRotation = -2 * Math.PI;
    coronaParticles.maxInitialRotation = 2 * Math.PI;
    
    // Where the sun particles come from
    var sunEmitter = new BABYLON.SphereParticleEmitter();
    sunEmitter.radius = 1;
    sunEmitter.radiusRange = 0; // emit only from shape surface

    // Where the stars particles come from
    var starsEmitter = new BABYLON.SphereParticleEmitter();
    starsEmitter.radius = 20;
    starsEmitter.radiusRange = 0; // emit only from shape surface
 
    // Assign particles to emitters
    surfaceParticles.emitter = coreSphere; // the starting object, the emitter
    surfaceParticles.particleEmitterType = sunEmitter;

    flareParticles.emitter = coreSphere; // the starting object, the emitter
    flareParticles.particleEmitterType = sunEmitter;

    coronaParticles.emitter = coreSphere; // the starting object, the emitter
    coronaParticles.particleEmitterType = sunEmitter;

    starsParticles.emitter = stars; // the starting object, the emitter
    starsParticles.particleEmitterType = starsEmitter;

    // Random starting color
    starsParticles.color1 = new BABYLON.Color4(0.898, 0.737, 0.718, 1.0);
    starsParticles.color2 = new BABYLON.Color4(0.584, 0.831, 0.894, 1.0);

    // Color gradient over time
    surfaceParticles.addColorGradient(0, new BABYLON.Color4(0.8509, 0.4784, 0.1019, 0.0));
    surfaceParticles.addColorGradient(0.4, new BABYLON.Color4(0.6259, 0.3056, 0.0619, 0.5));
    surfaceParticles.addColorGradient(0.5, new BABYLON.Color4(0.6039, 0.2887, 0.0579, 0.5));
    surfaceParticles.addColorGradient(1.0, new BABYLON.Color4(0.3207, 0.0713, 0.0075, 0.0));

    flareParticles.addColorGradient(0, new BABYLON.Color4(1, 0.9612, 0.5141, 0.0));
    flareParticles.addColorGradient(0.25, new BABYLON.Color4(0.9058, 0.7152, 0.3825, 1.0));
    flareParticles.addColorGradient(1.0, new BABYLON.Color4(0.6320, 0.0, 0.0, 0.0));

    coronaParticles.addColorGradient(0, new BABYLON.Color4(0.8509, 0.4784, 0.1019, 0.0));
    coronaParticles.addColorGradient(0.5, new BABYLON.Color4(0.6039, 0.2887, 0.0579, 0.12));
    coronaParticles.addColorGradient(1.0, new BABYLON.Color4(0.3207, 0.0713, 0.0075, 0.0));

    // Size of each particle (random between...
    surfaceParticles.minSize = 0.4;
    surfaceParticles.maxSize = 0.7;

    flareParticles.minScaleX = 0.5;
    flareParticles.minScaleY = 0.5;
    flareParticles.maxScaleX= 1.0;
    flareParticles.maxScaleY = 1.0;

    coronaParticles.minScaleX = 0.5;
    coronaParticles.minScaleY = 0.75;
    coronaParticles.maxScaleX = 1.2;
    coronaParticles.maxScaleY = 3.0;

    starsParticles.minSize = 0.15;
    starsParticles.maxSize = 0.3;

    // Size over lifetime
    flareParticles.addSizeGradient(0, 0);
    flareParticles.addSizeGradient(1, 1);
    
    // Life time of each particle (random between...
    surfaceParticles.minLifeTime = 8.0;
    surfaceParticles.maxLifeTime = 8.0;

    flareParticles.minLifeTime = 10.0;
    flareParticles.maxLifeTime = 10.0;

    coronaParticles.minLifeTime = 2.0;
    coronaParticles.maxLifeTime= 2.0;

    starsParticles.minLifeTime = 999999;
    starsParticles.maxLifeTime = 999999;

    // Emission rate
    surfaceParticles.emitRate = 200;
    flareParticles.emitRate = 1;
    coronaParticles.emitRate = 300;

    // Burst rate
    starsParticles.manualEmitCount = 500;
    starsParticles.maxEmitPower = 0.0;

    // Blend mode : BLENDMODE_ONEONE, BLENDMODE_STANDARD, or BLENDMODE_ADD
    surfaceParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    flareParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    coronaParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    starsParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;

    // Set the gravity of all particles
    surfaceParticles.gravity = new BABYLON.Vector3(0, 0, 0);
    flareParticles.gravity = new BABYLON.Vector3(0, 0, 0);
    coronaParticles.gravity = new BABYLON.Vector3(0, 0, 0);
    starsParticles.gravity = new BABYLON.Vector3(0, 0, 0);

    // Angular speed, in radians
    surfaceParticles.minAngularSpeed = -0.4;
    surfaceParticles.maxAngularSpeed = 0.4;

    flareParticles.minAngularSpeed = 0.0;
    flareParticles.maxAngularSpeed = 0.0;

    coronaParticles.minAngularSpeed = 0.0;
    coronaParticles.maxAngularSpeed = 0.0;

    starsParticles.minAngularSpeed = 0.0;
    starsParticles.maxAngularSpeed = 0.0;

    // Speed
    surfaceParticles.minEmitPower = 0;
    surfaceParticles.maxEmitPower = 0;
    surfaceParticles.updateSpeed = 0.005;

    flareParticles.minEmitPower = 0.001;
    flareParticles.maxEmitPower = 0.01;

    coronaParticles.minEmitPower = 0.0;
    coronaParticles.maxEmitPower = 0.0;

    starsParticles.minEmitPower = 0.0;
    starsParticles.maxAngularSpeed = 0.0;

    // No billboard
    surfaceParticles.isBillboardBased = false;
    flareParticles.isBillboardBased = true;
    coronaParticles.isBillboardBased = true;
    starsParticles.isBillboardBased = true;

    // Render Order
    starsParticles.renderingGroupId = 0;
    coronaParticles.renderingGroupId = 1;
    flareParticles.renderingGroupId = 2;
    surfaceParticles.renderingGroupId = 3;
    coreSphere.renderingGroupId = 3;

    // Start the particle system
    surfaceParticles.start();
    flareParticles.start();
    coronaParticles.start();
    starsParticles.start();

    return scene;
}
