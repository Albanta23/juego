using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ZombiesToroGame : MonoBehaviour
{
    [Header("Gameplay")]
    public int maxLives = 3;
    public int zombiesPerWave = 3;
    public float zombieSpeed = 1.8f;
    public float zombieSpawnInterval = 1.2f;
    public int scorePerKill = 100;
    public float playerSpeed = 4.2f;
    public Material baseMaterial;

    private class WaypointData
    {
        public string name;
        public int[] connections;
        public string textureName;
        public WaypointData(string n, int[] c, string t) { name = n; connections = c; textureName = t; }
    }

    private static readonly WaypointData[] ToroWaypoints =
    {
        new WaypointData("Plaza Mayor", new int[]{1, 2}, "toro_ayuntamiento"),
        new WaypointData("Colegiata Santa Maria", new int[]{0, 3, 4}, "toro_colegiata"),
        new WaypointData("Puerta del Reloj", new int[]{0, 4}, "toro_calle1"),
        new WaypointData("Mirador del Duero", new int[]{1}, "toro_puente"),
        new WaypointData("Calle Reina", new int[]{1, 2, 5}, "toro_calle1"),
        new WaypointData("Puerta de la Corredera", new int[]{4}, "toro_plaza_toros")
    };

    private int currentWaypoint;
    private int score;
    private int lives;
    private int wave;
    private int zombiesAlive;
    private int zombiesSpawnedThisWave;
    private bool waveComplete;
    private bool gameOver;
    private float nextSpawnTimer;
    private bool showIntro = true;
    private Vector2 mobileMove;
    private Vector2 mobileAim;
    private bool mobileShoot;
    private int lastScreenWidth;
    private int lastScreenHeight;

    private Camera cam;
    private Renderer bgRenderer;
    private Texture2D fallbackTex;
    private readonly List<Zombie> zombies = new List<Zombie>();
    private AudioSource audioSource;
    private AudioSource musicSource;
    private AudioClip shootSound;
    private AudioClip hitSound;
    private AudioClip deathSound;
    private AudioClip zombieGroanSound;
    private AudioClip footstepSound;
    private AudioClip playerHurtSound;
    private AudioClip waveClearSound;
    private AudioClip musicLoop;
    private float nextGroanTime;
    private float nextFootstepTime;
    private float playerMoveAmount;

    private GUIStyle hudStyle;
    private int hudStyleSize = -1;
    private GUIStyle titleStyle;
    private int titleStyleSize = -1;
    private Texture2D crosshairTex;

    private readonly List<GameObject> buildings = new List<GameObject>();
    private readonly List<GameObject> streetProps = new List<GameObject>();

    private class Zombie
    {
        public Transform transform;
        public float health;
        public float speed;
        public float targetX;
    }

    private void Awake()
    {
        cam = Camera.main;
        if (cam == null)
        {
            var go = new GameObject("Main Camera");
            cam = go.AddComponent<Camera>();
            go.tag = "MainCamera";
        }
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.005f, 0.005f, 0.03f);
        cam.fieldOfView = 65f;
        cam.nearClipPlane = 0.1f;
        cam.farClipPlane = 100f;
        cam.transform.position = new Vector3(0f, 1.6f, -2f);
        cam.transform.LookAt(new Vector3(0f, 1.4f, 20f));
        cam.enabled = true;
        lastScreenWidth = Screen.width;
        lastScreenHeight = Screen.height;
    }

    private void Start()
    {
        BuildScene();
        ResetGame();
    }

    private void BuildScene()
    {
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.ExponentialSquared;
        RenderSettings.fogDensity = 0.018f;
        RenderSettings.fogColor = new Color(0.025f, 0.03f, 0.045f);
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(0.08f, 0.1f, 0.16f);
        RenderSettings.ambientEquatorColor = new Color(0.035f, 0.04f, 0.055f);
        RenderSettings.ambientGroundColor = new Color(0.015f, 0.012f, 0.018f);

        var lightObj = new GameObject("Moon Light");
        var light = lightObj.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 0.5f;
        light.color = new Color(0.4f, 0.5f, 0.7f);
        lightObj.transform.rotation = Quaternion.Euler(35f, -40f, 0f);

        var ambient = new GameObject("Street Light");
        var alight = ambient.AddComponent<Light>();
        alight.type = LightType.Point;
        alight.intensity = 1.2f;
        alight.range = 15f;
        alight.color = new Color(1f, 0.7f, 0.3f);
        ambient.transform.position = new Vector3(0f, 4f, 10f);

        var bgObj = GameObject.CreatePrimitive(PrimitiveType.Quad);
        bgObj.name = "Background Photo";
        bgObj.transform.position = new Vector3(0f, 1.8f, 28f);
        bgObj.transform.localScale = new Vector3(30f, 16f, 1f);
        bgObj.transform.rotation = Quaternion.Euler(0f, 180f, 0f);
        bgRenderer = bgObj.GetComponent<Renderer>();
        var bgMat = new Material(baseMaterial);
        bgRenderer.material = bgMat;

        fallbackTex = new Texture2D(64, 64);
        for (int y = 0; y < 64; y++)
            for (int x = 0; x < 64; x++)
                fallbackTex.SetPixel(x, y, Random.value > 0.95f ? new Color(1f, 0.8f, 0.4f) : new Color(0.02f, 0.01f, 0.04f));
        fallbackTex.Apply();
        bgMat.mainTexture = fallbackTex;

        BuildRoad();
        BuildBuildings();
        BuildStreetProps();

        audioSource = gameObject.AddComponent<AudioSource>();
        audioSource.playOnAwake = false;
        audioSource.spatialBlend = 0f;
        shootSound = CreateGunshot();
        hitSound = CreateHitImpact();
        deathSound = CreateZombieDeath();
        zombieGroanSound = CreateZombieGroan();
        footstepSound = CreateFootstep();
        playerHurtSound = CreatePlayerHurt();
        waveClearSound = CreateWaveClear();
        musicSource = gameObject.AddComponent<AudioSource>();
        musicSource.playOnAwake = false;
        musicSource.loop = true;
        musicSource.volume = 0.32f;
        musicSource.spatialBlend = 0f;
        BuildMusic();
        musicSource.clip = musicLoop;
        musicSource.Play();

        crosshairTex = new Texture2D(20, 20);
        for (int y = 0; y < 20; y++)
            for (int x = 0; x < 20; x++)
            {
                bool h = (x >= 8 && x <= 11) && (y <= 6 || y >= 13);
                bool v = (y >= 8 && y <= 11) && (x <= 6 || x >= 13);
                bool dot = (x >= 9 && x <= 10) && (y >= 9 && y <= 10);
                crosshairTex.SetPixel(x, y, (h || v || dot) ? Color.white : Color.clear);
            }
        crosshairTex.Apply();
        UpdateCameraLayout();
    }

    private void BuildRoad()
    {
        var road = GameObject.CreatePrimitive(PrimitiveType.Cube);
        road.name = "Road";
        road.transform.position = new Vector3(0f, -0.05f, 8f);
        road.transform.localScale = new Vector3(6f, 0.1f, 30f);
        var rmat = new Material(baseMaterial);
        rmat.color = new Color(0.06f, 0.06f, 0.08f);
        road.GetComponent<Renderer>().material = rmat;
        streetProps.Add(road);

        for (float z = -2f; z < 22f; z += 2.5f)
        {
            var dash = GameObject.CreatePrimitive(PrimitiveType.Cube);
            dash.name = "Road Dash";
            dash.transform.position = new Vector3(0f, 0.01f, z);
            dash.transform.localScale = new Vector3(0.6f, 0.02f, 0.9f);
            var dmat = new Material(baseMaterial);
            dmat.color = new Color(0.25f, 0.25f, 0.2f);
            dash.GetComponent<Renderer>().material = dmat;
            streetProps.Add(dash);
        }

        var smat = new Material(baseMaterial);
        smat.color = new Color(0.12f, 0.12f, 0.14f);
        var sidewalkL = GameObject.CreatePrimitive(PrimitiveType.Cube);
        sidewalkL.name = "Sidewalk Left";
        sidewalkL.transform.position = new Vector3(-3.5f, 0.05f, 8f);
        sidewalkL.transform.localScale = new Vector3(0.8f, 0.08f, 30f);
        sidewalkL.GetComponent<Renderer>().material = smat;
        streetProps.Add(sidewalkL);

        var sidewalkR = GameObject.CreatePrimitive(PrimitiveType.Cube);
        sidewalkR.name = "Sidewalk Right";
        sidewalkR.transform.position = new Vector3(3.5f, 0.05f, 8f);
        sidewalkR.transform.localScale = new Vector3(0.8f, 0.08f, 30f);
        sidewalkR.GetComponent<Renderer>().material = smat;
        streetProps.Add(sidewalkR);
    }

    private void BuildBuildings()
    {
        System.Random rng = new System.Random(42);
        Color[] wallColors = {
            new Color(0.12f, 0.10f, 0.08f), new Color(0.15f, 0.12f, 0.10f),
            new Color(0.10f, 0.12f, 0.14f), new Color(0.14f, 0.10f, 0.12f),
            new Color(0.08f, 0.10f, 0.10f),
        };
        Color windowOn = new Color(1f, 0.8f, 0.4f);
        Color windowOff = new Color(0.02f, 0.02f, 0.03f);

        for (int side = -1; side <= 1; side += 2)
            for (int b = 0; b < 6; b++)
            {
                float zPos = b * 3.8f + 1f;
                float width = (float)rng.NextDouble() * 1.8f + 1.5f;
                float height = (float)rng.NextDouble() * 2.5f + 2.5f;
                float depth = (float)rng.NextDouble() * 1.5f + 1.0f;
                float xOff = side * (4.2f + (float)rng.NextDouble() * 0.8f);

                var building = GameObject.CreatePrimitive(PrimitiveType.Cube);
                building.name = $"Building {side} {b}";
                building.transform.position = new Vector3(xOff, height * 0.5f, zPos);
                building.transform.localScale = new Vector3(width, height, depth);
                building.GetComponent<Renderer>().material = MakeMat(wallColors[b % wallColors.Length]);
                buildings.Add(building);

                int winCols = Mathf.FloorToInt(width / 0.5f);
                int winRows = Mathf.FloorToInt(height / 0.7f);
                for (int wy = 0; wy < winRows; wy++)
                    for (int wx = 0; wx < winCols; wx++)
                    {
                        if ((float)rng.NextDouble() > 0.65f) continue;
                        var win = GameObject.CreatePrimitive(PrimitiveType.Quad);
                        win.name = "Window";
                        float winX = -width * 0.5f + 0.3f + wx * 0.5f;
                        float winY = -height * 0.5f + 0.4f + wy * 0.7f;
                        float winZ = depth * 0.5f + 0.01f;
                        win.transform.position = new Vector3(xOff + winX, winY + 0.2f, zPos + winZ * side);
                        win.transform.localScale = new Vector3(0.3f, 0.4f, 1f);
                        win.transform.rotation = Quaternion.Euler(0, side == -1 ? -90 : 90, 0);
                        var wmat = new Material(baseMaterial);
                        wmat.color = (float)rng.NextDouble() > 0.4f ? windowOn : windowOff;
                        if (wmat.color == windowOn) wmat.color *= new Color(1f, 1f, 1f, 0.7f);
                        win.GetComponent<Renderer>().material = wmat;
                        buildings.Add(win);
                    }

                if ((float)rng.NextDouble() > 0.5f)
                {
                    var roof = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    roof.name = "Roof Detail";
                    roof.transform.position = new Vector3(xOff, height + 0.2f, zPos);
                    roof.transform.localScale = new Vector3(width * 1.08f, 0.15f, depth * 1.08f);
                    roof.GetComponent<Renderer>().material = MakeMat(new Color(0.06f, 0.06f, 0.07f));
                    buildings.Add(roof);
                }
            }
    }

    private Material MakeMat(Color c)
    {
        var m = new Material(baseMaterial);
        m.color = c;
        return m;
    }

    private Material MakeLitMat(Color color, float glossiness = 0.08f)
    {
        if (baseMaterial == null) throw new System.InvalidOperationException("Zombies Toro runtime material is missing.");
        var material = new Material(baseMaterial) { color = color };
        if (material.HasProperty("_Glossiness")) material.SetFloat("_Glossiness", glossiness);
        return material;
    }

    private void BuildStreetProps()
    {
        for (float z = 1f; z < 20f; z += 4f)
        {
            for (int side = -1; side <= 1; side += 2)
            {
                var post = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                post.name = $"Light Post {side}";
                post.transform.position = new Vector3(side * 3.8f, 1.5f, z);
                post.transform.localScale = new Vector3(0.06f, 1.5f, 0.06f);
                var pmat = new Material(baseMaterial);
                pmat.color = new Color(0.15f, 0.15f, 0.15f);
                post.GetComponent<Renderer>().material = pmat;
                streetProps.Add(post);

                var glow = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                glow.name = $"Lamp {side}";
                glow.transform.position = new Vector3(side * 3.8f, 3f, z);
                glow.transform.localScale = Vector3.one * 0.2f;
                var gmat = new Material(baseMaterial);
                gmat.color = new Color(1f, 0.7f, 0.3f);
                glow.GetComponent<Renderer>().material = gmat;
                streetProps.Add(glow);
            }
        }
    }

    private void ResetGame()
    {
        currentWaypoint = 0;
        score = 0;
        lives = maxLives;
        wave = 0;
        gameOver = false;
        waveComplete = true;
        zombiesSpawnedThisWave = 0;
        showIntro = true;
        nextGroanTime = Time.time + 2f;
        nextFootstepTime = 0f;
        playerMoveAmount = 0f;
        ClearZombies();
        LoadWaypointImage(0);
        StartNextWave();
    }

    private void LoadWaypointImage(int index)
    {
        var wp = ToroWaypoints[index];
        var tex = Resources.Load<Texture2D>($"Textures/{wp.textureName}");
        if (tex != null)
        {
            bgRenderer.material.mainTexture = tex;
            bgRenderer.material.color = Color.white;
        }
        else
        {
            bgRenderer.material.mainTexture = fallbackTex;
        }
    }

    private void StartNextWave()
    {
        wave++;
        zombiesAlive = 0;
        zombiesSpawnedThisWave = 0;
        waveComplete = false;
        nextSpawnTimer = 1.5f;
    }

    private static readonly Color32[] skinTones = new Color32[]
    {
        new Color32(89, 104, 76, 255),
        new Color32(109, 118, 86, 255),
        new Color32(130, 120, 90, 255),
        new Color32(110, 90, 75, 255),
        new Color32(95, 108, 82, 255),
    };

    private static readonly Color32[] shirtColors = new Color32[]
    {
        new Color32(60, 50, 45, 255),
        new Color32(45, 55, 50, 255),
        new Color32(80, 40, 35, 255),
        new Color32(50, 60, 70, 255),
        new Color32(100, 80, 50, 255),
    };

    private void SpawnZombie()
    {
        float side = Random.value > 0.5f ? -1f : 1f;
        float spawnX = side * Random.Range(4.5f, 7f);
        float spawnZ = Random.Range(3f, 8f);

        Color32 skinColor = skinTones[Random.Range(0, skinTones.Length)];
        Color32 shirtColor = shirtColors[Random.Range(0, shirtColors.Length)];

        var root = new GameObject("Zombie");
        root.transform.position = new Vector3(spawnX, 0f, spawnZ);

        var skinMat = MakeLitMat(skinColor, 0.1f);
        var shirtMat = MakeLitMat(shirtColor, 0.05f);
        var pantsMat = MakeLitMat(new Color32(35, 35, 40, 255), 0.05f);
        var bloodMat = MakeLitMat(new Color32(80, 10, 10, 255), 0.3f);
        var eyeWhiteMat = MakeLitMat(new Color32(220, 210, 200, 255));
        var eyePupilMat = MakeLitMat(new Color32(120, 10, 10, 255));
        var teethMat = MakeLitMat(new Color32(200, 190, 160, 255));

        var hairColor = new Color32((byte)Random.Range(20, 60), (byte)Random.Range(15, 45), (byte)Random.Range(10, 30), 255);
        var hairMat = MakeLitMat(hairColor, 0.4f);

        var torso = GameObject.CreatePrimitive(PrimitiveType.Cube);
        torso.name = "Torso";
        torso.transform.SetParent(root.transform, false);
        torso.transform.localPosition = new Vector3(0f, 1.05f, 0f);
        torso.transform.localScale = new Vector3(0.55f, 0.7f, 0.3f);
        torso.GetComponent<Renderer>().material = shirtMat;
        Destroy(torso.GetComponent<Collider>());

        var chest = GameObject.CreatePrimitive(PrimitiveType.Cube);
        chest.name = "Chest";
        chest.transform.SetParent(root.transform, false);
        chest.transform.localPosition = new Vector3(0f, 1.25f, -0.05f);
        chest.transform.localScale = new Vector3(0.5f, 0.25f, 0.35f);
        chest.GetComponent<Renderer>().material = skinMat;
        Destroy(chest.GetComponent<Collider>());

        var hip = GameObject.CreatePrimitive(PrimitiveType.Cube);
        hip.name = "Hip";
        hip.transform.SetParent(root.transform, false);
        hip.transform.localPosition = new Vector3(0f, 0.62f, 0f);
        hip.transform.localScale = new Vector3(0.5f, 0.2f, 0.28f);
        hip.GetComponent<Renderer>().material = pantsMat;
        Destroy(hip.GetComponent<Collider>());

        var head = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        head.name = "Head";
        head.transform.SetParent(root.transform, false);
        head.transform.localPosition = new Vector3(0f, 1.6f, 0f);
        head.transform.localScale = new Vector3(0.38f, 0.42f, 0.38f);
        head.GetComponent<Renderer>().material = skinMat;
        Destroy(head.GetComponent<Collider>());

        var jaw = GameObject.CreatePrimitive(PrimitiveType.Cube);
        jaw.name = "Jaw";
        jaw.transform.SetParent(root.transform, false);
        jaw.transform.localPosition = new Vector3(0f, 1.42f, -0.1f);
        jaw.transform.localScale = new Vector3(0.28f, 0.12f, 0.18f);
        jaw.GetComponent<Renderer>().material = skinMat;
        Destroy(jaw.GetComponent<Collider>());

        var hair = GameObject.CreatePrimitive(PrimitiveType.Cube);
        hair.name = "Hair";
        hair.transform.SetParent(root.transform, false);
        hair.transform.localPosition = new Vector3(0f, 1.82f, 0.02f);
        hair.transform.localScale = new Vector3(0.4f, 0.1f, 0.4f);
        hair.GetComponent<Renderer>().material = hairMat;
        Destroy(hair.GetComponent<Collider>());

        for (int i = -1; i <= 1; i += 2)
        {
            var eyeWhite = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            eyeWhite.name = "EyeWhite";
            eyeWhite.transform.SetParent(root.transform, false);
            eyeWhite.transform.localPosition = new Vector3(i * 0.09f, 1.62f, -0.17f);
            eyeWhite.transform.localScale = new Vector3(0.09f, 0.09f, 0.05f);
            eyeWhite.GetComponent<Renderer>().material = eyeWhiteMat;
            Destroy(eyeWhite.GetComponent<Collider>());

            var pupil = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            pupil.name = "Pupil";
            pupil.transform.SetParent(root.transform, false);
            pupil.transform.localPosition = new Vector3(i * 0.09f, 1.62f, -0.2f);
            pupil.transform.localScale = new Vector3(0.05f, 0.05f, 0.03f);
            pupil.GetComponent<Renderer>().material = eyePupilMat;
            Destroy(pupil.GetComponent<Collider>());
        }

        var mouth = GameObject.CreatePrimitive(PrimitiveType.Cube);
        mouth.name = "Mouth";
        mouth.transform.SetParent(root.transform, false);
        mouth.transform.localPosition = new Vector3(0f, 1.46f, -0.18f);
        mouth.transform.localScale = new Vector3(0.15f, 0.04f, 0.05f);
        mouth.GetComponent<Renderer>().material = teethMat;
        Destroy(mouth.GetComponent<Collider>());

        int woundCount = Random.Range(0, 3);
        for (int i = 0; i < woundCount; i++)
        {
            var wound = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            wound.name = "Wound";
            wound.transform.SetParent(root.transform, false);
            float wy = Random.Range(0.8f, 1.5f);
            float wz = -0.15f - Random.Range(0f, 0.1f);
            wound.transform.localPosition = new Vector3(Random.Range(-0.2f, 0.2f), wy, wz);
            wound.transform.localScale = new Vector3(0.08f, Random.Range(0.06f, 0.12f), 0.04f);
            wound.GetComponent<Renderer>().material = bloodMat;
            Destroy(wound.GetComponent<Collider>());
        }

        for (int i = -1; i <= 1; i += 2)
        {
            var upperArm = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            upperArm.name = "UpperArm";
            upperArm.transform.SetParent(root.transform, false);
            upperArm.transform.localPosition = new Vector3(i * 0.38f, 1.15f, 0f);
            upperArm.transform.localScale = new Vector3(0.12f, 0.2f, 0.12f);
            upperArm.GetComponent<Renderer>().material = shirtMat;
            Destroy(upperArm.GetComponent<Collider>());

            var forearm = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            forearm.name = "Forearm";
            forearm.transform.SetParent(root.transform, false);
            forearm.transform.localPosition = new Vector3(i * 0.4f, 0.82f, -0.08f);
            forearm.transform.localScale = new Vector3(0.1f, 0.18f, 0.1f);
            forearm.GetComponent<Renderer>().material = skinMat;
            Destroy(forearm.GetComponent<Collider>());

            var hand = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            hand.name = "Hand";
            hand.transform.SetParent(root.transform, false);
            hand.transform.localPosition = new Vector3(i * 0.41f, 0.62f, -0.12f);
            hand.transform.localScale = new Vector3(0.11f, 0.11f, 0.08f);
            hand.GetComponent<Renderer>().material = skinMat;
            Destroy(hand.GetComponent<Collider>());

            for (int f = 0; f < 3; f++)
            {
                var finger = GameObject.CreatePrimitive(PrimitiveType.Cube);
                finger.name = "Finger";
                finger.transform.SetParent(root.transform, false);
                finger.transform.localPosition = new Vector3(i * (0.38f + f * 0.025f), 0.58f - f * 0.03f, -0.16f);
                finger.transform.localScale = new Vector3(0.025f, 0.07f, 0.025f);
                finger.GetComponent<Renderer>().material = skinMat;
                Destroy(finger.GetComponent<Collider>());
            }
        }

        var kneeL = GameObject.CreatePrimitive(PrimitiveType.Cube);
        kneeL.name = "KneeL";
        kneeL.transform.SetParent(root.transform, false);
        kneeL.transform.localPosition = new Vector3(-0.13f, 0.5f, 0f);
        kneeL.transform.localScale = new Vector3(0.14f, 0.14f, 0.14f);
        kneeL.GetComponent<Renderer>().material = pantsMat;
        Destroy(kneeL.GetComponent<Collider>());

        var kneeR = GameObject.CreatePrimitive(PrimitiveType.Cube);
        kneeR.name = "KneeR";
        kneeR.transform.SetParent(root.transform, false);
        kneeR.transform.localPosition = new Vector3(0.13f, 0.5f, 0f);
        kneeR.transform.localScale = new Vector3(0.14f, 0.14f, 0.14f);
        kneeR.GetComponent<Renderer>().material = pantsMat;
        Destroy(kneeR.GetComponent<Collider>());

        for (int i = -1; i <= 1; i += 2)
        {
            var shin = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            shin.name = "Shin";
            shin.transform.SetParent(root.transform, false);
            shin.transform.localPosition = new Vector3(i * 0.13f, 0.28f, 0f);
            shin.transform.localScale = new Vector3(0.12f, 0.18f, 0.12f);
            shin.GetComponent<Renderer>().material = pantsMat;
            Destroy(shin.GetComponent<Collider>());

            var foot = GameObject.CreatePrimitive(PrimitiveType.Cube);
            foot.name = "Foot";
            foot.transform.SetParent(root.transform, false);
            foot.transform.localPosition = new Vector3(i * 0.13f, 0.06f, -0.06f);
            foot.transform.localScale = new Vector3(0.12f, 0.08f, 0.2f);
            foot.GetComponent<Renderer>().material = MakeLitMat(new Color32(40, 35, 30, 255));
            Destroy(foot.GetComponent<Collider>());
        }

        var collider = root.AddComponent<CapsuleCollider>();
        collider.center = new Vector3(0f, 1.0f, 0f);
        collider.radius = 0.3f;
        collider.height = 2.0f;

        float scale = Random.Range(0.9f, 1.2f);
        root.transform.localScale = Vector3.one * scale;

        float lean = Random.Range(-0.15f, 0.15f);
        root.transform.localRotation = Quaternion.Euler(0f, 0f, lean);

        zombies.Add(new Zombie
        {
            transform = root.transform,
            health = 1f + Mathf.Floor(wave / 4f),
            speed = zombieSpeed + Random.Range(-0.3f, 0.3f),
            targetX = Random.Range(-1f, 1f)
        });
        zombiesAlive++;
        zombiesSpawnedThisWave++;
    }

    private void Update()
    {
        ReadMobileInput();

        if (gameOver)
        {
            if (Input.GetKeyDown(KeyCode.R) || Input.GetKeyDown(KeyCode.Return) || mobileShoot) ResetGame();
            return;
        }

        if (showIntro)
        {
            if (Input.anyKeyDown || Input.touchCount > 0 || Input.GetMouseButtonDown(0)) showIntro = false;
            return;
        }

        if (Screen.width != lastScreenWidth || Screen.height != lastScreenHeight) UpdateCameraLayout();

        HandlePlayerMovement();

        if (!waveComplete && zombiesSpawnedThisWave < zombiesPerWave + wave)
        {
            nextSpawnTimer -= Time.deltaTime;
            if (nextSpawnTimer <= 0f)
            {
                SpawnZombie();
                nextSpawnTimer = zombieSpawnInterval;
            }
        }

        MoveZombies();
        HandleShooting();
        UpdateAtmosphericSfx();

        if (!waveComplete && zombiesSpawnedThisWave >= zombiesPerWave + wave && zombiesAlive <= 0)
        {
            waveComplete = true;
            PlaySound(waveClearSound, 0.55f);
        }
    }

    private void MoveZombies()
    {
        float time = Time.time;
        for (int i = zombies.Count - 1; i >= 0; i--)
        {
            var z = zombies[i];
            if (z.transform == null) { zombies.RemoveAt(i); continue; }

            Vector3 pos = z.transform.position;
            Vector3 player = cam.transform.position;
            pos.z = Mathf.MoveTowards(pos.z, player.z + 0.9f, z.speed * Time.deltaTime);
            pos.x = Mathf.MoveTowards(pos.x, player.x, z.speed * 0.55f * Time.deltaTime);
            z.transform.position = pos;
            z.transform.LookAt(new Vector3(player.x, 1.0f, player.z));

            float leanAngle = 8f + Mathf.Sin(time * 3f + i) * 5f;
            z.transform.localRotation = Quaternion.Euler(leanAngle, z.transform.localRotation.eulerAngles.y, Mathf.Sin(time * 4f + i * 0.5f) * 3f);

            foreach (Transform child in z.transform)
            {
                if (child.name == "UpperArm" || child.name == "Forearm" || child.name == "Hand")
                {
                    child.localPosition = new Vector3(child.localPosition.x, child.localPosition.y, Mathf.Lerp(child.localPosition.z, -0.2f, Time.deltaTime * 5f));
                    child.localRotation = Quaternion.Euler(65f + Mathf.Sin(time * 4f + i) * 14f, 0f, 0f);
                }
                if (child.name == "Shin")
                    child.localRotation = Quaternion.Euler(Mathf.Sin(time * 5f + i + child.localPosition.x * 8f) * 22f, 0f, 0f);
                if (child.name == "Jaw")
                {
                    child.localScale = new Vector3(0.28f, 0.12f + Mathf.Abs(Mathf.Sin(time * 5f)) * 0.04f, 0.18f);
                }
                if (child.name == "Head")
                {
                    child.localRotation = Quaternion.Euler(Mathf.Sin(time * 2f + i) * 5f, 0f, 0f);
                }
            }

            if (Vector2.Distance(new Vector2(pos.x, pos.z), new Vector2(player.x, player.z)) <= 1.05f)
            {
                lives--;
                PlaySound(playerHurtSound, 0.75f);
                Destroy(z.transform.gameObject);
                zombies.RemoveAt(i);
                zombiesAlive--;
                if (lives <= 0) gameOver = true;
            }
        }
    }

    private void HandleShooting()
    {
        bool shoot = (Application.isMobilePlatform || Input.touchCount > 0) ? mobileShoot : Input.GetMouseButtonDown(0);
        shoot |= Input.GetKeyDown(KeyCode.Space);
        if (!shoot) return;

        Vector3 aim = mobileShoot ? (Vector3)mobileAim : Input.mousePosition;
        if (Input.GetKeyDown(KeyCode.Space)) aim = new Vector3(Screen.width * 0.5f, Screen.height * 0.5f);
        Ray ray = cam.ScreenPointToRay(aim);
        PlaySound(shootSound, 0.4f);
        if (!Physics.Raycast(ray, out RaycastHit hit, 50f)) return;

        foreach (var z in zombies)
        {
            if (z.transform == null) continue;
            Transform t = hit.transform;
            while (t != null)
            {
                if (t == z.transform)
                {
                    z.health -= 1f;
                    if (z.health <= 0f)
                    {
                        score += scorePerKill + wave * 10;
                        PlaySound(deathSound, 0.65f);
                        SpawnBloodEffect(z.transform.position + Vector3.up * 1.0f);
                        Destroy(z.transform.gameObject);
                        zombies.Remove(z);
                        zombiesAlive--;
                    }
                    else
                    {
                        SpawnBloodEffect(hit.point);
                        PlaySound(hitSound, 0.3f);
                    }
                    return;
                }
                t = t.parent;
            }
        }
    }

    private void ReadMobileInput()
    {
        mobileMove = Vector2.zero;
        mobileShoot = false;
        Vector2 stickCenter = new Vector2(Mathf.Max(76f, Screen.width * 0.12f), Mathf.Max(82f, Screen.height * 0.16f));
        float stickRadius = Mathf.Clamp(Mathf.Min(Screen.width, Screen.height) * 0.12f, 56f, 92f);

        for (int i = 0; i < Input.touchCount; i++)
        {
            Touch touch = Input.GetTouch(i);
            if (touch.position.x < Screen.width * 0.46f && touch.position.y < Screen.height * 0.48f)
                mobileMove = Vector2.ClampMagnitude((touch.position - stickCenter) / stickRadius, 1f);
            else if (touch.phase == TouchPhase.Began)
            {
                mobileShoot = true;
                mobileAim = touch.position;
            }
        }
    }

    private void HandlePlayerMovement()
    {
        float horizontal = Input.GetAxisRaw("Horizontal") + mobileMove.x;
        float vertical = Input.GetAxisRaw("Vertical") + mobileMove.y;
        Vector3 input = Vector3.ClampMagnitude(new Vector3(horizontal, 0f, vertical), 1f);
        playerMoveAmount = input.magnitude;
        Vector3 position = cam.transform.position + input * playerSpeed * Time.deltaTime;
        position.x = Mathf.Clamp(position.x, -2.55f, 2.55f);
        position.z = Mathf.Clamp(position.z, -2.2f, 2.2f);
        position.y = 1.6f + Mathf.Sin(Time.time * 10f) * 0.015f * input.magnitude;
        cam.transform.position = position;
        cam.transform.rotation = Quaternion.Euler(1.5f, 0f, 0f);

        if (playerMoveAmount > 0.15f && Time.time >= nextFootstepTime)
        {
            PlaySound(footstepSound, 0.24f);
            nextFootstepTime = Time.time + Mathf.Lerp(0.58f, 0.34f, playerMoveAmount);
        }
    }

    private void UpdateAtmosphericSfx()
    {
        if (musicSource != null)
            musicSource.pitch = Mathf.Lerp(musicSource.pitch, 1f + Mathf.Min(wave * 0.015f, 0.16f), Time.deltaTime * 0.7f);

        if (zombiesAlive <= 0 || Time.time < nextGroanTime) return;

        float volume = Mathf.Clamp(0.18f + zombiesAlive * 0.035f, 0.18f, 0.42f);
        PlaySound(zombieGroanSound, volume);
        nextGroanTime = Time.time + Random.Range(1.9f, Mathf.Max(2.4f, 4.8f - wave * 0.12f));
    }

    private void UpdateCameraLayout()
    {
        lastScreenWidth = Screen.width;
        lastScreenHeight = Screen.height;
        float aspect = Screen.height > 0 ? (float)Screen.width / Screen.height : 1.6f;
        cam.fieldOfView = aspect < 1f ? 78f : aspect < 1.45f ? 70f : 64f;
    }

    private void SpawnBloodEffect(Vector3 pos)
    {
        for (int i = 0; i < 6; i++)
        {
            var p = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            p.name = "Blood";
            p.transform.position = pos + Random.insideUnitSphere * 0.2f;
            p.transform.localScale = Vector3.one * Random.Range(0.04f, 0.1f);
            var mat = MakeLitMat(new Color32((byte)Random.Range(60, 120), 5, 5, 255), 0.2f);
            p.GetComponent<Renderer>().material = mat;
            Destroy(p.GetComponent<Collider>());
            StartCoroutine(FadeOut(p, Random.Range(0.3f, 0.8f)));
        }
    }

    private System.Collections.IEnumerator FadeOut(GameObject obj, float duration)
    {
        float elapsed = 0f;
        while (obj != null && elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;
            obj.transform.localScale = Vector3.Lerp(obj.transform.localScale, Vector3.zero, t);
            yield return null;
        }
        if (obj != null) Destroy(obj);
    }

    private void ClearZombies()
    {
        foreach (var z in zombies) if (z.transform != null) Destroy(z.transform.gameObject);
        zombies.Clear();
        zombiesAlive = 0;
        zombiesSpawnedThisWave = 0;
    }

    public void MoveToWaypoint(int index)
    {
        if (index < 0 || index >= ToroWaypoints.Length || !waveComplete || gameOver) return;
        ClearZombies();
        currentWaypoint = index;
        waveComplete = true;
        LoadWaypointImage(index);
        StartNextWave();
    }

    private void OnGUI()
    {
        int hSize = Mathf.Clamp(Screen.width / 40, 16, 26);
        if (hudStyle == null || hudStyleSize != hSize)
        {
            hudStyle = new GUIStyle(GUI.skin.label) { fontSize = hSize, normal = { textColor = new Color(0.3f, 0.9f, 0.3f) } };
            hudStyleSize = hSize;
        }
        int tSize = Mathf.Clamp(Screen.width / 28, 22, 36);
        if (titleStyle == null || titleStyleSize != tSize)
        {
            titleStyle = new GUIStyle(GUI.skin.label) { fontSize = tSize, normal = { textColor = new Color(0.1f, 0.8f, 0.6f) }, fontStyle = FontStyle.Bold };
            titleStyleSize = tSize;
        }

        if (showIntro)
        {
            var bgStyle = new GUIStyle(GUI.skin.box) { normal = { background = Texture2D.whiteTexture } };
            GUI.Box(new Rect(0, 0, Screen.width, Screen.height), "", bgStyle);
            GUI.color = new Color(0f, 0f, 0f, 0.85f);
            GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
            GUI.color = Color.white;

            var titleS = new GUIStyle(titleStyle) { fontSize = Mathf.Clamp(Screen.width / 18, 30, 50), alignment = TextAnchor.MiddleCenter };
            GUI.Label(new Rect(0f, Screen.height * 0.12f, Screen.width, 60f), "ZOMBIES EN TORO", titleS);

            var subStyle = new GUIStyle(hudStyle) { fontSize = Mathf.Clamp(Screen.width / 30, 18, 24), alignment = TextAnchor.MiddleCenter };
            GUI.Label(new Rect(0f, Screen.height * 0.22f, Screen.width, 30f), "Sobrevive a las oleadas de zombis por las calles de Toro", subStyle);

            var btnStyle = new GUIStyle(GUI.skin.button) { fontSize = Mathf.Clamp(Screen.width / 28, 18, 26), fixedHeight = 50 };
            if (GUI.Button(new Rect(Screen.width * 0.5f - 120f, Screen.height * 0.45f, 240f, 50f), "EMPEZAR", btnStyle))
                showIntro = false;

            var ctrlStyle = new GUIStyle(hudStyle) { fontSize = Mathf.Clamp(Screen.width / 35, 16, 22), alignment = TextAnchor.UpperLeft, wordWrap = true };
            string controls = "CONTROLES:\n" +
                "CLICK IZQUIERDO / TAP - Disparar\n" +
                "WASD / FLECHAS - Moverse por la calle\n" +
                "Botones \"IR A...\" - Cambiar de calle al completar oleada\n" +
                "R / ENTER - Reiniciar al morir";
            GUI.Label(new Rect(Screen.width * 0.1f, Screen.height * 0.58f, Screen.width * 0.8f, 200f), controls, ctrlStyle);

            var hintStyle = new GUIStyle(hudStyle) { fontSize = 14, alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(0.6f, 0.6f, 0.6f) } };
            GUI.Label(new Rect(0f, Screen.height * 0.88f, Screen.width, 20f), "Pulsa cualquier tecla o pulsa EMPEZAR", hintStyle);

            return;
        }

        var wp = ToroWaypoints[currentWaypoint];
        GUI.Label(new Rect(20f, 12f, Screen.width - 40f, 40f), "ZOMBIES EN TORO", titleStyle);
        GUI.Label(new Rect(20f, 48f, Screen.width - 40f, 30f), $"PUNTUACION: {score}  VIDAS: {lives}  OLEADA: {wave}", hudStyle);
        GUI.Label(new Rect(20f, 76f, Screen.width - 40f, 24f), $"\u00B0 {wp.name}", hudStyle);

        GUI.Box(new Rect(20f, 104f, 202f, 20f), "");
        GUI.Box(new Rect(21f, 105f, 200f * ((float)lives / maxLives), 18f), "");
        GUI.Label(new Rect(25f, 103f, 200f, 20f), $"VIDAS: {lives}/{maxLives}", new GUIStyle(hudStyle) { fontSize = 12 });

        float cs = Mathf.Clamp(Screen.width * 0.025f, 14f, 28f);
        GUI.DrawTexture(new Rect(Screen.width * 0.5f - cs * 0.5f, Screen.height * 0.5f - cs * 0.5f, cs, cs), crosshairTex);

        if (Application.isMobilePlatform || Input.touchSupported || Screen.width < 900)
        {
            float radius = Mathf.Clamp(Mathf.Min(Screen.width, Screen.height) * 0.12f, 56f, 92f);
            float centerX = Mathf.Max(76f, Screen.width * 0.12f);
            float centerY = Screen.height - Mathf.Max(82f, Screen.height * 0.16f);
            var padStyle = new GUIStyle(GUI.skin.box) { alignment = TextAnchor.MiddleCenter, fontSize = Mathf.RoundToInt(radius * 0.24f) };
            GUI.color = new Color(1f, 1f, 1f, 0.5f);
            GUI.Box(new Rect(centerX - radius, centerY - radius, radius * 2f, radius * 2f), "MOVE", padStyle);
            float knob = radius * 0.64f;
            GUI.Box(new Rect(centerX + mobileMove.x * radius - knob * 0.5f, centerY - mobileMove.y * radius - knob * 0.5f, knob, knob), "", padStyle);

            float fireSize = radius * 1.35f;
            GUI.Box(new Rect(Screen.width - fireSize - 20f, Screen.height - fireSize - 24f, fireSize, fireSize), "FIRE", new GUIStyle(GUI.skin.box) { alignment = TextAnchor.MiddleCenter, fontSize = Mathf.RoundToInt(radius * 0.28f), fontStyle = FontStyle.Bold });
            GUI.color = Color.white;
        }

        if (!waveComplete)
        {
            if (zombiesAlive <= 0 && zombiesSpawnedThisWave < zombiesPerWave + wave)
                GUI.Label(new Rect(Screen.width * 0.5f - 100f, Screen.height * 0.3f, 200f, 30f), "PREPARATE...", new GUIStyle(hudStyle) { alignment = TextAnchor.MiddleCenter, fontSize = 22, normal = { textColor = Color.white } });
            else
                GUI.Label(new Rect(20f, 128f, 300f, 24f), $"ZOMBIES VIVOS: {zombiesAlive}", hudStyle);
        }

        if (waveComplete)
        {
            var readyStyle = new GUIStyle(GUI.skin.label) { fontSize = 22, alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(0.2f, 1f, 0.4f) } };
            GUI.Label(new Rect(0f, Screen.height * 0.28f, Screen.width, 30f), "OLEADA COMPLETADA", readyStyle);

            float btnW = Mathf.Clamp(Screen.width * 0.24f, 140f, 240f);
            float btnH = Mathf.Clamp(Screen.height * 0.06f, 40f, 55f);
            int conn = wp.connections.Length;
            if (conn == 0)
                GUI.Label(new Rect(0f, Screen.height * 0.36f, Screen.width, 30f), "No hay mas calles", hudStyle);
            else for (int i = 0; i < conn; i++)
            {
                var tw = ToroWaypoints[wp.connections[i]];
                float x = Screen.width * 0.5f - btnW * 0.5f;
                float y = Screen.height * 0.36f + i * (btnH + 8f);
                if (GUI.Button(new Rect(x, y, btnW, btnH), $"IR A  {tw.name}"))
                    MoveToWaypoint(wp.connections[i]);
            }
        }

        if (gameOver)
        {
            var msgStyle = new GUIStyle(GUI.skin.label) { fontSize = Mathf.Clamp(Screen.width / 20, 30, 50), alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(1f, 0.2f, 0.2f) } };
            GUI.Label(new Rect(0f, Screen.height * 0.22f, Screen.width, 100f), "GAME OVER", msgStyle);
            GUI.Label(new Rect(0f, Screen.height * 0.22f + 70f, Screen.width, 30f), $"Puntuacion final: {score}", new GUIStyle(hudStyle) { alignment = TextAnchor.MiddleCenter, fontSize = 20 });
            GUI.Label(new Rect(0f, Screen.height * 0.22f + 105f, Screen.width, 30f), "Pulsa R o ENTER para reiniciar", new GUIStyle(hudStyle) { alignment = TextAnchor.MiddleCenter });
        }
    }

    private void BuildMusic()
    {
        const int sampleRate = 22050;
        float duration = 32f;
        int totalSamples = Mathf.CeilToInt(sampleRate * duration);
        var samples = new float[totalSamples];
        var rng = new System.Random(1337);

        float[] bassNotes = { 55f, 51.91f, 46.25f, 61.74f, 55f, 41.2f, 46.25f, 51.91f };
        float[] leadNotes = { 220f, 246.94f, 261.63f, 293.66f, 329.63f, 349.23f, 392f };
        int[] leadPattern = { 0, 2, 1, 0, 4, 3, 1, 0, 5, 4, 2, 1, 6, 4, 3, 1 };

        int beatLength = sampleRate / 2;
        int leadBeat = sampleRate / 4;

        for (int i = 0; i < totalSamples; i++)
        {
            float t = (float)i / sampleRate;
            float noise = ((float)rng.NextDouble() * 2f - 1f);

            int bassIdx = (i / (beatLength * 4)) % bassNotes.Length;
            float bassFreq = bassNotes[bassIdx];
            float bassPulse = 1f - (float)(i % beatLength) / beatLength;
            bassPulse = Mathf.Clamp01(bassPulse * 1.8f);
            float bass = Mathf.Sin(2f * Mathf.PI * bassFreq * t) * 0.16f * bassPulse;
            bass += Mathf.Sign(Mathf.Sin(2f * Mathf.PI * bassFreq * 0.5f * t)) * 0.045f;

            int leadIdx = (i / leadBeat) % leadPattern.Length;
            float leadFreq = leadNotes[leadPattern[leadIdx]];
            float leadEnv = Mathf.Clamp01(1f - ((float)(i % leadBeat) / leadBeat) * 2.8f);
            float lead = Mathf.Sin(2f * Mathf.PI * leadFreq * t) * 0.055f * leadEnv;
            lead += Mathf.Sin(2f * Mathf.PI * (leadFreq * 1.01f) * t) * 0.025f * leadEnv;

            float drone = Mathf.Sin(2f * Mathf.PI * 27.5f * t) * 0.055f;
            drone += Mathf.Sin(2f * Mathf.PI * 32.7f * t) * 0.035f;
            drone += Mathf.Sin(2f * Mathf.PI * 65.4f * t + Mathf.Sin(t * 0.45f) * 2.5f) * 0.025f;

            float kickEnv = Mathf.Clamp01(1f - (float)(i % (beatLength * 2)) / (beatLength * 0.22f));
            float kick = Mathf.Sin(2f * Mathf.PI * 58f * t) * 0.16f * kickEnv;

            float hatEnv = Mathf.Clamp01(1f - (float)(i % (sampleRate / 8)) / (sampleRate / 50f));
            float scratch = noise * 0.018f * hatEnv;

            float thunderEnv = Mathf.Clamp01(Mathf.Sin(t * 0.12f) * 0.5f + 0.5f);
            float thunder = noise * noise * Mathf.Sign(noise) * 0.018f * thunderEnv;

            samples[i] = Mathf.Clamp((bass + lead + drone + kick + scratch + thunder) * 0.72f, -1f, 1f);
        }

        musicLoop = AudioClip.Create("ZombiesToroDarkTheme", totalSamples, 1, sampleRate, false);
        musicLoop.SetData(samples, 0);
    }

    private void PlaySound(AudioClip clip, float volume)
    {
        if (audioSource != null && clip != null) audioSource.PlayOneShot(clip, volume);
    }

    private delegate float SampleBuilder(float t, float p, System.Random rng);

    private AudioClip CreateProceduralClip(string clipName, float duration, int seed, SampleBuilder builder)
    {
        const int sampleRate = 22050;
        int sampleCount = Mathf.CeilToInt(sampleRate * duration);
        var samples = new float[sampleCount];
        var rng = new System.Random(seed);
        for (int i = 0; i < sampleCount; i++)
        {
            float t = (float)i / sampleRate;
            float p = (float)i / Mathf.Max(1, sampleCount - 1);
            samples[i] = Mathf.Clamp(builder(t, p, rng), -1f, 1f);
        }
        var clip = AudioClip.Create(clipName, sampleCount, 1, sampleRate, false);
        clip.SetData(samples, 0);
        return clip;
    }

    private AudioClip CreateGunshot()
    {
        return CreateProceduralClip("ShotgunBlast", 0.34f, 41, (t, p, rng) =>
        {
            float noise = ((float)rng.NextDouble() * 2f - 1f);
            float crack = noise * Mathf.Exp(-p * 18f) * 0.88f;
            float thump = Mathf.Sin(2f * Mathf.PI * 78f * t) * Mathf.Exp(-p * 7f) * 0.52f;
            float ring = Mathf.Sin(2f * Mathf.PI * (420f - 180f * p) * t) * Mathf.Exp(-p * 12f) * 0.18f;
            return crack + thump + ring;
        });
    }

    private AudioClip CreateHitImpact()
    {
        return CreateProceduralClip("WetHit", 0.24f, 82, (t, p, rng) =>
        {
            float noise = ((float)rng.NextDouble() * 2f - 1f);
            float crunch = noise * Mathf.Exp(-p * 10f) * 0.45f;
            float body = Mathf.Sin(2f * Mathf.PI * (135f - 50f * p) * t) * Mathf.Exp(-p * 6f) * 0.32f;
            return crunch + body;
        });
    }

    private AudioClip CreateZombieDeath()
    {
        return CreateProceduralClip("ZombieCollapse", 0.85f, 123, (t, p, rng) =>
        {
            float noise = ((float)rng.NextDouble() * 2f - 1f) * 0.045f;
            float freq = 130f - 75f * p + Mathf.Sin(t * 18f) * 8f;
            float groan = Mathf.Sin(2f * Mathf.PI * freq * t) * (1f - p) * 0.46f;
            float grit = Mathf.Sign(Mathf.Sin(2f * Mathf.PI * (freq * 0.5f) * t)) * (1f - p) * 0.11f;
            return groan + grit + noise;
        });
    }

    private AudioClip CreateZombieGroan()
    {
        return CreateProceduralClip("ZombieGroan", 1.35f, 311, (t, p, rng) =>
        {
            float noise = ((float)rng.NextDouble() * 2f - 1f) * 0.035f;
            float env = Mathf.Sin(Mathf.PI * p);
            float vowel = Mathf.Sin(2f * Mathf.PI * (72f + Mathf.Sin(t * 5f) * 14f) * t);
            vowel += Mathf.Sin(2f * Mathf.PI * (96f + Mathf.Sin(t * 3.7f) * 12f) * t) * 0.55f;
            float rasp = Mathf.Sign(Mathf.Sin(2f * Mathf.PI * 28f * t)) * 0.18f;
            return (vowel * 0.36f + rasp + noise) * env;
        });
    }

    private AudioClip CreateFootstep()
    {
        return CreateProceduralClip("BootStep", 0.18f, 512, (t, p, rng) =>
        {
            float noise = ((float)rng.NextDouble() * 2f - 1f);
            float thud = Mathf.Sin(2f * Mathf.PI * 62f * t) * Mathf.Exp(-p * 12f) * 0.34f;
            float grit = noise * Mathf.Exp(-p * 18f) * 0.18f;
            return thud + grit;
        });
    }

    private AudioClip CreatePlayerHurt()
    {
        return CreateProceduralClip("PlayerHurt", 0.46f, 905, (t, p, rng) =>
        {
            float noise = ((float)rng.NextDouble() * 2f - 1f);
            float hit = noise * Mathf.Exp(-p * 14f) * 0.38f;
            float breath = Mathf.Sin(2f * Mathf.PI * (190f - 80f * p) * t) * Mathf.Sin(Mathf.PI * p) * 0.28f;
            float bass = Mathf.Sin(2f * Mathf.PI * 44f * t) * Mathf.Exp(-p * 5f) * 0.24f;
            return hit + breath + bass;
        });
    }

    private AudioClip CreateWaveClear()
    {
        return CreateProceduralClip("WaveClearStinger", 1.1f, 144, (t, p, rng) =>
        {
            float env = Mathf.Sin(Mathf.PI * p);
            float low = Mathf.Sin(2f * Mathf.PI * 110f * t) * 0.26f;
            float fifth = Mathf.Sin(2f * Mathf.PI * 164.8f * t) * 0.18f;
            float octave = Mathf.Sin(2f * Mathf.PI * 220f * t) * 0.12f;
            float sweep = Mathf.Sin(2f * Mathf.PI * (300f + 160f * p) * t) * 0.08f;
            return (low + fifth + octave + sweep) * env;
        });
    }
}
